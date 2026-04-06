// file: server.ts
// Minimal Express server to keep the application running in the preview environment

import express from 'express'; // express
import { spawn } from 'child_process'; // spawn
import fs from 'fs'; // fs
import path from 'path'; // path

const app = express();
const port = 3000;
const LOG_DIR = path.join(__dirname, 'tmp', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'last_run.log');
let logs = 'Ожидание запуска...\n';

app.get('/', (req, res) => {
  res.send(`
    <body style="font-family: monospace; background: #1a1a1a; color: #00ff00; padding: 20px;">
      <h1 style="color: #2563eb;">PCB AI Validator - Console</h1>
      <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 20px;">
        <span id="status" style="color: #fbbf24; font-weight: bold;">Инициализация...</span>
        <button id="copyBtn" onclick="copyLogs()" style="padding: 8px 16px; cursor: pointer; background: #4b5563; color: white; border: none; border-radius: 4px;">Копировать логи</button>
      </div>
      <pre id="out" style="background: #000; padding: 15px; border: 1px solid #333; overflow: auto; max-height: 75vh; white-space: pre-wrap;">${logs}</pre>
      <script>
        async function run() {
          const status = document.getElementById('status');
          status.innerText = 'Выполняется...';
          status.style.color = '#fbbf24';
          
          await fetch('/run');
          
          const interval = setInterval(async () => {
            const r = await fetch('/logs');
            const text = await r.text();
            document.getElementById('out').innerText = text;
            
            if (text.includes('PROCESSING COMPLETED')) {
              clearInterval(interval);
              status.innerText = 'Завершено';
              status.style.color = '#10b981';
            }
          }, 1000);
        }

        // Автозапуск при загрузке
        window.onload = run;

        async function copyLogs() {
          const text = document.getElementById('out').innerText;
          const btn = document.getElementById('copyBtn');
          try {
            await navigator.clipboard.writeText(text);
            const originalText = btn.innerText;
            btn.innerText = 'Скопировано!';
            btn.style.background = '#10b981';
            setTimeout(() => {
              btn.innerText = originalText;
              btn.style.background = '#4b5563';
            }, 2000);
          } catch (err) {
            console.error('Ошибка копирования:', err);
          }
        }
      </script>
    </body>
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
      const msg = "[ERROR] Python не найден в системе (ни python3, ни python).\n";
      logs += msg;
      fs.appendFileSync(LOG_FILE, msg);
      res.send('Python not found');
      return;
    }
  }

  logs += `Используется интерпретатор: ${pyPath}\n`;
  logs += "--- Установка зависимостей ---\n";
  fs.appendFileSync(LOG_FILE, `Используется интерпретатор: ${pyPath}\n--- Установка зависимостей ---\n`);

  // 2. Установка зависимостей
  const pip = spawn(pyPath, ['-m', 'pip', 'install', '-r', 'requirements.txt']);
  
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

    // 3. Запуск основного скрипта
    const py = spawn(pyPath, ['backend/python/main.py']);
    
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
