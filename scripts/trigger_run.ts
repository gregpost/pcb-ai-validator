import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

async function run() {
  console.log('--- Начинаю автоматическую проверку пайплайна ---');
  
  let pyPath = 'python3';
  try {
    execSync('python3 --version');
  } catch (e) {
    pyPath = 'python';
  }

  try {
    execSync(`${pyPath} -m pip --version`);
  } catch (e) {
    console.log('pip не найден. Установка...');
    const getPipFile = "get-pip.py";
    if (!fs.existsSync(getPipFile)) {
      execSync(`curl -sSL https://bootstrap.pypa.io/get-pip.py -o ${getPipFile}`);
    }
    execSync(`${pyPath} ${getPipFile} --user`);
  }

  console.log(`Используется: ${pyPath}`);

  // 1. Установка зависимостей
  const pip = spawn(pyPath, ['-m', 'pip', 'install', '--user', '-r', 'requirements.txt']);
  pip.stdout.on('data', (d) => process.stdout.write(d));
  pip.stderr.on('data', (d) => process.stderr.write(d));
  
  await new Promise((resolve) => pip.on('close', resolve));

  // 2. Запуск пайплайна
  const py = spawn(pyPath, ['backend/python/main.py'], {
    env: { ...process.env, PYTHON_EXECUTABLE: pyPath }
  });
  py.stdout.on('data', (d) => process.stdout.write(d));
  py.stderr.on('data', (d) => process.stderr.write(d));

  py.on('close', (code) => {
    console.log(`\n--- Проверка завершена (Код: ${code}) ---`);
  });
}

run();
