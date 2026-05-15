import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

export async function pdfToMd(inputPath: string, outputPath: string, minLineLen: number = 10): Promise<void> {
  const dataBuffer = fs.readFileSync(inputPath);
  const data = await pdf(dataBuffer);
  console.log(`[PDF] Extracted ${data.numpages} pages from ${path.basename(inputPath)}`);
  const lines = data.text.split(/\r?\n/)
    .map((l: string) => l.trim())
    .filter((l: string) => l.length >= minLineLen);
  
  fs.writeFileSync(outputPath, lines.join('\n'));
}
