# file: run_pipeline.py
# Run PCB to netlist utilities sequentially

import subprocess # run
import sys        # argv, exit
import os         # path, exists

def main():
    if len(sys.argv) != 3: sys.exit(1)
    pcb, out_dir = sys.argv[1:3]
    steps = [
        ("1_convert_to_utf8.py", [pcb, f"{out_dir}/1_utf8.txt"]),
        ("2_pcbdoc_filter.py", [f"{out_dir}/1_utf8.txt", f"{out_dir}/2_filter.txt"]),
        ("3_rmlines.py", [f"{out_dir}/2_filter.txt", f"{out_dir}/3_rm.txt"]),
        ("4_rmlines2.py", [f"{out_dir}/3_rm.txt", f"{out_dir}/4_rm2.txt"]),
        ("5_parse_nets.py", [f"{out_dir}/4_rm2.txt", f"{out_dir}/5_nets.txt"]),
        ("6_map_component_names.py", [f"{out_dir}/4_rm2.txt", f"{out_dir}/5_nets.txt", f"{out_dir}/6_comp.txt"]),
        ("7_map_net_names.py", [f"{out_dir}/4_rm2.txt", f"{out_dir}/6_comp.txt", f"{out_dir}/7_net.txt"]),
        ("8_resolve_chips.py", [f"{out_dir}/4_rm2.txt", f"{out_dir}/7_net.txt", f"{out_dir}/8_resolve_chips.txt"])
    ]
    for script, args in steps:
        subprocess.run(["python", f"../pcb_to_netlist/{script}"] + args, check=True)

if __name__ == "__main__":
    main()
