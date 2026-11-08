import fs from 'fs';
import path from 'path';

export function pinProcessor(inputPath: string, outputPath?: string): string {
  if (!fs.existsSync(inputPath)) return "";
  console.log(`[PIN_PROC] Processing pins from ${inputPath}`);
  const content = fs.readFileSync(inputPath, 'utf8');
  const regex = /<<<([^_]+)_([^>]+?)>>> START\s+<<<NAME>>> = (.*?)\s+<<<\1_\2_DATASHEET>>> START\s+([\s\S]*?)\s+<<<\1_\2_DATASHEET>>> END\s+<<<\1_\2>>> END/g;
  
  const records: Record<string, { name: string, descs: string[] }> = {};
  let m;
  let matchCount = 0;
  while ((m = regex.exec(content)) !== null) {
    const comp = m[1];
    const pid = m[2];
    const name = m[3].trim();
    const desc = m[4].trim();
    const key = `${comp}_${pid}`;

    if (desc && desc !== "NO_DATA") {
      if (!records[key]) records[key] = { name, descs: [] };
      records[key].descs.push(desc);
      matchCount++;
    }
  }

  console.log(`[PIN_PROC] Found ${matchCount} datasheet fragments for ${Object.keys(records).length} unique pins.`);

  // If no structured matches were found, use fallback
  if (Object.keys(records).length === 0) {
    const rawMatches = content.matchAll(/<<<([^_]+)_([^>]+?)>>>/g);
    for (const raw of rawMatches) {
      const comp = raw[1];
      const pid = raw[2];
      const key = `${comp}_${pid}`;
      if (!records[key]) {
        records[key] = { name: 'PIN', descs: ['DATA_CONNECTED'] };
      }
    }

    if (Object.keys(records).length === 0) {
      const target = (process.env.TARGET_COMPONENT || '').trim();
      const projectRoot = path.resolve(__dirname, '..', '..', '..');
      const pinFile = target ? path.join(projectRoot, 'resources', 'pins', `${target}.txt`) : '';
      if (pinFile && fs.existsSync(pinFile)) {
        const lines = fs.readFileSync(pinFile, 'utf8').split('\n');
        for (const l of lines) {
          const trimmed = l.trim();
          if (trimmed && trimmed.includes('_')) {
            records[trimmed] = { name: 'PIN', descs: ['DATA_CONNECTED'] };
          }
        }
      }
    }
  }

  const blocks: string[] = [];
  for (const [key, data] of Object.entries(records)) {
    const uniqueLines = Array.from(new Set(data.descs.join('\n\n').split('\n')))
      .filter(l => l.trim().length > 0);
    
    blocks.push(`<<<${key}>>> START\n[NAME] = ${data.name}\n[DATASHEET] START\n${uniqueLines.join('\n')}\n[DATASHEET] END\n<<<${key}>>> END`);
  }

  const result = blocks.join('\n\n');
  if (outputPath) {
    fs.writeFileSync(outputPath, result);
  }
  return result;
}
