import express, { type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { generateResponse, type ChatMessage } from '../services/chat.js';
import { analyzeImage } from '../services/multimodal.js';
import { createPersonaAgent } from '../services/personaAgent.js';
import { getConversations, getPersonaById, persistConversations } from '../data/store.js';

const router = express.Router();

// 会话持久化：重启不丢（data/conversations.json）
const conversations = getConversations();

router.post('/chat', async (req: Request, res: Response): Promise<void> => {
  try {
    const { message, conversationId, personaId, useRag = true, image } = req.body;

    console.log('=== /api/chat/chat ===');
    console.log('message:', message);
    console.log('personaId:', personaId);
    console.log('useRag:', useRag);
    console.log('hasImage:', image ? 'yes (base64)' : 'no');

    if (!message && !image) {
      res.status(400).json({ success: false, error: 'Message or image is required' });
      return;
    }

    let conversation = conversations.find(c => c.id === conversationId);

    if (!conversation) {
      conversation = {
        id: uuidv4(),
        title: (message || '图片对话').slice(0, 30) + '...',
        messages: [],
        personaId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      conversations.push(conversation);
      persistConversations();
    }

    const history = conversation.messages.map(m => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    }));

    let imageAnalysis = '';
    if (image) {
      try {
        imageAnalysis = await analyzeImage(
          image,
          '请详细描述这张图片的内容，包括人物、场景、动作、表情等细节。'
        );
        console.log('Image analysis result:', imageAnalysis);
      } catch (imgError) {
        console.error('Image analysis failed:', imgError);
        imageAnalysis = '[图片分析失败，无法识别图片内容]';
      }
    }

    const fullMessage = req.file
      ? `${message || '请分析这张图片'}\n\n[用户上传了一张图片]`
      : message;

    let response: string;

    if (personaId) {
      const persona = getPersonaById(personaId);
      if (persona) {
        try {
          // 同进程直调 PersonaAgent（原实现用相对 URL 自 fetch，Node 不支持，必然失败回退）
          const agent = createPersonaAgent(persona as any);
          const agentInput = imageAnalysis
            ? `${message || '请分析这张图片'}\n\n[图片分析结果] ${imageAnalysis}`
            : (message || '请分析这张图片');

          const agentResult = await agent.process({
            userMessage: agentInput,
            conversationHistory: history.slice(-5),
            useRag: true,
          });

          response = agentResult.success
            ? agentResult.response
            : await generateResponse(fullMessage, history, { useRag, ragLimit: 3 });
        } catch (agentError) {
          console.error('PersonaAgent 调用失败，回退通用回复:', agentError);
          response = await generateResponse(fullMessage, history, { useRag, ragLimit: 3 });
        }
      } else {
        response = await generateResponse(fullMessage, history, { useRag, ragLimit: 3 });
      }
    } else {
      const enhancedMessage = imageAnalysis
        ? `${fullMessage}\n\n[图片分析：${imageAnalysis}]`
        : fullMessage;

      response = await generateResponse(enhancedMessage, history, {
        useRag,
        ragLimit: 3,
      });
    }

    conversation.messages.push(
      { role: 'user', content: message || '[发送了一张图片]' },
      { role: 'assistant', content: response }
    );
    conversation.updatedAt = new Date();
    persistConversations();

    res.json({
      success: true,
      data: {
        response,
        conversationId: conversation.id,
        title: conversation.title,
        imageAnalysis,
      },
    });
  } catch (error: any) {
    console.error('Chat error:', error);

    let errorMessage = '抱歉，我现在无法回复。请稍后再试。';

    if (error.code === 'ETIMEDOUT' || error.cause?.code === 'ETIMEDOUT') {
      errorMessage = '网络连接超时，无法访问AI服务。请检查网络设置。';
    } else if (error.status === 401) {
      errorMessage = 'API Key无效或已过期，请检查配置。';
    } else if (error.status === 403) {
      errorMessage = 'API Key没有访问权限。';
    } else if (error.message?.includes('API Key')) {
      errorMessage = error.message;
    }

    res.status(500).json({ success: false, error: errorMessage });
  }
});

router.get('/conversations', (req: Request, res: Response): void => {
  const list = conversations.map(c => ({
    id: c.id,
    title: c.title,
    messageCount: c.messages.length,
    updatedAt: c.updatedAt,
  }));

  res.json({ success: true, data: list });
});

router.get('/conversations/:id', (req: Request, res: Response): void => {
  const { id } = req.params;
  const conversation = conversations.find(c => c.id === id);

  if (!conversation) {
    res.status(404).json({ success: false, error: 'Conversation not found' });
    return;
  }

  res.json({ success: true, data: conversation });
});

router.delete('/conversations/:id', (req: Request, res: Response): void => {
  const { id } = req.params;
  const index = conversations.findIndex(c => c.id === id);

  if (index === -1) {
    res.status(404).json({ success: false, error: 'Conversation not found' });
    return;
  }

  conversations.splice(index, 1);
  persistConversations();
  res.json({ success: true });
});

export default router;
