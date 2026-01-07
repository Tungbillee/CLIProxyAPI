import { Header, MessageList, ChatInput, ErrorBanner } from './components';

function App() {
  return (
    <div className="min-h-screen flex flex-col bg-dark-900">
      <Header />
      <ErrorBanner />
      <MessageList />
      <ChatInput />
    </div>
  );
}

export default App;
