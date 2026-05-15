import fs from 'fs';

export function rmLines2(inPath: string, outPath: string): void {
    const black = ["RECORD=Arc", "RECORD=Track", "RECORD=Connection", "RECORD=Via", "RECORD=Region", "RECORD=ComponentBody", "RECORD=Board"];
    const content = fs.readFileSync(inPath, 'utf8');
    const filtered = content.split(/\r?\n/)
        .filter(l => !black.some(b => l.includes(b)))
        .join('\n');
    fs.writeFileSync(outPath, filtered);
}
