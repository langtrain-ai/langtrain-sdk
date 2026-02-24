import { BaseClient, ClientConfig } from './base';

// ── Types ──────────────────────────────────────────────────────────────────

export interface UsageSummary {
    project_id: string;
    plan: string;
    quotas: Record<string, number>;
    billing?: {
        plan_id: string;
        tokens_used: number;
        tokens_limit: number;
        period_end: string;
    };
}

export interface UsageHistoryPoint {
    date: string;
    tokens: number;
    agent_runs: number;
    cost: number;
}

// ── Client ─────────────────────────────────────────────────────────────────

/**
 * Client for querying usage metrics and billing data.
 *
 * @example
 * ```ts
 * const usage = new UsageClient({ apiKey: 'lt_...' });
 * const summary = await usage.getSummary('ws_abc123');
 * console.log(summary.billing?.tokens_used);
 * ```
 */
export class UsageClient extends BaseClient {
    constructor(config: ClientConfig) {
        super(config);
    }

    /** Get current usage summary for a workspace. */
    async getSummary(projectId: string): Promise<UsageSummary> {
        return this.request(async () => {
            const res = await this.http.get<UsageSummary>('/usage', {
                params: { project_id: projectId },
            });
            return res.data;
        });
    }

    /** Get historical usage data for charts. */
    async getHistory(projectId: string, days: number = 30): Promise<UsageHistoryPoint[]> {
        return this.request(async () => {
            const res = await this.http.get<{ history: UsageHistoryPoint[] }>('/usage/history', {
                params: { project_id: projectId, days },
            });
            return res.data.history;
        });
    }
}
