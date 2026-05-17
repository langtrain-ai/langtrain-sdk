import { BaseClient, ClientConfig } from './base';

// ── Training Methods ────────────────────────────────────────────────────────

export type TrainingMethod =
    | 'sft'       // Supervised Fine-Tuning
    | 'lora'      // LoRA adapter
    | 'qlora'     // Quantized LoRA (NF4 + LoRA)
    | 'dora'      // Weight-Decomposed LoRA
    | 'galore'    // Gradient Low-Rank Projection (full-param, low-memory)
    | 'ia3'       // Infused Adapter by Inhibiting and Amplifying Inner Activations
    | 'prefix'    // Prefix Tuning (virtual tokens)
    | 'dpo'       // Direct Preference Optimization
    | 'orpo'      // Odds Ratio Preference Optimization (reference-free)
    | 'simpo'     // Simple Preference Optimization (length-normalized, reference-free)
    | 'kto'       // Kahneman-Tversky Optimization (binary signal, unpaired data)
    | 'rlhf';     // PPO-based RLHF with reward model

// ── Hyperparameters ─────────────────────────────────────────────────────────

export interface FineTuneHyperparameters {
    // Core training
    n_epochs?: number;
    /** @deprecated Use n_epochs */
    epochs?: number;
    learning_rate?: number;
    batch_size?: number;
    warmup_ratio?: number;
    weight_decay?: number;
    max_seq_length?: number;
    gradient_accumulation_steps?: number;

    // LoRA / DoRA / QLoRA adapter config
    lora_rank?: number;
    lora_alpha?: number;
    lora_dropout?: number;
    /** Enable DoRA (Weight-Decomposed LoRA) — set automatically when method='dora' */
    use_dora?: boolean;

    // GaLore config
    /** Enable GaLore gradient projection — set automatically when method='galore' */
    use_galore?: boolean;
    galore_rank?: number;
    galore_update_proj_gap?: number;
    galore_scale?: number;

    // Prefix Tuning
    num_prefix_tokens?: number;

    // Preference optimization (DPO / ORPO / SimPO / KTO)
    /** KL regularization coefficient (DPO / KTO) or odds-ratio scale (ORPO) */
    beta?: number;
    /** SimPO length-normalized reward margin */
    gamma?: number;
    /** KTO weight for desirable responses */
    desirable_weight?: number;
    /** KTO weight for undesirable responses */
    undesirable_weight?: number;
    max_prompt_length?: number;

    // RLHF (PPO)
    reward_model_id?: string;
    ppo_epochs?: number;
    mini_batch_size?: number;
    kl_coef?: number;
    target_kl?: number;
    max_new_tokens?: number;
    max_ppo_steps?: number;
    vf_coef?: number;
    cliprange?: number;

    // Triton / CUDA kernel flags
    /** Use FlashAttention2 kernel (2-4× faster, O(N·D) memory). Default: true on A10G. */
    use_flash_attention_2?: boolean;
    /** Gradient checkpointing — trades compute for memory. Default: true. */
    use_gradient_checkpointing?: boolean;
    /** DeepSpeed ZeRO stage (0=off, 1, 2, 3). Default: 0. */
    deepspeed_stage?: 0 | 1 | 2 | 3;
    /** FSDP sharding strategy. Default: 'no_shard'. */
    fsdp_shard_strategy?: 'no_shard' | 'shard_grad_op' | 'full_shard' | 'hybrid_shard';

    // NEFTune noise
    use_neftune?: boolean;
    neftune_noise_alpha?: number;

    // HuggingFace Hub upload
    hf_repo_name?: string;
    hf_private?: boolean;
    hf_token?: string;
}

// ── Job Schemas ─────────────────────────────────────────────────────────────

export interface FineTuneJobCreate {
    name?: string;
    base_model: string;
    model_id?: string;
    dataset_id: string;
    guardrail_id?: string;
    task?: 'text' | 'vision';
    training_method?: TrainingMethod;
    hyperparameters?: FineTuneHyperparameters;
    idempotency_key?: string;
}

export interface FineTuneJobMetrics {
    train_loss?: number;
    eval_loss?: number;
    train_runtime?: number;
    train_samples_per_second?: number;
    method?: string;
    huggingface_url?: string;
    [key: string]: unknown;
}

export interface FineTuneJobResponse {
    id: string;
    name?: string;
    status: 'queued' | 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    progress?: number;
    error_message?: string;
    base_model?: string;
    dataset_id?: string;
    training_method?: string;
    metrics?: FineTuneJobMetrics;
    created_at?: string;
    started_at?: string;
    completed_at?: string;
}

export interface FineTuneJobList {
    data: FineTuneJobResponse[];
    has_more: boolean;
    total?: number;
}

// ── Adapter Schemas ─────────────────────────────────────────────────────────

export interface AdapterLoadRequest {
    /** ID of the fine-tuned model/adapter to load onto a deployment */
    adapter_id: string;
    deployment_id: string;
    /** Slot index for multi-adapter serving (default: 0) */
    slot?: number;
}

export interface AdapterLoadResponse {
    success: boolean;
    adapter_id: string;
    deployment_id: string;
    slot: number;
    loaded_at: string;
}

export interface AdapterMergeRequest {
    adapter_id: string;
    /** Output HuggingFace repo name for the merged model */
    output_repo?: string;
    /** Merge method: linear combination, TIES, DARE, or SLERP */
    merge_method?: 'linear' | 'ties' | 'dare' | 'slerp';
    /** Weight for this adapter when merging multiple adapters */
    weight?: number;
}

export interface AdapterMergeResponse {
    success: boolean;
    merged_model_id: string;
    huggingface_url?: string;
    merge_method: string;
}

// ── Training Methods Metadata ───────────────────────────────────────────────

export interface TrainingMethodInfo {
    id: TrainingMethod;
    name: string;
    description: string;
    category: 'sft' | 'adapter' | 'preference' | 'rlhf';
    requires_preference_data: boolean;
    memory_efficiency: 'low' | 'medium' | 'high';
    triton_accelerated: boolean;
}

// ── Telemetry ───────────────────────────────────────────────────────────────

export interface TrainingTelemetryPoint {
    step: number;
    loss?: number;
    learning_rate?: number;
    epoch?: number;
    grad_norm?: number;
    tokens_per_second?: number;
    gpu_memory_mb?: number;
    timestamp: string;
}

// ── TrainingClient ──────────────────────────────────────────────────────────

/**
 * Client for managing fine-tuning training jobs on Langtrain's GPU infrastructure.
 *
 * Supports all 12 training methods including custom Triton kernel acceleration:
 * - SFT, LoRA, QLoRA, DoRA — supervised methods
 * - GaLore, IA³, Prefix Tuning — parameter-efficient variants
 * - DPO, ORPO, SimPO, KTO — preference alignment
 * - RLHF (PPO) — reinforcement learning from human feedback
 *
 * @example
 * ```ts
 * const training = new TrainingClient({ apiKey: 'lt_...' });
 *
 * // QLoRA with FlashAttention2 + custom Triton kernels
 * const job = await training.createJob({
 *     base_model: 'meta-llama/Llama-3.1-8B',
 *     dataset_id: 'ds_abc123',
 *     training_method: 'qlora',
 *     hyperparameters: {
 *         lora_rank: 32,
 *         lora_alpha: 64,
 *         use_flash_attention_2: true,
 *         use_neftune: true,
 *         neftune_noise_alpha: 5.0,
 *         n_epochs: 3,
 *     },
 * });
 *
 * // DPO preference alignment
 * const dpoJob = await training.createJob({
 *     base_model: 'meta-llama/Llama-3.1-8B',
 *     dataset_id: 'ds_pref456',
 *     training_method: 'dpo',
 *     hyperparameters: { beta: 0.1, n_epochs: 1 },
 * });
 *
 * // Stream telemetry while training
 * for await (const point of training.streamTelemetry(job.id)) {
 *     console.log(`step=${point.step}  loss=${point.loss}`);
 * }
 * ```
 */
export class TrainingClient extends BaseClient {
    constructor(config: ClientConfig) {
        super(config);
    }

    /** Create a new fine-tuning job. Idempotent if idempotency_key is set. */
    async createJob(job: FineTuneJobCreate): Promise<FineTuneJobResponse> {
        return this.request(async () => {
            const res = await this.http.post<FineTuneJobResponse>('/finetune/jobs', job);
            return res.data;
        });
    }

    /** List fine-tuning jobs for an organization. */
    async listJobs(params?: {
        organization_id?: string;
        limit?: number;
        offset?: number;
        status?: FineTuneJobResponse['status'];
    }): Promise<FineTuneJobList> {
        return this.request(async () => {
            const res = await this.http.get<FineTuneJobList>('/finetune/jobs', { params });
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

    /** Cancel a running or queued job. */
    async cancelJob(jobId: string): Promise<FineTuneJobResponse> {
        return this.request(async () => {
            const res = await this.http.post<FineTuneJobResponse>(`/finetune/jobs/${jobId}/cancel`);
            return res.data;
        });
    }

    /**
     * Poll a job until it reaches a terminal state (completed / failed / cancelled).
     * Resolves with the final job object.
     *
     * @param jobId - Job ID to watch
     * @param intervalMs - Polling interval in milliseconds (default: 5000)
     * @param timeoutMs - Max wait time in milliseconds (default: 6 hours)
     */
    async waitForJob(
        jobId: string,
        intervalMs = 5_000,
        timeoutMs = 6 * 60 * 60 * 1_000,
    ): Promise<FineTuneJobResponse> {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            const job = await this.getJob(jobId);
            if (['completed', 'failed', 'cancelled'].includes(job.status)) {
                return job;
            }
            await new Promise(r => setTimeout(r, intervalMs));
        }
        throw new Error(`Job ${jobId} did not complete within ${timeoutMs}ms`);
    }

    /**
     * Stream training telemetry (loss, lr, GPU stats) as an async generator.
     * Polls the telemetry endpoint every 10 seconds while the job is running.
     *
     * @example
     * ```ts
     * for await (const point of training.streamTelemetry(jobId)) {
     *     process.stdout.write(`\rstep=${point.step}  loss=${point.loss?.toFixed(4)}`);
     * }
     * ```
     */
    async *streamTelemetry(
        jobId: string,
        intervalMs = 10_000,
    ): AsyncGenerator<TrainingTelemetryPoint> {
        let lastStep = -1;
        while (true) {
            let job: FineTuneJobResponse;
            try {
                job = await this.getJob(jobId);
            } catch {
                break;
            }

            try {
                const res = await this.http.get<TrainingTelemetryPoint[]>(
                    `/finetune/jobs/${jobId}/telemetry`,
                    { params: { after_step: lastStep } },
                );
                for (const point of res.data ?? []) {
                    if (point.step > lastStep) {
                        lastStep = point.step;
                        yield point;
                    }
                }
            } catch {
                // Telemetry endpoint may not be available yet — keep polling
            }

            if (['completed', 'failed', 'cancelled'].includes(job.status)) break;
            await new Promise(r => setTimeout(r, intervalMs));
        }
    }

    /**
     * List all supported training methods and their metadata.
     * Useful for building training method selection UIs.
     */
    async listTrainingMethods(): Promise<TrainingMethodInfo[]> {
        // Return static metadata — no server round-trip needed
        return [
            {
                id: 'sft',
                name: 'Supervised Fine-Tuning',
                description: 'Standard full-dataset instruction tuning using TRL SFTTrainer with LoRA.',
                category: 'sft',
                requires_preference_data: false,
                memory_efficiency: 'medium',
                triton_accelerated: true,
            },
            {
                id: 'lora',
                name: 'LoRA',
                description: 'Low-Rank Adaptation — trains small adapter matrices injected into attention layers.',
                category: 'adapter',
                requires_preference_data: false,
                memory_efficiency: 'high',
                triton_accelerated: true,
            },
            {
                id: 'qlora',
                name: 'QLoRA',
                description: 'Quantized LoRA (NF4 4-bit) — LoRA on a quantized base model for maximum memory savings.',
                category: 'adapter',
                requires_preference_data: false,
                memory_efficiency: 'high',
                triton_accelerated: true,
            },
            {
                id: 'dora',
                name: 'DoRA',
                description: 'Weight-Decomposed LoRA — decomposes weights into magnitude + direction for better adaptation.',
                category: 'adapter',
                requires_preference_data: false,
                memory_efficiency: 'high',
                triton_accelerated: true,
            },
            {
                id: 'galore',
                name: 'GaLore',
                description: 'Gradient Low-Rank Projection — full-parameter training with LoRA-level memory via gradient subspace projection.',
                category: 'adapter',
                requires_preference_data: false,
                memory_efficiency: 'medium',
                triton_accelerated: true,
            },
            {
                id: 'ia3',
                name: 'IA³',
                description: 'Infused Adapter by Inhibiting and Amplifying Inner Activations — ~0.01% trainable params.',
                category: 'adapter',
                requires_preference_data: false,
                memory_efficiency: 'high',
                triton_accelerated: true,
            },
            {
                id: 'prefix',
                name: 'Prefix Tuning',
                description: 'Learns prepended virtual token embeddings per layer. Keeps base model fully frozen.',
                category: 'adapter',
                requires_preference_data: false,
                memory_efficiency: 'high',
                triton_accelerated: false,
            },
            {
                id: 'dpo',
                name: 'DPO',
                description: 'Direct Preference Optimization — aligns to human preferences from ranked response pairs.',
                category: 'preference',
                requires_preference_data: true,
                memory_efficiency: 'medium',
                triton_accelerated: true,
            },
            {
                id: 'orpo',
                name: 'ORPO',
                description: 'Odds Ratio Preference Optimization — reference-model-free, combines SFT + preference in one stage.',
                category: 'preference',
                requires_preference_data: true,
                memory_efficiency: 'high',
                triton_accelerated: true,
            },
            {
                id: 'simpo',
                name: 'SimPO',
                description: 'Simple Preference Optimization — reference-free with length-normalized reward and margin.',
                category: 'preference',
                requires_preference_data: true,
                memory_efficiency: 'high',
                triton_accelerated: true,
            },
            {
                id: 'kto',
                name: 'KTO',
                description: 'Kahneman-Tversky Optimization — aligns from binary good/bad signal; works with unpaired data.',
                category: 'preference',
                requires_preference_data: true,
                memory_efficiency: 'medium',
                triton_accelerated: true,
            },
            {
                id: 'rlhf',
                name: 'RLHF (PPO)',
                description: 'Reinforcement Learning from Human Feedback via Proximal Policy Optimization with a reward model.',
                category: 'rlhf',
                requires_preference_data: false,
                memory_efficiency: 'low',
                triton_accelerated: true,
            },
        ];
    }
}

// ── AdapterClient ───────────────────────────────────────────────────────────

/**
 * Client for loading, unloading, and merging LoRA adapters on live deployments.
 *
 * @example
 * ```ts
 * const adapters = new AdapterClient({ apiKey: 'lt_...' });
 *
 * // Hot-swap an adapter onto a running deployment
 * await adapters.load({ adapter_id: 'model_xyz', deployment_id: 'dep_abc', slot: 0 });
 *
 * // Merge adapter weights into the base model and push to HuggingFace
 * const merged = await adapters.merge({
 *     adapter_id: 'model_xyz',
 *     output_repo: 'my-org/merged-llama',
 *     merge_method: 'ties',
 * });
 * ```
 */
export class AdapterClient extends BaseClient {
    constructor(config: ClientConfig) {
        super(config);
    }

    /**
     * Load a LoRA adapter onto a running deployment.
     * Supports multi-adapter serving via the slot parameter.
     */
    async load(request: AdapterLoadRequest): Promise<AdapterLoadResponse> {
        return this.request(async () => {
            const res = await this.http.post<AdapterLoadResponse>(
                '/finetune/adapters/load',
                request,
            );
            return res.data;
        });
    }

    /**
     * Unload an adapter from a deployment slot, reverting to the base model.
     */
    async unload(deploymentId: string, slot = 0): Promise<{ success: boolean }> {
        return this.request(async () => {
            const res = await this.http.post<{ success: boolean }>(
                '/finetune/adapters/unload',
                { deployment_id: deploymentId, slot },
            );
            return res.data;
        });
    }

    /**
     * Merge adapter weights into the base model.
     * Supports LINEAR, TIES, DARE, and SLERP merge strategies.
     * The merged model is uploaded to HuggingFace Hub.
     */
    async merge(request: AdapterMergeRequest): Promise<AdapterMergeResponse> {
        return this.request(async () => {
            const res = await this.http.post<AdapterMergeResponse>(
                '/finetune/adapters/merge',
                request,
            );
            return res.data;
        });
    }

    /**
     * List all adapters loaded on a deployment.
     */
    async list(deploymentId: string): Promise<AdapterLoadResponse[]> {
        return this.request(async () => {
            const res = await this.http.get<AdapterLoadResponse[]>(
                '/finetune/adapters',
                { params: { deployment_id: deploymentId } },
            );
            return res.data;
        });
    }
}
