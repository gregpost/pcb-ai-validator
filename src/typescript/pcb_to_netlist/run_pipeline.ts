import { convertToUtf8 } from './1_convert_to_utf8';
import { pcbdocFilter } from './2_pcbdoc_filter';
import { rmLines } from './3_rmlines';
import { rmLines2 } from './4_rmlines2';
import { parseNets } from './5_parse_nets';
import { mapComponentNames } from './6_map_component_names';
import { mapNetNames } from './7_map_net_names';
import { resolveChips } from './8_resolve_chips';
import path from 'path';

export function runPcbPipeline(pcbPath: string, outDir: string): void {
    const p1 = path.join(outDir, "1_utf8.txt");
    const p2 = path.join(outDir, "2_filter.txt");
    const p3 = path.join(outDir, "3_rm.txt");
    const p4 = path.join(outDir, "4_rm2.txt");
    const p5 = path.join(outDir, "5_nets.txt");
    const p6 = path.join(outDir, "6_comp.txt");
    const p7 = path.join(outDir, "7_net.txt");
    const p8 = path.join(outDir, "8_resolve_chips.txt");

    console.log(`[PCB] 1. Converting ${path.basename(pcbPath)} to UTF-8...`);
    convertToUtf8(pcbPath, p1);
    
    console.log(`[PCB] 2. Filtering PcbDoc content...`);
    pcbdocFilter(p1, p2);
    
    console.log(`[PCB] 3. Removing unneeded lines (Stage 1)...`);
    rmLines(p2, p3);
    
    console.log(`[PCB] 4. Removing unneeded records (Stage 2)...`);
    rmLines2(p3, p4);
    
    console.log(`[PCB] 5. Parsing nets...`);
    parseNets(p4, p5);
    
    console.log(`[PCB] 6. Mapping component names...`);
    mapComponentNames(p4, p5, p6);
    
    console.log(`[PCB] 7. Mapping net names...`);
    mapNetNames(p4, p6, p7);
    
    console.log(`[PCB] 8. Resolving chip names...`);
    resolveChips(p4, p7, p8);
    
    console.log(`[PCB] Pipeline completed for ${path.basename(pcbPath)}`);
}
