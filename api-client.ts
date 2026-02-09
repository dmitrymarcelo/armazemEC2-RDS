const AUTH_TOKEN_STORAGE_KEY = 'auth_token';
const DEFAULT_API_BASE = '/api';
const LOCAL_API_FALLBACKS = ['http://127.0.0.1:3001', 'http://localhost:3001'];
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_GET_RETRIES = 2;

const normalizeBaseUrl = (rawBaseUrl: string) => {
  const trimmed = rawBaseUrl.trim();
  if (!trimmed) return DEFAULT_API_BASE;
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
};

class ApiClient implements PromiseLike<any> {
  private table = '';
  private queryParams: Record<string, string> = {};
  private method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET';
  private bodyData: any = null;
  private readonly baseUrl: string;
  private readonly requestTimeoutMs: number;
  private readonly getRetries: number;
  private authToken: string | null = null;

  constructor() {
    const envBaseUrl = import.meta.env.VITE_API_URL;
    this.baseUrl = envBaseUrl ? normalizeBaseUrl(envBaseUrl) : DEFAULT_API_BASE;

    const timeoutFromEnv = Number.parseInt(String(import.meta.env.VITE_API_TIMEOUT_MS || ''), 10);
    this.requestTimeoutMs = Number.isFinite(timeoutFromEnv) && timeoutFromEnv > 0 ? timeoutFromEnv : DEFAULT_TIMEOUT_MS;

    const retriesFromEnv = Number.parseInt(String(import.meta.env.VITE_API_GET_RETRIES || ''), 10);
    this.getRetries = Number.isFinite(retriesFromEnv) && retriesFromEnv >= 0 ? retriesFromEnv : DEFAULT_GET_RETRIES;

    if (typeof window !== 'undefined') {
      this.authToken = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    }
  }

  from(table: string) {
    this.table = table;
    this.queryParams = {};
    this.method = 'GET';
    this.bodyData = null;
    return this;
  }

  select(columns: string = '*') {
    this.method = 'GET';
    this.queryParams.select = columns;
    return this;
  }

  eq(column: string, value: any) {
    this.queryParams[column] = String(value);
    return this;
  }

  order(column: string, { ascending = true } = {}) {
    this.queryParams.order = `${column}:${ascending ? 'asc' : 'desc'}`;
    return this;
  }

  limit(n: number) {
    this.queryParams.limit = String(n);
    return this;
  }

  offset(n: number) {
    this.queryParams.offset = String(Math.max(0, n));
    return this;
  }

  insert(data: any) {
    this.method = 'POST';
    this.bodyData = data;
    return this;
  }

  update(data: any) {
    this.method = 'PATCH';
    this.bodyData = data;
    return this;
  }

  delete() {
    this.method = 'DELETE';
    return this;
  }

  getBaseUrl() {
    return this.baseUrl;
  }

  getAuthToken() {
    if (typeof window !== 'undefined' && !this.authToken) {
      this.authToken = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    }
    return this.authToken;
  }

  setAuthToken(token: string | null) {
    this.authToken = token;

    if (typeof window !== 'undefined') {
      if (token) {
        window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
      } else {
        window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      }
    }
  }

  clearAuthToken() {
    this.setAuthToken(null);
  }

  private isLocalBrowserHost() {
    if (typeof window === 'undefined') return false;
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1';
  }

  private isLocalApiBase(base: string) {
    return /^https?:\/\/(127\.0\.0\.1|localhost):3001$/i.test(base);
  }

  private getBaseUrlCandidates() {
    const primary = normalizeBaseUrl(this.baseUrl);
    const candidates: string[] = [primary];

    if (!this.isLocalBrowserHost()) {
      return candidates;
    }

    if (primary === DEFAULT_API_BASE) {
      candidates.push(...LOCAL_API_FALLBACKS);
    } else if (this.isLocalApiBase(primary)) {
      candidates.push(DEFAULT_API_BASE);
      candidates.push(...LOCAL_API_FALLBACKS);
    }

    return [...new Set(candidates.map((base) => normalizeBaseUrl(base)))];
  }

  private getRequestUrl(baseUrlOverride?: string) {
    const endpointBase = normalizeBaseUrl(baseUrlOverride || this.baseUrl);
    const endpoint = `${endpointBase}/${this.table}`;
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const url = new URL(endpoint, base);

    Object.keys(this.queryParams).forEach((key) => {
      url.searchParams.append(key, this.queryParams[key]);
    });

    return url.toString();
  }

  private isNetworkError(error: unknown) {
    const message = String((error as any)?.message || '').toLowerCase();
    return message.includes('failed to fetch') || message.includes('networkerror') || message.includes('aborted');
  }

  private shouldRetryAlternativeForHttpError(status: number, errorMessage: unknown) {
    if (!this.isLocalBrowserHost()) return false;
    if (status === 404 || status === 502 || status === 503 || status === 504) return true;

    const normalized = String(errorMessage || '').toLowerCase();
    return normalized.includes('not found');
  }

  private formatNetworkError(error: unknown) {
    const rawMessage = String((error as any)?.message || 'Erro de rede');
    const normalizedMessage = rawMessage.toLowerCase();

    if (normalizedMessage.includes('aborted')) {
      return `Tempo de resposta da API excedido (${this.requestTimeoutMs}ms).`;
    }

    if (normalizedMessage.includes('failed to fetch') || normalizedMessage.includes('networkerror')) {
      return 'Falha de conexão com a API. Verifique se o backend está ativo (proxy /api ou porta 3001).';
    }

    return rawMessage;
  }

  private async wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async fetchWithTimeout(url: string, options: RequestInit) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async fetchWithRetry(url: string, options: RequestInit) {
    const canRetry = options.method === 'GET';
    const attempts = canRetry ? this.getRetries + 1 : 1;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        return await this.fetchWithTimeout(url, options);
      } catch (error) {
        lastError = error;
        const isLastAttempt = attempt === attempts - 1;
        if (!canRetry || !this.isNetworkError(error) || isLastAttempt) {
          throw error;
        }

        await this.wait(120 * (attempt + 1));
      }
    }

    throw lastError;
  }

  private async parseResponse(response: Response) {
    if (response.status === 401) {
      this.clearAuthToken();
    }

    if (!response.ok) {
      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      const errData = contentType.includes('application/json')
        ? await response.json().catch(() => ({}))
        : {};
      const rawText = await response.text().catch(() => '');
      const fallbackError = (rawText || response.statusText || 'Erro de requisição').trim();
      const derivedError = String(errData?.error || fallbackError);
      const normalizedError = derivedError.toLowerCase();

      const isLikelyLocalProxyFailure =
        normalizedError.includes('econnrefused') ||
        normalizedError.includes('proxy error') ||
        (response.status >= 500 && normalizedError === 'internal server error');

      if (this.isLocalBrowserHost() && isLikelyLocalProxyFailure) {
        return {
          data: null,
          error: 'Falha de conexão com a API local. Verifique se o backend está rodando na porta 3001.',
          httpStatus: response.status,
        };
      }

      return { data: null, error: derivedError, httpStatus: response.status };
    }

    const payload = await response.json().catch(() => ({}));
    if (payload && typeof payload === 'object') {
      return { ...payload, httpStatus: response.status };
    }

    return { data: payload, error: null, httpStatus: response.status };
  }

  async execute() {
    const options: RequestInit = {
      method: this.method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const token = this.getAuthToken();
    if (token) {
      (options.headers as Record<string, string>).Authorization = `Bearer ${token}`;
    }

    if (this.bodyData !== null) {
      options.body = JSON.stringify(this.bodyData);
    }

    const baseCandidates = this.getBaseUrlCandidates();
    let lastResult: any = null;

    for (let index = 0; index < baseCandidates.length; index += 1) {
      const base = baseCandidates[index];
      const hasNextCandidate = index < baseCandidates.length - 1;

      try {
        const response = await this.fetchWithRetry(this.getRequestUrl(base), options);
        const result = await this.parseResponse(response);

        if (!result.error) {
          return result;
        }

        lastResult = result;
        if (hasNextCandidate && this.shouldRetryAlternativeForHttpError(response.status, result.error)) {
          continue;
        }

        return result;
      } catch (error: unknown) {
        if (hasNextCandidate && this.isNetworkError(error)) {
          continue;
        }

        return { data: null, error: this.formatNetworkError(error) };
      }
    }

    return lastResult || { data: null, error: 'Erro de rede' };
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export const api = new ApiClient();
export const AUTH_TOKEN_KEY = AUTH_TOKEN_STORAGE_KEY;
