import { text, select, confirm, isCancel, cancel, spinner, intro, red, green, yellow, gray, createTable } from '../ui';
import { getConfig } from '../config';
import { FileClient, AgentClient, GuardrailClient } from '../../index';
import { handleAgentRun } from './agent';
import fs from 'fs';

export async function handleDataUpload(client: FileClient) {
    const config = getConfig();
    let projectId = config.project_id;

    if (!projectId) {
        projectId = await text({
            message: 'Enter Project ID (leave blank for default):',
            initialValue: ''
        });
        if (isCancel(projectId)) return;
    }

    const filePath = await text({
        message: 'Path to file:',
        placeholder: './dataset.jsonl',
        validate(value) {
            if (!value) return 'Required';
            if (!fs.existsSync(value)) return 'File not found';
        }
    });

    if (isCancel(filePath)) return;

    const purpose = await select({
        message: 'File Purpose:',
        options: [
            { value: 'fine-tune', label: 'Fine-tuning (JSONL)' },
            { value: 'vision-tune', label: 'Vision Tuning (Image/Zip)' },
            { value: 'agent-knowledge', label: 'Agent Knowledge' }
        ]
    });

    if (isCancel(purpose)) return;

    const s = spinner();
    s.start('Uploading file...');

    try {
        const result = await client.upload(filePath as string, projectId, purpose as string);
        s.stop(green('File uploaded successfully!'));
        console.log(gray(`ID: ${result.id}`));
        console.log(gray(`Name: ${result.filename}`));
        console.log(gray(`Bytes: ${result.bytes}`));
    } catch (e: any) {
        s.stop(red(`Upload failed: ${e.message}`));
    }
}

export async function handleDataList(client: FileClient) {
    const config = getConfig();
    let projectId = config.project_id;

    if (!projectId) {
        projectId = await text({ message: 'Enter Project ID (leave blank for default):', initialValue: '' });
        if (isCancel(projectId)) return;
    }

    const s = spinner();
    s.start('Fetching files...');

    try {
        const files = await client.list(projectId as string);
        s.stop(`Found ${files.length} files`);

        if (files.length === 0) {
            console.log(yellow('No files found.'));
            return;
        }

        const table = createTable(['ID', 'Filename', 'Size', 'Purpose', 'Created']);
        files.forEach((f: any) => {
            table.push([
                f.id.substring(0, 8) + '...',
                f.filename,
                formatBytes(f.bytes),
                f.purpose || 'N/A',
                new Date(f.created_at || Date.now()).toLocaleDateString()
            ]);
        });
        console.log(table.toString());
        console.log('');

        const file = await select({
            message: 'Select file to analyze (or cancel to exit):',
            options: files.map(f => ({ value: f.id, label: `${f.filename} (${formatBytes(f.bytes)})` }))
        });

        if (isCancel(file)) return;

        await handleDataAnalyze(client, file as string);

    } catch (e: any) {
        s.stop(red(`Failed to list files: ${e.message}`));
    }
}

export async function handleDataAnalyze(client: FileClient, fileId: string) {
    const config = getConfig();
    const s2 = spinner();
    s2.start('Connecting to Data Analyst...');

    try {
        const agentClient = new AgentClient({ apiKey: config.apiKey || '', baseUrl: config.baseUrl });
        const agents = await agentClient.list();
        // Check name (name is optional in type but we know it exists for system agent)
        let analyst = agents.find(a => a.name && a.name === "Langtrain Data Analyst");

        if (!analyst) {
            s2.stop(yellow('Data Analyst agent (System) not found. Please contact admin to provision it.'));
            return;
        }

        s2.stop(green('Connected to Data Analyst.'));

        console.log(gray(`\nAnalyzing dataset ${fileId}...\n`));

        await handleAgentRun(agentClient, analyst.id, analyst.name, `Please analyze the dataset with ID: ${fileId}`);

    } catch (e: any) {
        s2.stop(red(`Failed to connect: ${e.message}`));
    }
}

export async function handleDataRefine(client: FileClient, fileId?: string) {
    const config = getConfig();
    const gClient = new GuardrailClient({ apiKey: config.apiKey || '', baseUrl: config.baseUrl });

    // 0. Select File if not provided
    if (!fileId) {
        const s = spinner();
        s.start('Fetching files...');
        try {
            // Need project ID logic similar to List?
            // client.list takes projectId.
            const wId = config.project_id || '';
            const files = await client.list(wId);
            s.stop(`Found ${files.length} files`);

            if (files.length === 0) {
                console.log(yellow('No files found. Upload one first.'));
                return;
            }

            const selection = await select({
                message: 'Select file to refine:',
                options: files.map(f => ({ value: f.id, label: `${f.filename} (${formatBytes(f.bytes)})` }))
            });

            if (isCancel(selection)) return;
            fileId = selection as string;

        } catch (e: any) {
            s.stop(red(`Failed to fetch files: ${e.message}`));
            return;
        }
    }

    // 1. Select Guardrail
    const s = spinner();
    s.start('Fetching guardrails...');
    let guardId = "";
    try {
        const guards = await gClient.list();
        s.stop(`Found ${guards.length} guardrails`);

        if (guards.length === 0) {
            console.log(yellow('No guardrails found. Please create one first using "lt guardrails create".'));
            return;
        }

        const selection = await select({
            message: 'Select a Guardrail to apply:',
            options: guards.map((g: any) => ({
                value: g.id,
                label: g.name,
                hint: g.description
            }))
        });

        if (isCancel(selection)) return;
        guardId = selection as string;

    } catch (e: any) {
        s.stop(red(`Failed to fetch guardrails: ${e.message}`));
        return;
    }

    // 2. Apply
    const s2 = spinner();
    s2.start('Applying guardrail (filtering dataset)...');

    try {
        const result = await gClient.apply(fileId, guardId);
        s2.stop(green('Dataset evaluated against guardrails.'));

        console.log(gray('Stats:'));
        console.log(`Total Rows: ${result.total_rows}`);
        console.log(green(`Passed: ${result.passed}`));
        console.log(red(`Failed: ${result.failed} rows`));
        if (result.violations?.length > 0) {
            console.log(yellow(`Found ${result.violations.length} violations.`));
        }

    } catch (e: any) {
        s2.stop(red(`Failed to refine dataset: ${e.message}`));
    }
}

function formatBytes(bytes: number, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
