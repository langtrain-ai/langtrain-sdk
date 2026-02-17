import { intro, outro, spinner, isCancel, cancel, text, select, confirm, password } from '@clack/prompts';
import { bgCyan, black, red, green, yellow, gray } from 'kleur/colors';
import gradient from 'gradient-string';

export function showBanner(version: string) {
    console.clear();
    const banner = `
    ██╗      █████╗ ███╗   ██╗ ██████╗████████╗██████╗  █████╗ ██╗███╗   ██╗
    ██║     ██╔══██╗████╗  ██║██╔════╝╚══██╔══╝██╔══██╗██╔══██╗██║████╗  ██║
    ██║     ███████║██╔██╗ ██║██║  ███╗  ██║   ██████╔╝███████║██║██╔██╗ ██║
    ██║     ██╔══██║██║╚██╗██║██║   ██║  ██║   ██╔══██╗██╔══██║██║██║╚██╗██║
    ███████╗██║  ██║██║ ╚████║╚██████╔╝  ██║   ██║  ██║██║  ██║██║██║ ╚████║
    ╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝
    `;
    console.log(gradient(['#00DC82', '#36E4DA', '#0047E1'])(banner));
    intro(`${bgCyan(black(` Langtrain SDK v${version} `))}`);
}

export function showError(message: string) {
    console.log(red(`Error: ${message}`));
}

export function showSuccess(message: string) {
    console.log(green(message));
}

export { intro, outro, spinner, isCancel, cancel, text, select, confirm, password, bgCyan, black, red, green, yellow, gray, gradient };
