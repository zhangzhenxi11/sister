import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserPreference {
  relationshipStatus: string;
  interests: string[];
  aiStyle: 'gentle' | 'rational' | 'humorous';
}

interface SettingsState {
  apiKey: string;
  preferences: UserPreference;
  theme: 'light' | 'dark';
  
  setApiKey: (key: string) => void;
  setPreferences: (prefs: Partial<UserPreference>) => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiKey: '',
      preferences: {
        relationshipStatus: 'single',
        interests: [],
        aiStyle: 'gentle',
      },
      theme: 'light',

      setApiKey: (key) => set({ apiKey: key }),
      
      setPreferences: (prefs) =>
        set((state) => ({
          preferences: { ...state.preferences, ...prefs },
        })),
      
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'emotion-ai-settings',
    }
  )
);
