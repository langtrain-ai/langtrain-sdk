
import axios, { AxiosInstance } from 'axios';

export interface UsageSummary {
    workspace_id: string;
    plan: string;
    quotas: Record<string, any>;
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

export class UsageClient {
    private client: AxiosInstance;

    constructor(private config: { apiKey: string, baseUrl?: string }) {
        this.client = axios.create({
            baseURL: config.baseUrl || 'https://api.langtrain.ai/api/v1',
            headers: {
                'X-API-Key': config.apiKey,
                'Content-Type': 'application/json'
            }
        });
    }

    /**
     * Get current usage summary for a workspace.
     */
    async getSummary(workspaceId: string): Promise<UsageSummary> {
        const response = await this.client.get<UsageSummary>(`/usage`, {
            params: { workspace_id: workspaceId }
        });
        return response.data;
    }

    /**
     * Get historical usage data for charts.
     */
    async getHistory(workspaceId: string, days: number = 30): Promise<UsageHistoryPoint[]> {
        const response = await this.client.get<{ history: UsageHistoryPoint[] }>(`/usage/history`, {
            params: { workspace_id: workspaceId, days }
        });
        return response.data.history;
    }
}
