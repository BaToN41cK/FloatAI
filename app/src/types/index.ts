export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

export interface Session {
  id: string;
  title: string;
  history: Message[];
  createdAt: number;
}

export interface Settings {
  provider: string;
  model: string;
  apiKey: string;
  customEndpoint: string;
  personality: string;
  temperature: number;
  maxTokens: number;
  theme: 'dark' | 'light';
  opacity: number;
  fontSize: number;
  autostart: boolean;
  deepThink: boolean;
  language: string;
  plugins: {
    webSearch: boolean;
    fetchPage: boolean;
  };
}

export interface AppState {
  activeScreen: 'chat' | 'settings' | 'history';
  sessions: Session[];
  activeSessionId: string | null;
  messages: Message[];
  settings: Settings;
  isLoading: boolean;
  webStatus: string | null;
}

export type AppAction =
  | { type: 'SET_SCREEN'; payload: AppState['activeScreen'] }
  | { type: 'SET_MESSAGES'; payload: Message[] }
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'UPDATE_MESSAGE'; payload: { id: string; content: string } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_WEB_STATUS'; payload: string | null }
  | { type: 'SET_SETTINGS'; payload: Partial<Settings> }
  | { type: 'SET_SESSIONS'; payload: Session[] }
  | { type: 'SET_ACTIVE_SESSION'; payload: string | null };
