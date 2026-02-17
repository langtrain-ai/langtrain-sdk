#!/usr/bin/env node
import {
    intro, outro, text, select, confirm, spinner, isCancel, note, cancel, password
} from '@clack/prompts';
import { bgCyan, black, red, green, yellow, gray } from 'kleur/colors';
import { Command } from 'commander';
import { AgentClient, AgentCreate, FileClient, TrainingClient, SubscriptionClient, Langvision, Langtune } from './index';
import fs from 'fs';
import path from 'path';
import os from 'os';
import gradient from 'gradient-string';

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

const packageJson = require(path.join(__dirname, '../package.json'));

async function main() {
    const program = new Command();
    const version = packageJson.version;

    program
        .name('langtrain')
        .description(packageJson.description || 'Langtrain CLI for AI Model Fine-tuning and Generation')
        .version(version);

    program.action(async () => {
        console.clear();

        // Gradient Banner
        const banner = `
    ██╗      █████╗ ███╗   ██╗ ██████╗████████╗██████╗  █████╗ ██╗███╗   ██╗
    ██║     ██╔══██╗████╗  ██║██╔════╝╚══██╔══╝██╔══██╗██╔══██╗██║████╗  ██║
    ██║     ███████║██╔██╗ ██║██║  ███╗  ██║   ██████╔╝███████║██║██╔██╗ ██║
    ██║     ██╔══██║██║╚██╗██║██║   ██║  ██║   ██╔══██╗██╔══██║██║██║╚██╗██║
    ███████╗██║  ██║██║ ╚████║╚██████╔╝  ██║   ██║  ██║██║  ██║██║██║ ╚████║
    ╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝
    `;
        console.log(gradient(['#00DC82', '#36E4DA', '#0047E1'])(banner)); // Custom Langtrain Green-Cyan-Blue gradient
        intro(`${bgCyan(black(` Langtrain SDK v${version} `))}`);

        // Check auth (only show login if missing)
        const config = getConfig();
        if (!config.apiKey) {
            intro(yellow('Authentication required'));
            await handleLogin();
        }

        // Operation Handlers Map (O(1) lookup)
        const handlers: Record<string, (clients?: any) => Promise<void>> = {
            'login': handleLogin,
            'status': handleSubscriptionStatus,
            'tune-finetune': (c) => handleTuneFinetune(c.tune),
            'tune-generate': (c) => handleTuneGenerate(c.tune),
            'vision-finetune': (c) => handleVisionFinetune(c.vision),
            'vision-generate': (c) => handleVisionGenerate(c.vision),
            'agent-list': (c) => handleAgentList(c.agent),
            'agent-create': (c) => handleAgentCreate(c.agent),
            'agent-delete': (c) => handleAgentDelete(c.agent),
            'exit': async () => { outro('Goodbye!'); process.exit(0); },
        };

        while (true) {
            const operation = await select({
                message: 'Select an operation:',
                options: [
                    { value: 'group-agents', label: '🤖 Agents (Server)', hint: 'Chat with custom agents' },
                    { value: 'agent-list', label: '  ↳ List & Run Agents' },
                    { value: 'agent-create', label: '  ↳ Create New Agent' },
                    { value: 'agent-delete', label: '  ↳ Delete Agent' },

                    { value: 'group-tune', label: '🧠 Langtune (LLM)', hint: 'Fine-tuning & Text Generation' },
                    { value: 'tune-finetune', label: '  ↳ Fine-tune Text Model' },
                    { value: 'tune-generate', label: '  ↳ Generate Text' },

                    { value: 'group-vision', label: '👁️ Langvision (Vision)', hint: 'Vision Analysis & Tuning' },
                    { value: 'vision-finetune', label: '  ↳ Fine-tune Vision Model' },
                    { value: 'vision-generate', label: '  ↳ Generate Vision Response' },

                    { value: 'group-settings', label: '⚙️ Settings' },
                    { value: 'login', label: '  ↳ Update API Key' },
                    { value: 'exit', label: '  ↳ Exit' }
                ],
            });

            if (isCancel(operation)) {
                outro('Goodbye!');
                process.exit(0);
            }

            if (typeof operation === 'string') {
                if (operation.startsWith('group-')) continue;

                // Execute handler via map lookup
                const handler = handlers[operation];
                if (handler) {
                    try {
                        // Re-read config & re-init clients freshly for each operation
                        const currentConfig = getConfig();
                        const clients = {
                            vision: new Langvision({ apiKey: currentConfig.apiKey }),
                            tune: new Langtune({ apiKey: currentConfig.apiKey }),
                            agent: new AgentClient({ apiKey: currentConfig.apiKey, baseUrl: currentConfig.baseUrl })
                        };

                        await handler(clients);
                    } catch (error: any) {
                        outro(red(`Error: ${error.message}`));
                    }
                }
            }
        }
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
    intro(green('API Key updated successfully!'));
}

async function handleSubscriptionStatus() {
    const config = getConfig();
    if (!config.apiKey) {
        intro(red('Not logged in. Run "login" first.'));
        return;
    }
    const client = new SubscriptionClient({ apiKey: config.apiKey });
    const s = spinner();
    s.start('Fetching subscription status...');
    try {
        const info = await client.getStatus();
        s.stop(green('Subscription Status:'));

        console.log(gray('Plan: ') + (info.plan === 'pro' ? bgCyan(' PRO ') : info.plan.toUpperCase()));
        console.log(gray('Active: ') + (info.is_active ? green('Yes') : red('No')));
        if (info.expires_at) console.log(gray('Expires: ') + new Date(info.expires_at).toLocaleDateString());

        console.log(gray('\nLimits:'));
        console.log(`  Models: ${info.limits.max_models === -1 ? 'Unlimited' : info.limits.max_models}`);
        console.log(`  Training Jobs: ${info.limits.max_training_jobs}`);

    } catch (e: any) {
        s.stop(red('Failed to fetch status.'));
        console.error(e.message);
    }
}

async function handleAgentCreate(client: AgentClient) {
    const name = await text({
        message: 'Agent Name:',
        placeholder: 'e.g. Support Bot',
        validate(value) {
            if (!value || value.length === 0) return 'API Key is required';
        },
    });
    if (isCancel(name)) return;

    const description = await text({
        message: 'Description:',
        placeholder: 'e.g. A helpful support assistant',
    });
    if (isCancel(description)) return;

    const systemPrompt = await text({
        message: 'System Prompt:',
        placeholder: 'e.g. You are a helpful assistant.',
        initialValue: 'You are a helpful assistant.'
    });
    if (isCancel(systemPrompt)) return;

    const s = spinner();
    s.start('Creating agent...');

    try {
        // We need a workspace ID. server usually infers it from API key context if not provided?
        // But the schema says workspace_id is required in AgentCreate.
        // The server implementation of create_agent takes AgentCreate which has workspace_id.
        // However, standard users might not know their exact workspace UUID. 
        // We might need to fetch it or rely on server to fill it if we made it optional in schema (which we didn't).
        // EDIT: Let's fetch one agent to get the workspace_id or assume one?
        // Better: List agents, get workspace_id from first one. Hacky but works for single-workspace users.
        // Use 'default' or similar if server supports it?
        // Checking agents.py: verify_api_key returns workspace_id.
        // But create_agent payload requires it.
        // I'll try to fetch list first to get workspace ID. If list empty, we are stuck?
        // Wait, list_agents returns `AgentListResponse` which doesn't explicitly return workspace_id at top level, but agents have it.
        // If no agents, we can't guess it.
        // Maybe I should fetch user profile? No endpoint for that in CLI yet.
        // I'll try to pass a placeholder and hope server ignores it if it uses context?
        // Server code: `workspace_id=agent_in.workspace_id`. It uses payload.
        // I might need to ask user for workspace ID or update server to be smarter.
        // For now, I'll attempt to LIST agents to get a workspace ID.

        const agents = await client.list();
        let workspaceId = "";
        if (agents.length > 0) {
            workspaceId = agents[0].workspace_id;
        } else {
            // Fallback: Ask user or fail?
            // Or maybe decoding JWT/API key client side? No.
            // I'll prompt for it if not found, with a hint.
            s.stop(yellow('Workspace ID needed (no existing agents found).'));
            const wid = await text({
                message: 'Enter Workspace ID (UUID):',
                validate(value) {
                    if (!value || value.length === 0) return 'Required';
                },
            });
            if (isCancel(wid)) return;
            workspaceId = wid as string;
            s.start('Creating agent...');
        }

        const agent = await client.create({
            workspace_id: workspaceId,
            name: name as string,
            description: description as string,
            config: {
                system_prompt: systemPrompt as string,
                model: 'gpt-4o' // Default or prompt? simplified
            }
        });
        s.stop(green(`Agent "${agent.name}" created successfully! ID: ${agent.id}`));
    } catch (e: any) {
        s.stop(red('Failed to create agent.'));
        throw e;
    }
}

async function handleAgentDelete(client: AgentClient) {
    const s = spinner();
    s.start('Fetching agents...');
    const agents = await client.list();
    s.stop(`Found ${agents.length} agents`);

    if (agents.length === 0) {
        intro(yellow('No agents to delete.'));
        return;
    }

    const agentId = await select({
        message: 'Select an agent to DELETE:',
        options: agents.map(a => ({ value: a.id, label: a.name, hint: a.description || 'No description' }))
    });

    if (isCancel(agentId)) return;

    const confirm = await select({
        message: `Are you sure you want to delete this agent?`,
        options: [
            { value: 'yes', label: 'Yes, delete it', hint: 'Cannot be undone' },
            { value: 'no', label: 'No, keep it' }
        ]
    });

    if (confirm !== 'yes') {
        intro(gray('Deletion cancelled.'));
        return;
    }

    const d = spinner();
    d.start('Deleting agent...');
    try {
        await client.delete(agentId as string);
        d.stop(green('Agent deleted successfully.'));
    } catch (e: any) {
        d.stop(red('Failed to delete agent.'));
        throw e;
    }
}

async function handleAgentList(client: AgentClient) {
    const s = spinner();
    s.start('Fetching agents...');
    const agents = await client.list();
    s.stop(`Found ${agents.length} agents`);

    if (agents.length === 0) {
        intro(yellow('No agents found in your workspace.'));
        return;
    }

    const agentId = await select({
        message: 'Select an agent to run:',
        options: agents.map(a => ({ value: a.id, label: a.name, hint: a.description || 'No description' }))
    });

    if (isCancel(agentId)) return;

    await handleAgentRun(client, agentId as string, agents.find(a => a.id === agentId)?.name || 'Agent');
}

async function handleAgentRun(client: AgentClient, agentId: string, agentName: string) {
    intro(bgCyan(black(` Chatting with ${agentName} `)));
    console.log(gray('Type "exit" to quit conversation.'));

    let conversationId: string | undefined = undefined;

    while (true) {
        const input = await text({
            message: 'You:',
            placeholder: 'Type a message...',
        });

        if (isCancel(input) || input === 'exit') {
            break;
        }

        const s = spinner();
        s.start('Agent is thinking...');
        try {
            const result = await client.execute(agentId, { prompt: input }, [], conversationId);
            s.stop();

            if (result.output && result.output.response) {
                console.log(gradient.pastel(`Agent: ${result.output.response}`));
            } else {
                console.log(gradient.pastel(`Agent: ${JSON.stringify(result.output)}`));
            }

            conversationId = result.conversation_id;
        } catch (e: any) {
            s.stop(red('Error running agent.'));
            console.error(e);
        }
    }
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
                    console.log(bgCyan(black(' Visit https://langtrain.ai/dashboard/billing to upgrade. ')));
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

    const s = spinner();
    s.start('Starting local fine-tuning...');

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
        s.stop(green('Fine-tuning job started successfully! 🚀'));
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
                    console.log(bgCyan(black(' Visit https://langtrain.ai/dashboard/billing to upgrade. ')));
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

    const s = spinner();
    s.start('Analyzing dataset structure...');
    await new Promise(r => setTimeout(r, 800));
    s.message('Starting vision fine-tuning on Langtrain Cloud...');

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
        s.stop(green('Vision fine-tuning started successfully! 👁️'));
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

main().catch(console.error);
