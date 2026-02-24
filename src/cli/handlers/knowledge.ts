import { intro, outro, spinner } from '@clack/prompts';
import { KnowledgeClient } from '../../lib/knowledge';

export async function handleKnowledgeEntities(client: KnowledgeClient) {
    intro('🌍 Cortex Intelligence Explorer');
    const s = spinner();
    s.start('Fetching extracted entities from the Data Plane...');
    try {
        const entities = await client.listEntities();
        s.stop('Entities retrieved.');

        if (entities.length === 0) {
            console.log('\nNo intelligence extracted yet. Upload a dataset to begin processing.');
            outro('Done');
            return;
        }

        console.log('\nTop Extracted Data Nodes:');
        console.table(entities.slice(0, 15).map(e => ({
            Type: e.type,
            Value: e.value,
            Confidence: `${(e.confidence * 100).toFixed(1)}%`
        })));
        outro('Knowledge map loaded successfully.');
    } catch (e: any) {
        s.stop('Failed to retrieve knowledge.');
        console.error(e.message);
        outro('Error.');
    }
}
