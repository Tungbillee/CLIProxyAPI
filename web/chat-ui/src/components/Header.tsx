import { useState } from 'react';
import { MessageSquare, Trash2, Settings, X, LayoutDashboard, History } from 'lucide-react';
import { useChatStore } from '../store/chatStore';
import { ModelSelector } from './ModelSelector';
import { ApiKeyInput } from './ApiKeyInput';

export function Header() {
  const { clearMessages, messages, sendContext, setSendContext } = useChatStore();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <header className="bg-dark-800 border-b border-dark-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a
            href="/management.html"
            className="p-2 rounded-lg bg-dark-700 hover:bg-dark-600 text-dark-400 hover:text-primary-400 transition-colors"
            title="Management Panel"
          >
            <LayoutDashboard className="w-5 h-5" />
          </a>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-primary-500" />
            <h1 className="text-lg font-semibold text-dark-100">Gemini Chat</h1>
          </div>
          <span className="text-xs text-dark-400 hidden sm:inline">CLIProxyAPI</span>
        </div>

        <div className="flex items-center gap-2">
          <ModelSelector />

          {/* Toggle Context */}
          <button
            onClick={() => setSendContext(!sendContext)}
            className={`p-2 rounded-lg transition-colors ${
              sendContext
                ? 'bg-green-600 text-white'
                : 'bg-dark-700 text-dark-400 hover:bg-dark-600'
            }`}
            title={sendContext ? 'Context: BẬT (gửi lịch sử chat)' : 'Context: TẮT (chỉ gửi tin mới)'}
          >
            <History className="w-5 h-5" />
          </button>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition-colors ${
              showSettings
                ? 'bg-primary-600 text-white'
                : 'bg-dark-700 hover:bg-dark-600 text-dark-300 hover:text-dark-100'
            }`}
            title="Cài đặt API Key"
          >
            <Settings className="w-5 h-5" />
          </button>

          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="p-2 rounded-lg bg-dark-700 hover:bg-dark-600 text-dark-300 hover:text-red-400 transition-colors"
              title="Xóa cuộc trò chuyện"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-dark-800 border-b border-dark-700 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-dark-300 font-medium">API Key</span>
            <button
              onClick={() => setShowSettings(false)}
              className="text-dark-500 hover:text-dark-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <ApiKeyInput />
          <p className="text-xs text-dark-500 mt-2">
            API key được lưu trong localStorage. Để trống nếu server không yêu cầu xác thực.
          </p>
        </div>
      )}
    </>
  );
}
