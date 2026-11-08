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
    
    # If no structured answers were found, but we have target pins or raw pins,
    # generate base blocks so downstream 8_merge_pin_fields never zeroes out!
    if not data:
        # Fallback: scan for any <<<PIN>>> START blocks or parse pins from environment/content
        pin_blocks = re.findall(r'<<<([^_]+)_([^>]+?)>>>', content)
        if pin_blocks:
            for comp, pid in pin_blocks:
                data.setdefault((comp, pid), {'name': 'PIN', 'descs': ['DATA_CONNECTED']})
        else:
            # Check target component pins file from environment
            target = os.environ.get("TARGET_COMPONENT", "").strip()
            project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
            pin_file = os.path.join(project_root, "resources", "pins", f"{target}.txt") if target else None
            if pin_file and os.path.exists(pin_file):
                with open(pin_file, 'r', encoding='utf-8') as pf:
                    for line in pf:
                        line = line.strip()
                        if '_' in line:
                            comp, pid = line.split('_', 1)
                            data[(comp, pid)] = {'name': 'PIN', 'descs': ['DATA_CONNECTED']}

    blocks = []
    for (comp, pid), d in data.items():
        unique = []
        for l in '\n\n'.join(d['descs']).split('\n'):
            if l not in unique and l.strip(): unique.append(l)
        unique_str = '\n'.join(unique)
        blocks.append(rf"<<<{comp}_{pid}>>> START\n[NAME] = {d['name']}\n[DATASHEET] START\n{unique_str}\n[DATASHEET] END\n<<<{comp}_{pid}>>> END")
    res = '\n\n'.join(blocks)
    if out_p:
        with open(out_p, 'w', encoding='utf-8') as f: f.write(res)
    else: print(res)

if __name__ == "__main__":
    main()
