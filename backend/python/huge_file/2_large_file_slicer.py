# file: 2_large_file_slicer.py
# Slice large file into fragments for AI processing

import keyboard  # add_hotkey, wait
import pyperclip # copy, paste
import re        # search, MULTILINE
import os        # exists, makedirs, path
import sys       # argv, exit
import time      # sleep
import shutil    # rmtree

class FileSlicer:
    def __init__(self, in_f, tmpl_f, out_sub, frag_sub, add_f=None, lpf=300, ovr=0, wc=0):
        self.lines = open(in_f, 'r', encoding='utf-8').readlines()
        self.total, self.tmpl_f, self.out_sub, self.frag_sub, self.add_f, self.lpf, self.ovr, self.wc = len(self.lines), tmpl_f, out_sub, frag_sub, add_f, lpf, ovr, wc
        self.step, self.curr, self.last, self.done = 1, 0, 0, False
        for d in [out_sub, frag_sub]:
            if os.path.exists(d): shutil.rmtree(d)
            os.makedirs(d)
        keyboard.add_hotkey('ctrl+q', self.next)
        self.next()

    def next(self):
        if self.done or self.curr >= self.total: self.done = True; pyperclip.copy(''); return
        end = min(self.curr + self.lpf - 1, self.total - 1)
        txt = ''.join(self.lines[self.curr:end + 1])
        trimmed = end - self.curr + 1
        self.curr += max(trimmed - self.ovr, 1)
        if trimmed < 2: self.done = True; return
        self.save(txt, self.curr - trimmed + 1, self.curr)
        self.last, self.step = self.curr, self.step + 1

    def save(self, txt, start, end):
        tmpl = open(self.tmpl_f, 'r', encoding='utf-8').read()
        add = open(self.add_f, 'r', encoding='utf-8').read().strip() if self.add_f and os.path.exists(self.add_f) else ""
        res = tmpl.replace('#1', txt).replace('#2', add).replace('#3', str(start)).replace('#4', str(end)).replace('#5', str(self.total)).replace('#6', str(self.step)).replace('#7', str(self.wc))
        pyperclip.copy(res)
        with open(os.path.join(self.frag_sub, f"fragment_{self.step}.txt"), 'w', encoding='utf-8') as f: f.write(txt)
        with open(os.path.join(self.out_sub, f"prompt_step_{self.step}.txt"), 'w', encoding='utf-8') as f: f.write(res)

if __name__ == "__main__":
    if len(sys.argv) < 5: sys.exit(1)
    s = FileSlicer(*sys.argv[1:5], *sys.argv[5:])
    while not s.done: time.sleep(0.1)
