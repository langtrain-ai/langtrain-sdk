import { text, select, confirm, password, isCancel, cancel, note } from '@clack/prompts';
import { bgCyan, black, red, green, yellow, gray, cyan, bold, dim, blue } from 'kleur/colors';
import gradient from 'gradient-string';

// Re-export specific prompts to keep imports clean in other files
export { text, select, confirm, password, isCancel, cancel, note };

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
    console.log(`${bgCyan(black(` Langtrain SDK v${version} `))}\n`);
}

export function intro(message: string) {
    console.log(cyan(`◆ ${message}`));
}

export function outro(message: string) {
    console.log(gray(`└ ${message}`));
}

export function spinner() {
    return {
        start: (msg: string) => process.stdout.write(`${cyan('●')} ${msg}\r`),
        stop: (msg?: string) => {
            if (msg) console.log(`${green('✔')} ${msg}`);
            else console.log(''); // Newline
        },
        message: (msg: string) => process.stdout.write(`${cyan('●')} ${msg}\r`)
    };
}

export function showError(message: string) {
    console.log(red(`✖ Error: ${message}`));
}

export function showSuccess(message: string) {
    console.log(green(`✔ ${message}`));
}

export function showWarning(message: string) {
    console.log(yellow(`⚠ Warning: ${message}`));
}

export function showInfo(message: string) {
    console.log(blue(`ℹ ${message}`));
}

export function showDim(message: string) {
    console.log(dim(message));
}

// Re-export for backward compatibility
export { bgCyan, black, red, green, yellow, gray, cyan, bold, dim, blue, gradient };

export const colors = {
    bgCyan, black, red, green, yellow, gray, cyan, bold, dim, blue
};

