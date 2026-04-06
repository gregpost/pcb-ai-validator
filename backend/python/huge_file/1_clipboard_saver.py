# file: 1_clipboard_saver.py
# Saves clipboard content to file on Alt+N hotkey

import pyperclip # paste
import keyboard  # add_hotkey
import os        # makedirs, path, chmod
import stat      # S_IWRITE
import sys       # argv

def main():
    target = sys.argv[1]
    os.makedirs(os.path.dirname(target), exist_ok=True)
    if os.path.exists(target): os.chmod(target, stat.S_IWRITE)
    open(target, 'w', encoding='utf-8').close()
    
    def save():
        text = pyperclip.paste().rstrip()
        if text:
            with open(target, 'a', encoding='utf-8') as f: f.write(text + '\n')
    
    keyboard.add_hotkey('alt+n', save)
    keyboard.wait()

if __name__ == "__main__":
    main()
