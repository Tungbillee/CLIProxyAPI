import { useState } from 'react';
import { Key, Eye, EyeOff, Check } from 'lucide-react';
import { useChatStore } from '../store/chatStore';

export function ApiKeyInput() {
  const { apiKey, setApiKey } = useChatStore();
  const [showKey, setShowKey] = useState(false);
  const [tempKey, setTempKey] = useState(apiKey);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setApiKey(tempKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
        <input
          type={showKey ? 'text' : 'password'}
          value={tempKey}
          onChange={(e) => setTempKey(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          placeholder="API Key (để trống nếu không cần)"
          className="w-full pl-9 pr-10 py-2 bg-dark-700 border border-dark-600 rounded-lg text-sm text-dark-200 placeholder-dark-500 focus:outline-none focus:border-primary-500"
        />
        <button
          onClick={() => setShowKey(!showKey)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-dark-300"
        >
          {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {saved && (
        <div className="flex items-center gap-1 text-green-400 text-sm">
          <Check className="w-4 h-4" />
          <span>Đã lưu</span>
        </div>
      )}
    </div>
  );
}
