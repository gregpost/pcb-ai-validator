# file: 3_pin_processor.py
# Process component PIN blocks, merge and clean descriptions

import sys # argv, exit
import re  # findall, DOTALL
import os  # remove, exists

def main():
    if len(sys.argv) < 2: sys.exit(1)
    in_p, out_p = sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None
    if out_p and os.path.exists(out_p): os.remove(out_p)
    with open(in_p, 'r', encoding='utf-8') as f: content = f.read()
    matches = re.findall(r'<<<([^_]+)_([^>]+?)>>> START\s+<<<NAME>>> = (.*?)\s+<<<\1_\2_DATASHEET>>> START\s+(.*?)\s+<<<\1_\2_DATASHEET>>> END\s+<<<\1_\2>>> END', content, re.DOTALL)
    data = {}
    for comp, pid, name, desc in matches:
        if desc.strip() and desc.strip() != "NO_DATA":
            data.setdefault((comp, pid), {'name': name.strip(), 'descs': []})['descs'].append(desc.strip())
    blocks = []
    for (comp, pid), d in data.items():
        unique = []
        for l in '\n\n'.join(d['descs']).split('\n'):
            if l not in unique and l.strip(): unique.append(l)
        blocks.append(f"<<<{comp}_{pid}>>> START\n[NAME] = {d['name']}\n[DATASHEET] START\n{'\n'.join(unique)}\n[DATASHEET] END\n<<<{comp}_{pid}>>> END")
    res = '\n\n'.join(blocks)
    if out_p:
        with open(out_p, 'w', encoding='utf-8') as f: f.write(res)
    else: print(res)

if __name__ == "__main__":
    main()
