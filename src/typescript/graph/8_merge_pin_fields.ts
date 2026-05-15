import fs from 'fs';

export function mergePinFields(mainPath: string, addPath: string, outputPath: string, tag?: string): void {
  if (!fs.existsSync(mainPath) || !fs.existsSync(addPath)) return;
  
  const parse = (filePath: string) => {
    const content = fs.readFileSync(filePath, 'utf8');
    const data: Record<string, string> = {};
    const matches = content.matchAll(/<<<(.+?)>>> START\n([\s\S]*?)\n<<<.+?>>> END/g);
    for (const m of matches) {
      data[m[1]] = m[2].trim();
    }
    return data;
  };

  const mainContent = fs.readFileSync(mainPath, 'utf8');
  const mainData = parse(mainPath);
  const addData = parse(addPath);

  let result = mainContent;

  for (const [pin, text] of Object.entries(mainData)) {
    if (addData[pin]) {
      const insertion = tag ? `[${tag}] START\n${addData[pin]}\n[${tag}] END` : addData[pin];
      result = result.replace(`<<<${pin}>>> END`, `${insertion}\n<<<${pin}>>> END`);
    } else {
      const regex = new RegExp(`<<<${pin}>>> START\n[\\s\\S]*?\n<<<${pin}>>> END`, 'g');
      result = result.replace(regex, '');
    }
  }

  fs.writeFileSync(outputPath, result.replace(/\n\s*\n+/g, '\n\n').trim());
}
