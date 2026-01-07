import type { Message, OpenAIMessage, OpenAIContentPart, ChatCompletionChunk, GeneratedImage } from '../types';

export interface StreamChunk {
  type: 'text' | 'image';
  content?: string;
  image?: GeneratedImage;
}

const API_BASE = '/v1';

export function convertToOpenAIMessages(messages: Message[]): OpenAIMessage[] {
  return messages.map((msg) => {
    // If no images/videos, return simple text message
    if (!msg.images?.length && !msg.videos?.length) {
      return {
        role: msg.role,
        content: msg.content,
      };
    }

    // Build multimodal content array
    const content: OpenAIContentPart[] = [];

    // Add images first
    if (msg.images?.length) {
      for (const img of msg.images) {
        content.push({
          type: 'image_url',
          image_url: {
            url: `data:${img.mimeType};base64,${img.data}`,
            detail: 'auto',
          },
        });
      }
    }

    // Add videos (as image_url with video MIME type - Gemini will handle)
    if (msg.videos?.length) {
      for (const video of msg.videos) {
        content.push({
          type: 'image_url',
          image_url: {
            url: `data:${video.mimeType};base64,${video.data}`,
          },
        });
      }
    }

    // Add text content
    if (msg.content) {
      content.push({
        type: 'text',
        text: msg.content,
      });
    }

    return {
      role: msg.role,
      content,
    };
  });
}

export async function* streamChatCompletion(
  model: string,
  messages: Message[],
  signal: AbortSignal,
  apiKey: string
): AsyncGenerator<StreamChunk, void, unknown> {
  const openAIMessages = convertToOpenAIMessages(messages);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: openAIMessages,
      stream: true,
      max_tokens: 8192,
    }),
    signal,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6);
        if (data === '[DONE]') return;

        try {
          const chunk: ChatCompletionChunk = JSON.parse(data);
          const delta = chunk.choices[0]?.delta;

          // Handle text content
          if (delta?.content) {
            yield { type: 'text', content: delta.content };
          }

          // Handle generated images
          if (delta?.images?.length) {
            for (const img of delta.images) {
              yield {
                type: 'image',
                image: {
                  url: img.image_url.url,
                  index: img.index,
                },
              };
            }
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function fetchModels(): Promise<{ id: string; name: string }[]> {
  try {
    const response = await fetch(`${API_BASE}/models`);
    if (!response.ok) return [];

    const data = await response.json();
    return data.data || [];
  } catch {
    return [];
  }
}
