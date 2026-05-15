import fs from 'fs';

export function mapComponentNames(pcbPath: string, netsPath: string, outPath: string): void {
    const cmap: Record<string, string> = {};
    const pcbContent = fs.readFileSync(pcbPath, 'utf8');
    
    for (const line of pcbContent.split(/\r?\n/)) {
        if (!line.startsWith('RECORD=Component')) continue;
        const p: Record<string, string> = {};
        line.split('|').forEach(x => {
            if (x.includes('=')) {
                const [k, v] = x.split('=', 2);
                p[k] = v;
            }
        });
        if (p['ID'] && p['SOURCEDESIGNATOR']) {
            cmap[p['ID']] = p['SOURCEDESIGNATOR'];
        }
    }
    
    const netsContent = fs.readFileSync(netsPath, 'utf8');
    const output: string[] = [];
    
    for (const line of netsContent.split(/\r?\n/)) {
        if (!line.trim() || !line.includes(':')) continue;
        const [nid, conns] = line.split(':', 2);
        const mapped = conns.split(',').map(c => {
            if (!c.includes('_')) return c;
            const [cid, pin] = c.split(/_(.+)/);
            return `${cmap[cid] || cid}_${pin}`;
        });
        output.push(`${nid}:${mapped.join(',')}`);
    }
    
    fs.writeFileSync(outPath, output.join('\n'));
}
