import { password, isCancel, cancel, intro, green, yellow, red, bgMagenta, black, spinner, gray, cyan, dim, bold } from './ui';
import { getConfig, saveConfig } from './config';
import { SubscriptionClient, SubscriptionInfo } from '../index';

/**
 * Quick check if API key is stored (no network call).
 */
export function isAuthenticated(): boolean {
    const config = getConfig();
    return !!config.apiKey;
}

/**
 * Ensure auth — if not logged in, forces login flow.
 */
export async function ensureAuth(): Promise<string> {
    let config = getConfig();

    if (!config.apiKey) {
        console.log('');
        console.log(yellow('  Authentication required.'));
        console.log(gray('  Login to access all features.\n'));
        await handleLogin();
        config = getConfig();
    }

    return config.apiKey as string;
}

/**
 * Interactive login — Claude-style API key entry with immediate verification.
 */
export async function handleLogin() {
    while (true) {
        console.log(dim('  ─────────────────────────────────────'));
        console.log(gray('  Get your API Key at: ') + cyan('https://app.langtrain.xyz/home/api'));
        console.log(dim('  ─────────────────────────────────────\n'));

        const apiKey = await password({
            message: 'Enter your Langtrain API Key:',
            validate(value) {
                if (!value || value.length === 0) return 'API Key is required';
                if (value.length < 10) return 'Invalid key format';
            },
        });

        if (isCancel(apiKey)) {
            cancel('Operation cancelled');
            process.exit(0);
        }

        const s = spinner();
        s.start('Verifying API Key...');

        try {
            const client = new SubscriptionClient({ apiKey: apiKey as string });
            const info = await client.getStatus();

            const planBadge = info.plan === 'pro'
                ? bgMagenta(black(' PRO '))
                : info.plan === 'enterprise'
                    ? bgMagenta(black(' ENTERPRISE '))
                    : ' FREE ';

            s.stop(green(`Authenticated ${planBadge}`));

            // Show initial token info if available
            if (info.usage) {
                const used = info.usage.tokensUsedThisMonth || 0;
                const limit = info.usage.tokenLimit || 10000;
                const pct = Math.round((used / limit) * 100);
                console.log(dim(`  Tokens: ${used.toLocaleString()} / ${limit.toLocaleString()} (${pct}% used)`));
            }

            const config = getConfig();
            saveConfig({ ...config, apiKey: apiKey as string });
            console.log(green('  ✔ Credentials saved to ~/.langtrain/config.json\n'));
            return;
        } catch (e: any) {
            s.stop(red('Invalid API Key. Please try again.'));
        }
    }
}

/**
 * Logout — clear stored credentials.
 */
export async function handleLogout() {
    const config = getConfig();
    delete config.apiKey;
    saveConfig(config);
    console.log(green('\n  ✔ Logged out. Credentials cleared.\n'));
}

/**
 * Fetch subscription info for status bar display.
 */
export async function getSubscription(apiKey: string): Promise<SubscriptionInfo | null> {
    const client = new SubscriptionClient({ apiKey });
    const s = spinner();
    s.start('Checking subscription...');
    try {
        const info = await client.getStatus();

        const planBadge = info.plan === 'pro'
            ? bgMagenta(black(' PRO '))
            : info.plan === 'enterprise'
                ? bgMagenta(black(' ENTERPRISE '))
                : bold(' FREE ');

        s.stop(green(`Plan: ${planBadge}`));

        if (info.is_active === false) {
            console.log(yellow('  ⚠ Subscription inactive. Some features may be limited.\n'));
        }

        return info;
    } catch (e: any) {
        s.stop(red('Failed to verify subscription.'));
        if (e.response && e.response.status === 401) {
            console.log(red('  API Key expired. Please login again.'));
        }
        return null;
    }
}
