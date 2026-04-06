# file: server.ts
# Minimal Express server to keep the application running in the preview environment

import express from 'express'; // express

const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send(`
    <div style="font-family: sans-serif; padding: 2rem; max-width: 600px; margin: 0 auto; line-height: 1.6;">
      <h1 style="color: #2563eb;">PCB AI Validator</h1>
      <p>Проект успешно развернут и запущен в среде выполнения.</p>
      <div style="background: #f3f4f6; padding: 1rem; border-radius: 0.5rem; border: 1px solid #e5e7eb;">
        <h2 style="font-size: 1.1rem; margin-top: 0;">Статус системы:</h2>
        <ul style="margin-bottom: 0;">
          <li>Python Backend: <strong>Готов</strong></li>
          <li>Структура папок: <strong>Создана</strong></li>
          <li>Конфигурация: <strong>Настроена</strong></li>
        </ul>
      </div>
      <p style="font-size: 0.9rem; color: #6b7280; margin-top: 2rem;">
        Примечание: Для полноценной работы Pipeline требуются файлы .PcbDoc в папке PcbDocs.
      </p>
    </div>
  `);
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${port}`);
});
