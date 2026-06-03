/**
 * auth.ts — Browser-based authentication (no API key needed)
 *
 * Flow (identical to GitHub CLI / Claude Code):
 *  1. Generate a one-time state token (crypto-random)
 *  2. Find a free local port
 *  3. Start a local HTTP server on that port
 *  4. Open browser → https://app.langtrain.xyz/cli-auth?state=…&port=…
 *  5. User logs in / signs up in the browser
 *  6. Browser redirects to http://localhost:<port>/callback?token=…&state=…
 *  7. CLI verifies state, saves API key to ~/.langtrain/config.json
 *  8. Prints "✔ Authenticated as user@example.com"
 */

import * as http from 'http';
import * as net from 'net';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

import { spinner, colors, intro, outro } from './ui';
import { getConfig, saveConfig } from './config';
import { SubscriptionClient, SubscriptionInfo } from '../index';

const { green, red, yellow, cyan, dim, bold, magenta, gray, bgMagenta, black } = colors;

const execAsync = promisify(exec);

const APP_URL = process.env.LANGTRAIN_APP_URL || 'https://app.langtrain.xyz';
const API_URL = (() => {
    const cfg = getConfig();
    return (cfg.baseUrl || 'https://api.langtrain.xyz').replace(/\/$/, '');
})();

// ─────────────────────────────────────────────────────────────────────────────
// Browser open (cross-platform)
// ─────────────────────────────────────────────────────────────────────────────

async function openBrowser(url: string): Promise<boolean> {
    const cmd = process.platform === 'win32'   ? `start "" "${url}"`
              : process.platform === 'darwin'  ? `open "${url}"`
              : `xdg-open "${url}"`;
    try {
        await execAsync(cmd);
        return true;
    } catch {
        return false;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Find a free TCP port
// ─────────────────────────────────────────────────────────────────────────────

function findFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const srv = net.createServer();
        srv.listen(0, '127.0.0.1', () => {
            const addr = srv.address() as net.AddressInfo;
            srv.close(() => resolve(addr.port));
        });
        srv.on('error', reject);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Local callback server — waits for the browser redirect
// ─────────────────────────────────────────────────────────────────────────────

function startCallbackServer(
    port: number,
    expectedState: string
): Promise<{ token: string }> {
    return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            const base = `http://localhost:${port}`;
            const url  = new URL(req.url || '/', base);

            if (url.pathname !== '/callback') {
                res.writeHead(404);
                res.end('Not found');
                return;
            }

            const token = url.searchParams.get('token') || url.searchParams.get('api_key') || '';
            const state = url.searchParams.get('state') || '';
            const error = url.searchParams.get('error') || '';

            if (error) {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(callbackHtml('Authentication failed', `<p style="color:red">${error}</p><p>Return to your terminal and try again.</p>`));
                server.close();
                reject(new Error(`Auth error: ${error}`));
                return;
            }

            if (!token) {
                res.writeHead(400);
                res.end('Missing token');
                return;
            }

            if (state !== expectedState) {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(callbackHtml('Security error', '<p>State mismatch. Please try again.</p>'));
                server.close();
                reject(new Error('State mismatch — possible CSRF. Run login again.'));
                return;
            }

            // Success page shown in the browser
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(callbackHtml(
                'Authenticated!',
                '<p>You\'re logged in to Langtrain.</p><p style="color:#888">You can close this tab and return to your terminal.</p>'
            ));

            server.close();
            resolve({ token });
        });

        server.listen(port, '127.0.0.1');
        server.on('error', reject);
    });
}

function callbackHtml(title: string, body: string): string {
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${title} — Langtrain</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
       background:#09090b;color:#fafafa;display:flex;align-items:center;
       justify-content:center;min-height:100vh;padding:24px}
  .card{background:#18181b;border:1px solid #27272a;border-radius:12px;
        padding:40px;max-width:420px;width:100%;text-align:center}
  .logo{font-size:2rem;font-weight:800;letter-spacing:-1px;margin-bottom:16px}
  h1{font-size:1.25rem;margin-bottom:12px}
  p{color:#a1a1aa;line-height:1.6;margin-top:8px}
  .check{font-size:3rem;margin-bottom:16px}
</style>
</head><body>
<div class="card">
  <div class="logo">⚡ Langtrain</div>
  <div class="check">${title === 'Authenticated!' ? '✅' : '❌'}</div>
  <h1>${title}</h1>
  ${body}
</div>
</body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch user info after receiving token
// ─────────────────────────────────────────────────────────────────────────────

async function fetchUserInfo(token: string): Promise<{ email?: string; plan?: string }> {
    try {
        const axios = (await import('axios')).default;
        const res = await axios.get(`${API_URL}/v1/users/me`, {
            headers: { 'x-api-key': token },
            timeout: 6000,
        });
        return res.data || {};
    } catch {
        return {};
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export function isAuthenticated(): boolean {
    return !!getConfig().apiKey;
}

export async function ensureAuth(): Promise<string> {
    const config = getConfig();
    if (!config.apiKey) {
        console.log('');
        console.log(yellow('  Authentication required.'));
        await handleLogin();
    }
    return getConfig().apiKey as string;
}

/**
 * Browser-based login — opens app.langtrain.xyz, no API key needed.
 */
export async function handleLogin(): Promise<void> {
    const state = crypto.randomBytes(24).toString('hex');
    const port  = await findFreePort();
    const authUrl = `${APP_URL}/cli-auth?state=${state}&port=${port}&source=cli`;

    console.log();
    console.log(`  ${bgMagenta(black(' LANGTRAIN LOGIN '))}  ${dim('browser-based · no API key needed')}`);
    console.log();

    // Start local server before opening browser
    const tokenPromise = startCallbackServer(port, state);

    // Open browser
    const opened = await openBrowser(authUrl);

    if (opened) {
        console.log(`  ${green('✔')}  Browser opened.`);
    } else {
        console.log(`  ${yellow('⚠')}  Could not open browser automatically.`);
    }

    console.log(`  ${dim('Visit this URL to authenticate:')}`);
    console.log();
    console.log(`     ${cyan(authUrl)}`);
    console.log();

    const s = spinner();
    s.start('Waiting for authentication…  (Ctrl+C to cancel)');

    // Race: callback vs 2-minute timeout
    const TIMEOUT_MS = 120_000;
    let result: { token: string };

    try {
        result = await Promise.race([
            tokenPromise,
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Timed out after 2 minutes.')), TIMEOUT_MS)
            ),
        ]);
    } catch (e: any) {
        s.stop(red(`✖  ${e.message}`));
        console.log(dim('  Run `lt login` to try again.'));
        return;
    }

    s.stop(green('✔  Token received'));

    // Fetch user profile
    const user = await fetchUserInfo(result.token);

    // Save
    const config = getConfig();
    saveConfig({ ...config, apiKey: result.token });

    // Restrict file permissions on Unix
    const configPath = require('path').join(require('os').homedir(), '.langtrain', 'config.json');
    try { fs.chmodSync(configPath, 0o600); } catch {}

    const planBadge = user.plan === 'pro'        ? bgMagenta(black(' PRO '))
                    : user.plan === 'enterprise'  ? bgMagenta(black(' ENTERPRISE '))
                    : bold(' FREE ');

    console.log();
    console.log(`  ${green('✔')}  ${bold('Authenticated!')}  ${planBadge}`);
    if (user.email) {
        console.log(`  ${dim('Logged in as')} ${user.email}`);
    }
    console.log();
    console.log(dim('  Type `lt` to start fine-tuning.'));
    console.log();
}

export async function handleLogout(): Promise<void> {
    const config = getConfig();
    delete config.apiKey;
    saveConfig(config);
    console.log(green('\n  ✔ Logged out. Credentials cleared.\n'));
}

export async function getSubscription(apiKey: string): Promise<SubscriptionInfo | null> {
    try {
        const client = new SubscriptionClient({ apiKey });
        return await client.getStatus();
    } catch {
        return null;
    }
}
