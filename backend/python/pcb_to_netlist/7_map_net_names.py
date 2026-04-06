# file: 7_map_net_names.py
# Replace NET IDs with names and sort

import sys # argv, exit

def main():
    if len(sys.argv) != 4: sys.exit(1)
    pcb, nets_f, out_f = sys.argv[1:4]
    nmap = {}
    with open(pcb, 'r') as f:
        for l in f:
            if not l.startswith('RECORD=Net'): continue
            p = {x.split('=')[0]: x.split('=')[1] for x in l.split('|') if '=' in x}
            if 'ID' in p and 'NAME' in p: nmap[p['ID']] = p['NAME'].strip()
    res = []
    with open(nets_f, 'r') as f_in:
        for l in f_in:
            if not l.startswith('NET'): continue
            nid_p, conns = l.strip().split(':', 1)
            res.append(f"{nmap.get(nid_p[3:], nid_p[3:])}:{conns}")
    res.sort()
    with open(out_f, 'w') as f: f.write('\n'.join(res))

if __name__ == "__main__":
    main()
