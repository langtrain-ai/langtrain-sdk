import { text, select, confirm, isCancel, cancel, spinner, intro, red, green, yellow, gray, bgCyan, black, gradient } from '../ui';
import { AgentClient, ModelClient } from '../../index';

export async function handleAgentCreate(client: AgentClient, modelClient: ModelClient) {
    const name = await text({
        message: 'Agent Name:',
        placeholder: 'e.g. Support Bot',
        validate(value) {
            if (!value || value.length === 0) return 'API Key is required';
        },
    });
    if (isCancel(name)) {
        cancel('Operation cancelled');
        return;
    }

    const description = await text({
        message: 'Description:',
        placeholder: 'e.g. A helpful support assistant',
    });
    if (isCancel(description)) return;

    const systemPrompt = await text({
        message: 'System Prompt:',
        placeholder: 'e.g. You are a helpful assistant.',
        initialValue: 'You are a helpful assistant.'
    });
    if (isCancel(systemPrompt)) return;

    // Select model
    let model: string | symbol = 'gpt-4o';
    const s = spinner();
    s.start('Fetching agent models...');
    try {
        const models = await modelClient.list('agent');
        s.stop(`Found ${models.length} models`);
        if (models.length > 0) {
            model = await select({
                message: 'Select Agent Model:',
                options: models.map(m => ({ value: m.id, label: m.id }))
            });
        }
    } catch (e) {
        s.stop(yellow('Could not fetch models, using default.'));
    }

    if (isCancel(model)) return;

    const s2 = spinner();
    s2.start('Creating agent...');

    try {
        const agents = await client.list();
        let workspaceId = "";
        if (agents.length > 0) {
            workspaceId = agents[0].workspace_id;
        } else {
            s2.stop(yellow('Workspace ID needed (no existing agents found).'));
            const wid = await text({
                message: 'Enter Workspace ID (UUID):',
                validate(value) {
                    if (!value || value.length === 0) return 'Required';
                },
            });
            if (isCancel(wid)) return;
            workspaceId = wid as string;
            s2.start('Creating agent...');
        }

        const agent = await client.create({
            workspace_id: workspaceId,
            name: name as string,
            description: description as string,
            config: {
                system_prompt: systemPrompt as string,
                model: model as string
            }
        });
        s2.stop(green(`Agent "${agent.name}" created successfully! ID: ${agent.id}`));
    } catch (e: any) {
        s2.stop(red('Failed to create agent.'));
        throw e;
    }
}

export async function handleAgentDelete(client: AgentClient) {
    const s = spinner();
    s.start('Fetching agents...');
    const agents = await client.list();
    s.stop(`Found ${agents.length} agents`);

    if (agents.length === 0) {
        intro(yellow('No agents to delete.'));
        return;
    }

    const agentId = await select({
        message: 'Select an agent to DELETE:',
        options: agents.map(a => ({ value: a.id, label: a.name, hint: a.description || 'No description' }))
    });

    if (isCancel(agentId)) return;

    const confirmDel = await select({
        message: `Are you sure you want to delete this agent?`,
        options: [
            { value: 'yes', label: 'Yes, delete it', hint: 'Cannot be undone' },
            { value: 'no', label: 'No, keep it' }
        ]
    });

    if (confirmDel !== 'yes') {
        intro(gray('Deletion cancelled.'));
        return;
    }

    const d = spinner();
    d.start('Deleting agent...');
    try {
        await client.delete(agentId as string);
        d.stop(green('Agent deleted successfully.'));
    } catch (e: any) {
        d.stop(red('Failed to delete agent.'));
        throw e;
    }
}

export async function handleAgentList(client: AgentClient) {
    const s = spinner();
    s.start('Fetching agents...');
    const agents = await client.list();
    s.stop(`Found ${agents.length} agents`);

    if (agents.length === 0) {
        intro(yellow('No agents found in your workspace.'));
        return;
    }

    const agentId = await select({
        message: 'Select an agent to run:',
        options: agents.map(a => ({ value: a.id, label: a.name, hint: a.description || 'No description' }))
    });

    if (isCancel(agentId)) return;

    await handleAgentRun(client, agentId as string, agents.find(a => a.id === agentId)?.name || 'Agent');
}

export async function handleAgentRun(client: AgentClient, agentId: string, agentName: string) {
    intro(bgCyan(black(` Chatting with ${agentName} `)));
    console.log(gray('Type "exit" to quit conversation.'));

    let conversationId: string | undefined = undefined;

    while (true) {
        const input = await text({
            message: 'You:',
            placeholder: 'Type a message...',
        });

        if (isCancel(input) || input === 'exit') {
            break;
        }

        const s = spinner();
        s.start('Agent is thinking...');
        try {
            const result = await client.execute(agentId, { prompt: input }, [], conversationId);
            s.stop();

            if ((result.output as any)?.response) {
                console.log(gradient.pastel(`Agent: ${(result.output as any).response}`));
            } else {
                console.log(gradient.pastel(`Agent: ${JSON.stringify(result.output)}`));
            }

            conversationId = result.conversation_id;
        } catch (e: any) {
            s.stop(red('Error running agent.'));
            console.error(e);
        }
    }
}
