import express, { type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createPersonaAgent, generatePersonaFromMaterials, type Persona, type UserFeedback } from '../services/personaAgent.js';
import { getMaterials, getPersonas, addPersona, updatePersona, deletePersona, savePersonas, loadMaterials, loadPersonas } from '../data/store.js';

const router = express.Router();

loadMaterials();
loadPersonas();

router.post('/persona', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, style, materialIds = [] } = req.body;

    if (!name && materialIds.length === 0) {
      res.status(400).json({ success: false, error: 'Name or materialIds is required' });
      return;
    }

    let personaData: Omit<Persona, 'id' | 'createdAt' | 'updatedAt'>;

    if (materialIds.length > 0) {
      const allMaterials = getMaterials();
      console.log('All materials in store:', allMaterials.map(m => ({ id: m.id, title: m.title, status: m.status })));
      
      const selectedMaterials = allMaterials.filter(m => materialIds.includes(m.id) && m.status === 'completed');
      console.log('Selected materials:', selectedMaterials.map(m => ({ id: m.id, title: m.title, contentLength: m.content?.length })));
      
      if (selectedMaterials.length === 0) {
        res.status(400).json({ success: false, error: 'No valid materials found. Please upload and process materials first.' });
        return;
      }

      personaData = await generatePersonaFromMaterials(
        selectedMaterials.map(m => ({
          id: m.id,
          content: m.content || m.summary || '',
          summary: m.summary,
          type: m.type,
        })),
        name
      );
    } else {
      personaData = {
        name: name || 'AI人格',
        description: description || '',
        style: style || 'gentle',
        systemPrompt: description || '你是一个温暖的AI情感助手。',
        knowledgeGraph: [],
        rules: [
          {
            id: 'rule-1',
            name: '基本规则',
            description: '保持友好和专业',
            priority: 1,
            action: '保持友好和专业',
          },
        ],
        stats: {
          totalConversations: 0,
          successfulInteractions: 0,
          failedInteractions: 0,
          feedbackScores: [],
          lastUpdated: new Date(),
        },
      };
    }

    const persona: Persona = {
      ...personaData,
      id: uuidv4(),
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      materialIds,
    };

    addPersona(persona);

    res.json({ success: true, data: persona });
  } catch (error) {
    console.error('Create persona error:', error);
    res.status(500).json({ success: false, error: 'Failed to create persona' });
  }
});

router.get('/personas', (req: Request, res: Response): void => {
  const personas = getPersonas();
  res.json({ success: true, data: personas });
});

router.get('/persona/:id', (req: Request, res: Response): void => {
  const { id } = req.params;
  const personas = getPersonas();
  const persona = personas.find(p => p.id === id);

  if (!persona) {
    res.status(404).json({ success: false, error: 'Persona not found' });
    return;
  }

  res.json({ success: true, data: persona });
});

router.put('/persona/:id/activate', (req: Request, res: Response): void => {
  const { id } = req.params;
  const personas = getPersonas();
  
  personas.forEach((p, i) => {
    personas[i].isActive = p.id === id;
  });
  
  savePersonas(personas);
  const activated = personas.find(p => p.id === id);
  res.json({ success: true, data: activated });
});

router.put('/persona/:id', (req: Request, res: Response): void => {
  const { id } = req.params;
  const { name, description, style, systemPrompt, rules } = req.body;
  
  const personas = getPersonas();
  const index = personas.findIndex(p => p.id === id);

  if (index === -1) {
    res.status(404).json({ success: false, error: 'Persona not found' });
    return;
  }

  personas[index] = {
    ...personas[index],
    name: name || personas[index].name,
    description: description || personas[index].description,
    style: style || personas[index].style,
    systemPrompt: systemPrompt || personas[index].systemPrompt,
    rules: rules || personas[index].rules,
    updatedAt: new Date(),
  };

  savePersonas(personas);
  res.json({ success: true, data: personas[index] });
});

router.delete('/persona/:id', (req: Request, res: Response): void => {
  const { id } = req.params;
  deletePersona(id);
  res.json({ success: true });
});

router.post('/persona/:id/feedback', (req: Request, res: Response): void => {
  const { id } = req.params;
  const { feedback, comment, messageId, conversationId } = req.body;

  const personas = getPersonas();
  const persona = personas.find(p => p.id === id);

  if (!persona) {
    res.status(404).json({ success: false, error: 'Persona not found' });
    return;
  }

  if (!persona.stats) {
    persona.stats = {
      totalConversations: 0,
      successfulInteractions: 0,
      failedInteractions: 0,
      feedbackScores: [],
      lastUpdated: new Date(),
    };
  }

  persona.stats.totalConversations++;
  if (feedback === 'positive') {
    persona.stats.successfulInteractions++;
    persona.stats.feedbackScores.push(1);
  } else if (feedback === 'negative') {
    persona.stats.failedInteractions++;
    persona.stats.feedbackScores.push(-1);
  } else {
    persona.stats.feedbackScores.push(0);
  }
  persona.stats.lastUpdated = new Date();

  savePersonas(personas);
  res.json({ success: true });
});

router.post('/persona/:id/reflect', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const personas = getPersonas();
  const persona = personas.find(p => p.id === id);

  if (!persona) {
    res.status(404).json({ success: false, error: 'Persona not found' });
    return;
  }

  try {
    const agent = createPersonaAgent(persona);
    const reflection = await agent.reflect();
    res.json({ success: true, data: reflection });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Reflection failed' });
  }
});

router.post('/persona/:id/chat', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { message, conversationHistory = [], useRag = true } = req.body;
    
    console.log('=== Incoming Chat Request ===');
    console.log('personaId:', id);
    console.log('message:', message);
    console.log('message length:', message?.length);
    console.log('useRag:', useRag);
    
    if (!message) {
      res.status(400).json({ success: false, error: 'Message is required' });
      return;
    }

    const personas = getPersonas();
    const persona = personas.find(p => p.id === id);

    if (!persona) {
      res.status(404).json({ success: false, error: 'Persona not found' });
      return;
    }

    const agent = createPersonaAgent(persona);

    const response = await agent.process({
      userMessage: message,
      conversationHistory,
      useRag: true,
    });

    res.json({
      success: response.success,
      data: {
        response: response.response,
        metadata: response.metadata,
      },
      error: response.error,
    });
  } catch (error: any) {
    console.error('Persona chat error:', error);
    res.status(500).json({ success: false, error: error.message || 'Chat failed' });
  }
});

export default router;
