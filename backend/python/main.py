# file: main.py
# Processes multiple PcbDoc files, extracts circuits for each, then merges all results

import subprocess # Popen, run
import sys        # argv, exit
import re         # findall
import time       # strftime
import os         # makedirs, path, environ
import shutil     # copy2

def log_step(message):
    timestamp = time.strftime("%H:%M:%S")
    print(f"[{timestamp}] {message}")

def run_script(cfg, script_name, *args, parallel=False):
    target_script = os.environ.get("TARGET_SCRIPT", "")
    script_basename = os.path.basename(script_name)
    
    if target_script and target_script != script_basename:
        return subprocess.CompletedProcess([], 0)
    
    log_step(f"Running: {script_name}")
    cmd = [cfg.PYTHON_PATH, script_name] + list(args)
    
    if parallel:
        return subprocess.Popen(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
    
    return subprocess.run(cmd)

def process_single_pcb(cfg, pcb_index, field_name, start_step):
    pcb_path = cfg.PCB_PATHS[pcb_index]
    scheme_name = os.path.basename(pcb_path)
    log_step(f"=== Processing PCB index {pcb_index} as {field_name}: {scheme_name} ===")
    
    scheme_dir = f"{cfg.PCB_TO_SCHEM_DIR}/{pcb_index}"
    graph_dir = f"{cfg.GRAPH_DIR}/{pcb_index}"
    os.makedirs(scheme_dir, exist_ok=True)
    os.makedirs(graph_dir, exist_ok=True)
    
    netlist_path = f"{scheme_dir}/8_resolve_chips.txt"
    netlist_to_graph_path = f"{graph_dir}/1_netlist_to_graph.gml"
    remove_degree2_nets_path = f"{graph_dir}/2_remove_degree2_nets.gml"
    simplify_passive_components_path = f"{graph_dir}/3_simplify_passive_components.gml"
    get_branch_path = f"{graph_dir}/4_get_branch.gml"
    graph_to_text_path = f"{graph_dir}/5_graph_to_text.txt"
    remove_nets_path = f"{graph_dir}/6_remove_nets.txt"
    text_appender_path = f"{graph_dir}/7_text_appender.txt"
    pin_processor_path = f"{graph_dir}/8_1_pin_processor.txt"
    merge_pin_fields_path_1 = f"{graph_dir}/8_merge_pin_fields.txt"
    
    if start_step <= 3:
        run_script(cfg, f"{cfg.PCB_TO_SCHEM_DIR_SRC}/run_pipeline.py", cfg.PYTHON_PATH, pcb_path, scheme_dir)
    
    if start_step <= 4:
        run_script(cfg, f"{cfg.GRAPH_DIR_SRC}/1_netlist_to_graph.py", netlist_path, netlist_to_graph_path)
        run_script(cfg, f"{cfg.GRAPH_DIR_SRC}/2_remove_degree2_nets.py", netlist_to_graph_path, remove_degree2_nets_path)
        run_script(cfg, f"{cfg.GRAPH_DIR_SRC}/3_simplify_passive_components.py", remove_degree2_nets_path, simplify_passive_components_path)
    
    if start_step <= 5:
        pin_list_path = f"{cfg.PINS_DIR}/{cfg.TARGET_COMPONENT}.txt"
        try:
            with open(pin_list_path, "r") as f:
                content = f.read()
        except FileNotFoundError:
            return None
        
        pins = re.findall(rf'^({cfg.TARGET_COMPONENT}_\w+)$', content, re.MULTILINE)
        
        with open(text_appender_path, "w") as f:
            f.write("")
        
        for i, pin in enumerate(pins, 1):        
            log_step(f"Processing pin {i}/{len(pins)}: {pin}")
            result = run_script(cfg, f"{cfg.GRAPH_DIR_SRC}/4_get_branch.py", pin, 
                                simplify_passive_components_path,
                                get_branch_path, cfg.COMMON_NETS_PATH)
            if result.returncode == 0:
                continue
            run_script(cfg, f"{cfg.GRAPH_DIR_SRC}/5_graph_to_text.py", cfg.TARGET_COMPONENT,
                       get_branch_path, graph_to_text_path, cfg.COMMON_NETS_PATH)
            run_script(cfg, f"{cfg.GRAPH_DIR_SRC}/6_remove_nets.py", graph_to_text_path, remove_nets_path)
            run_script(cfg, f"{cfg.GRAPH_DIR_SRC}/7_text_appender.py", pin, remove_nets_path, text_appender_path)
    
    if start_step <= 6:
        run_script(cfg, f"{cfg.GRAPH_DIR_SRC}/8_merge_pin_fields.py", pin_processor_path, 
                   text_appender_path, merge_pin_fields_path_1, field_name)
    
    return text_appender_path

def merge_all_results(cfg, text_appender_paths):
    log_step("=== Merging all PCB results ===")
    if not text_appender_paths:
        return None
    base_file = text_appender_paths[0]
    current_merged = base_file
    for i in range(1, len(text_appender_paths)):
        temp_merged = f"{cfg.GRAPH_DIR}/temp_merged_{i}.txt"
        run_script(cfg, f"{cfg.GRAPH_DIR_SRC}/8_merge_pin_fields.py", 
                   current_merged, text_appender_paths[i], temp_merged)
        current_merged = temp_merged
    return current_merged

def main():
    start_step = 1
    no_timestamp = False
    for arg in sys.argv[1:]:
        if arg.startswith("--step="):
            start_step = int(arg.split("=")[1])
        elif arg == "--no-tmp-timestamp":
            no_timestamp = True
    
    from config import Config
    cfg = Config(no_timestamp)
    for d in [cfg.PCB_TO_SCHEM_DIR, cfg.GRAPH_DIR, cfg.HUGE_FILE_TMP_DIR]:
        os.makedirs(d, exist_ok=True)

    if start_step <= 1:
        for component in cfg.COMPONENTS:
            pdf_path = f"{cfg.DATASHEETS_DIR}/{component}.pdf"
            md_path = f"{cfg.HUGE_FILE_TMP_DIR}/{component}.md"
            run_script(cfg, f"{cfg.HUGE_FILE_DIR}/0_pdf_to_md.py", pdf_path, md_path)

    if start_step <= 2:        
        run_script(cfg, f"{cfg.HUGE_FILE_DIR}/1_clipboard_saver.py", cfg.CLIPBOARD_SAVER_PATH, parallel=True)
        for component in cfg.COMPONENTS:
            md_path = f"{cfg.HUGE_FILE_TMP_DIR}/{component}.md"
            pin_list_path = f"{cfg.PINS_DIR}/{component}.txt"
            run_script(cfg, f"{cfg.HUGE_FILE_DIR}/2_large_file_slicer.py", md_path, 
                       cfg.PROMPT_TEMPLATE_PATH_1, cfg.PROMPT_FOLDER, 
                       cfg.FRAGMENT_FOLDER, pin_list_path)
        run_script(cfg, f"{cfg.HUGE_FILE_DIR}/3_pin_processor.py", cfg.CLIPBOARD_SAVER_PATH, cfg.PIN_PROCESSOR_PATH)

    text_appender_paths = []
    for pcb_index, field_name in cfg.SCHEME_MAPPING.items():
        dst_pin_processor = f"{cfg.GRAPH_DIR}/{pcb_index}/8_1_pin_processor.txt"
        os.makedirs(os.path.dirname(dst_pin_processor), exist_ok=True)
        if os.path.exists(cfg.PIN_PROCESSOR_PATH):
            shutil.copy2(cfg.PIN_PROCESSOR_PATH, dst_pin_processor)
        res = process_single_pcb(cfg, pcb_index, field_name, start_step)
        if res: text_appender_paths.append(res)
    
    merged_text_appender = merge_all_results(cfg, text_appender_paths) if start_step <= 7 else None
    
    if start_step <= 8 and merged_text_appender:
        first_index = list(cfg.SCHEME_MAPPING.keys())[0]
        pin_proc = f"{cfg.GRAPH_DIR}/{first_index}/8_1_pin_processor.txt"
        merged_2 = f"{cfg.GRAPH_DIR}/12_merge_pin_fields.txt"
        parsed = f"{cfg.GRAPH_DIR}/9_circuit_parser.txt"
        filtered = f"{cfg.GRAPH_DIR}/10_filter_components.txt"
        sorted_ds = f"{cfg.GRAPH_DIR}/11_netlist_datasheet_sorter.txt"
        
        run_script(cfg, f"{cfg.GRAPH_DIR_SRC}/8_merge_pin_fields.py", pin_proc, merged_text_appender, merged_2)
        run_script(cfg, f"{cfg.GRAPH_DIR_SRC}/9_circuit_parser.py", merged_2, parsed)
        run_script(cfg, f"{cfg.GRAPH_DIR_SRC}/10_filter_components.py", parsed, filtered)
        run_script(cfg, f"{cfg.GRAPH_DIR_SRC}/11_netlist_datasheet_sorter.py", filtered, pin_proc, sorted_ds)
        
        if os.path.exists(sorted_ds):
            run_script(cfg, f"{cfg.HUGE_FILE_DIR}/1_clipboard_saver.py", cfg.CLIPBOARD_SAVER_PATH, parallel=True)
            run_script(cfg, f"{cfg.HUGE_FILE_DIR}/2_large_file_slicer.py", sorted_ds, cfg.PROMPT_TEMPLATE_PATH_2, cfg.PROMPT_FOLDER, cfg.FRAGMENT_FOLDER)

if __name__ == "__main__":
    sys.exit(main())
