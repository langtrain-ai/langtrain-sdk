import { green, dim, cyan, bold, yellow, gray, spinner } from '../ui';
import { getConfig } from '../config';

// Session-level telemetry tracker
let sessionStart = Date.now();
let apiCallCount = 0;
let totalLatencyMs = 0;
let errorCount = 0;

export function trackApiCall(latencyMs: number, isError: boolean = false) {
    apiCallCount++;
    totalLatencyMs += latencyMs;
    if (isError) errorCount++;
}

export async function handleTokens() {
    const config = getConfig();
    const apiKey = config.apiKey;

    console.log('');
    console.log(bold('  ╔══════════════════════════════════════╗'));
    console.log(bold('  ║         TOKEN USAGE                  ║'));
    console.log(bold('  ╚══════════════════════════════════════╝'));
    console.log('');

    if (!apiKey) {
        console.log(yellow('  Login required to view token usage.\n'));
        return;
    }

    const s = spinner();
    s.start('Fetching token usage...');

    try {
        const axios = require('axios');
        const baseUrl = config.baseUrl || 'https://api.langtrain.xyz';
        const res = await axios.get(`${baseUrl}/v1/usage/tokens`, {
            headers: { Authorization: `Bearer ${apiKey}` }
        });

        const usage = res.data;
        s.stop(green('Token usage retrieved'));
        console.log('');

        const used = usage.tokens_used || 0;
        const limit = usage.token_limit || 10000;
        const pct = Math.round((used / limit) * 100);
        const remaining = Math.max(0, limit - used);

        // Visual bar
        const barWidth = 30;
        const filled = Math.round((pct / 100) * barWidth);
        const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
        const barColor = pct > 90 ? '\x1b[31m' : pct > 70 ? '\x1b[33m' : '\x1b[32m';

        console.log(`  ${dim('Period:')}     ${usage.period || 'Current Month'}`);
        console.log(`  ${dim('Used:')}       ${used.toLocaleString()} tokens`);
        console.log(`  ${dim('Limit:')}      ${limit.toLocaleString()} tokens`);
        console.log(`  ${dim('Remaining:')}  ${remaining.toLocaleString()} tokens`);
        console.log(`  ${dim('Usage:')}      ${barColor}${bar}\x1b[0m ${pct}%`);
        console.log('');

        if (usage.breakdown) {
            console.log(dim('  ── Breakdown ────────────────────────'));
            console.log(`  ${dim('Training:')}   ${(usage.breakdown.training || 0).toLocaleString()}`);
            console.log(`  ${dim('Inference:')}  ${(usage.breakdown.inference || 0).toLocaleString()}`);
            console.log(`  ${dim('Agents:')}     ${(usage.breakdown.agents || 0).toLocaleString()}`);
            console.log('');
        }
    } catch (e: any) {
        s.stop('');
        // Show mock data if API not available
        console.log(dim('  Token data not available from server.'));
        console.log(dim('  Showing session estimates:\n'));

        console.log(`  ${dim('Session calls:')}  ${apiCallCount}`);
        console.log(`  ${dim('Est. tokens:')}    ~${apiCallCount * 150}`);
        console.log('');
    }
}

export async function handleTelemetry() {
    const uptimeMs = Date.now() - sessionStart;
    const uptimeSec = Math.round(uptimeMs / 1000);
    const uptimeMin = Math.floor(uptimeSec / 60);
    const uptimeStr = uptimeMin > 0 ? `${uptimeMin}m ${uptimeSec % 60}s` : `${uptimeSec}s`;

    const avgLatency = apiCallCount > 0 ? Math.round(totalLatencyMs / apiCallCount) : 0;
    const errorRate = apiCallCount > 0 ? Math.round((errorCount / apiCallCount) * 100) : 0;

    console.log('');
    console.log(bold('  ╔══════════════════════════════════════╗'));
    console.log(bold('  ║         SESSION TELEMETRY             ║'));
    console.log(bold('  ╚══════════════════════════════════════╝'));
    console.log('');

    console.log(`  ${dim('Session:')}      ${uptimeStr}`);
    console.log(`  ${dim('API calls:')}    ${apiCallCount}`);
    console.log(`  ${dim('Avg latency:')}  ${avgLatency}ms`);
    console.log(`  ${dim('Errors:')}       ${errorCount} (${errorRate}%)`);
    console.log('');

    console.log(dim('  ── Environment ──────────────────────'));
    console.log(`  ${dim('Node:')}         ${process.version}`);
    console.log(`  ${dim('Platform:')}     ${process.platform} ${process.arch}`);
    console.log(`  ${dim('Memory:')}       ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB heap`);
    console.log(`  ${dim('Config:')}       ~/.langtrain/config.json`);
    console.log('');

    // API health check
    const config = getConfig();
    if (config.apiKey) {
        const s = spinner();
        s.start('Pinging API...');
        try {
            const axios = require('axios');
            const baseUrl = config.baseUrl || 'https://api.langtrain.xyz';
            const start = Date.now();
            await axios.get(`${baseUrl}/health`, { timeout: 5000 });
            const latency = Date.now() - start;
            s.stop(green(`API healthy (${latency}ms)`));
        } catch {
            s.stop(yellow('API unreachable'));
        }
    }
    console.log('');
}
