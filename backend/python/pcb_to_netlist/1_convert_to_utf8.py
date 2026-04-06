# file: 1_convert_to_utf8.py
# Try common encodings and convert input file to UTF-8

import sys # argv, exit

def main():
    if len(sys.argv) != 3: sys.exit(1)
    in_f, out_f = sys.argv[1], sys.argv[2]
    for enc in ['cp1251', 'cp1252', 'latin-1', 'utf-8', 'utf-16', 'ascii']:
        try:
            with open(in_f, 'r', encoding=enc) as f:
                content = f.read()
                break
        except: continue
    else:
        with open(in_f, 'rb') as f: content = f.read().decode('utf-8', errors='ignore')
    with open(out_f, 'w', encoding='utf-8') as f: f.write(content)

if __name__ == "__main__":
    main()
