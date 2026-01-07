import { useEffect, useRef, useState } from 'react';
import { User, Bot, Download, X } from 'lucide-react';
import { useChatStore } from '../store/chatStore';
import type { Message } from '../types';

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const downloadImage = (url: string, index: number) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `generated-image-${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      {/* Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300"
            onClick={() => setLightboxImage(null)}
          >
            <X className="w-8 h-8" />
          </button>
          <img
            src={lightboxImage}
            alt="Generated"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center">
          <Bot className="w-5 h-5 text-primary-400" />
        </div>
      )}

      <div className={`max-w-[80%] ${isUser ? 'order-first' : ''}`}>
        {/* Image/Video attachments */}
        {(message.images?.length || message.videos?.length) && (
          <div className="flex flex-wrap gap-2 mb-2">
            {message.images?.map((img) => (
              <div key={img.id} className="relative">
                <img
                  src={img.preview}
                  alt={img.name}
                  className="max-w-[200px] max-h-[150px] rounded-lg object-cover border border-dark-600"
                />
              </div>
            ))}
            {message.videos?.map((vid) => (
              <div key={vid.id} className="relative">
                <img
                  src={vid.preview}
                  alt={vid.name}
                  className="max-w-[200px] max-h-[150px] rounded-lg object-cover border border-dark-600"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <div className="w-0 h-0 border-l-[12px] border-l-white border-y-[8px] border-y-transparent ml-1" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Message content */}
        <div
          className={`px-4 py-3 rounded-2xl ${
            isUser
              ? 'bg-primary-600 text-white rounded-br-md'
              : 'bg-dark-700 text-dark-100 rounded-bl-md'
          }`}
        >
          <div className="markdown-content whitespace-pre-wrap break-words">
            {message.content}
            {message.isStreaming && <span className="streaming-cursor" />}
          </div>
        </div>

        {/* Generated images from AI */}
        {message.generatedImages && message.generatedImages.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {message.generatedImages.map((img) => (
              <div key={img.index} className="relative group">
                <img
                  src={img.url}
                  alt={`Generated ${img.index + 1}`}
                  className="max-w-[300px] max-h-[300px] rounded-lg object-cover border border-dark-600 cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setLightboxImage(img.url)}
                />
                <button
                  onClick={() => downloadImage(img.url, img.index)}
                  className="absolute bottom-2 right-2 p-2 bg-black/60 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                  title="Tải xuống"
                >
                  <Download className="w-4 h-4 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <div className={`text-xs text-dark-500 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
          {new Date(message.timestamp).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>

      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-dark-600 flex items-center justify-center">
          <User className="w-5 h-5 text-dark-300" />
        </div>
      )}
    </div>
    </>
  );
}

export function MessageList() {
  const { messages } = useChatStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-500/20 flex items-center justify-center">
            <Bot className="w-8 h-8 text-primary-400" />
          </div>
          <h2 className="text-xl font-semibold text-dark-100 mb-2">Chào mừng đến Gemini Chat</h2>
          <p className="text-dark-400 text-sm">
            Gửi tin nhắn, hình ảnh hoặc video để bắt đầu cuộc trò chuyện với Gemini.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
