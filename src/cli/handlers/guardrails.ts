import { text, select, confirm, isCancel, cancel, spinner, intro, red, green, yellow, gray } from '../ui';
import { getConfig } from '../config';
import { GuardrailClient } from '../../index';

export async function handleGuardrailList(client: any) { // using any to match index signature, but we instantiate specific client inside
    const config = getConfig();
    const gClient = new GuardrailClient({ apiKey: config.apiKey || '', baseUrl: config.baseUrl });

    const s = spinner();
    s.start('Fetching guardrails...');

    try {
        const guards = await gClient.list();
        s.stop(`Found ${guards.length} guardrails`);

        if (guards.length === 0) {
            console.log(yellow('No guardrails found. Create one with "lt guardrails create".'));
            return;
        }

        guards.forEach((g: any) => {
            console.log(green(`• ${g.name}`) + gray(` (ID: ${g.id})`));
            if (g.description) console.log(gray(`  ${g.description}`));
            console.log(gray(`  Config: PII=${g.config.pii_enabled}, MinLen=${g.config.min_length}`));
            console.log('');
        });

    } catch (e: any) {
        s.stop(red(`Failed to list guardrails: ${e.message}`));
    }
}

export async function handleGuardrailCreate(client: any) {
    const config = getConfig();
    const gClient = new GuardrailClient({ apiKey: config.apiKey || '', baseUrl: config.baseUrl });

    intro('Create a new Data Guardrail');

    const name = await text({
        message: 'Guardrail Name:',
        placeholder: 'e.g. Strict Safety Policy',
        validate(value) {
            if (!value) return 'Name is required';
        }
    });
    if (isCancel(name)) return;

    const description = await text({
        message: 'Description (optional):',
        placeholder: 'Filters PII and short text',
    });
    if (isCancel(description)) return;

    // Interactive Config
    const minLen = await text({
        message: 'Minimum Text Length (0 for no limit):',
        initialValue: '0',
        validate(value) {
            if (isNaN(Number(value))) return 'Must be a number';
        }
    });
    if (isCancel(minLen)) return;

    const enablePii = await confirm({
        message: 'Enable PII Filtering (Email/Phone)?',
        initialValue: false
    });
    if (isCancel(enablePii)) return;

    const patterns = await text({
        message: 'Regex Patterns to Block (comma separated, optional):',
        placeholder: 'e.g. bad_word, another_one',
    });
    if (isCancel(patterns)) return;

    const s = spinner();
    s.start('Creating guardrail...');

    try {
        const regexList = (patterns as string).split(',').map(p => p.trim()).filter(p => p.length > 0);

        const payload = {
            name,
            description,
            config: {
                min_length: Number(minLen),
                pii_enabled: enablePii,
                regex_patterns: regexList,
                profanity_enabled: false
            }
        };

        const result = await gClient.create(payload);
        s.stop(green(`Guardrail "${result.name}" created successfully!`));
        console.log(gray(`ID: ${result.id}`));

    } catch (e: any) {
        s.stop(red(`Failed to create guardrail: ${e.message}`));
    }
}
