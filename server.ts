// file: server.ts
// Minimal Express server to keep the application running in the preview environment

import express from 'express'; // express
import { spawn } from 'child_process'; // spawn
import path from 'path'; // path

const app = express();
const port = 3000;
let logs = 'Ожидание запуска...\n';

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.get('/run', (req, res) => {
  logs = "--- Запуск Pipeline ---\n";
  const py = spawn('python3', ['backend/python/main.py']);
  
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
