import axios from 'axios';
import * as readline from 'readline';
import { text, select, confirm, isCancel, cancel, spinner, intro, showError, showSuccess, showWarning, showInfo, colors, gradient } from '../ui';
import { getConfig } from '../config';
import { TrainingClient, FileClient } from '../../index';

const { green, red, yellow, cyan, bold, dim, magenta, gray } = colors;

// ── Sparkline helper ──────────────────────────────────────────────────────────
const BLOCKS = ['█', '▇', '▆', '▅', '▄', '▃', '▂', '▁'];

function lossSparkline(losses: number[]): string {
    if (losses.length === 0) return '';
    const recent = losses.slice(-20);
    const max = Math.max(...recent);
    const min = Math.min(...recent);
    const range = max - min || 1;
    // Invert: higher loss = taller bar, lower loss = shorter bar
    return recent.map(v => {
        const norm = (v - min) / range; // 0 = low loss, 1 = high loss
        const idx = Math.round(norm * (BLOCKS.length - 1));
        return BLOCKS[idx];
    }).join('');
}

// ── Stream a running job's metrics ───────────────────────────────────────────
export async function handleStreamJob(trainingClient: TrainingClient, jobId: string): Promise<void> {
    const losses: number[] = [];
    let lastStep = 0;
    let done = false;

    console.log('\n' + bold(cyan('  Live Training Progress')) + '\n' + dim('  Press Ctrl+C to detach (job continues in cloud)\n'));

    while (!done) {
        try {
            const job = await trainingClient.getJob(jobId);
            const metrics = (job as any).metrics || {};
            const step = metrics.step || lastStep;
            const totalSteps = metrics.total_steps || (job as any).total_steps || 500;
            const loss = metrics.loss ?? null;
            const lr = metrics.learning_rate ?? metrics.lr ?? null;
            const epoch = metrics.epoch ?? null;
            const totalEpochs = metrics.total_epochs ?? (job as any).hyperparameters?.n_epochs ?? 3;
            const gpuUtil = metrics.gpu_utilization ?? null;
            const etaSec = metrics.eta_seconds ?? null;

            if (loss !== null) losses.push(parseFloat(loss));

            // ETA formatting
            let etaStr = '';
            if (etaSec !== null) {
                const mins = Math.floor(etaSec / 60);
                const secs = etaSec % 60;
                etaStr = mins > 0 ? `ETA: ${mins}m ${secs}s` : `ETA: ${secs}s`;
            }

            const lossStr = loss !== null ? `loss=${parseFloat(loss).toFixed(4)}` : '';
            const lrStr = lr !== null ? `lr=${parseFloat(lr).toExponential(1)}` : '';
            const epochStr = epoch !== null ? `epoch=${epoch}/${totalEpochs}` : '';
            const gpuStr = gpuUtil !== null ? `GPU: ${gpuUtil}%` : '';

            const parts = [
                cyan(`Step ${step}/${totalSteps}`),
                lossStr ? yellow(lossStr) : '',
                lrStr ? dim(lrStr) : '',
                epochStr ? green(epochStr) : '',
                gpuStr ? magenta(gpuStr) : '',
                etaStr ? dim(etaStr) : ''
            ].filter(Boolean).join('  ');

            // Build sparkline row
            const spark = lossSparkline(losses);
            const sparkLabel = losses.length > 0 ? dim(`  Loss trend: `) + cyan(spark) : '';

            // Clear previous 2 lines and redraw
            process.stdout.write('\x1B[2A\x1B[0J');
            process.stdout.write(`  ${parts}\n`);
            process.stdout.write(`${sparkLabel}\n`);

            lastStep = step;

            if (['completed', 'failed', 'cancelled'].includes(job.status)) {
                done = true;

                console.log('\n' + dim('  ─────────────────────────────────────────────────────'));
                if (job.status === 'completed') {
                    console.log('  ' + green('✔ Training Complete!'));
                    console.log(`  ${dim('Model ID:')}  ${cyan((job as any).fine_tuned_model || job.id)}`);
                    console.log(`  ${dim('Final Loss:')} ${losses.length > 0 ? yellow(losses[losses.length - 1].toFixed(4)) : 'N/A'}`);
                    console.log(`  ${dim('Steps:')}     ${step}`);
                } else if (job.status === 'failed') {
                    showError(`Training failed: ${(job as any).error_message || 'Unknown error'}`);
                } else {
                    showWarning('Job was cancelled.');
                }
                console.log(dim('  ─────────────────────────────────────────────────────\n'));
                break;
            }
        } catch (e: any) {
            // Network hiccup — keep polling
        }

        await new Promise(r => setTimeout(r, 2000));
    }
}

// ── Main adaptive train flow ──────────────────────────────────────────────────
export async function handleAdaptiveTrainFlow(clients: {
    train: TrainingClient;
    file: FileClient;
    [key: string]: any;
}): Promise<void> {
    const config = getConfig();
    const { apiKey, baseUrl, project_id: projectId } = config;
    const base = (baseUrl || 'https://api.langtrain.xyz').replace(/\/$/, '');

    intro('AdaptiveRank Training — Intelligent Fine-tuning');

    // ── Step 1: GPU availability ──────────────────────────────────────────
    let gpus: any[] = [];
    const s = spinner();
    s.start('Checking GPU availability...');
    try {
        const res = await axios.get(`${base}/api/v1/gpu/available`, {
            headers: { 'x-api-key': apiKey || '' },
            timeout: 5000
        });
        gpus = res.data?.gpus || res.data || [];
        s.stop(green(`${gpus.length} GPU type(s) available`));
    } catch {
        s.stop(yellow('GPU status unavailable — will use auto-selection'));
    }

    // ── Step 2: Show GPU table & let user pick ────────────────────────────
    let selectedGpu: string = 'auto';

    if (gpus.length > 0) {
        console.log('\n' + bold('  Available GPUs:'));
        console.log(dim('  ┌──────────────────────┬──────────┬───────┬──────────┐'));
        console.log(dim('  │') + bold('  GPU                 ') + dim('│') + bold('  VRAM  ') + dim('│') + bold('  ×  ') + dim('│') + bold('  $/hr  ') + dim('│'));
        console.log(dim('  ├──────────────────────┼──────────┼───────┼──────────┤'));
        gpus.forEach((g: any) => {
            const name = (g.name || 'Unknown').padEnd(20).substring(0, 20);
            const vram = `${g.vram_gb || '?'}GB`.padEnd(6);
            const count = `×${g.count || 1}`.padEnd(4);
            const price = `$${(g.price_per_hour || 0).toFixed(2)}`.padEnd(6);
            console.log(`  ${dim('│')}  ${cyan(name)}  ${dim('│')}  ${vram}  ${dim('│')}  ${count}  ${dim('│')}  ${yellow(price)}  ${dim('│')}`);
        });
        console.log(dim('  └──────────────────────┴──────────┴───────┴──────────┘\n'));

        const gpuChoice = await select({
            message: 'Select GPU (or auto):',
            options: [
                { value: 'auto', label: 'Auto (recommended)', hint: 'Langtrain picks the best available GPU' },
                ...gpus.map((g: any) => ({
                    value: g.id || g.name,
                    label: g.name || g.id,
                    hint: `${g.vram_gb}GB VRAM · ×${g.count} · $${(g.price_per_hour || 0).toFixed(2)}/hr`
                }))
            ]
        });
        if (isCancel(gpuChoice)) { cancel('Cancelled.'); return; }
        selectedGpu = gpuChoice as string;
    }

    // ── Step 3: Dataset selection ─────────────────────────────────────────
    const datasetSource = await select({
        message: 'Dataset:',
        options: [
            { value: 'upload', label: 'Upload new dataset', hint: 'JSONL file from local disk' },
            { value: 'existing', label: 'Pick existing dataset', hint: 'From your project storage' }
        ]
    });
    if (isCancel(datasetSource)) { cancel('Cancelled.'); return; }

    let datasetId = '';

    if (datasetSource === 'upload') {
        // ── Step 4: Upload ────────────────────────────────────────────────
        const filePath = await text({
            message: 'Path to JSONL file:',
            placeholder: './data/train.jsonl',
            validate(v) { if (!v) return 'Path required'; }
        });
        if (isCancel(filePath)) { cancel('Cancelled.'); return; }

        s.start('Uploading dataset...');
        try {
            const uploaded = await clients.file.upload(filePath as string, projectId || '', 'fine-tune');
            datasetId = uploaded.id;
            s.stop(green(`Uploaded: ${uploaded.filename || uploaded.id}`));
        } catch (e: any) {
            s.stop(red(`Upload failed: ${e.message}`));
            return;
        }
    } else {
        // ── Step 5: Pick existing ─────────────────────────────────────────
        s.start('Fetching datasets...');
        try {
            const files = await clients.file.list(projectId || '');
            s.stop(green(`${files.length} datasets found`));

            if (files.length === 0) {
                showWarning('No datasets found. Please upload one first.');
                return;
            }

            const fileChoice = await select({
                message: 'Select dataset:',
                options: files.map((f: any) => ({
                    value: f.id,
                    label: f.filename || f.id,
                    hint: f.bytes ? `${(f.bytes / 1024).toFixed(1)} KB` : f.purpose
                }))
            });
            if (isCancel(fileChoice)) { cancel('Cancelled.'); return; }
            datasetId = fileChoice as string;
        } catch (e: any) {
            s.stop(red(`Failed to list datasets: ${e.message}`));
            return;
        }
    }

    // ── Step 6: Auto-analyze dataset ─────────────────────────────────────
    let intelligence: any = null;
    s.start('Analyzing dataset with intelligence engine...');
    try {
        const res = await axios.post(
            `${base}/api/v1/datasets/${datasetId}/intelligence`,
            {},
            { headers: { 'x-api-key': apiKey || '' }, timeout: 15000 }
        );
        intelligence = res.data;
        s.stop(green('Analysis complete'));
    } catch {
        s.stop(yellow('Intelligence API unavailable — using defaults'));
    }

    if (intelligence) {
        const recModel = intelligence.recommended_model || 'N/A';
        const taskType = intelligence.task_type || 'unknown';
        const domain = intelligence.domain || 'general';
        const samples = intelligence.sample_count || '?';
        const loraRank = intelligence.recommended_lora_rank || 16;

        console.log('\n  ' + bold(magenta('Dataset Intelligence Report')));
        console.log(dim('  ──────────────────────────────────────'));
        console.log(`  ${dim('Task:')}        ${cyan(taskType)}`);
        console.log(`  ${dim('Domain:')}      ${domain}`);
        console.log(`  ${dim('Samples:')}     ${yellow(String(samples))}`);
        console.log(`  ${dim('Rec. Model:')}  ${green(recModel)}`);
        console.log(`  ${dim('Rec. Rank:')}   ${loraRank}`);
        console.log(dim('  ──────────────────────────────────────\n'));
    }

    // ── Step 7: Confirm or enter base model ───────────────────────────────
    const recommendedModel = intelligence?.recommended_model || 'meta-llama/Llama-3.1-8B-Instruct';
    const modelConfirm = await confirm({
        message: `Use recommended model: ${cyan(recommendedModel)}?`
    });
    if (isCancel(modelConfirm)) { cancel('Cancelled.'); return; }

    let baseModel = recommendedModel;
    if (!modelConfirm) {
        const customModel = await text({
            message: 'Enter base model ID:',
            placeholder: 'meta-llama/Llama-3.1-8B-Instruct',
            validate(v) { if (!v) return 'Required'; }
        });
        if (isCancel(customModel)) { cancel('Cancelled.'); return; }
        baseModel = customModel as string;
    }

    // ── Step 8: Training method ───────────────────────────────────────────
    const method = await select({
        message: 'Training method:',
        options: [
            { value: 'adaptive_rank', label: 'AdaptiveRank', hint: 'Auto-adjusts LoRA rank per layer (Recommended)' },
            { value: 'qlora', label: 'QLoRA', hint: 'Quantized LoRA — fits 13B+ on single GPU' },
            { value: 'dpo', label: 'DPO', hint: 'Direct Preference Optimization — alignment' },
            { value: 'grpo', label: 'GRPO', hint: 'Group Relative PO — DeepSeek-R1 style reasoning' },
            { value: 'ppo', label: 'PPO', hint: 'Proximal Policy Optimization — RLHF classic' }
        ]
    });
    if (isCancel(method)) { cancel('Cancelled.'); return; }

    // ── Step 9: Hyperparameters ───────────────────────────────────────────
    const defaultRank = intelligence?.recommended_lora_rank ?? 16;

    const loraRankInput = await text({
        message: 'LoRA rank:',
        initialValue: String(defaultRank),
        validate(v) { if (!v || isNaN(Number(v))) return 'Must be a number'; }
    });
    if (isCancel(loraRankInput)) { cancel('Cancelled.'); return; }

    const epochsInput = await text({
        message: 'Epochs:',
        initialValue: '3',
        validate(v) { if (!v || isNaN(Number(v))) return 'Must be a number'; }
    });
    if (isCancel(epochsInput)) { cancel('Cancelled.'); return; }

    const seqLenInput = await text({
        message: 'Max sequence length:',
        initialValue: '2048',
        validate(v) { if (!v || isNaN(Number(v))) return 'Must be a number'; }
    });
    if (isCancel(seqLenInput)) { cancel('Cancelled.'); return; }

    // ── Step 10: Confirm & launch ─────────────────────────────────────────
    const loraRank = parseInt(loraRankInput as string);
    const nEpochs = parseInt(epochsInput as string);
    const maxSeqLen = parseInt(seqLenInput as string);

    console.log('\n  ' + bold('Training Configuration:'));
    console.log(dim('  ──────────────────────────────────────'));
    console.log(`  ${dim('Base Model:')}   ${cyan(baseModel)}`);
    console.log(`  ${dim('Method:')}       ${yellow(method as string)}`);
    console.log(`  ${dim('Dataset ID:')}   ${datasetId}`);
    console.log(`  ${dim('LoRA Rank:')}    ${loraRank}`);
    console.log(`  ${dim('Epochs:')}       ${nEpochs}`);
    console.log(`  ${dim('Max Seq Len:')}  ${maxSeqLen}`);
    console.log(`  ${dim('GPU:')}          ${selectedGpu}`);
    console.log(dim('  ──────────────────────────────────────\n'));

    const go = await confirm({ message: 'Launch training job?' });
    if (!go || isCancel(go)) { cancel('Cancelled.'); return; }

    // ── Step 11: Create job ───────────────────────────────────────────────
    s.start('Submitting training job...');
    let job: any;
    try {
        job = await clients.train.createJob({
            name: `adaptive-${Date.now()}`,
            base_model: baseModel,
            dataset_id: datasetId,
            training_method: method as any,
            hyperparameters: {
                n_epochs: nEpochs,
                lora_rank: loraRank,
                lora_alpha: loraRank * 2,
                max_seq_length: maxSeqLen,
                ...(selectedGpu !== 'auto' ? { gpu_id: selectedGpu } : {})
            }
        });
        s.stop(green(`Job created: ${job.id}`));
    } catch (e: any) {
        s.stop(red(`Failed to create job: ${e.message}`));
        return;
    }

    // ── Step 12: Stream progress ──────────────────────────────────────────
    await handleStreamJob(clients.train, job.id);
}
