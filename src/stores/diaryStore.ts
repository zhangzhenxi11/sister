import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface DiaryEntry {
  id: string;
  mood: 'happy' | 'sad' | 'anxious' | 'excited' | 'calm' | 'confused';
  content: string;
  date: string;
  createdAt: Date;
}

interface DiaryState {
  diaries: DiaryEntry[];
  addDiary: (diary: DiaryEntry) => void;
  updateDiary: (id: string, diary: Partial<DiaryEntry>) => void;
  deleteDiary: (id: string) => void;
}

export const useDiaryStore = create<DiaryState>()(
  persist(
    (set) => ({
      diaries: [],

      addDiary: (diary) =>
        set((state) => ({
          diaries: [diary, ...state.diaries],
        })),

      updateDiary: (id, updates) =>
        set((state) => ({
          diaries: state.diaries.map((d) =>
            d.id === id ? { ...d, ...updates } : d
          ),
        })),

      deleteDiary: (id) =>
        set((state) => ({
          diaries: state.diaries.filter((d) => d.id !== id),
        })),
    }),
    {
      name: 'emotion-ai-diary',
    }
  )
);
