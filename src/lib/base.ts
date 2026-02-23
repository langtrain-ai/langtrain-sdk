import axios, { AxiosInstance, AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';

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
    /** Max requests per second (client-side rate limiting, default: 10). */
    maxRequestsPerSecond?: number;
    /** Enable debug logging to stderr (default: false). */
    debug?: boolean;
    /** Optional callback invoked on every request for observability. */
    onRequest?: (event: RequestEvent) => void;
}

/** Emitted for every API request (success or failure). */
export interface RequestEvent {
    method: string;
    path: string;
    status?: number;
    latencyMs: number;
    attempt: number;
    error?: LangtrainError;
    rateLimitRemaining?: number;
    rateLimitReset?: number;
}

const DEFAULT_BASE_URL = 'https://api.langtrain.xyz/v1';
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_MAX_RPS = 10;
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];

// ── Custom Error ───────────────────────────────────────────────────────────

export class LangtrainError extends Error {
    /** HTTP status code, if available. */
    readonly status?: number;
    /** Raw error code from the API. */
    readonly code?: string;
    /** The original error, if any. */
    readonly cause?: Error;
    /** Seconds until rate limit resets (from Retry-After header). */
    readonly retryAfter?: number;

    constructor(message: string, options?: {
        status?: number;
        code?: string;
        cause?: Error;
        retryAfter?: number;
    }) {
        super(message);
        this.name = 'LangtrainError';
        this.status = options?.status;
        this.code = options?.code;
        this.cause = options?.cause;
        this.retryAfter = options?.retryAfter;
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

// ── Token Bucket Rate Limiter ──────────────────────────────────────────────

/**
 * Simple token-bucket rate limiter.
 * Allows bursting up to `capacity` requests, refills at `refillRate` tokens/sec.
 */
class RateLimiter {
    private tokens: number;
    private lastRefill: number;

    constructor(
        private readonly capacity: number,
        private readonly refillRate: number,
    ) {
        this.tokens = capacity;
        this.lastRefill = Date.now();
    }

    /** Wait until a token is available, then consume it. */
    async acquire(): Promise<void> {
        this.refill();

        if (this.tokens >= 1) {
            this.tokens -= 1;
            return;
        }

        // Wait for next token
        const waitMs = ((1 - this.tokens) / this.refillRate) * 1000;
        await this.sleep(Math.ceil(waitMs));
        this.refill();
        this.tokens -= 1;
    }

    /** Pause for `seconds` (e.g. from Retry-After header). */
    async waitFor(seconds: number): Promise<void> {
        await this.sleep(seconds * 1000);
    }

    private refill(): void {
        const now = Date.now();
        const elapsed = (now - this.lastRefill) / 1000;
        this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
        this.lastRefill = now;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ── Base Client ────────────────────────────────────────────────────────────

/**
 * BaseClient — abstract foundation for all Langtrain SDK clients.
 *
 * Features:
 * - Shared axios instance with API key auth
 * - Configurable timeouts
 * - Automatic retry with exponential backoff on transient errors
 * - Client-side token-bucket rate limiting
 * - Retry-After header respect on 429s
 * - Structured error wrapping (LangtrainError)
 * - Debug logging and request event hooks
 */
export abstract class BaseClient {
    protected readonly http: AxiosInstance;
    protected readonly maxRetries: number;
    private readonly rateLimiter: RateLimiter;
    private readonly debug: boolean;
    private readonly onRequest?: (event: RequestEvent) => void;

    constructor(config: ClientConfig) {
        this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
        this.debug = config.debug ?? false;
        this.onRequest = config.onRequest;

        const maxRps = config.maxRequestsPerSecond ?? DEFAULT_MAX_RPS;
        this.rateLimiter = new RateLimiter(maxRps, maxRps);

        this.http = axios.create({
            baseURL: config.baseUrl || DEFAULT_BASE_URL,
            timeout: config.timeout ?? DEFAULT_TIMEOUT,
            headers: {
                'X-API-Key': config.apiKey,
                'Content-Type': 'application/json',
                'User-Agent': 'langtrain-sdk/0.2.x',
            },
        });
    }

    /**
     * Execute a request with rate limiting, automatic retry, and error wrapping.
     */
    protected async request<T>(fn: () => Promise<T>): Promise<T> {
        let lastError: LangtrainError | undefined;

        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            // Acquire a rate limiter token before each attempt
            await this.rateLimiter.acquire();

            const start = Date.now();

            try {
                const result = await fn();
                const latencyMs = Date.now() - start;

                this.log(`✓ request succeeded (${latencyMs}ms, attempt ${attempt + 1})`);
                this.emitEvent({ method: '', path: '', status: 200, latencyMs, attempt });

                return result;
            } catch (error) {
                const latencyMs = Date.now() - start;
                lastError = this.wrapError(error);

                this.log(`✗ request failed: ${lastError.message} (${latencyMs}ms, attempt ${attempt + 1})`);
                this.emitEvent({
                    method: '', path: '',
                    status: lastError.status,
                    latencyMs,
                    attempt,
                    error: lastError,
                    rateLimitRemaining: lastError.isRateLimited ? 0 : undefined,
                    rateLimitReset: lastError.retryAfter,
                });

                // Don't retry non-transient errors or on last attempt
                if (!lastError.isTransient || attempt === this.maxRetries) {
                    throw lastError;
                }

                // If rate-limited with Retry-After, respect it
                if (lastError.isRateLimited && lastError.retryAfter) {
                    this.log(`⏳ rate limited, waiting ${lastError.retryAfter}s (Retry-After)`);
                    await this.rateLimiter.waitFor(lastError.retryAfter);
                } else {
                    // Exponential backoff: 500ms, 1000ms, 2000ms...
                    const delay = Math.min(500 * Math.pow(2, attempt), 5000);
                    this.log(`↻ retrying in ${delay}ms...`);
                    await this.sleep(delay);
                }
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
            const headers = error.response?.headers;
            const data = error.response?.data as Record<string, unknown> | undefined;
            const serverMessage = data?.detail ?? data?.message ?? data?.error;

            // Parse Retry-After header (seconds or HTTP date)
            let retryAfter: number | undefined;
            const retryHeader = headers?.['retry-after'];
            if (retryHeader) {
                const parsed = Number(retryHeader);
                retryAfter = isNaN(parsed)
                    ? Math.max(0, Math.ceil((new Date(retryHeader).getTime() - Date.now()) / 1000))
                    : parsed;
            }

            const message = serverMessage
                ? String(serverMessage)
                : error.code === 'ECONNABORTED'
                    ? `Request timed out`
                    : status === 429
                        ? `Rate limited${retryAfter ? ` — retry in ${retryAfter}s` : ''}`
                        : status
                            ? `API request failed with status ${status}`
                            : `Network error: ${error.message}`;

            return new LangtrainError(message, {
                status,
                code: error.code,
                cause: error,
                retryAfter,
            });
        }

        if (error instanceof Error) {
            return new LangtrainError(error.message, { cause: error });
        }

        return new LangtrainError(String(error));
    }

    private log(msg: string): void {
        if (this.debug) {
            process.stderr.write(`[cortex] ${msg}\n`);
        }
    }

    private emitEvent(event: RequestEvent): void {
        if (this.onRequest) {
            try {
                this.onRequest(event);
            } catch {
                // Never let user callbacks crash the SDK
            }
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
