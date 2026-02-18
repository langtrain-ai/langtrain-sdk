import { text, select, confirm, isCancel, cancel, spinner, intro, red, green, yellow, bgMagenta, black, gradient } from '../ui';
import { getConfig } from '../config';
import { Langvision, ModelClient, SubscriptionClient, FileClient, TrainingClient } from '../../index';

// Handler for Langvision Fine-tuning
export async function handleVisionFinetune(vision: Langvision, modelClient: ModelClient) {
    let model: string | symbol = '';

    const s = spinner();
    s.start('Fetching available vision models...');
    try {
        const models = await modelClient.list('vision');
        s.stop(`Found ${models.length} vision models`);

        if (models.length > 0) {
            model = await select({
                message: 'Select base vision model:',
                options: models.map(m => ({ value: m.id, label: m.id, hint: m.owned_by }))
            });
        } else {
            model = await text({
                message: 'Enter base vision model:',
                placeholder: 'llava-v1.5-7b',
                initialValue: 'llava-v1.5-7b'
            });
        }
    } catch (e) {
        s.stop(yellow('Failed to fetch models. Using manual input.'));
        model = await text({
            message: 'Enter base vision model:',
            placeholder: 'llava-v1.5-7b',
            initialValue: 'llava-v1.5-7b'
        });
    }

    if (isCancel(model)) {
        cancel('Operation cancelled');
        process.exit(0);
    }

    const dataset = await text({
        message: 'Enter dataset path:',
        placeholder: './dataset',
    });
    if (isCancel(dataset)) cancel('Operation cancelled');

    const epochs = await text({
        message: 'Num Epochs:',
        placeholder: '3',
        initialValue: '3'
    });
    if (isCancel(epochs)) cancel('Operation cancelled');

    const track = await select({
        message: 'Track this job on Langtrain Cloud?',
        options: [
            { value: 'yes', label: 'Yes', hint: 'Upload dataset and log job' },
            { value: 'no', label: 'No', hint: 'Local only' }
        ]
    });
    if (isCancel(track)) cancel('Operation cancelled');

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
            const fileResp = await fileClient.upload(dataset as string, undefined, 'fine-tune-vision');

            s.message('Creating Job...');
            const job = await trainingClient.createJob({
                name: `cli-vision-${Date.now()}`,
                base_model: model as string,
                dataset_id: fileResp.id,
                task: 'vision',
                training_method: 'lora',
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
    s2.start('Analyzing dataset structure...');
    await new Promise(r => setTimeout(r, 800));
    s2.message('Starting vision fine-tuning on Langtrain Cloud...');

    try {
        const config: any = {
            model: model as string,
            dataset: dataset as string,
            epochs: parseInt(epochs as string),
            batchSize: 1,
            learningRate: 2e-5,
            loraRank: 16,
            outputDir: './vision-output'
        };
        await vision.finetune(config);
        s2.stop(green('Vision fine-tuning started successfully!'));
    } catch (e: any) {
        s2.stop(red('Failed to start vision job.'));
        throw e;
    }
}

// Handler for Langvision Generation
export async function handleVisionGenerate(vision: Langvision) {
    const model = await text({
        message: 'Enter model path:',
        placeholder: './vision-output/model',
        initialValue: './vision-output/model'
    });
    if (isCancel(model)) cancel('Operation cancelled');

    const prompt = await text({
        message: 'Enter prompt/image path:', // Simplified for CLI
        placeholder: 'Describe this image...',
    });
    if (isCancel(prompt)) cancel('Operation cancelled');

    const s = spinner();
    s.start('Uploading image and context...');
    await new Promise(r => setTimeout(r, 600));
    s.message('Generating vision response...');

    try {
        const response = await vision.generate(model as string, { prompt: prompt as string });
        s.stop('Generation complete');
        intro('Response:');
        console.log(gradient.pastel(response));
    } catch (e: any) {
        s.stop(red('Generation failed.'));
        throw e;
    }
}
