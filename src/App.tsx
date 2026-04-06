// file: src/App.tsx
// Main application component for PCB AI Validator console

import { useState, useEffect } from 'react'; // useState, useEffect

export default function App() {
  const [logs, setLogs] = useState('Ожидание запуска...\n');
  const [status, setStatus] = useState('Готов к запуску');
  const [isRunning, setIsRunning] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).map(file => file.name);
      setSelectedFiles(files);
    }
  };

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
        <div className="relative">
          <input 
            type="file" 
            multiple 
            id="file-upload" 
            className="hidden" 
            onChange={handleFileChange}
          />
          <label 
            htmlFor="file-upload"
            className="px-5 py-2 rounded font-bold text-lg bg-gray-700 text-white cursor-pointer hover:bg-gray-600 transition-colors"
          >
            Загрузить файлы
          </label>
        </div>
        <span className={`font-bold ${status === 'Завершено' ? 'text-green-500' : 'text-yellow-400'}`}>
          {status}
        </span>
      </div>
      {selectedFiles.length > 0 && (
        <div className="mb-5 p-3 bg-[#2a2a2a] border border-gray-700 rounded">
          <h2 className="text-sm text-gray-400 mb-2 uppercase tracking-wider">Выбранные файлы:</h2>
          <div className="flex flex-wrap gap-2">
            {selectedFiles.map((name, i) => (
              <span key={i} className="bg-blue-900/30 text-blue-400 px-2 py-1 rounded text-sm border border-blue-800/50">
                {name}
              </span>
            ))}
          </div>
        </div>
      )}
      <pre className="bg-black p-4 border border-gray-800 overflow-auto max-h-[75vh] whitespace-pre-wrap">
        {logs}
      </pre>
    </div>
  );
}
