import { password, isCancel, cancel, intro, green, yellow, red, bgMagenta, black, spinner, gray, cyan, dim, bold, note } from './ui';
import { getConfig, saveConfig } from './config';
import { SubscriptionClient, SubscriptionInfo } from '../index';
import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

function getApiBase() {
    const config = getConfig();
    const base = (config.baseUrl || 'https://api.langtrain.xyz').replace(/\/$/, '');
    return `${base}/v1`;
}

async function openBrowser(url: string) {
    try {
        const command = process.platform === 'win32'
            ? `start ${url}`
            : process.platform === 'darwin'
                ? `open "${url}"`
                : `xdg-open "${url}"`;
        await execAsync(command);
    } catch {
        // Silently fail if browser can't open
    }
}

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
 * Interactive login — browser-based OAuth flow with API key fallback.
 */
export async function handleLogin() {
    console.log('\n  ' + bgMagenta(black(' AUTHENTICATION ')) + '\n');
    console.log(gray('  To log in, you will need your personal API Key.'));

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
            cancel('Login cancelled.');
            process.exit(0);
        }

        const verifySpinner = spinner();
        verifySpinner.start('Verifying API Key...');

        try {
            const client = new SubscriptionClient({ apiKey: apiKey as string });
            const info = await client.getStatus();

            const planBadge = info.plan === 'pro'
                ? bgMagenta(black(' PRO '))
                : info.plan === 'enterprise'
                    ? bgMagenta(black(' ENTERPRISE '))
                    : ' FREE ';

            verifySpinner.stop(green(`Authenticated ${planBadge}`));

            const config = getConfig();
            saveConfig({ ...config, apiKey: apiKey as string });
            console.log(green('  ✔ Credentials saved locally. You are now logged in!\n'));
            return;
        } catch (e: any) {
            verifySpinner.stop(red('Invalid API Key.'));
            if (e.message) {
                console.log(red(`\n  Server Error: ${e.message}`));
            }
            console.log(yellow('  Please ensure your key is valid and you have an active account.\n'));
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
