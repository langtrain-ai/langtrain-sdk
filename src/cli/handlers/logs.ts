import { intro, spinner, red, gray, yellow, bgMagenta, black, green } from '../ui';
import { AgentClient } from '../../index';
import { select, text, isCancel } from '../ui';

export async function handleLogs(client: AgentClient, agentName?: string) {
    const s = spinner();

    let agentId = '';

    if (agentName) {
        s.start('Finding agent...');
        try {
            const agents = await client.list();
            const found = agents.find(a => a.name === agentName || a.id === agentName);
            if (found) agentId = found.id;
            else {
                s.stop(red(`Agent "${agentName}" not found.`));
                return;
            }
            s.stop(green(`Found agent: ${found.name}`));
        } catch (e: any) {
            s.stop(red(`Failed to list agents: ${e.message}`));
            return;
        }
    } else {
        // Interactive select
        s.start('Fetching agents...');
        try {
            const agents = await client.list();
            s.stop(`Found ${agents.length} agents`);

            if (agents.length === 0) {
                console.log(yellow('No agents found.'));
                return;
            }

            const selection = await select({
                message: 'Select agent to view logs:',
                options: agents.map(a => ({ value: a.id, label: a.name }))
            });

            if (isCancel(selection)) return;
            agentId = selection as string;
        } catch (e: any) {
            s.stop(red(`Failed to list agents: ${e.message}`));
            return;
        }
    }

    const s2 = spinner();
    s2.start('Fetching logs...');
    try {
        const logs = await client.logs(agentId); // Assumes we added logs() to AgentClient
        s2.stop('Logs fetched.');

        console.log(gray('------------------------------------------------'));
        console.log(`${bgMagenta(black(' Recent Logs '))}`);
        if (logs.logs && logs.logs.length > 0) {
            logs.logs.forEach(log => console.log(log));
        } else {
            console.log(gray('(No logs found)'));
        }
        console.log(gray('------------------------------------------------'));

    } catch (e: any) {
        s2.stop(red(`Failed to fetch logs: ${e.message}`));
    }
}
