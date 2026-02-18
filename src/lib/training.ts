import axios, { AxiosInstance } from 'axios';

export class TrainingClient {
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

    async createJob(job: FineTuneJobCreate): Promise<FineTuneJobResponse> {
        const response = await this.client.post('/finetune/jobs', job);
        return response.data;
    }

    async listJobs(workspaceId: string, limit: number = 10): Promise<FineTuneJobList> {
        const response = await this.client.get('/finetune/jobs', {
            params: { workspace_id: workspaceId, limit }
        });
        return response.data;
    }

    async getJob(jobId: string): Promise<FineTuneJobResponse> {
        const response = await this.client.get(`/finetune/jobs/${jobId}`);
        return response.data;
    }

    async cancelJob(jobId: string): Promise<FineTuneJobResponse> {
        const response = await this.client.post(`/finetune/jobs/${jobId}/cancel`);
        return response.data;
    }
}

export interface FineTuneJobCreate {
    name?: string;
    base_model: string;
    model_id?: string;
    dataset_id: string;
    guardrail_id?: string;
    task?: 'text' | 'vision';
    training_method?: 'sft' | 'dpo' | 'rlhf' | 'lora' | 'qlora';
    hyperparameters?: any;
    [key: string]: any;
}

export interface FineTuneJobResponse {
    id: string;
    name: string;
    status: string;
    progress: number;
    error_message?: string;
    created_at: string;
    [key: string]: any;
}

export interface FineTuneJobList {
    data: FineTuneJobResponse[];
    has_more: boolean;
}
