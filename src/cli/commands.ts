/**
 * commands.ts — Slash Command Registry
 *
 * Every /command is defined here with:
 *   - usage string (shown in /help)
 *   - description (shown in /help)
 *   - execute() — the actual implementation
 *
 * Commands are Claude Code-style: they run inline in the REPL,
 * stream output to stdout, and update session state on completion.
 */

import * as path from 'path';
import * as fs from 'fs';
import * as readline from 'readline';
import axios from 'axios';

import { colors, spinner, showError, showSuccess, showWarning, showInfo } from './ui';
import { getSession, setActiveJob, setActiveModel, setActiveDataset, addFileRef, clearChatHistory, pushChatMessage, clearActiveJob } from './session';
import { handleStreamJob } from './handlers/train';
import { handleAlignFlow } from './handlers/align';

const { green, red, yellow, cyan, bold, dim, magenta, gray } = colors;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CommandContext {
  clients: {
    training: any;
    files: any;
    models: any;
    agents: any;
    guardrails: any;
    knowledge: any;
    secrets: any;
    subscription: any;
  };
  rawInput: string;
  args: string[];            // tokenised positional args after the command name
  flags: Record<string, string | number | boolean>;  // --key value pairs
}

export interface Command {
  name: string;
  aliases?: string[];
  usage: string;
  description: string;
  examples?: string[];
  execute(ctx: CommandContext): Promise<void>;
}

// ─── Argument parser ─────────────────────────────────────────────────────────

export function parseArgs(tokens: string[]): {
  args: string[];
  flags: Record<string, string | number | boolean>;
} {
  const args: string[] = [];
  const flags: Record<string, string | number | boolean> = {};

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.startsWith('--')) {
      const key = t.slice(2);
      const next = tokens[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = isNaN(Number(next)) ? next : Number(next);
        i++;
      } else {
        flags[key] = true;
      }
    } else if (t.startsWith('@')) {
      args.push(t);
    } else {
      args.push(t);
    }
  }
  return { args, flags };
}

// ─── Helper: resolve @file or bare path to a dataset ID ──────────────────────

async function resolveDataset(
  ctx: CommandContext,
  hint?: string
): Promise<{ id: string; name: string } | null> {
  const session = getSession();

  // --file flag or @file arg
  const fileArg = hint
    || (ctx.flags.file as string)
    || ctx.args.find(a => a.startsWith('@'))?.slice(1)
    || ctx.args.find(a => /\.(jsonl|csv|parquet)$/.test(a));

  if (fileArg) {
    // Already a dataset ID
    if (/^[a-z0-9_-]{20,}$/.test(fileArg)) {
      return { id: fileArg, name: fileArg };
    }
    // Local file path — upload it
    const absPath = path.resolve(fileArg);
    if (!fs.existsSync(absPath)) {
      showError(`File not found: ${absPath}`);
      return null;
    }
    // Check session cache first
    const cached = session.fileRefs.get(absPath);
    if (cached) {
      showInfo(`Using cached upload for ${path.basename(absPath)}`);
      return { id: cached, name: path.basename(absPath) };
    }
    // Upload
    const s = spinner();
    s.start(`Uploading ${path.basename(absPath)}…`);
    try {
      const uploaded = await ctx.clients.files.upload(
        absPath,
        session.projectId || '',
        'fine-tune'
      );
      s.stop(green(`Uploaded: ${uploaded.filename || uploaded.id}`));
      addFileRef(absPath, uploaded.id);
      setActiveDataset(uploaded.id, path.basename(absPath));
      return { id: uploaded.id, name: path.basename(absPath) };
    } catch (e: any) {
      s.stop(red(`Upload failed: ${e.message}`));
      return null;
    }
  }

  // Fall back to session dataset
  if (session.activeDataset) {
    showInfo(`Using active dataset: ${session.activeDatasetName || session.activeDataset}`);
    return { id: session.activeDataset, name: session.activeDatasetName || session.activeDataset };
  }

  return null;
}

// ─── Command: /train ─────────────────────────────────────────────────────────

const cmdTrain: Command = {
  name: 'train',
  usage: '/train [--model <id>] [--file <path>] [--method <method>] [--rank <n>] [--epochs <n>]',
  description: 'Fine-tune a model. Uses dataset intelligence to pick defaults.',
  examples: [
    '/train --file data.jsonl',
    '/train --model meta-llama/Llama-3.1-8B --file train.jsonl --rank 16 --epochs 3',
    '/train @data.jsonl --method dpo',
  ],
  async execute(ctx) {
    const session = getSession();
    const { apiKey, baseUrl, projectId } = session;
    const base = (baseUrl || 'https://api.langtrain.xyz').replace(/\/$/, '');

    // ── Resolve dataset ───────────────────────────────────────────────────
    const dataset = await resolveDataset(ctx);
    if (!dataset) {
      showError('No dataset. Pass --file data.jsonl or @data.jsonl');
      return;
    }

    // ── Dataset intelligence ──────────────────────────────────────────────
    let intel: any = null;
    const s = spinner();
    s.start('Analysing dataset…');
    try {
      const res = await axios.post(
        `${base}/api/v1/datasets/${dataset.id}/intelligence`, {},
        { headers: { 'x-api-key': apiKey || '' }, timeout: 12000 }
      );
      intel = res.data;
      s.stop(green('Dataset analysed'));
    } catch {
      s.stop(dim('Intelligence unavailable — using defaults'));
    }

    const recommendedModel = intel?.recommended_model || 'meta-llama/Llama-3.1-8B-Instruct';
    const recommendedRank  = intel?.recommended_lora_rank || 16;

    if (intel) {
      console.log();
      console.log(`  ${bold('Dataset Intelligence')}`);
      console.log(`  ${dim('Task:')}     ${cyan(intel.task_type || 'unknown')}`);
      console.log(`  ${dim('Domain:')}   ${intel.domain || 'general'}`);
      console.log(`  ${dim('Samples:')}  ${yellow(String(intel.sample_count || '?'))}`);
      console.log(`  ${dim('Model:')}    ${green(recommendedModel)}`);
      console.log();
    }

    // ── Resolve hyperparameters from flags or defaults ────────────────────
    const model   = (ctx.flags.model as string) || session.activeModel || recommendedModel;
    const method  = (ctx.flags.method as string) || intel?.training_method || 'adaptive_rank';
    const rank    = Number(ctx.flags.rank)   || recommendedRank;
    const epochs  = Number(ctx.flags.epochs) || 3;
    const seqlen  = Number(ctx.flags.seqlen) || 2048;

    // ── Show plan ─────────────────────────────────────────────────────────
    console.log(`  ${bold('Training Plan')}`);
    console.log(`  ${dim('Model:')}   ${cyan(model)}`);
    console.log(`  ${dim('Method:')}  ${yellow(method)}`);
    console.log(`  ${dim('Dataset:')} ${dataset.name}  (${dataset.id.slice(-8)})`);
    console.log(`  ${dim('Rank:')}    ${rank}   ${dim('Epochs:')} ${epochs}   ${dim('SeqLen:')} ${seqlen}`);
    console.log();

    if (!ctx.flags.yes && !ctx.flags.y) {
      const { confirm, isCancel } = await import('@clack/prompts');
      const go = await confirm({ message: 'Launch training?' });
      if (!go || isCancel(go)) { console.log(dim('  Cancelled.')); return; }
    }

    // ── Submit job ────────────────────────────────────────────────────────
    const js = spinner();
    js.start('Submitting job…');
    let job: any;
    try {
      job = await ctx.clients.training.createJob({
        name: `lt-${Date.now()}`,
        base_model: model,
        dataset_id: dataset.id,
        training_method: method,
        hyperparameters: {
          n_epochs: epochs,
          lora_rank: rank,
          lora_alpha: rank * 2,
          max_seq_length: seqlen,
        },
      });
      js.stop(green(`Job started: ${bold(job.id)}`));
    } catch (e: any) {
      js.stop(red(`Failed: ${e.message}`));
      return;
    }

    setActiveJob({ id: job.id, model, status: 'running', startedAt: new Date() });
    setActiveModel(model);

    console.log();
    console.log(dim(`  Tip: /watch to stream live metrics · /status to check later`));
    console.log();

    // ── Stream progress inline ────────────────────────────────────────────
    await handleStreamJob(ctx.clients.training, job.id);

    // Update session with final model ID
    if (job.fine_tuned_model) setActiveModel(job.fine_tuned_model);
  },
};

// ─── Command: /status ────────────────────────────────────────────────────────

const cmdStatus: Command = {
  name: 'status',
  aliases: ['st'],
  usage: '/status [jobId]',
  description: 'Show training job status. Uses active job if no ID given.',
  examples: ['/status', '/status job_abc123'],
  async execute(ctx) {
    const session = getSession();
    const jobId = ctx.args[0] || (session.activeJob?.id);

    if (!jobId) {
      showWarning('No active job. Pass a job ID or use /jobs to list all.');
      return;
    }

    const s = spinner();
    s.start('Fetching status…');
    try {
      const job = await ctx.clients.training.getJob(jobId);
      s.stop('');

      const statusColor = job.status === 'completed' ? green
        : job.status === 'failed' ? red
        : job.status === 'running' ? cyan
        : yellow;

      console.log();
      console.log(`  ${bold('Job:')}     ${cyan(job.id)}`);
      console.log(`  ${bold('Status:')}  ${statusColor(job.status)}`);
      if (job.metrics?.step)       console.log(`  ${bold('Step:')}    ${job.metrics.step}/${job.metrics.total_steps || '?'}`);
      if (job.metrics?.loss)       console.log(`  ${bold('Loss:')}    ${parseFloat(job.metrics.loss).toFixed(4)}`);
      if (job.metrics?.epoch)      console.log(`  ${bold('Epoch:')}   ${job.metrics.epoch}/${job.metrics.total_epochs || '?'}`);
      if (job.fine_tuned_model)    console.log(`  ${bold('Model:')}   ${green(job.fine_tuned_model)}`);
      if (job.status === 'completed') {
        setActiveModel(job.fine_tuned_model);
        clearActiveJob();
        console.log();
        showSuccess(`Training complete! Use /chat to talk to ${job.fine_tuned_model}`);
      }
      console.log();
    } catch (e: any) {
      s.stop(red(`Error: ${e.message}`));
    }
  },
};

// ─── Command: /watch ─────────────────────────────────────────────────────────

const cmdWatch: Command = {
  name: 'watch',
  aliases: ['w'],
  usage: '/watch [jobId]',
  description: 'Stream live training metrics. Ctrl+C to detach (job keeps running).',
  examples: ['/watch', '/watch job_abc123'],
  async execute(ctx) {
    const session = getSession();
    const jobId = ctx.args[0] || session.activeJob?.id;
    if (!jobId) { showWarning('No active job — pass a job ID.'); return; }
    await handleStreamJob(ctx.clients.training, jobId);
  },
};

// ─── Command: /jobs ──────────────────────────────────────────────────────────

const cmdJobs: Command = {
  name: 'jobs',
  usage: '/jobs [--limit <n>]',
  description: 'List recent training jobs.',
  examples: ['/jobs', '/jobs --limit 20'],
  async execute(ctx) {
    const s = spinner();
    s.start('Fetching jobs…');
    try {
      const result = await ctx.clients.training.listJobs({});
      const jobs: any[] = result?.jobs || result?.data || result || [];
      s.stop(`${jobs.length} job(s)`);

      if (jobs.length === 0) { showInfo('No jobs found.'); return; }

      console.log();
      console.log(`  ${dim('ID'.padEnd(20))}  ${dim('Status'.padEnd(12))}  ${dim('Model'.padEnd(30))}  ${dim('Created')}`);
      console.log(`  ${dim('─'.repeat(80))}`);
      const limit = Number(ctx.flags.limit) || 10;
      jobs.slice(0, limit).forEach((j: any) => {
        const statusColor = j.status === 'completed' ? green
          : j.status === 'failed' ? red : cyan;
        const id    = (j.id || '').slice(-18).padEnd(20);
        const st    = statusColor((j.status || '').padEnd(12));
        const model = (j.base_model || '').slice(0, 28).padEnd(30);
        const date  = j.created_at ? new Date(j.created_at).toLocaleDateString() : '';
        console.log(`  ${cyan(id)}  ${st}  ${dim(model)}  ${dim(date)}`);
      });
      console.log();
    } catch (e: any) {
      s.stop(red(e.message));
    }
  },
};

// ─── Command: /chat ──────────────────────────────────────────────────────────

const cmdChat: Command = {
  name: 'chat',
  aliases: ['c'],
  usage: '/chat [modelId]',
  description: 'Start interactive chat with a deployed model. Type "exit" to return.',
  examples: ['/chat', '/chat ft:llama-3-abc123'],
  async execute(ctx) {
    const session = getSession();
    const modelId = (ctx.args[0] || ctx.flags.model as string || session.activeModel);

    if (!modelId) {
      // List models and let user pick
      const s = spinner();
      s.start('Loading models…');
      let models: any[] = [];
      try {
        models = await ctx.clients.models.list('text');
        s.stop(`${models.length} model(s)`);
      } catch { s.stop(red('Could not load models')); return; }

      if (models.length === 0) { showInfo('No deployed models. Train one first with /train'); return; }

      const { select, isCancel } = await import('@clack/prompts');
      const choice = await select({
        message: 'Select a model:',
        options: models.map((m: any) => ({
          value: m.id,
          label: m.id,
          hint: m.base_model || m.created_at,
        })),
      });
      if (isCancel(choice)) return;
      setActiveModel(choice as string);
      return cmdChat.execute({ ...ctx, args: [choice as string] });
    }

    setActiveModel(modelId);
    const { apiKey, baseUrl } = session;
    const base = (baseUrl || 'https://api.langtrain.xyz').replace(/\/$/, '');

    console.log();
    console.log(`  ${bold(magenta('Chat'))}  ${dim('·')}  ${cyan(modelId)}`);
    console.log(`  ${dim('Type your message. "exit" to return. "clear" to reset history.')}`);
    console.log();

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    const ask = () => new Promise<string>(resolve => {
      rl.question(`  ${magenta('you')} ${dim('›')} `, resolve);
    });

    while (true) {
      const line = (await ask()).trim();
      if (!line) continue;
      if (line.toLowerCase() === 'exit' || line.toLowerCase() === 'quit') break;
      if (line.toLowerCase() === 'clear') { clearChatHistory(); showInfo('History cleared.'); continue; }

      pushChatMessage('user', line);

      process.stdout.write(`\n  ${cyan('model')} ${dim('›')} `);
      let fullResponse = '';

      try {
        const res = await axios.post(
          `${base}/api/v1/chat`,
          {
            model: modelId,
            messages: session.chatHistory,
            stream: true,
          },
          {
            headers: { 'x-api-key': apiKey || '', 'Content-Type': 'application/json' },
            responseType: 'stream',
            timeout: 60000,
          }
        );

        await new Promise<void>((resolve, reject) => {
          res.data.on('data', (chunk: Buffer) => {
            const lines = chunk.toString().split('\n');
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6).trim();
              if (data === '[DONE]') { resolve(); return; }
              try {
                const parsed = JSON.parse(data);
                const token = parsed?.choices?.[0]?.delta?.content || '';
                if (token) { process.stdout.write(token); fullResponse += token; }
              } catch {}
            }
          });
          res.data.on('end', resolve);
          res.data.on('error', reject);
        });
      } catch {
        // Non-streaming fallback
        try {
          const res = await axios.post(
            `${base}/api/v1/chat`,
            { model: modelId, messages: session.chatHistory },
            { headers: { 'x-api-key': apiKey || '' }, timeout: 60000 }
          );
          fullResponse = res.data?.choices?.[0]?.message?.content || res.data?.response || '';
          process.stdout.write(fullResponse);
        } catch (e: any) {
          process.stdout.write(red(`Error: ${e.message}`));
        }
      }

      process.stdout.write('\n\n');
      if (fullResponse) pushChatMessage('assistant', fullResponse);
    }

    rl.close();
    console.log(dim('  Exited chat.'));
    console.log();
  },
};

// ─── Command: /models ────────────────────────────────────────────────────────

const cmdModels: Command = {
  name: 'models',
  usage: '/models',
  description: 'List your fine-tuned and available base models.',
  async execute(ctx) {
    const s = spinner();
    s.start('Loading models…');
    try {
      const models: any[] = await ctx.clients.models.list('text');
      s.stop(`${models.length} model(s)`);
      if (models.length === 0) { showInfo('No models yet. Use /train to create one.'); return; }

      console.log();
      console.log(`  ${dim('ID'.padEnd(36))}  ${dim('Base Model'.padEnd(32))}  ${dim('Created')}`);
      console.log(`  ${dim('─'.repeat(76))}`);
      models.forEach((m: any) => {
        const id      = (m.id || '').padEnd(36);
        const base    = (m.base_model || '').slice(0, 30).padEnd(32);
        const created = m.created_at ? new Date(m.created_at).toLocaleDateString() : '';
        console.log(`  ${cyan(id)}  ${dim(base)}  ${dim(created)}`);
      });
      console.log();
    } catch (e: any) {
      s.stop(red(e.message));
    }
  },
};

// ─── Command: /upload ────────────────────────────────────────────────────────

const cmdUpload: Command = {
  name: 'upload',
  aliases: ['up'],
  usage: '/upload <file>',
  description: 'Upload a dataset file (JSONL, CSV, Parquet). Caches for the session.',
  examples: ['/upload data.jsonl', '/upload ./datasets/train.jsonl'],
  async execute(ctx) {
    const filePath = ctx.args[0] || (ctx.flags.file as string);
    if (!filePath) { showError('Usage: /upload <file>'); return; }

    const absPath = path.resolve(filePath.replace(/^@/, ''));
    if (!fs.existsSync(absPath)) { showError(`File not found: ${absPath}`); return; }

    const session = getSession();
    const s = spinner();
    s.start(`Uploading ${path.basename(absPath)}…`);
    try {
      const uploaded = await ctx.clients.files.upload(absPath, session.projectId || '', 'fine-tune');
      s.stop(green(`Uploaded: ${uploaded.filename || uploaded.id}`));
      addFileRef(absPath, uploaded.id);
      setActiveDataset(uploaded.id, path.basename(absPath));
      showSuccess(`Dataset ID: ${cyan(uploaded.id)}`);
      showInfo('Tip: /analyze to inspect  ·  /train to start fine-tuning');
    } catch (e: any) {
      s.stop(red(`Upload failed: ${e.message}`));
    }
  },
};

// ─── Command: /analyze ───────────────────────────────────────────────────────

const cmdAnalyze: Command = {
  name: 'analyze',
  aliases: ['a'],
  usage: '/analyze [file | datasetId]',
  description: 'Run dataset intelligence: task type, domain, recommended model & config.',
  examples: ['/analyze data.jsonl', '/analyze @train.jsonl', '/analyze file_abc123'],
  async execute(ctx) {
    const dataset = await resolveDataset(ctx);
    if (!dataset) { showError('No dataset. Pass a file path or dataset ID.'); return; }

    const session = getSession();
    const { apiKey, baseUrl } = session;
    const base = (baseUrl || 'https://api.langtrain.xyz').replace(/\/$/, '');

    const s = spinner();
    s.start('Running dataset intelligence…');
    try {
      const res = await axios.post(
        `${base}/api/v1/datasets/${dataset.id}/intelligence`, {},
        { headers: { 'x-api-key': apiKey || '' }, timeout: 20000 }
      );
      const intel = res.data;
      s.stop(green('Analysis complete'));

      console.log();
      console.log(`  ${bold(magenta('Dataset Intelligence'))}  ${dim('·')}  ${dataset.name}`);
      console.log(`  ${dim('─'.repeat(55))}`);
      console.log(`  ${bold('Task:')}        ${cyan(intel.task_type || '?')}  ${dim(`(${Math.round((intel.task_confidence || 0) * 100)}% confidence)`)}`);
      console.log(`  ${bold('Domain:')}      ${intel.domain || 'general'}`);
      console.log(`  ${bold('Samples:')}     ${yellow(String(intel.sample_count || '?'))}`);
      console.log(`  ${bold('Avg tokens:')}  ${intel.avg_tokens || '?'}`);
      console.log(`  ${bold('Health:')}      ${intel.health_score ? `${Math.round(intel.health_score * 100)}%` : 'N/A'}`);
      console.log();
      console.log(`  ${bold('Recommended model:')}   ${green(intel.recommended_model || 'N/A')}`);
      console.log(`  ${bold('Training method:')}     ${intel.training_method || 'adaptive_rank'}`);
      console.log(`  ${bold('LoRA rank:')}           ${intel.recommended_lora_rank || 16}`);
      if (intel.use_turboquant_kv) {
        console.log(`  ${bold('TurboQuant KV:')}       ✓ ${dim(`${intel.turboquant_bits || 3}-bit ${intel.turboquant_method || 'polar+qjl'}`)}`);
      }
      if (intel.enhancement_suggestions?.length) {
        console.log();
        console.log(`  ${bold('Suggestions:')}`);
        intel.enhancement_suggestions.slice(0, 3).forEach((s: string) =>
          console.log(`   ${dim('·')} ${s}`)
        );
      }
      console.log();
      showInfo('Run /train to start fine-tuning with these settings.');
    } catch (e: any) {
      s.stop(red(`Analysis failed: ${e.message}`));
    }
  },
};

// ─── Command: /align ─────────────────────────────────────────────────────────

const cmdAlign: Command = {
  name: 'align',
  usage: '/align [--method <dpo|grpo|ppo|orpo|kto>] [--file <path>]',
  description: 'Start alignment training (DPO, GRPO, PPO, ORPO, KTO).',
  examples: ['/align --method dpo --file preferences.jsonl', '/align --method grpo'],
  async execute(ctx) {
    await handleAlignFlow({ train: ctx.clients.training });
  },
};

// ─── Command: /gpu ───────────────────────────────────────────────────────────

const cmdGpu: Command = {
  name: 'gpu',
  usage: '/gpu',
  description: 'Show available GPU types, VRAM, count, and pricing.',
  async execute(ctx) {
    const session = getSession();
    const base = (session.baseUrl || 'https://api.langtrain.xyz').replace(/\/$/, '');
    const s = spinner();
    s.start('Checking GPU availability…');
    try {
      const res = await axios.get(`${base}/api/v1/gpu/available`, {
        headers: { 'x-api-key': session.apiKey || '' }, timeout: 6000
      });
      const gpus: any[] = res.data?.gpus || res.data || [];
      s.stop(`${gpus.length} GPU type(s)`);

      if (gpus.length === 0) { showInfo('No GPUs available right now.'); return; }

      console.log();
      console.log(`  ${bold('Available GPUs')}`);
      console.log(`  ${dim('┌──────────────────────┬──────────┬───────┬──────────┐')}`);
      console.log(`  ${dim('│')} ${bold('GPU                  ')} ${dim('│')} ${bold('VRAM    ')} ${dim('│')} ${bold('Count')} ${dim('│')} ${bold('$/hr    ')} ${dim('│')}`);
      console.log(`  ${dim('├──────────────────────┼──────────┼───────┼──────────┤')}`);
      gpus.forEach((g: any) => {
        const name  = (g.name || 'Unknown').slice(0, 20).padEnd(20);
        const vram  = `${g.vram_gb || '?'}GB`.padEnd(6);
        const count = `×${g.count || 1}`.padEnd(4);
        const price = `$${(g.price_per_hour || 0).toFixed(2)}`.padEnd(6);
        console.log(`  ${dim('│')} ${cyan(name)}  ${dim('│')} ${vram}  ${dim('│')} ${count}  ${dim('│')} ${yellow(price)}  ${dim('│')}`);
      });
      console.log(`  ${dim('└──────────────────────┴──────────┴───────┴──────────┘')}`);
      console.log();
    } catch (e: any) {
      s.stop(red(e.message));
    }
  },
};

// ─── Command: /config ────────────────────────────────────────────────────────

const cmdConfig: Command = {
  name: 'config',
  usage: '/config [key] [value]',
  description: 'Show or set configuration. Keys: model, baseUrl, projectId.',
  examples: ['/config', '/config model meta-llama/Llama-3.1-8B', '/config baseUrl http://localhost:8000'],
  async execute(ctx) {
    const session = getSession();
    const [key, val] = ctx.args;

    if (!key) {
      // Show current config
      console.log();
      console.log(`  ${bold('Session Configuration')}`);
      console.log(`  ${dim('apiKey:')}     ${session.apiKey ? dim('[set]') : red('[not set]')}`);
      console.log(`  ${dim('baseUrl:')}    ${session.baseUrl}`);
      console.log(`  ${dim('projectId:')} ${session.projectId || dim('[none]')}`);
      console.log(`  ${dim('model:')}      ${session.activeModel || dim('[none]')}`);
      console.log(`  ${dim('dataset:')}    ${session.activeDatasetName || dim('[none]')}`);
      if (session.activeJob) {
        console.log(`  ${dim('activeJob:')}  ${cyan(session.activeJob.id)} ${dim(`(${session.activeJob.status})`)}`);
      }
      console.log();
      return;
    }

    if (!val) { showError(`Usage: /config ${key} <value>`); return; }

    if (key === 'model')     { setActiveModel(val);     showSuccess(`model → ${val}`); }
    else if (key === 'baseUrl')  { session.baseUrl = val;   showSuccess(`baseUrl → ${val}`); }
    else if (key === 'projectId') { session.projectId = val; showSuccess(`projectId → ${val}`); }
    else showError(`Unknown config key: ${key}. Try: model, baseUrl, projectId`);
  },
};

// ─── Command: /clear ─────────────────────────────────────────────────────────

const cmdClear: Command = {
  name: 'clear',
  usage: '/clear',
  description: 'Clear the terminal screen.',
  async execute() {
    process.stdout.write('\x1Bc');
  },
};

// ─── Command: /help ──────────────────────────────────────────────────────────

const cmdHelp: Command = {
  name: 'help',
  aliases: ['h', '?'],
  usage: '/help [command]',
  description: 'Show help. Pass a command name for detailed usage.',
  async execute(ctx) {
    const topic = ctx.args[0];
    const all   = getAllCommands();

    if (topic) {
      const cmd = all.find(c => c.name === topic || c.aliases?.includes(topic));
      if (!cmd) { showError(`Unknown command: ${topic}`); return; }
      console.log();
      console.log(`  ${bold(cyan('/' + cmd.name))}`);
      console.log(`  ${dim(cmd.description)}`);
      console.log(`  ${bold('Usage:')} ${cmd.usage}`);
      if (cmd.examples?.length) {
        console.log(`  ${bold('Examples:')}`);
        cmd.examples.forEach(e => console.log(`    ${dim(e)}`));
      }
      console.log();
      return;
    }

    console.log();
    console.log(`  ${bold('Langtrain')}  ${dim('— Fine-tune LLMs from your terminal')}`);
    console.log();
    console.log(`  ${bold('Commands')}`);
    all.forEach(cmd => {
      const aliases = cmd.aliases ? dim(` (${cmd.aliases.join(', ')})`) : '';
      console.log(`  ${cyan(('/' + cmd.name).padEnd(12))}${aliases.padEnd(12)}  ${dim(cmd.description)}`);
    });
    console.log();
    console.log(`  ${bold('Natural language')}  — Just describe what you want:`);
    console.log(`  ${dim('  "train llama-3 on my data"  ·  "analyze data.jsonl"  ·  "check job status"')}`);
    console.log();
    console.log(`  ${bold('@file references')}  — Reference local files directly:`);
    console.log(`  ${dim('  @data.jsonl  (auto-uploads and remembers for the session)')}`);
    console.log();
    console.log(`  ${dim('Ctrl+C  cancel current operation  ·  Ctrl+D  exit')}`);
    console.log();
  },
};

// ─── Command: /quit ──────────────────────────────────────────────────────────

const cmdQuit: Command = {
  name: 'quit',
  aliases: ['exit', 'q'],
  usage: '/quit',
  description: 'Exit Langtrain CLI.',
  async execute() {
    const { outro } = await import('@clack/prompts');
    outro(dim('Goodbye! 👋'));
    process.exit(0);
  },
};

// ─── Registry ────────────────────────────────────────────────────────────────

const COMMANDS: Command[] = [
  cmdTrain, cmdStatus, cmdWatch, cmdJobs,
  cmdChat, cmdModels, cmdUpload, cmdAnalyze,
  cmdAlign, cmdGpu, cmdConfig, cmdClear, cmdHelp, cmdQuit,
];

export function getAllCommands(): Command[] {
  return COMMANDS;
}

export function findCommand(name: string): Command | undefined {
  const n = name.toLowerCase().replace(/^\//, '');
  return COMMANDS.find(c => c.name === n || c.aliases?.includes(n));
}

/** Tab completion list for readline */
export function completionList(): string[] {
  return COMMANDS.flatMap(c => {
    const names = [c.name, ...(c.aliases || [])];
    return names.map(n => `/${n}`);
  });
}
