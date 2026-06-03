/**
 * session.ts — Persistent REPL session state
 *
 * Maintains context across commands within a single CLI session,
 * similar to how Claude Code remembers context across turns.
 */

export interface ActiveJob {
  id: string;
  name?: string;
  model?: string;
  status: string;
  startedAt: Date;
}

export interface SessionState {
  // Auth
  apiKey?: string;
  baseUrl: string;
  projectId?: string;

  // Active context (remembered across commands)
  activeJob?: ActiveJob;
  activeModel?: string;       // last model used for /chat or /train
  activeDataset?: string;     // last uploaded/selected dataset ID
  activeDatasetName?: string; // human-readable name

  // Conversation history for /chat
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  chatModelId?: string;

  // File references loaded this session  (@file.jsonl)
  fileRefs: Map<string, string>;  // path → dataset ID

  // Display
  lastCommandAt?: Date;
  commandCount: number;
  errorCount: number;

  // Interrupt flag — set true when Ctrl+C pressed mid-operation
  interrupted: boolean;
}

let _session: SessionState | null = null;

export function initSession(config: {
  apiKey?: string;
  baseUrl?: string;
  projectId?: string;
}): SessionState {
  _session = {
    apiKey: config.apiKey,
    baseUrl: config.baseUrl || 'https://api.langtrain.xyz',
    projectId: config.projectId,
    chatHistory: [],
    fileRefs: new Map(),
    commandCount: 0,
    errorCount: 0,
    interrupted: false,
  };
  return _session;
}

export function getSession(): SessionState {
  if (!_session) throw new Error('Session not initialised — call initSession() first');
  return _session;
}

export function setActiveJob(job: ActiveJob) {
  getSession().activeJob = job;
}

export function clearActiveJob() {
  getSession().activeJob = undefined;
}

export function setActiveModel(modelId: string) {
  getSession().activeModel = modelId;
  getSession().chatModelId = modelId;
}

export function setActiveDataset(id: string, name?: string) {
  getSession().activeDataset = id;
  getSession().activeDatasetName = name || id;
}

export function addFileRef(path: string, datasetId: string) {
  getSession().fileRefs.set(path, datasetId);
}

export function getFileRef(path: string): string | undefined {
  return getSession().fileRefs.get(path);
}

export function pushChatMessage(role: 'user' | 'assistant', content: string) {
  getSession().chatHistory.push({ role, content });
  // Keep last 50 turns
  if (getSession().chatHistory.length > 100) {
    getSession().chatHistory.splice(0, 2);
  }
}

export function clearChatHistory() {
  getSession().chatHistory = [];
  getSession().chatModelId = undefined;
}

/** Compact one-line context string shown in the prompt prefix */
export function sessionContext(): string {
  const s = getSession();
  const parts: string[] = [];
  if (s.activeJob) parts.push(`job:${s.activeJob.id.slice(-6)}`);
  if (s.activeDatasetName) parts.push(`data:${s.activeDatasetName.slice(0, 12)}`);
  if (s.chatModelId && s.chatHistory.length > 0) parts.push(`chat:${s.chatModelId.slice(0, 12)}`);
  return parts.join(' · ');
}
