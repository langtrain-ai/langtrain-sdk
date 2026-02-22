import { BaseClient, ClientConfig } from './base';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SubscriptionInfo {
    is_active: boolean;
    plan: string;
    plan_name: string;
    expires_at?: string;
    features: string[];
    limits: Record<string, number>;
    usage?: {
        tokensUsedThisMonth?: number;
        tokenLimit?: number;
        apiCalls?: number;
    };
}

export interface FeatureCheck {
    feature: string;
    allowed: boolean;
    limit?: number;
    used?: number;
}

// ── Client ─────────────────────────────────────────────────────────────────

/**
 * Client for checking subscription status and feature access.
 *
 * @example
 * ```ts
 * const sub = new SubscriptionClient({ apiKey: 'lt_...' });
 * const status = await sub.getStatus();
 * console.log(status.plan); // 'pro'
 * ```
 */
export class SubscriptionClient extends BaseClient {
    constructor(config: ClientConfig) {
        super(config);
    }

    /** Get current subscription status. */
    async getStatus(): Promise<SubscriptionInfo> {
        return this.request(async () => {
            const res = await this.http.get<SubscriptionInfo>('/subscription/status');
            return res.data;
        });
    }

    /** Check if a specific feature is available on the current plan. */
    async checkFeature(feature: string): Promise<FeatureCheck> {
        return this.request(async () => {
            const res = await this.http.get<FeatureCheck>(`/subscription/check/${feature}`);
            return res.data;
        });
    }

    /** Get usage analytics for the current subscription. */
    async getLimits(): Promise<Record<string, unknown>> {
        return this.request(async () => {
            const res = await this.http.get('/subscription/analytics');
            return res.data;
        });
    }
}
