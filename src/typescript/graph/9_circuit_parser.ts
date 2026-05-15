import fs from 'fs';

export function circuitParser(inputPath: string, outputPath: string): void {
  if (!fs.existsSync(inputPath)) return;
  const content = fs.readFileSync(inputPath, 'utf8');
  const matches = content.matchAll(/<<<(\w+)>>> START\n([\s\S]*?)<<<\1>>> END/g);
  const results: string[] = [];

  for (const m of matches) {
    let block = m[2].replace(/\s+/g, '');
    ['\n', '(', ')', '-'].forEach(c => block = block.split(c).join(','));
    results.push(`${m[1]}:${block.replace(/,+/g, ',').replace(/(^,|,$)/g, '')}`);
  }
  fs.writeFileSync(outputPath, results.join('\n'));
}
