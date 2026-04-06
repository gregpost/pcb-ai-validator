# file: 8_resolve_chips.py
# Replace designators with actual component names from COMMENT text

import sys # argv, exit
import re  # match

def main():
    if len(sys.argv) != 4: sys.exit(1)
    pcb, nets_f, out_f = sys.argv[1:4]
    cmap = {}
    with open(pcb, 'r') as f:
        for l in f:
            if not l.startswith('RECORD=Component'): continue
            p = {x.split('=')[0]: x.split('=')[1] for x in l.split('|') if '=' in x}
            des, lib, cid = p.get('SOURCEDESIGNATOR'), p.get('SOURCELIBREFERENCE'), p.get('ID')
            if des and not re.match(r'^R\d+', des):
                name = None
                with open(pcb, 'r') as f2:
                    for l2 in f2:
                        if l2.startswith('RECORD=Text') and f'|COMPONENT={cid}' in l2 and '|COMMENT=True' in l2:
                            name = next((x.split('=')[1].strip() for x in l2.split('|') if x.startswith('TEXT=')), None)
                            if name and '?' not in name: break
                if not name or '?' in name:
                    name = next((x.split('=')[1].strip() for x in l.split('|') if x.startswith('SOURCELIBREFERENCE=')), des).split(' ')[0]
                cmap[des] = name.split('-')[0].split(' ')[0].split('_')[0].split('(')[0]
    with open(nets_f, 'r') as f_in, open(out_f, 'w') as f_out:
        for l in f_in:
            if ':' not in l: continue
            nid, conns = l.strip().split(':', 1)
            res = [f"{cmap.get(c.split('_')[0], c.split('_')[0])}_{c.split('_')[1]}" if '_' in c else c for c in conns.split(',')]
            f_out.write(f"{nid}:{','.join(res)}\n")

if __name__ == "__main__":
    main()
