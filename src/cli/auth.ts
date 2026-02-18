import { password, isCancel, cancel, intro, green, yellow, red, bgMagenta, black, spinner, gray } from './ui';
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
    while (true) {
        console.log(gray('\nGet your API Key at: https://langtrain.xyz/settings/keys\n'));
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

        const s = spinner();
        s.start('Verifying API Key...');

        // Verify key immediately
        try {
            const client = new SubscriptionClient({ apiKey: apiKey as string });
            const info = await client.getStatus();

            s.stop(green(`Authenticated as ${info.plan === 'pro' ? 'PRO' : info.plan.toUpperCase()}`));

            const config = getConfig();
            saveConfig({ ...config, apiKey: apiKey as string });
            // intro(green('API Key saved successfully!')); // success message above is enough
            return; // Exit loop on success
        } catch (e: any) {
            s.stop(red('Invalid API Key. Please try again.'));
            // Loop continues
        }
    }
}

export async function getSubscription(apiKey: string): Promise<SubscriptionInfo | null> {
    const client = new SubscriptionClient({ apiKey });
    const s = spinner();
    s.start('Verifying subscription plan...');
    try {
        const info = await client.getStatus();

        // Enhance: Show plan details immediately on auth check
        const planLabel = info.plan === 'pro' ? bgMagenta(' PRO ') : info.plan.toUpperCase();
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
