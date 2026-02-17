import axios, { AxiosInstance } from 'axios';

export interface Agent {
    id: string;
    workspace_id: string;
    name: string;
    description?: string;
    model_id?: string;
    config: any;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface AgentRun {
    id: string;
    conversation_id: string;
    success: boolean;
    output?: any;
    error?: string;
    latency_ms: number;
    tokens_used: number;
}

export class AgentClient {
    private client: AxiosInstance;

    constructor(private config: { apiKey: string, baseUrl?: string }) {
        this.client = axios.create({
            baseURL: config.baseUrl || 'https://api.langtrain.ai/api/v1',
            headers: {
                'X-API-Key': config.apiKey,
                'Content-Type': 'application/json'
            }
        });
    }

    async list(workspaceId?: string): Promise<Agent[]> {
        const params: any = {};
        if (workspaceId) params.workspace_id = workspaceId;

        const response = await this.client.get<{ agents: Agent[] }>('/agents', { params });
        return response.data.agents;
    }

    async get(agentId: string): Promise<Agent> {
        const response = await this.client.get<Agent>(`/agents/${agentId}`);
        return response.data;
    }

    async create(agent: AgentCreate): Promise<Agent> {
        const response = await this.client.post<Agent>('/agents/', agent);
        return response.data;
    }

    async delete(agentId: string): Promise<void> {
        await this.client.delete(`/agents/${agentId}`);
    }

    async execute(agentId: string, input: any, messages: any[] = [], conversationId?: string): Promise<AgentRun> {
        const response = await this.client.post<AgentRun>(`/agents/${agentId}/execute`, {
            input,
            messages,
            conversation_id: conversationId
        });
        return response.data;
    }
}

export interface AgentConfig {
    system_prompt?: string;
    temperature?: number;
    max_tokens?: number;
    tools?: string[];
    [key: string]: any;
}

export interface AgentCreate {
    workspace_id: string; // UUID
    name: string;
    description?: string;
    model_id?: string; // UUID
    config?: AgentConfig;
}
