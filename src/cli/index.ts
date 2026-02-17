#!/usr/bin/env node
import { Command } from 'commander';
import path from 'path';
import { bgCyan, black, red, select, isCancel, outro, intro, gray } from './ui'; // Ensure clear is exported if added, otherwise use console.clear()
import { showBanner } from './ui';
import { ensureAuth, handleLogin, getSubscription } from './auth';
import { getMenu, MenuState } from './menu';
import { getConfig } from './config';

// Handlers
import { handleSubscriptionStatus } from './handlers/subscription';
import { handleTuneFinetune, handleTuneGenerate } from './handlers/tune';
import { handleVisionFinetune, handleVisionGenerate } from './handlers/vision';
import { handleAgentCreate, handleAgentDelete, handleAgentList } from './handlers/agent';

// Clients
import { SubscriptionInfo, Langvision, Langtune, AgentClient, ModelClient } from '../index';
import packageJson from '../../package.json';

export async function main() {
    const program = new Command();
    const version = packageJson.version;

    program
        .name('langtrain')
        .description(packageJson.description || 'Langtrain CLI for AI Model Fine-tuning and Generation')
        .version(version);

    program.action(async () => {
        showBanner(version);

        // 1. Auth & Plan Check Force
        // 1. Auth & Plan Check (Lazy)
        // 0. First Run Check
        const isFirstRun = process.argv.includes('--first-run');
        if (isFirstRun) {
            // Check if interactive
            if (process.stdin.isTTY) {
                intro('Welcome to Langtrain! Let\'s get you set up.');
                await handleLogin();
                // Reload config after login
            } else {
                console.log('Langtrain installed! Run "npx langtrain login" to authenticate.');
                process.exit(0);
            }
        }

        // 1. Auth & Plan Check (Lazy)
        let config = getConfig();
        let apiKey = config.apiKey || '';
        let plan: SubscriptionInfo | null = null;

        // Try to fetch plan if key exists? 
        if (apiKey) {
            try { plan = await getSubscription(apiKey); } catch { }
        }

        // 2. Global Client Init
        let clients = {
            vision: new Langvision({ apiKey }),
            tune: new Langtune({ apiKey }),
            agent: new AgentClient({ apiKey, baseUrl: config.baseUrl }),
            model: new ModelClient({ apiKey, baseUrl: config.baseUrl })
        };

        // 3. Navigation Loop
        let currentState: MenuState = 'main';

        while (true) {
            // Clear screen for clean sub-menu navigation?
            // Maybe not full clear to keep banner, but at least separate visual blocks.
            // showBanner(version); // Re-showing banner might be too much flickering.
            // console.log(''); // simple spacer

            const operation = await select({
                message: getMessageForState(currentState),
                options: getMenu(currentState, plan, !!apiKey)
            });

            if (isCancel(operation)) {
                if (currentState === 'main') {
                    outro('Goodbye!');
                    process.exit(0);
                } else {
                    currentState = 'main';
                    continue;
                }
            }

            const op = operation as string;

            // Navigation Logic
            if (op === 'exit') {
                outro('Goodbye!');
                process.exit(0);
            }
            if (op === 'back') {
                currentState = 'main';
                continue;
            }
            if (op.startsWith('nav-')) {
                currentState = op.replace('nav-', '') as MenuState;
                continue;
            }

            // Action Logic
            try {
                switch (op) {
                    case 'login':
                        await handleLogin();
                        config = getConfig();
                        apiKey = config.apiKey || '';
                        clients = {
                            vision: new Langvision({ apiKey }),
                            tune: new Langtune({ apiKey }),
                            agent: new AgentClient({ apiKey, baseUrl: config.baseUrl }),
                            model: new ModelClient({ apiKey, baseUrl: config.baseUrl })
                        };
                        try { plan = await getSubscription(apiKey); } catch { }
                        break;
                    case 'status': await handleSubscriptionStatus(); break;
                    case 'tune-finetune': await handleTuneFinetune(clients.tune, clients.model); break;
                    case 'tune-generate': await handleTuneGenerate(clients.tune); break;
                    case 'vision-finetune': await handleVisionFinetune(clients.vision, clients.model); break;
                    case 'vision-generate': await handleVisionGenerate(clients.vision); break;
                    case 'agent-list': await handleAgentList(clients.agent); break;
                    case 'agent-create': await handleAgentCreate(clients.agent, clients.model); break;
                    case 'agent-delete': await handleAgentDelete(clients.agent); break;
                }

                // After action, where do we go? 
                // Stay in current state (sub-menu) is usually preferred.

            } catch (error: any) {
                outro(red(`Error: ${error.message}`));
            }
        }
    });

    program.parse(process.argv);
}

main().catch(console.error);

function getMessageForState(state: MenuState): string {
    switch (state) {
        case 'main': return 'Main Menu:';
        case 'agents': return 'Agents & Tools:';
        case 'text': return 'Langtune (Text Operations):';
        case 'vision': return 'Langvision (Vision Operations):';
        case 'settings': return 'Settings:';
        default: return 'Select an option:';
    }
}
