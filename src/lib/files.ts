import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import fs from 'fs';

export class FileClient {
    private client: AxiosInstance;

    constructor(config: { apiKey: string, baseUrl?: string }) {
        this.client = axios.create({
            baseURL: config.baseUrl || 'https://api.langtrain.ai/api/v1',
            headers: {
                'X-API-Key': config.apiKey,
            }
        });
    }

    async upload(file: any, workspaceId?: string, purpose: string = 'fine-tune'): Promise<FileResponse> {
        const form = new FormData();
        // Check if file is a path or buffer. Assuming path for CLI
        if (typeof file === 'string') {
            if (!fs.existsSync(file)) throw new Error(`File not found: ${file}`);
            form.append('file', fs.createReadStream(file));
        } else {
            // Handle buffer or other types if needed, but for now strict to path
            throw new Error('File path required');
        }

        if (workspaceId) form.append('workspace_id', workspaceId);
        form.append('purpose', purpose);

        const response = await this.client.post('/files', form, {
            headers: {
                ...form.getHeaders()
            }
        });
        return response.data;
    }

    async list(workspaceId: string, purpose?: string): Promise<FileResponse[]> {
        const params: any = { workspace_id: workspaceId };
        if (purpose) params.purpose = purpose;
        const response = await this.client.get('/files', { params });
        return response.data.data;
    }
}

export interface FileResponse {
    id: string;
    filename: string;
    purpose: string;
    bytes: number;
    created_at: string;
}
