import { create } from 'zustand';
import type { Message, Model, GeneratedImage } from '../types';

const GEMINI_MODELS: Model[] = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google', supportsVision: true, supportsVideo: true },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', provider: 'google', supportsVision: true, supportsVideo: true },
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro Preview', provider: 'google', supportsVision: true, supportsVideo: true },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview', provider: 'google', supportsVision: true, supportsVideo: true },
  { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro Image', provider: 'google', supportsVision: true, supportsVideo: false },
  { id: 'gemini-2.5-computer-use-preview-10-2025', name: 'Gemini 2.5 Computer Use', provider: 'google', supportsVision: true, supportsVideo: true },
];

interface ChatStore {
  messages: Message[];
  isLoading: boolean;
  selectedModel: string;
  models: Model[];
  error: string | null;
  abortController: AbortController | null;
  apiKey: string;
  sendContext: boolean; // Gửi lịch sử chat hay chỉ tin nhắn mới
  maxContextMessages: number; // Giới hạn số tin nhắn context

  // Actions
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => string;
  updateMessage: (id: string, content: string) => void;
  appendToMessage: (id: string, chunk: string) => void;
  setMessageStreaming: (id: string, isStreaming: boolean) => void;
  clearMessages: () => void;
  setLoading: (loading: boolean) => void;
  setSelectedModel: (model: string) => void;
  setError: (error: string | null) => void;
  setAbortController: (controller: AbortController | null) => void;
  abortRequest: () => void;
  setApiKey: (key: string) => void;
  setSendContext: (send: boolean) => void;
  getMessagesForApi: (excludeId?: string) => Message[];
  addGeneratedImage: (id: string, image: GeneratedImage) => void;
}

const generateId = () => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

const STORAGE_KEY = 'gemini-chat-api-key';
const CONTEXT_KEY = 'gemini-chat-send-context';

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  isLoading: false,
  selectedModel: GEMINI_MODELS[0].id,
  models: GEMINI_MODELS,
  error: null,
  abortController: null,
  apiKey: localStorage.getItem(STORAGE_KEY) || '',
  sendContext: localStorage.getItem(CONTEXT_KEY) !== 'false', // default true
  maxContextMessages: 10, // Giới hạn 10 tin nhắn

  addMessage: (message) => {
    const id = generateId();
    const newMessage: Message = {
      ...message,
      id,
      timestamp: Date.now(),
    };
    set((state) => ({
      messages: [...state.messages, newMessage],
    }));
    return id;
  },

  updateMessage: (id, content) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, content } : msg
      ),
    }));
  },

  appendToMessage: (id, chunk) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, content: msg.content + chunk } : msg
      ),
    }));
  },

  setMessageStreaming: (id, isStreaming) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, isStreaming } : msg
      ),
    }));
  },

  clearMessages: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
    }
    set({ messages: [], error: null, abortController: null });
  },

  setLoading: (loading) => set({ isLoading: loading }),

  setSelectedModel: (model) => set({ selectedModel: model }),

  setError: (error) => set({ error }),

  setAbortController: (controller) => set({ abortController: controller }),

  abortRequest: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
      set({ abortController: null, isLoading: false });
    }
  },

  setApiKey: (key) => {
    localStorage.setItem(STORAGE_KEY, key);
    set({ apiKey: key });
  },

  setSendContext: (send) => {
    localStorage.setItem(CONTEXT_KEY, String(send));
    set({ sendContext: send });
  },

  getMessagesForApi: (excludeId) => {
    const { messages, sendContext, maxContextMessages } = get();

    // Lọc bỏ message đang streaming (assistant placeholder)
    let filtered = messages.filter((m) => m.id !== excludeId);

    if (!sendContext) {
      // Chỉ gửi tin nhắn user cuối cùng
      const lastUserMsg = [...filtered].reverse().find((m) => m.role === 'user');
      return lastUserMsg ? [lastUserMsg] : [];
    }

    // Giới hạn số tin nhắn và loại bỏ media từ tin nhắn cũ để giảm size
    if (filtered.length > maxContextMessages) {
      filtered = filtered.slice(-maxContextMessages);
    }

    // Loại bỏ media từ tin nhắn cũ (chỉ giữ media ở tin nhắn cuối)
    return filtered.map((msg, idx) => {
      if (idx < filtered.length - 1) {
        // Tin nhắn cũ: loại bỏ media để giảm payload
        return { ...msg, images: undefined, videos: undefined };
      }
      return msg;
    });
  },

  addGeneratedImage: (id, image) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id
          ? {
              ...msg,
              generatedImages: [...(msg.generatedImages || []), image],
            }
          : msg
      ),
    }));
  },
}));
