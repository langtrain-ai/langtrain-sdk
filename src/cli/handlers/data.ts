import { text, select, confirm, isCancel, cancel, spinner, intro, red, green, yellow, gray } from '../ui';
import { getConfig } from '../config';
import { FileClient } from '../../index';
import path from 'path';
import fs from 'fs';

export async function handleDataUpload(client: FileClient) {
    const config = getConfig();
    let workspaceId = config.workspace_id;

    if (!workspaceId) {
        // Optional: ask for workspace ID or try to infer? 
        // For upload, workspace_id is often optional (inferred from API key's default workspace)
        // But let's ask if user wants to specify.
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
        const result = await client.upload(filePath as string, workspaceId, purpose as string);
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
    let workspaceId = config.workspace_id;

    if (!workspaceId) {
        // Try without workspace ID (some APIs return user's files)
        // or ask
        workspaceId = await text({ message: 'Enter Workspace ID (optional):', initialValue: '' });
        if (isCancel(workspaceId)) return;
    }

    const s = spinner();
    s.start('Fetching files...');

    try {
        const files = await client.list(workspaceId as string);
        s.stop(`Found ${files.length} files`);

        if (files.length === 0) {
            console.log(yellow('No files found.'));
            return;
        }

        // Just list them for now, maybe select to delete later?
        files.forEach(f => {
            console.log(`${f.id.padEnd(30)} ${f.filename.padEnd(20)} ${f.purpose} (${f.bytes}b)`);
        });

    } catch (e: any) {
        s.stop(red(`Failed to list files: ${e.message}`));
    }
}
