import { intro, outro, spinner, green, red, yellow, showSuccess } from '../ui';
import { getConfig } from '../config';
import { AgentClient, AgentCreate } from '../../index';

export async function handleDeploy(client: AgentClient) {
    intro('Deploying configuration to Langtrain Cloud...');

    const config = getConfig();
    const agents = config.agents || [];

    if (agents.length === 0) {
        intro(yellow('No agents found in langtrain.config.json'));
        return;
    }

    // Iterate and deploy
    for (const agentConfig of agents) {
        const s = spinner();
        s.start(`Deploying agent: ${agentConfig.name}...`);

        try {
            // Check if agent exists (by name? logic needed)
            // Ideally we store ID in config after create, but for now let's just create new or try to find by name.
            // Listing all agents is expensive if many, but safe for now.
            const existingAgents = await client.list();
            const existing = existingAgents.find(a => a.name === agentConfig.name);

            if (existing) {
                // Update (Note: SDK didn't expose update in my view_file, assuming create or need to add update)
                // If update not available, we skip or warn.
                // Let's assume we can't update yet as per SDK view.
                // So we just skip if exists.
                s.stop(yellow(`Agent ${agentConfig.name} already exists (ID: ${existing.id}). Skipping update (not supported yet).`));
            } else {
                // Create
                const payload: AgentCreate = {
                    project_id: config.project_id || (existingAgents[0]?.project_id) || '', // Need a way to get project!
                    name: agentConfig.name,
                    description: agentConfig.description,
                    config: agentConfig.config
                };

                // Fallback for project_id
                if (!payload.project_id) {
                    // Try to get from first agent or error
                    // Realistically, user needs to set project_id in config or we infer from API key scope.
                    // Let's warn.
                    s.stop(red(`Failed: Project ID missing in config for ${agentConfig.name}`));
                    continue;
                }

                await client.create(payload);
                s.stop(green(`Agent ${agentConfig.name} deployed successfully!`));
            }

        } catch (e: any) {
            s.stop(red(`Failed to deploy ${agentConfig.name}: ${e.message}`));
        }
    }

    showSuccess('Deployment complete.');
}
