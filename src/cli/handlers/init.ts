import path from 'path';
import fs from 'fs';
import { text, confirm, select, isCancel, cancel, intro, outro, showSuccess, showInfo, spinner, colors } from '../ui';
import { getConfig } from '../config';
import { handleLogin } from '../auth';

export async function handleInit() {
    intro('Initializing new Langtrain project...');

    const cwd = process.cwd();

    // 1. Check if already initialized
    if (fs.existsSync(path.join(cwd, 'langtrain.config.json'))) {
        showInfo('langtrain.config.json already exists in this directory.');
        const overwrite = await confirm({
            message: 'Do you want to re-initialize and overwrite the config?',
            initialValue: false
        });

        if (isCancel(overwrite) || !overwrite) {
            outro('Initialization cancelled.');
            return;
        }
    }

    // 2. Ask for Project Details
    const projectName = await text({
        message: 'What is the name of your project?',
        placeholder: 'my-ai-app',
        initialValue: path.basename(cwd),
        validate(value) {
            if (!value || value.length === 0) return 'Project name is required!';
        }
    });

    if (isCancel(projectName)) {
        cancel('Operation cancelled.');
        return;
    }

    let config = getConfig();
    let apiKey = config.apiKey;

    if (apiKey) {
        showSuccess('Found existing Langtrain credentials.');
    } else {
        const shouldLogin = await confirm({
            message: 'You are not logged in. Do you want to log in now?',
            initialValue: true
        });

        if (isCancel(shouldLogin)) {
            cancel('Operation cancelled.');
            return;
        }

        if (shouldLogin) {
            await handleLogin();
            config = getConfig(); // Reload config
            apiKey = config.apiKey;
        } else {
            apiKey = await text({
                message: 'Enter your Langtrain API Key (optional for local dev):',
                placeholder: 'lt_sk_...',
                initialValue: ''
            }) as string;

            if (isCancel(apiKey)) {
                cancel('Operation cancelled.');
                return;
            }
        }
    }

    // 3. Create Config File
    const s = spinner();
    s.start('Creating configuration...');

    const configContent = {
        name: projectName,
        apiKey: apiKey || undefined,
        environment: 'development',
        agents: [
            {
                name: 'support-bot',
                description: 'A helpful customer support assistant',
                config: {
                    model: 'llama-3-8b',
                    system_prompt: 'You are a helpful customer support assistant.',
                    temperature: 0.7
                }
            }
        ]
    };

    fs.writeFileSync(path.join(cwd, 'langtrain.config.json'), JSON.stringify(configContent, null, 2));

    showSuccess('Project initialized successfully!');
    console.log(colors.dim('\nNext steps:'));
    console.log(`  1. Run ${colors.cyan('lt deploy')} to push your agent to the cloud.`);
    console.log(`  2. Run ${colors.cyan('lt dev')} to start the local development loop.`);

    outro('Happy coding!');
}
