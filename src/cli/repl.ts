/**
 * repl.ts — Interactive REPL Loop
 *
 * The Claude Code-style terminal experience for Langtrain:
 *
 *   • Persistent readline loop with custom prompt (❯)
 *   • Slash commands: /train /chat /status /watch /jobs /gpu …
 *   • Natural language: "train llama on my data" → /train
 *   • @file references: @data.jsonl auto-uploads and tracks in session
 *   • Session context shown in prompt prefix: [job:abc123 · data:train]
 *   • Ctrl+C cancels current operation without exiting
 *   • Ctrl+D / /quit exits cleanly
 *   • Tab completion for all slash commands
 *   • Command history via readline (up/down arrows)
 */

import * as readline from 'readline';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

import { colors, showBanner } from './ui';
import { getSession, initSession, sessionContext } from './session';
import { findCommand, parseArgs, getAllCommands, completionList, CommandContext } from './commands';
import { parseNaturalLanguage, formatIntent } from './nl_parser';

const { green, red, yellow, cyan, bold, dim, magenta, gray } = colors;

// ─── History file ─────────────────────────────────────────────────────────────

const HISTORY_PATH = path.join(os.homedir(), '.langtrain', 'repl_history');

function loadHistory(): string[] {
  try {
    if (fs.existsSync(HISTORY_PATH)) {
      return fs.readFileSync(HISTORY_PATH, 'utf8').split('\n').filter(Boolean).slice(-500);
    }
  } catch {}
  return [];
}

function appendHistory(line: string) {
  try {
    fs.mkdirSync(path.dirname(HISTORY_PATH), { recursive: true });
    fs.appendFileSync(HISTORY_PATH, line + '\n');
  } catch {}
}

// ─── Prompt builder ──────────────────────────────────────────────────────────

function buildPrompt(): string {
  const ctx = sessionContext();
  const prefix = ctx ? dim(`[${ctx}] `) : '';
  return `${prefix}${cyan('❯')} `;
}

// ─── @file handler ───────────────────────────────────────────────────────────

async function handleFileRef(
  token: string,
  clients: CommandContext['clients']
): Promise<void> {
  const filePath = path.resolve(token.slice(1));  // strip @
  if (!fs.existsSync(filePath)) {
    console.log(`  ${red('✖')} File not found: ${filePath}`);
    return;
  }

  const session = getSession();
  const cached  = session.fileRefs.get(filePath);
  if (cached) {
    console.log(`  ${dim('✔')} Already uploaded: ${path.basename(filePath)}  ${dim('→')}  ${cached}`);
    return;
  }

  // Upload inline
  const { spinner } = await import('./ui');
  const s = spinner();
  s.start(`Uploading ${path.basename(filePath)}…`);
  try {
    const uploaded = await clients.files.upload(filePath, session.projectId || '', 'fine-tune');
    s.stop(green(`Uploaded  ${path.basename(filePath)}  →  ${uploaded.id}`));
    const { addFileRef, setActiveDataset } = await import('./session');
    addFileRef(filePath, uploaded.id);
    setActiveDataset(uploaded.id, path.basename(filePath));
    console.log(`  ${dim('Tip: /analyze to inspect  ·  /train to start fine-tuning')}`);
  } catch (e: any) {
    s.stop(red(`Upload failed: ${e.message}`));
  }
}

// ─── Dispatch a command string ────────────────────────────────────────────────

async function dispatch(
  rawInput: string,
  clients: CommandContext['clients']
): Promise<void> {
  const session = getSession();
  session.commandCount++;
  session.lastCommandAt = new Date();

  const trimmed = rawInput.trim();
  if (!trimmed) return;

  // ── @file reference (bare file upload) ──────────────────────────────────
  if (trimmed.startsWith('@') && !trimmed.includes(' ')) {
    await handleFileRef(trimmed, clients);
    return;
  }

  // ── Slash command ────────────────────────────────────────────────────────
  if (trimmed.startsWith('/')) {
    const [cmdToken, ...rest] = trimmed.slice(1).split(/\s+/);
    const cmd = findCommand(cmdToken);

    if (!cmd) {
      console.log(`  ${red('✖')} Unknown command: ${bold('/' + cmdToken)}`);
      console.log(`  ${dim('Type /help for a list of commands.')}`);
      return;
    }

    const { args, flags } = parseArgs(rest);
    const ctx: CommandContext = { clients, rawInput: trimmed, args, flags };

    try {
      await cmd.execute(ctx);
    } catch (e: any) {
      session.errorCount++;
      console.log(`  ${red('✖')} ${e.message || String(e)}`);
    }
    return;
  }

  // ── Natural language ─────────────────────────────────────────────────────
  const intent = parseNaturalLanguage(trimmed);
  if (intent) {
    const formatted = formatIntent(intent);
    console.log(`  ${dim('→')} Detected: ${cyan(formatted)}`);
    console.log();

    const cmd = findCommand(intent.command);
    if (cmd) {
      // Convert intent args → command context
      const args: string[] = [];
      const flags: Record<string, string | number | boolean> = { ...intent.args };

      // Pull @file out of args if present
      if (intent.args.file) {
        args.push(`@${intent.args.file}`);
        delete flags.file;
      }
      if (intent.args.jobId) {
        args.push(intent.args.jobId as string);
        delete flags.jobId;
      }

      const ctx: CommandContext = { clients, rawInput: trimmed, args, flags };
      try {
        await cmd.execute(ctx);
      } catch (e: any) {
        session.errorCount++;
        console.log(`  ${red('✖')} ${e.message || String(e)}`);
      }
    }
    return;
  }

  // ── Unrecognised ─────────────────────────────────────────────────────────
  console.log(`  ${dim('I didn\'t understand that. Try:')}`);
  console.log(`  ${dim('  /help')}  ${dim('for all commands')}`);
  console.log(`  ${dim('  "train llama-3 on data.jsonl"  ·  "check status"  ·  "chat with my model"')}`);
}

// ─── Startup tips ─────────────────────────────────────────────────────────────

function showWelcomeTips(hasActiveJob: boolean) {
  console.log();
  if (hasActiveJob) {
    const s = getSession();
    console.log(`  ${bold('Active job:')} ${cyan(s.activeJob!.id)}`);
    console.log(`  ${dim('/watch to stream metrics  ·  /status to check progress')}`);
  } else {
    console.log(`  ${dim('Quick start:')}`);
    console.log(`  ${cyan('/train')} ${dim('@data.jsonl  ·  fine-tune a model')}`);
    console.log(`  ${cyan('/analyze')} ${dim('@data.jsonl  ·  inspect your dataset')}`);
    console.log(`  ${cyan('/chat')} ${dim('  ·  talk to a deployed model')}`);
    console.log(`  ${cyan('/help')} ${dim('  ·  all commands')}`);
  }
  console.log();
  console.log(dim('  Ctrl+C cancel  ·  Ctrl+D exit  ·  ↑↓ history'));
  console.log();
}

// ─── Tab completion ───────────────────────────────────────────────────────────

function tabCompleter(line: string): [string[], string] {
  const completions = completionList();
  const hits = completions.filter(c => c.startsWith(line));
  return [hits.length > 0 ? hits : completions, line];
}

// ─── Main REPL entry point ────────────────────────────────────────────────────

export async function startRepl(clients: CommandContext['clients']): Promise<void> {
  const session = getSession();

  showBanner();
  showWelcomeTips(!!session.activeJob);

  const rl = readline.createInterface({
    input:     process.stdin,
    output:    process.stdout,
    completer: tabCompleter,
    terminal:  true,
    prompt:    buildPrompt(),
    historySize: 500,
  });

  // Load history
  const history = loadHistory();
  (rl as any).history = history;

  // Ctrl+C — cancel current operation, don't exit
  let _operationInProgress = false;
  rl.on('SIGINT', () => {
    if (_operationInProgress) {
      session.interrupted = true;
      console.log(`\n  ${yellow('⚠')}  ${dim('Interrupted. Job continues in the cloud.')}\n`);
      session.interrupted = false;
      rl.setPrompt(buildPrompt());
      rl.prompt();
    } else {
      console.log(`\n${dim('  (Ctrl+C again or /quit to exit)')}\n`);
      rl.setPrompt(buildPrompt());
      rl.prompt();
    }
  });

  // Ctrl+D — exit cleanly
  rl.on('close', () => {
    console.log(`\n${dim('  Goodbye! 👋')}\n`);
    process.exit(0);
  });

  rl.setPrompt(buildPrompt());
  rl.prompt();

  rl.on('line', async (rawLine: string) => {
    const line = rawLine.trim();

    if (!line) {
      rl.setPrompt(buildPrompt());
      rl.prompt();
      return;
    }

    // Save to history
    appendHistory(line);

    // Pause readline while command runs (prevents garbled output)
    rl.pause();
    _operationInProgress = true;

    try {
      console.log();
      await dispatch(line, clients);
    } finally {
      _operationInProgress = false;
      session.interrupted  = false;
      rl.setPrompt(buildPrompt());   // rebuild prompt (context may have changed)
      rl.resume();
      rl.prompt();
    }
  });
}
