import fs from 'fs';
import path from 'path';
import Graph from 'graphology';
import { Config } from './config';

// Import refactored logic
import { pdfToMd } from './huge_file/0_pdf_to_md';
import { clipboardSaver } from './huge_file/1_clipboard_saver';
import { largeFileSlicer } from './huge_file/2_large_file_slicer';
import { pinProcessor } from './huge_file/3_pin_processor';

import { runPcbPipeline } from './pcb_to_netlist/run_pipeline';

import { netlistToGraph } from './graph/1_netlist_to_graph';
import { removeDegree2Nets } from './graph/2_remove_degree2_nets';
import { simplifyPassiveComponents } from './graph/3_simplify_passive_components';
import { textAppender } from './graph/7_text_appender';
import { mergePinFields } from './graph/8_merge_pin_fields';
import { circuitParser } from './graph/9_circuit_parser';
import { filterComponents } from './graph/10_filter_components';
import { netlistDatasheetSorter } from './graph/11_netlist_datasheet_sorter';

function logStep(message: string) {
  const timestamp = new Date().toLocaleTimeString('en-GB', { hour12: false });
  console.log(`[${timestamp}] ${message}`);
}

async function main() {
  const args = process.argv.slice(2);
  const startStep = args.find(a => a.startsWith('--step=')) ? 
    parseInt(args.find(a => a.startsWith('--step='))!.split('=')[1]) : 1;
  const noTimestamp = args.includes('--no-tmp-timestamp');

  const cfg = new Config(noTimestamp);

  logStep("=== Starting TypeScript Pipeline ===");

  // VALIDATION: Check for PCB files
  const pcbFiles = fs.existsSync(cfg.UPLOAD_PCB_DIR) 
    ? fs.readdirSync(cfg.UPLOAD_PCB_DIR).filter(f => f.toLowerCase().endsWith('.pcbdoc')) 
    : [];

  if (pcbFiles.length === 0) {
    throw new Error(`[FATAL ERROR] В папке '${cfg.UPLOAD_PCB_DIR}' не найдено файлов *.PcbDoc для обработки.`);
  }

  // VALIDATION: Check for PDF files
  const pdfFiles = fs.existsSync(cfg.DATASHEETS_DIR)
    ? fs.readdirSync(cfg.DATASHEETS_DIR).filter(f => f.toLowerCase().endsWith('.pdf'))
    : [];
    
  if (pdfFiles.length === 0) {
    logStep("[WARNING] Ни одного PDF файла не было найдено в resources/datasheets. Конвертация будет пропущена.");
  }

  // 1. PDF Conversion
  if (startStep <= 1) {
    let pdfCount = 0;
    for (const component of cfg.COMPONENTS) {
      const pdfPath = path.join(cfg.DATASHEETS_DIR, `${component}.pdf`);
      const mdPath = path.join(cfg.HUGE_FILE_TMP_DIR, `${component}.md`);
      if (fs.existsSync(pdfPath)) {
        logStep(`Converting PDF for ${component}...`);
        await pdfToMd(pdfPath, mdPath);
        pdfCount++;
      } else {
        logStep(`[INFO] Skipping ${component}, PDF not found.`);
      }
    }
    if (pdfCount === 0) {
        logStep("[WARNING] Ни одного PDF файла не было найдено в resources/datasheets.");
    }
  }

  // 2. Data Slicing and Pin Extraction
  if (startStep <= 2) {
    logStep("Step 2: Data Slicing and Pin Extraction...");
    clipboardSaver(cfg.CLIPBOARD_SAVER_PATH);
    
    for (const component of cfg.COMPONENTS) {
      const mdPath = path.join(cfg.HUGE_FILE_TMP_DIR, `${component}.md`);
      const pinListPath = path.join(cfg.PINS_DIR, `${component}.txt`);
      if (fs.existsSync(mdPath)) {
        logStep(`Slicing datasheet for ${component}...`);
        largeFileSlicer(mdPath, cfg.PROMPT_TEMPLATE_PATH_1, cfg.PROMPT_FOLDER, cfg.FRAGMENT_FOLDER, pinListPath);
      }
    }
    
    if (fs.existsSync(cfg.CLIPBOARD_SAVER_PATH)) {
      pinProcessor(cfg.CLIPBOARD_SAVER_PATH, cfg.PIN_PROCESSOR_PATH);
    }
  }

  // 3. Process PCBs
  const textAppenderPaths: string[] = [];
  const commonNetsText = fs.existsSync(cfg.COMMON_NETS_PATH) ? fs.readFileSync(cfg.COMMON_NETS_PATH, 'utf8') : "";
  const commonNetsMask = new Set(
    commonNetsText
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l)
  );

  for (const [pcbIndex, fieldName] of Object.entries(cfg.SCHEME_MAPPING)) {
    const idx = Number(pcbIndex);
    const pcbPath = cfg.PCB_PATHS[idx];
    if (!pcbPath || !fs.existsSync(pcbPath)) continue;

    logStep(`=== Processing PCB ${idx} as ${fieldName}: ${path.basename(pcbPath)} ===`);
    
    const schemeDir = path.join(cfg.PCB_TO_SCHEM_DIR, pcbIndex);
    const graphDir = path.join(cfg.GRAPH_DIR, pcbIndex);
    if (!fs.existsSync(schemeDir)) fs.mkdirSync(schemeDir, { recursive: true });
    if (!fs.existsSync(graphDir)) fs.mkdirSync(graphDir, { recursive: true });

    // Step 3: Pcb to Netlist
    if (startStep <= 3) {
      logStep("Step 3: PCB to Netlist...");
      runPcbPipeline(pcbPath, schemeDir);
    }
    const netlistPath = path.join(schemeDir, "8_resolve_chips.txt");

    // Step 4: Graph Simplify
    const gml1 = path.join(graphDir, "1_full.json");
    const gml2 = path.join(graphDir, "2_no_deg2.json");
    const gml3 = path.join(graphDir, "3_simplify.json");
    if (startStep <= 4) {
      logStep("Step 4: Graph Simplify...");
      netlistToGraph(netlistPath, gml1);
      removeDegree2Nets(gml1, gml2);
      simplifyPassiveComponents(gml2, gml3);
    }

    // Step 5: Branch Extraction
    const textAppenderPath = path.join(graphDir, "7_text_appender.txt");
    if (startStep <= 5) {
      const pinListPath = path.join(cfg.PINS_DIR, `${cfg.TARGET_COMPONENT}.txt`);
      if (fs.existsSync(pinListPath) && fs.existsSync(gml3)) {
        const gExport = JSON.parse(fs.readFileSync(gml3, 'utf8'));
        textAppender(gExport, pinListPath, commonNetsMask, cfg.TARGET_COMPONENT, textAppenderPath);
      }
    }
    
    if (fs.existsSync(textAppenderPath)) {
        textAppenderPaths.push(textAppenderPath);
    }

    // Step 6: Merge Pin Fields (Local)
    if (startStep <= 6) {
      const localPinProc = path.join(graphDir, "8_1_pin_processor.txt");
      const mergedPath = path.join(graphDir, "8_merge_pin_fields.txt");
      if (fs.existsSync(cfg.PIN_PROCESSOR_PATH)) {
          fs.copyFileSync(cfg.PIN_PROCESSOR_PATH, localPinProc);
          mergePinFields(localPinProc, textAppenderPath, mergedPath, fieldName);
      }
    }
  }

  // 7. Global Merge
  let mergedGlobal = "";
  if (startStep <= 7 && textAppenderPaths.length > 0) {
    logStep("=== Merging all PCB results ===");
    let current = textAppenderPaths[0];
    for (let i = 1; i < textAppenderPaths.length; i++) {
        const next = textAppenderPaths[i];
        const out = path.join(cfg.GRAPH_DIR, `temp_merged_${i}.txt`);
        mergePinFields(current, next, out);
        current = out;
    }
    mergedGlobal = current;
  }

  // 8. Final Sorting and Prompt Gen
  if (startStep <= 8 && mergedGlobal && cfg.SCHEME_MAPPING) {
    const pinProc = cfg.PIN_PROCESSOR_PATH;
    const merged2 = path.join(cfg.GRAPH_DIR, "12_merge_pin_fields.txt");
    const parsed = path.join(cfg.GRAPH_DIR, "9_circuit_parser.txt");
    const filtered = path.join(cfg.GRAPH_DIR, "10_filter_components.txt");
    const sortedDs = path.join(cfg.GRAPH_DIR, "11_netlist_datasheet_sorter.txt");

    if (fs.existsSync(pinProc)) {
        mergePinFields(pinProc, mergedGlobal, merged2);
        circuitParser(merged2, parsed);
        filterComponents(parsed, filtered);
        netlistDatasheetSorter(filtered, pinProc, sortedDs);

        if (fs.existsSync(sortedDs)) {
            logStep("Generating prompts for scheme-to-text...");
            largeFileSlicer(sortedDs, cfg.PROMPT_TEMPLATE_PATH_2, cfg.PROMPT_FOLDER, cfg.FRAGMENT_FOLDER);
        }
    }
  }

  logStep("PROCESSING COMPLETED");
}

main().catch(err => {
  console.error(`\n[FATAL ERROR] ${err.message}`);
  process.exit(1);
});

