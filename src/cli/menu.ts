import { SubscriptionInfo } from '../index';

export interface MenuOption {
    value: string;
    label: string;
    hint?: string;
}

export type MenuState = 'main' | 'agents' | 'text' | 'vision' | 'settings';

export function getMenu(state: MenuState, plan: SubscriptionInfo | null): MenuOption[] {
    const isPro = plan?.plan === 'pro' || plan?.plan === 'enterprise';

    switch (state) {
        case 'main':
            return [
                { value: 'nav-agents', label: 'Agents', hint: 'Manage & Chat with AI Agents' },
                { value: 'nav-text', label: 'Langtune (Text)', hint: 'Fine-tuning & Generation' },
                { value: 'nav-vision', label: 'Langvision (Vision)', hint: 'Vision Analysis & Tuning' },
                { value: 'nav-settings', label: 'Settings', hint: 'Subscription & Auth' },
                { value: 'exit', label: 'Exit' }
            ];

        case 'agents':
            return [
                { value: 'agent-list', label: 'List & Run Agents', hint: 'View active agents' },
                { value: 'agent-create', label: 'Create New Agent', hint: 'Deploy a new agent' },
                { value: 'agent-delete', label: 'Delete Agent', hint: 'Remove an agent' },
                { value: 'back', label: '← Back to Main Menu' }
            ];

        case 'text':
            return [
                { value: 'tune-finetune', label: 'Fine-tune Text Model', hint: 'Create custom LLM' },
                { value: 'tune-generate', label: 'Generate Text', hint: 'Test your models' },
                { value: 'back', label: '← Back to Main Menu' }
            ];

        case 'vision':
            return [
                { value: 'vision-finetune', label: 'Fine-tune Vision Model', hint: 'Create custom VLM' },
                { value: 'vision-generate', label: 'Generate Vision Response', hint: 'Test vision models' },
                { value: 'back', label: '← Back to Main Menu' }
            ];

        case 'settings':
            return [
                { value: 'status', label: 'Check Subscription Status' },
                { value: 'login', label: 'Update API Key' },
                { value: 'back', label: '← Back to Main Menu' }
            ];

        default:
            return [];
    }
}
