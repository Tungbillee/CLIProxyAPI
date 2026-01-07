export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  images?: ImageAttachment[];
  videos?: VideoAttachment[];
  generatedImages?: GeneratedImage[];
  timestamp: number;
  isStreaming?: boolean;
}

export interface GeneratedImage {
  url: string;
  index: number;
}

export interface ImageAttachment {
  id: string;
  data: string;
  mimeType: string;
  name: string;
  preview: string;
}

export interface VideoAttachment {
  id: string;
  data: string;
  mimeType: string;
  name: string;
  preview: string;
  duration?: number;
}

export interface Model {
  id: string;
  name: string;
  provider: string;
  supportsVision: boolean;
  supportsVideo: boolean;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  selectedModel: string;
  models: Model[];
  error: string | null;
  abortController: AbortController | null;
}

export interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | OpenAIContentPart[];
}

export interface OpenAIContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'low' | 'high' | 'auto';
  };
}

export interface ChatCompletionRequest {
  model: string;
  messages: OpenAIMessage[];
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
}

export interface ChatCompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    delta: {
      role?: string;
      content?: string;
      images?: {
        index: number;
        type: string;
        image_url: { url: string };
      }[];
    };
    finish_reason: string | null;
  }[];
}
