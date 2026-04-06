// file: server.ts
// Minimal Express server to keep the application running in the preview environment

import express from 'express'; // express
import { spawn } from 'child_process'; // spawn

const app = express();
const port = 3000;
let logs = 'Ожидание запуска...\n';

app.get('/', (req, res) => {
  res.send(`
    <body style="font-family: monospace; background: #1a1a1a; color: #00ff00; padding: 20px;">
      <h1 style="color: #2563eb;">PCB AI Validator - Console</h1>
      <button onclick="run()" style="padding: 10px; cursor: pointer; background: #2563eb; color: white; border: none; border-radius: 4px;">Запустить Pipeline</button>
      <pre id="out" style="background: #000; padding: 15px; border: 1px solid #333; margin-top: 20px; overflow: auto; max-height: 70vh; white-space: pre-wrap;">${logs}</pre>
      <script>
        async function run() {
          const btn = document.querySelector('button');
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
      </script>
    </body>
  `);
});

app.get('/run', (req, res) => {
  logs = "--- Запуск Pipeline ---\n";
  const py = spawn('python', ['backend/python/main.py']);
  py.stdout.on('data', (d) => {
    logs += d.toString();
    console.log(d.toString());
  });
  py.stderr.on('data', (d) => {
    logs += "[ERROR] " + d.toString();
    console.error(d.toString());
  });
  py.on('close', (code) => {
    logs += `\n--- Процесс завершен с кодом ${code} ---\n`;
  });
  res.send('Started');
});

app.get('/logs', (req, res) => res.send(logs));

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${port}`);
});
