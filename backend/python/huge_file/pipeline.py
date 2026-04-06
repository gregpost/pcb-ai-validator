# file: pipeline.py
# Runs data processing scripts sequentially

import subprocess # run
import sys        # executable

def run(name, args=None):
    subprocess.run([sys.executable, name] + (args or []), check=True)

def main():
    run("0_pdf_to_md.py", ["input.pdf", "output.md"])
    run("1_clipboard_saver.py", ["../tmp/huge_file/clipboard_log.txt"])
    run("2_large_file_slicer.py", ["../tmp/graph/branches_tmp.txt", "../prompts/Конвертация схемы в текст.txt", "../tmp/huge_file/prompt_outputs", "../tmp/huge_file/fragments", "../tmp/huge_file/answer.txt"])
    run("3_pin_processor.py", ["../tmp/huge_file/prompt_outputs/merged.txt", "../tmp/huge_file/pin_processed.txt"])

if __name__ == "__main__":
    main()
