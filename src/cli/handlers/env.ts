import { intro, outro, spinner, green, red, yellow, showInfo, gray, showSuccess } from '../ui';
import { SecretClient } from '../../index';
import { text, confirm, select, isCancel, cancel } from '../ui';
import { getConfig } from '../config';

export async function handleEnvList(client: SecretClient) {
    const s = spinner();
    s.start('Fetching secrets...');
    const config = getConfig();
    try {
        const secrets = await client.list(config.workspace_id);
        s.stop(`Found ${secrets.length} secrets`);

        if (secrets.length === 0) {
            console.log(gray('No secrets found. Use "lt env set" to add one.'));
            return;
        }

        console.log(gray('------------------------------------------------'));
        secrets.forEach(sec => {
            console.log(`${sec.key.padEnd(30)} ${gray('******')}`);
        });
        console.log(gray('------------------------------------------------'));

    } catch (e: any) {
        s.stop(red(`Failed to list secrets: ${e.message}`));
    }
}

export async function handleEnvSet(client: SecretClient, keyVal?: string) {
    let key = '';
    let value = '';

    if (keyVal && keyVal.includes('=')) {
        const parts = keyVal.split('=');
        key = parts[0];
        value = parts.slice(1).join('=');
    } else {
        key = await text({ message: 'Secret Key:', placeholder: 'OPENAI_API_KEY' }) as string;
        if (isCancel(key)) return;

        value = await text({ message: 'Secret Value:', placeholder: 'sk-...' }) as string;
        if (isCancel(value)) return;
    }

    const s = spinner();
    s.start(`Setting ${key}...`);
    const config = getConfig();

    try {
        await client.set(key, value, config.workspace_id);
        s.stop(green(`Secret ${key} set successfully.`));
    } catch (e: any) {
        s.stop(red(`Failed to set secret: ${e.message}`));
    }
}

// Interactive menu for env
export async function handleEnvMenu(client: SecretClient) {
    const action = await select({
        message: 'Manage Secrets',
        options: [
            { value: 'list', label: 'List Secrets' },
            { value: 'set', label: 'Set Secret' },
            { value: 'remove', label: 'Remove Secret' },
            { value: 'back', label: 'Back' }
        ]
    });

    if (isCancel(action) || action === 'back') return;

    if (action === 'list') await handleEnvList(client);
    if (action === 'set') await handleEnvSet(client);
    if (action === 'remove') {
        const key = await text({ message: 'Key to remove:' });
        if (!isCancel(key)) {
            const s = spinner();
            s.start('Removing...');
            try {
                // need workspace_id
                const config = getConfig();
                await client.delete(key as string, config.workspace_id);
                s.stop(green('Removed.'));
            } catch (e: any) {
                s.stop(red(`Failed: ${e.message}`));
            }
        }
    }
}
