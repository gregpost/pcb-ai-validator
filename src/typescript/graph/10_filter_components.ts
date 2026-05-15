import fs from 'fs';

export function filterComponents(inputPath: string, outputPath: string): void {
  if (!fs.existsSync(inputPath)) return;
  const content = fs.readFileSync(inputPath, 'utf8');
  const lines = content.split(/\r?\n/);
  const outputLines: string[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    let prefix: string | null = null;
    let substrings: string[] = [];

    if (line.includes(':')) {
      const parts = line.split(':');
      prefix = parts[0];
      substrings = parts[1].split(',').map(s => s.trim()).filter(s => s);
    } else {
      substrings = line.split(',').map(s => s.trim()).filter(s => s);
    }

    const filtered = substrings.filter(s => (s.match(/_/g) || []).length === 1 && s !== prefix);
    
    if (prefix) {
      outputLines.push(`${prefix}:${filtered.join(',')}`);
    } else {
      outputLines.push(filtered.join(','));
    }
  }
  fs.writeFileSync(outputPath, outputLines.join('\n'));
}
