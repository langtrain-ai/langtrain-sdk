import { BaseClient, ClientConfig } from './base';

// ── Types ──────────────────────────────────────────────────────────────────

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

export interface GuardrailApplyResult {
    total_rows: number;
    passed: number;
    failed: number;
    violations: Array<{ row: number; rule: string; message: string }>;
}

// ── Client ─────────────────────────────────────────────────────────────────

/**
 * Client for managing data guardrails (PII, profanity, length, regex).
 *
 * @example
 * ```ts
 * const guardrails = new GuardrailClient({ apiKey: 'lt_...' });
 * const rule = await guardrails.create({
 *     name: 'PII Filter',
 *     config: { pii_enabled: true, profanity_enabled: false },
 * });
 * ```
 */
export class GuardrailClient extends BaseClient {
    constructor(config: ClientConfig) {
        super(config);
    }

    /** List guardrails, optionally filtered by workspace. */
    async list(workspaceId?: string): Promise<Guardrail[]> {
        return this.request(async () => {
            const params: Record<string, string> = {};
            if (workspaceId) params.workspace_id = workspaceId;
            const res = await this.http.get<Guardrail[]>('/guardrails/', { params });
            return res.data;
        });
    }

    /** Get a guardrail by ID. */
    async get(guardrailId: string): Promise<Guardrail> {
        return this.request(async () => {
            const res = await this.http.get<Guardrail>(`/guardrails/${guardrailId}`);
            return res.data;
        });
    }

    /** Create a new guardrail. */
    async create(data: GuardrailCreate): Promise<Guardrail> {
        return this.request(async () => {
            const res = await this.http.post<Guardrail>('/guardrails/', data);
            return res.data;
        });
    }

    /** Delete a guardrail by ID. */
    async delete(guardrailId: string): Promise<void> {
        return this.request(async () => {
            await this.http.delete(`/guardrails/${guardrailId}`);
        });
    }

    /** Apply a guardrail to a dataset for validation. */
    async apply(datasetId: string, guardrailId: string): Promise<GuardrailApplyResult> {
        return this.request(async () => {
            const res = await this.http.post<GuardrailApplyResult>('/guardrails/apply', {
                dataset_id: datasetId,
                guardrail_id: guardrailId,
            });
            return res.data;
        });
    }
}
