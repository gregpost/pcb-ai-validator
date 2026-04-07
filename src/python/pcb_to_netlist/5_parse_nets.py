# file: 5_parse_nets.py
# Extract net connections from PcbDoc to nets_raw.txt

import sys # argv, exit

def main():
    if len(sys.argv) != 3: sys.exit(1)
    nets = {}
    with open(sys.argv[1], 'r') as f:
        for l in f:
            if not l.startswith('RECORD=Pad'): continue
            p = {x.split('=')[0]: x.split('=')[1] for x in l.split('|') if '=' in x}
            nid, cid, name = p.get('NET'), p.get('COMPONENT'), p.get('NAME')
            if nid and cid and name: nets.setdefault(nid, []).append(f"{cid}_{name}")
    with open(sys.argv[2], 'w') as f:
        for nid, conns in nets.items(): f.write(f"NET{nid}:{','.join(conns)}\n")

if __name__ == "__main__":
    main()
