import https from 'https';
import fs from 'fs';
import { execSync } from 'child_process';

async function test() {
  console.log('--- Тест загрузки get-pip.py ---');
  const file = fs.createWriteStream("get-pip.py");
  https.get("https://bootstrap.pypa.io/get-pip.py", function(response) {
    response.pipe(file);
    file.on('finish', function() {
      file.close();
      console.log('Файл загружен. Пробую запустить...');
      try {
        const out = execSync('python3 get-pip.py --user', { stdio: 'pipe' }).toString();
        console.log('[OK] get-pip.py: ' + out.split('\n')[0]);
      } catch (e: any) {
        console.log('[FAIL] get-pip.py: ' + e.message.split('\n')[0]);
        console.log('Stderr: ' + e.stderr?.toString());
      }
    });
  }).on('error', (err) => {
    console.log('[ERROR] Загрузка не удалась: ' + err.message);
  });
}

test();
