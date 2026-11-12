// file: src/utils/algorithmProgress.ts
// Динамическое определение текущего шага и комментариев алгоритма

export interface AlgorithmProgress {
  title: string;
  description: string;
  percent: number;
  stageName: string;
  statusType: 'idle' | 'running' | 'waiting' | 'error' | 'success';
}

export function parseAlgorithmProgress(
  logs: string,
  isRunning: boolean,
  aiWaiting: boolean,
  aiStage: number
): AlgorithmProgress {
  if (!isRunning && (!logs || logs === 'Ожидание запуска...\n' || !logs.trim())) {
    return {
      title: 'Ожидание запуска',
      description: 'Загрузите файлы проекта и нажмите «Запустить пайплайн».',
      percent: 0,
      stageName: 'Готов к работе',
      statusType: 'idle',
    };
  }

  if (logs.includes('PROCESSING COMPLETED')) {
    return {
      title: 'Пайплайн успешно завершен',
      description: 'Все этапы проверки выполнены. Артефакты и отчеты сформированы.',
      percent: 100,
      stageName: 'Завершено',
      statusType: 'success',
    };
  }

  if (logs.includes('[FATAL ERROR]') || logs.includes('[CRITICAL ERROR]') || logs.includes('ПРОЦЕСС ЗАВЕРШЕН С ОШИБКОЙ')) {
    return {
      title: 'Остановка из-за ошибки',
      description: 'Выполнение скрипта прервано. Проверьте детали ошибки в консоли.',
      percent: 100,
      stageName: 'Ошибка',
      statusType: 'error',
    };
  }

  if (aiWaiting) {
    if (aiStage === 1) {
      return {
        title: 'Пауза: Анализ даташита нейросетью',
        description: 'Извлечение назначения выводов из фрагментов документации через LLM.',
        percent: 25,
        stageName: 'Этап 1: Даташит',
        statusType: 'waiting',
      };
    }
    return {
      title: 'Пауза: Текстовое описание схемы нейросетью',
      description: 'Генерация словесного описания электрических связей между компонентами.',
      percent: 85,
      stageName: 'Этап 2: Схема',
      statusType: 'waiting',
    };
  }

  if (logs.includes('11_netlist_datasheet_sorter') || logs.includes('Step 8')) {
    return {
      title: 'Сортировка и сопоставление схемы с даташитом',
      description: 'Финальная сверка реальных цепей платы с описанием из документации.',
      percent: 95,
      stageName: 'Финальный анализ',
      statusType: 'running',
    };
  }
  if (logs.includes('10_filter_components') || logs.includes('9_circuit_parser')) {
    return {
      title: 'Фильтрация компонентов и парсинг схемы',
      description: 'Исключение второстепенных элементов и подготовка финального списка цепей.',
      percent: 90,
      stageName: 'Фильтрация',
      statusType: 'running',
    };
  }
  if (logs.includes('prompt_outputs_2') || logs.includes('Generating prompts for scheme-to-text')) {
    return {
      title: 'Подготовка промптов описания схемы',
      description: 'Формирование запросов к нейросети по электрическим соединениям.',
      percent: 80,
      stageName: 'Подготовка промптов',
      statusType: 'running',
    };
  }
  if (logs.includes('Merging all PCB results') || logs.includes('7_text_appender')) {
    return {
      title: 'Слияние результатов по всем участкам платы',
      description: 'Объединение промежуточных цепей и ветвей всех обработанных файлов.',
      percent: 75,
      stageName: 'Слияние результатов',
      statusType: 'running',
    };
  }
  if (logs.includes('8_merge_pin_fields') || logs.includes('Step 6')) {
    return {
      title: 'Сопоставление цепей платы с выводами даташита',
      description: 'Связывание найденных цепей на плате с пинами микросхемы.',
      percent: 70,
      stageName: 'Сопоставление пинов',
      statusType: 'running',
    };
  }
  if (logs.includes('4_get_branch') || logs.includes('5_graph_to_text') || logs.includes('Step 5')) {
    return {
      title: 'Выделение ветвей целевого компонента',
      description: 'Трассировка электрических цепочек от выводов микросхемы к соседним узлам.',
      percent: 60,
      stageName: 'Выделение ветвей',
      statusType: 'running',
    };
  }
  if (logs.includes('Step 4') || logs.includes('Graph Simplify') || logs.includes('1_netlist_to_graph')) {
    return {
      title: 'Построение и упрощение графа соединений',
      description: 'Топологический анализ графа и сжатие пассивных дискретных цепочек.',
      percent: 50,
      stageName: 'Графовый анализ',
      statusType: 'running',
    };
  }
  if (logs.includes('Step 3') || logs.includes('PCB to Netlist') || logs.includes('1_convert_to_utf8')) {
    return {
      title: 'Парсинг файла платы PcbDoc в нетлист',
      description: 'Чтение бинарной структуры Altium и выделение цепей и компонентов.',
      percent: 40,
      stageName: 'Парсинг PcbDoc',
      statusType: 'running',
    };
  }
  if (logs.includes('3_pin_processor') || logs.includes('Сохранение сжатого даташита')) {
    return {
      title: 'Сборка сжатого даташита',
      description: 'Объединение извлеченных данных о пинах в единую базу.',
      percent: 35,
      stageName: 'Сборка даташита',
      statusType: 'running',
    };
  }
  if (logs.includes('2_large_file_slicer') || logs.includes('Slicing datasheet')) {
    return {
      title: 'Нарезка даташита на фрагменты',
      description: 'Разбиение текста даташита на блоки для анализа в нейросети.',
      percent: 18,
      stageName: 'Нарезка даташита',
      statusType: 'running',
    };
  }
  if (logs.includes('0_pdf_to_md') || logs.includes('Converting PDF')) {
    return {
      title: 'Конвертация PDF даташита в Markdown',
      description: 'Преобразование исходного PDF документа в структурированный текст.',
      percent: 10,
      stageName: 'Конвертация PDF',
      statusType: 'running',
    };
  }

  return {
    title: isRunning ? 'Инициализация и запуск пайплайна' : 'Процесс завершен',
    description: isRunning ? 'Подготовка окружения и запуск скриптов обработки...' : 'Ожидание дальнейших команд.',
    percent: isRunning ? 5 : 0,
    stageName: isRunning ? 'Инициализация' : 'Готов',
    statusType: isRunning ? 'running' : 'idle',
  };
}
