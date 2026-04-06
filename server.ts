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
        <button id="startBtn" onclick="run()" style="padding: 10px 20px; cursor: pointer; background: #2563eb; color: white; border: none; border-radius: 4px; font-weight: bold; font-size: 1.1em;">Запустить пайплайн</button>
        <span id="status" style="color: #fbbf24; font-weight: bold;">Готов к запуску</span>
      </div>
      <pre id="out" style="background: #000; padding: 15px; border: 1px solid #333; overflow: auto; max-height: 75vh; white-space: pre-wrap;">${logs}</pre>
      <script>
        async function run() {
          const status = document.getElementById('status');
          const startBtn = document.getElementById('startBtn');
          
          startBtn.disabled = true;
          startBtn.style.opacity = '0.5';
          startBtn.style.cursor = 'not-allowed';
          
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
              startBtn.disabled = false;
              startBtn.style.opacity = '1';
              startBtn.style.cursor = 'pointer';
            }
          }, 1000);
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
