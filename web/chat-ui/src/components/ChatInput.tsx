import { useState, useRef, useCallback } from 'react';
import { Send, Image, Video, X, StopCircle } from 'lucide-react';
import { useChatStore } from '../store/chatStore';
import { streamChatCompletion } from '../utils/api';
import { processImageFile, processVideoFile, isImageFile, isVideoFile } from '../utils/fileUtils';
import type { ImageAttachment, VideoAttachment } from '../types';

export function ChatInput() {
  const [input, setInput] = useState('');
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [videos, setVideos] = useState<VideoAttachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    addMessage,
    appendToMessage,
    setMessageStreaming,
    setLoading,
    setError,
    setAbortController,
    abortRequest,
    isLoading,
    selectedModel,
    apiKey,
    getMessagesForApi,
    addGeneratedImage,
  } = useChatStore();

  const handleImageUpload = useCallback(async (files: FileList | File[]) => {
    setUploadError(null);
    const fileArray = Array.from(files);

    for (const file of fileArray) {
      try {
        if (isImageFile(file)) {
          const img = await processImageFile(file);
          setImages((prev) => [...prev, img]);
        } else if (isVideoFile(file)) {
          const vid = await processVideoFile(file);
          setVideos((prev) => [...prev, vid]);
        } else {
          setUploadError(`Định dạng không hỗ trợ: ${file.name}`);
        }
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Upload thất bại');
      }
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      handleImageUpload(e.dataTransfer.files);
    },
    [handleImageUpload]
  );

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      const files: File[] = [];

      for (const item of items) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }

      if (files.length > 0) {
        e.preventDefault();
        handleImageUpload(files);
      }
    },
    [handleImageUpload]
  );

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const removeVideo = (id: string) => {
    setVideos((prev) => prev.filter((vid) => vid.id !== id));
  };

  const sendMessage = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput && images.length === 0 && videos.length === 0) return;
    if (isLoading) return;

    // Add user message
    addMessage({
      role: 'user',
      content: trimmedInput,
      images: images.length > 0 ? images : undefined,
      videos: videos.length > 0 ? videos : undefined,
    });

    // Clear input
    setInput('');
    setImages([]);
    setVideos([]);
    setUploadError(null);
    setError(null);

    // Create assistant message placeholder
    const assistantMsgId = addMessage({
      role: 'assistant',
      content: '',
      isStreaming: true,
    });

    // Setup abort controller
    const controller = new AbortController();
    setAbortController(controller);
    setLoading(true);

    try {
      // Get messages for API (respects context settings)
      const messagesToSend = getMessagesForApi(assistantMsgId);

      // Stream response
      for await (const chunk of streamChatCompletion(
        selectedModel,
        messagesToSend,
        controller.signal,
        apiKey
      )) {
        if (chunk.type === 'text' && chunk.content) {
          appendToMessage(assistantMsgId, chunk.content);
        } else if (chunk.type === 'image' && chunk.image) {
          addGeneratedImage(assistantMsgId, chunk.image);
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
        appendToMessage(assistantMsgId, `\n\n❌ Lỗi: ${err.message}`);
      }
    } finally {
      setMessageStreaming(assistantMsgId, false);
      setLoading(false);
      setAbortController(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div
      className={`bg-dark-800 border-t border-dark-700 p-4 ${
        isDragOver ? 'ring-2 ring-primary-500 ring-inset' : ''
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Upload error */}
      {uploadError && (
        <div className="mb-2 px-3 py-2 bg-red-500/20 text-red-400 text-sm rounded-lg flex items-center justify-between">
          <span>{uploadError}</span>
          <button onClick={() => setUploadError(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Attachments preview */}
      {(images.length > 0 || videos.length > 0) && (
        <div className="flex flex-wrap gap-2 mb-3">
          {images.map((img) => (
            <div key={img.id} className="relative group">
              <img
                src={img.preview}
                alt={img.name}
                className="w-16 h-16 object-cover rounded-lg border border-dark-600"
              />
              <button
                onClick={() => removeImage(img.id)}
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          ))}
          {videos.map((vid) => (
            <div key={vid.id} className="relative group">
              <img
                src={vid.preview}
                alt={vid.name}
                className="w-16 h-16 object-cover rounded-lg border border-dark-600"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-6 h-6 rounded-full bg-black/50 flex items-center justify-center">
                  <div className="w-0 h-0 border-l-[6px] border-l-white border-y-[4px] border-y-transparent ml-0.5" />
                </div>
              </div>
              <button
                onClick={() => removeVideo(vid.id)}
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2">
        {/* Attachment buttons */}
        <div className="flex gap-1">
          <button
            onClick={() => imageInputRef.current?.click()}
            disabled={isLoading}
            className="p-2.5 rounded-lg bg-dark-700 hover:bg-dark-600 text-dark-400 hover:text-dark-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Thêm hình ảnh"
          >
            <Image className="w-5 h-5" />
          </button>
          <button
            onClick={() => videoInputRef.current?.click()}
            disabled={isLoading}
            className="p-2.5 rounded-lg bg-dark-700 hover:bg-dark-600 text-dark-400 hover:text-dark-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Thêm video"
          >
            <Video className="w-5 h-5" />
          </button>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleImageUpload(e.target.files)}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => e.target.files && handleImageUpload(e.target.files)}
        />

        {/* Text input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Nhập tin nhắn hoặc kéo thả file..."
            disabled={isLoading}
            rows={1}
            className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-dark-100 placeholder-dark-500 resize-none focus:outline-none focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ minHeight: '48px', maxHeight: '150px' }}
          />
        </div>

        {/* Send/Stop button */}
        {isLoading ? (
          <button
            onClick={abortRequest}
            className="p-3 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors"
            title="Dừng"
          >
            <StopCircle className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={sendMessage}
            disabled={!input.trim() && images.length === 0 && videos.length === 0}
            className="p-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Gửi"
          >
            <Send className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 bg-primary-500/10 border-2 border-dashed border-primary-500 rounded-lg flex items-center justify-center pointer-events-none">
          <span className="text-primary-400 font-medium">Thả file vào đây</span>
        </div>
      )}
    </div>
  );
}
