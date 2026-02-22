import { BaseClient, ClientConfig } from './base';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Permission {
    id: string;
    object: string;
    created: number;
    allow_create_engine: boolean;
    allow_sampling: boolean;
    allow_logprobs: boolean;
    allow_search_indices: boolean;
    allow_view: boolean;
    allow_fine_tuning: boolean;
    organization: string;
    group: string | null;
    is_blocking: boolean;
}

export interface Model {
    id: string;
    object: string;
    created: number;
    owned_by: string;
    permission: Permission[];
    root: string;
    parent: string | null;
    task?: 'text' | 'vision' | 'agent';
}

// ── Client ─────────────────────────────────────────────────────────────────

/**
 * Client for browsing available base models.
 *
 * @example
 * ```ts
 * const models = new ModelClient({ apiKey: 'lt_...' });
 * const all = await models.list();
 * const textModels = await models.list('text');
 * ```
 */
export class ModelClient extends BaseClient {
    constructor(config: ClientConfig) {
        super(config);
    }

    /** List available models, optionally filtered by task type. */
    async list(task?: 'text' | 'vision' | 'agent'): Promise<Model[]> {
        return this.request(async () => {
            const params: Record<string, string> = {};
            if (task) params.task = task;
            const res = await this.http.get<{ data: Model[] }>('/models', { params });
            return res.data.data;
        });
    }

    /** Get a specific model by ID. */
    async get(modelId: string): Promise<Model> {
        return this.request(async () => {
            const res = await this.http.get<Model>(`/models/${modelId}`);
            return res.data;
        });
    }
}
