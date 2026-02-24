
// ── Core ───────────────────────────────────────────────────────────────────
export { BaseClient, LangtrainError, ClientConfig } from './lib/base';

// ── Clients ────────────────────────────────────────────────────────────────
export { AgentClient, Agent, AgentRun, AgentCreate, AgentConfig } from './lib/agent';
export { FileClient, FileResponse } from './lib/files';
export { TrainingClient, FineTuneJobCreate, FineTuneJobResponse, FineTuneJobList, FineTuneHyperparameters } from './lib/training';
export { SubscriptionClient, SubscriptionInfo, FeatureCheck } from './lib/subscription';
export { ModelClient, Model, Permission } from './lib/models';
export { SecretClient, Secret } from './lib/secrets';
export { GuardrailClient, Guardrail, GuardrailConfig, GuardrailCreate, GuardrailApplyResult } from './lib/guardrails';
export { UsageClient, UsageSummary, UsageHistoryPoint } from './lib/usage';
export { KnowledgeClient, KnowledgeBaseCreate, KnowledgeBaseResponse, KnowledgeChunk, IngestResponse } from './lib/knowledge';

// ── Third-Party Re-exports ─────────────────────────────────────────────────
export { Langvision } from 'langvision';
export { Langtune } from 'langtune';

// ── Namespaced Re-exports ──────────────────────────────────────────────────
import * as Vision from 'langvision';
import * as Text from 'langtune';
import * as AgentTypes from './lib/agent';
import * as ModelTypes from './lib/models';
import * as SecretTypes from './lib/secrets';

export { Vision, Text, AgentTypes, ModelTypes, SecretTypes };
