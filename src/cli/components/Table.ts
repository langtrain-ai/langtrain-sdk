import Table from 'cli-table3';
import { colors } from '../ui';

export function createTable(headers: string[]) {
    return new Table({
        head: headers.map(h => colors.magenta(colors.bold(h))),
        chars: {
            'top': '─', 'top-mid': '┬', 'top-left': '┌', 'top-right': '┐',
            'bottom': '─', 'bottom-mid': '┴', 'bottom-left': '└', 'bottom-right': '┘',
            'left': '│', 'left-mid': '├', 'mid': '─', 'mid-mid': '┼',
            'right': '│', 'right-mid': '┤', 'middle': '│'
        },
        style: {
            'padding-left': 1,
            'padding-right': 1,
            head: [], // handle colors manually
            border: ['gray']
        }
    });
}
