import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { AppState, AppAction, Settings, Message } from '../types';

const defaultSettings: Settings = {
  provider: 'auto',
  model: 'command-a-03-2025',
  apiKey: '',
  customEndpoint: '',
  personality: '',
  temperature: 0.7,
  maxTokens: 8192,
  theme: 'dark',
  opacity: 1,
  fontSize: 13,
  autostart: true,
  deepThink: false,
  language: 'ru',
  plugins: { webSearch: true, fetchPage: true },
};

const initialState: AppState = {
  activeScreen: 'chat',
  sessions: [],
  activeSessionId: null,
  messages: [],
  settings: defaultSettings,
  isLoading: false,
  webStatus: null,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_SCREEN':
      return { ...state, activeScreen: action.payload };
    case 'SET_MESSAGES':
      return { ...state, messages: action.payload };
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] };
    case 'UPDATE_MESSAGE':
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.payload.id ? { ...m, content: action.payload.content } : m
        ),
      };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_WEB_STATUS':
      return { ...state, webStatus: action.payload };
    case 'SET_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };
    case 'SET_SESSIONS':
      return { ...state, sessions: action.payload };
    case 'SET_ACTIVE_SESSION':
      return { ...state, activeSessionId: action.payload };
    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
