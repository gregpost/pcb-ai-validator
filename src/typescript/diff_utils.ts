// file: src/typescript/diff_utils.ts
// Utility module for line-by-line diff calculation, project file scanning, and version bumping

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface DiffLine {
  type: 'add' | 'delete' | 'context';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface FileDiffResult {
  path: string;
  status: 'modified' | 'added' | 'deleted';
  isBinary: boolean;
  oldSize?: number;
  newSize?: number;
  additions: number;
  deletions: number;
  lines: DiffLine[];
}

export interface VersionBumpResult {
  oldVersion: string;
  newVersion: string;
  oldBuild: number;
  newBuild: number;
  updatedAt: string;
}

// Check if a buffer represents binary content
export function isBinaryBuffer(buf: Buffer): boolean {
  const len = Math.min(buf.length, 8000);
  for (let i = 0; i < len; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}

// Common binary file extensions
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.svgz',
  '.pdf', '.zip', '.tar', '.gz', '.tgz', '.7z', '.bin',
  '.pcbdoc', '.pcbsch', '.schdoc', '.exe', '.dll', '.so', '.dylib',
  '.woff', '.woff2', '.ttf', '.eot', '.mp3', '.mp4'
]);

export function isBinaryPath(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

// Calculate Git Blob SHA (sha1("blob <size>\0<content>"))
export function calculateGitBlobSha(buffer: Buffer): string {
  const header = `blob ${buffer.length}\0`;
  const hash = crypto.createHash('sha1');
  hash.update(header);
  hash.update(buffer);
  return hash.digest('hex');
}

export function getFileGitBlobSha(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) return null;
    const content = fs.readFileSync(filePath);
    return calculateGitBlobSha(content);
  } catch {
    return null;
  }
}

// Fast Myers / LCS line-by-line diff generator
export function computeLineDiff(oldText: string, newText: string): { additions: number; deletions: number; lines: DiffLine[] } {
  // Normalize line endings
  const oldRaw = oldText ? oldText.replace(/\r\n/g, '\n').replace(/\r/g, '\n') : '';
  const newRaw = newText ? newText.replace(/\r\n/g, '\n').replace(/\r/g, '\n') : '';

  const oldLines = oldRaw.length > 0 ? oldRaw.split('\n') : [];
  const newLines = newRaw.length > 0 ? newRaw.split('\n') : [];

  // Edge case: added file
  if (oldLines.length === 0) {
    const lines: DiffLine[] = newLines.map((content, idx) => ({
      type: 'add',
      content,
      newLineNumber: idx + 1
    }));
    return { additions: lines.length, deletions: 0, lines };
  }

  // Edge case: deleted file
  if (newLines.length === 0) {
    const lines: DiffLine[] = oldLines.map((content, idx) => ({
      type: 'delete',
      content,
      oldLineNumber: idx + 1
    }));
    return { additions: 0, deletions: lines.length, lines };
  }

  // Find common prefix
  let prefix = 0;
  while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) {
    prefix++;
  }

  // Find common suffix
  let suffix = 0;
  while (
    suffix < oldLines.length - prefix &&
    suffix < newLines.length - prefix &&
    oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]
  ) {
    suffix++;
  }

  const result: DiffLine[] = [];
  let additions = 0;
  let deletions = 0;

  // Add prefix context lines
  for (let i = 0; i < prefix; i++) {
    result.push({
      type: 'context',
      content: oldLines[i],
      oldLineNumber: i + 1,
      newLineNumber: i + 1
    });
  }

  // Slice middle
  const oldMiddle = oldLines.slice(prefix, oldLines.length - suffix);
  const newMiddle = newLines.slice(prefix, newLines.length - suffix);

  const startOldNo = prefix + 1;
  const startNewNo = prefix + 1;

  // If middle is too large (e.g. > 1500 lines each), use simple block replacement to avoid CPU freeze
  if (oldMiddle.length * newMiddle.length > 2000000 || oldMiddle.length > 2000 || newMiddle.length > 2000) {
    for (let i = 0; i < oldMiddle.length; i++) {
      result.push({
        type: 'delete',
        content: oldMiddle[i],
        oldLineNumber: startOldNo + i
      });
      deletions++;
    }
    for (let j = 0; j < newMiddle.length; j++) {
      result.push({
        type: 'add',
        content: newMiddle[j],
        newLineNumber: startNewNo + j
      });
      additions++;
    }
  } else {
    // Dynamic programming LCS on middle
    const n = oldMiddle.length;
    const m = newMiddle.length;
    const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < m; j++) {
        if (oldMiddle[i] === newMiddle[j]) {
          dp[i + 1][j + 1] = dp[i][j] + 1;
        } else {
          dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
    }

    // Backtrack LCS
    let i = n;
    let j = m;
    const middleDiff: DiffLine[] = [];

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && oldMiddle[i - 1] === newMiddle[j - 1]) {
        middleDiff.unshift({
          type: 'context',
          content: oldMiddle[i - 1],
          oldLineNumber: startOldNo + i - 1,
          newLineNumber: startNewNo + j - 1
        });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        middleDiff.unshift({
          type: 'add',
          content: newMiddle[j - 1],
          newLineNumber: startNewNo + j - 1
        });
        additions++;
        j--;
      } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
        middleDiff.unshift({
          type: 'delete',
          content: oldMiddle[i - 1],
          oldLineNumber: startOldNo + i - 1
        });
        deletions++;
        i--;
      }
    }

    result.push(...middleDiff);
  }

  // Add suffix context lines
  const oldSuffixStart = oldLines.length - suffix;
  const newSuffixStart = newLines.length - suffix;
  for (let k = 0; k < suffix; k++) {
    result.push({
      type: 'context',
      content: oldLines[oldSuffixStart + k],
      oldLineNumber: oldSuffixStart + k + 1,
      newLineNumber: newSuffixStart + k + 1
    });
  }

  return { additions, deletions, lines: result };
}

// Scans local project directory for files eligible to push to GitHub
export function scanProjectFiles(rootDir: string): Map<string, { relativePath: string; fullPath: string; sha: string; size: number; isBinary: boolean }> {
  const result = new Map<string, { relativePath: string; fullPath: string; sha: string; size: number; isBinary: boolean }>();

  const ignoredDirs = new Set([
    'node_modules',
    '.git',
    'dist',
    'build',
    'coverage',
    'tmp',
    '.cache',
    'runs',
    'PcbDocs',
    '.next'
  ]);

  const ignoredExactFiles = new Set([
    'bun.lock',
    '.DS_Store',
    'pipeline.log'
  ]);

  function walk(currentDir: string, relDir: string = '') {
    if (!fs.existsSync(currentDir)) return;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const name = entry.name;
      const fullPath = path.join(currentDir, name);
      const relPath = relDir ? `${relDir}/${name}` : name;

      if (entry.isDirectory()) {
        if (ignoredDirs.has(name) || name.startsWith('.git')) {
          continue;
        }
        walk(fullPath, relPath);
      } else if (entry.isFile()) {
        if (ignoredExactFiles.has(name)) continue;
        if (name.endsWith('.log')) continue;
        // Ignore .env, .env.local, but KEEP .env.example
        if (name.startsWith('.env') && name !== '.env.example') continue;

        try {
          const stat = fs.statSync(fullPath);
          const buf = fs.readFileSync(fullPath);
          const isBin = isBinaryPath(name) || isBinaryBuffer(buf);
          const sha = calculateGitBlobSha(buf);
          result.set(relPath, {
            relativePath: relPath,
            fullPath,
            sha,
            size: stat.size,
            isBinary: isBin
          });
        } catch (e) {
          console.warn(`Could not read file for push scanning: ${relPath}`, e);
        }
      }
    }
  }

  walk(rootDir);
  return result;
}

// Parse semver into numeric parts
export function parseSemVerParts(v: string): [number, number, number] {
  if (!v) return [1, 0, 0];
  const cleaned = String(v).replace(/^v/i, '').trim();
  const parts = cleaned.split(/[\.-]/).map(p => parseInt(p, 10) || 0);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

// Compute the next bumped version
export function computeNextVersion(currentVersion: string, bumpType: 'patch' | 'minor' | 'major' = 'patch'): string {
  const [major, minor, patch] = parseSemVerParts(currentVersion);
  if (bumpType === 'major') {
    return `${major + 1}.0.0`;
  }
  if (bumpType === 'minor') {
    return `${major}.${minor + 1}.0`;
  }
  return `${major}.${minor}.${patch + 1}`;
}

// Automatically bump version in version.json, VERSION, and package.json
export function bumpProjectVersion(rootDir: string, bumpType: 'patch' | 'minor' | 'major' = 'patch'): VersionBumpResult {
  const versionJsonPath = path.join(rootDir, 'version.json');
  const versionTxtPath = path.join(rootDir, 'VERSION');
  const packageJsonPath = path.join(rootDir, 'package.json');

  let currentVersion = '1.0.1';
  let currentBuild = 1;
  let releaseName = 'PCB AI Validator Release';
  let description = 'Интеллектуальный помощник отладки проектов печатных плат Altium Designer';

  // Read current version.json
  if (fs.existsSync(versionJsonPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
      if (data.version) currentVersion = String(data.version).trim();
      if (typeof data.build === 'number') currentBuild = data.build;
      if (data.releaseName) releaseName = data.releaseName;
      if (data.description) description = data.description;
    } catch (e) {
      console.warn('Failed reading version.json during bump:', e);
    }
  } else if (fs.existsSync(versionTxtPath)) {
    try {
      const txt = fs.readFileSync(versionTxtPath, 'utf8').trim();
      if (txt) currentVersion = txt;
    } catch {}
  }

  const nextVersion = computeNextVersion(currentVersion, bumpType);
  const nextBuild = currentBuild + 1;
  const nowIso = new Date().toISOString();

  // 1. Update version.json
  const versionJsonData = {
    version: nextVersion,
    build: nextBuild,
    releaseName,
    description,
    updatedAt: nowIso
  };
  fs.writeFileSync(versionJsonPath, JSON.stringify(versionJsonData, null, 2) + '\n', 'utf8');

  // 2. Update VERSION
  fs.writeFileSync(versionTxtPath, `${nextVersion}\n`, 'utf8');

  // 3. Update package.json
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      pkg.version = nextVersion;
      fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    } catch (e) {
      console.warn('Failed updating package.json during bump:', e);
    }
  }

  return {
    oldVersion: currentVersion,
    newVersion: nextVersion,
    oldBuild: currentBuild,
    newBuild: nextBuild,
    updatedAt: nowIso
  };
}
