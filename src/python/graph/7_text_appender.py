# file: 7_text_appender.py
# Appends content from input file to output file with tags

import sys # argv

def main():
    if len(sys.argv) < 4: return
    pin, in_f, out_f = sys.argv[1:4]
    try:
        with open(in_f, "r") as f: content = f.read()
    except: return
    with open(out_f, "a") as f:
        f.write(f"\n<<<{pin}>>> START\n{content}")
        if not content.endswith('\n'): f.write('\n')
        f.write(f"<<<{pin}>>> END\n")

if __name__ == "__main__":
    main()
