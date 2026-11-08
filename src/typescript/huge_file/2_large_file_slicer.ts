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
    // Skip leading blank lines
    while (currentLine < lines.length && lines[currentLine].trim() === '') {
      currentLine++;
    }
    if (currentLine >= lines.length) break;

    const startLine = currentLine;
    const nominalEnd = Math.min(startLine + linesPerFragment, lines.length);

    let endLine = nominalEnd;
    let nextStart = nominalEnd;

    if (nominalEnd < lines.length) {
      const minBoundary = Math.max(startLine + 15, startLine + Math.floor(linesPerFragment * 0.65));
      const maxBoundary = Math.min(lines.length, startLine + Math.floor(linesPerFragment * 1.35));
      let foundBoundary: number | null = null;
      let foundNextStart: number | null = null;

      // 1. Search backwards from nominalEnd for an empty line or heading
      for (let i = nominalEnd; i >= minBoundary; i--) {
        const line = lines[i].trim();
        if (line === '') {
          foundBoundary = i;
          let nStart = i + 1;
          while (nStart < lines.length && lines[nStart].trim() === '') {
            nStart++;
          }
          foundNextStart = nStart;
          break;
        } else if (line.startsWith('#') || /^\d+(\.\d+)+\b/.test(line)) {
          if (i > startLine + 15) {
            foundBoundary = i;
            foundNextStart = i;
            break;
          }
        }
      }

      // 2. Search forwards if not found
      if (foundBoundary === null) {
        for (let i = nominalEnd + 1; i < maxBoundary; i++) {
          const line = lines[i].trim();
          if (line === '') {
            foundBoundary = i;
            let nStart = i + 1;
            while (nStart < lines.length && lines[nStart].trim() === '') {
              nStart++;
            }
            foundNextStart = nStart;
            break;
          } else if (line.startsWith('#') || /^\d+(\.\d+)+\b/.test(line)) {
            foundBoundary = i;
            foundNextStart = i;
            break;
          }
        }
      }

      if (foundBoundary !== null && foundNextStart !== null) {
        endLine = foundBoundary;
        nextStart = foundNextStart;
      }
    }

    const chunk = lines.slice(startLine, endLine).join('\n').trim();
    if (!chunk) {
      currentLine = nextStart;
      continue;
    }
    
    let renderedTemplate = template;
    const targetComp = (process.env.TARGET_COMPONENT || '').trim();
    if (targetComp) {
      renderedTemplate = renderedTemplate.replace(/AR9331/g, targetComp);
    }

    const payload = renderedTemplate
      .replace('#1', chunk)
      .replace('#2', additional)
      .replace('#3', (startLine + 1).toString())
      .replace('#4', endLine.toString())
      .replace('#5', lines.length.toString())
      .replace('#6', step.toString())
      .replace('#7', wordCount.toString());

    fs.writeFileSync(path.join(fragmentsFolder, `fragment_${step}.txt`), chunk);
    fs.writeFileSync(path.join(outputsFolder, `prompt_step_${step}.txt`), payload);

    currentLine = nextStart;
    step++;
  }
  console.log(`[SLICER] Generated ${step - 1} prompt fragments.`);
}
