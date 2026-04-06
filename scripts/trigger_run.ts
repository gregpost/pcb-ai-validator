import http from 'http';

const BASE_URL = 'http://localhost:3000';

async function request(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    http.get(`${BASE_URL}${path}`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function run() {
  console.log('--- Автоматический запуск пайплайна через API ---');
  
  try {
    // 1. Нажимаем "кнопку" (вызываем /run)
    await request('/run');
    console.log('Запрос на запуск отправлен. Начинаю опрос логов...\n');

    // 2. Опрашиваем логи
    let lastLog = '';
    const poll = setInterval(async () => {
      try {
        const logs = await request('/logs');
        if (logs !== lastLog) {
          // Выводим только новые строки
          const newContent = logs.substring(lastLog.length);
          process.stdout.write(newContent);
          lastLog = logs;
        }

        if (logs.includes('PROCESSING COMPLETED')) {
          clearInterval(poll);
          console.log('\n--- Проверка завершена ---');
          process.exit(0);
        }
      } catch (e) {
        console.error('Ошибка при опросе логов:', e);
      }
    }, 1000);

  } catch (e) {
    console.error('Не удалось запустить пайплайн:', e);
    process.exit(1);
  }
}

run();
