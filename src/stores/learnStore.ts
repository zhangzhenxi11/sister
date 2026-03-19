import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface LearningMaterial {
  id: string;
  title: string;
  description: string;
  type: 'video' | 'audio' | 'image' | 'text';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  summary?: string;
  createdAt: Date;
}

export interface Persona {
  id: string;
  name: string;
  description: string;
  style: string;
  isActive: boolean;
  materialIds: string[];
}

interface LearnState {
  materials: LearningMaterial[];
  personas: Persona[];
  activePersonaId: string | null;
  
  addMaterial: (material: LearningMaterial) => void;
  updateMaterial: (id: string, updates: Partial<LearningMaterial>) => void;
  removeMaterial: (id: string) => void;
  
  addPersona: (persona: Persona) => void;
  updatePersona: (id: string, updates: Partial<Persona>) => void;
  removePersona: (id: string) => void;
  setActivePersona: (id: string | null) => void;
}

export const useLearnStore = create<LearnState>()(
  persist(
    (set) => ({
      materials: [],
      personas: [],
      activePersonaId: null,

      addMaterial: (material) =>
        set((state) => ({
          materials: [...state.materials, material],
        })),

      updateMaterial: (id, updates) =>
        set((state) => ({
          materials: state.materials.map((m) =>
            m.id === id ? { ...m, ...updates } : m
          ),
        })),

      removeMaterial: (id) =>
        set((state) => ({
          materials: state.materials.filter((m) => m.id !== id),
        })),

      addPersona: (persona) =>
        set((state) => ({
          personas: [...state.personas, persona],
        })),

      updatePersona: (id, updates) =>
        set((state) => ({
          personas: state.personas.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        })),

      removePersona: (id) =>
        set((state) => ({
          personas: state.personas.filter((p) => p.id !== id),
          activePersonaId: state.activePersonaId === id ? null : state.activePersonaId,
        })),

      setActivePersona: (id) =>
        set((state) => ({
          personas: state.personas.map((p) => ({
            ...p,
            isActive: p.id === id,
          })),
          activePersonaId: id,
        })),
    }),
    {
      name: 'emotion-ai-learn',
    }
  )
);
