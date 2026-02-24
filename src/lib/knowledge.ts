import { BaseClient, ClientConfig } from './base';

// ── Types ──────────────────────────────────────────────────────────────────

export interface KnowledgeBaseCreate {
    project_id: string;
    name: string;
    description?: string;
    model_id?: string;
    type?: string;
    embedding_model?: string;
    config?: Record<string, any>;
}

export interface KnowledgeBaseResponse {
    id: string;
    project_id: string;
    name: string;
    description?: string;
    model_id?: string;
    type: string;
    embedding_model: string;
    chunk_count: number;
    total_tokens: number;
    status: string;
    created_at: string;
}

export interface KnowledgeChunk {
    id: string;
    knowledge_base_id: string;
    content: string;
    source_type: string;
    source_url?: string;
    source_file?: string;
    token_count: number;
    chunk_index: number;
    created_at: string;
}

export interface IngestResponse {
    success: boolean;
    chunks_created: number;
    tokens_processed: number;
    message?: string;
    error?: string;
}

export interface CortexEntity {
    id: string;
    dataset_id: string;
    type: string;
    value: string;
    confidence: number;
}

// ── Client ─────────────────────────────────────────────────────────────────

/**
 * Client for managing Knowledge Bases and Retrieval-Augmented Generation (RAG).
 *
 * @example
 * ```ts
 * const knowledge = new KnowledgeClient({ apiKey: 'lt_...' });
 * const kb = await knowledge.create({
 *     project_id: 'ws_123',
 *     name: 'Company Documentation',
 * });
 * 
 * await knowledge.ingestText(kb.id, 'Langtrain is an AI infrastructure company.');
 * const results = await knowledge.search(kb.id, 'What does Langtrain do?');
 * ```
 */
export class KnowledgeClient extends BaseClient {
    constructor(config: ClientConfig) {
        super(config);
    }

    /** Create a new Knowledge Base. */
    async create(kb: KnowledgeBaseCreate): Promise<KnowledgeBaseResponse> {
        return this.request(async () => {
            const res = await this.http.post<KnowledgeBaseResponse>('/knowledge/', kb);
            return res.data;
        });
    }

    /** List Knowledge Bases for a workspace. */
    async list(projectId: string): Promise<KnowledgeBaseResponse[]> {
        return this.request(async () => {
            const res = await this.http.get<KnowledgeBaseResponse[]>('/knowledge/', {
                params: { project_id: projectId },
            });
            return res.data;
        });
    }

    /** Ingest raw text into the Knowledge Base. */
    async ingestText(kbId: string, text: string, sourceType: string = 'manual'): Promise<IngestResponse> {
        return this.request(async () => {
            const res = await this.http.post<IngestResponse>(`/knowledge/${kbId}/ingest/text`, {
                text,
                source_type: sourceType,
            });
            return res.data;
        });
    }

    /** Ingest a URL via web scraping into the Knowledge Base. */
    async ingestUrl(kbId: string, url: string): Promise<IngestResponse> {
        return this.request(async () => {
            const res = await this.http.post<IngestResponse>(`/knowledge/${kbId}/ingest/url`, { url });
            return res.data;
        });
    }

    /** Search the Knowledge Base for relevant chunks. */
    async search(kbId: string, query: string, topK: number = 5): Promise<KnowledgeChunk[]> {
        return this.request(async () => {
            const res = await this.http.post<KnowledgeChunk[]>(`/knowledge/${kbId}/search`, {
                query,
                top_k: topK,
            });
            return res.data;
        });
    }

    /** Delete a Knowledge Base and all its chunks. */
    async delete(kbId: string): Promise<void> {
        return this.request(async () => {
            await this.http.delete(`/knowledge/${kbId}`);
        });
    }

    /** Get all extracted Knowledge Entities for Cortex Data Plane. */
    async listEntities(datasetId?: string): Promise<CortexEntity[]> {
        return this.request(async () => {
            const res = await this.http.get<CortexEntity[]>('/knowledge/entities', {
                params: datasetId ? { dataset_id: datasetId } : undefined,
            });
            return res.data;
        });
    }
}
