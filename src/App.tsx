// file: src/App.tsx
// Main application component for PCB AI Validator console

import { useState, useEffect } from 'react'; // useState, useEffect

export default function App() {
  const [logs, setLogs] = useState('Ожидание запуска...\n');
  const [status, setStatus] = useState('Готов к запуску');
  const [isRunning, setIsRunning] = useState(false);

  const runPipeline = async () => {
    setIsRunning(true);
    setStatus('Выполняется...');
    await fetch('/run');
  };

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(async () => {
      const r = await fetch('/logs');
      const text = await r.text();
      setLogs(text);
      if (text.includes('PROCESSING COMPLETED')) {
        clearInterval(interval);
        setStatus('Завершено');
        setIsRunning(false);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-[#00ff00] p-5 font-mono">
      <h1 className="text-3xl text-blue-600 mb-5">PCB AI Validator - Console</h1>
      <div className="flex items-center gap-4 mb-5">
        <button 
          onClick={runPipeline}
          disabled={isRunning}
          className={`px-5 py-2 rounded font-bold text-lg bg-blue-600 text-white ${isRunning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          Запустить пайплайн
        </button>
        <span className={`font-bold ${status === 'Завершено' ? 'text-green-500' : 'text-yellow-400'}`}>
          {status}
        </span>
      </div>
      <pre className="bg-black p-4 border border-gray-800 overflow-auto max-h-[75vh] whitespace-pre-wrap">
        {logs}
      </pre>
    </div>
  );
}
