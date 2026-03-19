import express, { type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { createPersonaAgent, generatePersonaFromMaterials, type Persona, type UserFeedback } from '../services/personaAgent.js';
import { searchSimilar } from '../services/vectorStore.js';
import { materials } from './learn.js';

const router = express.Router();

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export interface PersonaRecord extends Persona {
  isActive: boolean;
}

const personas: PersonaRecord[] = [];
const agentInstances: Map<string, ReturnType<typeof createPersonaAgent>> = new Map();

function savePersonasToFile() {
  try {
    const data = personas.map(p => ({
      ...p,
      knowledgeGraph: p.knowledgeGraph?.slice(0, 10),
    }));
    fs.writeFileSync(path.join(dataDir, 'personas.json'), JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Failed to save personas:', error);
  }
}

function loadPersonasFromFile() {
  try {
    const filePath = path.join(dataDir, 'personas.json');
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      personas.push(...data);
    }
  } catch (error) {
    console.error('Failed to load personas:', error);
  }
}

loadPersonasFromFile();

router.post('/persona', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, style, materialIds = [] } = req.body;

    if (!name && materialIds.length === 0) {
      res.status(400).json({ success: false, error: 'Name or materialIds is required' });
      return;
    }

    let personaData: Omit<Persona, 'id' | 'createdAt' | 'updatedAt'>;

    if (materialIds.length > 0) {
      console.log('Requested materialIds:', materialIds);
      console.log('Available materials:', materials.map(m => ({ id: m.id, title: m.title, status: m.status })));
      
      const selectedMaterials = materials.filter(m => materialIds.includes(m.id) && m.status === 'completed');
      
      console.log('Filtered materials:', selectedMaterials);
      
      if (selectedMaterials.length === 0) {
        res.status(400).json({ success: false, error: 'No valid materials found' });
        return;
      }

      console.log('Creating persona with materials:', selectedMaterials.map(m => ({ id: m.id, title: m.title, hasContent: !!m.content })));

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

    const persona: PersonaRecord = {
      ...personaData,
      id: uuidv4(),
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    personas.push(persona);
    agentInstances.set(persona.id, createPersonaAgent(persona));
    savePersonasToFile();

    res.json({ success: true, data: persona });
  } catch (error) {
    console.error('Create persona error:', error);
    res.status(500).json({ success: false, error: 'Failed to create persona' });
  }
});

router.get('/personas', (req: Request, res: Response): void => {
  res.json({ success: true, data: personas });
});

router.get('/persona/:id', (req: Request, res: Response): void => {
  const { id } = req.params;
  const persona = personas.find(p => p.id === id);

  if (!persona) {
    res.status(404).json({ success: false, error: 'Persona not found' });
    return;
  }

  res.json({ success: true, data: persona });
});

router.put('/persona/:id/activate', (req: Request, res: Response): void => {
  const { id } = req.params;
  const index = personas.findIndex(p => p.id === id);

  if (index === -1) {
    res.status(404).json({ success: false, error: 'Persona not found' });
    return;
  }

  personas.forEach((p, i) => {
    personas[i].isActive = p.id === id;
  });

  savePersonasToFile();
  res.json({ success: true, data: personas[index] });
});

router.put('/persona/:id', (req: Request, res: Response): void => {
  const { id } = req.params;
  const index = personas.findIndex(p => p.id === id);

  if (index === -1) {
    res.status(404).json({ success: false, error: 'Persona not found' });
    return;
  }

  const { name, description, style, systemPrompt, rules } = req.body;

  personas[index] = {
    ...personas[index],
    name: name || personas[index].name,
    description: description || personas[index].description,
    style: style || personas[index].style,
    systemPrompt: systemPrompt || personas[index].systemPrompt,
    rules: rules || personas[index].rules,
    updatedAt: new Date(),
  };

  if (agentInstances.has(id)) {
    agentInstances.set(id, createPersonaAgent(personas[index]));
  }

  savePersonasToFile();
  res.json({ success: true, data: personas[index] });
});

router.delete('/persona/:id', (req: Request, res: Response): void => {
  const { id } = req.params;
  const index = personas.findIndex(p => p.id === id);

  if (index === -1) {
    res.status(404).json({ success: false, error: 'Persona not found' });
    return;
  }

  personas.splice(index, 1);
  agentInstances.delete(id);
  savePersonasToFile();

  res.json({ success: true });
});

router.post('/persona/:id/feedback', (req: Request, res: Response): void => {
  const { id } = req.params;
  const { feedback, comment, messageId, conversationId } = req.body;

  const agent = agentInstances.get(id);
  if (!agent) {
    res.status(404).json({ success: false, error: 'Persona not found' });
    return;
  }

  const userFeedback: UserFeedback = {
    conversationId,
    messageId,
    feedback: feedback || 'neutral',
    comment,
    timestamp: new Date(),
  };

  agent.addFeedback(userFeedback);
  savePersonasToFile();

  res.json({ success: true });
});

router.post('/persona/:id/reflect', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const agent = agentInstances.get(id);
  if (!agent) {
    res.status(404).json({ success: false, error: 'Persona not found' });
    return;
  }

  try {
    const reflection = await agent.reflect();
    savePersonasToFile();
    res.json({ success: true, data: reflection });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Reflection failed' });
  }
});

router.post('/persona/:id/chat', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { message, conversationHistory = [], useRag = false } = req.body;

    if (!message) {
      res.status(400).json({ success: false, error: 'Message is required' });
      return;
    }

    const persona = personas.find(p => p.id === id);
    if (!persona) {
      res.status(404).json({ success: false, error: 'Persona not found' });
      return;
    }

    let agent = agentInstances.get(id);
    if (!agent) {
      agent = createPersonaAgent(persona);
      agentInstances.set(id, agent);
    }

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
