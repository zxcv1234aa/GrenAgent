import { ChatView } from './features/chat/ChatView';

export default function App() {
  return (
    <div className="h-screen flex flex-col">
      <header className="h-12 bg-gray-800 text-white flex items-center px-4">
        <h1 className="text-lg font-bold">Hermes</h1>
      </header>
      <main className="flex-1 overflow-hidden">
        <ChatView />
      </main>
    </div>
  );
}
