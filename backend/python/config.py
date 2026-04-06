# file: config.py
# Configuration with dynamic tmp timestamp support and multiple field names

import os      # getenv
import time    # strftime

class Config:
    def __init__(self, no_timestamp=False):
        # ------------------------------------------------------------------------------------------------
        # ОПРЕДЕЛЕНИЕ БАЗОВЫХ ПУТЕЙ
        # ------------------------------------------------------------------------------------------------
        
        # Директория, где лежит этот файл (backend/python)
        self.BASE_DIR = os.path.dirname(os.path.abspath(__file__))
        # Корень проекта
        self.PROJECT_ROOT = os.path.dirname(os.path.dirname(self.BASE_DIR))
        # Директория ресурсов (backend/resources)
        self.RESOURCES_DIR = os.path.join(os.path.dirname(self.BASE_DIR), "resources")
        
        # ------------------------------------------------------------------------------------------------
        # ОСНОВНЫЕ НАСТРОЙКИ (менять при каждом запуске)
        # ------------------------------------------------------------------------------------------------
        
        # Варианты путей к PcbDoc файлам
        # ВНИМАНИЕ: Если PcbDocs лежат в корне, используем PROJECT_ROOT
        self.PCB_PATHS = {
            1: os.path.join(self.PROJECT_ROOT, "PcbDocs/RTL8370N-Switch-AR9331-WIFI.PcbDoc"),
            2: os.path.join(self.PROJECT_ROOT, "PcbDocs/TL-WR703N.PcbDoc"),
            3: os.path.join(self.PROJECT_ROOT, "PcbDocs/8_1000M_Switch_VT1.1.PcbDoc")
        }
        
        # Список обрабатываемых схем: {индекс_в_PCB_PATHS: "имя_поля"}
        self.SCHEME_MAPPING = {
            1: "DEV_SCHEME",
            3: "REF_SCHEME"
        }
        
        # Список компонентов: первый - целевой (TARGET_COMPONENT)
        self.COMPONENTS = [
            "RTL8370N",      # целевой компонент
            "G4801S",
            "BY25Q16BSTIG"
        ]
        
        # Имя исполняемого файла Python или асболютный путь
        self.PYTHON_PATH = os.environ.get("PYTHON_EXECUTABLE", "python3")
        
        # ------------------------------------------------------------------------------------------------
        # ПУТИ К СКРИПТАМ (исходники)
        # ------------------------------------------------------------------------------------------------
        
        self.HUGE_FILE_DIR = os.path.join(self.BASE_DIR, "huge_file")
        self.GRAPH_DIR_SRC = os.path.join(self.BASE_DIR, "graph")
        self.PCB_TO_SCHEM_DIR_SRC = os.path.join(self.BASE_DIR, "pcb_to_netlist")
        
        # ------------------------------------------------------------------------------------------------
        # TMP DIR (с таймкодом)
        # ------------------------------------------------------------------------------------------------
        
        BASE_TMP_DIR = os.path.join(self.PROJECT_ROOT, "tmp")
        
        if no_timestamp:
            self.TMP_DIR = os.path.join(BASE_TMP_DIR, "base")
        else:
            self.TMP_DIR = os.path.join(BASE_TMP_DIR, f"tmp_{time.strftime('%Y%m%d_%H%M%S')}")
        
        self.GRAPH_DIR = os.path.join(self.TMP_DIR, "graph")
        self.PCB_TO_SCHEM_DIR = os.path.join(self.TMP_DIR, "pcb_to_netlist")
        self.HUGE_FILE_TMP_DIR = os.path.join(self.TMP_DIR, "huge_file")
        
        # ------------------------------------------------------------------------------------------------
        # ОБЩИЕ ПУТИ К ДАННЫМ (не tmp)
        # ------------------------------------------------------------------------------------------------
        
        self.PINS_DIR = os.path.join(self.RESOURCES_DIR, "pins")
        self.DATASHEETS_DIR = os.path.join(self.RESOURCES_DIR, "datasheets")
        self.PCB_DIR = os.path.join(self.RESOURCES_DIR, "pcbdocs")
        self.PROMPTS_DIR = os.path.join(self.RESOURCES_DIR, "prompts")
        self.NETS_DIR = os.path.join(self.RESOURCES_DIR, "nets")
        
        # ------------------------------------------------------------------------------------------------
        # ВХОДНЫЕ/ВЫХОДНЫЕ ФАЙЛЫ (с использованием tmp)
        # ------------------------------------------------------------------------------------------------
        
        self.TARGET_COMPONENT = self.COMPONENTS[0]
        
        self.COMMON_NETS_PATH = os.path.join(self.NETS_DIR, "common_nets.txt")
        self.COMPRESSED_DATASHEET_PATH = os.path.join(self.DATASHEETS_DIR, f"{self.TARGET_COMPONENT}_compressed.txt")
        self.FULL_DESCRIPTION_PATH = os.path.join(self.HUGE_FILE_TMP_DIR, "full_description.txt")
        
        self.CLIPBOARD_SAVER_PATH = os.path.join(self.HUGE_FILE_TMP_DIR, "1_clipboard_saver.txt")
        self.LARGE_FILE_SLICER_PATH = os.path.join(self.HUGE_FILE_TMP_DIR, "2_large_file_slicer.txt")
        self.PIN_PROCESSOR_PATH = os.path.join(self.GRAPH_DIR, "8_1_pin_processor.txt")
        
        self.PROMPT_FOLDER = os.path.join(self.HUGE_FILE_TMP_DIR, "prompt_outputs")
        self.FRAGMENT_FOLDER = os.path.join(self.HUGE_FILE_TMP_DIR, "fragments")
        
        self.PROMPT_TEMPLATE_PATH_1 = os.path.join(self.PROMPTS_DIR, "Составление сжатого даташита.txt")
        self.PROMPT_TEMPLATE_PATH_2 = os.path.join(self.PROMPTS_DIR, "Конвертация схемы в текст.txt")
