import { text, select, confirm, isCancel, cancel, spinner, intro, red, green, yellow, bgMagenta, black, gradient, gray, createTable } from '../ui';
import { getConfig } from '../config';
import { Langtune, ModelClient, SubscriptionClient, FileClient, TrainingClient } from '../../index';

// Handler for Langtune Fine-tuning
export async function handleTuneFinetune(tune: Langtune, modelClient: ModelClient) {
    let model: string | symbol = '';

    const s = spinner();
    s.start('Fetching available text models...');
    try {
        const models = await modelClient.list('text');
        s.stop(`Found ${models.length} text models`);

        if (models.length > 0) {
            model = await select({
                message: 'Select base model:',
                options: models.map(m => ({ value: m.id, label: m.id, hint: m.owned_by }))
            });
        }
    } catch (e) {
        s.stop(yellow('Failed to fetch models. Using manual input.'));
        model = await text({
            message: 'Enter base model (e.g., gpt-3.5-turbo):',
            placeholder: 'gpt-3.5-turbo',
            validate(value) {
                if (!value || value.length === 0) return 'Value is required!';
            },
        });
    }

    if (isCancel(model)) {
        cancel('Operation cancelled.');
        process.exit(0);
    }

    const trainFile = await text({
        message: 'Enter path to training file:',
        placeholder: './data.jsonl',
        validate(value) {
            if (!value || value.length === 0) return 'Value is required!';
        },
    });
    if (isCancel(trainFile)) cancel('Operation cancelled.');

    const epochs = await text({
        message: 'Num Epochs:',
        placeholder: '3',
        initialValue: '3'
    });
    if (isCancel(epochs)) cancel('Operation cancelled.');

    const track = await select({
        message: 'Track this job on Langtrain Cloud?',
        options: [
            { value: 'yes', label: 'Yes', hint: 'Upload dataset and log job' },
            { value: 'no', label: 'No', hint: 'Local only' }
        ]
    });
    if (isCancel(track)) cancel('Operation cancelled.');

    if (track === 'yes') {
        const s = spinner();
        s.start('Connecting to Cloud...');
        try {
            const config = getConfig();
            if (!config.apiKey) throw new Error('API Key required. Run "login" first.');

            // Check Subscription
            const subClient = new SubscriptionClient({ apiKey: config.apiKey });
            const sub = await subClient.getStatus();
            if (!sub.features.includes('cloud_finetuning')) {
                s.stop(red('Feature "cloud_finetuning" is not available on your plan.'));
                const upgrade = await confirm({ message: 'Upgrade to Pro for cloud tracking?' });
                if (upgrade && !isCancel(upgrade)) {
                    console.log(bgMagenta(black(' Visit https://langtrain.ai/dashboard/billing to upgrade. ')));
                }
                return;
            }

            const fileClient = new FileClient({ apiKey: config.apiKey });
            const trainingClient = new TrainingClient({ apiKey: config.apiKey });

            s.message('Uploading dataset...');
            const fileResp = await fileClient.upload(trainFile as string);

            s.message('Creating Job...');
            const job = await trainingClient.createJob({
                name: `cli-sft-${Date.now()}`,
                base_model: model as string,
                dataset_id: fileResp.id,
                task: 'text',
                hyperparameters: {
                    n_epochs: parseInt(epochs as string)
                }
            });
            s.stop(green(`Job tracked: ${job.id}`));
        } catch (e: any) {
            s.stop(red(`Tracking failed: ${e.message}`));
            const cont = await confirm({ message: 'Continue with local training anyway?' });
            if (!cont || isCancel(cont)) return;
        }
    }

    const s2 = spinner();
    s2.start('Starting local fine-tuning...');

    try {
        const config: any = {
            model: model as string,
            trainFile: trainFile as string,
            preset: 'default', // simplified
            epochs: parseInt(epochs as string),
            batchSize: 1,
            learningRate: 2e-5,
            loraRank: 16,
            outputDir: './output'
        };

        await tune.finetune(config);
        s2.stop(green('Fine-tuning job started successfully!'));
    } catch (e: any) {
        s2.stop(red('Failed to start job.'));
        throw e;
    }
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
    let workspaceId = config.workspace_id;

    if (!workspaceId) {
        s.stop(yellow('Workspace ID required to list jobs.'));
        workspaceId = await text({ message: 'Enter Workspace ID:' });
        if (isCancel(workspaceId)) return;
    }

    try {
        const jobs = await trainingClient.listJobs(workspaceId as string);
        s.stop(`Found ${jobs.data.length} jobs`);

        if (jobs.data.length === 0) {
            console.log(yellow('No jobs found.'));
            return;
        }

        // Display Table
        const table = createTable(['ID', 'Status', 'Model', 'Progress', 'Created']);
        jobs.data.forEach(j => {
            const statusColor = j.status === 'succeeded' ? green : (j.status === 'failed' ? red : yellow);
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
        console.log(`Status:    ${job.status === 'succeeded' ? green(job.status) : job.status}`);
        console.log(`Model:     ${job.base_model}`);
        console.log(`Progress:  ${job.progress || 0}%`);
        if (job.error_message) console.log(red(`Error:     ${job.error_message}`));
        console.log(gray('------------------------------------------------'));

        if (job.status === 'running' || job.status === 'queued') {
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
