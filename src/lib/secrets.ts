import { BaseClient, ClientConfig } from './base';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Secret {
    key: string;
    created_at: string;
    updated_at: string;
}

// ── Client ─────────────────────────────────────────────────────────────────

/**
 * Client for managing workspace secrets and environment variables.
 *
 * @example
 * ```ts
 * const secrets = new SecretClient({ apiKey: 'lt_...' });
 * await secrets.set('OPENAI_KEY', 'sk-...');
 * const all = await secrets.list();
 * ```
 */
export class SecretClient extends BaseClient {
    constructor(config: ClientConfig) {
        super(config);
    }

    /** List all secrets in a workspace. Values are redacted. */
    async list(workspaceId?: string): Promise<Secret[]> {
        return this.request(async () => {
            const params: Record<string, string> = {};
            if (workspaceId) params.workspace_id = workspaceId;
            const res = await this.http.get<{ secrets: Secret[] }>('/secrets', { params });
            return res.data.secrets;
        });
    }

    /** Set (create or update) a secret. */
    async set(key: string, value: string, workspaceId?: string): Promise<Secret> {
        return this.request(async () => {
            const res = await this.http.post<Secret>('/secrets', { key, value, workspace_id: workspaceId });
            return res.data;
        });
    }

    /** Delete a secret by key. */
    async delete(key: string, workspaceId?: string): Promise<void> {
        return this.request(async () => {
            const params: Record<string, string> = {};
            if (workspaceId) params.workspace_id = workspaceId;
            await this.http.delete(`/secrets/${key}`, { params });
        });
    }
}
