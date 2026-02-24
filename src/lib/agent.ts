import { BaseClient, ClientConfig } from './base';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Agent {
    id: string;
    project_id: string;
    name: string;
    description?: string;
    model_id?: string;
    config: AgentConfig;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface AgentConfig {
    system_prompt?: string;
    temperature?: number;
    max_tokens?: number;
    tools?: string[];
    [key: string]: unknown;
}

export interface AgentCreate {
    project_id: string;
    name: string;
    description?: string;
    model_id?: string;
    config?: AgentConfig;
}

export interface AgentRun {
    id: string;
    conversation_id: string;
    success: boolean;
    output?: unknown;
    error?: string;
    latency_ms: number;
    tokens_used: number;
}

// ── Client ─────────────────────────────────────────────────────────────────

/**
 * Client for managing AI agents — create, execute, and monitor.
 *
 * @example
 * ```ts
 * const agents = new AgentClient({ apiKey: 'lt_...' });
 * const list = await agents.list();
 * const result = await agents.execute(list[0].id, 'Hello!');
 * ```
 */
export class AgentClient extends BaseClient {
    constructor(config: ClientConfig) {
        super(config);
    }

    /** List all agents, optionally filtered by workspace. */
    async list(projectId?: string): Promise<Agent[]> {
        return this.request(async () => {
            const params: Record<string, string> = {};
            if (projectId) params.project_id = projectId;
            const res = await this.http.get<{ agents: Agent[] }>('/agents', { params });
            return res.data.agents;
        });
    }

    /** Get a single agent by ID. */
    async get(agentId: string): Promise<Agent> {
        return this.request(async () => {
            const res = await this.http.get<Agent>(`/agents/${agentId}`);
            return res.data;
        });
    }

    /** Create a new agent. */
    async create(agent: AgentCreate): Promise<Agent> {
        return this.request(async () => {
            const res = await this.http.post<Agent>('/agents/', agent);
            return res.data;
        });
    }

    /** Delete an agent by ID. */
    async delete(agentId: string): Promise<void> {
        return this.request(async () => {
            await this.http.delete(`/agents/${agentId}`);
        });
    }

    /** Execute an agent with input and optional conversation context. */
    async execute(agentId: string, input: string, messages: Array<{ role: string; content: string }> = [], conversationId?: string): Promise<AgentRun> {
        return this.request(async () => {
            const res = await this.http.post<AgentRun>(`/agents/${agentId}/execute`, {
                input,
                messages,
                conversation_id: conversationId,
            });
            return res.data;
        });
    }

    /** Fetch recent logs for an agent. */
    async logs(agentId: string, limit: number = 100): Promise<string[]> {
        return this.request(async () => {
            const res = await this.http.get<{ logs: string[] }>(`/agents/${agentId}/logs`, {
                params: { limit },
            });
            return res.data.logs;
        });
    }
}
