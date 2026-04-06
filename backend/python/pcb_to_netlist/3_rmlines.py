# file: 3_rmlines.py
# Filter lines containing specific netlist substrings

import sys # argv, exit

def main():
    if len(sys.argv) != 3: sys.exit(1)
    subs = ["NET=", "COMPONENT=", "SOURCEDESIGNATOR=", "ID=", "NAME=", "SOURCELIBREFERENCE=", "COMMENT="]
    with open(sys.argv[1], "r", encoding="utf-8", errors="ignore") as f_in:
        with open(sys.argv[2], "w", encoding="utf-8") as f_out:
            for l in f_in:
                if any(s in l for s in subs): f_out.write(l)

if __name__ == "__main__":
    main()
