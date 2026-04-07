# file: 9_circuit_parser.py
# Extract tagged sections and replace separators with commas

import sys # argv, exit
import re  # findall, sub, DOTALL

def main():
    if len(sys.argv) != 3: sys.exit(1)
    in_p, out_p = sys.argv[1], sys.argv[2]
    with open(in_p, 'r') as f: content = f.read()
    matches = re.findall(r'<<<(\w+)>>> START\n(.*?)<<<\1>>> END', content, re.DOTALL)
    res = []
    for tag, block in matches:
        block = re.sub(r'\s+', '', block)
        for c in '\n()-': block = block.replace(c, ',')
        res.append(f"{tag}:{re.sub(r',+', ',', block).strip(',')}")
    with open(out_p, 'w') as f: f.write('\n'.join(res))

if __name__ == "__main__":
    main()
