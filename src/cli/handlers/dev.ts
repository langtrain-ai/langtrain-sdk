import { intro, outro, spinner, green, red, yellow, showInfo, gray } from '../ui';
import { AgentClient } from '../../index';
import { handleDeploy } from './deploy';
import fs from 'fs';
import path from 'path';

export async function handleDev(client: AgentClient) {
    intro('Starting Langtrain Development Server...');

    const configPath = path.join(process.cwd(), 'langtrain.config.json');
    if (!fs.existsSync(configPath)) {
        intro(red('langtrain.config.json not found. Run "lt init" first.'));
        return;
    }

    console.log(gray(`Watching ${configPath} for changes...`));

    let isDeploying = false;

    // Initial Deploy
    await handleDeploy(client);

    fs.watch(configPath, async (eventType) => {
        if (eventType === 'change' && !isDeploying) {
            isDeploying = true;
            console.log(yellow('Configuration changed. Redeploying...'));
            // Wait a bit for file write to complete
            await new Promise(r => setTimeout(r, 500));
            try {
                await handleDeploy(client);
            } catch (e: any) {
                console.error(red(`Deploy failed: ${e.message}`));
            } finally {
                isDeploying = false;
                console.log(gray(`Watching ${configPath}...`));
            }
        }
    });

    // Keep process alive
    await new Promise(() => { });
}
