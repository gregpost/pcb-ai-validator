import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Robust detection of pdf-parse across different versions:
 * - v1.x exports a default function: pdf(dataBuffer, options)
 * - v2.x exports { PDFParse: class ... }
 */
function resolvePdfParser() {
  try {
    const pdfMod = require('pdf-parse');
    if (pdfMod && typeof pdfMod.PDFParse === 'function') {
      return { type: 'v2' as const, PDFParse: pdfMod.PDFParse };
    }
    if (typeof pdfMod === 'function') {
      return { type: 'v1' as const, parse: pdfMod };
    }
    if (pdfMod && pdfMod.default) {
      if (typeof pdfMod.default.PDFParse === 'function') {
        return { type: 'v2' as const, PDFParse: pdfMod.default.PDFParse };
      }
      if (typeof pdfMod.default === 'function') {
        return { type: 'v1' as const, parse: pdfMod.default };
      }
    }
  } catch (err) {
    console.warn('[PDF] Warning: could not require pdf-parse directly:', err);
  }
  return null;
}

/**
 * Formats a block of rows into GitHub-flavored Markdown table
 */
function formatTableToMarkdown(rows: string[][], tableHeader: string = '### Table'): string[] {
  if (!rows || rows.length === 0) return [];
  const maxCols = Math.max(...rows.map(r => r.length));
  if (maxCols <= 1) {
    return rows.map(r => r.join(' ').trim()).filter(Boolean);
  }

  const result: string[] = [];
  result.push(tableHeader);
  result.push('');

  const header = rows[0].concat(Array(maxCols - rows[0].length).fill(''));
  result.push('| ' + header.map(c => c.trim().replace(/\|/g, '\\|')).join(' | ') + ' |');
  result.push('|' + Array(maxCols).fill(':---:').join('|') + '|');

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i].concat(Array(maxCols - rows[i].length).fill(''));
    result.push('| ' + row.map(c => c.trim().replace(/\|/g, '\\|')).join(' | ') + ' |');
  }
  result.push('');
  return result;
}

/**
 * Converts extracted raw PDF page text into structured Markdown with tables and headers
 */
function convertTextToMarkdown(pagesText: string[], minLineLen: number = 10): string[] {
  const mdLines: string[] = [];
  let currentTable: string[][] = [];
  let pendingTableHeader = '';

  function flushTable() {
    if (currentTable.length > 0) {
      const formatted = formatTableToMarkdown(currentTable, pendingTableHeader || '### Table');
      for (const fLine of formatted) {
        mdLines.push(fLine);
      }
      currentTable = [];
      pendingTableHeader = '';
    }
  }

  for (const pageText of pagesText) {
    if (!pageText) continue;
    const rawLines = pageText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    for (const line of rawLines) {
      if (line.includes('\t')) {
        const cells = line.split('\t').map(c => c.trim());
        currentTable.push(cells);
      } else {
        flushTable();
        if (/^Table\s+\d+/i.test(line)) {
          pendingTableHeader = `### ${line}`;
        } else if (/^(?:Section\s+\d+|[0-9]+(?:\.[0-9]+)*\s+[A-Z])/i.test(line)) {
          mdLines.push(`## ${line}`);
        } else if (line.length >= minLineLen) {
          mdLines.push(line);
        }
      }
    }
    flushTable();
  }

  return mdLines;
}

/**
 * Fallback to python pdf2markdown4llm script if available
 */
function tryPythonFallback(inputPath: string, outputPath: string, minLineLen: number): boolean {
  const candidates = [
    path.resolve(__dirname, '../../python/huge_file/0_pdf_to_md.py'),
    path.resolve(__dirname, '../../../src/python/huge_file/0_pdf_to_md.py')
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        console.log(`[PDF] Executing python fallback converter: ${candidate}`);
        execFileSync('python3', [candidate, inputPath, outputPath, minLineLen.toString()], {
          stdio: 'inherit'
        });
        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
          console.log(`[PDF] Python fallback successfully generated ${outputPath}`);
          return true;
        }
      } catch (err) {
        console.warn(`[PDF] Python fallback failed:`, err);
      }
    }
  }
  return false;
}

/**
 * Main export: Converts PDF to Markdown and filters short lines
 */
export async function pdfToMd(inputPath: string, outputPath: string, minLineLen: number = 10): Promise<void> {
  const resolvedInput = path.resolve(inputPath);
  const resolvedOutput = path.resolve(outputPath);

  if (!fs.existsSync(resolvedInput)) {
    throw new Error(`[PDF ERROR] Input file not found: ${resolvedInput}`);
  }

  const outDir = path.dirname(resolvedOutput);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log(`[PDF] Converting ${path.basename(resolvedInput)} to Markdown...`);

  const parserInfo = resolvePdfParser();
  let pagesText: string[] = [];
  let totalPages = 0;

  if (parserInfo) {
    try {
      const dataBuffer = fs.readFileSync(resolvedInput);

      if (parserInfo.type === 'v2') {
        const parser = new parserInfo.PDFParse({ data: dataBuffer });
        const textResult = await parser.getText();
        totalPages = textResult.total || (textResult.pages ? textResult.pages.length : 1);
        if (textResult.pages && Array.isArray(textResult.pages)) {
          pagesText = textResult.pages.map((p: any) => p.text || '');
        } else if (textResult.text) {
          pagesText = [textResult.text];
        }
        if (typeof parser.destroy === 'function') {
          await parser.destroy();
        }
      } else {
        const data = await parserInfo.parse(dataBuffer);
        totalPages = data.numpages || 1;
        pagesText = [data.text || ''];
      }

      console.log(`[PDF] Extracted ${totalPages} pages from ${path.basename(resolvedInput)}`);

      const mdLines = convertTextToMarkdown(pagesText, minLineLen);
      fs.writeFileSync(resolvedOutput, mdLines.join('\n'), 'utf8');
      console.log(`[PDF] Successfully wrote ${mdLines.length} Markdown lines to ${path.basename(resolvedOutput)}`);
      return;
    } catch (err) {
      console.warn(`[PDF] Native TS parsing failed (${err}), attempting fallback...`);
    }
  }

  // If native parsing failed or was unavailable, try python fallback
  const fallbackSuccess = tryPythonFallback(resolvedInput, resolvedOutput, minLineLen);
  if (!fallbackSuccess) {
    throw new Error(`[PDF ERROR] Failed to convert PDF to Markdown for ${path.basename(resolvedInput)} using both TypeScript and Python converters.`);
  }
}

// CLI support (run via tsx or node)
if (process.argv[1] && (process.argv[1].endsWith('0_pdf_to_md.ts') || process.argv[1].endsWith('0_pdf_to_md.js'))) {
  const [inP, outP, minL] = process.argv.slice(2);
  if (inP && outP) {
    pdfToMd(inP, outP, minL ? parseInt(minL, 10) : 10).catch(err => {
      console.error(err);
      process.exit(1);
    });
  }
}
