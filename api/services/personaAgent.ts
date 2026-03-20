import { default as OpenAI } from 'openai';

function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  });
}

export interface Persona {
  id: string;
  name: string;
  description: string;
  style: 'gentle' | 'rational' | 'humorous' | 'custom';
  systemPrompt: string;
  knowledgeGraph: KnowledgeNode[];
  rules: PersonaRule[];
  createdAt: Date;
  updatedAt: Date;
  stats: PersonaStats;
}

export interface KnowledgeNode {
  id: string;
  type: 'concept' | 'strategy' | 'example' | 'rule';
  content: string;
  sourceMaterialId?: string;
  embedding?: number[];
  weight: number;
  createdAt: Date;
}

export interface PersonaRule {
  id: string;
  name: string;
  description: string;
  priority: number;
  condition?: string;
  action: string;
}

export interface PersonaStats {
  totalConversations: number;
  successfulInteractions: number;
  failedInteractions: number;
  feedbackScores: number[];
  lastUpdated: Date;
}

export interface UserFeedback {
  conversationId: string;
  messageId: string;
  feedback: 'positive' | 'negative' | 'neutral';
  comment?: string;
  timestamp: Date;
}

export interface ProcessingContext {
  userMessage: string;
  conversationHistory: Array<{ role: string; content: string }>;
  userProfile?: {
    relationshipStatus: string;
    interests: string[];
    preferences: Record<string, any>;
  };
  useRag: boolean;
}

class PersonaAgent {
  private persona: Persona;
  private feedbackHistory: UserFeedback[] = [];

  constructor(persona: Persona) {
    this.persona = persona;
  }

  async process(input: ProcessingContext): Promise<AgentResponse> {
    const startTime = Date.now();
    
    try {
      console.log('=== PersonaAgent.process ===');
      console.log('useRag:', input.useRag);
      console.log('knowledgeGraph length:', this.persona.knowledgeGraph?.length);
      
      let contextInfo = '';
      
      if (input.useRag && this.persona.knowledgeGraph && this.persona.knowledgeGraph.length > 0) {
        const relevantKnowledge = this.findRelevantKnowledge(input.userMessage);
        console.log('Relevant knowledge count:', relevantKnowledge.length);
        
        if (relevantKnowledge.length > 0) {
          contextInfo = `\n\n## 你在学习资料中学到的知识（回答时要引用这些知识）：\n${relevantKnowledge.map(k => `- ${k.content}`).join('\n')}`;
        } else {
          console.log('No relevant knowledge found, using ALL knowledge');
          contextInfo = `\n\n## 你在学习资料中学到的知识（回答时要引用这些知识）：\n${this.persona.knowledgeGraph.map(k => `- ${k.content}`).join('\n')}`;
        }
      } else {
        console.log('No knowledge graph or useRag is false');
      }

      const thoughtProcess = await this.think(input, contextInfo);
      
      const response = await this.execute(input.userMessage, thoughtProcess, contextInfo);
      
      const executionTime = Date.now() - startTime;
      
      return {
        success: true,
        response: response.content,
        metadata: {
          thoughtProcess,
          executionTime,
          personaId: this.persona.id,
          confidence: response.confidence,
          knowledgeSources: this.persona.knowledgeGraph?.slice(0, 3).map(k => k.id) || [],
        },
      };
    } catch (error) {
      console.error('Agent process error:', error);
      return {
        success: false,
        response: '抱歉，我现在无法给出回复。请稍后再试。',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private findRelevantKnowledge(query: string): KnowledgeNode[] {
    if (!this.persona.knowledgeGraph || this.persona.knowledgeGraph.length === 0) {
      console.log('Knowledge graph is empty');
      return [];
    }

    console.log('=== RAG Search ===');
    console.log('Query:', query);
    console.log('Total knowledge nodes:', this.persona.knowledgeGraph.length);

    const queryLower = query.toLowerCase();
    
    const keywords = [
      ...queryLower.split(/\s+/).filter(w => w.length > 1),
      ...queryLower.split(/[,，、。.]/).filter(w => w.length > 1)
    ];
    
    const semanticKeywords: Record<string, string[]> = {
      '女性': ['女性', '女生', '女孩', '女人', '她'],
      '恋爱': ['恋爱', '追女生', '把妹', '撩妹', '约会', '交往', '两性'],
      '心理': ['心理', '内心', '想法', '思维', '动机'],
      '沟通': ['沟通', '交流', '说话', '表达'],
      '情感': ['情感', '感情', '情绪', '感觉'],
    };
    
    for (const [key, values] of Object.entries(semanticKeywords)) {
      if (values.some(v => queryLower.includes(v))) {
        keywords.push(...values);
      }
    }
    
    console.log('Search keywords:', [...new Set(keywords)]);
    
    const scored = this.persona.knowledgeGraph.map(node => {
      let score = 0;
      const contentLower = node.content.toLowerCase();
      
      for (const keyword of keywords) {
        if (contentLower.includes(keyword)) {
          score += keyword.length * 2;
        }
      }
      
      if (queryLower.includes('女性') || queryLower.includes('女生') || queryLower.includes('她')) {
        if (contentLower.includes('女性') || contentLower.includes('女生')) {
          score += 100;
        }
      }
      
      if (queryLower.includes('心理') || queryLower.includes('想法')) {
        if (contentLower.includes('心理') || contentLower.includes('内心') || contentLower.includes('矛盾')) {
          score += 80;
        }
      }
      
      score += node.weight * 20;
      
      return { node, score };
    });
    
    scored.sort((a, b) => b.score - a.score);
    
    const results = scored.slice(0, 5).map(s => s.node);
    console.log('Found relevant knowledge:', results.length, 'nodes');
    console.log('Top results:', results.map(r => r.content?.slice(0, 50)));
    
    return results;
  }

  private async think(context: ProcessingContext, contextInfo: string): Promise<ThoughtProcess> {
    const openai = getOpenAI();
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const thinkingPrompt = `
你正在以"${this.persona.name}"的身份思考如何回复用户。

## 人格描述
${this.persona.description}

## 系统提示词
${this.persona.systemPrompt}

## 你必须遵守的规则
${this.persona.rules?.map(r => `- ${r.name}: ${r.action}`).join('\n') || '无特殊规则'}

${contextInfo}

## 当前对话历史
${context.conversationHistory.slice(-5).map(m => `${m.role}: ${m.content}`).join('\n')}

## 用户当前消息
${context.userMessage}

请分析并输出你的思考过程：
1. 分析用户意图和情感状态
2. 决定是否引用学习到的知识
3. 选择合适的回复策略
`;

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: '你是一个AI思考过程分析器，请详细分析并输出思考步骤。' },
        { role: 'user', content: thinkingPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    return {
      analysis: response.choices[0].message.content || '',
      timestamp: new Date(),
    };
  }

  private async execute(userMessage: string, thoughtProcess: ThoughtProcess, contextInfo: string): Promise<ExecutionResult> {
    const openai = getOpenAI();
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    console.log('=== Execute Phase ===');
    console.log('contextInfo:', contextInfo ? contextInfo.slice(0, 200) : 'EMPTY');

    const rulesContent = this.persona.rules?.map(r => 
      `规则${r.priority} (${r.name}): ${r.action}`
    ).join('\n') || '';

    const combinedSystemPrompt = `
# 你的身份
你是"${this.persona.name}"，你是一个知识传递者。

# 知识库（唯一知识来源）
${contextInfo || '【无知识库】'}

# 回答规则（必须遵守）
1. 直接讲述知识库中的内容，不添加任何解释
2. 禁止说"我觉得"、"你应该"、"要尊重"之类的建议
3. 禁止道德说教、禁止劝人为善
4. 禁止"多沟通"、"多理解"这种废话
5. 只输出知识，不输出观点
6. 如果知识库没相关内容，只说"我不知道"
`;

    const executionPrompt = `
用户问题: ${userMessage}

直接回答，只输出知识。
`;

    console.log('System prompt:', combinedSystemPrompt.slice(0, 300));
    console.log('User prompt:', executionPrompt);

    try {
      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: combinedSystemPrompt },
          { role: 'user', content: executionPrompt },
        ],
        temperature: this.getTemperatureByStyle(),
        max_tokens: 1500,
      });

      const content = response.choices[0].message.content || '';
      console.log('AI Response:', content.slice(0, 300));

      return {
        content: content,
        confidence: 0.8,
        usedKnowledge: this.persona.knowledgeGraph?.slice(0, 3).map(k => k.id) || [],
      };
    } catch (error: any) {
      console.error('Execute error:', error.message);
      throw error;
    }
  }

  private getTemperatureByStyle(): number {
    switch (this.persona.style) {
      case 'humorous': return 0.9;
      case 'gentle': return 0.6;
      case 'rational': return 0.4;
      default: return 0.7;
    }
  }

  addFeedback(feedback: UserFeedback): void {
    this.feedbackHistory.push(feedback);
    this.updateStats(feedback);
  }

  private updateStats(feedback: UserFeedback): void {
    if (!this.persona.stats) {
      this.persona.stats = {
        totalConversations: 0,
        successfulInteractions: 0,
        failedInteractions: 0,
        feedbackScores: [],
        lastUpdated: new Date(),
      };
    }
    
    this.persona.stats.totalConversations++;
    
    if (feedback.feedback === 'positive') {
      this.persona.stats.successfulInteractions++;
      this.persona.stats.feedbackScores.push(1);
    } else if (feedback.feedback === 'negative') {
      this.persona.stats.failedInteractions++;
      this.persona.stats.feedbackScores.push(-1);
    } else {
      this.persona.stats.feedbackScores.push(0);
    }
    
    this.persona.stats.lastUpdated = new Date();
  }

  async reflect(): Promise<ReflectionResult> {
    if (this.feedbackHistory.length < 3) {
      return {
        insights: ['收集更多反馈后可进行深度反思'],
        improvements: ['继续积累对话经验'],
        ready: false,
      };
    }

    const openai = getOpenAI();
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const recentFeedback = this.feedbackHistory.slice(-10);
    
    const reflectionPrompt = `
你正在反思"${this.persona.name}"这个AI人格的表现。

## 最近的用户反馈
${recentFeedback.map(f => `- ${f.feedback}: ${f.comment || '无评论'}`).join('\n')}

## 当前统计
- 总对话数: ${this.persona.stats?.totalConversations || 0}
- 成功互动: ${this.persona.stats?.successfulInteractions || 0}
- 失败互动: ${this.persona.stats?.failedInteractions || 0}

## 当前人格描述
${this.persona.description}

## 知识掌握情况
${this.persona.knowledgeGraph?.length || 0}个知识点

请分析并给出：
1. Insights - 从反馈中发现的关键洞察
2. Improvements - 具体的改进建议
3. ready - 是否准备好进行优化
`;

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: '你是一个AI人格反思专家，请分析反馈并给出改进建议。' },
        { role: 'user', content: reflectionPrompt },
      ],
      temperature: 0.5,
      max_tokens: 1500,
    });

    const content = response.choices[0].message.content || '';
    
    return {
      insights: this.extractInsights(content),
      improvements: this.extractImprovements(content),
      ready: this.persona.stats?.feedbackScores?.length >= 5 || false,
    };
  }

  private extractInsights(text: string): string[] {
    const insights: string[] = [];
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.includes('Insight') || line.includes('洞察') || line.includes('发现')) {
        insights.push(line.replace(/^[#\s]*/, '').trim());
      }
    }
    return insights.length > 0 ? insights : ['持续优化中'];
  }

  private extractImprovements(text: string): string[] {
    const improvements: string[] = [];
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.includes('Improve') || line.includes('改进') || line.includes('建议')) {
        improvements.push(line.replace(/^[#\s]*/, '').trim());
      }
    }
    return improvements.length > 0 ? improvements : ['暂无改进建议'];
  }

  getPersona(): Persona {
    return this.persona;
  }

  updatePersona(updates: Partial<Persona>): void {
    this.persona = { ...this.persona, ...updates, updatedAt: new Date() };
  }
}

export interface AgentResponse {
  success: boolean;
  response: string;
  metadata?: {
    thoughtProcess: ThoughtProcess;
    executionTime: number;
    personaId: string;
    confidence: number;
    knowledgeSources: string[];
  };
  error?: string;
}

export interface ThoughtProcess {
  analysis: string;
  timestamp: Date;
}

export interface ExecutionResult {
  content: string;
  confidence: number;
  usedKnowledge: string[];
}

export interface ReflectionResult {
  insights: string[];
  improvements: string[];
  ready: boolean;
}

export function createPersonaAgent(persona: Persona): PersonaAgent {
  return new PersonaAgent(persona);
}

export async function generatePersonaFromMaterials(
  materials: Array<{ id: string; content: string; summary?: string; type: string }>,
  customName?: string
): Promise<Omit<Persona, 'id' | 'createdAt' | 'updatedAt'>> {
  const openai = getOpenAI();
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const contentSummary = materials.map(m => 
    `[${m.type}] ${m.summary || m.content.slice(0, 1000)}`
  ).join('\n\n---\n\n');

  const generationPrompt = `
请根据以下学习资料，创建一个独特的AI人格配置。

## 学习资料内容
${contentSummary}

请生成以下JSON格式的内容：
{
  "name": "2-6个字的中文名称",
  "description": "30-80字的人格描述",
  "systemPrompt": "200-400字的系统提示词，包含详细的人格设定、说话风格、知识背景",
  "rules": [
    {"name": "规则1名称", "description": "规则描述", "priority": 1, "action": "规则动作"}
  ]
}

重要提示：
1. name要是简洁的中文名
2. systemPrompt要体现学习资料中的知识特点
3. rules要体现资料中的核心理念
`;

  let parsed: any;
  
  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: '你是一个人格塑造专家，请根据学习资料生成独特的人格配置。JSON格式输出。' },
        { role: 'user', content: generationPrompt },
      ],
      temperature: 0.8,
      max_tokens: 2000,
    });

    const content = response.choices[0].message.content || '';
    console.log('AI生成的人格:', content.slice(0, 500));
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON found');
    }
  } catch (error) {
    console.error('Generate persona error:', error);
    parsed = {
      name: customName || 'AI伴侣',
      description: '基于学习资料创建的人格',
      systemPrompt: '你是一个温暖的AI情感助手，基于提供的学习资料来帮助用户。',
      rules: [
        { name: '基本规则', description: '默认规则', priority: 1, action: '保持友好和专业' },
      ],
    };
  }

  const knowledgeGraph: KnowledgeNode[] = materials.map((m, index) => ({
    id: `kg-${index}`,
    type: (index % 4 === 0 ? 'concept' : index % 4 === 1 ? 'strategy' : index % 4 === 2 ? 'example' : 'rule') as 'concept' | 'strategy' | 'example' | 'rule',
    content: m.summary || m.content.slice(0, 200),
    sourceMaterialId: m.id,
    weight: 1,
    createdAt: new Date(),
  }));

  return {
    name: parsed.name || customName || 'AI伴侣',
    description: parsed.description || '',
    style: 'custom',
    systemPrompt: parsed.systemPrompt || '',
    knowledgeGraph,
    rules: (parsed.rules || []).map((r: any, i: number) => ({
      id: `rule-${i}`,
      name: r.name || '',
      description: r.description || '',
      priority: r.priority || i + 1,
      action: r.action || '',
    })),
    stats: {
      totalConversations: 0,
      successfulInteractions: 0,
      failedInteractions: 0,
      feedbackScores: [],
      lastUpdated: new Date(),
    },
  };
}
