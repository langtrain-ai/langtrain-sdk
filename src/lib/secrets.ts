import axios, { AxiosInstance } from 'axios';

export interface Secret {
    key: string;
    created_at: string;
    updated_at: string;
}

export class SecretClient {
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

    async list(workspaceId?: string): Promise<Secret[]> {
        const params: any = {};
        if (workspaceId) params.workspace_id = workspaceId;
        const response = await this.client.get<{ secrets: Secret[] }>('/secrets', { params });
        return response.data.secrets;
    }

    async set(key: string, value: string, workspaceId?: string): Promise<Secret> {
        const response = await this.client.post<Secret>('/secrets', { key, value, workspaceId });
        return response.data;
    }

    async delete(key: string, workspaceId?: string): Promise<void> {
        const params: any = { key };
        if (workspaceId) params.workspace_id = workspaceId;
        await this.client.delete(`/secrets/${key}`, { params });
    }
}
