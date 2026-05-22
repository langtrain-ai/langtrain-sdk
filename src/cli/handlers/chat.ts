import * as readline from 'readline';
import axios from 'axios';
import { select, isCancel, cancel, spinner, intro, showError, showInfo, colors } from '../ui';
import { getConfig } from '../config';

const { green, red, yellow, cyan, bold, dim, magenta, gray } = colors;

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export async function handleChatSession(apiKey: string, modelId?: string, baseUrl?: string): Promise<void> {
    const config = getConfig();
    const base = (baseUrl || config.baseUrl || 'https://api.langtrain.xyz').replace(/\/$/, '');
    const key = apiKey || config.apiKey || '';
    const headers = { 'x-api-key': key, 'Content-Type': 'application/json' };

    intro('Chat — Talk to a deployed model');

    // ── Step 1: Model selection ───────────────────────────────────────────
    let targetModelId = modelId;

    if (!targetModelId) {
        const s = spinner();
        s.start('Fetching deployed models...');
        let models: any[] = [];

        try {
            const res = await axios.get(`${base}/api/v1/models?status=ready`, { headers, timeout: 8000 });
            models = res.data?.data || res.data || [];
            s.stop(green(`${models.length} model(s) available`));
        } catch {
            s.stop(yellow('Could not fetch models list'));
        }

        if (models.length === 0) {
            showError('No deployed models found. Deploy a model first using `langtrain train`.');
            return;
        }

        const chosen = await select({
            message: 'Select model to chat with:',
            options: models.map((m: any) => ({
                value: m.id,
                label: m.id,
                hint: m.base_model ? `Base: ${m.base_model}` : m.owned_by
            }))
        });
        if (isCancel(chosen)) { cancel('Cancelled.'); return; }
        targetModelId = chosen as string;
    }

    // ── Show model info ───────────────────────────────────────────────────
    try {
        const res = await axios.get(`${base}/api/v1/models/${targetModelId}`, { headers, timeout: 5000 });
        const m = res.data;
        console.log('\n  ' + bold(magenta('Model Info')));
        console.log(`  ${dim('ID:')}          ${cyan(m.id)}`);
        if (m.base_model) console.log(`  ${dim('Base Model:')}  ${m.base_model}`);
        if (m.created_at) console.log(`  ${dim('Created:')}     ${new Date(m.created_at).toLocaleDateString()}`);
        console.log('');
    } catch { /* skip if not found */ }

    // ── Step 2: Interactive REPL ──────────────────────────────────────────
    const history: Message[] = [];

    console.log(dim('  ─────────────────────────────────────────────────────────────────'));
    console.log(`  ${bold('Chatting with')} ${cyan(targetModelId)}`);
    console.log(dim('  Type "exit" or press Ctrl+C to quit\n'));

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true
    });

    const askQuestion = (prompt: string): Promise<string> =>
        new Promise(resolve => rl.question(prompt, resolve));

    const handleSigint = () => {
        console.log('\n' + dim('\n  Session ended.'));
        rl.close();
        process.exit(0);
    };
    process.on('SIGINT', handleSigint);

    while (true) {
        let userInput: string;
        try {
            userInput = await askQuestion(`  ${bold(green('You'))} > `);
        } catch {
            break;
        }

        if (!userInput.trim()) continue;
        if (userInput.trim().toLowerCase() === 'exit') break;

        history.push({ role: 'user', content: userInput.trim() });

        // ── Stream response ───────────────────────────────────────────────
        process.stdout.write(`\n  ${bold(magenta(targetModelId!))} > `);

        let assistantMsg = '';
        let streamError = false;

        try {
            const res = await axios.post(
                `${base}/api/v1/chat`,
                { model: targetModelId, messages: history, stream: true },
                {
                    headers,
                    responseType: 'stream',
                    timeout: 60000
                }
            );

            await new Promise<void>((resolve, reject) => {
                res.data.on('data', (chunk: Buffer) => {
                    const raw = chunk.toString();
                    const lines = raw.split('\n');
                    for (const line of lines) {
                        if (!line.startsWith('data: ')) continue;
                        const data = line.slice(6).trim();
                        if (data === '[DONE]') { resolve(); return; }
                        try {
                            const parsed = JSON.parse(data);
                            const token = parsed?.choices?.[0]?.delta?.content ||
                                          parsed?.delta?.content ||
                                          parsed?.text || '';
                            if (token) {
                                process.stdout.write(token);
                                assistantMsg += token;
                            }
                        } catch { /* skip malformed chunks */ }
                    }
                });
                res.data.on('end', resolve);
                res.data.on('error', reject);
            });

        } catch (e: any) {
            // Non-streaming fallback
            try {
                const res = await axios.post(
                    `${base}/api/v1/chat`,
                    { model: targetModelId, messages: history, stream: false },
                    { headers, timeout: 60000 }
                );
                const content = res.data?.choices?.[0]?.message?.content ||
                                res.data?.message?.content ||
                                res.data?.response || '';
                process.stdout.write(content);
                assistantMsg = content;
            } catch (e2: any) {
                streamError = true;
                process.stdout.write(red(`\n  [Error: ${e2.message}]`));
            }
        }

        process.stdout.write('\n\n');

        if (!streamError && assistantMsg) {
            history.push({ role: 'assistant', content: assistantMsg });
        }
    }

    process.removeListener('SIGINT', handleSigint);
    rl.close();
    console.log(dim('\n  Session ended. Goodbye!\n'));
}
