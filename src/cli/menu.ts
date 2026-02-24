import { SubscriptionInfo } from '../index';

export interface MenuOption {
    value: string;
    label: string;
    hint?: string;
}

export type MenuState = 'main' | 'agents' | 'text' | 'vision' | 'guard' | 'data' | 'knowledge' | 'settings';

export function getMenu(state: MenuState, plan: SubscriptionInfo | null, isAuthenticated: boolean): MenuOption[] {

    // ── Unauthenticated: Claude-style minimal menu ─────────────────────────
    if (!isAuthenticated) {
        return [
            { value: 'login', label: '→ Login', hint: 'Authenticate with your API key' },
            { value: 'docs', label: '  Documentation', hint: 'https://docs.langtrain.xyz' },
            { value: 'exit', label: '  Exit' }
        ];
    }

    // ── Authenticated menus ────────────────────────────────────────────────
    const planLabel = plan?.plan === 'pro' ? 'PRO' : plan?.plan === 'enterprise' ? 'ENTERPRISE' : 'FREE';

    switch (state) {
        case 'main':
            return [
                { value: 'nav-agents', label: '  Agents', hint: 'Manage & deploy AI agents' },
                { value: 'nav-text', label: '  Langtune', hint: 'Text fine-tuning & generation' },
                { value: 'nav-vision', label: '  Langvision', hint: 'Vision fine-tuning & analysis' },
                { value: 'nav-data', label: '  Data & Checkpoints', hint: 'Manage training datasets' },
                { value: 'nav-knowledge', label: '  Intelligence Storage', hint: 'View Cortex knowledge graph' },
                { value: 'nav-guard', label: '  Guardrails', hint: 'Data quality & safety rules' },
                { value: 'init', label: '  Init Project', hint: 'Scaffold new Langtrain app' },
                { value: 'deploy', label: '  Deploy', hint: 'Push to Langtrain Cloud' },
                { value: 'dev', label: '  Dev Server', hint: 'Local watch mode' },
                { value: 'env', label: '  Secrets', hint: 'Manage environment variables' },
                { value: 'logs', label: '  Logs', hint: 'Stream agent logs' },
                { value: 'tokens', label: '  Token Usage', hint: 'View consumption this period' },
                { value: 'telemetry', label: '  Telemetry', hint: 'Session stats & API health' },
                { value: 'doctor', label: '  Doctor', hint: 'Check environment health' },
                { value: 'nav-settings', label: '  Settings', hint: `Plan: ${planLabel}` },
                { value: 'exit', label: '  Exit' }
            ];

        case 'agents':
            return [
                { value: 'agent-list', label: 'List & Run Agents', hint: 'Chat with active agents' },
                { value: 'agent-create', label: 'Create New Agent', hint: 'Deploy a new agent' },
                { value: 'agent-delete', label: 'Delete Agent', hint: 'Remove an agent' },
                { value: 'back', label: '← Back' }
            ];

        case 'text':
            return [
                { value: 'tune-finetune', label: 'Fine-tune Text Model', hint: 'Create custom LLM' },
                { value: 'tune-list', label: 'List Jobs', hint: 'Check training status' },
                { value: 'tune-generate', label: 'Generate Text', hint: 'Test your models' },
                { value: 'back', label: '← Back' }
            ];

        case 'data':
            return [
                { value: 'data-list', label: 'List Datasets', hint: 'View uploaded files' },
                { value: 'data-upload', label: 'Upload Dataset', hint: 'Upload JSONL for training' },
                { value: 'data-refine', label: 'Refine Dataset', hint: 'Apply guardrails to clean data' },
                { value: 'back', label: '← Back' }
            ];

        case 'knowledge':
            return [
                { value: 'knowledge-entities', label: 'Explore Entities', hint: 'View extracted data components' },
                { value: 'back', label: '← Back' }
            ];

        case 'guard':
            return [
                { value: 'guard-list', label: 'List Guardrails', hint: 'View active rules' },
                { value: 'guard-create', label: 'Create Guardrail', hint: 'Define new rules' },
                { value: 'back', label: '← Back' }
            ];

        case 'vision':
            return [
                { value: 'vision-finetune', label: 'Fine-tune Vision Model', hint: 'Create custom VLM' },
                { value: 'vision-generate', label: 'Generate Vision Response', hint: 'Test vision models' },
                { value: 'back', label: '← Back' }
            ];

        case 'settings':
            return [
                { value: 'status', label: `Subscription (${planLabel})`, hint: 'View plan details' },
                { value: 'tokens', label: 'Token Usage', hint: 'View consumption' },
                { value: 'telemetry', label: 'Telemetry', hint: 'Session & API health' },
                { value: 'login', label: 'Update API Key', hint: 'Change credentials' },
                { value: 'logout', label: 'Logout', hint: 'Clear stored credentials' },
                { value: 'back', label: '← Back' }
            ];

        default:
            return [];
    }
}
