// file: server.ts
// Minimal Express server to keep the application running in the preview environment

import express from 'express'; // express
import { spawn } from 'child_process'; // spawn
import path from 'path'; // path

const app = express();
const port = 3000;
let logs = 'Ожидание запуска...\n';

app.get('/', (req, res) => {
  res.send(`
    <body style="font-family: monospace; background: #1a1a1a; color: #00ff00; padding: 20px;">
      <h1 style="color: #2563eb;">PCB AI Validator - Console</h1>
      <div style="display: flex; gap: 10px; margin-bottom: 20px;">
        <button id="runBtn" onclick="run()" style="padding: 10px; cursor: pointer; background: #2563eb; color: white; border: none; border-radius: 4px;">Запустить Pipeline</button>
        <button id="copyBtn" onclick="copyLogs()" style="padding: 10px; cursor: pointer; background: #4b5563; color: white; border: none; border-radius: 4px;">Копировать логи</button>
      </div>
      <pre id="out" style="background: #000; padding: 15px; border: 1px solid #333; overflow: auto; max-height: 70vh; white-space: pre-wrap;">${logs}</pre>
      <script>
        async function run() {
          const btn = document.getElementById('runBtn');
          btn.disabled = true;
          btn.innerText = 'Выполняется...';
          await fetch('/run');
          const interval = setInterval(async () => {
            const r = await fetch('/logs');
            const text = await r.text();
            document.getElementById('out').innerText = text;
            if (text.includes('PROCESSING COMPLETED')) {
              clearInterval(interval);
              btn.disabled = false;
              btn.innerText = 'Запустить Pipeline';
            }
          }, 1000);
        }

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
            alert('Не удалось скопировать логи');
          }
        }
      </script>
    </body>
  `);
});

app.get('/run', (req, res) => {
  logs = "--- Запуск Pipeline ---\n";
  const pythonCwd = path.join(process.cwd(), 'backend', 'python');
  const py = spawn('python3', ['main.py'], { cwd: pythonCwd });
  
  py.on('error', (err) => {
    logs += `[CRITICAL ERROR] Не удалось запустить Python: ${err.message}\n`;
    console.error(err);
  });

  py.stdout.on('data', (d) => {
    logs += d.toString();
    console.log(d.toString());
  });
  py.stderr.on('data', (d) => {
    logs += "[ERROR] " + d.toString();
    console.error(d.toString());
  });
  py.on('close', (code) => {
    logs += `\n--- ПРОЦЕСС ЗАВЕРШЕН (Код: ${code}) ---\n`;
    logs += "PROCESSING COMPLETED\n"; // Метка для фронтенда
  });
  res.send('Started');
});

app.get('/logs', (req, res) => res.send(logs));

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${port}`);
});
