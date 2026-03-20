import path from 'path';
import fs from 'fs';

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
    
    const data = materials.map(m => ({
      ...m,
      filePath: undefined,
    }));
    fs.writeFileSync(materialsFile, JSON.stringify(data, null, 2));
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
