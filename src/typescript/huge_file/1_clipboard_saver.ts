import fs from 'fs';
import path from 'path';

export function clipboardSaver(target: string): void {
  const dir = path.dirname(target);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(target, '');
  console.log(`Clipboard saver initialized (headless mode) for ${target}`);
}
