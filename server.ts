// file: server.ts
// Minimal Express server to keep the application running in the preview environment

import express from 'express'; // express
import { spawn } from 'child_process'; // spawn
import fs from 'fs'; // fs
import path from 'path'; // path
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;
const LOG_DIR = path.join(__dirname, 'tmp', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'last_run.log');
let logs = 'Ожидание запуска...\n';

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://cdn.tailwindcss.com"></script>
        <title>PCB AI Validator</title>
        <style>
            #sidebar {
                transition: transform 0.3s ease-in-out, width 0.3s ease-in-out, margin-left 0.3s ease-in-out;
            }
            @media (max-width: 768px) {
                #sidebar {
                    position: fixed;
                    height: 100vh;
                    left: 0;
                    top: 0;
                }
                #sidebar.collapsed {
                    transform: translateX(-100%);
                }
            }
            @media (min-width: 769px) {
                #sidebar.collapsed {
                    width: 0;
                    margin-left: -1px;
                    overflow: hidden;
                }
                #sidebar.collapsed + main #expandBtn {
                    display: flex;
                }
                #sidebar:not(.collapsed) + main #expandBtn {
                    display: none;
                }
            }
            #out::-webkit-scrollbar {
                width: 8px;
            }
            #out::-webkit-scrollbar-track {
                background: #000;
            }
            #out::-webkit-scrollbar-thumb {
                background: #333;
                border-radius: 4px;
            }
            #out::-webkit-scrollbar-thumb:hover {
                background: #444;
            }
        </style>
    </head>
    <body class="bg-[#1a1a1a] text-[#00ff00] font-mono min-h-screen flex overflow-hidden">
        <!-- Sidebar -->
        <aside id="sidebar" class="bg-[#111] border-r border-[#333] w-64 flex-shrink-0 relative flex flex-col z-50">
            <div class="p-4 flex justify-between items-center border-b border-[#333]">
                <span class="text-[#2563eb] font-bold text-lg">Меню</span>
                <button id="toggleBtn" class="p-2 hover:bg-[#222] rounded-md text-gray-400 hover:text-white transition-colors" title="Свернуть">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
            </div>
            <div class="flex-1 overflow-y-auto p-4">
                <div class="space-y-4">
                    <div class="p-3 border border-dashed border-[#333] rounded text-gray-500 text-sm italic text-center">
                        Панель пока пуста...
                    </div>
                </div>
            </div>
            <div class="p-4 border-t border-[#333] text-[10px] text-gray-600 text-center">
                PCB AI Validator v1.0
            </div>
        </aside>

        <!-- Main Content -->
        <main class="flex-1 flex flex-col relative overflow-hidden">
            <!-- Desktop Expand Button (Visible only when sidebar is collapsed) -->
            <button id="expandBtn" class="hidden md:flex absolute top-4 left-4 z-40 p-2 bg-[#111] border border-[#333] rounded-md text-gray-400 hover:text-white transition-colors shadow-lg" title="Развернуть">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>

            <!-- Mobile Header Toggle -->
            <div class="md:hidden p-4 border-b border-[#333] flex items-center bg-[#111]">
                <button id="mobileToggleBtn" class="p-2 hover:bg-[#222] rounded-md text-gray-400 hover:text-white transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                </button>
                <h1 class="ml-4 text-[#2563eb] font-bold">PCB AI Validator</h1>
            </div>

            <div class="p-4 md:p-8 flex-1 overflow-auto">
                <div class="max-w-5xl mx-auto">
                    <header class="mb-8">
                        <h1 class="hidden md:block text-4xl font-bold text-[#2563eb] mb-2">PCB AI Validator</h1>
                        <p class="text-gray-500 hidden md:block">Интеллектуальный помощник для отладки PCB проектов</p>
                    </header>
                    
                    <div class="bg-[#111] border border-[#333] rounded-xl p-6 mb-8 shadow-xl">
                        <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div class="flex flex-col gap-1">
                                <span class="text-xs uppercase tracking-wider text-gray-500 font-bold">Управление</span>
                                <button id="startBtn" onclick="run()" class="px-8 py-4 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-lg font-bold text-lg transition-all shadow-lg shadow-blue-900/20 active:scale-95 disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                                    Запустить пайплайн
                                </button>
                            </div>
                            
                            <div class="flex flex-col gap-1 md:text-right">
                                <span class="text-xs uppercase tracking-wider text-gray-500 font-bold">Текущий статус</span>
                                <div class="flex items-center md:justify-end gap-3">
                                    <div id="statusDot" class="w-3 h-3 rounded-full bg-[#fbbf24] animate-pulse"></div>
                                    <span id="status" class="text-[#fbbf24] font-bold text-xl tracking-tight">Готов к запуску</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="relative group">
                        <div class="absolute -top-3 left-4 px-2 bg-[#1a1a1a] text-[10px] font-bold text-gray-500 tracking-widest uppercase z-10">Консоль вывода</div>
                        <pre id="out" class="bg-black p-6 border border-[#333] rounded-xl overflow-auto max-h-[60vh] md:max-h-[65vh] white-space-pre-wrap text-sm leading-relaxed shadow-inner font-mono text-green-400/90">${logs}</pre>
                    </div>
                </div>
            </div>
        </main>

        <script>
            const sidebar = document.getElementById('sidebar');
            const toggleBtn = document.getElementById('toggleBtn');
            const expandBtn = document.getElementById('expandBtn');
            const mobileToggleBtn = document.getElementById('mobileToggleBtn');
            const statusDot = document.getElementById('statusDot');
            
            // Initial state: collapsed on mobile, open on desktop
            if (window.innerWidth <= 768) {
                sidebar.classList.add('collapsed');
            }

            function toggleSidebar() {
                sidebar.classList.toggle('collapsed');
            }

            toggleBtn.addEventListener('click', toggleSidebar);
            expandBtn.addEventListener('click', toggleSidebar);
            mobileToggleBtn.addEventListener('click', toggleSidebar);

            // Close sidebar when clicking outside on mobile
            document.addEventListener('click', (e) => {
                if (window.innerWidth <= 768 && 
                    !sidebar.contains(e.target) && 
                    !mobileToggleBtn.contains(e.target) && 
                    !sidebar.classList.contains('collapsed')) {
                    sidebar.classList.add('collapsed');
                }
            });

            async function run() {
                const status = document.getElementById('status');
                const startBtn = document.getElementById('startBtn');
                
                startBtn.disabled = true;
                status.innerText = 'Выполняется...';
                status.style.color = '#fbbf24';
                statusDot.classList.add('animate-pulse');
                statusDot.classList.replace('bg-[#10b981]', 'bg-[#fbbf24]');
                
                await fetch('/run');
                
                const interval = setInterval(async () => {
                    const r = await fetch('/logs');
                    const text = await r.text();
                    const out = document.getElementById('out');
                    out.innerText = text;
                    out.scrollTop = out.scrollHeight;
                    
                    if (text.includes('PROCESSING COMPLETED')) {
                        clearInterval(interval);
                        status.innerText = 'Завершено';
                        status.style.color = '#10b981';
                        statusDot.classList.remove('animate-pulse');
                        statusDot.classList.replace('bg-[#fbbf24]', 'bg-[#10b981]');
                        startBtn.disabled = false;
                    }
                }, 1000);
            }
        </script>
    </body>
    </html>
  `);
});

app.get('/run', async (req, res) => {
  logs = "--- Инициализация окружения ---\n";
  
  // Создаем папку для логов, если её нет
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
  
  fs.writeFileSync(LOG_FILE, logs);

  // 1. Детекция Python
  let pyPath = 'python3';
  try {
    require('child_process').execSync('python3 --version');
  } catch (e) {
    try {
      require('child_process').execSync('python --version');
      pyPath = 'python';
    } catch (e2) {
      const msg = "[ERROR] Python не найден в системе.\n";
      logs += msg;
      fs.appendFileSync(LOG_FILE, msg);
      res.send('Python not found');
      return;
    }
  }

  // 2. Проверка pip и его установка при необходимости
  let pipAvailable = false;
  try {
    require('child_process').execSync(`${pyPath} -m pip --version`);
    pipAvailable = true;
  } catch (e) {
    const msg = "pip не найден. Попытка установки через get-pip.py...\n";
    logs += msg;
    fs.appendFileSync(LOG_FILE, msg);
    try {
      // Загружаем get-pip.py
      const getPipUrl = "https://bootstrap.pypa.io/get-pip.py";
      const getPipFile = path.join(__dirname, "get-pip.py");
      require('child_process').execSync(`curl -sSL ${getPipUrl} -o ${getPipFile} || wget -q ${getPipUrl} -O ${getPipFile}`);
      require('child_process').execSync(`${pyPath} ${getPipFile} --user`);
      pipAvailable = true;
      logs += "pip успешно установлен.\n";
    } catch (e2) {
      logs += "[WARNING] Не удалось установить pip. Попытка продолжить без него...\n";
    }
  }

  logs += `Используется интерпретатор: ${pyPath}\n`;
  logs += "--- Установка зависимостей ---\n";
  fs.appendFileSync(LOG_FILE, `Используется интерпретатор: ${pyPath}\n--- Установка зависимостей ---\n`);

  // 3. Установка зависимостей
  const pipArgs = ['-m', 'pip', 'install', '--user', '-r', 'requirements.txt'];
  const pip = spawn(pyPath, pipArgs);
  
  pip.stdout.on('data', (d) => {
    logs += d.toString();
    fs.appendFileSync(LOG_FILE, d.toString());
  });

  pip.stderr.on('data', (d) => {
    logs += d.toString();
    fs.appendFileSync(LOG_FILE, d.toString());
  });

  pip.on('close', (code) => {
    if (code !== 0) {
      logs += `\n[WARNING] Ошибка при установке зависимостей (Код: ${code}). Попытка запуска пайплайна...\n`;
    } else {
      logs += "\nЗависимости успешно проверены/установлены.\n";
    }
    
    logs += "\n--- Запуск Pipeline ---\n";
    fs.appendFileSync(LOG_FILE, "\n--- Запуск Pipeline ---\n");

    // 4. Запуск основного скрипта
    const py = spawn(pyPath, ['backend/python/main.py'], {
      env: { ...process.env, PYTHON_EXECUTABLE: pyPath }
    });
    
    py.on('error', (err) => {
      const msg = `[CRITICAL ERROR] Не удалось запустить Pipeline: ${err.message}\n`;
      logs += msg;
      fs.appendFileSync(LOG_FILE, msg);
    });

    py.stdout.on('data', (d) => {
      const str = d.toString();
      logs += str;
      fs.appendFileSync(LOG_FILE, str);
    });

    py.stderr.on('data', (d) => {
      const str = "[ERROR] " + d.toString();
      logs += str;
      fs.appendFileSync(LOG_FILE, str);
    });

    py.on('close', (code) => {
      const msg = `\n--- ПРОЦЕСС ЗАВЕРШЕН (Код: ${code}) ---\n`;
      const savedMsg = `Логи сохранены в: ${LOG_FILE}\n`;
      const completionMsg = "PROCESSING COMPLETED\n";
      
      logs += msg + savedMsg + completionMsg;
      fs.appendFileSync(LOG_FILE, msg + savedMsg + completionMsg);
    });
  });

  res.send('Started');
});

app.get('/logs', (req, res) => res.send(logs));

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${port}`);
});
