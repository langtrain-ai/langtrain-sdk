import { spinner, intro, red, green, gray, bgCyan } from '../ui';
import { getConfig } from '../config';
import { SubscriptionClient } from '../../index';

export async function handleSubscriptionStatus() {
    const config = getConfig();
    if (!config.apiKey) {
        intro(red('Not logged in. Run "login" first.'));
        return;
    }
    const client = new SubscriptionClient({ apiKey: config.apiKey });
    const s = spinner();
    s.start('Fetching subscription status...');
    try {
        const info = await client.getStatus();
        s.stop(green('Subscription Status:'));

        console.log(gray('Plan: ') + (info.plan === 'pro' ? bgCyan(' PRO ') : info.plan.toUpperCase()));
        console.log(gray('Active: ') + (info.is_active ? green('Yes') : red('No')));
        if (info.expires_at) console.log(gray('Expires: ') + new Date(info.expires_at).toLocaleDateString());

        console.log(gray('\nLimits:'));
        console.log(`  Models: ${info.limits.max_models === -1 ? 'Unlimited' : info.limits.max_models}`);
        console.log(`  Training Jobs: ${info.limits.max_training_jobs}`);

    } catch (e: any) {
        s.stop(red('Failed to fetch status.'));
        console.error(e.message);
    }
}
