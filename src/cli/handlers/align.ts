import { text, select, confirm, isCancel, cancel, spinner, intro, showError, showSuccess, showWarning, colors } from '../ui';
import { getConfig } from '../config';
import { TrainingClient } from '../../index';
import { handleStreamJob } from './train';

const { green, red, yellow, cyan, bold, dim, magenta } = colors;

export async function handleAlignFlow(clients: {
    train: TrainingClient;
    [key: string]: any;
}): Promise<void> {
    const config = getConfig();

    intro('RL Alignment — Reward Learning & Preference Optimization');

    // ── Step 1: Method selection ──────────────────────────────────────────
    const method = await select({
        message: 'Alignment method:',
        options: [
            { value: 'dpo', label: 'DPO', hint: 'Direct Preference Optimization — simplest, most stable' },
            { value: 'grpo', label: 'GRPO', hint: 'Group Relative PO — DeepSeek-R1 reasoning style' },
            { value: 'ppo', label: 'PPO', hint: 'Proximal Policy Optimization — classic RLHF with reward model' },
            { value: 'orpo', label: 'ORPO / KTO', hint: 'Odds Ratio / Kahneman-Tversky — no reference model needed' },
            { value: 'constitutional', label: 'Constitutional AI', hint: 'Coming soon — Anthropic-style self-critique', }
        ]
    });
    if (isCancel(method)) { cancel('Cancelled.'); return; }

    if (method === 'constitutional') {
        showWarning('Constitutional AI is coming soon. Stay tuned!');
        return;
    }

    // ── Common fields ─────────────────────────────────────────────────────
    const baseModel = await text({
        message: 'Base / policy model ID:',
        placeholder: 'meta-llama/Llama-3.1-8B-Instruct',
        validate(v) { if (!v) return 'Required'; }
    });
    if (isCancel(baseModel)) { cancel('Cancelled.'); return; }

    let datasetId = '';
    let rewardModelId = '';
    let beta = '0.1';
    let nEpochs = '3';
    let klCoef = '0.05';

    if (['dpo', 'grpo', 'orpo', 'kto'].includes(method as string)) {
        // Preference dataset
        const datasetInput = await text({
            message: 'Preference dataset ID (chosen/rejected pairs):',
            placeholder: 'file_abc123',
            validate(v) { if (!v) return 'Required'; }
        });
        if (isCancel(datasetInput)) { cancel('Cancelled.'); return; }
        datasetId = datasetInput as string;

        const betaInput = await text({
            message: method === 'orpo' ? 'Lambda (ORPO beta-equivalent):' : 'Beta (KL penalty weight):',
            initialValue: method === 'grpo' ? '0.01' : '0.1',
            validate(v) { if (!v || isNaN(Number(v))) return 'Must be a number'; }
        });
        if (isCancel(betaInput)) { cancel('Cancelled.'); return; }
        beta = betaInput as string;

        const epochsInput = await text({
            message: 'Epochs:',
            initialValue: '3',
            validate(v) { if (!v || isNaN(Number(v))) return 'Must be a number'; }
        });
        if (isCancel(epochsInput)) { cancel('Cancelled.'); return; }
        nEpochs = epochsInput as string;
    }

    if (method === 'ppo') {
        const rewardInput = await text({
            message: 'Reward model ID:',
            placeholder: 'reward-model-deberta-v3',
            validate(v) { if (!v) return 'Required'; }
        });
        if (isCancel(rewardInput)) { cancel('Cancelled.'); return; }
        rewardModelId = rewardInput as string;

        const klInput = await text({
            message: 'KL divergence coefficient:',
            initialValue: '0.05',
            validate(v) { if (!v || isNaN(Number(v))) return 'Must be a number'; }
        });
        if (isCancel(klInput)) { cancel('Cancelled.'); return; }
        klCoef = klInput as string;

        const epochsInput = await text({
            message: 'Epochs:',
            initialValue: '3',
            validate(v) { if (!v || isNaN(Number(v))) return 'Must be a number'; }
        });
        if (isCancel(epochsInput)) { cancel('Cancelled.'); return; }
        nEpochs = epochsInput as string;
    }

    // ── Step 4: Confirm ───────────────────────────────────────────────────
    console.log('\n  ' + bold('Alignment Configuration:'));
    console.log(dim('  ──────────────────────────────────────'));
    console.log(`  ${dim('Method:')}       ${yellow((method as string).toUpperCase())}`);
    console.log(`  ${dim('Base Model:')}   ${cyan(baseModel as string)}`);
    if (datasetId) console.log(`  ${dim('Dataset ID:')}   ${datasetId}`);
    if (rewardModelId) console.log(`  ${dim('Reward Model:')} ${rewardModelId}`);
    if (method !== 'ppo') console.log(`  ${dim('Beta:')}         ${beta}`);
    if (method === 'ppo') console.log(`  ${dim('KL Coef:')}      ${klCoef}`);
    console.log(`  ${dim('Epochs:')}       ${nEpochs}`);
    console.log(dim('  ──────────────────────────────────────\n'));

    const go = await confirm({ message: 'Launch alignment job?' });
    if (!go || isCancel(go)) { cancel('Cancelled.'); return; }

    // ── Step 5: Create job ────────────────────────────────────────────────
    const s = spinner();
    s.start('Submitting alignment job...');

    const payload: any = {
        name: `align-${method}-${Date.now()}`,
        base_model: baseModel as string,
        training_method: method as any,
        hyperparameters: {
            n_epochs: parseInt(nEpochs),
            beta: parseFloat(beta)
        }
    };

    if (datasetId) payload.dataset_id = datasetId;
    if (rewardModelId) payload.reward_model_id = rewardModelId;
    if (method === 'ppo') payload.hyperparameters.kl_coef = parseFloat(klCoef);

    let job: any;
    try {
        job = await clients.train.createJob(payload);
        s.stop(green(`Alignment job created: ${job.id}`));
    } catch (e: any) {
        s.stop(red(`Failed to create job: ${e.message}`));
        return;
    }

    // ── Step 6: Stream progress ───────────────────────────────────────────
    await handleStreamJob(clients.train, job.id);
}
