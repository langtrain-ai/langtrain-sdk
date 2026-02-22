import axios, { AxiosInstance } from 'axios';

export class SubscriptionClient {
    private client: AxiosInstance;

    constructor(config: { apiKey: string, baseUrl?: string }) {
        this.client = axios.create({
            baseURL: config.baseUrl || 'https://api.langtrain.ai/api/v1',
            headers: {
                'X-API-Key': config.apiKey,
                'Content-Type': 'application/json'
            }
        });
    }

    async getStatus(): Promise<SubscriptionInfo> {
        const response = await this.client.get('/subscription/status');
        return response.data;
    }

    async checkFeature(feature: string): Promise<FeatureCheck> {
        const response = await this.client.get(`/subscription/check/${feature}`);
        return response.data;
    }

    async getLimits(): Promise<any> {
        const response = await this.client.get('/subscription/analytics');
        return response.data;
    }
}

export interface SubscriptionInfo {
    is_active: boolean;
    plan: string;
    plan_name: string;
    expires_at?: string;
    features: string[];
    limits: any;
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
