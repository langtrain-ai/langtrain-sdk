import { BaseClient, ClientConfig } from './base';

// ── Types ──────────────────────────────────────────────────────────────────

export interface FineTuneHyperparameters {
    epochs?: number;
    learning_rate?: number;
    batch_size?: number;
    warmup_steps?: number;
    lora_rank?: number;
    lora_alpha?: number;
    weight_decay?: number;
}

export interface FineTuneJobCreate {
    name?: string;
    base_model: string;
    model_id?: string;
    dataset_id: string;
    guardrail_id?: string;
    task?: 'text' | 'vision';
    training_method?: 'sft' | 'dpo' | 'rlhf' | 'lora' | 'qlora';
    hyperparameters?: FineTuneHyperparameters;
}

export interface FineTuneJobResponse {
    id: string;
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    progress: number;
    error_message?: string;
    base_model?: string;
    training_method?: string;
    created_at: string;
    started_at?: string;
    completed_at?: string;
}

export interface FineTuneJobList {
    data: FineTuneJobResponse[];
    has_more: boolean;
}

// ── Client ─────────────────────────────────────────────────────────────────

/**
 * Client for managing fine-tuning training jobs.
 *
 * @example
 * ```ts
 * const training = new TrainingClient({ apiKey: 'lt_...' });
 * const job = await training.createJob({
 *     base_model: 'meta-llama/Llama-3.1-8B',
 *     dataset_id: 'file_abc123',
 *     training_method: 'lora',
 * });
 * ```
 */
export class TrainingClient extends BaseClient {
    constructor(config: ClientConfig) {
        super(config);
    }

    /** Create a new fine-tuning job. */
    async createJob(job: FineTuneJobCreate): Promise<FineTuneJobResponse> {
        return this.request(async () => {
            const res = await this.http.post<FineTuneJobResponse>('/finetune/jobs', job);
            return res.data;
        });
    }

    /** List fine-tuning jobs for a workspace. */
    async listJobs(workspaceId: string, limit: number = 10): Promise<FineTuneJobList> {
        return this.request(async () => {
            const res = await this.http.get<FineTuneJobList>('/finetune/jobs', {
                params: { workspace_id: workspaceId, limit },
            });
            return res.data;
        });
    }

    /** Get a specific job by ID. */
    async getJob(jobId: string): Promise<FineTuneJobResponse> {
        return this.request(async () => {
            const res = await this.http.get<FineTuneJobResponse>(`/finetune/jobs/${jobId}`);
            return res.data;
        });
    }

    /** Cancel a running job. */
    async cancelJob(jobId: string): Promise<FineTuneJobResponse> {
        return this.request(async () => {
            const res = await this.http.post<FineTuneJobResponse>(`/finetune/jobs/${jobId}/cancel`);
            return res.data;
        });
    }
}
