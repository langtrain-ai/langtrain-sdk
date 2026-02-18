import { SubscriptionInfo } from '../index';

export interface MenuOption {
    value: string;
    label: string;
    hint?: string;
}

export type MenuState = 'main' | 'agents' | 'text' | 'vision' | 'settings';

export function getMenu(state: MenuState, plan: SubscriptionInfo | null, isAuthenticated: boolean): MenuOption[] {
    const isPro = plan?.plan === 'pro' || plan?.plan === 'enterprise';

    // If not authenticated, force login or limited menu?
    // User requested "lazy auth", so we should show menu but maybe highlight login or allow navigation and prompt later.
    // Let's add a visual cue.

    switch (state) {
        case 'main':
            const menu: MenuOption[] = [
                { value: 'nav-agents', label: 'Agents', hint: 'Manage & Chat with AI Agents' },
                { value: 'nav-text', label: 'Langtune (Text)', hint: 'Fine-tuning & Generation' },
                { value: 'nav-vision', label: 'Langvision (Vision)', hint: 'Vision Analysis & Tuning' },
                { value: 'init', label: 'Initialize Project', hint: 'Scaffold new Langtrain app' },
                { value: 'deploy', label: 'Deploy', hint: 'Push config to Cloud' },
                { value: 'dev', label: 'Start Dev Server', hint: 'Watch mode' },
                { value: 'doctor', label: 'Doctor', hint: 'Check environment health' },
                { value: 'nav-settings', label: 'Settings', hint: 'Subscription & Auth' }
            ];

            if (!isAuthenticated) {
                // menu.unshift({ value: 'login', label: 'Login to Langtrain', hint: 'Required for most features' });
                // Actually, let's make Login the first option if not authenticated
                // But keep the others so user can see what's available (and get prompted)
                menu.unshift({ value: 'login', label: 'Login to Langtrain', hint: 'Required for most features' });
            }

            // Always add Exit
            menu.push({ value: 'exit', label: 'Exit' });
            return menu;

        case 'agents':
            return [
                { value: 'agent-list', label: 'List & Run Agents', hint: 'Chat with active agents' },
                { value: 'agent-create', label: 'Create New Agent', hint: 'Deploy a new agent' },
                { value: 'agent-delete', label: 'Delete Agent', hint: 'Remove an agent' },
                { value: 'back', label: '← Back to Main Menu' }
            ];

        case 'text':
            return [
                { value: 'tune-finetune', label: 'Fine-tune Text Model', hint: 'Create custom LLM' },
                { value: 'tune-list', label: 'List Jobs', hint: 'Check training status' },
                { value: 'tune-generate', label: 'Generate Text', hint: 'Test your models' },
                { value: 'data-upload', label: 'Upload Dataset', hint: 'Upload JSONL for training' },
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
                { value: 'status', label: isAuthenticated ? `Subscription Status (${plan?.plan || 'Free'})` : 'Check Status (Login required)' },
                { value: 'login', label: isAuthenticated ? 'Update API Key' : 'Login' },
                { value: 'back', label: '← Back to Main Menu' }
            ];

        default:
            return [];
    }
}
