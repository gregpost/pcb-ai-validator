# file: 4_get_branch.py
# Extract graph branch starting from node, stopping at chips/common nets

import networkx as nx # read_gml, write_gml
import sys            # argv, exit

def is_chip(G, node):
    if G.nodes[node].get('type') != 'component': return False
    return sum(1 for c in node if c.isalpha() and c.isascii()) > 1

def traverse(G, node, common_nets, max_nodes, visited=None):
    if visited is None: visited = set()
    if max_nodes > 0 and len(visited) >= max_nodes: return []
    visited.add(node)
    edges = []
    for nbr in G.neighbors(node):
        if nbr not in visited:
            if max_nodes > 0 and len(visited) >= max_nodes: break
            edges.append((node, nbr))
            if nbr not in common_nets and not is_chip(G, nbr):
                edges.extend(traverse(G, nbr, common_nets, max_nodes, visited))
    return edges

def main():
    if len(sys.argv) < 5: sys.exit(1)
    start, input_gml, output_gml, common_file = sys.argv[1:5]
    max_nodes = int(sys.argv[5]) if len(sys.argv) > 5 else 25
    with open(common_file, 'r') as f:
        common_nets = set(line.strip() for line in f if line.strip())
    try: G = nx.read_gml(input_gml)
    except FileNotFoundError: sys.exit(0)
    if start not in G:
        with open(output_gml, "w") as f: f.write("NOT_CONNECTED")
        sys.exit(1)
    edges = traverse(G, start, common_nets, max_nodes)
    H = nx.Graph()
    H.add_edges_from(edges)
    for node in H.nodes():
        if node in G.nodes: H.nodes[node].update(G.nodes[node])
    nx.write_gml(H, output_gml)

if __name__ == "__main__":
    main()
