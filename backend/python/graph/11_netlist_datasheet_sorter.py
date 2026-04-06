# file: 11_netlist_datasheet_sorter.py
# Parse netlist and extract matching datasheet sections

import sys     # argv, exit
import re      # findall, DOTALL
from typing import Dict, List # Dict, List

def parse_netlist(netlist_path: str) -> List[List[str]]:
    with open(netlist_path, 'r') as f:
        groups = []
        for line in f:
            line = line.strip()
            if not line: continue
            if ':' in line:
                target, sources = line.split(':', 1)
                groups.append([target.strip()] + [s.strip() for s in sources.split(',')])
            else:
                groups.append([line])
    return groups

def parse_datasheets(datasheets_path: str) -> Dict[str, str]:
    with open(datasheets_path, 'r') as f:
        content = f.read()
    matches = re.findall(r'<<<(.+?)>>> START\n(.*?)<<<\1>>> END', content, re.DOTALL)
    return {tag: block.replace('[', '{').replace(']', '}').strip() for tag, block in matches}

def write_sorted_output(output_path: str, groups: List[List[str]], datasheets: Dict[str, str]) -> None:
    with open(output_path, 'w') as f:
        for group in groups:
            target_pin = group[0]
            f.write(f'<<<{target_pin}>>> START\n')
            for comp in group[1:]:
                if comp in datasheets:
                    f.write(f'[{comp}] START\n{datasheets[comp]}\n[{comp}] END\n')
            f.write(f'<<<{target_pin}>>> END\n\n')

def main():
    if len(sys.argv) != 4: sys.exit(1)
    groups = parse_netlist(sys.argv[1])
    datasheets = parse_datasheets(sys.argv[2])
    write_sorted_output(sys.argv[3], groups, datasheets)

if __name__ == '__main__':
    main()
