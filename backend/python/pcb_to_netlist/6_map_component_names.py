# file: 6_map_component_names.py
# Replace component IDs with designators in nets

import sys # argv, exit

def main():
    if len(sys.argv) != 4: sys.exit(1)
    pcb, nets_f, out_f = sys.argv[1:4]
    cmap = {}
    with open(pcb, 'r') as f:
        for l in f:
            if not l.startswith('RECORD=Component'): continue
            p = {x.split('=')[0]: x.split('=')[1] for x in l.split('|') if '=' in x}
            if 'ID' in p and 'SOURCEDESIGNATOR' in p: cmap[p['ID']] = p['SOURCEDESIGNATOR']
    with open(nets_f, 'r') as f_in, open(out_f, 'w') as f_out:
        for l in f_in:
            if not l.strip() or ':' not in l: continue
            nid, conns = l.strip().split(':', 1)
            mapped = []
            for c in conns.split(','):
                if '_' not in c: continue
                cid, pin = c.split('_', 1)
                mapped.append(f"{cmap.get(cid, cid)}_{pin}")
            f_out.write(f"{nid}:{','.join(mapped)}\n")

if __name__ == "__main__":
    main()
