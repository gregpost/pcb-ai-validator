# file: 4_rmlines2.py
# Filter out unwanted records from PCB data

import sys # argv, exit

def main():
    if len(sys.argv) != 3: sys.exit(1)
    black = ["RECORD=Arc", "RECORD=Track", "RECORD=Connection", "RECORD=Via", "RECORD=Region", "RECORD=ComponentBody", "RECORD=Board"]
    with open(sys.argv[1], "r", encoding="utf-8", errors="ignore") as f_in:
        with open(sys.argv[2], "w", encoding="utf-8") as f_out:
            for l in f_in:
                if not any(b in l for b in black): f_out.write(l)

if __name__ == "__main__":
    main()
