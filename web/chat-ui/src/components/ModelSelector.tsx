import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';
import { useChatStore } from '../store/chatStore';

export function ModelSelector() {
  const { selectedModel, setSelectedModel, models, isLoading } = useChatStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentModel = models.find((m) => m.id === selectedModel);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-700 hover:bg-dark-600 border border-dark-600 text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Sparkles className="w-4 h-4 text-primary-400" />
        <span className="text-dark-200 max-w-[120px] sm:max-w-none truncate">
          {currentModel?.name || 'Chọn model'}
        </span>
        <ChevronDown className={`w-4 h-4 text-dark-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-dark-800 border border-dark-600 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="p-2 border-b border-dark-700">
            <span className="text-xs text-dark-400 font-medium">Gemini Models</span>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {models.map((model) => (
              <button
                key={model.id}
                onClick={() => {
                  setSelectedModel(model.id);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2.5 text-left hover:bg-dark-700 transition-colors flex flex-col gap-0.5 ${
                  selectedModel === model.id ? 'bg-dark-700' : ''
                }`}
              >
                <span className="text-sm text-dark-100">{model.name}</span>
                <div className="flex items-center gap-2 text-xs text-dark-400">
                  {model.supportsVision && (
                    <span className="px-1.5 py-0.5 bg-primary-500/20 text-primary-400 rounded">Vision</span>
                  )}
                  {model.supportsVideo && (
                    <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">Video</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
