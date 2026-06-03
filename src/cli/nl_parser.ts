/**
 * nl_parser.ts — Natural Language Intent Detection
 *
 * Converts free-form terminal input into structured commands,
 * so users can type naturally instead of navigating menus.
 *
 * Examples:
 *   "train llama-3 on my_data.jsonl"       → /train --model llama-3 --file my_data.jsonl
 *   "fine-tune with rank 32 for 5 epochs"  → /train --rank 32 --epochs 5
 *   "chat with my model"                   → /chat
 *   "analyze data.jsonl"                   → /analyze data.jsonl
 *   "how is my training going"             → /status
 *   "use dpo on preferences.jsonl"         → /align --method dpo --file preferences.jsonl
 */

export interface ParsedIntent {
  command: string;
  args: Record<string, string | number | boolean>;
  raw: string;
}

// ─── Pattern tables ──────────────────────────────────────────────────────────

const TRAIN_TRIGGERS = [
  /\bfine[-_]?tun/i, /\btrain\b/, /\bfinetune\b/, /\bftune\b/,
  /\badaptive.?rank\b/i, /\bqlora\b/i, /\blora\b/i,
];

const ALIGN_TRIGGERS = [
  /\balign\b/i, /\bdpo\b/i, /\bgrpo\b/i, /\bppo\b/i,
  /\borpo\b/i, /\bkto\b/i, /\brlhf\b/i,
  /\bpreference.?(learn|optim|train)/i,
  /\breward.?model/i,
];

const CHAT_TRIGGERS = [
  /\bchat\b/i, /\btalk\s+(to|with)\b/i, /\bconverse\b/i,
  /\bask\s+(the\s+)?model\b/i, /\btest\s+(the\s+)?model\b/i,
  /\binfer(ence)?\b/i, /\bgenerat(e|ing)\b/i,
];

const STATUS_TRIGGERS = [
  /\b(job\s+)?status\b/i, /\bhow\s+is\b/i, /\bprogress\b/i,
  /\bcheck\b.*\bjob\b/i, /\bis\s+it\s+done\b/i, /\brunning\b.*\bjob\b/i,
];

const WATCH_TRIGGERS = [
  /\bwatch\b/i, /\bmonitor\b/i, /\bfollow\b.*\bjob\b/i,
  /\blive\b.*\btraining\b/i, /\bstream\b.*\bmetrics\b/i,
];

const JOBS_TRIGGERS = [
  /\blist\s+jobs\b/i, /\ball\s+jobs\b/i, /\bmy\s+jobs\b/i,
  /\btraining\s+jobs\b/i, /\bpast\s+jobs\b/i,
];

const UPLOAD_TRIGGERS = [
  /\bupload\b/i, /\bsend\b.*\bdata(set)?\b/i, /\badd\b.*\bdata(set)?\b/i,
];

const ANALYZE_TRIGGERS = [
  /\banalyz(e|is)\b/i, /\binspect\b/i, /\bexamin(e|ing)\b/i,
  /\bintelligencs?\b/i, /\bdata.?insight\b/i,
];

const GPU_TRIGGERS = [
  /\bgpu\b/i, /\bavailable\s+gpu\b/i, /\bcloud\s+gpu\b/i,
  /\bhardware\b/i, /\bwhich\s+gpu\b/i,
];

const MODELS_TRIGGERS = [
  /\blist\s+models\b/i, /\bmy\s+models\b/i, /\bavailable\s+models\b/i,
  /\bdeployed\s+models\b/i, /\bshow\s+models\b/i,
];

// ─── Extractors ──────────────────────────────────────────────────────────────

function extractModel(text: string): string | undefined {
  // Matches: "llama-3.1-8b", "meta-llama/...", "mistral-7b", etc.
  const patterns = [
    /\b(meta-llama\/[A-Za-z0-9._-]+)/i,
    /\b(mistralai\/[A-Za-z0-9._-]+)/i,
    /\b(google\/[A-Za-z0-9._-]+)/i,
    /\b(microsoft\/[A-Za-z0-9._-]+)/i,
    /\b(qwen[A-Za-z0-9._/-]*)/i,
    /\b(llama[-_.]?[23][A-Za-z0-9._-]*)/i,
    /\b(mistral[-_][A-Za-z0-9._-]*)/i,
    /\b(gemma[-_][A-Za-z0-9._-]*)/i,
    /\b(phi[-_][A-Za-z0-9._-]*)/i,
    /\b(deepseek[-_][A-Za-z0-9._-]*)/i,
    /model[:\s]+([A-Za-z0-9._/-]+)/i,
    /\busing\s+([A-Za-z0-9._/-]{4,})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1];
  }
  return undefined;
}

function extractFile(text: string): string | undefined {
  // Matches: file paths, @references, quoted strings
  const patterns = [
    /@([^\s]+)/,                          // @data.jsonl
    /on\s+([^\s]+\.jsonl)/i,             // on train.jsonl
    /from\s+([^\s]+\.jsonl)/i,           // from data.jsonl
    /file\s*[:=]?\s*([^\s]+)/i,          // file: data.jsonl
    /([./][^\s]*\.jsonl)/,               // ./data/train.jsonl
    /"([^"]+\.jsonl)"/,                  // "data.jsonl"
    /'([^']+\.jsonl)'/,                  // 'data.jsonl'
    /([A-Za-z0-9_-]+\.jsonl)/,          // bare name.jsonl
    /([A-Za-z0-9_-]+\.csv)/,            // bare name.csv
    /([A-Za-z0-9_-]+\.parquet)/,        // bare name.parquet
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1];
  }
  return undefined;
}

function extractNumber(text: string, keywords: string[]): number | undefined {
  for (const kw of keywords) {
    const p = new RegExp(`${kw}[:\\s=]+([0-9]+)`, 'i');
    const m = text.match(p);
    if (m) return parseInt(m[1]);
  }
  return undefined;
}

function extractMethod(text: string): string | undefined {
  const methods = ['dpo', 'grpo', 'ppo', 'orpo', 'kto', 'sft', 'qlora', 'lora', 'adaptive_rank'];
  for (const m of methods) {
    if (new RegExp(`\\b${m}\\b`, 'i').test(text)) return m;
  }
  return undefined;
}

function extractJobId(text: string): string | undefined {
  const m = text.match(/\b(job_[A-Za-z0-9]+|[A-Za-z0-9]{8,})\b/);
  return m?.[1];
}

// ─── Main parser ─────────────────────────────────────────────────────────────

export function parseNaturalLanguage(input: string): ParsedIntent | null {
  const t = input.trim();
  if (!t || t.startsWith('/') || t.startsWith('@')) return null;

  const args: Record<string, string | number | boolean> = {};

  // Extract common arguments regardless of command
  const model   = extractModel(t);
  const file    = extractFile(t);
  const rank    = extractNumber(t, ['rank', 'r', 'lora.?rank']);
  const epochs  = extractNumber(t, ['epoch', 'epochs', 'ep']);
  const seqlen  = extractNumber(t, ['seq.?len', 'context.?length', 'max.?seq']);
  const method  = extractMethod(t);
  const jobId   = extractJobId(t);

  if (model)   args.model   = model;
  if (file)    args.file    = file;
  if (rank)    args.rank    = rank;
  if (epochs)  args.epochs  = epochs;
  if (seqlen)  args.seqlen  = seqlen;
  if (method)  args.method  = method;
  if (jobId)   args.jobId   = jobId;

  // Detect command intent
  if (ALIGN_TRIGGERS.some(r => r.test(t))) {
    return { command: 'align', args, raw: t };
  }
  if (WATCH_TRIGGERS.some(r => r.test(t))) {
    return { command: 'watch', args, raw: t };
  }
  if (STATUS_TRIGGERS.some(r => r.test(t))) {
    return { command: 'status', args, raw: t };
  }
  if (JOBS_TRIGGERS.some(r => r.test(t))) {
    return { command: 'jobs', args, raw: t };
  }
  if (TRAIN_TRIGGERS.some(r => r.test(t))) {
    return { command: 'train', args, raw: t };
  }
  if (CHAT_TRIGGERS.some(r => r.test(t))) {
    return { command: 'chat', args, raw: t };
  }
  if (ANALYZE_TRIGGERS.some(r => r.test(t))) {
    return { command: 'analyze', args, raw: t };
  }
  if (UPLOAD_TRIGGERS.some(r => r.test(t))) {
    return { command: 'upload', args, raw: t };
  }
  if (GPU_TRIGGERS.some(r => r.test(t))) {
    return { command: 'gpu', args, raw: t };
  }
  if (MODELS_TRIGGERS.some(r => r.test(t))) {
    return { command: 'models', args, raw: t };
  }

  return null;
}

/** Format a ParsedIntent back to a display string for confirmation */
export function formatIntent(intent: ParsedIntent): string {
  const parts = [`/${intent.command}`];
  if (intent.args.file)   parts.push(`@${intent.args.file}`);
  if (intent.args.model)  parts.push(`--model ${intent.args.model}`);
  if (intent.args.method) parts.push(`--method ${intent.args.method}`);
  if (intent.args.rank)   parts.push(`--rank ${intent.args.rank}`);
  if (intent.args.epochs) parts.push(`--epochs ${intent.args.epochs}`);
  return parts.join(' ');
}
