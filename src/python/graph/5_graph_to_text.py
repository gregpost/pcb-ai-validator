# file: 5_graph_to_text.py
# Convert GML graph to compact textual chain description

import re  # findall, search, sub, M, S
import sys # argv, exit

class Graph:
    def __init__(self):
        self.nodes, self.adj = {}, {}
    def add_node(self, nid, label):
        self.nodes[nid] = label
        self.adj.setdefault(nid, [])
    def add_edge(self, a, b):
        self.adj[a].append(b); self.adj[b].append(a)
    def find_id(self, label):
        return next((i for i, l in self.nodes.items() if l == label), None)

def parse_gml(path):
    g = Graph()
    try: text = open(path, "r", encoding="utf-8").read()
    except: return None
    if text.strip() == "NOT_CONNECTED": return None
    for b in re.findall(r'node\s*\[(.*?)\]', text, re.S):
        g.add_node(int(re.search(r'id\s+(\d+)', b).group(1)), re.search(r'label\s+"([^"]+)"', b).group(1))
    for b in re.findall(r'edge\s*\[(.*?)\]', text, re.S):
        g.add_edge(int(re.search(r'source\s+(\d+)', b).group(1)), int(re.search(r'target\s+(\d+)', b).group(1)))
    return g

def build_chain(g, node, visited, described, common_nets, indent=""):
    label = g.nodes[node]
    if label in common_nets: return label
    visited.add(node); described.add(node)
    branches = [build_chain(g, n, visited.copy(), described, common_nets, indent) 
                for n in g.adj[node] if n not in visited and (g.nodes[n] in common_nets or n not in described)]
    if not branches: return label
    if len(branches) == 1: return f"{label}-{branches[0]}"
    inner = re.sub(r"^", indent + "  ", ",\n".join(branches), flags=re.M)
    return f"{label}(\n{inner}\n{indent})"

def main():
    if len(sys.argv) < 5: sys.exit(1)
    start, input_f, output_f, common_f = sys.argv[1:5]
    with open(common_f, 'r') as f: common_nets = set(l.strip() for l in f if l.strip())
    g = parse_gml(input_f)
    if not g:
        with open(output_f, "w", encoding="utf-8") as f: f.write("NOT_CONNECTED")
        return
    res = build_chain(g, g.find_id(start), set(), set(), common_nets)
    with open(output_f, "w", encoding="utf-8") as f: f.write(res)

if __name__ == "__main__":
    main()
