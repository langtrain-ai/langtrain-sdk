import { text, select, confirm, password, isCancel, cancel } from '@clack/prompts';
import { bgCyan, black, red, green, yellow, gray, cyan, bold } from 'kleur/colors';

// Gradient removed for cleaner look, or keep if user likes it but wants no emojis?
// User said "remove emojis", didn't explicitly say "remove colors/gradients", but "clean UI" usually implies less noise.
// I will keep the banner gradient as it is a brand element, but remove emojis from intro/outro.
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

export { text, select, confirm, password, isCancel, cancel, bgCyan, black, red, green, yellow, gray, cyan, bold, gradient };
