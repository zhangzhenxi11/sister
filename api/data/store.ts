import path from 'path';
import fs from 'fs';
import type { AnalysisFeedback, AnalysisResult } from '../services/analysis/types.js';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const materialsFile = path.join(dataDir, 'materials.json');
const personasFile = path.join(dataDir, 'personas.json');

export interface Material {
  id: string;
  title: string;
  description: string;
  type: string;
  filePath: string;
  status: string;
  summary?: string;
  content?: string;
  createdAt: Date;
}

let materialsCache: Material[] = [];

export function loadMaterials(): Material[] {
  try {
    console.log('loadMaterials called, file exists:', fs.existsSync(materialsFile));
    if (fs.existsSync(materialsFile)) {
      const data = JSON.parse(fs.readFileSync(materialsFile, 'utf-8'));
      console.log('Loaded materials from file:', data.length);
      materialsCache = data.map((m: any) => ({
        ...m,
        createdAt: new Date(m.createdAt),
      }));
    } else {
      console.log('No materials file found, starting fresh');
    }
  } catch (error) {
    console.error('Failed to load materials:', error);
  }
  console.log('loadMaterials returning:', materialsCache.length, 'materials');
  return materialsCache;
}

export function saveMaterials(materials: Material[]): void {
  try {
    console.log('saveMaterials called, materials count:', materials.length);
    console.log('Saving to:', materialsFile);
    console.log('Data dir exists:', fs.existsSync(dataDir));

    // 保留 filePath：删除资料时依赖该字段清理 uploads/ 下的实体文件
    fs.writeFileSync(materialsFile, JSON.stringify(materials, null, 2));
    materialsCache = materials;
    console.log('Materials saved successfully');
  } catch (error) {
    console.error('Failed to save materials:', error);
  }
}

export function getMaterials(): Material[] {
  return materialsCache;
}

export function addMaterial(material: Material): void {
  materialsCache.push(material);
  saveMaterials(materialsCache);
}

export interface Persona {
  id: string;
  name: string;
  description: string;
  style: string;
  systemPrompt: string;
  knowledgeGraph: any[];
  rules: any[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  stats: any;
  materialIds?: string[];
}

let personasCache: Persona[] = [];

export function loadPersonas(): Persona[] {
  try {
    if (fs.existsSync(personasFile)) {
      const data = JSON.parse(fs.readFileSync(personasFile, 'utf-8'));
      personasCache = data.map((p: any) => ({
        ...p,
        createdAt: new Date(p.createdAt),
        updatedAt: new Date(p.updatedAt),
      }));
    }
  } catch (error) {
    console.error('Failed to load personas:', error);
  }
  return personasCache;
}

export function savePersonas(personas: Persona[]): void {
  try {
    fs.writeFileSync(personasFile, JSON.stringify(personas, null, 2));
    personasCache = personas;
  } catch (error) {
    console.error('Failed to save personas:', error);
  }
}

export function getPersonas(): Persona[] {
  return personasCache;
}

export function getPersonaById(id: string): Persona | undefined {
  return personasCache.find(p => p.id === id);
}

export function addPersona(persona: Persona): void {
  personasCache.push(persona);
  savePersonas(personasCache);
}

export function updatePersona(id: string, updates: Partial<Persona>): void {
  const index = personasCache.findIndex(p => p.id === id);
  if (index !== -1) {
    personasCache[index] = { ...personasCache[index], ...updates };
    savePersonas(personasCache);
  }
}

export function deletePersona(id: string): void {
  personasCache = personasCache.filter(p => p.id !== id);
  savePersonas(personasCache);
}

/* ------------------------------------------------------------------ */
/* 分析结果（截图分析）持久化                                           */
/* ------------------------------------------------------------------ */

const analysesFile = path.join(dataDir, 'analyses.json');
let analysesCache: AnalysisResult[] | null = null;

function reviveAnalysis(a: any): AnalysisResult {
  return { ...a, createdAt: new Date(a.createdAt) };
}

export function getAnalyses(): AnalysisResult[] {
  if (analysesCache === null) {
    try {
      analysesCache = fs.existsSync(analysesFile)
        ? (JSON.parse(fs.readFileSync(analysesFile, 'utf-8')) as any[]).map(reviveAnalysis)
        : [];
    } catch (error) {
      console.error('Failed to load analyses:', error);
      analysesCache = [];
    }
  }
  return analysesCache;
}

export function addAnalysis(analysis: AnalysisResult): void {
  getAnalyses().unshift(analysis);
  try {
    fs.writeFileSync(analysesFile, JSON.stringify(analysesCache, null, 2));
  } catch (error) {
    console.error('Failed to save analysis:', error);
  }
}

export function getAnalysisById(id: string): AnalysisResult | undefined {
  return getAnalyses().find(a => a.id === id);
}

export function deleteAnalysis(id: string): void {
  analysesCache = getAnalyses().filter(a => a.id !== id);
  try {
    fs.writeFileSync(analysesFile, JSON.stringify(analysesCache, null, 2));
  } catch (error) {
    console.error('Failed to delete analysis:', error);
  }
}

/* ------------------------------------------------------------------ */
/* 分析反馈持久化（回流规则调权）                                       */
/* ------------------------------------------------------------------ */

const feedbackFile = path.join(dataDir, 'feedback.json');
let feedbackCache: AnalysisFeedback[] | null = null;

export function getFeedback(): AnalysisFeedback[] {
  if (feedbackCache === null) {
    try {
      feedbackCache = fs.existsSync(feedbackFile)
        ? (JSON.parse(fs.readFileSync(feedbackFile, 'utf-8')) as any[]).map((f: any) => ({
            ...f,
            createdAt: new Date(f.createdAt),
          }))
        : [];
    } catch (error) {
      console.error('Failed to load feedback:', error);
      feedbackCache = [];
    }
  }
  return feedbackCache;
}

export function addFeedback(feedback: AnalysisFeedback): void {
  getFeedback().unshift(feedback);
  try {
    fs.writeFileSync(feedbackFile, JSON.stringify(feedbackCache, null, 2));
  } catch (error) {
    console.error('Failed to save feedback:', error);
  }
}

/* ------------------------------------------------------------------ */
/* 会话持久化（重启不丢）                                               */
/* ------------------------------------------------------------------ */

export interface StoredMessage {
  role: string;
  content: string;
}

export interface StoredConversation {
  id: string;
  title: string;
  messages: StoredMessage[];
  personaId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const conversationsFile = path.join(dataDir, 'conversations.json');
let conversationsCache: StoredConversation[] | null = null;

export function getConversations(): StoredConversation[] {
  if (conversationsCache === null) {
    try {
      conversationsCache = fs.existsSync(conversationsFile)
        ? (JSON.parse(fs.readFileSync(conversationsFile, 'utf-8')) as any[]).map((c: any) => ({
            ...c,
            createdAt: new Date(c.createdAt),
            updatedAt: new Date(c.updatedAt),
          }))
        : [];
    } catch (error) {
      console.error('Failed to load conversations:', error);
      conversationsCache = [];
    }
  }
  return conversationsCache;
}

/** 将当前内存会话缓存写盘（chat 路由在变更后调用） */
export function persistConversations(): void {
  try {
    fs.writeFileSync(conversationsFile, JSON.stringify(conversationsCache, null, 2));
  } catch (error) {
    console.error('Failed to save conversations:', error);
  }
}

/* ------------------------------------------------------------------ */
/* 用户持久化（手机号账号）                                             */
/* ------------------------------------------------------------------ */

export interface User {
  id: string;
  phone: string;
  nickname: string;
  createdAt: Date;
  lastLoginAt: Date;
}

const usersFile = path.join(dataDir, 'users.json');
let usersCache: User[] | null = null;

export function getUsers(): User[] {
  if (usersCache === null) {
    try {
      usersCache = fs.existsSync(usersFile)
        ? (JSON.parse(fs.readFileSync(usersFile, 'utf-8')) as any[]).map((u: any) => ({
            ...u,
            createdAt: new Date(u.createdAt),
            lastLoginAt: new Date(u.lastLoginAt),
          }))
        : [];
    } catch (error) {
      console.error('Failed to load users:', error);
      usersCache = [];
    }
  }
  return usersCache;
}

function saveUsers(): void {
  try {
    fs.writeFileSync(usersFile, JSON.stringify(usersCache, null, 2));
  } catch (error) {
    console.error('Failed to save users:', error);
  }
}

export function findUserByPhone(phone: string): User | undefined {
  return getUsers().find(u => u.phone === phone);
}

export function findUserById(id: string): User | undefined {
  return getUsers().find(u => u.id === id);
}

export function addUser(user: User): void {
  getUsers().push(user);
  saveUsers();
}

export function touchUserLogin(id: string): void {
  const user = findUserById(id);
  if (user) {
    user.lastLoginAt = new Date();
    saveUsers();
  }
}
