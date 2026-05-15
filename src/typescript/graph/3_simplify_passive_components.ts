import fs from 'fs';
import Graph from 'graphology';

export function simplifyPassiveComponents(inputPath: string, outputPath: string): Graph {
    console.log(`[GRAPH] 3. Simplifying passive components (R, C, L) in ${path.basename(inputPath)}`);
    const G = new Graph();
    if (!fs.existsSync(inputPath)) return G;
    G.import(JSON.parse(fs.readFileSync(inputPath, 'utf8')));
    
    const H = G.copy();
    const passives: string[] = [];
    H.forEachNode(node => {
        if (/^[RCL]\d+/.test(node)) {
            const pins = H.neighbors(node).filter(nbr => nbr.startsWith(`${node}_`));
            if (pins.length === 2) {
                passives.push(node);
            }
        }
    });

    console.log(`[GRAPH] Found ${passives.length} candidate passive components.`);
    let simplifiedCount = 0;
    for (const comp of passives) {
        const pins = H.neighbors(comp).filter(nbr => nbr.startsWith(`${comp}_`));
        const p1 = pins[0];
        const p2 = pins[1];
        const neighbors1 = H.neighbors(p1).filter(n => n !== comp);
        const neighbors2 = H.neighbors(p2).filter(n => n !== comp);

        if (neighbors1.length > 0 && neighbors2.length > 0) {
            neighbors1.forEach(n => H.addEdge(comp, n));
            neighbors2.forEach(n => H.addEdge(comp, n));
            H.dropNode(p1);
            H.dropNode(p2);
            simplifiedCount++;
        }
    }
    console.log(`[GRAPH] Simplified ${simplifiedCount} passive components.`);
    fs.writeFileSync(outputPath, JSON.stringify(H.export()));
    return H;
}
