import { BaseClient, ClientConfig } from './base';
import FormData from 'form-data';
import fs from 'fs';

// ── Types ──────────────────────────────────────────────────────────────────

export interface FileResponse {
    id: string;
    filename: string;
    purpose: string;
    bytes: number;
    created_at: string;
}

// ── Client ─────────────────────────────────────────────────────────────────

/**
 * Client for managing file uploads (datasets for fine-tuning).
 *
 * @example
 * ```ts
 * const files = new FileClient({ apiKey: 'lt_...' });
 * const uploaded = await files.upload('./data.jsonl');
 * ```
 */
export class FileClient extends BaseClient {
    constructor(config: ClientConfig) {
        super(config);
    }

    /** Upload a file from a local path. */
    async upload(filePath: string, workspaceId?: string, purpose: string = 'fine-tune'): Promise<FileResponse> {
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }

        return this.request(async () => {
            const form = new FormData();
            form.append('file', fs.createReadStream(filePath));
            if (workspaceId) form.append('workspace_id', workspaceId);
            form.append('purpose', purpose);

            const res = await this.http.post<FileResponse>('/files', form, {
                headers: form.getHeaders(),
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
            });
            return res.data;
        });
    }

    /** List files in a workspace, optionally filtered by purpose. */
    async list(workspaceId: string, purpose?: string): Promise<FileResponse[]> {
        return this.request(async () => {
            const params: Record<string, string> = { workspace_id: workspaceId };
            if (purpose) params.purpose = purpose;
            const res = await this.http.get<{ data: FileResponse[] }>('/files', { params });
            return res.data.data;
        });
    }

    /** Delete a file by ID. */
    async delete(fileId: string): Promise<void> {
        return this.request(async () => {
            await this.http.delete(`/files/${fileId}`);
        });
    }
}
