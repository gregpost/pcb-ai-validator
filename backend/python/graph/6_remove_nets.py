# file: 6_remove_nets.py
# Remove Net-prefixed nodes from textual chain description

import re  # sub
import sys # argv

def main():
    input_f, output_f = sys.argv[1], sys.argv[2]
    with open(input_f, "r", encoding="utf-8") as f: text = f.read()
    text = re.sub(r'Net\w+-', '', text)
    text = re.sub(r'-Net\w+', '', text)
    text = re.sub(r'Net\w+', '', text)
    text = re.sub(r'-+', '-', text)
    text = re.sub(r'\(\s*\)', '', text)
    with open(output_f, "w", encoding="utf-8") as f: f.write(text)

if __name__ == "__main__":
    main()
