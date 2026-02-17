#!/usr/bin/env node
import { intro, outro, select, text, spinner, isCancel, cancel, password } from '@clack/prompts';
import { bgCyan, black, red, green, yellow } from 'kleur/colors';
import { Command } from 'commander';
import { Langvision, Langtune } from './index';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Configuration
const CONFIG_DIR = path.join(os.homedir(), '.langtrain');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function getConfig() {
    if (!fs.existsSync(CONFIG_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    } catch {
        return {};
    }
}

function saveConfig(config: any) {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// Initialize clients with config
const config = getConfig();
const vision = new Langvision({ apiKey: config.apiKey });
const tune = new Langtune({ apiKey: config.apiKey });

async function main() {
    const program = new Command();

    program
        .name('langtrain')
        .description('Langtrain CLI for AI Model Fine-tuning and Generation')
        .version('0.1.7');

    program.action(async () => {
        console.clear();
        intro(`${bgCyan(black(' langtrain '))}`);

        // Check auth
        const config = getConfig();
        if (!config.apiKey) {
            intro(yellow('Authentication required'));
            const apiKey = await password({
                message: 'Enter your Langtrain API Key:',
                validate(value) {
                    if (!value || value.length === 0) return 'API Key is required';
                },
            });

            if (isCancel(apiKey)) {
                cancel('Operation cancelled');
                process.exit(0);
            }

            saveConfig({ ...config, apiKey });
            intro(green('Successfully logged in!'));
            // Re-init clients with new key
            const newConfig = getConfig();
            // vision.apiKey = newConfig.apiKey; // Ideally settable, but for now restart works or we rely on re-init logic if we moved it inside.
            // For simplicity in this script, we just proceed. The next run will pick it up, 
            // OR we can make clients mutable. 
            // Better: just re-instantiate here if needed, or pass config to handlers.
        }

        const operation = await select({
            message: 'Select an operation:',
            options: [
                { value: 'tune-finetune', label: '🧠 Fine-tune Text Model (Langtune)' },
                { value: 'tune-generate', label: '📝 Generate Text (Langtune)' },
                { value: 'vision-finetune', label: '👁️ Fine-tune Vision Model (Langvision)' },
                { value: 'vision-generate', label: '🖼️ Generate Vision Response (Langvision)' },
                { value: 'login', label: '🔑 Update API Key' },
                { value: 'exit', label: '🚪 Exit' }
            ],
        });

        if (isCancel(operation) || operation === 'exit') {
            outro('Goodbye!');
            process.exit(0);
        }

        try {
            // Re-read config in case it was just set
            const currentConfig = getConfig();
            const currentVision = new Langvision({ apiKey: currentConfig.apiKey });
            const currentTune = new Langtune({ apiKey: currentConfig.apiKey });

            if (operation === 'login') {
                await handleLogin();
            } else if (operation === 'tune-finetune') {
                await handleTuneFinetune(currentTune);
            } else if (operation === 'tune-generate') {
                await handleTuneGenerate(currentTune);
            } else if (operation === 'vision-finetune') {
                await handleVisionFinetune(currentVision);
            } else if (operation === 'vision-generate') {
                await handleVisionGenerate(currentVision);
            }
        } catch (error: any) {
            outro(red(`Error: ${error.message}`));
            process.exit(1);
        }

        outro(green('Operation completed successfully!'));
    });

    program.parse(process.argv);
}

async function handleLogin() {
    const apiKey = await password({
        message: 'Enter your new Langtrain API Key:',
        validate(value) {
            if (!value || value.length === 0) return 'API Key is required';
        },
    });

    if (isCancel(apiKey)) cancel('Operation cancelled');

    const config = getConfig();
    saveConfig({ ...config, apiKey });
    // Update global clients? No, we re-instantiated in main loop.
}


// Handler for Langtune Fine-tuning
async function handleTuneFinetune(tune: Langtune) {
    const model = await text({
        message: 'Enter base model (e.g., gpt-3.5-turbo):',
        placeholder: 'gpt-3.5-turbo',
        validate(value) {
            if (!value || value.length === 0) return 'Value is required!';
        },
    });
    if (isCancel(model)) cancel('Operation cancelled.');

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

    const s = spinner();
    s.start('Starting fine-tuning job...');

    try {
        // Check if FinetuneConfig types match what's needed. 
        // Casting to any to bypass strict type checking for this demo or ensure types are imported correctly.
        // In a real scenario, we'd construct the full config object.
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
        s.stop(green('Fine-tuning job started!'));
    } catch (e: any) {
        s.stop(red('Failed to start job.'));
        throw e;
    }
}

// Handler for Langtune Generation
async function handleTuneGenerate(tune: Langtune) {
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
    s.start('Generating response...');

    try {
        const response = await tune.generate(model as string, { prompt: prompt as string });
        s.stop('Generation complete');
        intro('Response:');
        console.log(response);
    } catch (e: any) {
        s.stop(red('Generation failed.'));
        throw e;
    }
}

// Handler for Langvision Fine-tuning
async function handleVisionFinetune(vision: Langvision) {
    const model = await text({
        message: 'Enter base vision model:',
        placeholder: 'llava-v1.5-7b',
        initialValue: 'llava-v1.5-7b'
    });
    if (isCancel(model)) cancel('Operation cancelled');

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

    const s = spinner();
    s.start('Starting vision fine-tuning...');

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
        s.stop(green('Vision fine-tuning started!'));
    } catch (e: any) {
        s.stop(red('Failed to start vision job.'));
        throw e;
    }
}

// Handler for Langvision Generation
async function handleVisionGenerate(vision: Langvision) {
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
    s.start('Generating vision response...');

    try {
        const response = await vision.generate(model as string, { prompt: prompt as string });
        s.stop('Generation complete');
        intro('Response:');
        console.log(response);
    } catch (e: any) {
        s.stop(red('Generation failed.'));
        throw e;
    }
}

main().catch(console.error);
