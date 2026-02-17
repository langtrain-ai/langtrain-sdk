import { password, isCancel, cancel, intro, green, yellow, red, bgCyan, black, spinner, gray } from './ui';
import { getConfig, saveConfig } from './config';
import { SubscriptionClient, SubscriptionInfo } from '../index';

export async function ensureAuth(): Promise<string> {
    let config = getConfig();

    if (!config.apiKey) {
        intro(yellow('Authentication required to verify plan & features.'));
        await handleLogin();
        config = getConfig();
    }

    return config.apiKey as string;
}

export async function handleLogin() {
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

    const config = getConfig();
    saveConfig({ ...config, apiKey: apiKey as string });
    intro(green('API Key saved successfully!'));
}

export async function getSubscription(apiKey: string): Promise<SubscriptionInfo | null> {
    const client = new SubscriptionClient({ apiKey });
    const s = spinner();
    s.start('Verifying subscription plan...');
    try {
        const info = await client.getStatus();

        // Enhance: Show plan details immediately on auth check
        const planLabel = info.plan === 'pro' ? bgCyan(' PRO ') : info.plan.toUpperCase();
        s.stop(green(`Authenticated as ${planLabel}`));

        if (info.is_active === false) {
            console.log(yellow('Warning: Your subscription is not active. Some features may be limited.'));
        }

        return info;
    } catch (e: any) {
        s.stop(red('Failed to verify subscription.'));
        if (e.response && e.response.status === 401) {
            console.log(red('Invalid API Key. Please run login again.'));
            // Optionally clear key?
        }
        return null;
    }
}
