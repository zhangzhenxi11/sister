import express, { type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { processVideo, processAudio, processImage, processText, processPdf, type MaterialType } from '../services/multimodal.js';
import { addVectors } from '../services/vectorStore.js';
import { getMaterials, addMaterial, saveMaterials, loadMaterials, type Material } from '../data/store.js';

const router = express.Router();

loadMaterials();

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
});

function detectFileType(filename: string): MaterialType {
  const ext = filename.toLowerCase().split('.').pop() || '';
  const videoExts = ['mp4', 'avi', 'mov', 'mkv', 'webm'];
  const audioExts = ['mp3', 'wav', 'aac', 'm4a', 'ogg'];
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
  
  if (videoExts.includes(ext)) return 'video';
  if (audioExts.includes(ext)) return 'audio';
  if (imageExts.includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  return 'text';
}

router.post(
  '/upload',
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: 'No file uploaded' });
        return;
      }

      const autoType = detectFileType(req.file.originalname);
      const { type, title = req.file.originalname, description = '' } = req.body;
      const materialType = (type || autoType) as MaterialType;

      const material: Material = {
        id: uuidv4(),
        title,
        description,
        type: materialType,
        filePath: req.file.path,
        status: 'processing',
        createdAt: new Date(),
      };

      addMaterial(material);

      let processed;
      switch (materialType) {
        case 'video':
          processed = await processVideo(req.file.path);
          break;
        case 'audio':
          processed = await processAudio(req.file.path);
          break;
        case 'image':
          processed = await processImage(req.file.path);
          break;
        case 'pdf':
          processed = await processPdf(req.file.path);
          break;
        case 'text':
        default:
          processed = await processText(req.file.path);
          break;
      }

      material.summary = processed.summary;
      material.content = processed.content;
      material.status = 'completed';

      const materials = getMaterials();
      const index = materials.findIndex(m => m.id === material.id);
      if (index !== -1) {
        materials[index] = material;
        saveMaterials(materials);
      }

      try {
        await addVectors([
          {
            id: material.id,
            content: processed.content,
            metadata: {
              title: material.title,
              type: material.type,
            },
          },
        ]);
      } catch (vectorError) {
        console.warn('Vector storage failed, continuing without RAG:', vectorError);
      }

      res.json({ success: true, data: material });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ success: false, error: 'Failed to process file' });
    }
  }
);

router.get('/materials', (req: Request, res: Response): void => {
  const materials = getMaterials();
  res.json({ success: true, data: materials });
});

router.delete('/materials/:id', (req: Request, res: Response): void => {
  const { id } = req.params;
  const materials = getMaterials();
  const index = materials.findIndex(m => m.id === id);

  if (index === -1) {
    res.status(404).json({ success: false, error: 'Material not found' });
    return;
  }

  const material = materials[index];
  if (material.filePath && fs.existsSync(material.filePath)) {
    fs.unlinkSync(material.filePath);
  }

  materials.splice(index, 1);
  saveMaterials(materials);
  res.json({ success: true });
});

router.get('/materials/:id', (req: Request, res: Response): void => {
  const { id } = req.params;
  const materials = getMaterials();
  const material = materials.find(m => m.id === id);

  if (!material) {
    res.status(404).json({ success: false, error: 'Material not found' });
    return;
  }

  res.json({ success: true, data: material });
});

router.get('/local-files', (req: Request, res: Response): void => {
  try {
    if (!fs.existsSync(uploadDir)) {
      res.json({ success: true, data: [] });
      return;
    }

    const files = fs.readdirSync(uploadDir);
    const fileInfos = files
      .filter(f => !f.startsWith('.'))
      .map(fileName => {
        const filePath = path.join(uploadDir, fileName);
        const stats = fs.statSync(filePath);
        return {
          name: fileName,
          size: stats.size,
          uploadedAt: stats.birthtime,
        };
      })
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    res.json({ success: true, data: fileInfos });
  } catch (error) {
    console.error('Error reading local files:', error);
    res.json({ success: true, data: [] });
  }
});

export default router;
