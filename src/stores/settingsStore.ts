import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserPreference {
  relationshipStatus: string;
  interests: string[];
  aiStyle: 'gentle' | 'rational' | 'humorous';
}

interface SettingsState {
  apiKey: string;
  llmBaseUrl: string;
  llmModel: string;
  preferences: UserPreference;
  theme: 'light' | 'dark';

  setApiKey: (key: string) => void;
  setLlmConfig: (cfg: { apiKey: string; baseUrl: string; model: string }) => void;
  setPreferences: (prefs: Partial<UserPreference>) => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiKey: '',
      llmBaseUrl: '',
      llmModel: '',
      preferences: {
        relationshipStatus: 'single',
        interests: [],
        aiStyle: 'gentle',
      },
      theme: 'light',

      setApiKey: (key) => set({ apiKey: key }),

      setLlmConfig: (cfg) =>
        set({
          apiKey: cfg.apiKey.trim(),
          llmBaseUrl: cfg.baseUrl.trim(),
          llmModel: cfg.model.trim(),
        }),

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
