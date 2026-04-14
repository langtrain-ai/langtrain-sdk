#!/usr/bin/env node
import { Command } from 'commander';
import { select, isCancel, outro, intro, colors, showBanner } from './ui';
import { ensureAuth, handleLogin, handleLogout, getSubscription, isAuthenticated } from './auth';
import { getMenu, MenuState } from './menu';
import { getConfig } from './config';

// Handlers
import { handleSubscriptionStatus } from './handlers/subscription';
import { handleTuneFinetune, handleTuneGenerate, handleTuneList } from './handlers/tune';
import { handleVisionFinetune, handleVisionGenerate } from './handlers/vision';
import { handleAgentCreate, handleAgentDelete, handleAgentList } from './handlers/agent';
import { handleInit } from './handlers/init';
import { handleDoctor } from './handlers/doctor';
import { handleDataUpload, handleDataRefine, handleDataList } from './handlers/data';
import { handleDeploy } from './handlers/deploy';
import { handleDev } from './handlers/dev';
import { handleGuardrailList, handleGuardrailCreate } from './handlers/guardrails';
import { handleEnvMenu } from './handlers/env';
import { handleLogs } from './handlers/logs';
import { handleTokens, handleTelemetry } from './handlers/telemetry';
import { handleKnowledgeEntities } from './handlers/knowledge';

// Clients
import { SubscriptionInfo, Langvision, Langtune, Langtrain, AgentClient, ModelClient, FileClient, TrainingClient, SecretClient, KnowledgeClient } from '../index';
import packageJson from '../../package.json';

function showStatusBar(plan: SubscriptionInfo | null) {
    const { dim, green, yellow, cyan, bold, gray } = colors;

    const planLabel = plan?.plan === 'pro'
        ? bold(green('PRO'))
        : plan?.plan === 'enterprise'
            ? bold(green('ENTERPRISE'))
            : dim('FREE');

    const tokensUsed = plan?.usage?.tokensUsedThisMonth || 0;
    const tokenLimit = plan?.usage?.tokenLimit || 10000;
    const pct = Math.round((tokensUsed / tokenLimit) * 100);
    const tokenBar = pct > 80 ? yellow(`${pct}%`) : green(`${pct}%`);

    console.log(dim('  ─────────────────────────────────────────────'));
    console.log(`  ${dim('Plan:')} ${planLabel}  ${dim('│')}  ${dim('Tokens:')} ${tokensUsed.toLocaleString()}/${tokenLimit.toLocaleString()} ${tokenBar}`);
    console.log(dim('  ─────────────────────────────────────────────\n'));
}

function buildClients(apiKey: string, baseUrl?: string) {
    const ai = new Langtrain({ apiKey, baseUrl });
    // Map to the structure expected by the rest of the CLI
    return {
        vision: ai.vision,
        tune: ai.tune,
        agent: ai.agents,
        model: ai.models,
        train: ai.training,
        secret: ai.secrets,
        knowledge: ai.knowledge,
        file: ai.files
    };
}

function getMessageForState(state: MenuState): string {
    switch (state) {
        case 'main': return 'What would you like to do?';
        case 'agents': return 'Agents:';
        case 'text': return 'Langtune (Text):';
        case 'vision': return 'Langvision (Vision):';
        case 'knowledge': return 'Cortex Intelligence:';
        case 'guard': return 'Guardrails:';
        case 'settings': return 'Settings:';
        default: return 'Select an option:';
    }
}

export async function main() {
    const program = new Command();
    const version = packageJson.version;

    program
        .name('langtrain')
        .description('Langtrain CLI — Fine-tuning, Agents, and AI Ops')
        .version(version);

    // ── Standalone commands (work without interactive mode) ─────────────
    program.command('init')
        .description('Initialize a new Langtrain project')
        .action(handleInit);

    program.command('deploy')
        .description('Deploy configuration to Langtrain Cloud')
        .action(async () => {
            const config = getConfig();
            const ai = new Langtrain({ apiKey: config.apiKey || '', baseUrl: config.baseUrl });
            await handleDeploy(ai.agents);
        });

    program.command('dev')
        .description('Start local development server')
        .action(async () => {
            const config = getConfig();
            const ai = new Langtrain({ apiKey: config.apiKey || '', baseUrl: config.baseUrl });
            await handleDev(ai.agents);
        });

    program.command('env')
        .description('Manage secrets and environment variables')
        .action(async () => {
            const config = getConfig();
            const ai = new Langtrain({ apiKey: config.apiKey || '', baseUrl: config.baseUrl });
            await handleEnvMenu(ai.secrets);
        });

    program.command('logs [agent]')
        .description('Stream logs from a deployed agent')
        .action(async (agent) => {
            const config = getConfig();
            const ai = new Langtrain({ apiKey: config.apiKey || '', baseUrl: config.baseUrl });
            await handleLogs(ai.agents, agent);
        });

    program.command('login')
        .description('Authenticate with your API key')
        .action(async () => {
            await handleLogin();
        });

    program.command('logout')
        .description('Clear stored credentials')
        .action(async () => {
            await handleLogout();
        });

    program.command('tokens')
        .description('View token usage for current period')
        .action(handleTokens);

    // ── Data commands ──────────────────────────────────────────────────
    const dataCommand = program.command('data').description('Manage datasets');

    dataCommand.command('upload [file]')
        .description('Upload a dataset')
        .action(async () => {
            const config = getConfig();
            const ai = new Langtrain({ apiKey: config.apiKey || '', baseUrl: config.baseUrl });
            await handleDataUpload(ai.files);
        });

    dataCommand.command('refine [fileId]')
        .description('Refine a dataset using guardrails')
        .action(async (fileId) => {
            const config = getConfig();
            const ai = new Langtrain({ apiKey: config.apiKey || '', baseUrl: config.baseUrl });
            await handleDataRefine(ai.files, fileId);
        });

    // ── Guardrail commands ─────────────────────────────────────────────
    const guardCommand = program.command('guardrails').description('Manage data guardrails');

    guardCommand.command('list')
        .description('List available guardrails')
        .action(async () => await handleGuardrailList(null));

    guardCommand.command('create')
        .description('Create a new guardrail')
        .action(async () => await handleGuardrailCreate(null));

    // ── Interactive mode (default action) ──────────────────────────────
    program.action(async () => {
        showBanner(version);

        // First-run check
        const isFirstRun = process.argv.includes('--first-run');
        if (isFirstRun) {
            if (process.stdin.isTTY) {
                intro('Welcome to Langtrain! Let\'s get you set up.');
                await handleLogin();
            } else {
                console.log('Langtrain installed! Run "npx langtrain login" to authenticate.');
                process.exit(0);
            }
        }

        // ── Auth-gated flow ───────────────────────────────────────────
        let config = getConfig();
        let apiKey = config.apiKey || '';
        let authed = isAuthenticated();
        let plan: SubscriptionInfo | null = null;

        // If authenticated, show status bar
        if (authed && apiKey) {
            try { plan = await getSubscription(apiKey); } catch { }
            showStatusBar(plan);
        } else {
            console.log(colors.dim('  Not logged in. Only basic options available.\n'));
        }

        let clients = authed ? buildClients(apiKey, config.baseUrl) : null;

        // ── Navigation loop ──────────────────────────────────────────
        let currentState: MenuState = 'main';

        while (true) {
            const operation = await select({
                message: getMessageForState(currentState),
                options: getMenu(currentState, plan, authed)
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

            // Navigation
            if (op === 'exit') { outro('Goodbye!'); process.exit(0); }
            if (op === 'back') { currentState = 'main'; continue; }
            if (op.startsWith('nav-')) { currentState = op.replace('nav-', '') as MenuState; continue; }

            // Actions
            try {
                switch (op) {
                    // Auth
                    case 'login':
                        await handleLogin();
                        config = getConfig();
                        apiKey = config.apiKey || '';
                        authed = isAuthenticated();
                        if (authed) {
                            try { plan = await getSubscription(apiKey); } catch { }
                            clients = buildClients(apiKey, config.baseUrl);
                            console.clear();
                            showBanner(version);
                            showStatusBar(plan);
                        }
                        break;

                    case 'logout':
                        await handleLogout();
                        apiKey = '';
                        authed = false;
                        plan = null;
                        clients = null;
                        console.clear();
                        showBanner(version);
                        console.log(colors.dim('  Logged out. Only basic options available.\n'));
                        break;

                    case 'docs':
                        console.log(colors.cyan('\n  📖 https://docs.langtrain.xyz\n'));
                        break;

                    // Status & info
                    case 'status': await handleSubscriptionStatus(); break;
                    case 'tokens': await handleTokens(); break;
                    case 'telemetry': await handleTelemetry(); break;
                    case 'doctor': await handleDoctor(); break;

                    // Project
                    case 'init': await handleInit(); break;
                    case 'deploy': if (clients) await handleDeploy(clients.agent); break;
                    case 'dev': if (clients) await handleDev(clients.agent); break;
                    case 'env': if (clients) await handleEnvMenu(clients.secret); break;
                    case 'logs': if (clients) await handleLogs(clients.agent); break;

                    // Tune
                    case 'tune-finetune': if (clients) await handleTuneFinetune(clients.tune, clients.model); break;
                    case 'tune-list': if (clients) await handleTuneList(clients.train); break;
                    case 'tune-generate': if (clients) await handleTuneGenerate(clients.tune); break;

                    // Vision
                    case 'vision-finetune': if (clients) await handleVisionFinetune(clients.vision, clients.model); break;
                    case 'vision-generate': if (clients) await handleVisionGenerate(clients.vision); break;

                    // Agents
                    case 'agent-list': if (clients) await handleAgentList(clients.agent); break;
                    case 'agent-create': if (clients) await handleAgentCreate(clients.agent, clients.model); break;
                    case 'agent-delete': if (clients) await handleAgentDelete(clients.agent); break;

                    // Data
                    case 'data-list':
                        if (apiKey) await handleDataList(new Langtrain({ apiKey }).files);
                        break;
                    case 'data-upload':
                        if (apiKey) await handleDataUpload(new Langtrain({ apiKey }).files);
                        break;
                    case 'data-refine':
                        if (apiKey) await handleDataRefine(new Langtrain({ apiKey }).files);
                        break;

                    // Knowledge
                    case 'knowledge-entities': if (clients) await handleKnowledgeEntities(clients.knowledge); break;

                    // Guardrails
                    case 'guard-list': await handleGuardrailList(null); break;
                    case 'guard-create': await handleGuardrailCreate(null); break;
                }
            } catch (error: any) {
                outro(colors.red(`Error: ${error.message}`));
            }
        }
    });

    program.parse(process.argv);
}

main().catch(console.error);
