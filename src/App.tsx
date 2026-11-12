// file: src/App.tsx
// Main application component for PCB AI Validator console

import { useState, useEffect, useRef } from 'react';

interface AppFile {
  name: string;
  type: 'pcbdoc' | 'pcbsch' | 'pdf' | 'txt';
}

export interface ArtifactItem {
  category: 'datasheet' | 'pcb_to_netlist' | 'graph' | 'final' | 'other';
  stageName: string;
  scriptName: string;
  fileName: string;
  relativePath: string;
  size: number;
  formattedSize: string;
  isText: boolean;
  lineCount?: number;
}

export interface ArtifactsResponse {
  runs: string[];
  currentRun: string | null;
  artifacts: ArtifactItem[];
}

export interface PromptItem {
  index: number;
  fileName: string;
  total: number;
  content: string;
}

export interface GitHubFileItem {
  path: string;
  name: string;
  size: number;
  formattedSize: string;
  fileType: 'pcbdoc' | 'pcbsch' | 'pdf' | 'txt' | 'other';
  category: 'pcb' | 'pdf' | 'txt' | 'other';
  targetFolder: string;
  sha: string;
}

export interface GitHubRepoInfo {
  owner: string;
  repo: string;
  fullName: string;
  defaultBranch: string;
  isPrivate: boolean;
  description: string;
  stars: number;
  url: string;
}

export interface ProjectVersionInfo {
  repo: string;
  branch: string;
  commitSha: string | null;
  shortSha: string | null;
  commitMessage: string;
  author: string;
  commitDate: string | null;
  syncedAt: string | null;
  appVersion?: string;
  build?: number;
  releaseName?: string;
  fileSource?: string;
  updatedFilesCount?: number;
  commit?: string;
  updatedAt?: string;
}

export interface ProjectUpdateCheckResult {
  upToDate: boolean;
  hasVersionDiff?: boolean;
  versionDiffStatus?: 'newer' | 'older' | 'same';
  versionComparisonMessage?: string;
  localAppVersion?: { version: string; build?: number; releaseName?: string; fileSource: string };
  remoteAppVersion?: { version: string; build?: number; releaseName?: string; fileSource: string } | null;
  hasCodeDiff?: boolean;
  diffFiles?: Array<{ path: string; status: 'modified' | 'added' | 'deleted' }>;
  checkedFilesCount?: number;
  currentVersion: ProjectVersionInfo;
  latestCommit: {
    sha: string;
    shortSha: string;
    message: string;
    author: string;
    authorLogin: string;
    authorAvatar: string;
    date: string;
    htmlUrl: string;
  };
  commitsAhead: Array<{
    sha: string;
    fullSha: string;
    message: string;
    fullMessage: string;
    author: string;
    date: string;
  }>;
  changedFiles: Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    changes: number;
  }>;
  repo: string;
  branch: string;
}

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

export interface PushDiffResponse {
  repo: string;
  branch: string;
  commitSha: string;
  shortSha: string;
  currentVersion: string;
  currentBuild: number;
  nextVersion: string;
  nextBuild: number;
  bumpType: 'patch' | 'minor' | 'major';
  summary: {
    totalChanged: number;
    additions: number;
    deletions: number;
    modifiedCount: number;
    addedCount: number;
    deletedCount: number;
  };
  files: FileDiffResult[];
}

export interface PushResponse {
  success: boolean;
  alreadyUpToDate?: boolean;
  newCommitSha?: string;
  shortSha?: string;
  commitUrl?: string;
  repo?: string;
  branch?: string;
  oldVersion?: string;
  newVersion?: string;
  newBuild?: number;
  pushedFilesCount?: number;
  message?: string;
  error?: string;
}

export interface UploadQueueItem {
  id: string;
  name: string;
  size: number;
  loaded: number;
  percent: number;
  type: 'pcbdoc' | 'pdf' | 'txt' | 'other';
  status: 'uploading' | 'processing' | 'done' | 'error';
  errorMessage?: string;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 Б';
  const k = 1024;
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function App() {
  const [logs, setLogs] = useState('Ожидание запуска...\n');
  const [status, setStatus] = useState('Готов к запуску');
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'console' | 'prompts' | 'artifacts'>('console');
  
  // Artifacts state
  const [runs, setRuns] = useState<string[]>([]);
  const [selectedRun, setSelectedRun] = useState<string>('');
  const [artifacts, setArtifacts] = useState<ArtifactItem[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState<ArtifactItem | null>(null);
  const [artifactContent, setArtifactContent] = useState<string>('');
  const [isLoadingArtifact, setIsLoadingArtifact] = useState(false);
  const [artifactCategoryFilter, setArtifactCategoryFilter] = useState<'all' | 'datasheet' | 'pcb_to_netlist' | 'graph' | 'final'>('all');
  const [artifactSearchQuery, setArtifactSearchQuery] = useState('');
  const [copiedArtifact, setCopiedArtifact] = useState(false);

  // AI prompt interaction and pause states
  const [aiWaiting, setAiWaiting] = useState(false);
  const [aiStage, setAiStage] = useState<number>(1);
  const [aiStageTitle, setAiStageTitle] = useState('');
  const [aiStageDesc, setAiStageDesc] = useState('');
  const [sidebarTab, setSidebarTab] = useState<'main' | 'files'>('main');
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [currentPromptIdx, setCurrentPromptIdx] = useState(0);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(false);
  const [promptValidationError, setPromptValidationError] = useState('');
  const [aiAnswersMap, setAiAnswersMap] = useState<Record<number, string>>(() => {
    try {
      const saved = localStorage.getItem('pcb_ai_answers_map');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [isSubmittingAi, setIsSubmittingAi] = useState(false);
  const [copiedPromptId, setCopiedPromptId] = useState<number | null>(null);
  const prevAiWaitingRef = useRef(false);
  const loadedPromptsStageRef = useRef<number | null>(null);
  const promptsRef = useRef<PromptItem[]>([]);
  promptsRef.current = prompts;

  const [targetComponent, setTargetComponent] = useState(() => {
    return localStorage.getItem('pcb_target_component') || '';
  });
  const [targetError, setTargetError] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const [pdfErrorMessage, setPdfErrorMessage] = useState('');
  const [pinsError, setPinsError] = useState(false);
  const [pinsErrorMessage, setPinsErrorMessage] = useState('');
  const [pcbCompError, setPcbCompError] = useState(false);
  const [pcbCompErrorMessage, setPcbCompErrorMessage] = useState('');
  const [engine, setEngine] = useState<'typescript' | 'python'>(() => {
    return (localStorage.getItem('pcb_engine') as 'typescript' | 'python') || 'typescript';
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(window.innerWidth <= 768);
  const [files, setFiles] = useState<AppFile[]>([]);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const scrollRef = useRef<HTMLPreElement>(null);
  const isAtBottom = useRef(true);

  // Сохранение настроек в localStorage
  useEffect(() => {
    try {
      localStorage.setItem('pcb_target_component', targetComponent);
    } catch {}
  }, [targetComponent]);

  useEffect(() => {
    try {
      localStorage.setItem('pcb_engine', engine);
    } catch {}
  }, [engine]);

  // Сохранение ответов ИИ в localStorage
  useEffect(() => {
    try {
      localStorage.setItem('pcb_ai_answers_map', JSON.stringify(aiAnswersMap));
    } catch {}
  }, [aiAnswersMap]);

  // GitHub integration state
  const [showGitHubModal, setShowGitHubModal] = useState(false);
  const [gitHubRepoInput, setGitHubRepoInput] = useState(() => {
    const saved = localStorage.getItem('pcb_github_repo_input');
    if (!saved || saved === 'OLIMEX/OLINUXINO' || saved === 'gregpost/pcbdoc-ai-validator') {
      return 'gregpost/pcb-ai-validator';
    }
    return saved;
  });
  const [gitHubToken, setGitHubToken] = useState(() => {
    return localStorage.getItem('pcb_github_pat') || '';
  });
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [isConnectingGitHub, setIsConnectingGitHub] = useState(false);
  const [gitHubConnectError, setGitHubConnectError] = useState('');
  const [gitHubConnectedRepo, setGitHubConnectedRepo] = useState<GitHubRepoInfo | null>(null);
  const [gitHubBranches, setGitHubBranches] = useState<string[]>([]);
  const [gitHubSelectedBranch, setGitHubSelectedBranch] = useState<string>('');
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [gitHubFiles, setGitHubFiles] = useState<GitHubFileItem[]>([]);
  const [gitHubSearchQuery, setGitHubSearchQuery] = useState('');
  const [gitHubCategoryFilter, setGitHubCategoryFilter] = useState<'all' | 'pcb' | 'pdf' | 'txt'>('all');
  const [gitHubSelectedPaths, setGitHubSelectedPaths] = useState<string[]>([]);
  const [isDownloadingGitHub, setIsDownloadingGitHub] = useState(false);
  const [gitHubDownloadSuccess, setGitHubDownloadSuccess] = useState('');
  const [downloadingSinglePath, setDownloadingSinglePath] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('pcb_github_repo_input', gitHubRepoInput);
    } catch {}
  }, [gitHubRepoInput]);

  useEffect(() => {
    try {
      if (gitHubToken) {
        localStorage.setItem('pcb_github_pat', gitHubToken);
      } else {
        localStorage.removeItem('pcb_github_pat');
      }
    } catch {}
  }, [gitHubToken]);

  // GitHub project update state
  const [gitHubModalTab, setGitHubModalTab] = useState<'update' | 'push' | 'files'>('update');
  const [projectVersion, setProjectVersion] = useState<ProjectVersionInfo | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateCheckResult, setUpdateCheckResult] = useState<ProjectUpdateCheckResult | null>(null);
  const [updateError, setUpdateError] = useState('');
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);
  const [updateSuccessMessage, setUpdateSuccessMessage] = useState('');
  const [updatedFilesList, setUpdatedFilesList] = useState<string[]>([]);

  // Push & Diff state
  const [pushRepoInput, setPushRepoInput] = useState(() => {
    return localStorage.getItem('pcb_github_push_repo') || 'gregpost/pcb-ai-validator';
  });
  const [pushBranchInput, setPushBranchInput] = useState(() => {
    return localStorage.getItem('pcb_github_push_branch') || 'main';
  });
  const [pushBumpType, setPushBumpType] = useState<'patch' | 'minor' | 'major'>('patch');
  const [pushCommitMessage, setPushCommitMessage] = useState('');
  const [pushForce, setPushForce] = useState(false);
  const [isLoadingDiff, setIsLoadingDiff] = useState(false);
  const [diffResult, setDiffResult] = useState<PushDiffResponse | null>(null);
  const [diffError, setDiffError] = useState('');
  const [selectedDiffPath, setSelectedDiffPath] = useState<string | null>(null);
  const [diffFilterStatus, setDiffFilterStatus] = useState<'all' | 'modified' | 'added' | 'deleted'>('all');
  const [isPushing, setIsPushing] = useState(false);
  const [pushResult, setPushResult] = useState<PushResponse | null>(null);
  const [pushError, setPushError] = useState('');
  const [showTokenSettings, setShowTokenSettings] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('pcb_github_push_repo', pushRepoInput);
    } catch {}
  }, [pushRepoInput]);

  useEffect(() => {
    try {
      localStorage.setItem('pcb_github_push_branch', pushBranchInput);
    } catch {}
  }, [pushBranchInput]);

  // Запрос текущей локальной версии проекта
  const fetchProjectVersion = async () => {
    try {
      const resp = await fetch('/api/project/version');
      if (resp.ok) {
        const data = await resp.json();
        setProjectVersion(data);
      }
    } catch (e) {
      console.error('Failed fetching project version:', e);
    }
  };

  // Проверка обновлений проекта на GitHub
  const checkProjectUpdate = async (targetRepo?: string, targetBranch?: string) => {
    const repoToCheck = (targetRepo || gitHubRepoInput || 'gregpost/pcb-ai-validator').trim();
    const branchToCheck = (targetBranch || gitHubSelectedBranch || 'main').trim();

    setIsCheckingUpdate(true);
    setUpdateError('');
    setUpdateSuccessMessage('');

    try {
      const resp = await fetch('/api/project/check-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo: repoToCheck,
          branch: branchToCheck,
          token: gitHubToken.trim() || undefined
        })
      });

      const data = await resp.json();
      if (!resp.ok) {
        setUpdateError(data.error || 'Не удалось проверить обновления проекта');
        setIsCheckingUpdate(false);
        return;
      }

      setUpdateCheckResult(data);
      if (data.currentVersion) {
        setProjectVersion(data.currentVersion);
      }
    } catch (err: any) {
      setUpdateError('Ошибка сети при проверке обновлений: ' + err.message);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  // Применение обновления проекта
  const applyProjectUpdate = async () => {
    if (!updateCheckResult?.latestCommit?.sha) return;

    setIsApplyingUpdate(true);
    setUpdateError('');
    setUpdateSuccessMessage('');

    try {
      const resp = await fetch('/api/project/apply-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo: updateCheckResult.repo || gitHubRepoInput,
          branch: updateCheckResult.branch || 'main',
          commitSha: updateCheckResult.latestCommit.sha,
          token: gitHubToken.trim() || undefined
        })
      });

      const data = await resp.json();
      if (!resp.ok) {
        setUpdateError(data.error || 'Не удалось применить обновление проекта');
        setIsApplyingUpdate(false);
        return;
      }

      setUpdateSuccessMessage(data.message || 'Проект успешно обновлен');
      setUpdatedFilesList(data.updatedFiles || []);
      if (data.version) {
        setProjectVersion(data.version);
      }
      setUpdateCheckResult(prev => prev ? { ...prev, upToDate: true } : null);

      setLogs(prev => prev + `\n[INFO] ${data.message}\nОбновлено компонентов:\n - ${(data.updatedFiles || []).join('\n - ')}\n`);
      fetchFiles();
      fetchArtifacts();
    } catch (err: any) {
      setUpdateError('Ошибка сети при обновлении проекта: ' + err.message);
    } finally {
      setIsApplyingUpdate(false);
    }
  };

  // Запрос диффа правок для отправки в GitHub
  const fetchPushDiff = async (overrideBumpType?: 'patch' | 'minor' | 'major') => {
    setIsLoadingDiff(true);
    setDiffError('');
    setPushError('');
    setPushResult(null);

    const effectiveBump = overrideBumpType || pushBumpType;

    try {
      const resp = await fetch('/api/project/push-diff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo: pushRepoInput.trim() || 'gregpost/pcb-ai-validator',
          branch: pushBranchInput.trim() || 'main',
          token: gitHubToken.trim(),
          bumpType: effectiveBump
        })
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || `Ошибка получения диффа (${resp.status})`);
      }

      setDiffResult(data);
      if (data.files && data.files.length > 0) {
        if (!selectedDiffPath || !data.files.some((f: FileDiffResult) => f.path === selectedDiffPath)) {
          setSelectedDiffPath(data.files[0].path);
        }
      } else {
        setSelectedDiffPath(null);
      }
    } catch (err: any) {
      setDiffError(err.message || 'Не удалось получить дифф изменений');
    } finally {
      setIsLoadingDiff(false);
    }
  };

  // Выполнение отправки (Push) в GitHub с автоповышением версии
  const handleExecutePush = async () => {
    if (!gitHubToken.trim()) {
      setPushError('Для отправки изменений укажите Personal Access Token (PAT) GitHub с правами на запись (scope "repo").');
      setShowTokenSettings(true);
      return;
    }

    setIsPushing(true);
    setPushError('');
    setPushResult(null);

    try {
      const resp = await fetch('/api/project/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo: pushRepoInput.trim() || 'gregpost/pcb-ai-validator',
          branch: pushBranchInput.trim() || 'main',
          token: gitHubToken.trim(),
          commitMessage: pushCommitMessage.trim(),
          bumpType: pushBumpType,
          forcePush: pushForce
        })
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || `Ошибка отправки пуша (${resp.status})`);
      }

      setPushResult(data);
      setPushCommitMessage('');

      // Обновляем версию проекта в состоянии UI
      await fetchProjectVersion();

      // Запрашиваем обновленный дифф
      await fetchPushDiff();
    } catch (err: any) {
      setPushError(err.message || 'Ошибка отправки пуша в GitHub');
    } finally {
      setIsPushing(false);
    }
  };

  // GitHub API handlers
  const connectGitHubRepo = async (targetRepo?: string) => {
    const repoToConnect = (targetRepo || gitHubRepoInput).trim();
    if (!repoToConnect) {
      setGitHubConnectError('Укажите имя репозитория (например: OLIMEX/OLINUXINO)');
      return;
    }

    setIsConnectingGitHub(true);
    setGitHubConnectError('');
    setGitHubDownloadSuccess('');

    try {
      const resp = await fetch('/api/github/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: repoToConnect, token: gitHubToken.trim() || undefined })
      });

      const data = await resp.json();
      if (!resp.ok) {
        setGitHubConnectError(data.error || 'Не удалось подключиться к репозиторию');
        setIsConnectingGitHub(false);
        return;
      }

      // Извлекаем owner и repo из данных ответа или строки запроса
      const cleanRepoStr = repoToConnect
        .replace(/^https?:\/\/github\.com\//i, '')
        .replace(/\.git$/i, '')
        .replace(/^\/+|\/+$/g, '');
      const parts = cleanRepoStr.split('/');
      const fallbackOwner = parts[0] || '';
      const fallbackRepo = parts[1] || '';

      const owner = (typeof data.owner === 'string' && data.owner !== 'undefined' && data.owner.trim())
        ? data.owner.trim()
        : fallbackOwner;
      const repo = (typeof data.repo === 'string' && data.repo !== 'undefined' && data.repo.trim())
        ? data.repo.trim()
        : fallbackRepo;
      const defaultBranch = (typeof data.defaultBranch === 'string' && data.defaultBranch !== 'undefined' && data.defaultBranch.trim())
        ? data.defaultBranch.trim()
        : 'master';

      const repoInfo: GitHubRepoInfo = {
        owner,
        repo,
        fullName: data.fullName || `${owner}/${repo}`,
        defaultBranch,
        isPrivate: !!data.isPrivate,
        description: data.description || '',
        stars: typeof data.stars === 'number' ? data.stars : 0,
        url: data.url || `https://github.com/${owner}/${repo}`
      };

      setGitHubConnectedRepo(repoInfo);
      setGitHubSelectedBranch(defaultBranch);

      // Fetch branches
      try {
        const branchResp = await fetch(
          `/api/github/branches?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}${
            gitHubToken.trim() ? `&token=${encodeURIComponent(gitHubToken.trim())}` : ''
          }`
        );
        if (branchResp.ok) {
          const bData = await branchResp.json();
          setGitHubBranches(Array.isArray(bData.branches) && bData.branches.length > 0 ? bData.branches : [defaultBranch]);
        }
      } catch (bErr) {
        console.warn('Branches fetch error:', bErr);
        setGitHubBranches([defaultBranch]);
      }

      // Load file tree for default branch
      await loadGitHubTree(owner, repo, defaultBranch);
    } catch (err: any) {
      setGitHubConnectError('Ошибка сети при подключении к GitHub: ' + err.message);
    } finally {
      setIsConnectingGitHub(false);
    }
  };

  const loadGitHubTree = async (owner: string, repo: string, branch: string) => {
    const validOwner = (owner || '').trim();
    const validRepo = (repo || '').trim();
    const validBranch = (branch || 'main').trim();

    if (!validOwner || !validRepo || validOwner === 'undefined' || validRepo === 'undefined') {
      setGitHubConnectError('Не указан владелец или имя репозитория');
      return;
    }

    setIsLoadingTree(true);
    setGitHubConnectError('');
    setGitHubSelectedPaths([]);

    try {
      const resp = await fetch(
        `/api/github/tree?owner=${encodeURIComponent(validOwner)}&repo=${encodeURIComponent(validRepo)}&branch=${encodeURIComponent(validBranch)}${
          gitHubToken.trim() ? `&token=${encodeURIComponent(gitHubToken.trim())}` : ''
        }`
      );
      const data = await resp.json();
      if (!resp.ok) {
        setGitHubConnectError(data.error || 'Не удалось получить список файлов');
        setGitHubFiles([]);
        return;
      }

      setGitHubFiles(data.files || []);
      setGitHubSelectedBranch(validBranch);
    } catch (err: any) {
      setGitHubConnectError('Ошибка загрузки дерева файлов: ' + err.message);
      setGitHubFiles([]);
    } finally {
      setIsLoadingTree(false);
    }
  };

  const downloadSelectedGitHubFiles = async (specificFiles?: GitHubFileItem[]) => {
    if (!gitHubConnectedRepo) return;

    const filesToDownload: GitHubFileItem[] = specificFiles
      ? specificFiles
      : gitHubFiles.filter(f => gitHubSelectedPaths.includes(f.path));

    if (filesToDownload.length === 0) {
      return;
    }

    if (specificFiles && specificFiles.length === 1) {
      setDownloadingSinglePath(specificFiles[0].path);
    } else {
      setIsDownloadingGitHub(true);
    }
    setGitHubConnectError('');
    setGitHubDownloadSuccess('');

    try {
      const resp = await fetch('/api/github/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: gitHubConnectedRepo.owner,
          repo: gitHubConnectedRepo.repo,
          branch: gitHubSelectedBranch || gitHubConnectedRepo.defaultBranch,
          token: gitHubToken.trim() || undefined,
          files: filesToDownload.map(f => ({
            path: f.path,
            targetFolder: f.targetFolder,
            name: f.name
          }))
        })
      });

      const data = await resp.json();
      if (!resp.ok) {
        setGitHubConnectError(data.error || 'Ошибка при загрузке файлов с GitHub');
        return;
      }

      const downloadedCount = typeof data.downloadedCount === 'number'
        ? data.downloadedCount
        : (data.downloaded?.length || (Array.isArray(data.results) ? data.results.filter((r: any) => r.success).length : filesToDownload.length));
      setGitHubDownloadSuccess(`Успешно загружено ${downloadedCount} файл(ов) на сервер!`);

      // Remove downloaded files from selection
      const downloadedSet = new Set(filesToDownload.map(f => f.path));
      setGitHubSelectedPaths(prev => prev.filter(p => !downloadedSet.has(p)));

      // Refresh files in the sidebar
      await fetchFiles();
    } catch (err: any) {
      setGitHubConnectError('Сетевая ошибка при скачивании файлов: ' + err.message);
    } finally {
      setIsDownloadingGitHub(false);
      setDownloadingSinglePath(null);
    }
  };

  // Загрузка промптов для указанного этапа
  const loadAiPrompts = async (stageToLoad: number, forceSpinner = false) => {
    // Не показываем блокирующий экран загрузки, если промпты уже загружены (предотвращает мигание)
    if (forceSpinner || promptsRef.current.length === 0) {
      setIsLoadingPrompts(true);
    }
    try {
      const res = await fetch(`/ai-prompts?stage=${stageToLoad}`);
      if (res.ok) {
        const data = await res.json();
        const loadedPrompts: PromptItem[] = data.prompts || [];
        setPrompts(loadedPrompts);
        loadedPromptsStageRef.current = stageToLoad;
        if (loadedPrompts.length > 0) {
          setCurrentPromptIdx(prev => (prev < loadedPrompts.length ? prev : 0));
        }
      }
    } catch (err) {
      console.error('Error fetching AI prompts:', err);
    } finally {
      setIsLoadingPrompts(false);
    }
  };

  // Переход на вкладку промптов с гарантированной загрузкой данных
  const openPromptsTab = async (stageOverride?: number) => {
    setActiveTab('prompts');
    setPromptValidationError('');
    const targetStage = stageOverride || aiStage || 1;
    if (loadedPromptsStageRef.current !== targetStage || promptsRef.current.length === 0) {
      await loadAiPrompts(targetStage, true);
    }
  };

  // Проверка статуса паузы пайплайна для ввода ответа нейросети
  const checkAiStatus = async () => {
    try {
      const res = await fetch('/ai-status');
      if (res.ok) {
        const data = await res.json();
        if (data.waiting) {
          const isNewlyWaiting = !prevAiWaitingRef.current;
          setAiWaiting(true);
          const st = data.stage || 1;
          setAiStage(st);
          setAiStageTitle(data.stageTitle || 'Ожидание ответа нейросети');
          setAiStageDesc(data.stageDesc || '');
          setStatus(`Пауза: Добавьте ответы LLM`);
          setIsRunning(true);

          // Загружаем промпты только один раз при возникновении паузы или смене этапа,
          // предотвращая циклическое мигание интерфейса на каждом тике опроса
          if (isNewlyWaiting || loadedPromptsStageRef.current !== st || promptsRef.current.length === 0) {
            loadAiPrompts(st, false);
          }
        } else {
          setAiWaiting(false);
          loadedPromptsStageRef.current = null;
        }
      }
    } catch (err) {
      console.error('Error checking AI status:', err);
    }
  };

  // Автоматический переход на вкладку промптов при возникновении паузы
  useEffect(() => {
    if (!prevAiWaitingRef.current && aiWaiting) {
      openPromptsTab(aiStage || 1);
    }
    prevAiWaitingRef.current = aiWaiting;
  }, [aiWaiting, aiStage]);

  // Копирование текущего активного промпта
  const copyCurrentPrompt = () => {
    if (!prompts[currentPromptIdx]) return;
    navigator.clipboard.writeText(prompts[currentPromptIdx].content);
    setCopiedPromptId(prompts[currentPromptIdx].index);
    setTimeout(() => setCopiedPromptId(null), 2000);
  };

  // Переход к другому промпту с валидацией заполнения текущего
  const handleSelectPrompt = (targetIdx: number) => {
    if (targetIdx === currentPromptIdx) return;
    if (targetIdx > currentPromptIdx) {
      const currentPrompt = prompts[currentPromptIdx];
      const currentAns = currentPrompt ? (aiAnswersMap[currentPrompt.index] || '').trim() : '';
      if (!currentAns) {
        setPromptValidationError(`Сначала добавьте ответ нейросети на текущий промпт #${currentPrompt ? currentPrompt.index : currentPromptIdx + 1}, чтобы перейти дальше.`);
        return;
      }
    }
    setPromptValidationError('');
    setCurrentPromptIdx(targetIdx);
  };

  // Переход к следующему промпту или отправка если все готовы
  const handleNextPrompt = () => {
    const currentPrompt = prompts[currentPromptIdx];
    const currentAns = currentPrompt ? (aiAnswersMap[currentPrompt.index] || '').trim() : '';
    if (!currentAns) {
      setPromptValidationError(`Сначала добавьте ответ нейросети на текущий промпт #${currentPrompt ? currentPrompt.index : currentPromptIdx + 1}, чтобы перейти к следующему.`);
      return;
    }
    setPromptValidationError('');
    if (currentPromptIdx < prompts.length - 1) {
      setCurrentPromptIdx(prev => prev + 1);
    } else {
      submitAiAnswers();
    }
  };

  // Отправка ответов нейросети и продолжение выполнения пайплайна
  const submitAiAnswers = async () => {
    // Проверяем, что на каждый промпт добавлен ответ
    const unanswered = prompts.find(p => !(aiAnswersMap[p.index] || '').trim());
    if (unanswered) {
      const missingIdx = prompts.findIndex(p => p.index === unanswered.index);
      if (missingIdx !== -1) setCurrentPromptIdx(missingIdx);
      setPromptValidationError(`Не заполнен ответ на промпт #${unanswered.index}. Заполните ответы на все фрагменты, чтобы продолжить пайплайн.`);
      return;
    }

    setPromptValidationError('');
    setIsSubmittingAi(true);
    try {
      const parts: string[] = [];
      prompts.forEach(p => {
        const ans = (aiAnswersMap[p.index] || '').trim();
        if (ans) {
          parts.push(ans);
        }
      });
      const finalAnswers = parts.join('\n\n');

      const res = await fetch('/ai-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: aiStage,
          answers: finalAnswers
        })
      });

      if (res.ok) {
        setAiWaiting(false);
        setStatus('Ответы приняты. Пайплайн возобновлен...');
        setActiveTab('console');
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Ошибка возобновления пайплайна: ${errData.error || res.statusText}`);
      }
    } catch (err: any) {
      console.error('Error submitting AI answers:', err);
      alert(`Сетевая ошибка: ${err.message}`);
    } finally {
      setIsSubmittingAi(false);
    }
  };

  // Принудительная остановка пайплайна
  const stopPipeline = async () => {
    try {
      setStatus('Остановка пайплайна...');
      const res = await fetch('/stop', { method: 'POST' });
      if (res.ok) {
        setIsRunning(false);
        setAiWaiting(false);
        setStatus('Остановлено пользователем');
        setLogs(prev => prev + "\n[USER_ABORT] Пайплайн принудительно остановлен пользователем.\n");
      }
    } catch (err) {
      console.error('Error stopping pipeline:', err);
    }
  };

  // Загрузка списка артефактов
  const fetchArtifacts = async (runName?: string) => {
    try {
      const url = runName ? `/artifacts?run=${encodeURIComponent(runName)}` : '/artifacts';
      const res = await fetch(url);
      if (res.ok) {
        const data: ArtifactsResponse = await res.json();
        setRuns(data.runs || []);
        if (data.currentRun) {
          setSelectedRun(data.currentRun);
        }
        setArtifacts(data.artifacts || []);

        // Если уже был выбран файл, проверим остался ли он
        if (data.artifacts && data.artifacts.length > 0) {
          setSelectedArtifact(prev => {
            if (prev) {
              const matched = data.artifacts.find(a => a.relativePath === prev.relativePath);
              return matched || data.artifacts[0];
            }
            return data.artifacts[0];
          });
        }
      }
    } catch (err) {
      console.error('Error fetching artifacts:', err);
    }
  };

  // Загрузка содержимого выбранного файла
  const loadArtifactContent = async (art: ArtifactItem, runToLoad?: string) => {
    const run = runToLoad || selectedRun;
    if (!run || !art) return;
    setIsLoadingArtifact(true);
    try {
      const res = await fetch(`/artifact-content?run=${encodeURIComponent(run)}&file=${encodeURIComponent(art.relativePath)}`);
      if (res.ok) {
        const data = await res.json();
        setArtifactContent(data.content || '');
      } else {
        setArtifactContent('Ошибка загрузки содержимого файла');
      }
    } catch (err) {
      console.error('Error reading artifact:', err);
      setArtifactContent('Не удалось загрузить содержимое');
    } finally {
      setIsLoadingArtifact(false);
    }
  };

  // Когда выбран другой артефакт или выбран другой запуск
  useEffect(() => {
    if (selectedArtifact && selectedRun) {
      loadArtifactContent(selectedArtifact, selectedRun);
    }
  }, [selectedArtifact, selectedRun]);

  // Загрузка списка файлов с сервера
  const fetchFiles = async () => {
    try {
      const res = await fetch('/files');
      if (res.ok) {
        const data = await res.json();
        setFiles(data);
      }
    } catch (err) {
      console.error('Error fetching files:', err);
    }
  };

  useEffect(() => {
    fetchFiles();
    fetchArtifacts();
    fetchProjectVersion();
    checkAiStatus();
    // При начальной загрузке страницы подгружаем последний лог, чтобы не терять вывод
    fetch('/logs')
      .then(res => res.text())
      .then(text => {
        if (text && !text.includes('<!DOCTYPE') && text !== 'Ожидание запуска...\n') {
          const displayLogs = text.length > 100000 
            ? "... [логи обрезаны для производительности, полный лог в tmp/logs] ...\n" + text.slice(-100000) 
            : text;
          setLogs(displayLogs);
          if (text.includes('PROCESSING COMPLETED')) {
            setStatus('Завершено');
          } else if (text.includes('ПРОЦЕСС ЗАВЕРШЕН С ОШИБКОЙ') || text.includes('[FATAL ERROR]')) {
            setStatus('Ошибка');
          }
        }
      })
      .catch(console.error);
  }, []);

  const uploadFiles = (selectedFiles: File[]) => {
    if (selectedFiles.length === 0) { return; }

    const newItems: UploadQueueItem[] = selectedFiles.map((file, idx) => {
      const lower = file.name.toLowerCase();
      let type: 'pcbdoc' | 'pdf' | 'txt' | 'other' = 'other';
      if (lower.endsWith('.pdf')) type = 'pdf';
      else if (lower.endsWith('.pcbdoc') || lower.endsWith('.pcbsch') || lower.endsWith('.schdoc')) type = 'pcbdoc';
      else if (lower.endsWith('.txt')) type = 'txt';

      return {
        id: `${file.name}-${file.size}-${Date.now()}-${idx}`,
        name: file.name,
        size: file.size,
        loaded: 0,
        percent: 0,
        type,
        status: 'uploading'
      };
    });

    setUploadQueue(prev => [...prev, ...newItems]);
    setStatus('Загрузка файлов на сервер...');

    const formData = new FormData();
    selectedFiles.forEach(file => { formData.append('files', file); });

    const totalBytes = selectedFiles.reduce((acc, f) => acc + f.size, 0);
    const itemIds = new Set(newItems.map(i => i.id));

    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const loaded = event.loaded;
        const total = event.total;
        const percent = Math.min(100, Math.round((loaded / total) * 100));

        setUploadQueue(prev =>
          prev.map(item => {
            if (itemIds.has(item.id)) {
              const ratio = totalBytes > 0 ? item.size / totalBytes : 1 / newItems.length;
              const itemLoaded = Math.min(item.size, Math.round(loaded * ratio));
              const itemPercent = item.size > 0 ? Math.min(100, Math.round((itemLoaded / item.size) * 100)) : percent;
              return {
                ...item,
                loaded: itemLoaded,
                percent: itemPercent,
                status: itemPercent >= 100 ? 'processing' : 'uploading'
              };
            }
            return item;
          })
        );

        setStatus(`Загрузка: ${percent}% (${formatBytes(loaded)} / ${formatBytes(total)})`);
      }
    };

    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // Устанавливаем статус обработки на сервере пока обновляется список файлов
        setUploadQueue(prev =>
          prev.map(item =>
            itemIds.has(item.id)
              ? { ...item, loaded: item.size, percent: 100, status: 'processing' }
              : item
          )
        );
        setStatus('Сохранение на сервере и синхронизация списка...');

        // Ждем пока сервер возвратит обновленный список файлов
        await fetchFiles();
        setPdfError(false);
        setPinsError(false);

        // Файлы теперь точно в боковом меню
        setUploadQueue(prev =>
          prev.map(item =>
            itemIds.has(item.id)
              ? { ...item, status: 'done' }
              : item
          )
        );
        setStatus('Файлы успешно сохранены');

        // Плавно убираем индикатор загрузки после отображения в списке
        setTimeout(() => {
          setUploadQueue(prev => prev.filter(item => !itemIds.has(item.id)));
          setStatus('Готов к запуску');
        }, 1200);
      } else {
        setUploadQueue(prev =>
          prev.map(item =>
            itemIds.has(item.id)
              ? { ...item, status: 'error', errorMessage: `Ошибка сервера (${xhr.status})` }
              : item
          )
        );
        setStatus('Ошибка загрузки');
      }
    };

    xhr.onerror = () => {
      setUploadQueue(prev =>
        prev.map(item =>
          itemIds.has(item.id)
            ? { ...item, status: 'error', errorMessage: 'Сетевая ошибка' }
            : item
        )
      );
      setStatus('Ошибка сети при загрузке');
    };

    xhr.open('POST', '/upload', true);
    xhr.send(formData);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      uploadFiles(newFiles);
      e.target.value = ''; // сброс для повторного выбора
    }
  };

  const deleteFile = async (file: AppFile) => {
    try {
      await fetch(`/files?name=${encodeURIComponent(file.name)}&type=${file.type}`, { method: 'DELETE' });
      await fetchFiles();
    } catch (err) {
      console.error('Error deleting file:', err);
    }
  };

  // Статистика файлов
  const pdfCount = files.filter(f => f.type === 'pdf').length;
  const pinsCount = files.filter(f => f.type === 'txt').length;
  const pcbCount = files.filter(f => f.type === 'pcbdoc' || f.type === 'pcbsch').length;

  const runPipeline = async () => {
    const trimmedTarget = targetComponent.trim();
    const pdfFiles = files.filter(f => f.type === 'pdf');
    const pinsFiles = files.filter(f => f.type === 'txt');
    const pcbFiles = files.filter(f => f.type === 'pcbdoc' || f.type === 'pcbsch');

    // 1. Проверка наличия целевого компонента
    if (!trimmedTarget) {
      setTargetError(true);
      setStatus('Укажите компонент');
      setLogs(prev => 
        prev + 
        "\n--- ОШИБКА ВАЛИДАЦИИ ---\n" + 
        "[FATAL ERROR] Не указано имя целевого компонента (TARGET_COMPONENT). Запуск невозможен.\n" + 
        "[FATAL ERROR] Введите имя целевого компонента (например: RTL8370N) в поле слева.\n" +
        "[FATAL ERROR] ПРОЦЕСС ЗАВЕРШЕН С ОШИБКОЙ\n"
      );
      setTimeout(() => setTargetError(false), 5000);
      return;
    }

    // 2. Проверка наличия PcbDoc / PcbSch
    if (pcbFiles.length === 0) {
      setStatus('Нет файлов плат/схем');
      setLogs(prev => 
        prev + 
        "\n--- ОШИБКА ВАЛИДАЦИИ ---\n" + 
        "[FATAL ERROR] Не загружен ни один файл платы или схемы (*.PcbDoc, *.PcbSch). Запуск невозможен.\n" + 
        "[FATAL ERROR] Загрузите как минимум один файл .PcbDoc / .PcbSch через панель слева или найдите в GitHub.\n" +
        "[FATAL ERROR] ПРОЦЕСС ЗАВЕРШЕН С ОШИБКОЙ\n"
      );
      return;
    }

    // 3. Проверка PDF файлов (по аналогии с целевым компонентом)
    if (pdfFiles.length === 0) {
      setPdfError(true);
      setPdfErrorMessage(`Не загружен ни один PDF даташит. Требуется файл '${trimmedTarget}.pdf'.`);
      setStatus('Нет PDF даташита');
      setLogs(prev => 
        prev + 
        "\n--- ОШИБКА ВАЛИДАЦИИ ---\n" + 
        "[FATAL ERROR] Не загружен ни один PDF даташит (*.pdf). Запуск невозможен.\n" + 
        `[FATAL ERROR] Обязательно присутствие PDF для целевого компонента '${trimmedTarget}.pdf'.\n` + 
        `[FATAL ERROR] Загрузите файл '${trimmedTarget}.pdf' через меню 'Загрузить файлы' в панели слева.\n` +
        "[FATAL ERROR] ПРОЦЕСС ЗАВЕРШЕН С ОШИБКОЙ\n"
      );
      setTimeout(() => setPdfError(false), 6000);
      return;
    }

    const matchingPdf = pdfFiles.find(
      f => f.name.replace(/\.pdf$/i, '').trim().toLowerCase() === trimmedTarget.toLowerCase()
    );

    if (!matchingPdf) {
      setPdfError(true);
      setPdfErrorMessage(`Отсутствует PDF для целевого компонента '${trimmedTarget}.pdf'`);
      setStatus(`Нет PDF для ${trimmedTarget}`);
      setLogs(prev => 
        prev + 
        "\n--- ОШИБКА ВАЛИДАЦИИ ---\n" + 
        `[FATAL ERROR] Загруженные PDF даташиты не содержат файла для целевого компонента '${trimmedTarget}.pdf'. Запуск невозможен.\n` + 
        `[FATAL ERROR] Имя PDF даташита должно совпадать с целевым компонентом: '${trimmedTarget}.pdf'.\n` +
        `[FATAL ERROR] Загрузите файл '${trimmedTarget}.pdf' через меню 'Загрузить файлы' слева.\n` +
        "[FATAL ERROR] ПРОЦЕСС ЗАВЕРШЕН С ОШИБКОЙ\n"
      );
      setTimeout(() => setPdfError(false), 6000);
      return;
    }

    // 4. Проверка файлов со списком ножек для каждого PDF
    const missingPins: string[] = [];
    for (const pdf of pdfFiles) {
      const base = pdf.name.replace(/\.pdf$/i, '').trim().toLowerCase();
      const hasPin = pinsFiles.some(pf => pf.name.replace(/\.txt$/i, '').trim().toLowerCase() === base);
      if (!hasPin) {
        missingPins.push(`${pdf.name.replace(/\.pdf$/i, '')}.txt`);
      }
    }

    if (missingPins.length > 0) {
      setPinsError(true);
      setPinsErrorMessage(`Отсутствуют файлы ножек: ${missingPins.join(', ')}`);
      setStatus('Нет файлов ножек (pins)');
      setLogs(prev => 
        prev + 
        "\n--- ОШИБКА ВАЛИДАЦИИ ---\n" + 
        `[FATAL ERROR] Для загруженных PDF даташитов отсутствуют соответствующие файлы списка ножек (*.txt в resources/pins):\n` +
        missingPins.map(p => `  - Требуется: ${p}`).join('\n') + '\n' +
        `[FATAL ERROR] Для каждого PDF обязательно должен быть загружен файл со списком ножек с тем же именем.\n` +
        "[FATAL ERROR] ПРОЦЕСС ЗАВЕРШЕН С ОШИБКОЙ\n"
      );
      setTimeout(() => setPinsError(false), 6000);
      return;
    }

    // Все проверки пройдены
    setTargetError(false);
    setPdfError(false);
    setPinsError(false);
    setPcbCompError(false);
    setIsRunning(true);
    setStatus('Выполняется...');

    const url = new URL('/run', window.location.origin);
    url.searchParams.append('target', trimmedTarget);
    url.searchParams.append('engine', engine);

    try {
      const resp = await fetch(url.toString());
      if (!resp.ok) {
        const r = await fetch('/logs');
        if (!r.headers.get('content-type')?.includes('text/html')) {
          const fullText = await r.text();
          setLogs(fullText);
          if (fullText.includes('отсутствует в загруженном файле платы')) {
            setPcbCompError(true);
            setPcbCompErrorMessage(`Целевой компонент '${trimmedTarget}' отсутствует в файлах плат .PcbDoc.`);
            setStatus(`Нет '${trimmedTarget}' в плате`);
            setTimeout(() => setPcbCompError(false), 8000);
          } else {
            setStatus('Ошибка валидации');
          }
        } else {
          setStatus('Ошибка');
        }
        setIsRunning(false);
      }
    } catch (err) {
      console.error('Run error:', err);
      setStatus('Ошибка сети');
      setIsRunning(false);
    }
  };

  useEffect(() => {
    if (!isRunning) { return; }
    const interval = setInterval(async () => {
      try {
        await checkAiStatus();

        const r = await fetch('/logs');
        if (r.headers.get('content-type')?.includes('text/html')) { return; }
        const fullText = await r.text();
        
        if (scrollRef.current) {
          const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
          isAtBottom.current = scrollHeight - scrollTop <= clientHeight + 100;
        }

        const displayLogs = fullText.length > 100000 
          ? "... [логи обрезаны для производительности, полный лог в tmp/logs] ...\n" + fullText.slice(-100000) 
          : fullText;

        setLogs(displayLogs);

        if (fullText.includes('PROCESSING COMPLETED') || fullText.includes('ПРОЦЕСС ЗАВЕРШЕН С ОШИБКОЙ')) {
          clearInterval(interval);
          setStatus(fullText.includes('PROCESSING COMPLETED') ? 'Завершено' : 'Ошибка');
          setIsRunning(false);
          setAiWaiting(false);
          // Автоматически обновляем список артефактов работы скриптов
          fetchArtifacts();
        }
      } catch (err) {
        console.error('Log fetch error:', err);
      }
    }, 1000);
    return () => { clearInterval(interval); };
  }, [isRunning]);

  useEffect(() => {
    if (isAtBottom.current && scrollRef.current) {
      const el = scrollRef.current;
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }, [logs]);

  const toggleSidebar = () => { setSidebarCollapsed(!sidebarCollapsed); };

  const isErrorStatus = status === 'Ошибка' || 
    status === 'Укажите компонент' || 
    status === 'Нет файлов PcbDoc' || 
    status.includes('Нет PDF') || 
    status.includes('Нет файлов ножек') ||
    status.includes('в плате') ||
    status === 'Ошибка валидации';

  const trimmedTargetLower = targetComponent.trim().toLowerCase();

  return (
    <div className="bg-[#121212] text-[#00ff00] font-mono h-screen w-screen flex overflow-hidden">
      {/* Боковое выдвижное меню */}
      <aside className={`bg-[#111] border-r border-[#262626] transition-all duration-300 flex-shrink-0 relative flex flex-col z-50 h-full ${sidebarCollapsed ? 'w-0 md:w-0 overflow-hidden' : 'w-80 md:w-88'}`}>
        <div className="p-3.5 flex justify-between items-center border-b border-[#262626] bg-[#161616]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb]"></span>
            <span className="text-[#2563eb] font-bold text-base tracking-wide">Панель управления</span>
          </div>
          <button onClick={toggleSidebar} className="p-1.5 hover:bg-[#222] rounded-md text-gray-400 hover:text-white transition-colors" title="Скрыть панель">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
        </div>

        {/* Переключатель вкладок бокового меню: Основное / Файлы */}
        <div className="flex border-b border-[#262626] bg-[#141414] flex-shrink-0">
          <button
            onClick={() => setSidebarTab('main')}
            className={`flex-1 py-2.5 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              sidebarTab === 'main'
                ? 'text-white border-b-2 border-[#2563eb] bg-[#1a1a1a]'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#181818]'
            }`}
          >
            <span>⚙️ Основное</span>
            {aiWaiting && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            )}
          </button>
          <button
            onClick={() => setSidebarTab('files')}
            className={`flex-1 py-2.5 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              sidebarTab === 'files'
                ? 'text-white border-b-2 border-[#2563eb] bg-[#1a1a1a]'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#181818]'
            }`}
          >
            <span>📁 Файлы</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#242424] text-gray-300 font-mono">
              {files.length}
            </span>
            {uploadQueue.some(u => u.status === 'uploading' || u.status === 'processing') && (
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping"></span>
            )}
          </button>
        </div>
        
        {/* Вкладка ОСНОВНОЕ: Кнопки запуска/остановки, пауза LLM, целевой компонент, движок */}
        {sidebarTab === 'main' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Блок паузы и ввода ответов LLM */}
            {aiWaiting ? (
              <div className="p-3.5 bg-gradient-to-b from-amber-950/90 to-[#22180c] border-2 border-amber-500 rounded-xl shadow-xl shadow-amber-950/60 space-y-2.5 animate-fadeIn">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3 flex-shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                  </span>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold">
                    Пауза пайплайна
                  </span>
                </div>
                <div className="text-base font-black text-white leading-tight">
                  Добавьте ответы LLM
                </div>
                <button
                  onClick={() => openPromptsTab()}
                  className="w-full py-2.5 px-3 bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-black rounded-lg font-black text-xs uppercase tracking-wide transition-all shadow-lg shadow-amber-900/50 active:scale-95 flex items-center justify-center gap-2 cursor-pointer border-2 border-amber-200 animate-pulse"
                >
                  <span>🤖 Добавить ответы LLM ➔</span>
                  {prompts.length > 0 && (
                    <span className="px-1.5 py-0.2 bg-black/85 text-amber-300 rounded text-[10px] font-mono">
                      {prompts.length}
                    </span>
                  )}
                </button>
                <p className="text-[10px] text-amber-300/80 font-sans leading-snug">
                  {aiStageTitle || `Этап ${aiStage}: Сжатие даташита`}
                </p>
              </div>
            ) : (
              <div className="p-3 bg-[#171717] border border-[#2a2a2a] rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${status === 'Выполняется...' ? 'bg-[#fbbf24] animate-pulse' : status === 'Завершено' ? 'bg-[#10b981]' : isErrorStatus ? 'bg-red-500' : 'bg-[#fbbf24]'}`}></div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Текущий статус</div>
                    <div className={`text-xs font-bold truncate max-w-[170px] ${status === 'Завершено' ? 'text-[#10b981]' : isErrorStatus ? 'text-red-400' : 'text-[#fbbf24]'}`}>
                      {status}
                    </div>
                  </div>
                </div>
                {isRunning && (
                  <span className="text-[10px] text-amber-400/90 font-mono animate-pulse">
                    Выполняется...
                  </span>
                )}
              </div>
            )}

            {/* Кнопки запуска и остановки пайплайна */}
            <div className="space-y-2">
              <button 
                onClick={runPipeline} 
                disabled={isRunning || pcbCount === 0} 
                className="w-full py-3 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-lg font-bold text-sm transition-all shadow-lg shadow-blue-900/20 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                title={pcbCount === 0 ? "Для запуска пайплайна загрузите хотя бы один файл .PcbDoc" : undefined}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                Запустить пайплайн
              </button>

              {(isRunning || aiWaiting) && (
                <button
                  onClick={stopPipeline}
                  className="w-full py-2.5 bg-red-600/90 hover:bg-red-500 text-white rounded-lg font-bold text-xs transition-all shadow-md shadow-red-950/40 active:scale-95 flex items-center justify-center gap-2 border border-red-400/40"
                  title="Принудительно остановить текущее выполнение пайплайна"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>
                  Прервать пайплайн
                </button>
              )}
            </div>

            {/* Поле целевого компонента */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Целевой компонент</h3>
                <span className="text-[10px] text-red-400">*обязательно</span>
              </div>
              <input 
                type="text" 
                placeholder="Напр: RTL8370N или STM32F103" 
                value={targetComponent}
                onChange={(e) => {
                  setTargetComponent(e.target.value);
                  if (targetError && e.target.value.trim()) setTargetError(false);
                  if (pdfError) setPdfError(false);
                }}
                className={`w-full px-3 py-2 bg-[#1a1a1a] border rounded text-xs text-white outline-none transition-colors ${targetError ? 'border-red-500 ring-1 ring-red-500' : 'border-[#333] focus:border-[#2563eb]'}`}
              />
              {targetError && (
                <p className="text-[10px] text-red-400 px-1 font-sans">
                  Укажите целевой компонент. Его PDF даташит и TXT ножек обязательны.
                </p>
              )}
            </div>

            {/* Ошибки валидации входных данных */}
            {pdfError && (
              <div className="p-2.5 bg-red-950/60 border border-red-500 rounded text-[11px] text-red-200 font-sans animate-pulse">
                <div className="font-bold text-red-400 flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  Требуется PDF даташит
                </div>
                <p className="mt-1 text-[10px] leading-tight text-red-300">
                  {pdfErrorMessage}
                </p>
              </div>
            )}

            {pinsError && (
              <div className="p-2.5 bg-amber-950/60 border border-amber-500 rounded text-[11px] text-amber-200 font-sans">
                <div className="font-bold text-amber-400 flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  Отсутствует распиновка
                </div>
                <p className="mt-1 text-[10px] leading-tight text-amber-300">
                  {pinsErrorMessage}
                </p>
              </div>
            )}

            {pcbCompError && (
              <div className="p-2.5 bg-red-950/60 border border-red-500 rounded text-[11px] text-red-200 font-sans animate-pulse">
                <div className="font-bold text-red-400 flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  Целевой компонент не найден
                </div>
                <p className="mt-1 text-[10px] leading-tight text-red-300">
                  {pcbCompErrorMessage}
                </p>
              </div>
            )}

            {/* Выбор движка */}
            <div className="space-y-1.5">
              <h3 className="text-[10px] uppercase tracking-widest text-gray-500 font-bold px-1">Движок логики</h3>
              <div className="flex bg-[#1a1a1a] border border-[#333] rounded p-1">
                <button 
                  onClick={() => setEngine('typescript')}
                  className={`flex-1 py-1.5 text-[11px] rounded transition-all ${engine === 'typescript' ? 'bg-[#2563eb] text-white font-bold' : 'text-gray-400 hover:text-gray-200'}`}
                >
                  TypeScript
                </button>
                <button 
                  onClick={() => setEngine('python')}
                  className={`flex-1 py-1.5 text-[11px] rounded transition-all ${engine === 'python' ? 'bg-[#2563eb] text-white font-bold' : 'text-gray-400 hover:text-gray-200'}`}
                >
                  Python
                </button>
              </div>
            </div>

            {/* Сводка готовности файлов с переходом во вкладку файлов */}
            <div className="p-3 bg-[#181818] border border-[#2a2a2a] rounded-xl space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-gray-300">
                <span>Готовность файлов:</span>
                <button
                  onClick={() => setSidebarTab('files')}
                  className="text-[#2563eb] hover:underline text-[10px] flex items-center gap-1 font-sans"
                >
                  Управление ➔
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-center font-mono text-[10px]">
                <div className={`p-1.5 rounded border ${pdfCount > 0 ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300' : 'bg-red-950/40 border-red-800 text-red-300'}`}>
                  <div>PDF</div>
                  <div className="font-bold text-xs">{pdfCount}</div>
                </div>
                <div className={`p-1.5 rounded border ${pinsCount > 0 ? 'bg-cyan-950/40 border-cyan-800 text-cyan-300' : 'bg-amber-950/40 border-amber-800 text-amber-300'}`}>
                  <div>Ножки</div>
                  <div className="font-bold text-xs">{pinsCount}</div>
                </div>
                <div className={`p-1.5 rounded border ${pcbCount > 0 ? 'bg-blue-950/40 border-blue-800 text-blue-300' : 'bg-red-950/40 border-red-800 text-red-300'}`}>
                  <div>Плата</div>
                  <div className="font-bold text-xs">{pcbCount}</div>
                </div>
              </div>
              {pcbCount === 0 && (
                <p className="text-[10px] text-amber-400 font-sans leading-tight">
                  Для анализа требуется файл .PcbDoc. Загрузите его во вкладке «Файлы».
                </p>
              )}
            </div>

            {/* Блок версии и обновления проекта из GitHub */}
            <div className="p-3 bg-[#151922] border border-[#263248] rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-gray-300 tracking-wider flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 fill-current text-white" viewBox="0 0 16 16"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
                  Версия проекта
                </span>
                <div className="flex items-center gap-1 font-mono text-[10px]">
                  <span className="px-1.5 py-0.5 rounded bg-blue-900/60 text-blue-200 border border-blue-700/60 font-bold" title="Версия из version.json">
                    v{projectVersion?.appVersion || '1.0.1'}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-[#1f2638] text-gray-400 border border-[#313e58]" title="Git коммит">
                    {projectVersion?.shortSha || 'd766ddd'}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 font-sans truncate" title={projectVersion?.commitMessage || 'feat: initialize project source code'}>
                {projectVersion?.commitMessage || 'feat: initialize project source code'}
              </p>
              <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setGitHubModalTab('update');
                    setShowGitHubModal(true);
                    checkProjectUpdate();
                  }}
                  className="py-1.5 px-2 bg-[#1e2536] hover:bg-[#28324a] text-blue-300 hover:text-white border border-[#374563] rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 active:scale-95 shadow-sm"
                  title="Проверить и скачать обновления из GitHub"
                >
                  <span>🔄 Pull / Синхр.</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGitHubModalTab('push');
                    setShowGitHubModal(true);
                    fetchPushDiff();
                  }}
                  className="py-1.5 px-2 bg-gradient-to-r from-emerald-950/80 to-teal-950/80 hover:from-emerald-900 hover:to-teal-900 text-emerald-300 hover:text-white border border-emerald-700/60 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 active:scale-95 shadow-sm"
                  title="Отправить изменения в GitHub с автоповышением версии"
                >
                  <span>🚀 Push & Diff</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Вкладка ФАЙЛЫ: Загрузка, GitHub, список файлов на сервере */}
        {sidebarTab === 'files' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <input type="file" multiple accept=".pdf,.pcbdoc,.pcbsch,.schdoc,.txt" id="file-upload" className="hidden" onChange={handleFileChange} />
              <label htmlFor="file-upload" className="w-full px-4 py-3 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-lg font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 active:scale-95">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                Загрузить файлы
              </label>

              {/* Кнопка поиска и импорта файлов из GitHub */}
              <button
                type="button"
                onClick={() => {
                  setGitHubModalTab('files');
                  setShowGitHubModal(true);
                  if (!gitHubConnectedRepo && gitHubRepoInput.trim()) {
                    connectGitHubRepo();
                  }
                }}
                className="w-full mt-2 px-3 py-2.5 bg-[#171b24] hover:bg-[#1f2535] text-[#7ee787] hover:text-white border border-[#30363d] hover:border-[#58a6ff] rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-95 shadow-md shadow-black/40 group"
                title="Поиск и скачивание PcbSch, TXT и PDF из репозитория GitHub"
              >
                <svg className="w-4 h-4 fill-current text-gray-300 group-hover:text-white transition-colors" viewBox="0 0 16 16">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                </svg>
                <span>Поиск в GitHub</span>
                {gitHubConnectedRepo && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" title="Репозиторий подключен"></span>
                )}
              </button>

              <p className="text-[10px] text-gray-500 mt-1.5 leading-tight text-center">
                Файлы: <span className="text-blue-400 font-bold">.PcbDoc</span>, <span className="text-indigo-400 font-bold">.PcbSch</span>, <span className="text-red-400 font-bold">.pdf</span>, <span className="text-emerald-400 font-bold">.txt</span>
              </p>
            </div>

            {/* Индикатор прогресса загрузки файлов */}
            {uploadQueue.length > 0 && (
              <div className="bg-[#181818] border border-blue-500/50 rounded-lg p-2.5 space-y-2 shadow-lg shadow-blue-950/40">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="flex items-center gap-1.5 text-blue-400">
                    <svg className="animate-spin w-3.5 h-3.5 text-blue-400" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Загрузка на сервер
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {uploadQueue.filter(u => u.status === 'done').length}/{uploadQueue.length}
                  </span>
                </div>

                {uploadQueue.map(item => (
                  <div key={item.id} className="space-y-1 bg-[#121212] p-2 rounded border border-[#2a2a2a]">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="truncate max-w-[140px] font-mono text-gray-200" title={item.name}>
                        {item.name}
                      </span>
                      <span className={`font-mono font-bold ${
                        item.status === 'error' ? 'text-red-400' :
                        item.status === 'done' ? 'text-emerald-400' :
                        item.status === 'processing' ? 'text-amber-400' : 'text-blue-400'
                      }`}>
                        {item.status === 'error' ? 'Ошибка' :
                         item.status === 'done' ? 'Сохранено ✓' :
                         item.status === 'processing' ? 'Обработка...' : `${item.percent}%`}
                      </span>
                    </div>

                    <div className="w-full bg-[#202020] h-1.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-150 ${
                          item.status === 'error' ? 'bg-red-500' :
                          item.status === 'done' ? 'bg-emerald-500' :
                          item.status === 'processing' ? 'bg-amber-400 animate-pulse' :
                          'bg-[#2563eb]'
                        }`}
                        style={{ width: `${Math.max(4, item.percent)}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center text-[9px] text-gray-400 font-mono">
                      <span>{formatBytes(item.loaded)} / {formatBytes(item.size)}</span>
                      <span className={item.status === 'processing' ? 'text-amber-400' : item.status === 'done' ? 'text-emerald-400' : ''}>
                        {item.status === 'processing' ? 'Сохранение...' : item.status === 'done' ? 'В списке файлов' : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Список файлов на сервере */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Файлы на сервере</h3>
                <span className="text-[10px] text-gray-400 font-sans">
                  Всего: {files.length}
                </span>
              </div>

              {files.length === 0 && uploadQueue.length === 0 ? (
                <div className="p-3 border border-dashed border-[#333] rounded text-gray-500 text-[11px] italic text-center">
                  Файлы не загружены
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
                  {files.map((file, i) => {
                    let badgeText = 'PcbDoc';
                    let badgeColor = 'bg-blue-950 text-blue-300 border-blue-800';
                    let dotColor = 'bg-blue-400';

                    const baseName = file.name.replace(/\.[^.]+$/, '').trim().toLowerCase();
                    const isTargetComp = trimmedTargetLower && baseName === trimmedTargetLower;

                    if (file.type === 'pdf') {
                      badgeText = 'PDF';
                      badgeColor = isTargetComp 
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-600 ring-1 ring-emerald-500/50' 
                        : 'bg-red-950 text-red-300 border-red-800';
                      dotColor = isTargetComp ? 'bg-emerald-400' : 'bg-red-400';
                    } else if (file.type === 'txt') {
                      badgeText = 'PINS';
                      badgeColor = isTargetComp 
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-600' 
                        : 'bg-cyan-950 text-cyan-300 border-cyan-800';
                      dotColor = isTargetComp ? 'bg-emerald-400' : 'bg-cyan-400';
                    } else if (file.type === 'pcbsch') {
                      badgeText = 'PcbSch';
                      badgeColor = isTargetComp 
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-600 ring-1 ring-emerald-500/50' 
                        : 'bg-indigo-950 text-indigo-300 border-indigo-800';
                      dotColor = isTargetComp ? 'bg-emerald-400' : 'bg-indigo-400';
                    }

                    return (
                      <div 
                        key={i} 
                        className={`flex items-center gap-2 p-2 bg-[#1a1a1a] border rounded text-[11px] text-gray-200 transition-colors ${
                          isTargetComp ? 'border-emerald-800/80 bg-emerald-950/10' : 'border-[#2a2a2a] hover:border-[#444]'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`}></span>
                        <span className="truncate flex-1 font-mono text-xs" title={file.name}>
                          {file.name}
                        </span>
                        {isTargetComp && (
                          <span className="text-[8px] px-1 py-0.2 bg-emerald-900/60 text-emerald-300 rounded border border-emerald-700/60 font-sans uppercase font-bold flex-shrink-0">
                            Цель
                          </span>
                        )}
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border uppercase font-mono font-bold flex-shrink-0 ${badgeColor}`}>
                          {badgeText}
                        </span>
                        <button 
                          onClick={() => deleteFile(file)} 
                          className="text-gray-400 hover:text-red-400 hover:bg-[#2a2a2a] p-1 rounded transition-colors flex-shrink-0 ml-0.5"
                          title={`Удалить ${file.name} с сервера`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="p-2.5 border-t border-[#262626] text-[10px] text-gray-500 text-center bg-[#141414] flex-shrink-0">
          PCB AI Validator v1.2
        </div>
      </aside>

      {/* Основная рабочая область на весь экран */}
      <main className="flex-1 flex flex-col relative overflow-hidden h-full bg-[#121212]">
        {/* Верхняя компактная панель управления и переключения вкладок */}
        <header className="flex-shrink-0 bg-[#161616] border-b border-[#282828] px-3 md:px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 z-30">
          <div className="flex items-center gap-3">
            {sidebarCollapsed && (
              <button onClick={toggleSidebar} className="p-1.5 bg-[#222] border border-[#3a3a3a] rounded text-gray-300 hover:text-white transition-colors" title="Открыть боковую панель">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base md:text-lg font-bold text-white tracking-wide">PCB AI Validator</h1>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#202020] text-gray-400 border border-[#333] font-mono">
                  {engine.toUpperCase()}
                </span>
                {targetComponent && (
                  <span className="text-[11px] px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 font-mono font-bold truncate max-w-[140px]">
                    {targetComponent}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Индикатор паузы в верхней панели для быстрого перехода */}
          {aiWaiting && (
            <div className="flex items-center gap-2 bg-amber-950/90 border border-amber-500/90 px-3 py-1.5 rounded-lg animate-pulse shadow-md shadow-amber-950/60">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span className="text-xs font-bold text-amber-200">Добавьте ответы LLM</span>
              <button
                onClick={() => openPromptsTab()}
                className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-black rounded text-[11px] font-black uppercase tracking-wider transition-all shadow active:scale-95 ml-1"
              >
                Ввести ответы ➔
              </button>
            </div>
          )}

          {/* Переключатели основных вкладок приложения */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('console')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'console'
                  ? 'bg-[#2563eb] text-white shadow-md shadow-blue-900/30'
                  : 'bg-[#1e1e1e] text-gray-400 hover:text-white hover:bg-[#282828]'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
              <span>Консоль</span>
            </button>

            <button
              onClick={() => openPromptsTab()}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 relative ${
                activeTab === 'prompts'
                  ? 'bg-[#2563eb] text-white shadow-md shadow-blue-900/30'
                  : aiWaiting
                  ? 'bg-amber-950 text-amber-300 border border-amber-500 shadow-md animate-pulse'
                  : 'bg-[#1e1e1e] text-gray-400 hover:text-white hover:bg-[#282828]'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a8 8 0 0 0-8 8c0 3.37 2.07 6.27 5 7.45V20a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2.55c2.93-1.18 5-4.08 5-7.45a8 8 0 0 0-8-8z"/></svg>
              <span>Промпты LLM</span>
              {prompts.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 bg-blue-900/80 rounded-full font-mono text-white">
                  {prompts.length}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setActiveTab('artifacts');
                fetchArtifacts(selectedRun);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'artifacts'
                  ? 'bg-[#2563eb] text-white shadow-md shadow-blue-900/30'
                  : 'bg-[#1e1e1e] text-gray-400 hover:text-white hover:bg-[#282828]'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              <span>Артефакты</span>
              {artifacts.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 bg-blue-900/80 rounded-full font-mono text-white">
                  {artifacts.length}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setGitHubModalTab('push');
                setShowGitHubModal(true);
                fetchPushDiff();
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 bg-[#14261f] hover:bg-[#1a332a] text-emerald-300 hover:text-white border border-emerald-700/60 shadow-sm active:scale-95"
              title="Открыть построчный дифф правок и отправить Push в GitHub"
            >
              <span>🚀</span>
              <span className="hidden sm:inline">Push & Diff</span>
            </button>
          </div>
        </header>

        {/* Рабочая область: занимает ВСЮ оставшуюся высоту экрана */}
        <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden p-3 md:p-4">

            {/* Содержимое вкладки ПРОМПТЫ НЕЙРОСЕТИ */}
            {activeTab === 'prompts' && (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#121212] border border-[#2a2a2a] rounded-xl p-3 shadow-2xl">
                {/* Верхняя панель: выбор этапа, прогресс и отправка */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#262626] flex-shrink-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Этап:</span>
                    <div className="flex items-center bg-[#181818] border border-[#333] rounded-lg p-0.5">
                      <button
                        onClick={() => { setAiStage(1); loadAiPrompts(1); }}
                        className={`px-3 py-1 rounded text-xs transition-all flex items-center gap-1.5 ${
                          aiStage === 1
                            ? 'bg-[#2563eb] text-white font-bold shadow-md'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        <span>1: Даташит</span>
                        {aiWaiting && aiStage === 1 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                        )}
                      </button>
                      <button
                        onClick={() => { setAiStage(2); loadAiPrompts(2); }}
                        className={`px-3 py-1 rounded text-xs transition-all flex items-center gap-1.5 ${
                          aiStage === 2
                            ? 'bg-[#2563eb] text-white font-bold shadow-md'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        <span>2: Схема</span>
                        {aiWaiting && aiStage === 2 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                        )}
                      </button>
                    </div>

                    {prompts.length > 0 && (
                      <span className="text-xs text-gray-300 font-mono bg-[#1c1c1c] px-2.5 py-1 rounded border border-[#333]">
                        Заполнено: <strong className="text-emerald-400">{prompts.filter(p => !!aiAnswersMap[p.index]?.trim()).length}</strong> из <strong>{prompts.length}</strong>
                      </span>
                    )}

                    <button
                      onClick={() => loadAiPrompts(aiStage || 1)}
                      disabled={isLoadingPrompts}
                      className="p-1.5 rounded bg-[#1c1c1c] hover:bg-[#252525] border border-[#333] text-gray-400 hover:text-white text-xs transition-colors"
                      title="Обновить список промптов"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isLoadingPrompts ? 'animate-spin' : ''}><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                    </button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={submitAiAnswers}
                      disabled={isSubmittingAi || prompts.length === 0}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-all shadow-md shadow-emerald-950 flex items-center gap-1.5 active:scale-95"
                      title="Продолжить выполнение пайплайна со всеми введенными ответами"
                    >
                      {isSubmittingAi ? (
                        'Отправка...'
                      ) : (
                        <>
                          <span>Далее (Продолжить пайплайн)</span>
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Баннер предупреждения валидации */}
                {promptValidationError && (
                  <div className="mt-2.5 p-2.5 bg-amber-950/80 border border-amber-600/70 rounded-lg text-amber-200 text-xs flex items-center justify-between gap-2 flex-shrink-0 animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <span className="text-base flex-shrink-0">⚠️</span>
                      <span className="font-medium">{promptValidationError}</span>
                    </div>
                    <button
                      onClick={() => setPromptValidationError('')}
                      className="text-amber-300 hover:text-white text-xs px-1.5 py-0.5 rounded hover:bg-amber-900/50"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Основное содержимое вкладки */}
                {isLoadingPrompts && prompts.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-blue-500 mb-3"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    <p className="text-sm font-semibold">Загрузка промптов для Этапа {aiStage}...</p>
                  </div>
                ) : prompts.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600 mb-3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <p className="text-sm font-semibold text-gray-200">Промпты для Этапа {aiStage} еще не сформированы.</p>
                    <p className="text-xs text-gray-500 mt-1 max-w-md font-sans">
                      Запустите пайплайн. Когда алгоритм нарежет фрагменты даташита или схемы, пайплайн встанет на паузу и здесь появятся готовые промпты для отправки в нейросеть.
                    </p>
                    <button
                      onClick={() => loadAiPrompts(aiStage || 1)}
                      className="mt-3 px-3 py-1.5 bg-[#1f1f1f] hover:bg-[#282828] border border-[#333] rounded-lg text-xs text-gray-300"
                    >
                      Проверить снова
                    </button>
                  </div>
                ) : (
                  /* Пошаговая работа по фрагментам */
                  <div className="flex-1 flex flex-col min-h-0 pt-2.5 gap-2.5">
                    {/* Навигационная полоса номеров промптов */}
                    <div className="flex items-center gap-2 flex-shrink-0 bg-[#161616] p-2 rounded-lg border border-[#262626]">
                      <button
                        onClick={() => {
                          setPromptValidationError('');
                          setCurrentPromptIdx(prev => Math.max(0, prev - 1));
                        }}
                        disabled={currentPromptIdx === 0}
                        className="px-2.5 py-1 bg-[#222] hover:bg-[#333] disabled:opacity-30 disabled:hover:bg-[#222] rounded text-xs text-gray-300 transition-colors flex items-center gap-1 font-bold flex-shrink-0"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                        Назад
                      </button>

                      {/* Список номеров фрагментов */}
                      <div className="flex-1 overflow-x-auto flex items-center gap-1.5 py-1 px-1 scrollbar-thin scrollbar-thumb-[#333]">
                        {prompts.map((p, idx) => {
                          const hasAnswer = !!(aiAnswersMap[p.index]?.trim());
                          const isCurrent = idx === currentPromptIdx;
                          return (
                            <button
                              key={p.index}
                              onClick={() => handleSelectPrompt(idx)}
                              className={`px-2.5 py-1 rounded text-xs font-mono transition-all flex items-center gap-1 flex-shrink-0 ${
                                isCurrent
                                  ? 'bg-blue-600 text-white font-bold ring-2 ring-blue-400'
                                  : hasAnswer
                                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
                                  : 'bg-[#222] text-gray-400 hover:text-white hover:bg-[#333]'
                              }`}
                              title={`Фрагмент ${p.index}${hasAnswer ? ' (Ответ заполнен)' : ' (Ожидает ответа)'}`}
                            >
                              <span>{p.index}</span>
                              {hasAnswer && <span className="text-[10px] text-emerald-400 font-bold">✓</span>}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        onClick={handleNextPrompt}
                        className="px-3 py-1 bg-[#222] hover:bg-[#333] rounded text-xs text-blue-300 hover:text-blue-200 transition-colors flex items-center gap-1 font-bold flex-shrink-0"
                        title={currentPromptIdx < prompts.length - 1 ? 'Перейти к следующему промпту (требует ответ)' : 'Продолжить пайплайн'}
                      >
                        {currentPromptIdx < prompts.length - 1 ? 'Далее' : 'Завершить'}
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                      </button>
                    </div>

                    {/* Две колонки: Слева текст одного промпта, Справа ввод ответа нейросети */}
                    {prompts[currentPromptIdx] && (
                      <div className="flex-1 flex flex-col md:flex-row gap-3 min-h-0 overflow-hidden">
                        {/* Левая колонка: Текст промпта */}
                        <div className="flex-1 flex flex-col min-w-0 bg-[#0d0d0d] border border-[#262626] rounded-lg overflow-hidden">
                          <div className="p-2.5 bg-[#171717] border-b border-[#282828] flex items-center justify-between gap-2 flex-shrink-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0"></span>
                              <span className="font-mono text-xs font-bold text-white truncate">
                                Фрагмент {currentPromptIdx + 1} из {prompts.length} (#{prompts[currentPromptIdx].index})
                              </span>
                            </div>
                            <button
                              onClick={copyCurrentPrompt}
                              className="px-3 py-1.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-md text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 flex-shrink-0 shadow-md"
                              title="Скопировать этот фрагмент промпта для отправки в нейросеть"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                              <span>{copiedPromptId === prompts[currentPromptIdx].index ? 'Скопировано! ✓' : 'Скопировать промпт'}</span>
                            </button>
                          </div>

                          <div className="flex-1 overflow-auto p-3 font-mono text-xs leading-relaxed text-gray-300 bg-[#080808] whitespace-pre-wrap select-text scrollbar-thin scrollbar-thumb-[#333]">
                            {prompts[currentPromptIdx].content}
                          </div>
                        </div>

                        {/* Правая колонка: Ввод ответа нейросети для этого промпта */}
                        <div className="flex-1 flex flex-col min-w-0 bg-[#0d0d0d] border border-[#262626] rounded-lg overflow-hidden">
                          <div className="p-2.5 bg-[#171717] border-b border-[#282828] flex items-center justify-between gap-2 flex-shrink-0">
                            <div className="flex items-center gap-2">
                              <span className={`w-2.5 h-2.5 rounded-full ${aiAnswersMap[prompts[currentPromptIdx].index]?.trim() ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                              <span className="font-mono text-xs font-bold text-white">
                                Ответ нейросети на фрагмент #{prompts[currentPromptIdx].index}
                              </span>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded border font-mono ${
                              aiAnswersMap[prompts[currentPromptIdx].index]?.trim()
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                : 'bg-amber-950 text-amber-300 border-amber-800'
                            }`}>
                              {aiAnswersMap[prompts[currentPromptIdx].index]?.trim() ? 'Заполнен ✓' : 'Ожидает ответа'}
                            </span>
                          </div>

                          <div className="flex-1 p-2 flex flex-col min-h-0 bg-[#0a0a0a]">
                            <textarea
                              value={aiAnswersMap[prompts[currentPromptIdx].index] || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                const idx = prompts[currentPromptIdx].index;
                                setAiAnswersMap(prev => ({ ...prev, [idx]: val }));
                                if (val.trim()) setPromptValidationError('');
                              }}
                              placeholder={`Вставьте сюда ответ нейросети на фрагмент #${prompts[currentPromptIdx].index}...\n\nПример формата блока:\n<<<${targetComponent || 'КОМПОНЕНТ'}_1>>> START\n<<<NAME>>> = DVDD\n<<<${targetComponent || 'КОМПОНЕНТ'}_1_DATASHEET>>> START\nDigital core power 1.2V\n<<<${targetComponent || 'КОМПОНЕНТ'}_1_DATASHEET>>> END\n<<<${targetComponent || 'КОМПОНЕНТ'}_1>>> END`}
                              className="flex-1 w-full bg-transparent border-0 outline-none text-xs font-mono text-gray-200 resize-none select-text p-1 leading-relaxed placeholder-gray-600"
                            />
                          </div>

                          <div className="p-2.5 bg-[#121212] border-t border-[#222] flex items-center justify-between text-xs text-gray-400 flex-shrink-0">
                            <div className="flex items-center gap-2">
                              {aiAnswersMap[prompts[currentPromptIdx].index]?.trim() && (
                                <button
                                  onClick={() => {
                                    const idx = prompts[currentPromptIdx].index;
                                    setAiAnswersMap(prev => {
                                      const copy = { ...prev };
                                      delete copy[idx];
                                      return copy;
                                    });
                                  }}
                                  className="text-red-400 hover:text-red-300 text-xs transition-colors"
                                >
                                  Очистить этот ответ
                                </button>
                              )}
                            </div>

                            <button
                              onClick={handleNextPrompt}
                              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold transition-all flex items-center gap-1.5 shadow-md active:scale-95"
                            >
                              <span>{currentPromptIdx < prompts.length - 1 ? 'Далее к следующему фрагменту ➔' : 'Все заполнено — продолжить пайплайн ➔'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Нижняя панель подсказки и действий */}
                <div className="mt-3 pt-2.5 border-t border-[#262626] flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400 flex-shrink-0">
                  <div className="flex items-center gap-2 font-sans">
                    <span className="text-blue-400 font-bold">Инструкция:</span>
                    <span className="text-gray-300">
                      Скопируйте отдельный фрагмент промпта ➔ отправьте в ИИ ➔ вставьте полученный ответ ➔ перейдите к следующему фрагменту.
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={stopPipeline}
                      className="px-3 py-1 bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-300 rounded text-xs font-bold transition-all"
                    >
                      Прервать пайплайн
                    </button>
                    <button
                      onClick={submitAiAnswers}
                      disabled={isSubmittingAi || prompts.length === 0}
                      className="px-4 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded text-xs transition-all shadow-md active:scale-95"
                    >
                      {isSubmittingAi ? 'Отправка...' : 'Далее (Продолжить пайплайн) →'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Содержимое вкладки КОНСОЛЬ */}
            {activeTab === 'console' && (
              <div className="flex-1 h-full min-h-0 flex flex-col">
                <div className="flex items-center justify-between pb-2 text-xs text-gray-400 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-gray-200 font-bold font-mono">Консоль вывода пайплайна</span>
                    <span className="text-[11px] text-gray-500 font-mono">({logs.split('\n').filter(Boolean).length} строк)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigator.clipboard.writeText(logs)}
                      className="text-[11px] text-gray-300 hover:text-white px-2.5 py-1 rounded bg-[#1c1c1c] border border-[#333] hover:border-[#444] transition-colors"
                      title="Скопировать весь лог в буфер обмена"
                    >
                      Скопировать вывод
                    </button>
                    <button
                      onClick={() => setLogs('Консоль очищена.\n')}
                      className="text-[11px] text-gray-400 hover:text-red-400 px-2.5 py-1 rounded bg-[#1c1c1c] border border-[#333] hover:border-red-900 transition-colors"
                      title="Очистить экран консоли"
                    >
                      Очистить
                    </button>
                  </div>
                </div>
                <pre ref={scrollRef} className="flex-1 h-full w-full bg-black p-4 md:p-6 border border-[#2a2a2a] rounded-xl overflow-auto whitespace-pre-wrap text-xs md:text-sm leading-relaxed font-mono select-text shadow-inner scrollbar-thin scrollbar-thumb-[#333] scrollbar-track-black">
                  {logs.split('\n').map((line, i) => {
                    let className = "text-green-400/90";
                    const isError = line.includes('[ERROR]') || line.includes('[FATAL ERROR]') || line.includes('[CRITICAL ERROR]');
                    const isNpmNotice = line.includes('npm notice');
                    
                    if (isError && !isNpmNotice) {
                      className = "text-red-500 font-bold";
                    } else if (line.includes('[INFO]') || isNpmNotice) {
                      className = "text-blue-400";
                    } else if (line.startsWith('---')) {
                      className = "text-yellow-500 font-bold";
                    }
                    return (
                      <div key={i} className={className}>
                        {line}
                      </div>
                    );
                  })}
                </pre>
              </div>
            )}

            {/* Содержимое вкладки РЕЗУЛЬТАТЫ РАБОТЫ СКРИПТОВ */}
            {activeTab === 'artifacts' && (
              <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0 overflow-hidden bg-[#121212] border border-[#2a2a2a] rounded-xl p-3 shadow-2xl">
                {/* Левая колонка: Список файлов и фильтрация */}
                <div className="w-full md:w-80 flex flex-col gap-2 flex-shrink-0 border-b md:border-b-0 md:border-r border-[#262626] md:pr-3 overflow-hidden">
                  {/* Поиск и категории */}
                  <div className="space-y-2 flex-shrink-0">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Поиск файла или этапа..."
                        value={artifactSearchQuery}
                        onChange={(e) => setArtifactSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-[#181818] border border-[#333] rounded-md text-xs text-white placeholder-gray-500 outline-none focus:border-[#2563eb]"
                      />
                      <svg className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                      </svg>
                      {artifactSearchQuery && (
                        <button
                          onClick={() => setArtifactSearchQuery('')}
                          className="absolute right-2 top-2 text-gray-400 hover:text-white text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Фильтры категорий */}
                    <div className="flex flex-wrap gap-1 text-[10px]">
                      {[
                        { id: 'all', label: 'Все' },
                        { id: 'datasheet', label: 'Даташит' },
                        { id: 'pcb_to_netlist', label: 'Netlist' },
                        { id: 'graph', label: 'Граф' },
                        { id: 'final', label: 'Итог' }
                      ].map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => setArtifactCategoryFilter(cat.id as any)}
                          className={`px-2 py-0.5 rounded transition-all ${
                            artifactCategoryFilter === cat.id
                              ? 'bg-blue-600 text-white font-bold'
                              : 'bg-[#1e1e1e] text-gray-400 hover:text-gray-200'
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Список файлов */}
                  <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-48 md:max-h-none scrollbar-thin scrollbar-thumb-[#333]">
                    {artifacts.length === 0 ? (
                      <div className="p-4 text-center text-gray-500 text-xs italic">
                        Файлы работы скриптов пока не найдены. Запустите пайплайн для генерации результатов.
                      </div>
                    ) : (
                      artifacts
                        .filter(a => {
                          if (artifactCategoryFilter !== 'all' && a.category !== artifactCategoryFilter) return false;
                          if (!artifactSearchQuery) return true;
                          const q = artifactSearchQuery.toLowerCase();
                          return a.fileName.toLowerCase().includes(q) || 
                                 a.stageName.toLowerCase().includes(q) || 
                                 a.scriptName.toLowerCase().includes(q) ||
                                 a.relativePath.toLowerCase().includes(q);
                        })
                        .map((art, idx) => {
                          const isSelected = selectedArtifact?.relativePath === art.relativePath;
                          let tagColor = 'bg-gray-800 text-gray-300 border-gray-700';
                          if (art.category === 'datasheet') tagColor = 'bg-red-950/80 text-red-300 border-red-800/60';
                          if (art.category === 'pcb_to_netlist') tagColor = 'bg-blue-950/80 text-blue-300 border-blue-800/60';
                          if (art.category === 'graph') tagColor = 'bg-indigo-950/80 text-indigo-300 border-indigo-800/60';
                          if (art.category === 'final') tagColor = 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80';

                          return (
                            <button
                              key={idx}
                              onClick={() => setSelectedArtifact(art)}
                              className={`w-full text-left p-2 rounded-lg border transition-all flex flex-col gap-1 ${
                                isSelected
                                  ? 'bg-[#1e293b] border-blue-500 shadow-md ring-1 ring-blue-500/50'
                                  : 'bg-[#181818] border-[#292929] hover:border-[#444] hover:bg-[#1f1f1f]'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1 w-full">
                                <span className="font-mono text-xs font-semibold text-gray-200 truncate" title={art.fileName}>
                                  {art.fileName}
                                </span>
                                <span className={`text-[9px] px-1.5 py-0.2 rounded border font-mono ${tagColor}`}>
                                  {art.formattedSize}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-gray-400">
                                <span className="truncate max-w-[170px]" title={art.stageName}>
                                  {art.stageName}
                                </span>
                                {art.lineCount !== undefined && (
                                  <span className="font-mono text-[9px] text-gray-500 flex-shrink-0">
                                    {art.lineCount} стр.
                                  </span>
                                )}
                              </div>
                              <span className="text-[9px] text-gray-500 font-mono truncate" title={art.relativePath}>
                                {art.relativePath}
                              </span>
                            </button>
                          );
                        })
                    )}
                  </div>
                </div>

                {/* Правая колонка: Просмотр содержимого выбранного артефакта */}
                <div className="flex-1 flex flex-col min-w-0 bg-[#0d0d0d] border border-[#222] rounded-lg overflow-hidden">
                  {selectedArtifact ? (
                    <>
                      {/* Шапка файла */}
                      <div className="p-2.5 bg-[#151515] border-b border-[#262626] flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0"></span>
                          <div className="truncate">
                            <div className="flex items-center gap-2">
                              <h3 className="font-mono text-sm font-bold text-white truncate" title={selectedArtifact.fileName}>
                                {selectedArtifact.fileName}
                              </h3>
                              <span className="text-[10px] text-blue-400 font-mono bg-blue-950/70 border border-blue-800/50 px-1.5 py-0.2 rounded">
                                Скрипт: {selectedArtifact.scriptName}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-400 truncate">
                              Этап: <span className="text-gray-200">{selectedArtifact.stageName}</span> | Путь: <span className="font-mono text-gray-300">{selectedArtifact.relativePath}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 font-mono">
                            {selectedArtifact.formattedSize}
                            {selectedArtifact.lineCount !== undefined ? ` • ${selectedArtifact.lineCount} строк` : ''}
                          </span>
                          
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(artifactContent);
                              setCopiedArtifact(true);
                              setTimeout(() => setCopiedArtifact(false), 2000);
                            }}
                            className="px-2.5 py-1 bg-[#222] hover:bg-[#333] border border-[#444] rounded text-xs text-gray-200 hover:text-white transition-colors flex items-center gap-1.5 active:scale-95"
                            title="Скопировать содержимое"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                            {copiedArtifact ? 'Скопировано!' : 'Копировать'}
                          </button>
                        </div>
                      </div>

                      {/* Текст файла */}
                      <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed bg-[#0a0a0a] scrollbar-thin scrollbar-thumb-[#333]">
                        {isLoadingArtifact ? (
                          <div className="flex items-center justify-center h-full gap-2 text-gray-400">
                            <svg className="animate-spin w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Загрузка содержимого файла...
                          </div>
                        ) : (
                          <pre className="text-gray-300 whitespace-pre-wrap select-text">
                            {artifactContent || 'Файл пуст'}
                          </pre>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500 text-sm italic">
                      Выберите файл из списка слева для просмотра
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>

      {/* Модальное окно подключения GitHub и поиска файлов */}
      {showGitHubModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDownloadingGitHub) {
              setShowGitHubModal(false);
            }
          }}
        >
          <div className="bg-[#12141a] border border-[#2a3245] rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-sans text-gray-200">
            {/* Шапка модального окна */}
            <div className="p-4 sm:p-5 bg-[#181b24] border-b border-[#282f42] flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#212638] border border-[#343d56] flex items-center justify-center text-white flex-shrink-0 shadow-inner">
                  <svg className="w-6 h-6 fill-current text-white" viewBox="0 0 16 16">
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                    GitHub: Обновление и поиск файлов
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800">
                      v{projectVersion?.commit ? projectVersion.commit.slice(0, 7) : 'latest'}
                    </span>
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Синхронизация исходного кода по репозиторию GitHub и загрузка файлов в проект
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowGitHubModal(false)}
                className="p-2 text-gray-400 hover:text-white hover:bg-[#252b3d] rounded-lg transition-colors"
                title="Закрыть"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            {/* Вкладки модального окна */}
            <div className="bg-[#141722] border-b border-[#242b3d] px-4 sm:px-6 flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  setGitHubModalTab('update');
                  if (!updateCheckResult && !isCheckingUpdate) {
                    checkProjectUpdate();
                  }
                }}
                className={`py-3 px-3.5 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
                  gitHubModalTab === 'update'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <span>🔄 Обновление проекта</span>
                {!updateCheckResult?.upToDate && updateCheckResult?.commitsAhead && updateCheckResult.commitsAhead.length > 0 && (
                  <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-[10px]">
                    {updateCheckResult.commitsAhead.length} коммитов
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setGitHubModalTab('push');
                  if (!diffResult && !isLoadingDiff) {
                    fetchPushDiff();
                  }
                }}
                className={`py-3 px-3.5 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
                  gitHubModalTab === 'push'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <span>🚀 Пуш в репозиторий & Diff</span>
                {diffResult?.summary?.totalChanged !== undefined && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono border ${
                    diffResult.summary.totalChanged > 0
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-700/80'
                      : 'bg-gray-800 text-gray-400 border-gray-700'
                  }`}>
                    {diffResult.summary.totalChanged} изм.
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setGitHubModalTab('files')}
                className={`py-3 px-3.5 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
                  gitHubModalTab === 'files'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <span>📁 Поиск и скачивание файлов</span>
                {gitHubFiles.length > 0 && (
                  <span className="text-[10px] text-gray-500 font-normal">
                    ({gitHubFiles.length})
                  </span>
                )}
              </button>
            </div>

            {/* ВКЛАДКА 1: ОБНОВЛЕНИЕ ПРОЕКТА ПО GITHUB */}
            {gitHubModalTab === 'update' && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
                {/* Верхняя панель: выбор репозитория и ветки */}
                <div className="bg-[#141722] border border-[#242b3d] rounded-2xl p-4 sm:p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>Синхронизация с upstream репозиторием</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700/60 font-mono">
                          Git Sync
                        </span>
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Проверка наличия обновлений кода, диффа коммитов и безопасное накатывание изменений
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => checkProjectUpdate()}
                        disabled={isCheckingUpdate || isApplyingUpdate}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-950/50 active:scale-95"
                      >
                        {isCheckingUpdate ? (
                          <>
                            <svg className="animate-spin w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Проверка...</span>
                          </>
                        ) : (
                          <>
                            <span>🔄</span>
                            <span>Проверить обновления</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
                    <div className="flex-1 relative">
                      <span className="text-[10px] text-gray-400 block mb-1 font-mono uppercase">Репозиторий GitHub:</span>
                      <input
                        type="text"
                        value={gitHubRepoInput}
                        onChange={(e) => setGitHubRepoInput(e.target.value)}
                        placeholder="owner/repo (напр. gregpost/pcb-ai-validator)"
                        className="w-full px-3 py-2 bg-[#0c0e14] border border-[#2d364b] focus:border-blue-500 rounded-xl text-xs text-white placeholder-gray-500 outline-none font-mono"
                      />
                    </div>

                    <div className="w-full md:w-36">
                      <span className="text-[10px] text-gray-400 block mb-1 font-mono uppercase">Ветка:</span>
                      <input
                        type="text"
                        value={gitHubSelectedBranch || 'main'}
                        onChange={(e) => setGitHubSelectedBranch(e.target.value)}
                        placeholder="main"
                        className="w-full px-3 py-2 bg-[#0c0e14] border border-[#2d364b] focus:border-blue-500 rounded-xl text-xs text-white placeholder-gray-500 outline-none font-mono"
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => setShowTokenInput(!showTokenInput)}
                        className={`px-3 py-2 text-xs rounded-xl border transition-colors flex items-center gap-1.5 font-medium ${
                          gitHubToken.trim() || showTokenInput
                            ? 'bg-blue-950/70 border-blue-600 text-blue-300'
                            : 'bg-[#1b202e] border-[#2f384e] text-gray-400 hover:text-gray-200'
                        }`}
                        title="Указать GitHub Personal Access Token"
                      >
                        <span>Токен {gitHubToken.trim() ? '✓' : '(необязателен)'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Разъяснение по токену */}
                  <div className="p-3 bg-blue-950/30 border border-blue-900/40 rounded-xl text-xs text-blue-200/90 flex items-start gap-2.5">
                    <span className="text-blue-400 text-sm mt-0.5">ℹ️</span>
                    <div>
                      <p className="font-semibold text-blue-300">Зачем указывать токен GitHub?</p>
                      <p className="text-[11px] text-blue-300/80 mt-0.5">
                        Для публичного репозитория <code className="bg-blue-900/60 px-1 py-0.2 rounded text-blue-200 font-mono">gregpost/pcb-ai-validator</code> токен <strong>НЕ требуется</strong> — проект обновляется свободно без каких-либо ключей.
                        Токен нужен только для <strong>приватных репозиториев</strong> вашей организации либо чтобы расширить лимит анонимных обращений к GitHub API (с 60 до 5000 в час).
                      </p>
                    </div>
                  </div>

                  {/* Пресет основного репозитория */}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] text-gray-400 font-bold">Основной репозиторий:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setGitHubRepoInput('gregpost/pcb-ai-validator');
                        checkProjectUpdate('gregpost/pcb-ai-validator', 'main');
                      }}
                      className="px-2.5 py-1 bg-gradient-to-r from-blue-900 to-indigo-900 hover:from-blue-800 hover:to-indigo-800 text-blue-100 hover:text-white border border-blue-500/60 rounded-lg text-xs font-mono font-bold transition-all shadow-sm flex items-center gap-1.5"
                    >
                      <span className="text-amber-300">★</span>
                      <span>gregpost/pcb-ai-validator (main)</span>
                    </button>
                  </div>
                </div>

                {/* Статус выполнения обновления */}
                {isApplyingUpdate && (
                  <div className="p-5 bg-blue-950/50 border border-blue-500/60 rounded-2xl flex items-center gap-4 animate-pulse">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400 flex items-center justify-center flex-shrink-0">
                      <svg className="animate-spin w-5 h-5 text-blue-300" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Применение обновления проекта...</h4>
                      <p className="text-xs text-blue-200/80 mt-0.5">
                        Скачиваем архив с GitHub, распаковываем и обновляем модули проекта...
                      </p>
                    </div>
                  </div>
                )}

                {/* Сообщение об успешном обновлении */}
                {updateSuccessMessage && (
                  <div className="p-4 bg-emerald-950/60 border border-emerald-500/60 rounded-2xl space-y-2 animate-fadeIn">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-900/60 text-emerald-300 flex items-center justify-center font-bold text-sm">
                        ✓
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-emerald-200">Проект успешно обновлен!</h4>
                        <p className="text-xs text-emerald-300/80">{updateSuccessMessage}</p>
                      </div>
                    </div>
                    {updatedFilesList.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-emerald-900/40 text-xs">
                        <span className="text-emerald-400 font-semibold block mb-1">
                          Обновлено файлов ({updatedFilesList.length}):
                        </span>
                        <div className="max-h-36 overflow-y-auto space-y-1 font-mono text-[11px] text-gray-300 bg-[#0c0e14] p-2 rounded-lg border border-[#202738]">
                          {updatedFilesList.map((f, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-emerald-300/90">
                              <span>•</span>
                              <span>{f}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Сообщение об ошибке */}
                {updateError && (
                  <div className="p-4 bg-red-950/60 border border-red-500/60 rounded-2xl flex items-start gap-3 animate-fadeIn">
                    <div className="w-7 h-7 rounded-lg bg-red-900/60 text-red-300 flex items-center justify-center font-bold text-sm flex-shrink-0">
                      ✕
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-red-200">Ошибка при обновлении</h4>
                      <p className="text-xs text-red-300/90 mt-0.5">{updateError}</p>
                    </div>
                  </div>
                )}

                {/* Сравнение версий: локальная vs GitHub */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Локальная версия */}
                  <div className="bg-[#12151f] border border-[#262e42] rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                        Текущая версия проекта (локальная)
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded font-mono text-xs font-bold bg-blue-900/60 text-blue-200 border border-blue-700/60" title={`Источник: ${updateCheckResult?.localAppVersion?.fileSource || projectVersion?.fileSource || 'version.json'}`}>
                          v{updateCheckResult?.localAppVersion?.version || projectVersion?.appVersion || '1.0.1'}
                        </span>
                        <span className="px-2 py-0.5 rounded font-mono text-xs bg-[#1b2234] text-blue-300 border border-[#313e5e]">
                          {projectVersion?.shortSha || (projectVersion?.commit ? projectVersion.commit.slice(0, 7) : 'd766ddd')}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs text-gray-400 font-mono">
                      <div>
                        <span className="text-gray-500">Версия в файле: </span>
                        <span className="text-blue-300 font-bold">v{updateCheckResult?.localAppVersion?.version || projectVersion?.appVersion || '1.0.1'}</span>
                        <span className="text-gray-500 text-[11px] ml-1">({updateCheckResult?.localAppVersion?.fileSource || projectVersion?.fileSource || 'version.json'})</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Коммит: </span>
                        <span className="text-gray-200">{projectVersion?.commit || projectVersion?.shortSha || 'd766ddd'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Сообщение: </span>
                        <span className="text-gray-200">{projectVersion?.commitMessage || 'feat: add GitHub project update mechanism'}</span>
                      </div>
                      {projectVersion?.updatedAt && (
                        <div>
                          <span className="text-gray-500">Дата синхронизации: </span>
                          <span className="text-gray-300">{new Date(projectVersion.updatedAt).toLocaleString('ru-RU')}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-500">Ветка: </span>
                        <span className="text-gray-300">{projectVersion?.branch || 'main'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Удаленная версия на GitHub */}
                  <div className="bg-[#12151f] border border-[#262e42] rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                        Последняя версия на GitHub
                      </span>
                      <div className="flex items-center gap-1.5">
                        {updateCheckResult?.remoteAppVersion && (
                          <span className="px-2 py-0.5 rounded font-mono text-xs font-bold bg-purple-900/60 text-purple-200 border border-purple-700/60" title={`Источник: ${updateCheckResult.remoteAppVersion.fileSource}`}>
                            v{updateCheckResult.remoteAppVersion.version}
                          </span>
                        )}
                        {updateCheckResult?.latestCommit && (
                          <span className="px-2 py-0.5 rounded font-mono text-xs bg-purple-950/60 text-purple-300 border border-purple-800/60">
                            {updateCheckResult.latestCommit.sha.slice(0, 7)}
                          </span>
                        )}
                      </div>
                    </div>

                    {updateCheckResult?.latestCommit ? (
                      <div className="space-y-1.5 text-xs text-gray-400 font-mono">
                        <div>
                          <span className="text-gray-500">Версия в файле: </span>
                          <span className="text-purple-300 font-bold">
                            v{updateCheckResult.remoteAppVersion?.version || updateCheckResult.localAppVersion?.version || '1.0.1'}
                          </span>
                          <span className="text-gray-500 text-[11px] ml-1">
                            ({updateCheckResult.remoteAppVersion?.fileSource || 'version.json'})
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Коммит: </span>
                          <span className="text-gray-200">{updateCheckResult.latestCommit.sha}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Автор: </span>
                          <span className="text-gray-200">{updateCheckResult.latestCommit.author}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Сообщение: </span>
                          <span className="text-gray-200">{updateCheckResult.latestCommit.message}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Дата: </span>
                          <span className="text-gray-300">
                            {updateCheckResult.latestCommit.date 
                              ? new Date(updateCheckResult.latestCommit.date).toLocaleString('ru-RU') 
                              : '-'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500 py-4 text-center">
                        {isCheckingUpdate ? 'Запрос информации с GitHub...' : 'Нажмите «Проверить обновления» для получения данных'}
                      </div>
                    )}
                  </div>
                </div>

                {/* РЕЗУЛЬТАТ СРАВНЕНИЯ ВЕРСИЙ */}
                {updateCheckResult && (
                  <div className="space-y-4">
                    {/* Панель критериев проверки: Файл версии + Diff кода */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Критерий 1: Файл версии */}
                      <div className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                        updateCheckResult.hasVersionDiff 
                          ? 'bg-amber-950/40 border-amber-600/60 text-amber-200' 
                          : 'bg-emerald-950/40 border-emerald-600/60 text-emerald-200'
                      }`}>
                        <div className="flex items-center gap-2">
                          <span className="text-base">{updateCheckResult.hasVersionDiff ? '⚠️' : '✓'}</span>
                          <div>
                            <span className="font-bold block">Файл версии ({updateCheckResult.localAppVersion?.fileSource || 'version.json'})</span>
                            <span className="text-[11px] opacity-80">
                              {updateCheckResult.versionComparisonMessage || `v${updateCheckResult.localAppVersion?.version || '1.0.1'}`}
                            </span>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          updateCheckResult.hasVersionDiff ? 'bg-amber-900 text-amber-200' : 'bg-emerald-900 text-emerald-200'
                        }`}>
                          {updateCheckResult.hasVersionDiff ? 'Новая версия' : 'Актуальна'}
                        </span>
                      </div>

                      {/* Критерий 2: Разность кода (Diff) */}
                      <div className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                        updateCheckResult.hasCodeDiff 
                          ? 'bg-amber-950/40 border-amber-600/60 text-amber-200' 
                          : 'bg-emerald-950/40 border-emerald-600/60 text-emerald-200'
                      }`}>
                        <div className="flex items-center gap-2">
                          <span className="text-base">{updateCheckResult.hasCodeDiff ? '📝' : '✓'}</span>
                          <div>
                            <span className="font-bold block">Состояние кода (Diff файлов)</span>
                            <span className="text-[11px] opacity-80">
                              {updateCheckResult.hasCodeDiff 
                                ? `Изменено файлов: ${updateCheckResult.diffFiles?.length || 0}`
                                : `Проверено ${updateCheckResult.checkedFilesCount || 0} файлов: идентичны`}
                            </span>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          updateCheckResult.hasCodeDiff ? 'bg-amber-900 text-amber-200' : 'bg-emerald-900 text-emerald-200'
                        }`}>
                          {updateCheckResult.hasCodeDiff ? 'Есть Diff' : 'Совпадает'}
                        </span>
                      </div>
                    </div>

                    {/* СЛУЧАЙ 1: Версии совпадают */}
                    {updateCheckResult.upToDate ? (
                      <div className="p-5 bg-[#0e1c15] border-2 border-emerald-500/50 rounded-2xl space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-500 text-emerald-300 flex items-center justify-center font-black text-xl flex-shrink-0">
                            ✓
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-emerald-300">
                              Версии совпадают! У вас установлена самая свежая версия проекта.
                            </h3>
                            <p className="text-xs text-emerald-200/80 mt-0.5">
                              Проверено по файлу версии (<code className="font-mono text-emerald-300 bg-emerald-950/80 px-1 py-0.5 rounded">v{updateCheckResult.localAppVersion?.version || '1.0.1'}</code>) и по diff файлов {updateCheckResult.checkedFilesCount ? `(${updateCheckResult.checkedFilesCount} файлов)` : ''}: различий в коде не обнаружено. Локальный проект полностью актуален.
                            </p>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-emerald-900/40 flex flex-wrap items-center justify-between gap-3 text-xs">
                          <span className="text-gray-400">
                            Никаких действий не требуется. Исходный код актуален.
                          </span>
                          <button
                            type="button"
                            onClick={() => applyProjectUpdate()}
                            disabled={isApplyingUpdate}
                            className="px-3 py-1.5 bg-[#182a20] hover:bg-[#203629] text-emerald-300 border border-emerald-700/60 rounded-xl text-xs font-medium transition-all"
                            title="Перезагрузить исходники из GitHub заново"
                          >
                            Принудительно перезагрузить код
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* СЛУЧАЙ 2: Версии НЕ совпадают (доступно обновление) */
                      <div className="p-5 bg-[#231709] border-2 border-amber-500/60 rounded-2xl space-y-4 shadow-xl shadow-amber-950/30">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-950 border border-amber-500 text-amber-300 flex items-center justify-center font-bold text-xl flex-shrink-0 mt-0.5">
                            ⚡
                          </div>
                          <div className="flex-1">
                            <h3 className="text-base font-bold text-amber-300 flex items-center gap-2">
                              Доступно обновление проекта с GitHub!
                              {updateCheckResult.hasVersionDiff && updateCheckResult.remoteAppVersion && (
                                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-amber-950 text-amber-200 border border-amber-700">
                                  v{updateCheckResult.remoteAppVersion.version}
                                </span>
                              )}
                              {updateCheckResult.diffFiles && updateCheckResult.diffFiles.length > 0 && (
                                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-amber-950 text-amber-200 border border-amber-700">
                                  {updateCheckResult.diffFiles.length} измененных файлов
                                </span>
                              )}
                            </h3>
                            <p className="text-xs text-amber-200/90 mt-1">
                              {updateCheckResult.hasVersionDiff 
                                ? updateCheckResult.versionComparisonMessage 
                                : 'В репозитории GitHub найдены обновления кода по сравнению с локальной установкой.'}
                            </p>
                          </div>
                        </div>

                        {/* Список файлов с различиями в коде (diff) */}
                        {updateCheckResult.diffFiles && updateCheckResult.diffFiles.length > 0 && (
                          <div className="space-y-1.5">
                            <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5 uppercase tracking-wider">
                              <span>Различия в коде (Diff файлов):</span>
                              <span className="text-gray-400 font-normal">({updateCheckResult.diffFiles.length} файлов)</span>
                            </h4>
                            <div className="max-h-36 overflow-y-auto space-y-1 bg-[#120d05] border border-amber-900/50 p-2.5 rounded-xl font-mono text-xs">
                              {updateCheckResult.diffFiles.map((df, i) => (
                                <div key={i} className="flex items-center justify-between text-[11px] py-0.5 px-1.5 rounded hover:bg-amber-950/40">
                                  <span className="text-gray-200">{df.path}</span>
                                  <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                                    df.status === 'added' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800'
                                  }`}>
                                    {df.status === 'added' ? 'новый' : 'изменен'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Сообщения Git-коммитов */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold text-amber-200/90 flex items-center gap-1.5 uppercase tracking-wider">
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>
                            Сообщения Git (список коммитов):
                          </h4>

                          <div className="max-h-48 overflow-y-auto space-y-2 bg-[#120d05] border border-amber-900/50 p-3 rounded-xl font-mono text-xs">
                            {updateCheckResult.commitsAhead && updateCheckResult.commitsAhead.length > 0 ? (
                              updateCheckResult.commitsAhead.map((c, i) => (
                                <div key={i} className="p-2 bg-[#1c1409] border border-amber-900/40 rounded-lg space-y-1">
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="text-amber-400 font-bold">{c.sha.slice(0, 7)}</span>
                                    <span className="text-gray-400">{c.author} • {c.date ? new Date(c.date).toLocaleString('ru-RU') : ''}</span>
                                  </div>
                                  <p className="text-gray-200 font-sans text-xs">{c.message}</p>
                                </div>
                              ))
                            ) : (
                              <div className="p-2 bg-[#1c1409] border border-amber-900/40 rounded-lg space-y-1">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-amber-400 font-bold">{updateCheckResult.latestCommit.sha.slice(0, 7)}</span>
                                  <span className="text-gray-400">{updateCheckResult.latestCommit.author}</span>
                                </div>
                                <p className="text-gray-200 font-sans text-xs">{updateCheckResult.latestCommit.message}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Кнопки подтверждения и отмены */}
                        <div className="pt-3 border-t border-amber-900/50 flex flex-col sm:flex-row items-center justify-between gap-3">
                          <p className="text-[11px] text-amber-300/80">
                            Обновление затронет python-скрипты <code className="text-amber-200">graph/</code>, <code className="text-amber-200">pcb_to_netlist/</code>, <code className="text-amber-200">huge_file/</code> и конфигурации.
                          </p>

                          <div className="flex items-center gap-3 w-full sm:w-auto">
                            <button
                              type="button"
                              onClick={() => {
                                setUpdateCheckResult(null);
                                setUpdateError('');
                              }}
                              disabled={isApplyingUpdate}
                              className="flex-1 sm:flex-none px-4 py-2.5 bg-[#2a1c0d] hover:bg-[#382613] text-gray-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-amber-900/60 active:scale-95"
                            >
                              ✕ Отменить
                            </button>

                            <button
                              type="button"
                              onClick={() => applyProjectUpdate()}
                              disabled={isApplyingUpdate}
                              className="flex-1 sm:flex-none px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-xl text-xs font-black transition-all shadow-xl shadow-green-950/60 flex items-center justify-center gap-2 active:scale-95 border border-emerald-400/80"
                            >
                              {isApplyingUpdate ? (
                                <>
                                  <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  <span>Обновление...</span>
                                </>
                              ) : (
                                <>
                                  <span>✓</span>
                                  <span>Утвердить обновление проекта</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ВКЛАДКА 2: ПУШ В РЕПОЗИТОРИЙ И ДИФФ ПРАВОК */}
            {gitHubModalTab === 'push' && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
                {/* 1. Блок настройки целевого репозитория и ветки */}
                <div className="bg-[#141722] border border-[#242b3d] rounded-2xl p-4 sm:p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>🚀</span>
                        <span>Параметры отправки (Push) в GitHub</span>
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Отправка локальных изменений проекта в заданный репозиторий с автоматическим инкрементом версии
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => fetchPushDiff()}
                      disabled={isLoadingDiff}
                      className="px-3.5 py-1.5 bg-[#1f283d] hover:bg-[#283552] text-blue-300 hover:text-white border border-[#3b4b73] rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-sm disabled:opacity-50"
                    >
                      <svg className={`w-3.5 h-3.5 ${isLoadingDiff ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                      </svg>
                      <span>{isLoadingDiff ? 'Сравнение...' : 'Обновить Diff'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-300 mb-1">
                        Целевой репозиторий GitHub:
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={pushRepoInput}
                          onChange={(e) => setPushRepoInput(e.target.value)}
                          placeholder="owner/repo (напр. gregpost/pcb-ai-validator)"
                          className="w-full bg-[#0d1017] border border-[#283248] focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder-gray-600 focus:outline-none transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => setPushRepoInput('gregpost/pcb-ai-validator')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 hover:text-blue-300 font-mono px-1.5 py-0.5 rounded bg-[#181d28] border border-[#2c374e]"
                          title="Вернуть репозиторий по умолчанию"
                        >
                          default
                        </button>
                      </div>
                      <span className="text-[10px] text-gray-500 mt-1 block">
                        По умолчанию: <code className="text-gray-400">gregpost/pcb-ai-validator</code>
                      </span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-300 mb-1">
                        Ветка (Branch):
                      </label>
                      <input
                        type="text"
                        value={pushBranchInput}
                        onChange={(e) => setPushBranchInput(e.target.value)}
                        placeholder="main"
                        className="w-full bg-[#0d1017] border border-[#283248] focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder-gray-600 focus:outline-none transition-colors"
                      />
                      <span className="text-[10px] text-gray-500 mt-1 block">
                        Ветка для отправки коммита (обычно <code className="text-gray-400">main</code>)
                      </span>
                    </div>
                  </div>

                  {/* Настройка Personal Access Token */}
                  <div className="pt-2 border-t border-[#1f2636]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-300">GitHub Personal Access Token (PAT):</span>
                        {gitHubToken ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                            <span>✓</span>
                            <span>Токен настроен</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1">
                            <span>!</span>
                            <span>Требуется для пуша</span>
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowTokenSettings(!showTokenSettings)}
                        className="text-xs text-blue-400 hover:text-blue-300 underline font-medium self-start sm:self-auto"
                      >
                        {showTokenSettings ? 'Скрыть поле токена' : gitHubToken ? 'Изменить токен' : 'Ввести токен PAT'}
                      </button>
                    </div>

                    {showTokenSettings && (
                      <div className="mt-3 p-3 bg-[#0d1017] border border-[#232c3f] rounded-xl space-y-2">
                        <input
                          type="password"
                          value={gitHubToken}
                          onChange={(e) => setGitHubToken(e.target.value)}
                          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx (GitHub Personal Access Token)"
                          className="w-full bg-[#141824] border border-[#2b364e] focus:border-emerald-500 rounded-lg px-3 py-1.5 text-xs font-mono text-white placeholder-gray-600 focus:outline-none"
                        />
                        <div className="flex flex-wrap items-center justify-between text-[11px] text-gray-400 gap-2">
                          <span>
                            Токен должен иметь права <code className="text-emerald-400 font-mono">repo</code> (или fine-grained: <code className="text-emerald-400 font-mono">Contents: Read and write</code>).
                          </span>
                          <a
                            href="https://github.com/settings/tokens/new?scopes=repo&description=PCB+AI+Validator+Sync"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 underline flex items-center gap-1"
                          >
                            <span>Создать токен на GitHub</span>
                            <span>↗</span>
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Блок автоматического повышения версии (Version Bumping) */}
                <div className="bg-gradient-to-r from-[#121926] via-[#141e2a] to-[#121926] border border-[#243547] rounded-2xl p-4 sm:p-5 space-y-3 shadow-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base">🏷️</span>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-blue-300">
                          Автоматическое повышение версии при каждом пуше
                        </h4>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1">
                        При отправке коммита файлы <code className="text-gray-300">version.json</code>, <code className="text-gray-300">VERSION</code> и <code className="text-gray-300">package.json</code> будут автоматически обновлены
                      </p>
                    </div>

                    {/* Визуальная плашка версий */}
                    <div className="flex items-center gap-2 bg-[#0c131c] border border-[#203144] px-3.5 py-2 rounded-xl font-mono text-xs shadow-inner">
                      <div className="text-right">
                        <div className="text-[9px] uppercase tracking-wider text-gray-500">Текущая</div>
                        <div className="text-gray-300 font-bold">
                          v{diffResult?.currentVersion || projectVersion?.appVersion || '1.0.1'}
                        </div>
                      </div>

                      <div className="text-emerald-400 font-black px-1">➔</div>

                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-emerald-400 font-bold">Новая версия</div>
                        <div className="text-emerald-300 font-black text-sm">
                          v{diffResult?.nextVersion || '1.0.2'}
                          <span className="text-[10px] text-emerald-500 ml-1">
                            (#{diffResult?.nextBuild || 2})
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Переключатель инкремента версии */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    <span className="text-gray-400 font-medium">Тип инкремента:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setPushBumpType('patch');
                        fetchPushDiff('patch');
                      }}
                      className={`px-3 py-1.5 rounded-lg font-mono font-bold transition-all border ${
                        pushBumpType === 'patch'
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-600 shadow-sm'
                          : 'bg-[#151c27] text-gray-400 border-[#273449] hover:text-white'
                      }`}
                    >
                      Патч (+0.0.1) — багфиксы
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPushBumpType('minor');
                        fetchPushDiff('minor');
                      }}
                      className={`px-3 py-1.5 rounded-lg font-mono font-bold transition-all border ${
                        pushBumpType === 'minor'
                          ? 'bg-blue-950 text-blue-300 border-blue-600 shadow-sm'
                          : 'bg-[#151c27] text-gray-400 border-[#273449] hover:text-white'
                      }`}
                    >
                      Минор (+0.1.0) — новые фичи
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPushBumpType('major');
                        fetchPushDiff('major');
                      }}
                      className={`px-3 py-1.5 rounded-lg font-mono font-bold transition-all border ${
                        pushBumpType === 'major'
                          ? 'bg-purple-950 text-purple-300 border-purple-600 shadow-sm'
                          : 'bg-[#151c27] text-gray-400 border-[#273449] hover:text-white'
                      }`}
                    >
                      Мажор (+1.0.0) — ключевой релиз
                    </button>
                  </div>
                </div>

                {/* Сообщения об ошибках или успехе */}
                {diffError && (
                  <div className="p-4 bg-red-950/50 border border-red-800/80 rounded-2xl text-xs text-red-200 space-y-2">
                    <div className="font-bold flex items-center gap-1.5 text-red-300">
                      <span>✕</span>
                      <span>Ошибка при вычислении различий:</span>
                    </div>
                    <p className="font-mono text-[11px]">{diffError}</p>
                    <button
                      type="button"
                      onClick={() => fetchPushDiff()}
                      className="px-3 py-1 bg-red-900/60 hover:bg-red-800 text-white rounded-lg font-bold text-xs"
                    >
                      Повторить попытку
                    </button>
                  </div>
                )}

                {pushError && (
                  <div className="p-4 bg-red-950/60 border border-red-800 rounded-2xl text-xs text-red-200 space-y-2 animate-shake">
                    <div className="font-bold flex items-center gap-1.5 text-red-300">
                      <span>✕</span>
                      <span>Не удалось отправить изменения:</span>
                    </div>
                    <p className="font-mono text-[11px] whitespace-pre-wrap">{pushError}</p>
                  </div>
                )}

                {pushResult?.success && (
                  <div className="p-4 bg-emerald-950/60 border border-emerald-700 rounded-2xl text-xs text-emerald-200 space-y-2 animate-fadeIn shadow-lg shadow-emerald-950/40">
                    <div className="font-bold text-sm text-emerald-300 flex items-center gap-2">
                      <span>🎉</span>
                      <span>Изменения успешно отправлены на GitHub!</span>
                    </div>
                    <p className="text-gray-300">{pushResult.message}</p>
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      {pushResult.commitUrl && (
                        <a
                          href={pushResult.commitUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow transition-all active:scale-95"
                        >
                          <span>Открыть коммит {pushResult.shortSha} на GitHub</span>
                          <span>↗</span>
                        </a>
                      )}
                      <span className="font-mono text-emerald-400 bg-emerald-900/60 px-2 py-1 rounded border border-emerald-700/60">
                        Новая версия: v{pushResult.newVersion} (#{pushResult.newBuild})
                      </span>
                    </div>
                  </div>
                )}

                {/* 3. Сводка различий (Diff Summary) и фильтрация */}
                {isLoadingDiff ? (
                  <div className="p-8 bg-[#141722] border border-[#242b3d] rounded-2xl text-center space-y-3">
                    <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-xs text-gray-300 font-medium">
                      Сравнение локальных файлов проекта с веткой {pushBranchInput} репозитория {pushRepoInput}...
                    </p>
                    <span className="text-[10px] text-gray-500 font-mono">
                      Вычисление хэшей Git blob и построчный расчет изменений
                    </span>
                  </div>
                ) : diffResult ? (
                  <div className="space-y-4">
                    {/* Статистическая плашка диффа */}
                    <div className="bg-[#141722] border border-[#242b3d] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                        <span className="px-2.5 py-1 rounded-lg bg-[#1e2536] text-white font-bold border border-[#2d3a54]">
                          Изменено файлов: {diffResult.summary.totalChanged}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-950/70 text-emerald-300 font-bold border border-emerald-800/80">
                          +{diffResult.summary.additions} строк
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-rose-950/70 text-rose-300 font-bold border border-rose-800/80">
                          -{diffResult.summary.deletions} строк
                        </span>
                      </div>

                      {/* Фильтры по типу изменений */}
                      <div className="flex items-center gap-1.5 text-xs">
                        <button
                          type="button"
                          onClick={() => setDiffFilterStatus('all')}
                          className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                            diffFilterStatus === 'all'
                              ? 'bg-blue-600 text-white'
                              : 'bg-[#1b2130] text-gray-400 hover:text-white'
                          }`}
                        >
                          Все ({diffResult.summary.totalChanged})
                        </button>
                        <button
                          type="button"
                          onClick={() => setDiffFilterStatus('modified')}
                          className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                            diffFilterStatus === 'modified'
                              ? 'bg-amber-600 text-white'
                              : 'bg-[#1b2130] text-gray-400 hover:text-white'
                          }`}
                        >
                          Измененные ({diffResult.summary.modifiedCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setDiffFilterStatus('added')}
                          className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                            diffFilterStatus === 'added'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-[#1b2130] text-gray-400 hover:text-white'
                          }`}
                        >
                          Новые ({diffResult.summary.addedCount})
                        </button>
                        {diffResult.summary.deletedCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setDiffFilterStatus('deleted')}
                            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                              diffFilterStatus === 'deleted'
                                ? 'bg-rose-600 text-white'
                                : 'bg-[#1b2130] text-gray-400 hover:text-white'
                            }`}
                          >
                            Удаленные ({diffResult.summary.deletedCount})
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Если изменений нет */}
                    {diffResult.summary.totalChanged === 0 ? (
                      <div className="p-8 bg-[#141722] border border-[#242b3d] rounded-2xl text-center space-y-2">
                        <div className="text-3xl">✨</div>
                        <h4 className="text-sm font-bold text-emerald-400">
                          Все файлы полностью совпадают с GitHub!
                        </h4>
                        <p className="text-xs text-gray-400 max-w-md mx-auto">
                          Локальный код идентичен ветке <code className="text-gray-300 font-mono">{diffResult.branch}</code> репозитория <code className="text-gray-300 font-mono">{diffResult.repo}</code>. Новых правок для коммита не обнаружено.
                        </p>
                      </div>
                    ) : (
                      /* Основной блок просмотра диффа */
                      <div className="bg-[#10131a] border border-[#242b3d] rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[460px] max-h-[600px]">
                        {/* Левая колонка: список измененных файлов */}
                        <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-[#242b3d] bg-[#121620] flex flex-col min-h-0 overflow-hidden">
                          <div className="p-3 bg-[#151924] border-b border-[#242b3d] flex items-center justify-between text-xs font-bold text-gray-300">
                            <span>Файлы с отличиями</span>
                            <span className="text-[10px] text-gray-500 font-mono">
                              {diffResult.files.filter(f => diffFilterStatus === 'all' || f.status === diffFilterStatus).length} шт.
                            </span>
                          </div>

                          <div className="flex-1 overflow-y-auto divide-y divide-[#1b2233]">
                            {diffResult.files
                              .filter(f => diffFilterStatus === 'all' || f.status === diffFilterStatus)
                              .map((file) => {
                                const isSelected = selectedDiffPath === file.path;
                                let badgeBg = 'bg-amber-950/80 text-amber-300 border-amber-800';
                                let badgeText = 'M';
                                if (file.status === 'added') {
                                  badgeBg = 'bg-emerald-950/80 text-emerald-300 border-emerald-800';
                                  badgeText = 'A';
                                } else if (file.status === 'deleted') {
                                  badgeBg = 'bg-rose-950/80 text-rose-300 border-rose-800';
                                  badgeText = 'D';
                                }

                                return (
                                  <button
                                    key={file.path}
                                    type="button"
                                    onClick={() => setSelectedDiffPath(file.path)}
                                    className={`w-full text-left p-2.5 transition-colors flex items-center justify-between gap-2 text-xs font-mono ${
                                      isSelected
                                        ? 'bg-[#1e2638] text-white border-l-4 border-emerald-500'
                                        : 'text-gray-300 hover:bg-[#161c28]'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <span className={`w-5 h-5 rounded flex items-center justify-center font-bold text-[10px] border flex-shrink-0 ${badgeBg}`}>
                                        {badgeText}
                                      </span>
                                      <span className="truncate text-[11px]" title={file.path}>
                                        {file.path}
                                      </span>
                                    </div>

                                    {!file.isBinary && (file.additions > 0 || file.deletions > 0) && (
                                      <div className="flex items-center gap-1 text-[10px] flex-shrink-0">
                                        {file.additions > 0 && (
                                          <span className="text-emerald-400">+{file.additions}</span>
                                        )}
                                        {file.deletions > 0 && (
                                          <span className="text-rose-400">-{file.deletions}</span>
                                        )}
                                      </div>
                                    )}
                                  </button>
                                );
                              })}
                          </div>
                        </div>

                        {/* Правая колонка: построчный просмотр изменений выбранного файла */}
                        <div className="lg:col-span-8 flex flex-col min-h-0 bg-[#0d1017] overflow-hidden">
                          {(() => {
                            const currentFile = diffResult.files.find(f => f.path === selectedDiffPath) || diffResult.files[0];

                            if (!currentFile) {
                              return (
                                <div className="flex-1 flex items-center justify-center text-gray-500 text-xs italic p-6">
                                  Выберите файл для просмотра диффа
                                </div>
                              );
                            }

                            let statusLabel = 'Изменен (Modified)';
                            let statusColor = 'text-amber-400';
                            if (currentFile.status === 'added') {
                              statusLabel = 'Новый файл (Added)';
                              statusColor = 'text-emerald-400';
                            } else if (currentFile.status === 'deleted') {
                              statusLabel = 'Удаленный файл (Deleted)';
                              statusColor = 'text-rose-400';
                            }

                            return (
                              <>
                                {/* Шапка файла */}
                                <div className="p-3 bg-[#131722] border-b border-[#232b3d] flex flex-wrap items-center justify-between gap-2 text-xs">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="font-bold text-white font-mono truncate">
                                      {currentFile.path}
                                    </span>
                                    <span className={`text-[10px] font-bold font-sans ${statusColor}`}>
                                      ({statusLabel})
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2 font-mono text-[11px] text-gray-400">
                                    {currentFile.isBinary ? (
                                      <span className="text-gray-500 italic">Бинарный файл</span>
                                    ) : (
                                      <>
                                        <span className="text-emerald-400 font-bold">+{currentFile.additions}</span>
                                        <span className="text-rose-400 font-bold">-{currentFile.deletions}</span>
                                        <span className="text-gray-600">|</span>
                                        <span>{currentFile.lines.length} строк</span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {/* Окно с кодом */}
                                <div className="flex-1 overflow-auto font-mono text-xs p-2 leading-relaxed select-text bg-[#0a0d14]">
                                  {currentFile.isBinary ? (
                                    <div className="p-8 text-center text-gray-400 space-y-2">
                                      <div className="text-2xl">📦</div>
                                      <div className="font-bold text-white">Двоичный файл</div>
                                      <p className="text-[11px] text-gray-500 max-w-sm mx-auto">
                                        Файл бинарного формата (размер: {formatBytes(currentFile.newSize || currentFile.oldSize || 0)}). Построчный текстовый дифф недоступен, но файл будет корректно передан на GitHub при пуше.
                                      </p>
                                    </div>
                                  ) : currentFile.lines.length === 0 ? (
                                    <div className="p-6 text-center text-gray-500 text-xs italic">
                                      Файл пуст или изменения отсутствуют
                                    </div>
                                  ) : (
                                    <div className="min-w-full inline-block">
                                      {currentFile.lines.map((line, idx) => {
                                        let rowBg = 'hover:bg-[#131826] text-gray-400';
                                        let sign = ' ';
                                        let signColor = 'text-gray-600';

                                        if (line.type === 'add') {
                                          rowBg = 'bg-emerald-950/40 text-emerald-200 border-l-2 border-emerald-500';
                                          sign = '+';
                                          signColor = 'text-emerald-400 font-bold';
                                        } else if (line.type === 'delete') {
                                          rowBg = 'bg-rose-950/40 text-rose-200 border-l-2 border-rose-500';
                                          sign = '-';
                                          signColor = 'text-rose-400 font-bold';
                                        }

                                        return (
                                          <div
                                            key={idx}
                                            className={`flex items-start font-mono text-[11px] px-2 py-0.5 ${rowBg}`}
                                          >
                                            {/* Старый номер строки */}
                                            <span className="w-10 text-right text-gray-600 select-none pr-2 flex-shrink-0">
                                              {line.oldLineNumber || ''}
                                            </span>

                                            {/* Новый номер строки */}
                                            <span className="w-10 text-right text-gray-600 select-none pr-3 flex-shrink-0">
                                              {line.newLineNumber || ''}
                                            </span>

                                            {/* Знак диффа */}
                                            <span className={`w-4 select-none flex-shrink-0 ${signColor}`}>
                                              {sign}
                                            </span>

                                            {/* Текст строки */}
                                            <span className="whitespace-pre overflow-x-auto flex-1">
                                              {line.content || ' '}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    {/* 4. Блок подтверждения отправки (Push) в GitHub */}
                    {diffResult.summary.totalChanged > 0 && (
                      <div className="bg-[#141722] border border-[#242b3d] rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">📦</span>
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                              Фиксация и отправка изменений
                            </h4>
                            <p className="text-[11px] text-gray-400">
                              Будет создан коммит в ветку <code className="text-emerald-300 font-mono">{pushBranchInput}</code> репозитория <code className="text-emerald-300 font-mono">{pushRepoInput}</code>
                            </p>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-gray-300 mb-1">
                            Сообщение коммита (Commit Message):
                          </label>
                          <input
                            type="text"
                            value={pushCommitMessage}
                            onChange={(e) => setPushCommitMessage(e.target.value)}
                            placeholder={`feat: release v${diffResult.nextVersion} (build ${diffResult.nextBuild})`}
                            className="w-full bg-[#0d1017] border border-[#283248] focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none transition-colors"
                          />
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                          <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-400 hover:text-gray-300 select-none">
                            <input
                              type="checkbox"
                              checked={pushForce}
                              onChange={(e) => setPushForce(e.target.checked)}
                              className="rounded border-[#3a4763] text-emerald-600 focus:ring-0 bg-[#0d1017]"
                            />
                            <span>Форсированный пуш (Force push)</span>
                          </label>

                          <button
                            type="button"
                            onClick={() => handleExecutePush()}
                            disabled={isPushing}
                            className="px-6 py-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black transition-all shadow-xl shadow-emerald-950/60 flex items-center justify-center gap-2 active:scale-95 border border-emerald-400/80 disabled:opacity-50"
                          >
                            {isPushing ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Отправка в GitHub (создание коммита...)...</span>
                              </>
                            ) : (
                              <>
                                <span>🚀</span>
                                <span>Отправить Push в GitHub (v{diffResult.nextVersion})</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-8 bg-[#141722] border border-[#242b3d] rounded-2xl text-center space-y-3">
                    <p className="text-xs text-gray-400">
                      Нажмите «Обновить Diff» для расчета изменений проекта относительно репозитория GitHub.
                    </p>
                    <button
                      type="button"
                      onClick={() => fetchPushDiff()}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-900/30"
                    >
                      Проверить Diff правок
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ВКЛАДКА 3: ПОИСК И СКАЧИВАНИЕ ФАЙЛОВ */}
            {gitHubModalTab === 'files' && (
              <>
                {/* Блок подключения репозитория */}
                <div className="p-4 sm:p-5 bg-[#141722] border-b border-[#242b3d] space-y-3 flex-shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  connectGitHubRepo();
                }}
                className="flex flex-col md:flex-row gap-3 items-stretch md:items-center"
              >
                <div className="flex-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 16 16">
                      <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1h-8a1 1 0 00-1 1v6.708A2.486 2.486 0 014.5 9h8V1.5z"/>
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={gitHubRepoInput}
                    onChange={(e) => setGitHubRepoInput(e.target.value)}
                    placeholder="owner/repo (напр. gregpost/pcb-ai-validator или полная ссылка на GitHub)"
                    className="w-full pl-9 pr-3 py-2.5 bg-[#0e1017] border border-[#2d364b] focus:border-blue-500 rounded-xl text-sm text-white placeholder-gray-500 outline-none font-mono transition-colors"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTokenInput(!showTokenInput)}
                    className={`px-3 py-2.5 text-xs rounded-xl border transition-colors flex items-center gap-1.5 font-medium ${
                      gitHubToken.trim() || showTokenInput
                        ? 'bg-blue-950/70 border-blue-600 text-blue-300'
                        : 'bg-[#1b202e] border-[#2f384e] text-gray-400 hover:text-gray-200'
                    }`}
                    title="Указать GitHub Personal Access Token для приватных репозиториев или расширенных лимитов (5000 запр/час)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    <span>Токен {gitHubToken.trim() ? '✓' : ''}</span>
                  </button>

                  <button
                    type="submit"
                    disabled={isConnectingGitHub || !gitHubRepoInput.trim()}
                    className="px-5 py-2.5 bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-950/50 active:scale-95 flex-shrink-0"
                  >
                    {isConnectingGitHub ? (
                      <>
                        <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Подключение...
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                        Найти файлы
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Поле токена (если раскрыто) */}
              {showTokenInput && (
                <div className="p-3 bg-[#0c0e14] border border-[#262e40] rounded-xl space-y-1.5 animate-fadeIn">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-gray-300 flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21 2-2 2m-1.5 1.5L10 13l-4 4-2-2 4-4 7.5-7.5M15 5l2 2"/></svg>
                      GitHub Personal Access Token (опционально)
                    </span>
                    <a 
                      href="https://github.com/settings/tokens" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-[11px] text-blue-400 hover:underline"
                    >
                      Создать токен на github.com ↗
                    </a>
                  </div>
                  <input
                    type="password"
                    value={gitHubToken}
                    onChange={(e) => setGitHubToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx (для приватных репо или безлимитного поиска)"
                    className="w-full px-3 py-1.5 bg-[#141722] border border-[#2d364b] focus:border-blue-500 rounded-lg text-xs text-white placeholder-gray-500 outline-none font-mono"
                  />
                  <p className="text-[10px] text-gray-500">
                    Токен сохраняется локально в браузере и используется только для запросов к GitHub API.
                  </p>
                </div>
              )}

              {/* Быстрые подсказки репозиториев */}
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <span className="text-[11px] text-gray-400 font-bold mr-0.5">Пресеты:</span>
                
                {/* Основной пресет gregpost/pcb-ai-validator */}
                <button
                  type="button"
                  onClick={() => {
                    setGitHubRepoInput('gregpost/pcb-ai-validator');
                    connectGitHubRepo('gregpost/pcb-ai-validator');
                  }}
                  className="px-3 py-1 bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 hover:from-blue-800 hover:to-indigo-800 text-blue-100 hover:text-white border-2 border-blue-400/80 rounded-lg text-xs font-mono font-bold transition-all shadow-md shadow-blue-950/60 flex items-center gap-1.5 active:scale-95 ring-2 ring-blue-500/30"
                  title="Основной репозиторий проекта"
                >
                  <span className="text-amber-300 font-extrabold text-sm leading-none">★</span>
                  <span>gregpost/pcb-ai-validator</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500 text-white font-sans uppercase font-black">Основной</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setGitHubRepoInput('gregpost/pcbdoc-ai-validator');
                    connectGitHubRepo('gregpost/pcbdoc-ai-validator');
                  }}
                  className="px-2.5 py-1 bg-[#1a1f2c] hover:bg-[#252c3e] hover:text-blue-300 border border-[#2b354b] rounded-lg text-xs text-gray-300 font-mono transition-colors"
                  title="Репозиторий с даташитами и схемами плат"
                >
                  gregpost/pcbdoc-ai-validator
                </button>

                {[
                  'OLIMEX/OLINUXINO',
                  'OLIMEX/ESP32-POE',
                  'esp8266/Arduino',
                  'stm32-rs/stm32-rs'
                ].map((sampleRepo) => (
                  <button
                    key={sampleRepo}
                    type="button"
                    onClick={() => {
                      setGitHubRepoInput(sampleRepo);
                      connectGitHubRepo(sampleRepo);
                    }}
                    className="px-2 py-1 bg-[#1a1f2c] hover:bg-[#252c3e] hover:text-blue-300 border border-[#2b354b] rounded text-[11px] text-gray-400 font-mono transition-colors"
                  >
                    {sampleRepo}
                  </button>
                ))}
              </div>

              {/* Сообщения об ошибках / успехе */}
              {gitHubConnectError && (
                <div className="p-3 bg-red-950/70 border border-red-500/70 rounded-xl text-xs text-red-200 flex items-start gap-2 animate-fadeIn">
                  <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                    <line x1="12" y1="8" x2="12" y2="12" strokeWidth="2"/>
                    <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2"/>
                  </svg>
                  <div className="flex-1">
                    <p className="font-semibold text-red-300">Ошибка GitHub</p>
                    <p className="text-red-300/90 mt-0.5">{gitHubConnectError}</p>
                  </div>
                </div>
              )}

              {gitHubDownloadSuccess && (
                <div className="p-3 bg-emerald-950/70 border border-emerald-500/70 rounded-xl text-xs text-emerald-200 flex items-center justify-between gap-2 animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/>
                    </svg>
                    <span className="font-medium text-emerald-300">{gitHubDownloadSuccess}</span>
                  </div>
                  <button
                    onClick={() => setGitHubDownloadSuccess('')}
                    className="text-emerald-400 hover:text-emerald-200 text-xs px-2 py-0.5"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {/* Карточка репозитория и фильтры файлов */}
            {gitHubConnectedRepo && (
              <div className="p-3 sm:p-4 bg-[#10121a] border-b border-[#222838] flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <a
                    href={gitHubConnectedRepo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-bold text-white hover:text-blue-400 font-mono flex items-center gap-1.5 truncate group"
                  >
                    <span>{gitHubConnectedRepo.fullName}</span>
                    <svg className="w-3.5 h-3.5 text-gray-500 group-hover:text-blue-400 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  </a>

                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                    gitHubConnectedRepo.isPrivate 
                      ? 'bg-amber-950/70 text-amber-300 border-amber-800' 
                      : 'bg-emerald-950/70 text-emerald-300 border-emerald-800'
                  }`}>
                    {gitHubConnectedRepo.isPrivate ? 'Приватный' : 'Публичный'}
                  </span>

                  {gitHubConnectedRepo.stars > 0 && (
                    <span className="text-[11px] text-gray-400 flex items-center gap-1">
                      ★ {gitHubConnectedRepo.stars}
                    </span>
                  )}
                </div>

                {/* Выбор ветки */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>
                    Ветка:
                  </span>
                  <select
                    value={gitHubSelectedBranch}
                    onChange={(e) => {
                      const newBranch = e.target.value;
                      setGitHubSelectedBranch(newBranch);
                      loadGitHubTree(gitHubConnectedRepo.owner, gitHubConnectedRepo.repo, newBranch);
                    }}
                    className="bg-[#1b202e] border border-[#2f384e] text-xs text-gray-200 rounded-lg px-2.5 py-1.5 outline-none font-mono focus:border-blue-500"
                  >
                    {gitHubBranches.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>

                  <button
                    onClick={() => loadGitHubTree(gitHubConnectedRepo.owner, gitHubConnectedRepo.repo, gitHubSelectedBranch)}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-[#23293b] rounded-lg transition-colors"
                    title="Обновить список файлов ветки"
                  >
                    <svg className={`w-4 h-4 ${isLoadingTree ? 'animate-spin text-blue-400' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                  </button>
                </div>
              </div>
            )}

            {/* Панель фильтров и массовых действий */}
            {gitHubConnectedRepo && (
              <div className="p-3 sm:p-4 bg-[#141722] border-b border-[#242b3d] space-y-3 flex-shrink-0">
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                  {/* Вкладки категорий */}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: 'all', label: 'Все файлы', count: gitHubFiles.length },
                      { 
                        id: 'pcb', 
                        label: 'Платы и схемы (.PcbDoc, .PcbSch)', 
                        count: gitHubFiles.filter(f => f.category === 'pcb').length,
                        badgeColor: 'text-blue-300'
                      },
                      { 
                        id: 'pdf', 
                        label: 'PDF Даташиты', 
                        count: gitHubFiles.filter(f => f.category === 'pdf').length,
                        badgeColor: 'text-red-300'
                      },
                      { 
                        id: 'txt', 
                        label: 'Распиновка (.txt)', 
                        count: gitHubFiles.filter(f => f.category === 'txt').length,
                        badgeColor: 'text-cyan-300'
                      }
                    ].map((tab) => {
                      const isActive = gitHubCategoryFilter === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setGitHubCategoryFilter(tab.id as any)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                            isActive
                              ? 'bg-[#2563eb] text-white shadow-md'
                              : 'bg-[#1a1f2c] text-gray-400 hover:text-gray-200 border border-[#2b3447]'
                          }`}
                        >
                          <span>{tab.label}</span>
                          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                            isActive ? 'bg-blue-900 text-white' : 'bg-[#12141c] text-gray-400'
                          }`}>
                            {tab.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Поиск по названию или пути */}
                  <div className="relative w-full sm:w-64">
                    <input
                      type="text"
                      value={gitHubSearchQuery}
                      onChange={(e) => setGitHubSearchQuery(e.target.value)}
                      placeholder="Фильтр по имени или пути..."
                      className="w-full pl-8 pr-7 py-1.5 bg-[#0e1017] border border-[#2a3347] focus:border-blue-500 rounded-lg text-xs text-white placeholder-gray-500 outline-none font-mono"
                    />
                    <svg className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                    {gitHubSearchQuery && (
                      <button
                        onClick={() => setGitHubSearchQuery('')}
                        className="absolute right-2 top-2 text-gray-500 hover:text-gray-300"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Строка управления выбором */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const filtered = gitHubFiles.filter(item => {
                          if (gitHubCategoryFilter !== 'all' && item.category !== gitHubCategoryFilter) return false;
                          if (gitHubSearchQuery.trim()) {
                            const q = gitHubSearchQuery.trim().toLowerCase();
                            return item.name.toLowerCase().includes(q) || item.path.toLowerCase().includes(q);
                          }
                          return true;
                        });
                        setGitHubSelectedPaths(filtered.map(f => f.path));
                      }}
                      className="px-2.5 py-1 bg-[#1a1f2c] hover:bg-[#252c3e] border border-[#2d364b] rounded text-gray-300 hover:text-white transition-colors"
                    >
                      Выбрать все видимые
                    </button>

                    <button
                      type="button"
                      onClick={() => setGitHubSelectedPaths([])}
                      className="px-2.5 py-1 bg-[#1a1f2c] hover:bg-[#252c3e] border border-[#2d364b] rounded text-gray-300 hover:text-white transition-colors"
                    >
                      Снять выбор
                    </button>

                    <span className="text-gray-400 font-mono ml-2">
                      Выбрано: <strong className="text-blue-400">{gitHubSelectedPaths.length}</strong> файл(ов)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => downloadSelectedGitHubFiles()}
                    disabled={isDownloadingGitHub || gitHubSelectedPaths.length === 0}
                    className="px-4 py-1.5 bg-[#10b981] hover:bg-[#059669] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all flex items-center gap-2 shadow-md shadow-emerald-950/40 active:scale-95"
                  >
                    {isDownloadingGitHub ? (
                      <>
                        <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Загрузка на сервер...
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        Загрузить на сервер ({gitHubSelectedPaths.length})
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Список найденных файлов в репозитории */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1.5 font-mono text-xs">
              {isLoadingTree ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-gray-400">
                  <svg className="animate-spin w-8 h-8 text-blue-500" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-sm font-sans">Сканирование дерева файлов репозитория...</p>
                </div>
              ) : !gitHubConnectedRepo ? (
                <div className="py-20 flex flex-col items-center justify-center text-center gap-2 text-gray-500 font-sans">
                  <svg className="w-12 h-12 text-gray-600 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <h3 className="text-base font-semibold text-gray-300">Подключите GitHub репозиторий</h3>
                  <p className="text-xs text-gray-500 max-w-md">
                    Введите имя репозитория (например: <code className="text-blue-400">gregpost/pcb-ai-validator</code>) и нажмите "Найти файлы" для просмотра доступных плат, схем и документации.
                  </p>
                </div>
              ) : (
                (() => {
                  const filtered = gitHubFiles.filter(item => {
                    if (gitHubCategoryFilter !== 'all' && item.category !== gitHubCategoryFilter) return false;
                    if (gitHubSearchQuery.trim()) {
                      const q = gitHubSearchQuery.trim().toLowerCase();
                      return item.name.toLowerCase().includes(q) || item.path.toLowerCase().includes(q);
                    }
                    return true;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="py-16 text-center text-gray-500 font-sans space-y-2">
                        <p className="text-sm">Файлы не найдены по заданным критериям.</p>
                        <p className="text-xs text-gray-600">
                          Попробуйте сбросить фильтры поиска или переключить ветку.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-1">
                      {filtered.map((item) => {
                        const isSelected = gitHubSelectedPaths.includes(item.path);
                        const isAlreadyDownloaded = files.some(
                          f => f.name.toLowerCase() === item.name.toLowerCase()
                        );
                        const isSingleDownloading = downloadingSinglePath === item.path;

                        let badgeColor = 'bg-blue-950 text-blue-300 border-blue-800';
                        let badgeLabel = 'PcbDoc';
                        let targetDir = 'PcbDocs/';

                        if (item.fileType === 'pcbsch') {
                          badgeColor = 'bg-indigo-950 text-indigo-300 border-indigo-800';
                          badgeLabel = 'PcbSch';
                          targetDir = 'PcbDocs/';
                        } else if (item.fileType === 'pdf') {
                          badgeColor = 'bg-red-950 text-red-300 border-red-800';
                          badgeLabel = 'PDF';
                          targetDir = 'resources/datasheets/';
                        } else if (item.fileType === 'txt') {
                          badgeColor = 'bg-cyan-950 text-cyan-300 border-cyan-800';
                          badgeLabel = 'TXT';
                          targetDir = 'resources/pins/';
                        }

                        return (
                          <div
                            key={item.path}
                            onClick={() => {
                              setGitHubSelectedPaths(prev =>
                                prev.includes(item.path)
                                  ? prev.filter(p => p !== item.path)
                                  : [...prev, item.path]
                              );
                            }}
                            className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                              isSelected
                                ? 'bg-blue-950/30 border-blue-600/80 shadow-sm'
                                : 'bg-[#151822] border-[#222838] hover:border-[#35405a] hover:bg-[#1a1e2c]'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {/* Чекбокс */}
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  setGitHubSelectedPaths(prev =>
                                    prev.includes(item.path)
                                      ? prev.filter(p => p !== item.path)
                                      : [...prev, item.path]
                                  );
                                }}
                                className="w-4 h-4 rounded border-[#38435d] text-blue-600 focus:ring-0 bg-[#0e1017] cursor-pointer flex-shrink-0"
                              />

                              {/* Бейдж типа файла */}
                              <span className={`text-[9px] px-1.5 py-0.5 rounded border uppercase font-bold flex-shrink-0 ${badgeColor}`}>
                                {badgeLabel}
                              </span>

                              {/* Имя и путь файла */}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-gray-200 truncate text-xs" title={item.name}>
                                    {item.name}
                                  </span>
                                  {isAlreadyDownloaded && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-sans flex-shrink-0" title="Файл уже есть в локальном хранилище">
                                      На сервере ✓
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-gray-500 truncate" title={item.path}>
                                  {item.path}
                                </p>
                              </div>
                            </div>

                            {/* Место сохранения, размер и кнопка загрузки */}
                            <div className="flex items-center gap-3 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                              <div className="text-right hidden sm:block">
                                <span className="text-[10px] font-mono text-gray-400 block">
                                  {item.formattedSize}
                                </span>
                                <span className="text-[9px] text-gray-500 font-sans block" title={`Сохранится в ${targetDir}`}>
                                  → {targetDir}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => downloadSelectedGitHubFiles([item])}
                                disabled={isSingleDownloading || isDownloadingGitHub}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-sans font-semibold transition-all flex items-center gap-1.5 active:scale-95 ${
                                  isAlreadyDownloaded
                                    ? 'bg-[#222736] hover:bg-[#2d354a] text-gray-300 hover:text-white border border-[#333d54]'
                                    : 'bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-sm'
                                }`}
                                title={`Загрузить ${item.name} на сервер`}
                              >
                                {isSingleDownloading ? (
                                  <svg className="animate-spin w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                )}
                                <span>{isAlreadyDownloaded ? 'Обновить' : 'Скачать'}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>
            </>
            )}

            {/* Подвал модального окна */}
            <div className="p-3 sm:p-4 bg-[#181b24] border-t border-[#282f42] flex flex-wrap items-center justify-between gap-3 flex-shrink-0 text-xs">
              <p className="text-[11px] text-gray-400 font-sans">
                {gitHubModalTab === 'push' ? (
                  <>
                    Отправка правок через GitHub Git API. При каждом пуше автоматически повышается версия проекта в <code className="text-emerald-400 font-mono">version.json</code>, <code className="text-emerald-400 font-mono">VERSION</code> и <code className="text-emerald-400 font-mono">package.json</code>.
                  </>
                ) : gitHubModalTab === 'update' ? (
                  <>
                    Синхронизация происходит напрямую с репозиторием GitHub. Токен требуется только для приватных репо.
                  </>
                ) : (
                  <>
                    Файлы плат сохраняются в <code className="text-blue-400">PcbDocs/</code>, даташиты — в <code className="text-red-400">resources/datasheets/</code>, выводы — в <code className="text-cyan-400">resources/pins/</code>.
                  </>
                )}
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowGitHubModal(false)}
                  className="px-4 py-2 bg-[#222736] hover:bg-[#2d354a] text-gray-300 hover:text-white rounded-xl font-medium transition-colors"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

