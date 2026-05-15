import fs from 'fs';

export function netlistDatasheetSorter(netlistPath: string, datasheetsPath: string, outputPath: string): void {
  if (!fs.existsSync(netlistPath) || !fs.existsSync(datasheetsPath)) return;
  const netlist = fs.readFileSync(netlistPath, 'utf8').split(/\r?\n/).filter(l => l.trim()).map(line => {
    if (line.includes(':')) {
      const [target, sources] = line.split(':');
      return [target.trim(), ...sources.split(',').map(s => s.trim())];
    }
    return [line.trim()];
  });

  const datasheetsContent = fs.readFileSync(datasheetsPath, 'utf8');
  const datasheets: Record<string, string> = {};
  const matches = datasheetsContent.matchAll(/<<<(.+?)>>> START\n([\s\S]*?)<<<\1>>> END/g);
  for (const m of matches) {
    datasheets[m[1]] = m[2].replace(/\[/g, '{').replace(/\]/g, '}').trim();
  }

  let output = "";
  for (const group of netlist) {
    const targetPin = group[0];
    output += `<<<${targetPin}>>> START\n`;
    for (let i = 1; i < group.length; i++) {
      const comp = group[i];
      if (datasheets[comp]) {
        output += `[${comp}] START\n${datasheets[comp]}\n[${comp}] END\n`;
      }
    }
    output += `<<<${targetPin}>>> END\n\n`;
  }
  fs.writeFileSync(outputPath, output);
}
