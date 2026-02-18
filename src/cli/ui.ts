import { text, select, confirm, password, isCancel, cancel, note } from '@clack/prompts';
import { bgMagenta, black, red, green, yellow, gray, cyan, bold, dim, blue, magenta, white } from 'kleur/colors';
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
    // Brand Gradient: Purple to Pink to Blue (Light Luxury)
    console.log(gradient(['#A855F7', '#EC4899', '#3B82F6'])(banner));

    // Elegant Badge: Black text on Magenta background
    console.log(`${bgMagenta(black(` Langtrain SDK v${version} `))}\n`);
}

export function intro(message: string) {
    console.log(magenta(`◆ ${message}`));
}

export function outro(message: string) {
    console.log(gray(`└ ${message}`));
}

export function spinner() {
    return {
        start: (msg: string) => process.stdout.write(`${magenta('●')} ${msg}\r`),
        stop: (msg?: string) => {
            if (msg) console.log(`${green('✔')} ${msg}`);
            else console.log(''); // Newline
        },
        message: (msg: string) => process.stdout.write(`${magenta('●')} ${msg}\r`)
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
export { bgMagenta, black, red, green, yellow, gray, cyan, bold, dim, blue, gradient, magenta, white };

export const colors = {
    bgMagenta, black, red, green, yellow, gray, cyan, bold, dim, blue, magenta, white
};

export * from './components/Table';

