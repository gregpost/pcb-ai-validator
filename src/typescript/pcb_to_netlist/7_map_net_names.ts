import fs from 'fs';

export function mapNetNames(pcbPath: string, netsPath: string, outPath: string): void {
    const nmap: Record<string, string> = {};
    const pcbContent = fs.readFileSync(pcbPath, 'utf8');
    
    for (const line of pcbContent.split(/\r?\n/)) {
        if (!line.startsWith('RECORD=Net')) continue;
        const p: Record<string, string> = {};
        line.split('|').forEach(x => {
            if (x.includes('=')) {
                const [k, v] = x.split('=', 2);
                p[k] = v;
            }
        });
        if (p['ID'] && p['NAME']) {
            nmap[p['ID']] = p['NAME'].trim();
        }
    }
    
    const netsLines = fs.readFileSync(netsPath, 'utf8').split(/\r?\n/);
    const res: string[] = [];
    
    for (const line of netsLines) {
        if (!line.startsWith('NET')) continue;
        const [nid_p, conns] = line.split(':', 2);
        const nid = nid_p.substring(3);
        res.push(`${nmap[nid] || nid}:${conns}`);
    }
    
    res.sort();
    fs.writeFileSync(outPath, res.join('\n'));
}
