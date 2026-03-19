import express, { type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { generateResponse, type ChatMessage } from '../services/chat.js';

const router = express.Router();

interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  personaId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const conversations: Conversation[] = [];

router.post('/chat', async (req: Request, res: Response): Promise<void> => {
  try {
    const { message, conversationId, personaId, useRag = false } = req.body;

    if (!message) {
      res.status(400).json({ success: false, error: 'Message is required' });
      return;
    }

    let conversation: Conversation | undefined;

    if (conversationId) {
      conversation = conversations.find(c => c.id === conversationId);
    }

    if (!conversation) {
      conversation = {
        id: uuidv4(),
        title: message.slice(0, 30) + '...',
        messages: [],
        personaId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      conversations.push(conversation);
    }

    const history = conversation.messages.map(m => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    }));

    let response: string;

    if (personaId) {
      try {
        const personaResponse = await fetch(`/api/learn/persona/${personaId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            conversationHistory: history.slice(-5),
            useRag,
          }),
        });
        
        const personaData = await personaResponse.json();
        
        if (personaData.success) {
          response = personaData.data.response;
        } else {
          response = await generateResponse(message, history, {
            useRag,
            ragLimit: 3,
          });
        }
      } catch {
        response = await generateResponse(message, history, {
          useRag,
          ragLimit: 3,
        });
      }
    } else {
      response = await generateResponse(message, history, {
        useRag,
        ragLimit: 3,
      });
    }

    conversation.messages.push(
      { role: 'user', content: message },
      { role: 'assistant', content: response }
    );
    conversation.updatedAt = new Date();

    res.json({
      success: true,
      data: {
        response,
        conversationId: conversation.id,
        title: conversation.title,
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
  res.json({ success: true });
});

export default router;
