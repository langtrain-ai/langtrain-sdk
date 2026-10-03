import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.langtrain');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export interface CLIConfig {
    apiKey?: string;
    baseUrl?: string;
    [key: string]: any;
}

function readConfigFile(): CLIConfig {
    if (!fs.existsSync(CONFIG_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    } catch {
        return {};
    }
}

/**
 * Saved config, with LANGTRAIN_API_KEY and LANGTRAIN_BASE_URL taking
 * precedence so CI and scripts work without `lt login`.
 */
export function getConfig(): CLIConfig {
    const config = readConfigFile();
    if (process.env.LANGTRAIN_API_KEY) config.apiKey = process.env.LANGTRAIN_API_KEY;
    if (process.env.LANGTRAIN_BASE_URL) config.baseUrl = process.env.LANGTRAIN_BASE_URL;
    return config;
}

/** Writes ~/.langtrain/config.json readable by the owner only; it holds an API key. */
export function saveConfig(config: CLIConfig) {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    }
    // Never persist values that only came from the environment.
    const saved = readConfigFile();
    const toSave = { ...config };
    if (process.env.LANGTRAIN_API_KEY && toSave.apiKey === process.env.LANGTRAIN_API_KEY && saved.apiKey !== toSave.apiKey) {
        if (saved.apiKey) toSave.apiKey = saved.apiKey; else delete toSave.apiKey;
    }
    if (process.env.LANGTRAIN_BASE_URL && toSave.baseUrl === process.env.LANGTRAIN_BASE_URL && saved.baseUrl !== toSave.baseUrl) {
        if (saved.baseUrl) toSave.baseUrl = saved.baseUrl; else delete toSave.baseUrl;
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(toSave, null, 2), { mode: 0o600 });
    fs.chmodSync(CONFIG_FILE, 0o600);
}
