// file: src/App.tsx
// Main application component for PCB AI Validator console

import { useState, useEffect, useRef } from 'react'; // useState, useEffect, useRef

export default function App() {
  const [logs, setLogs] = useState('Ожидание запуска...\n');
  const [status, setStatus] = useState('Готов к запуску');
  const [isRunning, setIsRunning] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [targetComponent, setTargetComponent] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(window.innerWidth <= 768);
  const scrollRef = useRef<HTMLPreElement>(null);
  const isAtBottom = useRef(true);

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) { return; }
    const formData = new FormData();
    files.forEach(file => { formData.append('files', file); });
    try {
      setStatus('Загрузка файлов...');
      const response = await fetch('/upload', { method: 'POST', body: formData });
      if (response.ok) {
        setStatus('Файлы загружены');
        setTimeout(() => { setStatus('Готов к запуску'); }, 2000);
      } else {
        setStatus('Ошибка загрузки');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setStatus('Ошибка сети');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles(prev => {
        const existingNames = new Set(prev.map(f => f.name));
        const uniqueNew = newFiles.filter(f => !existingNames.has(f.name));
        return [...prev, ...uniqueNew];
      });
      uploadFiles(newFiles);
    }
  };

  const removeFile = (name: string) => {
    setSelectedFiles(prev => prev.filter(f => f.name !== name));
  };

  const runPipeline = async () => {
    setIsRunning(true);
    setStatus('Выполняется...');
    const url = targetComponent ? `/run?target=${encodeURIComponent(targetComponent)}` : '/run';
    await fetch(url);
  };

  useEffect(() => {
    if (!isRunning) { return; }
    const interval = setInterval(async () => {
      try {
        const r = await fetch('/logs');
        if (r.headers.get('content-type')?.includes('text/html')) { return; }
        const fullText = await r.text();
        
        if (scrollRef.current) {
          const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
          isAtBottom.current = scrollHeight - scrollTop <= clientHeight + 100;
        }

        // Truncate logs for rendering performance (keep last 100k chars)
        const displayLogs = fullText.length > 100000 
          ? "... [логи обрезаны для производительности, полный лог в tmp/logs] ...\n" + fullText.slice(-100000) 
          : fullText;

        setLogs(displayLogs);

        if (fullText.includes('PROCESSING COMPLETED')) {
          clearInterval(interval);
          setStatus('Завершено');
          setIsRunning(false);
        }
      } catch (err) {
        console.error('Log fetch error:', err);
      }
    }, 1000);
    return () => { clearInterval(interval); };
  }, [isRunning]);

  useEffect(() => {
    if (isAtBottom.current && scrollRef.current) {
      const el = scrollRef.current;
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }, [logs]);

  const toggleSidebar = () => { setSidebarCollapsed(!sidebarCollapsed); };

  return (
    <div className="bg-[#1a1a1a] text-[#00ff00] font-mono h-screen flex overflow-hidden">
      <aside className={`bg-[#111] border-r border-[#333] transition-all duration-300 flex-shrink-0 relative flex flex-col z-50 h-full ${sidebarCollapsed ? 'w-0 md:w-0 overflow-hidden' : 'w-64'}`}>
        <div className="p-4 flex justify-between items-center border-b border-[#333]">
          <span className="text-[#2563eb] font-bold text-lg">Меню</span>
          <button onClick={toggleSidebar} className="p-2 hover:bg-[#222] rounded-md text-gray-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <input type="file" multiple accept=".pdf,.pcbdoc" id="file-upload" className="hidden" onChange={handleFileChange} />
          <label htmlFor="file-upload" className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            Выбрать файлы
          </label>
          
          <div className="space-y-2">
            <h3 className="text-[10px] uppercase tracking-widest text-gray-500 font-bold px-1">Целевой компонент</h3>
            <input 
              type="text" 
              placeholder="Напр: STM32F103" 
              value={targetComponent}
              onChange={(e) => setTargetComponent(e.target.value)}
              className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#333] rounded text-xs text-white focus:border-[#2563eb] outline-none transition-colors"
            />
          </div>

          <div className="space-y-2">
            <h3 className="text-[10px] uppercase tracking-widest text-gray-500 font-bold px-1">Загруженные файлы</h3>
            {selectedFiles.length === 0 ? (
              <div className="p-3 border border-dashed border-[#333] rounded text-gray-500 text-[10px] italic text-center">
                Файлы не выбраны
              </div>
            ) : (
              <div className="space-y-1">
                {selectedFiles.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-[#1a1a1a] border border-[#333] rounded text-[10px] text-gray-300 group">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${file.name.toLowerCase().endsWith('.pdf') ? 'bg-red-500' : 'bg-blue-500'}`}></span>
                    <span className="truncate flex-1" title={file.name}>{file.name}</span>
                    <button onClick={() => removeFile(file.name)} className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="p-4 border-t border-[#333] text-[10px] text-gray-600 text-center">PCB AI Validator v1.0</div>
      </aside>
      <main className="flex-1 flex flex-col relative overflow-hidden h-full">
        {sidebarCollapsed && (
          <button onClick={toggleSidebar} className="absolute top-4 left-4 z-40 p-2 bg-[#111] border border-[#333] rounded-md text-gray-400 hover:text-white transition-colors shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        )}
        <div className="p-4 md:p-8 flex-1 flex flex-col overflow-hidden">
          <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col overflow-hidden">
            <header className="mb-6 flex-shrink-0">
              <h1 className="text-4xl font-bold text-[#2563eb] mb-2">PCB AI Validator</h1>
              <p className="text-gray-500">Интеллектуальный помощник для отладки PCB проектов</p>
            </header>
            <div className="bg-[#111] border border-[#333] rounded-xl p-6 mb-8 shadow-xl flex-shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-wider text-gray-500 font-bold">Управление</span>
                <button onClick={runPipeline} disabled={isRunning} className="px-8 py-4 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-lg font-bold text-lg transition-all shadow-lg shadow-blue-900/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                  Запустить пайплайн
                </button>
              </div>
              <div className="flex flex-col gap-1 md:text-right">
                <span className="text-xs uppercase tracking-wider text-gray-500 font-bold">Текущий статус</span>
                <div className="flex items-center md:justify-end gap-3">
                  <div className={`w-3 h-3 rounded-full ${status === 'Выполняется...' ? 'bg-[#fbbf24] animate-pulse' : status === 'Завершено' ? 'bg-[#10b981]' : 'bg-[#fbbf24]'}`}></div>
                  <span className={`font-bold text-xl tracking-tight ${status === 'Завершено' ? 'text-[#10b981]' : 'text-[#fbbf24]'}`}>{status}</span>
                </div>
              </div>
            </div>
            <div className="relative group flex-1 flex flex-col min-h-0">
              <div className="absolute -top-3 left-4 px-2 bg-[#1a1a1a] text-[10px] font-bold text-gray-500 tracking-widest uppercase z-10">Консоль вывода</div>
              <pre ref={scrollRef} className="bg-black p-6 border border-[#333] rounded-xl overflow-auto flex-1 whitespace-pre-wrap text-sm leading-relaxed shadow-inner font-mono text-green-400/90 scrollbar-thin scrollbar-thumb-[#333] scrollbar-track-black">{logs}</pre>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
