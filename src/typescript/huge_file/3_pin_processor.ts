import fs from 'fs';

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
