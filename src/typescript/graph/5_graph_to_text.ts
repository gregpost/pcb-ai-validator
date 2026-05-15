import Graph from 'graphology';

function buildChain(G: Graph, node: string, visited: Set<string>, described: Set<string>, commonNets: Set<string>, indent: string = ""): string {
    const label = G.getNodeAttributes(node).label;
    if (commonNets.has(label)) return label;

    visited.add(node);
    described.add(node);

    const branches: string[] = [];
    G.neighbors(node).forEach(v => {
        if (!visited.has(v) && (commonNets.has(G.getNodeAttributes(v).label) || !described.has(v))) {
            branches.push(buildChain(G, v, new Set(visited), described, commonNets, indent));
        }
    });

    if (branches.length === 0) return label;
    if (branches.length === 1) return `${label}-${branches[0]}`;

    const inner = branches.map(b => `${indent}  ${b}`).join(",\n");
    return `${label}(\n${inner}\n${indent})`;
}

export function graphToText(G: Graph, startNode: string, commonNets: Set<string>): string {
    if (G.order === 0) return "NOT_CONNECTED";
    return buildChain(G, startNode, new Set(), new Set(), commonNets);
}
