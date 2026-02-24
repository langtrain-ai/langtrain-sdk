import { text, select, confirm, isCancel, cancel, spinner, intro, red, green, yellow, bgMagenta, black, gradient, gray, createTable } from '../ui';
import { getConfig } from '../config';
import { Langtune, ModelClient, SubscriptionClient, FileClient, TrainingClient } from '../../index';

// Handler for Langtune Fine-tuning
export async function handleTuneFinetune(tune: Langtune, modelClient: ModelClient) {
    const config = getConfig();
    const isAuthenticated = !!config.apiKey;

    let targetEnv = 'local';
    if (isAuthenticated) {
        const envChoice = await select({
            message: 'Where do you want to train?',
            options: [
                { value: 'cloud', label: 'Langtrain Cloud (Recommended)', hint: 'Train on remote GPUs' },
                { value: 'local', label: 'Local Machine', hint: 'Uses local hardware via Langtune' }
            ]
        });
        if (isCancel(envChoice)) { cancel('Operation cancelled.'); return; }
        targetEnv = envChoice as string;
    }

    let model: string | symbol = '';
    const s = spinner();

    if (targetEnv === 'cloud') {
        s.start('Fetching available text models...');
        try {
            const models = await modelClient.list('text');
            s.stop(models.length > 0 ? `Found ${models.length} text models` : 'Ready to configure');

            if (models.length > 0) {
                model = await select({
                    message: 'Select base model:',
                    options: models.map(m => ({ value: m.id, label: m.id, hint: m.owned_by }))
                });
            }
        } catch (e) {
            s.stop(yellow('Wait, manual input required.'));
        }
    }

    if (!model || typeof model !== 'string') {
        model = await text({
            message: 'Enter base model (e.g., gpt-3.5-turbo):',
            placeholder: 'gpt-3.5-turbo',
            validate(value) { if (!value) return 'Required'; },
        });
    }
    if (isCancel(model)) return cancel('Operation cancelled.');

    const epochs = await text({
        message: 'Num Epochs:',
        initialValue: '3',
        validate(value) { if (!Number(value)) return 'Must be a number'; }
    });
    if (isCancel(epochs)) return cancel('Operation cancelled.');

    if (targetEnv === 'cloud') {
        // --- CLOUD FLOW ---
        const subClient = new SubscriptionClient({ apiKey: config.apiKey! });
        const sub = await subClient.getStatus();
        if (!sub.features.includes('cloud_finetuning')) {
            console.log(red('Feature "cloud_finetuning" is not available on your plan.'));
            console.log(bgMagenta(black(' Visit https://langtrain.xyz/dashboard/billing to upgrade. ')));
            return;
        }

        const fileClient = new FileClient({ apiKey: config.apiKey! });
        const trainingClient = new TrainingClient({ apiKey: config.apiKey! });
        let datasetId = '';

        s.start('Fetching datasets...');
        try {
            const files = await fileClient.list(config.project_id || '');
            s.stop();

            if (files.length > 0) {
                const fileChoice = await select({
                    message: 'Select training dataset:',
                    options: [
                        { value: 'new', label: '+ Upload new dataset' },
                        ...files.map(f => ({ value: f.id, label: f.filename, hint: formatBytes(f.bytes) }))
                    ]
                });
                if (isCancel(fileChoice)) return cancel('Operation cancelled.');
                datasetId = fileChoice as string;
            } else {
                console.log(yellow('No datasets found in cloud.'));
                datasetId = 'new';
            }
        } catch (e) {
            s.stop();
            datasetId = 'new';
        }

        if (datasetId === 'new') {
            const trainFile = await text({
                message: 'Enter path to local training file (JSONL):',
                placeholder: './data.jsonl',
                validate(value) { if (!value) return 'Required'; }
            });
            if (isCancel(trainFile)) return cancel('Operation cancelled.');

            s.start('Uploading dataset...');
            const fileResp = await fileClient.upload(trainFile as string, config.project_id || '', 'fine-tune');
            datasetId = fileResp.id;
            s.stop(green('Dataset uploaded.'));
        }

        s.start('Creating Job...');
        try {
            const job = await trainingClient.createJob({
                name: `cli-sft-${Date.now()}`,
                base_model: model as string,
                dataset_id: datasetId,
                task: 'text',
                hyperparameters: { epochs: parseInt(epochs as string) }
            });
            s.stop(green(`Job created: ${job.id}`));
            console.log(gray('Run "lt tune list" or "lt tune status" to track progress.'));
        } catch (e: any) {
            s.stop(red(`Job creation failed: ${e.message}`));
        }
    } else {
        // --- LOCAL FLOW ---
        const trainFile = await text({
            message: 'Enter path to local training file:',
            placeholder: './data.jsonl',
            validate(value) { if (!value) return 'Required'; },
        });
        if (isCancel(trainFile)) return cancel('Operation cancelled.');

        const s2 = spinner();
        s2.start('Starting local fine-tuning...');
        try {
            await tune.finetune({
                model: model as string,
                trainFile: trainFile as string,
                preset: 'default',
                epochs: parseInt(epochs as string),
                batchSize: 1,
                learningRate: 2e-5,
                loraRank: 16,
                outputDir: './output',
                useTriton: false,
                useLisa: false
            });
            s2.stop(green('Fine-tuning job started locally!'));
        } catch (e: any) {
            s2.stop(red(`Failed to start job: ${e.message}`));
        }
    }
}

function formatBytes(bytes: number, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// Handler for Langtune Generation
export async function handleTuneGenerate(tune: Langtune) {
    const model = await text({
        message: 'Enter model path:',
        placeholder: './output/model',
        initialValue: './output/model'
    });
    if (isCancel(model)) cancel('Operation cancelled');

    const prompt = await text({
        message: 'Enter prompt:',
        placeholder: 'Hello world',
    });
    if (isCancel(prompt)) cancel('Operation cancelled');

    const s = spinner();
    s.start('Connecting to Langtrain Inference API...');

    try {
        const response = await tune.generate(model as string, { prompt: prompt as string });
        s.stop('Generation complete');
        intro('Response:');
        console.log(gradient.pastel(response));
    } catch (e: any) {
        s.stop(red('Generation failed.'));
        throw e;
    }
}

export async function handleTuneList(trainingClient: TrainingClient) {
    const s = spinner();
    s.start('Fetching fine-tuning jobs...');

    const config = getConfig();
    let projectId = config.project_id;

    if (!projectId) {
        s.stop(yellow('Project ID required to list jobs.'));
        projectId = await text({ message: 'Enter Project ID:' });
        if (isCancel(projectId)) return;
    }

    try {
        const jobs = await trainingClient.listJobs(projectId as string);
        s.stop(`Found ${jobs.data.length} jobs`);

        if (jobs.data.length === 0) {
            console.log(yellow('No jobs found.'));
            return;
        }

        // Display Table
        const table = createTable(['ID', 'Status', 'Model', 'Progress', 'Created']);
        jobs.data.forEach(j => {
            const statusColor = j.status === 'completed' ? green : (j.status === 'failed' ? red : yellow);
            table.push([
                j.id.substring(0, 8) + '...',
                statusColor(j.status),
                j.base_model,
                (j.progress || 0) + '%',
                new Date(j.created_at).toLocaleDateString()
            ]);
        });
        console.log(table.toString());
        console.log('');

        const selectedJob = await select({
            message: 'Select a job to view details:',
            options: jobs.data.map(j => ({
                value: j.id,
                label: `${j.name || j.id} (${j.status})`,
                hint: `Created: ${new Date(j.created_at).toLocaleDateString()}`
            }))
        });

        if (isCancel(selectedJob)) return;

        await handleTuneStatus(trainingClient, selectedJob as string);

    } catch (e: any) {
        s.stop(red(`Failed to list jobs: ${e.message}`));
    }
}

export async function handleTuneStatus(trainingClient: TrainingClient, jobId?: string) {
    let id = jobId;
    if (!id) {
        id = await text({ message: 'Enter Job ID:' }) as string;
        if (isCancel(id)) return;
    }

    const s = spinner();
    s.start(`Fetching status for ${id}...`);

    try {
        const job = await trainingClient.getJob(id);
        s.stop(`Job Status: ${job.status.toUpperCase()}`);

        console.log(gray('------------------------------------------------'));
        console.log(`${bgMagenta(black(' Job Details '))}`);
        console.log(`ID:        ${job.id}`);
        console.log(`Name:      ${job.name}`);
        console.log(`Status:    ${job.status === 'completed' ? green(job.status) : job.status}`);
        console.log(`Model:     ${job.base_model}`);
        console.log(`Method:    ${job.training_method || 'sft'}`);
        console.log(`Progress:  ${job.progress || 0}%`);
        console.log(`Created:   ${new Date(job.created_at).toLocaleString()}`);
        if (job.started_at) console.log(`Started:   ${new Date(job.started_at).toLocaleString()}`);
        if (job.completed_at) console.log(`Completed: ${new Date(job.completed_at).toLocaleString()}`);
        if (job.error_message) console.log(red(`Error:     ${job.error_message}`));
        console.log(gray('------------------------------------------------'));

        if (job.status === 'running' || job.status === 'pending') {
            const action = await select({
                message: 'Action:',
                options: [
                    { value: 'refresh', label: 'Refresh Status' },
                    { value: 'cancel', label: 'Cancel Job' },
                    { value: 'back', label: 'Back' }
                ]
            });

            if (action === 'refresh') await handleTuneStatus(trainingClient, id);
            if (action === 'cancel') await handleTuneCancel(trainingClient, id);
        }

    } catch (e: any) {
        s.stop(red(`Failed to get job status: ${e.message}`));
    }
}

export async function handleTuneCancel(trainingClient: TrainingClient, jobId: string) {
    const confirmCancel = await confirm({ message: 'Are you sure you want to cancel this job?' });
    if (!confirmCancel || isCancel(confirmCancel)) return;

    const s = spinner();
    s.start('Canceling job...');
    try {
        await trainingClient.cancelJob(jobId);
        s.stop(green('Job canceled successfully.'));
    } catch (e: any) {
        s.stop(red(`Failed to cancel job: ${e.message}`));
    }
}
