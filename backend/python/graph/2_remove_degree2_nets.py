# file: 2_remove_degree2_nets.py
# Remove degree-2 NET nodes and connect neighbors directly

import networkx as nx # read_gml, write_gml
import sys            # argv

def main():
    input_file, output_file = sys.argv[1], sys.argv[2]
    G = nx.read_gml(input_file)
    H = G.copy()
    processed = set()
    while True:
        found = False
        for node in list(H.nodes()):
            if node in processed: continue
            if H.nodes[node].get('type') == 'net' and H.degree(node) == 2:
                n1, n2 = list(H.neighbors(node))
                if not H.has_edge(n1, n2): H.add_edge(n1, n2)
                H.remove_node(node)
                processed.add(node)
                found = True
                break
            processed.add(node)
        if not found: break
    nx.write_gml(H, output_file)

if __name__ == "__main__":
    main()
