import fs from 'fs';
import Graph from 'graphology';

export function netlistToGraph(inputPath: string, outputPath: string): Graph {
    console.log(`[GRAPH] 1. Converting netlist to graph: ${path.basename(inputPath)}`);
    const G = new Graph();
    if (!fs.existsSync(inputPath)) {
        console.log(`[WARNING] Netlist file not found: ${inputPath}`);
        return G;
    }
    
    const content = fs.readFileSync(inputPath, 'utf8');
    const lines = content.split(/\r?\n/);
    console.log(`[GRAPH] Read ${lines.length} lines from netlist.`);

    for (const line of lines) {
        if (!line.trim() || !line.includes(':')) continue;
        const [net, nodeStr] = line.split(':');
        const nodes = nodeStr.split(',');

        if (!G.hasNode(net)) G.addNode(net, { type: 'net', label: net });

        for (const n of nodes) {
            if (n.includes('_')) {
                const lastUnderscore = n.lastIndexOf('_');
                const comp = n.substring(0, lastUnderscore);
                const pin = n.substring(lastUnderscore + 1);
                const pinNode = `${comp}_${pin}`;

                if (!G.hasNode(comp)) G.addNode(comp, { type: 'component', label: comp });
                if (!G.hasNode(pinNode)) G.addNode(pinNode, { type: 'pin', label: pinNode });

                if (!G.hasEdge(comp, pinNode)) G.addEdge(comp, pinNode);
                if (!G.hasEdge(pinNode, net)) G.addEdge(pinNode, net);
            } else {
                if (!G.hasNode(n)) G.addNode(n, { type: 'component', label: n });
                if (!G.hasEdge(n, net)) G.addEdge(n, net);
            }
        }
    }

    fs.writeFileSync(outputPath, JSON.stringify(G.export()));
    return G;
}
