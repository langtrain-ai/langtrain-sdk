import { intro, outro, showSuccess, showError, showWarning, showInfo, spinner, colors } from '../ui';
import { getConfig } from '../config';
import { getSubscription } from '../auth';
import os from 'os';

export async function handleDoctor() {
    intro('Running Langtrain Doctor...');

    const s = spinner();
    let issues = 0;

    // 1. Check Node Environment
    s.start('Checking Node.js environment...');
    const nodeVersion = process.version;
    const platform = os.platform();
    const arch = os.arch();

    if (parseInt(nodeVersion.replace('v', '').split('.')[0]) < 18) {
        s.stop(colors.red(`Node.js version ${nodeVersion} is outdated. Please upgrade to v18+.`));
        issues++;
    } else {
        s.stop(`Node.js ${nodeVersion} (${platform} ${arch})`);
    }

    // 2. Check Configuration
    s.start('Checking configuration...');
    const config = getConfig();
    if (!config.apiKey) {
        s.stop(colors.yellow('API Key is missing. Run `langtrain login` or set LANGTRAIN_API_KEY.'));
        issues++;
    } else {
        s.stop('Configuration found.');

        // 3. Check API Connectivity
        s.start('Checking API connectivity...');
        try {
            const plan = await getSubscription(config.apiKey);
            s.stop(`Connected to Langtrain Cloud (Plan: ${colors.green(plan?.plan || 'unknown')})`);
        } catch (e: any) {
            s.stop(colors.red(`Failed to connect to Langtrain Cloud: ${e.message}`));
            issues++;
        }
    }

    console.log(''); // Spacer

    if (issues === 0) {
        showSuccess('Your Langtrain environment is healthy! Ready to build.');
    } else {
        showWarning(`Found ${issues} issue(s). Please resolve them for the best experience.`);
    }

    outro('Doctor check complete.');
}
