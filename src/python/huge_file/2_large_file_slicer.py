# file: 2_large_file_slicer.py
# Headless version: Process all fragments automatically without hotkeys

import re        # search, MULTILINE
import os        # exists, makedirs, path
import sys       # argv, exit
import time      # sleep
import shutil    # rmtree

class FileSlicer:
    def __init__(self, in_f, tmpl_f, out_sub, frag_sub, add_f=None, lpf=300, ovr=0, wc=0):
        try:
            self.lines = open(in_f, 'r', encoding='utf-8').readlines()
        except FileNotFoundError:
            print(f"Error: {in_f} not found")
            self.done = True
            return
        self.total, self.tmpl_f, self.out_sub, self.frag_sub, self.add_f, self.lpf, self.ovr, self.wc = len(self.lines), tmpl_f, out_sub, frag_sub, add_f, lpf, ovr, wc
        self.step, self.curr, self.last, self.done = 1, 0, 0, False
        for d in [out_sub, frag_sub]:
            if os.path.exists(d): shutil.rmtree(d)
            os.makedirs(d)
        
        print(f"Starting automatic slicing for {in_f}...")
        while not self.done:
            self.next()

    def next(self):
        if self.done or self.curr >= self.total: 
            self.done = True
            return

        # Skip leading blank lines so fragment always starts cleanly with paragraph text
        while self.curr < self.total and not self.lines[self.curr].strip():
            self.curr += 1
        if self.curr >= self.total:
            self.done = True
            return

        start_line = self.curr
        nominal_end = min(self.curr + self.lpf - 1, self.total - 1)

        if nominal_end >= self.total - 1:
            end_line = self.total - 1
            next_start = self.total
        else:
            # Search for a natural paragraph boundary near nominal_end
            # Look backwards up to 35% of lpf for an empty line or section header
            min_boundary = max(start_line + 15, start_line + int(self.lpf * 0.65))
            max_boundary = min(self.total - 1, start_line + int(self.lpf * 1.35))
            found_boundary = None
            found_next_start = None

            # 1. Search backwards from nominal_end for an empty line (paragraph separator)
            for i in range(nominal_end, min_boundary - 1, -1):
                line = self.lines[i].strip()
                if not line:
                    found_boundary = i
                    n_start = i + 1
                    while n_start < self.total and not self.lines[n_start].strip():
                        n_start += 1
                    found_next_start = n_start
                    break
                elif line.startswith('#') or re.match(r'^\d+(\.\d+)+\b', line):
                    # Section heading: cut right before this line so it starts the next fragment
                    if i > start_line + 15:
                        found_boundary = i - 1
                        found_next_start = i
                        break

            # 2. If no boundary found searching backwards, search forward
            if found_boundary is None:
                for i in range(nominal_end + 1, max_boundary + 1):
                    line = self.lines[i].strip()
                    if not line:
                        found_boundary = i
                        n_start = i + 1
                        while n_start < self.total and not self.lines[n_start].strip():
                            n_start += 1
                        found_next_start = n_start
                        break
                    elif line.startswith('#') or re.match(r'^\d+(\.\d+)+\b', line):
                        found_boundary = i - 1
                        found_next_start = i
                        break

            if found_boundary is not None and found_next_start is not None:
                end_line = found_boundary
                next_start = found_next_start
            else:
                end_line = nominal_end
                next_start = nominal_end + 1

        chunk_lines = self.lines[start_line:end_line + 1]
        txt = ''.join(chunk_lines).strip()
        if not txt:
            self.curr = next_start
            return

        self.save(txt, start_line + 1, end_line + 1)
        self.step += 1
        self.curr = next_start

    def save(self, txt, start, end):
        tmpl = open(self.tmpl_f, 'r', encoding='utf-8').read()
        target_comp = os.environ.get("TARGET_COMPONENT", "").strip()
        if target_comp:
            tmpl = tmpl.replace('AR9331', target_comp)
        add = open(self.add_f, 'r', encoding='utf-8').read().strip() if self.add_f and os.path.exists(self.add_f) else ""
        res = tmpl.replace('#1', txt).replace('#2', add).replace('#3', str(start)).replace('#4', str(end)).replace('#5', str(self.total)).replace('#6', str(self.step)).replace('#7', str(self.wc))
        
        with open(os.path.join(self.frag_sub, f"fragment_{self.step}.txt"), 'w', encoding='utf-8') as f: f.write(txt)
        with open(os.path.join(self.out_sub, f"prompt_step_{self.step}.txt"), 'w', encoding='utf-8') as f: f.write(res)
        print(f"Processed fragment {self.step} (lines {start}-{end})")

if __name__ == "__main__":
    if len(sys.argv) < 5: sys.exit(1)
    s = FileSlicer(*sys.argv[1:5], *sys.argv[5:])
