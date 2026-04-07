# file: 8_merge_pin_fields.py
# Merge additional pin data into main pin data file with optional tagging

import sys # argv, exit
import re  # findall, sub, DOTALL

def parse(filename):
    with open(filename, 'r') as f:
        return {p: l.strip() for p, l in re.findall(r'<<<(.+?)>>> START\n(.*?)\n<<<.+?>>> END', f.read(), re.DOTALL)}

def main():
    if len(sys.argv) < 4: sys.exit(1)
    in_f, add_f, out_f = sys.argv[1:4]
    tag = sys.argv[4] if len(sys.argv) > 4 else None
    main_d, add_d = parse(in_f), parse(add_f)
    with open(in_f, 'r') as f: res = f.read()
    for pin, text in main_d.items():
        if pin in add_d:
            ins = f"[{tag}] START\n{add_d[pin]}\n[{tag}] END" if tag else add_d[pin]
            res = res.replace(f'<<<{pin}>>> END', f"{ins}\n<<<{pin}>>> END")
        else:
            res = re.sub(rf'<<<{pin}>>> START\n.*?\n<<<{pin}>>> END', '', res, flags=re.DOTALL)
    with open(out_f, 'w') as f: f.write(re.sub(r'\n\s*\n+', '\n\n', res).strip())

if __name__ == '__main__':
    main()
