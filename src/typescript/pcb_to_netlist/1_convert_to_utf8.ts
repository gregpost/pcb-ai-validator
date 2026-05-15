import fs from 'fs';

export function convertToUtf8(inPath: string, outPath: string): void {
    const encodings = ['utf8', 'latin1', 'ascii'];
    let content: string | null = null;
    
    for (const enc of encodings) {
        try {
            content = fs.readFileSync(inPath, enc as BufferEncoding);
            break;
        } catch (e) { continue; }
    }
    
    if (content === null) {
        content = fs.readFileSync(inPath).toString('utf8'); // fallback
    }
    
    fs.writeFileSync(outPath, content, 'utf8');
}
