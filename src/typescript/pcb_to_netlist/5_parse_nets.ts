import fs from 'fs';

export function parseNets(inPath: string, outPath: string): void {
    const nets: Record<string, string[]> = {};
    const content = fs.readFileSync(inPath, 'utf8');
    const lines = content.split(/\r?\n/);
    
    for (const line of lines) {
        if (!line.startsWith('RECORD=Pad')) continue;
        const p: Record<string, string> = {};
        line.split('|').forEach(x => {
            if (x.includes('=')) {
                const [k, v] = x.split('=', 2);
                p[k] = v;
            }
        });
        
        const nid = p['NET'];
        const cid = p['COMPONENT'];
        const name = p['NAME'];
        
        if (nid && cid && name) {
            if (!nets[nid]) nets[nid] = [];
            nets[nid].push(`${cid}_${name}`);
        }
    }
    
    const output = Object.entries(nets)
        .map(([nid, conns]) => `NET${nid}:${conns.join(',')}`)
        .join('\n');
    
    fs.writeFileSync(outPath, output);
}
