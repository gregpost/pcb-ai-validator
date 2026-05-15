import fs from 'fs';
import path from 'path';

export function resolveChips(pcbPath: string, netsPath: string, outPath: string): void {
    const cmap: Record<string, string> = {};
    const pcbContent = fs.readFileSync(pcbPath, 'utf8');
    const pcbLines = pcbContent.split(/\r?\n/);
    
    for (const line of pcbLines) {
        if (!line.startsWith('RECORD=Component')) continue;
        const p: Record<string, string> = {};
        line.split('|').forEach(x => {
            if (x.includes('=')) {
                const [k, v] = x.split('=', 2);
                p[k] = v;
            }
        });
        
        const des = p['SOURCEDESIGNATOR'];
        const cid = p['ID'];
        
        if (des && !/^R\d+/.test(des)) {
            let name: string | null = null;
            for (const l2 of pcbLines) {
                if (l2.startsWith('RECORD=Text') && l2.includes(`|COMPONENT=${cid}`) && l2.includes('|COMMENT=True')) {
                    const textPart = l2.split('|').find(x => x.startsWith('TEXT='));
                    if (textPart) {
                        const val = textPart.split('=')[1].trim();
                        if (val && !val.includes('?')) {
                            name = val;
                            break;
                        }
                    }
                }
            }
            if (!name || name.includes('?')) {
                name = p['SOURCELIBREFERENCE'] || des;
                name = name.split(' ')[0];
            }
            cmap[des] = name.split('-')[0].split(' ')[0].split('_')[0].split('(')[0];
        }
    }
    
    const netsContent = fs.readFileSync(netsPath, 'utf8');
    const output: string[] = [];
    
    for (const line of netsContent.split(/\r?\n/)) {
        if (!line.trim() || !line.includes(':')) continue;
        const [nid, conns] = line.split(':', 2);
        const mapped = conns.split(',').map(c => {
            if (!c.includes('_')) return c;
            const [comp, pin] = c.split(/_(.+)/);
            return `${cmap[comp] || comp}_${pin}`;
        });
        output.push(`${nid}:${mapped.join(',')}`);
    }
    
    fs.writeFileSync(outPath, output.join('\n'));
}
