import fs from 'fs';
import Graph from 'graphology';

function isChip(G: Graph, node: string): boolean {
    if (G.getNodeAttributes(node).type !== 'component') return false;
    return (node.match(/[a-zA-Z]/g)?.length || 0) > 1;
}

function traverse(G: Graph, node: string, commonNets: Set<string>, maxNodes: number, visited: Set<string>): { u: string, v: string }[] {
    if (maxNodes > 0 && visited.size >= maxNodes) return [];
    visited.add(node);
    const edges: { u: string, v: string }[] = [];
    
    G.neighbors(node).forEach(nbr => {
        if (!visited.has(nbr)) {
            if (maxNodes > 0 && visited.size >= maxNodes) return;
            edges.push({ u: node, v: nbr });
            if (!commonNets.has(nbr) && !isChip(G, nbr)) {
                edges.push(...traverse(G, nbr, commonNets, max_nodes, visited));
            }
        }
    });
    return edges;
}

// Keeping version compatible with what 7_text_appender expects but also mirroring 4_get_branch.py logic
export function getBranch(G: Graph, startNode: string, commonNets: Set<string>, maxNodes: number = 25): Graph {
    const H = new Graph();
    if (!G.hasNode(startNode)) return H;

    const visited = new Set<string>();
    const edges = traverse(G, startNode, commonNets, max_nodes, visited);
    
    H.addNode(startNode, G.getNodeAttributes(startNode));
    edges.forEach(e => {
        if (!H.hasNode(e.u)) H.addNode(e.u, G.getNodeAttributes(e.u));
        if (!H.hasNode(e.v)) H.addNode(e.v, G.getNodeAttributes(e.v));
        H.addEdge(e.u, e.v);
    });
    
    return H;
}
