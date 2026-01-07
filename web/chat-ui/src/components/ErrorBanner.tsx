import { AlertTriangle, X } from 'lucide-react';
import { useChatStore } from '../store/chatStore';

export function ErrorBanner() {
  const { error, setError } = useChatStore();

  if (!error) return null;

  return (
    <div className="mx-4 mt-4 px-4 py-3 bg-red-500/20 border border-red-500/30 rounded-lg flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
      <button
        onClick={() => setError(null)}
        className="text-red-400 hover:text-red-300 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}
