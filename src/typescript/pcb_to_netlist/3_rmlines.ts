import fs from 'fs';

export function rmLines(inPath: string, outPath: string): void {
    const subs = ["NET=", "COMPONENT=", "SOURCEDESIGNATOR=", "ID=", "NAME=", "SOURCELIBREFERENCE=", "COMMENT="];
    const content = fs.readFileSync(inPath, 'utf8');
    const filtered = content.split(/\r?\n/)
        .filter(l => subs.some(s => l.includes(s)))
        .join('\n');
    fs.writeFileSync(outPath, filtered);
}
