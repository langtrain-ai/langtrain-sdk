import axios from 'axios';
import { fetchGpuTiers } from './gpuTiers';
import { spinner, showError, showWarning, colors } from '../ui';

const { green, red, yellow, cyan, bold, dim, magenta } = colors;

function padEnd(str: string, len: number): string {
    const visible = str.replace(/\x1b\[[0-9;]*m/g, '');
    return str + ' '.repeat(Math.max(0, len - visible.length));
}

export async function handleGpuStatus(apiKey: string, baseUrl?: string): Promise<void> {
    const base = (baseUrl || 'https://api.langtrain.xyz').replace(/\/$/, '');
    const headers = { 'x-api-key': apiKey };

    const s = spinner();
    s.start('Fetching GPU tiers...');

    let gpus: any[] = [];
    let usage: any = null;

    try {
        const [availRes, usageRes] = await Promise.allSettled([
            fetchGpuTiers(base, apiKey),
            axios.get(`${base}/api/v1/usage`, { headers, timeout: 8000 })
        ]);

        if (availRes.status === 'fulfilled') {
            gpus = availRes.value;
        }
        if (usageRes.status === 'fulfilled') {
            usage = usageRes.value.data;
        }

        s.stop(green('GPU data loaded'));
    } catch {
        s.stop(yellow('Could not fetch GPU data'));
    }

    // ── GPU Availability Table ────────────────────────────────────────────
    console.log('\n  ' + bold(magenta('GPU Availability')));
    console.log(dim('  ┌──────────────────────┬──────────┬───────┬──────────┬──────────┐'));
    console.log(
        '  ' + dim('│') + bold(padEnd('  GPU', 22)) +
        dim('│') + bold(padEnd('  VRAM', 10)) +
        dim('│') + bold(padEnd('  ×', 7)) +
        dim('│') + bold(padEnd('  $/hr', 10)) +
        dim('│') + bold(padEnd('  For', 10)) +
        dim('│')
    );
    console.log(dim('  ├──────────────────────┼──────────┼───────┼──────────┼──────────┤'));

    if (gpus.length === 0) {
        console.log(dim('  │  No GPU data available                                          │'));
    } else {
        gpus.forEach((g: any) => {
            const name = (g.name || 'Unknown').substring(0, 20);
            const vram = `${g.vram_gb || '?'}GB`;
            const count = `×${g.count || 1}`;
            const price = `$${(g.price_per_hour || 0).toFixed(2)}`;
            // The API lists tiers and prices, not live availability.
            const status = dim(String(g.recommended_for || '').slice(0, 10));

            console.log(
                '  ' + dim('│') + '  ' + padEnd(cyan(name), 22) +
                dim('│') + '  ' + padEnd(vram, 8) +
                dim('│') + '  ' + padEnd(count, 5) +
                dim('│') + '  ' + padEnd(yellow(price), 10) +
                dim('│') + '  ' + padEnd(status, 12) +
                dim('│')
            );
        });
    }

    console.log(dim('  └──────────────────────┴──────────┴───────┴──────────┴──────────┘'));

    // ── Usage Section ─────────────────────────────────────────────────────
    if (usage) {
        console.log('\n  ' + bold('Current Usage:'));
        console.log(dim('  ──────────────────────────────────────'));
        if (usage.active_jobs !== undefined) {
            console.log(`  ${dim('Active Jobs:')}      ${yellow(String(usage.active_jobs))}`);
        }
        if (usage.tokens_this_month !== undefined) {
            console.log(`  ${dim('Tokens (month):')}  ${cyan(Number(usage.tokens_this_month).toLocaleString())}`);
        }
        if (usage.gpu_hours_used !== undefined) {
            console.log(`  ${dim('GPU Hours Used:')}  ${magenta(String(usage.gpu_hours_used) + 'h')}`);
        }
        if (usage.estimated_cost !== undefined) {
            console.log(`  ${dim('Est. Cost:')}       ${green('$' + Number(usage.estimated_cost).toFixed(2))}`);
        }
        console.log(dim('  ──────────────────────────────────────'));
    } else {
        console.log('\n  ' + dim('Usage data not available (check API key).'));
    }

    console.log('');
}
