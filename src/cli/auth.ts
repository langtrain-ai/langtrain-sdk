/**
 * auth.ts — Claude Code-style browser authentication
 *
 * Experience:
 *
 *   ◆  Welcome to Langtrain
 *
 *   ┌──────────────────────────────────────────────────────────┐
 *   │                                                          │
 *   │   Sign in to Langtrain to start fine-tuning models.     │
 *   │   This will open your browser to authenticate.          │
 *   │                                                          │
 *   └──────────────────────────────────────────────────────────┘
 *
 *   Press Enter to open browser  (Ctrl+C to cancel)
 *   ▸
 *
 *   ✔  Browser opened
 *
 *   ┌──────────────────────────────────────────────────────────┐
 *   │  Didn't open? Visit:                                     │
 *   │  https://app.langtrain.xyz/cli-auth?state=…             │
 *   └──────────────────────────────────────────────────────────┘
 *
 *   ◆  Waiting for you to complete sign-in in the browser...
 *   ✔  Authenticated as pritesh@langtrain.ai  ▐ PRO ▌
 */

import * as http    from 'http';
import * as net     from 'net';
import * as crypto  from 'crypto';
import * as fs      from 'fs';
import * as path    from 'path';
import * as os      from 'os';
import * as readline from 'readline';
import { exec }     from 'child_process';
import { promisify } from 'util';

import { spinner as clackSpinner, note, intro, outro, isCancel, confirm } from '@clack/prompts';
import { getConfig, saveConfig } from './config';
import { SubscriptionClient, SubscriptionInfo } from '../index';
import { colors, showBanner } from './ui';

const { green, red, yellow, cyan, dim, bold, magenta, bgMagenta, black, gray } = colors;
const execAsync = promisify(exec);

const APP_URL = process.env.LANGTRAIN_APP_URL  || 'https://app.langtrain.xyz';
const API_URL = (() => {
    const cfg = getConfig();
    return (cfg.baseUrl || 'https://api.langtrain.xyz').replace(/\/$/, '');
})();

// ─── Config path ─────────────────────────────────────────────────────────────

const CONFIG_PATH = path.join(os.homedir(), '.langtrain', 'config.json');

// ─── Browser open ─────────────────────────────────────────────────────────────

async function openBrowser(url: string): Promise<boolean> {
    const cmd = process.platform === 'win32'  ? `start "" "${url}"`
              : process.platform === 'darwin' ? `open "${url}"`
              : `xdg-open "${url}"`;
    try { await execAsync(cmd); return true; }
    catch { return false; }
}

// ─── Free port ────────────────────────────────────────────────────────────────

function findFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const s = net.createServer();
        s.listen(0, '127.0.0.1', () => {
            const addr = s.address() as net.AddressInfo;
            s.close(() => resolve(addr.port));
        });
        s.on('error', reject);
    });
}

// ─── Local callback server ────────────────────────────────────────────────────

function startCallbackServer(port: number, expectedState: string): Promise<{ token: string }> {
    return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            const url   = new URL(req.url || '/', `http://localhost:${port}`);
            if (url.pathname !== '/callback') { res.writeHead(404); res.end(); return; }

            const token = url.searchParams.get('token') || url.searchParams.get('api_key') || '';
            const state = url.searchParams.get('state') || '';
            const error = url.searchParams.get('error') || '';

            const html = (title: string, body: string, ok: boolean) =>
                `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
                <style>*{box-sizing:border-box;margin:0;padding:0}
                body{font-family:-apple-system,sans-serif;background:#09090b;color:#fafafa;
                     display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
                .card{background:#18181b;border:1px solid #27272a;border-radius:12px;
                      padding:40px;max-width:420px;width:100%;text-align:center}
                .logo{font-size:2rem;font-weight:800;letter-spacing:-1px;margin-bottom:16px}
                h1{font-size:1.3rem;margin-bottom:12px}p{color:#a1a1aa;line-height:1.6;margin-top:8px}
                .icon{font-size:3rem;margin-bottom:16px}</style></head>
                <body><div class="card"><div class="logo">⚡ Langtrain</div>
                <div class="icon">${ok ? '✅' : '❌'}</div>
                <h1>${title}</h1>${body}</div></body></html>`;

            if (error) {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(html('Authentication failed', `<p>${error}</p><p>Return to your terminal.</p>`, false));
                server.close();
                reject(new Error(error));
                return;
            }

            if (!token) { res.writeHead(400); res.end('Missing token'); return; }

            if (state !== expectedState) {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(html('Security error', '<p>State mismatch. Try again.</p>', false));
                server.close();
                reject(new Error('State mismatch — possible CSRF. Run lt login again.'));
                return;
            }

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html(
                'You\'re signed in!',
                '<p>Authentication successful.</p><p style="color:#71717a">You can close this tab and return to your terminal.</p>',
                true
            ));
            server.close();
            resolve({ token });
        });

        server.listen(port, '127.0.0.1');
        server.on('error', reject);
    });
}

// ─── User info ────────────────────────────────────────────────────────────────

async function fetchUserInfo(token: string): Promise<{ email?: string; plan?: string }> {
    try {
        const axios = (await import('axios')).default;
        const res   = await axios.get(`${API_URL}/v1/users/me`,
            { headers: { 'x-api-key': token }, timeout: 6000 });
        return res.data || {};
    } catch { return {}; }
}

// ─── Box drawing helper ────────────────────────────────────────────────────────

function box(lines: string[], width = 66): string {
    const pad = (s: string) => {
        const vis = s.replace(/\x1b\[[0-9;]*m/g, '').length;
        return s + ' '.repeat(Math.max(0, width - vis - 4));
    };
    const top    = `  ╭${'─'.repeat(width - 2)}╮`;
    const bottom = `  ╰${'─'.repeat(width - 2)}╯`;
    const rows   = lines.map(l => `  │  ${pad(l)}  │`);
    return [top, ...rows, bottom].join('\n');
}

// ─── "Press Enter" prompt ─────────────────────────────────────────────────────

function waitForEnter(prompt: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        // Put stdin in raw mode so Enter is caught immediately
        if (process.stdin.isTTY) process.stdin.setRawMode(true);
        process.stdout.write(prompt);
        const handler = (key: Buffer) => {
            const k = key.toString();
            if (k === '\r' || k === '\n' || k === ' ') {
                if (process.stdin.isTTY) process.stdin.setRawMode(false);
                process.stdout.write('\n');
                process.stdin.off('data', handler);
                rl.close();
                resolve();
            } else if (k === '') {    // Ctrl+C
                if (process.stdin.isTTY) process.stdin.setRawMode(false);
                process.stdout.write('\n');
                process.stdin.off('data', handler);
                rl.close();
                reject(new Error('cancelled'));
            }
        };
        process.stdin.on('data', handler);
        process.stdin.resume();
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export function isAuthenticated(): boolean {
    return !!getConfig().apiKey;
}

export async function ensureAuth(): Promise<string> {
    if (!getConfig().apiKey) await handleLogin();
    return getConfig().apiKey as string;
}

/**
 * Claude Code-style browser login.
 * Called when the user runs `lt login` or when `lt` is run unauthenticated.
 */
export async function handleLogin(): Promise<void> {
    const state   = crypto.randomBytes(24).toString('hex');
    const port    = await findFreePort();
    const authUrl = `${APP_URL}/cli-auth?state=${state}&port=${port}&source=cli`;

    console.log();
    console.log(box([
        bold('Sign in to Langtrain'),
        '',
        dim('Fine-tune text and vision models from your terminal.'),
        dim('We\'ll open your browser to complete authentication.'),
    ]));
    console.log();

    // "Press Enter" prompt — gives the user explicit control, just like Claude Code
    try {
        await waitForEnter(`  ${dim('Press')} ${bold('Enter')} ${dim('to open browser')}  ${dim('(Ctrl+C to cancel)')}  `);
    } catch {
        console.log(dim('\n  Login cancelled.'));
        return;
    }

    // Start local server *before* opening browser so nothing is missed
    const tokenPromise = startCallbackServer(port, state);

    const opened = await openBrowser(authUrl);

    if (opened) {
        console.log(`  ${green('✔')}  Browser opened`);
    } else {
        console.log(`  ${yellow('⚠')}  Couldn\'t open browser automatically`);
    }

    // Always show the URL — user can copy it if needed
    console.log();
    console.log(box([
        dim('If the browser didn\'t open, visit this URL:'),
        '',
        cyan(authUrl),
    ]));
    console.log();

    // Spinner while waiting for the browser callback
    const s = clackSpinner();
    s.start('Waiting for you to complete sign-in in the browser…');

    const TIMEOUT_MS = 120_000;
    let result: { token: string };

    try {
        result = await Promise.race([
            tokenPromise,
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Timed out after 2 minutes.')), TIMEOUT_MS)
            ),
        ]);
        s.stop('Sign-in complete');
    } catch (e: any) {
        s.stop(e.message);
        console.log(dim(`\n  Run ${bold('lt login')} to try again.\n`));
        return;
    }

    // Fetch user profile
    const user = await fetchUserInfo(result.token);

    // Save credentials (chmod 600 on Unix)
    const config = getConfig();
    saveConfig({ ...config, apiKey: result.token });
    try { fs.chmodSync(CONFIG_PATH, 0o600); } catch {}

    // Plan badge
    const planBadge =
        user.plan === 'pro'        ? bgMagenta(black(' PRO '))
      : user.plan === 'enterprise' ? bgMagenta(black(' ENTERPRISE '))
      : dim('FREE');

    console.log();
    console.log(box([
        `${green('✔')}  ${bold('Authenticated')}  ${planBadge}`,
        '',
        ...(user.email ? [dim(`Signed in as `) + bold(user.email)] : []),
        '',
        dim('Type ') + bold('/help') + dim(' to see all commands.'),
    ]));
    console.log();
}

export async function handleLogout(): Promise<void> {
    const config = getConfig();
    delete config.apiKey;
    saveConfig(config);
    console.log(green('\n  ✔ Signed out. Run lt login to authenticate again.\n'));
}

export async function getSubscription(apiKey: string): Promise<SubscriptionInfo | null> {
    try {
        const client = new SubscriptionClient({ apiKey });
        return await client.getStatus();
    } catch { return null; }
}
