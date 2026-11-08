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
    let subDir = 'PcbDocs';
    const lower = file.originalname.toLowerCase();
    if (lower.endsWith('.pdf')) {
      subDir = path.join('resources', 'datasheets');
    } else if (lower.endsWith('.txt')) {
      subDir = path.join('resources', 'pins');
    } else if (lower.endsWith('.pcbdoc') || lower.endsWith('.pcbsch') || lower.endsWith('.schdoc')) {
      subDir = 'PcbDocs';
    }
    const targetDir = path.join(__dirname, subDir);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage });

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function validatePipelineInputs(targetRaw: string | undefined): ValidationResult {
  const errors: string[] = [];
  const target = (targetRaw || '').trim();

  // 1. Проверка целевого компонента
  if (!target) {
    errors.push("Не указано имя целевого компонента (TARGET_COMPONENT). Запуск невозможен.");
  }

  // 2. Проверка наличия PDF файлов
  const datasheetsDir = path.join(__dirname, 'resources', 'datasheets');
  const pinsDir = path.join(__dirname, 'resources', 'pins');
  const pcbDir = path.join(__dirname, 'PcbDocs');

  // Проверка PcbDoc / PcbSch
  if (!fs.existsSync(pcbDir)) {
    errors.push("Папка 'PcbDocs' не существует. Загрузите файлы плат или схем (*.PcbDoc, *.PcbSch).");
  } else {
    const pcbFiles = fs.readdirSync(pcbDir).filter(f => {
      const l = f.toLowerCase();
      return l.endsWith('.pcbdoc') || l.endsWith('.pcbsch') || l.endsWith('.schdoc');
    });
    if (pcbFiles.length === 0) {
      errors.push("В папке 'PcbDocs' не найдено ни одного файла плат или схем (*.PcbDoc, *.PcbSch).");
    }
  }

  if (!fs.existsSync(datasheetsDir)) {
    errors.push("В папке 'resources/datasheets' не найдено ни одного PDF файла. Загрузите даташит.");
  } else {
    const pdfFiles = fs.readdirSync(datasheetsDir).filter(f => f.toLowerCase().endsWith('.pdf'));
    if (pdfFiles.length === 0) {
      errors.push("В папке 'resources/datasheets' не найдено ни одного PDF файла даташитов.");
    } else {
      // 3. Проверка наличия PDF для целевого компонента
      if (target) {
        const targetPdfExists = pdfFiles.some(f => {
          const baseName = path.parse(f).name;
          return baseName.toLowerCase() === target.toLowerCase();
        });
        if (!targetPdfExists) {
          errors.push(`Отсутствует обязательный PDF даташит для целевого компонента '${target}.pdf' в resources/datasheets.`);
        }
      }

      // 4. Проверка файлов со списком ножек для каждого PDF
      pdfFiles.forEach(pdfFile => {
        const baseName = path.parse(pdfFile).name;
        let pinFound = false;
        if (fs.existsSync(pinsDir)) {
          const pinFiles = fs.readdirSync(pinsDir);
          pinFound = pinFiles.some(pf => pf.toLowerCase() === `${baseName.toLowerCase()}.txt`);
        }
        if (!pinFound) {
          errors.push(`Отсутствует обязательный файл списка ножек 'resources/pins/${baseName}.txt' для даташита '${pdfFile}'.`);
        }
      });
    }
  }

  // 5. Проверка наличия целевого компонента в загруженных PcbDoc / PcbSch файлах
  if (target && fs.existsSync(pcbDir)) {
    const pcbFiles = fs.readdirSync(pcbDir).filter(f => {
      const l = f.toLowerCase();
      return l.endsWith('.pcbdoc') || l.endsWith('.pcbsch') || l.endsWith('.schdoc');
    });
    if (pcbFiles.length > 0) {
      const targetLower = target.toLowerCase();
      // Проверяем, присутствует ли целевой компонент хотя бы в одном PcbDoc / PcbSch
      const foundInPcb = pcbFiles.some(pcbFile => {
        try {
          const pcbPath = path.join(pcbDir, pcbFile);
          const buf = fs.readFileSync(pcbPath);
          const str = buf.toString('latin1');
          return str.toLowerCase().includes(targetLower);
        } catch {
          return false;
        }
      });

      if (!foundInPcb) {
        errors.push(
          `Целевой компонент '${target}' отсутствует в загруженном файле платы/схемы (${pcbFiles.join(', ')}). Проверьте имя целевого компонента или загрузите соответствующий файл платы *.PcbDoc / *.PcbSch.`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

async function startServer() {
  const app = express();
  app.use(express.json());
  const port = 3000;
  const LOG_DIR = path.join(__dirname, 'tmp', 'logs');
  const LOG_FILE = path.join(LOG_DIR, 'last_run.log');
  let logs = 'Ожидание запуска...\n';
  let activePipelineProcess: any = null;
  if (fs.existsSync(LOG_FILE)) {
    try {
      const existing = fs.readFileSync(LOG_FILE, 'utf-8');
      if (existing.trim()) {
        logs = existing;
      }
    } catch {}
  }

  // API routes
  app.post('/upload', upload.array('files'), (req, res) => {
    res.json({ message: 'Files uploaded successfully' });
  });

  app.get('/files', (req, res) => {
    const result: Array<{ name: string; type: 'pcbdoc' | 'pcbsch' | 'pdf' | 'txt' }> = [];
    const pcbDir = path.join(__dirname, 'PcbDocs');
    const datasheetsDir = path.join(__dirname, 'resources', 'datasheets');
    const pinsDir = path.join(__dirname, 'resources', 'pins');

    if (fs.existsSync(pcbDir)) {
      fs.readdirSync(pcbDir)
        .filter(f => {
          const l = f.toLowerCase();
          return l.endsWith('.pcbdoc') || l.endsWith('.pcbsch') || l.endsWith('.schdoc');
        })
        .forEach(f => {
          const l = f.toLowerCase();
          const type = (l.endsWith('.pcbsch') || l.endsWith('.schdoc')) ? 'pcbsch' : 'pcbdoc';
          result.push({ name: f, type });
        });
    }
    if (fs.existsSync(datasheetsDir)) {
      fs.readdirSync(datasheetsDir)
        .filter(f => f.toLowerCase().endsWith('.pdf'))
        .forEach(f => result.push({ name: f, type: 'pdf' }));
    }
    if (fs.existsSync(pinsDir)) {
      fs.readdirSync(pinsDir)
        .filter(f => f.toLowerCase().endsWith('.txt'))
        .forEach(f => result.push({ name: f, type: 'txt' }));
    }
    res.json(result);
  });

  // Endpoints for viewing script run artifacts / intermediate files
  app.get('/artifacts', (req, res) => {
    try {
      const baseTmp = path.join(__dirname, 'tmp');
      if (!fs.existsSync(baseTmp)) {
        return res.json({ runs: [], currentRun: null, artifacts: [] });
      }

      const allEntries = fs.readdirSync(baseTmp, { withFileTypes: true });
      const runDirs = allEntries
        .filter(d => d.isDirectory() && (d.name.startsWith('tmp_') || d.name === 'base'))
        .map(d => {
          const dirPath = path.join(baseTmp, d.name);
          const stat = fs.statSync(dirPath);
          return { name: d.name, mtime: stat.mtimeMs };
        })
        .sort((a, b) => b.mtime - a.mtime);

      if (runDirs.length === 0) {
        return res.json({ runs: [], currentRun: null, artifacts: [] });
      }

      const requestedRun = req.query.run as string;
      const targetRun = (requestedRun && runDirs.some(r => r.name === requestedRun))
        ? requestedRun
        : runDirs[0].name;

      const targetDirPath = path.join(baseTmp, targetRun);

      const artifacts: Array<{
        category: 'datasheet' | 'pcb_to_netlist' | 'graph' | 'final' | 'other';
        stageName: string;
        scriptName: string;
        fileName: string;
        relativePath: string;
        size: number;
        formattedSize: string;
        isText: boolean;
        lineCount?: number;
      }> = [];

      function formatSize(bytes: number): string {
        if (!bytes || bytes <= 0) return '0 Б';
        const k = 1024;
        const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
      }

      function scanDir(dir: string, relPrefix = '') {
        if (!fs.existsSync(dir)) return;
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
          const fullPath = path.join(dir, item.name);
          const relPath = path.join(relPrefix, item.name);
          if (item.isDirectory()) {
            scanDir(fullPath, relPath);
          } else if (item.isFile()) {
            const stat = fs.statSync(fullPath);
            const lower = item.name.toLowerCase();
            const ext = path.extname(lower);
            const isText = ['.txt', '.md', '.gml', '.json', '.log', '.csv', '.tsv'].includes(ext) || ext === '';

            let category: 'datasheet' | 'pcb_to_netlist' | 'graph' | 'final' | 'other' = 'other';
            let stageName = 'Промежуточный файл';
            let scriptName = item.name;

            if (relPath.startsWith('huge_file')) {
              category = 'datasheet';
              if (lower.endsWith('.md')) {
                stageName = '1. Конвертация PDF в Markdown';
                scriptName = '0_pdf_to_md';
              } else if (lower.includes('clipboard_saver')) {
                stageName = '2.1 Буфер обмена / Сырые пины';
                scriptName = '1_clipboard_saver';
              } else if (lower.includes('large_file_slicer')) {
                stageName = '2.2 Фрагментация даташита';
                scriptName = '2_large_file_slicer';
              } else if (lower.includes('full_description')) {
                stageName = '2.3 Полное описание';
                scriptName = 'full_description';
              } else {
                stageName = '2. Обработка даташита';
              }
            } else if (relPath.startsWith('pcb_to_netlist')) {
              category = 'pcb_to_netlist';
              if (lower.startsWith('1_utf8')) {
                stageName = '3.1 Конвертация PCB в UTF-8';
                scriptName = '1_utf8.py';
              } else if (lower.startsWith('2_filter')) {
                stageName = '3.2 Фильтрация служебных блоков';
                scriptName = '2_filter.py';
              } else if (lower.startsWith('3_rm')) {
                stageName = '3.3 Очистка служебных символов';
                scriptName = '3_rm.py';
              } else if (lower.startsWith('4_rm2')) {
                stageName = '3.4 Нормализация разметки';
                scriptName = '4_rm2.py';
              } else if (lower.startsWith('5_nets')) {
                stageName = '3.5 Выделение списка цепей (Nets)';
                scriptName = '5_nets.py';
              } else if (lower.startsWith('6_comp')) {
                stageName = '3.6 Компоненты схемы';
                scriptName = '6_comp.py';
              } else if (lower.startsWith('7_net')) {
                stageName = '3.7 Связи выводов с цепями';
                scriptName = '7_net.py';
              } else if (lower.startsWith('8_resolve_chips')) {
                stageName = '3.8 Итоговый Netlist микросхем';
                scriptName = '8_resolve_chips.py';
              } else {
                stageName = '3. PCB to Netlist';
              }
            } else if (relPath.startsWith('graph')) {
              category = 'graph';
              if (lower.includes('1_netlist_to_graph') || lower.includes('1_full')) {
                stageName = '4.1 Полный граф цепей (Full Graph)';
                scriptName = '1_netlist_to_graph';
              } else if (lower.includes('2_remove_degree2') || lower.includes('2_no_deg2')) {
                stageName = '4.2 Граф без транзитных цепей (deg 2)';
                scriptName = '2_remove_degree2_nets';
              } else if (lower.includes('3_simplify_passive') || lower.includes('3_simplify')) {
                stageName = '4.3 Упрощенный граф (без пассива)';
                scriptName = '3_simplify_passive_components';
              } else if (lower.includes('4_get_branch')) {
                stageName = '5.1 Подграф ветвей выводов';
                scriptName = '4_get_branch';
              } else if (lower.includes('5_graph_to_text')) {
                stageName = '5.2 Текстовое описание подграфа';
                scriptName = '5_graph_to_text';
              } else if (lower.includes('6_remove_nets')) {
                stageName = '5.3 Очищенные цепи подграфа';
                scriptName = '6_remove_nets';
              } else if (lower.includes('7_text_appender')) {
                stageName = '5.4 Сводное описание всех ножек платы';
                scriptName = '7_text_appender';
              } else if (lower.includes('8_1_pin_processor')) {
                stageName = '2.4 Извлеченные выводы компонента';
                scriptName = '3_pin_processor';
              } else if (lower.includes('8_merge_pin_fields')) {
                stageName = '6. Объединение полей выводов схемы';
                scriptName = '8_merge_pin_fields';
              } else if (lower.includes('12_merge_pin_fields')) {
                category = 'final';
                stageName = '7. Финальное сведение всех плат';
                scriptName = '8_merge_pin_fields (global)';
              } else if (lower.includes('9_circuit_parser')) {
                category = 'final';
                stageName = '8.1 Парсинг цепей и компонентов';
                scriptName = '9_circuit_parser';
              } else if (lower.includes('10_filter_components')) {
                category = 'final';
                stageName = '8.2 Фильтрация релевантных компонентов';
                scriptName = '10_filter_components';
              } else if (lower.includes('11_netlist_datasheet_sorter')) {
                category = 'final';
                stageName = '8.3 Сортировка схемы и даташита для ИИ';
                scriptName = '11_netlist_datasheet_sorter';
              } else {
                stageName = 'Граф и связи схемы';
              }
            }

            let lineCount: number | undefined = undefined;
            if (isText && stat.size < 10 * 1024 * 1024) {
              try {
                const sample = fs.readFileSync(fullPath, 'utf8');
                lineCount = (sample.match(/\n/g) || []).length + 1;
              } catch {}
            }

            artifacts.push({
              category,
              stageName,
              scriptName,
              fileName: item.name,
              relativePath: relPath,
              size: stat.size,
              formattedSize: formatSize(stat.size),
              isText,
              lineCount
            });
          }
        }
      }

      scanDir(targetDirPath);

      // Сортировка артефактов по этапам
      artifacts.sort((a, b) => a.stageName.localeCompare(b.stageName, 'ru', { numeric: true }));

      res.json({
        runs: runDirs.map(r => r.name),
        currentRun: targetRun,
        artifacts
      });
    } catch (err: any) {
      console.error('Artifacts scan error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/artifact-content', (req, res) => {
    try {
      const run = req.query.run as string;
      const fileRel = req.query.file as string;
      if (!run || !fileRel) {
        return res.status(400).json({ error: 'Run and file parameters are required' });
      }

      // Security check against directory traversal
      const safeRun = path.basename(run);
      const normalizedRel = path.normalize(fileRel).replace(/^(\.\.(\/|\\|$))+/, '');
      const fullPath = path.join(__dirname, 'tmp', safeRun, normalizedRel);

      if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
        return res.status(404).json({ error: 'Файл не найден' });
      }

      const stat = fs.statSync(fullPath);
      // For large files (> 5MB) don't send raw UTF8 string entirely if previewing
      if (stat.size > 8 * 1024 * 1024) {
        const stream = fs.createReadStream(fullPath, { start: 0, end: 200 * 1024 });
        let buf = '';
        stream.on('data', chunk => { buf += chunk.toString('utf8'); });
        stream.on('end', () => {
          res.json({
            content: buf + `\n\n... [Файл слишком большой (${(stat.size / 1024 / 1024).toFixed(1)} МБ), показаны первые 200 КБ] ...`,
            truncated: true,
            size: stat.size,
            path: normalizedRel
          });
        });
        return;
      }

      const content = fs.readFileSync(fullPath, 'utf8');
      res.json({
        content,
        truncated: false,
        size: stat.size,
        path: normalizedRel
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/files', (req, res) => {
    const name = req.query.name as string;
    const type = req.query.type as string;
    if (!name) {
      return res.status(400).json({ error: 'Name required' });
    }
    let targetDir = '';
    if (type === 'pdf') {
      targetDir = path.join(__dirname, 'resources', 'datasheets');
    } else if (type === 'txt') {
      targetDir = path.join(__dirname, 'resources', 'pins');
    } else if (type === 'pcbdoc' || type === 'pcbsch') {
      targetDir = path.join(__dirname, 'PcbDocs');
    }
    if (targetDir) {
      const filePath = path.join(targetDir, name);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    res.json({ message: 'File deleted' });
  });

  // --- GITHUB REPOSITORY INTEGRATION ENDPOINTS ---

  // Helper: парсинг URL репозитория или формата "owner/repo"
  function parseGitHubRepo(input: string): { owner: string; repo: string; branch?: string } | null {
    if (!input || typeof input !== 'string') return null;
    let trimmed = input.trim().replace(/\.git$/i, '').replace(/\/+$/, '');

    // Проверяем полную ссылку: https://github.com/owner/repo/tree/branch или https://github.com/owner/repo
    const urlMatch = trimmed.match(/github\.com\/([^\/\s]+)\/([^\/\s]+)(?:\/tree\/([^\/\s]+))?/i);
    if (urlMatch) {
      return {
        owner: urlMatch[1],
        repo: urlMatch[2],
        branch: urlMatch[3] || undefined
      };
    }

    // Проверяем короткий формат: owner/repo
    const parts = trimmed.split('/');
    if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
      return {
        owner: parts[0].trim(),
        repo: parts[1].trim()
      };
    }

    return null;
  }

  function getGitHubHeaders(token?: string) {
    const headers: Record<string, string> = {
      'User-Agent': 'PCB-AI-Validator',
      'Accept': 'application/vnd.github.v3+json'
    };
    const effectiveToken = (token || process.env.GITHUB_TOKEN || '').trim();
    if (effectiveToken) {
      headers['Authorization'] = `token ${effectiveToken}`;
    }
    return headers;
  }

  // 1. Проверка репозитория и получение информации
  app.post('/api/github/connect', async (req, res) => {
    try {
      const rawInput = req.body.repoUrl || req.body.repo;
      const { token } = req.body;
      const parsed = parseGitHubRepo(rawInput);
      if (!parsed) {
        return res.status(400).json({
          error: 'Неверный формат. Введите "owner/repo" (напр. "torvalds/linux") или ссылку "https://github.com/owner/repo".'
        });
      }

      const headers = getGitHubHeaders(token);
      const apiUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`;
      const ghRes = await fetch(apiUrl, { headers });

      if (!ghRes.ok) {
        if (ghRes.status === 404) {
          return res.status(404).json({
            error: `Репозиторий "${parsed.owner}/${parsed.repo}" не найден. Проверьте правильность названия или укажите токен (PAT), если репозиторий приватный.`
          });
        }
        if (ghRes.status === 403 || ghRes.status === 429) {
          return res.status(429).json({
            error: 'Превышен лимит запросов к GitHub API без авторизации. Укажите Personal Access Token (PAT) для доступа.'
          });
        }
        return res.status(ghRes.status).json({
          error: `Ошибка GitHub API: ${ghRes.statusText} (${ghRes.status})`
        });
      }

      const data: any = await ghRes.json();
      res.json({
        owner: parsed.owner,
        repo: parsed.repo,
        fullName: data.full_name,
        defaultBranch: parsed.branch || data.default_branch || 'main',
        isPrivate: !!data.private,
        description: data.description || '',
        stars: data.stargazers_count,
        url: data.html_url
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Список веток репозитория
  app.get('/api/github/branches', async (req, res) => {
    try {
      const owner = req.query.owner as string;
      const repo = req.query.repo as string;
      const token = req.query.token as string;
      if (!owner || !repo) {
        return res.status(400).json({ error: 'Параметры owner и repo обязательны' });
      }

      const headers = getGitHubHeaders(token);
      const ghRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`, { headers });
      if (!ghRes.ok) {
        return res.status(ghRes.status).json({ error: 'Не удалось загрузить список веток' });
      }
      const data: any = await ghRes.json();
      const branches = Array.isArray(data) ? data.map((b: any) => b.name) : [];
      res.json({ branches });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Поиск файлов в дереве репозитория (.pcbdoc, .pcbsch, .schdoc, .pdf, .txt)
  app.get('/api/github/tree', async (req, res) => {
    try {
      const owner = (req.query.owner as string || '').trim();
      const repo = (req.query.repo as string || '').trim();
      let branch = (req.query.branch as string || '').trim();
      const token = req.query.token as string;
      const search = ((req.query.search as string) || '').toLowerCase().trim();
      const typeFilter = (req.query.type as string) || 'all'; // 'all' | 'pcb' | 'pdf' | 'txt'

      if (!owner || !repo || owner === 'undefined' || repo === 'undefined') {
        return res.status(400).json({ error: 'Параметры owner и repo обязательны и должны быть корректными' });
      }

      if (!branch || branch === 'undefined') {
        branch = 'main';
      }

      const headers = getGitHubHeaders(token);
      let treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
      let ghRes = await fetch(treeUrl, { headers });

      // Если 404 на ветке main, пробуем master
      if (!ghRes.ok && ghRes.status === 404 && branch === 'main') {
        const altBranch = 'master';
        const altUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(altBranch)}?recursive=1`;
        const altRes = await fetch(altUrl, { headers });
        if (altRes.ok) {
          ghRes = altRes;
          branch = altBranch;
        }
      }

      if (!ghRes.ok) {
        if (ghRes.status === 404) {
          return res.status(404).json({ error: `Ветка "${branch}" не найдена в репозитории ${owner}/${repo}` });
        }
        return res.status(ghRes.status).json({ error: `Ошибка получения дерева: ${ghRes.statusText}` });
      }

      const data: any = await ghRes.json();
      const tree: any[] = Array.isArray(data.tree) ? data.tree : [];

      function formatSize(bytes: number): string {
        if (!bytes || bytes <= 0) return '0 Б';
        const k = 1024;
        const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
      }

      const matchingFiles = tree
        .filter(item => item.type === 'blob')
        .map(item => {
          const p = item.path as string;
          const lower = p.toLowerCase();
          const name = path.basename(p);

          let fileType: 'pcbdoc' | 'pcbsch' | 'pdf' | 'txt' | 'other' = 'other';
          let category: 'pcb' | 'pdf' | 'txt' | 'other' = 'other';
          let targetFolder = 'PcbDocs';

          if (lower.endsWith('.pcbdoc')) {
            fileType = 'pcbdoc';
            category = 'pcb';
            targetFolder = 'PcbDocs';
          } else if (lower.endsWith('.pcbsch') || lower.endsWith('.schdoc')) {
            fileType = 'pcbsch';
            category = 'pcb';
            targetFolder = 'PcbDocs';
          } else if (lower.endsWith('.pdf')) {
            fileType = 'pdf';
            category = 'pdf';
            targetFolder = 'resources/datasheets';
          } else if (lower.endsWith('.txt')) {
            fileType = 'txt';
            category = 'txt';
            targetFolder = 'resources/pins';
          }

          return {
            path: p,
            name,
            size: item.size || 0,
            formattedSize: formatSize(item.size || 0),
            fileType,
            category,
            targetFolder,
            sha: item.sha
          };
        })
        .filter(item => {
          if (item.category === 'other') return false;
          if (typeFilter !== 'all' && item.category !== typeFilter) return false;
          if (search) {
            return item.name.toLowerCase().includes(search) || item.path.toLowerCase().includes(search);
          }
          return true;
        });

      res.json({
        totalInRepo: tree.length,
        matchedCount: matchingFiles.length,
        truncated: !!data.truncated,
        files: matchingFiles
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Загрузка выбранных файлов из GitHub прямо на сервер
  app.post('/api/github/download', async (req, res) => {
    try {
      const { owner, repo, branch, token, files } = req.body;
      if (!owner || !repo || !Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: 'owner, repo и список files обязательны' });
      }

      const effectiveBranch = branch || 'main';
      const headers = getGitHubHeaders(token);
      const results: Array<{ name: string; path: string; targetFolder: string; success: boolean; size?: number; error?: string }> = [];

      for (const item of files) {
        try {
          const filePath = item.path;
          const fileName = item.name || path.basename(filePath);
          const lower = fileName.toLowerCase();

          let targetDir = path.join(__dirname, 'PcbDocs');
          let folderName = 'PcbDocs';
          if (lower.endsWith('.pdf') || item.fileType === 'pdf') {
            targetDir = path.join(__dirname, 'resources', 'datasheets');
            folderName = 'resources/datasheets';
          } else if (lower.endsWith('.txt') || item.fileType === 'txt') {
            targetDir = path.join(__dirname, 'resources', 'pins');
            folderName = 'resources/pins';
          } else if (lower.endsWith('.pcbdoc') || lower.endsWith('.pcbsch') || lower.endsWith('.schdoc') || item.fileType === 'pcbdoc' || item.fileType === 'pcbsch') {
            targetDir = path.join(__dirname, 'PcbDocs');
            folderName = 'PcbDocs';
          }

          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }

          const savePath = path.join(targetDir, fileName);

          // 1. Попытка через raw.githubusercontent.com
          const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(effectiveBranch)}/${filePath.split('/').map(encodeURIComponent).join('/')}`;
          let fileRes = await fetch(rawUrl, { headers });

          // 2. Если raw вернул статус отличный от 200, используем API с Accept: application/vnd.github.v3.raw
          if (!fileRes.ok) {
            const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(effectiveBranch)}`;
            fileRes = await fetch(apiUrl, {
              headers: {
                ...headers,
                'Accept': 'application/vnd.github.v3.raw'
              }
            });
          }

          if (!fileRes.ok) {
            results.push({
              name: fileName,
              path: filePath,
              targetFolder: folderName,
              success: false,
              error: `HTTP ${fileRes.status}: ${fileRes.statusText}`
            });
            continue;
          }

          const arrayBuffer = await fileRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          fs.writeFileSync(savePath, buffer);

          results.push({
            name: fileName,
            path: filePath,
            targetFolder: folderName,
            size: buffer.length,
            success: true
          });
        } catch (itemErr: any) {
          results.push({
            name: item.name || item.path,
            path: item.path,
            targetFolder: '',
            success: false,
            error: itemErr.message
          });
        }
      }

      res.json({
        success: true,
        downloadedCount: results.filter(r => r.success).length,
        results
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Endpoints for interactive AI prompt handling
  app.get('/ai-status', (req, res) => {
    try {
      const baseTmp = path.join(__dirname, 'tmp');
      if (!fs.existsSync(baseTmp)) {
        return res.json({ waiting: false, stage: null, run: null });
      }

      const allEntries = fs.readdirSync(baseTmp, { withFileTypes: true });
      const runDirs = allEntries
        .filter(d => d.isDirectory() && (d.name.startsWith('tmp_') || d.name === 'base'))
        .map(d => ({ name: d.name, mtime: fs.statSync(path.join(baseTmp, d.name)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime);

      if (runDirs.length === 0) {
        return res.json({ waiting: false, stage: null, run: null });
      }

      const latestRun = runDirs[0].name;
      const runDir = path.join(baseTmp, latestRun);

      const flag1Ready = fs.existsSync(path.join(runDir, 'ready_for_user_answers_1.flag'));
      const flag1Resume = fs.existsSync(path.join(runDir, 'resume_stage_1.flag'));

      const flag2Ready = fs.existsSync(path.join(runDir, 'ready_for_user_answers_2.flag'));
      const flag2Resume = fs.existsSync(path.join(runDir, 'resume_stage_2.flag'));

      if (flag1Ready && !flag1Resume) {
        return res.json({
          waiting: true,
          stage: 1,
          stageTitle: 'Этап 1: Сжатие даташита в описание пинов',
          stageDesc: 'Отправьте промпты по фрагментам даташита в нейросеть для извлечения описания выводов',
          run: latestRun
        });
      }

      if (flag2Ready && !flag2Resume) {
        return res.json({
          waiting: true,
          stage: 2,
          stageTitle: 'Этап 2: Конвертация электрической схемы в текст',
          stageDesc: 'Отправьте промпты схемы в нейросеть для получения словесного описания подключений',
          run: latestRun
        });
      }

      res.json({ waiting: false, stage: null, run: latestRun });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/ai-prompts', (req, res) => {
    try {
      const stage = Number(req.query.stage) || 1;
      const baseTmp = path.join(__dirname, 'tmp');
      const allEntries = fs.existsSync(baseTmp) ? fs.readdirSync(baseTmp, { withFileTypes: true }) : [];
      const runDirs = allEntries
        .filter(d => d.isDirectory() && (d.name.startsWith('tmp_') || d.name === 'base'))
        .map(d => ({ name: d.name, mtime: fs.statSync(path.join(baseTmp, d.name)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime);

      if (runDirs.length === 0) {
        return res.json({ prompts: [] });
      }

      const latestRun = runDirs[0].name;
      const runDir = path.join(baseTmp, latestRun);
      const promptDir = stage === 1 
        ? path.join(runDir, 'huge_file', 'prompt_outputs')
        : path.join(runDir, 'graph', 'prompt_outputs_2');

      if (!fs.existsSync(promptDir)) {
        return res.json({ prompts: [], run: latestRun, stage });
      }

      const files = fs.readdirSync(promptDir)
        .filter(f => f.startsWith('prompt_step_') && f.endsWith('.txt'))
        .sort((a, b) => {
          const numA = parseInt(a.replace(/\D/g, '')) || 0;
          const numB = parseInt(b.replace(/\D/g, '')) || 0;
          return numA - numB;
        });

      const prompts = files.map((file, idx) => {
        const full = path.join(promptDir, file);
        const content = fs.readFileSync(full, 'utf8');
        return {
          index: idx + 1,
          fileName: file,
          total: files.length,
          content
        };
      });

      res.json({ prompts, run: latestRun, stage });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/ai-submit', (req, res) => {
    try {
      const { answers, stage } = req.body;
      const currentStage = Number(stage) || 1;
      const baseTmp = path.join(__dirname, 'tmp');
      const allEntries = fs.existsSync(baseTmp) ? fs.readdirSync(baseTmp, { withFileTypes: true }) : [];
      const runDirs = allEntries
        .filter(d => d.isDirectory() && (d.name.startsWith('tmp_') || d.name === 'base'))
        .map(d => ({ name: d.name, mtime: fs.statSync(path.join(baseTmp, d.name)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime);

      if (runDirs.length === 0) {
        return res.status(400).json({ error: 'Активный запуск не найден' });
      }

      const latestRun = runDirs[0].name;
      const runDir = path.join(baseTmp, latestRun);

      const combinedText = Array.isArray(answers) ? answers.join('\n\n') : (answers || '');

      if (currentStage === 1) {
        const targetPath = path.join(runDir, 'huge_file', '1_clipboard_saver.txt');
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, combinedText, 'utf8');

        // Создаем флаг продолжения
        const resumeFlag = path.join(runDir, 'resume_stage_1.flag');
        fs.writeFileSync(resumeFlag, 'RESUME');
      } else {
        const targetPath = path.join(runDir, 'graph', 'prompt_outputs_2_answers.txt');
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, combinedText, 'utf8');

        const resumeFlag = path.join(runDir, 'resume_stage_2.flag');
        fs.writeFileSync(resumeFlag, 'RESUME');
      }

      res.json({ success: true, message: 'Ответы сохранены, пайплайн возобновлен' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/stop', (req, res) => {
    try {
      if (activePipelineProcess) {
        try {
          activePipelineProcess.kill('SIGTERM');
        } catch {}
        setTimeout(() => {
          try {
            activePipelineProcess?.kill('SIGKILL');
          } catch {}
          activePipelineProcess = null;
        }, 300);
      }

      // Очистка флагов ожидания и создание cancel.flag во всех папках tmp
      const baseTmp = path.join(__dirname, 'tmp');
      if (fs.existsSync(baseTmp)) {
        const dirs = fs.readdirSync(baseTmp, { withFileTypes: true });
        for (const d of dirs) {
          if (d.isDirectory()) {
            const dirPath = path.join(baseTmp, d.name);
            const flag1 = path.join(dirPath, 'ready_for_user_answers_1.flag');
            const flag2 = path.join(dirPath, 'ready_for_user_answers_2.flag');
            const cancelFlag = path.join(dirPath, 'cancel.flag');
            try { fs.writeFileSync(cancelFlag, 'CANCEL'); } catch {}
            if (fs.existsSync(flag1)) {
              try { fs.unlinkSync(flag1); } catch {}
            }
            if (fs.existsSync(flag2)) {
              try { fs.unlinkSync(flag2); } catch {}
            }
          }
        }
      }

      const stopMsg = "\n[USER_ABORT] Пайплайн принудительно остановлен пользователем.\n";
      logs += stopMsg;
      if (fs.existsSync(LOG_FILE)) {
        try { fs.appendFileSync(LOG_FILE, stopMsg); } catch {}
      }

      res.json({ success: true, message: 'Пайплайн успешно остановлен' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/run', async (req, res) => {
    const target = req.query.target as string;
    const engine = (req.query.engine as string) || 'typescript';
    
    logs = "--- Инициализация окружения ---\n";
    logs += `Движок: ${engine}\n`;
    if (target) {
      logs += `Целевой компонент: ${target}\n`;
    }
    
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    
    // ВАЛИДАЦИЯ ВХОДНЫХ ДАННЫХ
    const validation = validatePipelineInputs(target);
    if (!validation.valid) {
      logs += "\n--- ОШИБКА ВАЛИДАЦИИ ВХОДНЫХ ДАННЫХ ---\n";
      validation.errors.forEach(err => {
        logs += `[FATAL ERROR] ${err}\n`;
      });
      logs += "\n[FATAL ERROR] ПРОЦЕСС ЗАВЕРШЕН С ОШИБКОЙ\n";
      fs.writeFileSync(LOG_FILE, logs);
      res.status(400).send('Validation failed');
      return;
    }

    fs.writeFileSync(LOG_FILE, logs);

    if (engine === 'typescript') {
      logs += "Запуск TypeScript Pipeline через tsx...\n";
      fs.appendFileSync(LOG_FILE, "Запуск TypeScript Pipeline через tsx...\n");

      const tsProcess = spawn('npx', ['tsx', 'src/typescript/main.ts'], {
        env: { ...process.env, TARGET_COMPONENT: target }
      });
      activePipelineProcess = tsProcess;

      tsProcess.on('error', (err) => {
        activePipelineProcess = null;
        const msg = `[CRITICAL ERROR] Не удалось запустить TypeScript Pipeline: ${err.message}\n`;
        const failMsg = `\n[FATAL ERROR] ПРОЦЕСС ЗАВЕРШЕН С ОШИБКОЙ\n`;
        logs += msg + failMsg;
        fs.appendFileSync(LOG_FILE, msg + failMsg);
      });

      tsProcess.stdout.on('data', (d) => {
        const str = d.toString();
        logs += str;
        fs.appendFileSync(LOG_FILE, str);
      });

      tsProcess.stderr.on('data', (d) => {
        const str = "[ERROR] " + d.toString();
        logs += str;
        fs.appendFileSync(LOG_FILE, str);
      });

      tsProcess.on('close', (code) => {
        activePipelineProcess = null;
        if (code === 0) {
          const msg = `\n--- ПРОЦЕСС ЗАВЕРШЕН УСПЕШНО ---\n`;
          const completionMsg = "PROCESSING COMPLETED\n";
          logs += msg + completionMsg;
          fs.appendFileSync(LOG_FILE, msg + completionMsg);
        } else {
          const msg = `\n[FATAL ERROR] ПРОЦЕСС ЗАВЕРШЕН С ОШИБКОЙ (Код: ${code})\n`;
          logs += msg;
          fs.appendFileSync(LOG_FILE, msg);
        }
      });

      res.send('Started');
      return;
    }

    // Default Python Logic
    let pyPath = 'python3';
    try {
      execSync('python3 --version');
    } catch (e) {
      try {
        execSync('python --version');
        pyPath = 'python';
      } catch (e2) {
        const msg = "[ERROR] Python не найден в системе.\n";
        const failMsg = "\n[FATAL ERROR] ПРОЦЕСС ЗАВЕРШЕН С ОШИБКОЙ\n";
        logs += msg + failMsg;
        fs.appendFileSync(LOG_FILE, msg + failMsg);
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
        const failMsg = "\n[FATAL ERROR] ПРОЦЕСС ЗАВЕРШЕН С ОШИБКОЙ\n";
        logs += msg + failMsg;
        fs.appendFileSync(LOG_FILE, msg + failMsg);
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
        const failMsg = "\n[FATAL ERROR] ПРОЦЕСС ЗАВЕРШЕН С ОШИБКОЙ\n";
        logs += msg + failMsg;
        fs.appendFileSync(LOG_FILE, msg + failMsg);
        return;
      }
      
      logs += "Зависимости успешно проверены/установлены.\n";
      logs += "\n--- Запуск Pipeline ---\n";
      fs.appendFileSync(LOG_FILE, "\n--- Запуск Pipeline ---\n");

      const py = spawn(pyPath, ['src/python/main.py'], {
        env: { ...process.env, PYTHON_EXECUTABLE: pyPath, TARGET_COMPONENT: target }
      });
      activePipelineProcess = py;
      
      py.on('error', (err) => {
        activePipelineProcess = null;
        const msg = `[CRITICAL ERROR] Не удалось запустить Pipeline: ${err.message}\n`;
        const failMsg = `\n[FATAL ERROR] ПРОЦЕСС ЗАВЕРШЕН С ОШИБКОЙ\n`;
        logs += msg + failMsg;
        fs.appendFileSync(LOG_FILE, msg + failMsg);
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
        activePipelineProcess = null;
        if (code === 0) {
          const msg = `\n--- ПРОЦЕСС ЗАВЕРШЕН УСПЕШНО ---\n`;
          const completionMsg = "PROCESSING COMPLETED\n";
          logs += msg + completionMsg;
          fs.appendFileSync(LOG_FILE, msg + completionMsg);
        } else {
          const msg = `\n[FATAL ERROR] ПРОЦЕСС ЗАВЕРШЕН С ОШИБКОЙ (Код: ${code})\n`;
          logs += msg;
          fs.appendFileSync(LOG_FILE, msg);
        }
      });
    });

    res.send('Started');
  });

  app.get('/logs', (req, res) => res.type('text/plain').send(logs));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
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
