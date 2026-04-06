# file: 0_pdf_to_md.py
# Convert PDF to Markdown and filter short lines

import sys # argv
from pdf2markdown4llm import PDF2Markdown4LLM # PDF2Markdown4LLM

def main():
    in_p, out_p = sys.argv[1:3]
    min_l = int(sys.argv[3]) if len(sys.argv) > 3 else 10
    conv = PDF2Markdown4LLM(remove_headers=False, skip_empty_tables=True, table_header="### Table")
    md = conv.convert(in_p)
    with open(out_p, "w", encoding="utf-8") as f:
        f.writelines([l for l in md.splitlines(keepends=True) if len(l.rstrip('\n')) >= min_l])

if __name__ == "__main__":
    main()
