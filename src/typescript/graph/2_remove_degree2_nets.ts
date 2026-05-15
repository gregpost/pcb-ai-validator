import fs from 'fs';
import Graph from 'graphology';

export function removeDegree2Nets(inputPath: string, outputPath: string): Graph {
    console.log(`[GRAPH] 2. Removing degree-2 nets from ${path.basename(inputPath)}`);
    const G = new Graph();
    if (!fs.existsSync(inputPath)) return G;
    G.import(JSON.parse(fs.readFileSync(inputPath, 'utf8')));
    
    const H = G.copy();
    let removedCount = 0;
    while (true) {
        let found = false;
        H.forEachNode((node, attr) => {
            if (found) return;
            if (attr.type === 'net' && H.degree(node) === 2) {
                const neighbors = H.neighbors(node);
                const n1 = neighbors[0];
                const n2 = neighbors[1];
                if (!H.hasEdge(n1, n2)) H.addEdge(n1, n2);
                H.dropNode(node);
                found = true;
                removedCount++;
            }
        });
        if (!found) break;
    }
    console.log(`[GRAPH] Removed ${removedCount} degree-2 nets.`);
    fs.writeFileSync(outputPath, JSON.stringify(H.export()));
    return H;
}
