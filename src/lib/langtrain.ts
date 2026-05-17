import { ClientConfig } from './base';
import { AgentClient } from './agent';
import { FileClient } from './files';
import { AdapterClient, TrainingClient } from './training';
import { ModelClient } from './models';
import { SecretClient } from './secrets';
import { GuardrailClient } from './guardrails';
import { UsageClient } from './usage';
import { KnowledgeClient } from './knowledge';
import { SubscriptionClient } from './subscription';
import { Langvision } from 'langvision';
import { Langtune } from 'langtune';

/**
 * The unified Langtrain SDK client.
 * 
 * Provides access to the entire Langtrain ecosystem via a single configured instance.
 * Automatically loads credentials from `LANGTRAIN_API_KEY` if not provided.
 * 
 * @example
 * ```typescript
 * import { Langtrain } from 'langtrain';
 * 
 * const ai = new Langtrain();
 * 
 * // Create an agent
 * const agent = await ai.agents.create({ name: 'Assistant' });
 * 
 * // Fine-tune a model
 * await ai.training.create({ dataset: 'my-data', model: 'llama-3' });
 * ```
 */
export class Langtrain {
    /** Agent execution and management. */
    public readonly agents: AgentClient;
    /** Dataset and file management. */
    public readonly files: FileClient;
    /** Model fine-tuning jobs. */
    public readonly training: TrainingClient;
    /** LoRA adapter load / unload / merge on live deployments. */
    public readonly adapters: AdapterClient;
    /** Language model connections. */
    public readonly models: ModelClient;
    /** Environment variables and secrets. */
    public readonly secrets: SecretClient;
    /** Output moderation and structure constraints. */
    public readonly guardrails: GuardrailClient;
    /** Account usage metrics. */
    public readonly usage: UsageClient;
    /** Vector knowledge bases. */
    public readonly knowledge: KnowledgeClient;
    /** Billing and subscription data. */
    public readonly subscription: SubscriptionClient;
    
    /** Computer vision and multimodality SDK. */
    public readonly vision: Langvision;
    /** Advanced fine-tuning SDK. */
    public readonly tune: Langtune;

    constructor(config: Partial<ClientConfig> = {}) {
        // Fallback to process.env
        const apiKey = config.apiKey || (typeof process !== 'undefined' ? process.env.LANGTRAIN_API_KEY : '') || '';
        const baseUrl = config.baseUrl || (typeof process !== 'undefined' ? process.env.LANGTRAIN_BASE_URL : undefined);

        if (!apiKey) {
            console.warn(
                '[Langtrain SDK] Warning: No API key provided. ' +
                'Some features will fail. Set LANGTRAIN_API_KEY or pass apiKey to the constructor.'
            );
        }

        const clientConfig: ClientConfig = {
            ...config,
            apiKey,
            baseUrl
        };

        this.agents = new AgentClient(clientConfig);
        this.files = new FileClient(clientConfig);
        this.training = new TrainingClient(clientConfig);
        this.adapters = new AdapterClient(clientConfig);
        this.models = new ModelClient(clientConfig);
        this.secrets = new SecretClient(clientConfig);
        this.guardrails = new GuardrailClient(clientConfig);
        this.usage = new UsageClient(clientConfig);
        this.knowledge = new KnowledgeClient(clientConfig);
        this.subscription = new SubscriptionClient(clientConfig);
        
        // Third-party sub-SDKs
        this.vision = new Langvision({ apiKey });
        this.tune = new Langtune({ apiKey });
    }
}
