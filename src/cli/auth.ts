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
    const s = spinner();
    s.start('Connecting to Langtrain...');

    try {
        // 1. Request device code
        const { data: codeData } = await axios.post(`${getApiBase()}/auth/device/code`);
        const { device_code, user_code, verification_url, expires_in, interval } = codeData;

        s.stop(green('Connected.'));

        console.log('\n  ' + bgMagenta(black(' AUTHENTICATION ')) + '\n');
        console.log(`  To log in, please open your browser to:\n  ${cyan(verification_url + '?code=' + user_code)}\n`);

        note(
            `Confirmation Code:\n${bold(user_code)}`,
            'Verify in Browser'
        );

        console.log(gray('  Opening browser automatically...'));
        await openBrowser(`${verification_url}?code=${user_code}`);

        const pollSpinner = spinner();
        pollSpinner.start('Waiting for approval in browser...');

        // 2. Poll for token
        const startTime = Date.now();
        const timeout = expires_in * 1000;

        while (Date.now() - startTime < timeout) {
            try {
                const { data: tokenData } = await axios.post(`${getApiBase()}/auth/device/token?device_code=${device_code}`);

                if (tokenData.status === 'approved') {
                    const apiKey = tokenData.api_key;
                    pollSpinner.stop(green('Approved!'));

                    const verifySpinner = spinner();
                    verifySpinner.start('Verifying credentials...');

                    try {
                        const client = new SubscriptionClient({ apiKey });
                        const info = await client.getStatus();

                        const planBadge = info.plan === 'pro'
                            ? bgMagenta(black(' PRO '))
                            : info.plan === 'enterprise'
                                ? bgMagenta(black(' ENTERPRISE '))
                                : ' FREE ';

                        verifySpinner.stop(green(`Authenticated ${planBadge}`));

                        const config = getConfig();
                        saveConfig({ ...config, apiKey });
                        console.log(green('  ✔ Credentials saved to ~/.langtrain/config.json\n'));
                        return;
                    } catch (e: any) {
                        verifySpinner.stop(red('Verification failed.'));
                        console.log(red(`\n  Error: ${e.message}`));
                        console.log(gray('  Please try manual login or check your connection.\n'));
                        break; // Stop polling if verification fails after approval
                    }
                }

                if (tokenData.status === 'expired') {
                    pollSpinner.stop(red('Device code expired.'));
                    break;
                }

                // Wait for the requested interval
                await new Promise(r => setTimeout(r, interval * 1000));
            } catch (err) {
                // Ignore network errors during polling
                await new Promise(r => setTimeout(r, interval * 1000));
            }
        }

        pollSpinner.stop(yellow('Login timed out.'));
    } catch (err: any) {
        s.stop(red('Could not reach Langtrain server.'));
    }

    // 3. Fallback to manual entry if browser flow fails
    console.log(gray('\n  Browser login failed or timed out. Falling back to manual entry.'));

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
            console.log(green('  ✔ Credentials saved to ~/.langtrain/config.json\n'));
            return;
        } catch (e: any) {
            verifySpinner.stop(red('Invalid API Key. Please try again.'));
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
