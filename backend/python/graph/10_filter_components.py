# file: 10_filter_components.py
# Filter components with exactly one underscore and remove duplicates

import sys # argv, exit

def main():
    if len(sys.argv) != 3:
        sys.exit(1)
    
    input_path, output_path = sys.argv[1], sys.argv[2]
    
    try:
        with open(input_path, 'r') as f:
            lines = f.readlines()
    except FileNotFoundError:
        sys.exit(1)
    
    output_lines = []
    for line in lines:
        line = line.strip()
        if not line: continue
        
        if ':' in line:
            prefix, rest = line.split(':', 1)
            substrings = [s.strip() for s in rest.split(',') if s.strip()]
        else:
            prefix, substrings = None, [s.strip() for s in line.split(',') if s.strip()]
        
        filtered = [s for s in substrings if s.count('_') == 1 and s != prefix]
        
        if prefix:
            output_lines.append(f"{prefix}:{','.join(filtered)}")
        else:
            output_lines.append(','.join(filtered))
    
    with open(output_path, 'w') as f:
        f.write('\n'.join(output_lines))

if __name__ == "__main__":
    main()
