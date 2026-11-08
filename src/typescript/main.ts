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

  // VALIDATION 1: Check for target component
  if (!cfg.TARGET_COMPONENT) {
    throw new Error(`[FATAL ERROR] Не указано имя целевого компонента (TARGET_COMPONENT). Запуск пайплайна невозможен.`);
  }

  // VALIDATION 2: Check for PCB files
  const pcbFiles = fs.existsSync(cfg.UPLOAD_PCB_DIR) 
    ? fs.readdirSync(cfg.UPLOAD_PCB_DIR).filter(f => f.toLowerCase().endsWith('.pcbdoc')) 
    : [];

  if (pcbFiles.length === 0) {
    throw new Error(`[FATAL ERROR] В папке '${cfg.UPLOAD_PCB_DIR}' не найдено файлов *.PcbDoc для обработки.`);
  }

  // VALIDATION 3: Check for PDF files
  const pdfFiles = fs.existsSync(cfg.DATASHEETS_DIR)
    ? fs.readdirSync(cfg.DATASHEETS_DIR).filter(f => f.toLowerCase().endsWith('.pdf'))
    : [];
    
  if (pdfFiles.length === 0) {
    throw new Error(`[FATAL ERROR] В папке '${cfg.DATASHEETS_DIR}' не найдено ни одного PDF файла даташитов.`);
  }

  // VALIDATION 4: Target component PDF must exist
  const targetPdf = pdfFiles.find(f => path.parse(f).name.toLowerCase() === cfg.TARGET_COMPONENT.toLowerCase());
  if (!targetPdf) {
    throw new Error(`[FATAL ERROR] Отсутствует обязательный PDF даташит для целевого компонента '${cfg.TARGET_COMPONENT}.pdf' в папке '${cfg.DATASHEETS_DIR}'.`);
  }

  // VALIDATION 5: Pin list file (.txt) must exist for EVERY pdf file
  for (const pdfFile of pdfFiles) {
    const compName = path.parse(pdfFile).name;
    let pinFound = false;
    if (fs.existsSync(cfg.PINS_DIR)) {
      const pinFiles = fs.readdirSync(cfg.PINS_DIR);
      pinFound = pinFiles.some(pf => pf.toLowerCase() === `${compName.toLowerCase()}.txt`);
    }
    if (!pinFound) {
      throw new Error(`[FATAL ERROR] Для даташита '${pdfFile}' отсутствует обязательный файл со списком ножек '${cfg.PINS_DIR}/${compName}.txt'.`);
    }
  }

  // VALIDATION 6: Target component presence in uploaded PcbDoc
  let targetInPcb = false;
  for (const pcbPath of Object.values(cfg.PCB_PATHS)) {
    if (fs.existsSync(pcbPath)) {
      try {
        const buf = fs.readFileSync(pcbPath);
        if (buf.toString('latin1').toLowerCase().includes(cfg.TARGET_COMPONENT.toLowerCase())) {
          targetInPcb = true;
          break;
        }
      } catch {}
    }
  }
  if (!targetInPcb) {
    const pcbNames = Object.values(cfg.PCB_PATHS).map(p => path.basename(p));
    throw new Error(`[FATAL ERROR] Целевой компонент '${cfg.TARGET_COMPONENT}' отсутствует в загруженном файле платы (${pcbNames.join(', ')}). Запуск отменен.`);
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
    
    // ПАУЗА ДЛЯ НЕЙРОСЕТИ (ШАГ 1: СЖАТИЕ ДАТАШИТА)
    const readyFlag1 = path.join(cfg.TMP_DIR, "ready_for_user_answers_1.flag");
    const resumeFlag1 = path.join(cfg.TMP_DIR, "resume_stage_1.flag");
    fs.writeFileSync(readyFlag1, "PROMPTS_GENERATED_STAGE_1");
    logStep("=== ОЖИДАНИЕ ВВОДА ОТВЕТОВ НЕЙРОСЕТИ (ЭТАП 1: ДАТАШИТ) ===");
    logStep(`[USER_ACTION_REQUIRED] Сформированы промпты в папке: ${cfg.PROMPT_FOLDER}`);
    logStep("[USER_ACTION_REQUIRED] Скопируйте промпты, отправьте в нейросеть, вставьте ответ в интерфейсе и нажмите 'Далее'.");

    const cancelFlag1 = path.join(cfg.TMP_DIR, "cancel.flag");
    while (!fs.existsSync(resumeFlag1)) {
      if (fs.existsSync(cancelFlag1)) {
        logStep("[USER_ABORT] Пайплайн принудительно остановлен пользователем.");
        return;
      }
      await new Promise(r => setTimeout(r, 1000));
    }

    logStep("Ответы пользователя получены. Продолжение пайплайна...");
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
            const promptFolder2 = path.join(cfg.GRAPH_DIR, "prompt_outputs_2");
            const fragFolder2 = path.join(cfg.GRAPH_DIR, "fragments_2");
            fs.mkdirSync(promptFolder2, { recursive: true });
            fs.mkdirSync(fragFolder2, { recursive: true });

            largeFileSlicer(sortedDs, cfg.PROMPT_TEMPLATE_PATH_2, promptFolder2, fragFolder2);

            // ПАУЗА ДЛЯ НЕЙРОСЕТИ (ШАГ 2: КОНВЕРТАЦИЯ СХЕМЫ В ТЕКСТ)
            const readyFlag2 = path.join(cfg.TMP_DIR, "ready_for_user_answers_2.flag");
            const resumeFlag2 = path.join(cfg.TMP_DIR, "resume_stage_2.flag");
            fs.writeFileSync(readyFlag2, "PROMPTS_GENERATED_STAGE_2");
            logStep("=== ОЖИДАНИЕ ВВОДА ОТВЕТОВ НЕЙРОСЕТИ (ЭТАП 2: СХЕМА В ТЕКСТ) ===");
            logStep(`[USER_ACTION_REQUIRED] Сформированы промпты для схемы в папке: ${promptFolder2}`);
            logStep("[USER_ACTION_REQUIRED] Отправьте промпты в нейросеть, вставьте ответ и нажмите 'Далее' для финализации.");

            const cancelFlag2 = path.join(cfg.TMP_DIR, "cancel.flag");
            while (!fs.existsSync(resumeFlag2)) {
              if (fs.existsSync(cancelFlag2)) {
                logStep("[USER_ABORT] Пайплайн принудительно остановлен пользователем.");
                return;
              }
              await new Promise(r => setTimeout(r, 1000));
            }
            logStep("Финальные ответы нейросети получены.");
        }
    }
  }

  logStep("PROCESSING COMPLETED");
}

main().catch(err => {
  console.error(`\n[FATAL ERROR] ${err.message}`);
  process.exit(1);
});

