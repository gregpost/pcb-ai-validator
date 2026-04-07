// file: server.ts
// Minimal Express server to keep the application running in the preview environment

import express from 'express'; // express
import { spawn, execSync } from 'child_process'; // spawn, execSync
import fs from 'fs'; // fs
import path from 'path'; // path
import { fileURLToPath } from 'url'; // fileURLToPath
import { createServer as createViteServer } from 'vite'; // createServer
import multer from 'multer'; // multer

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let dest = 'PcbDocs';
    if (file.originalname.toLowerCase().endsWith('.pdf')) {
      dest = 'src/resources/datasheets';
    }
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage });

async function startServer() {
  const app = express();
  const port = 3000;
  const LOG_DIR = path.join(__dirname, 'tmp', 'logs');
  const LOG_FILE = path.join(LOG_DIR, 'last_run.log');
  let logs = 'Ожидание запуска...\n';

  // API routes
  app.post('/upload', upload.array('files'), (req, res) => {
    res.json({ message: 'Files uploaded successfully' });
  });

  app.get('/run', async (req, res) => {
    const target = req.query.target as string;
    logs = "--- Инициализация окружения ---\n";
    if (target) {
      logs += `Целевой компонент: ${target}\n`;
    }
    
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    
    fs.writeFileSync(LOG_FILE, logs);

    let pyPath = 'python3';
    try {
      execSync('python3 --version');
    } catch (e) {
      try {
        execSync('python --version');
        pyPath = 'python';
      } catch (e2) {
        const msg = "[ERROR] Python не найден в системе.\n";
        const completionMsg = "PROCESSING COMPLETED\n";
        logs += msg + completionMsg;
        fs.appendFileSync(LOG_FILE, msg + completionMsg);
        res.send('Python not found');
        return;
      }
    }

    logs += `Используется интерпретатор: ${pyPath}\n`;
    logs += "--- Проверка pip ---\n";
    fs.appendFileSync(LOG_FILE, `Используется интерпретатор: ${pyPath}\n--- Проверка pip ---\n`);

    try {
      execSync(`${pyPath} -m pip --version`);
      logs += "pip найден.\n";
    } catch (e) {
      logs += "pip не найден. Запуск установки через scripts/pip-dev.ts...\n";
      fs.appendFileSync(LOG_FILE, "pip не найден. Запуск установки через scripts/pip-dev.ts...\n");
      try {
        execSync(`npx tsx scripts/pip-dev.ts`, { env: { ...process.env, PYTHON_EXECUTABLE: pyPath } });
        logs += "pip успешно установлен.\n";
      } catch (e2) {
        const msg = `\n[FATAL ERROR] Не удалось установить pip: ${e2.message}\n`;
        const completionMsg = "PROCESSING COMPLETED\n";
        logs += msg + completionMsg;
        fs.appendFileSync(LOG_FILE, msg + completionMsg);
        return;
      }
    }

    logs += "--- Установка зависимостей ---\n";
    fs.appendFileSync(LOG_FILE, "--- Установка зависимостей ---\n");
    const pipArgs = ['-m', 'pip', 'install', '--user', '-r', 'requirements.txt'];
    const pip = spawn(pyPath, pipArgs);
    
    let pipOutput = '';
    pip.stdout.on('data', (d) => {
      const str = d.toString();
      pipOutput += str;
      fs.appendFileSync(LOG_FILE, str);
    });

    pip.stderr.on('data', (d) => {
      const str = d.toString();
      pipOutput += str;
      fs.appendFileSync(LOG_FILE, str);
    });

    pip.on('close', (code) => {
      if (code !== 0) {
        logs += pipOutput; // Show output only on error
        const msg = `\n[FATAL ERROR] Ошибка при установке зависимостей (Код: ${code}). Выполнение прервано.\n`;
        const completionMsg = "PROCESSING COMPLETED\n";
        logs += msg + completionMsg;
        fs.appendFileSync(LOG_FILE, msg + completionMsg);
        return;
      }
      
      logs += "Зависимости успешно проверены/установлены.\n";
      logs += "\n--- Запуск Pipeline ---\n";
      fs.appendFileSync(LOG_FILE, "\n--- Запуск Pipeline ---\n");

      const py = spawn(pyPath, ['src/python/main.py'], {
        env: { ...process.env, PYTHON_EXECUTABLE: pyPath, TARGET_COMPONENT: target }
      });
      
      py.on('error', (err) => {
        const msg = `[CRITICAL ERROR] Не удалось запустить Pipeline: ${err.message}\n`;
        const completionMsg = "PROCESSING COMPLETED\n";
        logs += msg + completionMsg;
        fs.appendFileSync(LOG_FILE, msg + completionMsg);
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

  app.get('/logs', (req, res) => res.type('text/plain').send(logs));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

startServer();
