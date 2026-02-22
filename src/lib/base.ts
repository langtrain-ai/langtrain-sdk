import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';

// ── Shared Configuration ───────────────────────────────────────────────────

/** Configuration for all Langtrain SDK clients. */
export interface ClientConfig {
    /** Your Langtrain API key. */
    apiKey: string;
    /** Override the default API base URL. */
    baseUrl?: string;
    /** Request timeout in milliseconds (default: 30000). */
    timeout?: number;
    /** Maximum number of retries on transient errors (default: 2). */
    maxRetries?: number;
}

const DEFAULT_BASE_URL = 'https://api.langtrain.ai/api/v1';
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_MAX_RETRIES = 2;
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];

// ── Custom Error ───────────────────────────────────────────────────────────

export class LangtrainError extends Error {
    /** HTTP status code, if available. */
    readonly status?: number;
    /** Raw error code from the API. */
    readonly code?: string;
    /** The original error, if any. */
    readonly cause?: Error;

    constructor(message: string, options?: { status?: number; code?: string; cause?: Error }) {
        super(message);
        this.name = 'LangtrainError';
        this.status = options?.status;
        this.code = options?.code;
        this.cause = options?.cause;
    }

    /** True if the error was a network/timeout issue (retryable). */
    get isTransient(): boolean {
        return this.code === 'ECONNABORTED' || this.code === 'NETWORK_ERROR' ||
            (this.status !== undefined && RETRYABLE_STATUS_CODES.includes(this.status));
    }

    /** True if the API key was invalid or expired. */
    get isAuthError(): boolean {
        return this.status === 401 || this.status === 403;
    }

    /** True if a resource was not found. */
    get isNotFound(): boolean {
        return this.status === 404;
    }

    /** True if rate-limited. */
    get isRateLimited(): boolean {
        return this.status === 429;
    }
}

// ── Base Client ────────────────────────────────────────────────────────────

/**
 * BaseClient — abstract foundation for all Langtrain SDK clients.
 *
 * Provides:
 * - Shared axios instance with API key auth
 * - Configurable timeouts
 * - Automatic retry with exponential backoff on transient errors
 * - Structured error wrapping (LangtrainError)
 */
export abstract class BaseClient {
    protected readonly http: AxiosInstance;
    protected readonly maxRetries: number;

    constructor(config: ClientConfig) {
        this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;

        this.http = axios.create({
            baseURL: config.baseUrl || DEFAULT_BASE_URL,
            timeout: config.timeout ?? DEFAULT_TIMEOUT,
            headers: {
                'X-API-Key': config.apiKey,
                'Content-Type': 'application/json',
            },
        });
    }

    /**
     * Execute a request with automatic retry and error wrapping.
     */
    protected async request<T>(fn: () => Promise<T>): Promise<T> {
        let lastError: LangtrainError | undefined;

        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = this.wrapError(error);

                // Only retry on transient errors, and not on the last attempt
                if (!lastError.isTransient || attempt === this.maxRetries) {
                    throw lastError;
                }

                // Exponential backoff: 500ms, 1000ms, 2000ms...
                const delay = Math.min(500 * Math.pow(2, attempt), 5000);
                await this.sleep(delay);
            }
        }

        throw lastError!;
    }

    /**
     * Wrap any thrown error into a structured LangtrainError.
     */
    private wrapError(error: unknown): LangtrainError {
        if (error instanceof LangtrainError) return error;

        if (error instanceof AxiosError) {
            const status = error.response?.status;
            const data = error.response?.data as Record<string, unknown> | undefined;
            const serverMessage = data?.detail ?? data?.message ?? data?.error;

            const message = serverMessage
                ? String(serverMessage)
                : error.code === 'ECONNABORTED'
                    ? `Request timed out`
                    : status
                        ? `API request failed with status ${status}`
                        : `Network error: ${error.message}`;

            return new LangtrainError(message, {
                status,
                code: error.code,
                cause: error,
            });
        }

        if (error instanceof Error) {
            return new LangtrainError(error.message, { cause: error });
        }

        return new LangtrainError(String(error));
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
