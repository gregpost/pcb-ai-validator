import fs from 'fs';
import path from 'path';

export function largeFileSlicer(
  inputPath: string, 
  templatePath: string, 
  outputsFolder: string, 
  fragmentsFolder: string, 
  additionalDataPath?: string,
  linesPerFragment: number = 300,
  overlap: number = 0,
  wordCount: number = 0
): void {
  if (!fs.existsSync(inputPath)) {
    console.log(`[SLICER] Input file not found: ${inputPath}`);
    return;
  }
  const lines = fs.readFileSync(inputPath, 'utf8').split(/\r?\n/);
  console.log(`[SLICER] Processing ${path.basename(inputPath)} (${lines.length} lines)`);
  const template = fs.readFileSync(templatePath, 'utf8');
  const additional = (additionalDataPath && fs.existsSync(additionalDataPath)) 
    ? fs.readFileSync(additionalDataPath, 'utf8').trim() 
    : "";

  if (fs.existsSync(outputsFolder)) fs.rmSync(outputsFolder, { recursive: true, force: true });
  if (fs.existsSync(fragmentsFolder)) fs.rmSync(fragmentsFolder, { recursive: true, force: true });
  fs.mkdirSync(outputsFolder, { recursive: true });
  fs.mkdirSync(fragmentsFolder, { recursive: true });

  let currentLine = 0;
  let step = 1;

  while (currentLine < lines.length) {
    const endLine = Math.min(currentLine + linesPerFragment, lines.length);
    const chunk = lines.slice(currentLine, endLine).join('\n');
    
    const payload = template
      .replace('#1', chunk)
      .replace('#2', additional)
      .replace('#3', (currentLine + 1).toString())
      .replace('#4', endLine.toString())
      .replace('#5', lines.length.toString())
      .replace('#6', step.toString())
      .replace('#7', wordCount.toString());

    fs.writeFileSync(path.join(fragmentsFolder, `fragment_${step}.txt`), chunk);
    fs.writeFileSync(path.join(outputsFolder, `prompt_step_${step}.txt`), payload);

    if (endLine === lines.length) break;
    currentLine += Math.max(linesPerFragment - overlap, 1);
    step++;
  }
  console.log(`[SLICER] Generated ${step} prompt fragments.`);
}
