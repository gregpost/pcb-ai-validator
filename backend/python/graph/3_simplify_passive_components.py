# file: 3_simplify_passive_components.py
# Simplify graph: replace passive component pins with component node

import networkx as nx # read_gml, write_gml
import re            # match
import sys           # argv

def is_passive(node):
    return re.match(r'^[RCL]\d+', node) is not None

def main():
    input_file, output_file = sys.argv[1], sys.argv[2]
    G = nx.read_gml(input_file)
    H = G.copy()
    to_simplify = {}
    for node in G.nodes():
        if is_passive(node):
            pins = [nbr for nbr in G.neighbors(node) if nbr.startswith(f"{node}_")]
            if len(pins) == 2: to_simplify[node] = pins
    for comp, pins in to_simplify.items():
        n1s, n2s = [n for n in G.neighbors(pins[0]) if n != comp], [n for n in G.neighbors(pins[1]) if n != comp]
        if n1s and n2s:
            for n in n1s: H.add_edge(comp, n)
            for n in n2s: H.add_edge(comp, n)
            H.remove_node(pins[0]); H.remove_node(pins[1])
    nx.write_gml(H, output_file)

if __name__ == "__main__":
    main()
