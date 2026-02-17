import axios, { AxiosInstance } from 'axios';

export interface Model {
    id: string;
    object: string; // 'model'
    created: number;
    owned_by: string;
    permission: any[];
    root: string;
    parent: string | null;
    task?: 'text' | 'vision' | 'agent';
}

export class ModelClient {
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

    async list(task?: string): Promise<Model[]> {
        const params: any = {};
        if (task) params.task = task;

        try {
            const response = await this.client.get<{ data: Model[] }>('/models', { params });
            return response.data.data;
        } catch (error) {
            // Fallback if endpoint doesn't support filtering or fails
            // Verify if /models exists, otherwise return empty or throw
            // customized error handling could go here
            throw error;
        }
    }

    async get(modelId: string): Promise<Model> {
        const response = await this.client.get<Model>(`/models/${modelId}`);
        return response.data;
    }
}
