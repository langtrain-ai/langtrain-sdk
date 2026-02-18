import axios, { AxiosInstance } from 'axios';

export interface GuardrailConfig {
    pii_enabled: boolean;
    pii_entities?: string[];
    profanity_enabled: boolean;
    profanity_threshold?: number;
    blocked_topics?: string[];
    regex_patterns?: string[];
    min_length?: number;
    max_length?: number;
}

export interface Guardrail {
    id: string;
    workspace_id: string;
    name: string;
    description?: string;
    config: GuardrailConfig;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface GuardrailCreate {
    name: string;
    description?: string;
    config: GuardrailConfig;
}

export class GuardrailClient {
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

    async list(workspaceId?: string): Promise<Guardrail[]> {
        const params: any = {};
        if (workspaceId) params.workspace_id = workspaceId;
        const response = await this.client.get<Guardrail[]>('/guardrails/', { params });
        return response.data;
    }

    async get(guardrailId: string): Promise<Guardrail> {
        const response = await this.client.get<Guardrail>(`/guardrails/${guardrailId}`);
        return response.data;
    }

    async create(data: GuardrailCreate): Promise<Guardrail> {
        const response = await this.client.post<Guardrail>('/guardrails/', data);
        return response.data;
    }

    async delete(guardrailId: string): Promise<void> {
        await this.client.delete(`/guardrails/${guardrailId}`);
    }

    async apply(datasetId: string, guardrailId: string): Promise<any> {
        const response = await this.client.post('/guardrails/apply', {
            dataset_id: datasetId,
            guardrail_id: guardrailId
        });
        return response.data;
    }
}
