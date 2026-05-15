import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class Config {
  public PROJECT_ROOT: string;
  public BASE_DIR: string;
  public RESOURCES_DIR: string;
  public UPLOAD_PCB_DIR: string;
  public DATASHEETS_DIR: string;
  public TMP_DIR: string;
  public GRAPH_DIR: string;
  public PCB_TO_SCHEM_DIR: string;
  public HUGE_FILE_TMP_DIR: string;
  public PINS_DIR: string;
  public PROMPTS_DIR: string;
  public NETS_DIR: string;
  
  public PCB_PATHS: Record<number, string> = {};
  public SCHEME_MAPPING: Record<number, string> = {};
  public COMPONENTS: string[] = [];
  public TARGET_COMPONENT: string;
  
  public COMMON_NETS_PATH: string;
  public CLIPBOARD_SAVER_PATH: string;
  public PIN_PROCESSOR_PATH: string;
  public PROMPT_TEMPLATE_PATH_1: string;
  public PROMPT_TEMPLATE_PATH_2: string;
  public PROMPT_FOLDER: string;
  public FRAGMENT_FOLDER: string;

  constructor(noTimestamp: boolean = false) {
    this.BASE_DIR = path.resolve(__dirname);
    this.PROJECT_ROOT = path.dirname(path.dirname(this.BASE_DIR));
    this.RESOURCES_DIR = path.join(this.PROJECT_ROOT, "resources");
    this.UPLOAD_PCB_DIR = path.join(this.PROJECT_ROOT, "PcbDocs");
    this.DATASHEETS_DIR = path.join(this.RESOURCES_DIR, "datasheets");
    
    // Dynamic PCB Discovery
    if (fs.existsSync(this.UPLOAD_PCB_DIR)) {
      const pcbFiles = fs.readdirSync(this.UPLOAD_PCB_DIR)
        .filter(f => f.toLowerCase().endsWith('.pcbdoc'))
        .sort();
      pcbFiles.forEach((file, index) => {
        this.PCB_PATHS[index + 1] = path.join(this.UPLOAD_PCB_DIR, file);
      });
    }

    if (Object.keys(this.PCB_PATHS).length === 2) {
      this.SCHEME_MAPPING[1] = "DEV_SCHEME";
      this.SCHEME_MAPPING[2] = "REF_SCHEME";
    } else {
      Object.keys(this.PCB_PATHS).forEach(idx => {
        this.SCHEME_MAPPING[Number(idx)] = `SCHEME_${idx}`;
      });
    }

    // Dynamic Component Discovery
    if (fs.existsSync(this.DATASHEETS_DIR)) {
      const pdfFiles = fs.readdirSync(this.DATASHEETS_DIR)
        .filter(f => f.toLowerCase().endsWith('.pdf'))
        .sort();
      this.COMPONENTS = pdfFiles.map(f => path.parse(f).name);
    }
    
    // No more default UNKNOWN_COMPONENT to avoid false processing

    const timestamp = noTimestamp ? "base" : `tmp_${new Date().toISOString().replace(/[:T.]/g, '_').slice(0, 19)}`;
    this.TMP_DIR = path.join(this.PROJECT_ROOT, "tmp", timestamp);
    this.GRAPH_DIR = path.join(this.TMP_DIR, "graph");
    this.PCB_TO_SCHEM_DIR = path.join(this.TMP_DIR, "pcb_to_netlist");
    this.HUGE_FILE_TMP_DIR = path.join(this.TMP_DIR, "huge_file");

    this.PINS_DIR = path.join(this.RESOURCES_DIR, "pins");
    this.PROMPTS_DIR = path.join(this.RESOURCES_DIR, "prompts");
    this.NETS_DIR = path.join(this.RESOURCES_DIR, "nets");

    this.TARGET_COMPONENT = process.env.TARGET_COMPONENT || this.COMPONENTS[0];
    this.COMMON_NETS_PATH = path.join(this.NETS_DIR, "common_nets.txt");
    this.CLIPBOARD_SAVER_PATH = path.join(this.HUGE_FILE_TMP_DIR, "1_clipboard_saver.txt");
    this.PIN_PROCESSOR_PATH = path.join(this.GRAPH_DIR, "8_1_pin_processor.txt");
    
    this.PROMPT_TEMPLATE_PATH_1 = path.join(this.PROMPTS_DIR, "Составление сжатого даташита.txt");
    this.PROMPT_TEMPLATE_PATH_2 = path.join(this.PROMPTS_DIR, "Конвертация схемы в текст.txt");
    
    this.PROMPT_FOLDER = path.join(this.HUGE_FILE_TMP_DIR, "prompt_outputs");
    this.FRAGMENT_FOLDER = path.join(this.HUGE_FILE_TMP_DIR, "fragments");

    // Ensure Dirs
    [this.GRAPH_DIR, this.PCB_TO_SCHEM_DIR, this.HUGE_FILE_TMP_DIR, this.PROMPT_FOLDER, this.FRAGMENT_FOLDER].forEach(d => {
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    });
  }
}
