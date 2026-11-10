import path from 'path';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import { default as Tesseract } from 'tesseract.js';
import { default as OpenAI } from 'openai';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { getLlmOverride } from './llmContext.js';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

async function parsePdf(filePath: string): Promise<{ text: string; numpages: number }> {
  const { PDFParse } = await import('pdf-parse');
  const dataBuffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: dataBuffer });
  try {
    const result = await parser.getText();
    return { text: result.text, numpages: result.total };
  } finally {
    await parser.destroy().catch(() => {});
  }
}

function getOpenAI() {
  const override = getLlmOverride();
  return new OpenAI({
    apiKey: override.apiKey || process.env.OPENAI_API_KEY,
    baseURL: override.baseURL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  });
}

export type MaterialType = 'video' | 'audio' | 'image' | 'text' | 'pdf';

export interface ProcessedMaterial {
  id: string;
  content: string;
  summary?: string;
  metadata: Record<string, unknown>;
}

export async function processVideo(
  filePath: string,
  options?: { maxFrames?: number }
): Promise<ProcessedMaterial> {
  const maxFrames = options?.maxFrames || 10;
  const framesDir = path.join(process.cwd(), 'uploads', 'frames', path.basename(filePath, path.extname(filePath)));

  if (!fs.existsSync(framesDir)) {
    fs.mkdirSync(framesDir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    ffmpeg(filePath)
      .on('end', async () => {
        try {
          const frames = fs.readdirSync(framesDir).filter(f => f.endsWith('.jpg'));
          const frameContents: string[] = [];

          for (const frame of frames.slice(0, maxFrames)) {
            const framePath = path.join(framesDir, frame);
            const analysis = await analyzeImage(framePath, '这是视频的一帧，请描述画面中的关键内容');
            frameContents.push(analysis);
          }

          const summary = await summarizeContent(
            frameContents.join('\n\n'),
            '这是一段视频的多个关键帧内容总结，请提取主要信息和主题'
          );

          resolve({
            id: path.basename(filePath),
            content: frameContents.join('\n\n'),
            summary,
            metadata: { type: 'video', frameCount: frames.length },
          });
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject)
      .screenshots({
        count: maxFrames,
        folder: framesDir,
        size: '640x480',
        filename: 'frame-%i.jpg',
      });
  });
}

export async function processAudio(filePath: string): Promise<ProcessedMaterial> {
  const openai = getOpenAI();

  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model: 'whisper-1',
  });

  const summary = await summarizeContent(
    transcription.text,
    '请总结这段语音的主要内容'
  );

  return {
    id: path.basename(filePath),
    content: transcription.text,
    summary,
    metadata: { type: 'audio', duration: 'unknown' },
  };
}

export async function processImage(filePath: string): Promise<ProcessedMaterial> {
  const ocrText = await Tesseract.recognize(filePath, 'chi_sim+eng', {
    logger: () => {},
  });

  const summary = await summarizeContent(
    ocrText.data.text,
    '请总结这张图片中的文字内容'
  );

  return {
    id: path.basename(filePath),
    content: ocrText.data.text,
    summary,
    metadata: { type: 'image', confidence: ocrText.data.confidence },
  };
}

export async function processPdf(filePath: string): Promise<ProcessedMaterial> {
  const data = await parsePdf(filePath);
  
  const cleanContent = data.text
    .replace(/\s+/g, ' ')
    .trim();

  const summary = await summarizeContent(
    cleanContent,
    '请用简洁的语言总结这份PDF文档的主要内容'
  );

  return {
    id: path.basename(filePath),
    content: cleanContent,
    summary,
    metadata: { type: 'pdf', pageCount: data.numpages },
  };
}

export async function processText(filePath: string): Promise<ProcessedMaterial> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const cleanContent = content
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const summary = await summarizeContent(
    cleanContent,
    '请用简洁的语言总结这段文本的主要内容'
  );

  return {
    id: path.basename(filePath),
    content: cleanContent,
    summary,
    metadata: { type: 'text', length: cleanContent.length },
  };
}

export async function analyzeImage(imageData: string, prompt: string): Promise<string> {
  console.log('=== analyzeImage ===');
  console.log('Image data starts with:', imageData.substring(0, 30));
  
  try {
    if (imageData.startsWith('data:')) {
      console.log('Using Tesseract OCR for image analysis...');
      const result = await Tesseract.recognize(imageData, 'chi_sim+eng', {
        logger: (m) => console.log('OCR progress:', Math.round(m.progress * 100) + '%'),
      });
      
      const ocrText = result.data.text.trim();
      console.log('OCR result:', ocrText ? ocrText.substring(0, 200) : 'No text found');
      
      if (ocrText) {
        return `图片文字内容：\n${ocrText}`;
      }
    }
    
    console.log('No text found via OCR, trying GPT Vision as fallback...');
    const openai = getOpenAI();

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { url: imageData, detail: 'low' },
            },
          ],
        },
      ],
      max_tokens: 500,
    });

    return response.choices[0].message.content || '';
  } catch (error: any) {
    console.error('Image analysis failed:', error.message);
    return '[图片分析失败]';
  }
}

async function summarizeContent(content: string, prompt: string): Promise<string> {
  const openai = getOpenAI();

  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: '你是一个内容总结专家，请用简洁清晰的语言总结用户提供的文本。',
      },
      {
        role: 'user',
        content: `${prompt}\n\n内容：${content.slice(0, 4000)}`,
      },
    ],
    max_tokens: 1000,
  });

  return response.choices[0].message.content || '';
}
