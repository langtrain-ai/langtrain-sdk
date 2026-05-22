import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { text, confirm, isCancel, cancel, spinner, intro, showError, showSuccess, showWarning, showInfo, colors } from '../ui';
import { getConfig } from '../config';

const { green, red, yellow, cyan, bold, dim, magenta, gray } = colors;

// ── Local dataset analysis fallback ──────────────────────────────────────────
function detectTaskType(lines: string[]): string {
    const sample = lines.slice(0, 50).join('\n');
    if (sample.includes('instruction') && sample.includes('output')) return 'instruction_following';
    if (sample.includes('question') && sample.includes('answer')) return 'qa';
    if (sample.includes('```') || sample.includes('def ') || sample.includes('function ')) return 'code';
    if (sample.includes('chosen') && sample.includes('rejected')) return 'preference_alignment';
    return 'text_generation';
}

function localAnalyze(filePath: string): any {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    const taskType = detectTaskType(lines);

    let totalWords = 0;
    let validSamples = 0;
    lines.forEach(line => {
        try {
            const obj = JSON.parse(line);
            const text = JSON.stringify(obj);
            totalWords += text.split(/\s+/).length;
            validSamples++;
        } catch { /* skip malformed lines */ }
    });

    const avgWords = validSamples > 0 ? Math.round(totalWords / validSamples) : 0;
    const avgTokens = Math.round(avgWords * 1.3); // rough token estimate

    let recommendedModel = 'meta-llama/Llama-3.1-8B-Instruct';
    let trainingMethod = 'adaptive_rank';
    let loraRank = 16;

    if (taskType === 'code') {
        recommendedModel = 'deepseek-ai/DeepSeek-Coder-V2-Lite-Instruct';
        loraRank = 32;
    } else if (taskType === 'preference_alignment') {
        trainingMethod = 'dpo';
        loraRank = 16;
    } else if (validSamples > 50000) {
        recommendedModel = 'meta-llama/Llama-3.1-70B-Instruct';
        loraRank = 64;
    }

    return {
        task_type: taskType,
        domain: 'general',
        sample_count: validSamples,
        avg_tokens: avgTokens,
        recommended_model: recommendedModel,
        training_method: trainingMethod,
        recommended_lora_rank: loraRank,
        source: 'local'
    };
}

export async function handleAnalyzeDataset(filePath?: string): Promise<void> {
    const config = getConfig();
    const { apiKey, baseUrl } = config;
    const base = (baseUrl || 'https://api.langtrain.xyz').replace(/\/$/, '');

    intro('Dataset Intelligence Analysis');

    // ── Step 1: Get file path ─────────────────────────────────────────────
    let targetPath = filePath;
    if (!targetPath) {
        const pathInput = await text({
            message: 'Path to dataset file (JSONL):',
            placeholder: './data/train.jsonl',
            validate(v) {
                if (!v) return 'Path required';
                if (!fs.existsSync(v)) return `File not found: ${v}`;
            }
        });
        if (isCancel(pathInput)) { cancel('Cancelled.'); return; }
        targetPath = pathInput as string;
    }

    if (!fs.existsSync(targetPath)) {
        showError(`File not found: ${targetPath}`);
        return;
    }

    // ── Step 2: File stats ────────────────────────────────────────────────
    const stats = fs.statSync(targetPath);
    const fileSizeKB = (stats.size / 1024).toFixed(1);
    const content = fs.readFileSync(targetPath, 'utf8');
    const lineCount = content.split('\n').filter(l => l.trim()).length;

    console.log(`\n  ${dim('File:')}     ${path.basename(targetPath)}`);
    console.log(`  ${dim('Size:')}     ${fileSizeKB} KB`);
    console.log(`  ${dim('Lines:')}    ${lineCount}\n`);

    // ── Step 3: API analysis ──────────────────────────────────────────────
    let intelligence: any = null;
    const s = spinner();
    s.start('Analyzing dataset with AI intelligence engine...');

    try {
        const form = new FormData();
        form.append('file', fs.createReadStream(targetPath), path.basename(targetPath));

        const res = await axios.post(`${base}/api/v1/datasets/intelligence`, form, {
            headers: {
                ...form.getHeaders(),
                'x-api-key': apiKey || ''
            },
            timeout: 30000
        });
        intelligence = res.data;
        intelligence.source = 'api';
        s.stop(green('Analysis complete (API)'));
    } catch {
        s.stop(yellow('API unavailable — running local analysis'));
        intelligence = localAnalyze(targetPath);
    }

    // ── Step 4: Display report ────────────────────────────────────────────
    const {
        task_type, domain, sample_count, avg_tokens,
        recommended_model, training_method, recommended_lora_rank,
        health_score, suggestions, use_turboquant, source
    } = intelligence;

    const turboquantRec = use_turboquant ?? (sample_count > 10000 ? true : false);
    const healthDisplay = health_score ? `${health_score}/100` : 'N/A';

    console.log('\n  ' + bold(magenta('◆ Dataset Intelligence Report')));
    console.log(dim('  ───────────────────────────────────────────────────'));
    console.log(`  ${dim('Task Type:')}          ${cyan(task_type || 'unknown')}`);
    console.log(`  ${dim('Domain:')}             ${domain || 'general'}`);
    console.log(`  ${dim('Samples:')}            ${yellow(String(sample_count || lineCount))}`);
    console.log(`  ${dim('Avg Tokens/Sample:')}  ~${avg_tokens || 'unknown'}`);
    console.log(dim('  ───────────────────────────────────────────────────'));
    console.log(`  ${dim('Recommended Model:')}  ${green(recommended_model || 'meta-llama/Llama-3.1-8B-Instruct')}`);
    console.log(`  ${dim('Training Method:')}    ${yellow(training_method || 'adaptive_rank')}`);
    console.log(`  ${dim('LoRA Rank:')}          ${recommended_lora_rank || 16}`);
    console.log(`  ${dim('TurboQuant:')}         ${turboquantRec ? green('Recommended') : dim('Not needed')}`);
    console.log(`  ${dim('Health Score:')}       ${healthDisplay}`);

    if (suggestions && suggestions.length > 0) {
        console.log(dim('  ───────────────────────────────────────────────────'));
        console.log(`  ${bold('Suggestions:')}`);
        (suggestions as string[]).forEach(s => console.log(`  ${dim('•')} ${s}`));
    }

    console.log(dim('  ───────────────────────────────────────────────────'));
    console.log(`  ${dim('Source:')} ${source === 'api' ? green('Langtrain AI') : yellow('Local analysis')}\n`);

    // ── Step 5: Offer to start training ──────────────────────────────────
    const startTraining = await confirm({ message: 'Start training with this config?' });
    if (isCancel(startTraining) || !startTraining) {
        showInfo('Run `langtrain train` when ready to start training.');
        return;
    }

    // Lazy import to avoid circular deps
    const { handleAdaptiveTrainFlow } = await import('./train');
    const { Langtrain } = await import('../../index');
    const ai = new Langtrain({ apiKey: apiKey || '', baseUrl });
    await handleAdaptiveTrainFlow({
        train: ai.training,
        file: ai.files
    });
}
