const AUTH_TOKEN_KEY = 'auth_token';

const trimSlash = (value: string) => value.replace(/\/+$/, '');

const resolveBaseUrl = () => {
  const envUrl = String(import.meta.env.VITE_API_URL || '').trim();
  if (!envUrl) return '/api';
  if (envUrl.startsWith('http://') || envUrl.startsWith('https://')) {
    return trimSlash(envUrl);
  }
  return trimSlash(envUrl.startsWith('/') ? envUrl : `/${envUrl}`);
};

const API_BASE_URL = resolveBaseUrl();

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

class ApiClient implements PromiseLike<any> {
  private table = '';
  private queryParams: Record<string, string> = {};
  private method: HttpMethod = 'GET';
  private bodyData: any = null;
  private authToken: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.authToken = window.localStorage.getItem(AUTH_TOKEN_KEY);
    }
  }

  from(table: string) {
    this.table = table.replace(/^\/+/, '');
    this.queryParams = {};
    this.method = 'GET';
    this.bodyData = null;
    return this;
  }

  select(columns = '*') {
    this.method = 'GET';
    this.queryParams.select = columns;
    return this;
  }

  eq(column: string, value: any) {
    this.queryParams[column] = String(value);
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }) {
    this.queryParams.order = `${column}:${opts?.ascending ? 'asc' : 'desc'}`;
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

  setAuthToken(token: string | null) {
    this.authToken = token;
    if (typeof window !== 'undefined') {
      if (token) {
        window.localStorage.setItem(AUTH_TOKEN_KEY, token);
      } else {
        window.localStorage.removeItem(AUTH_TOKEN_KEY);
      }
    }
  }

  getAuthToken() {
    return this.authToken;
  }

  getBaseUrl() {
    return API_BASE_URL;
  }

  clearAuthToken() {
    this.setAuthToken(null);
  }

  private buildUrl() {
    const finalUrl = new URL(`${API_BASE_URL}/${this.table}`, window.location.origin);
    for (const [key, value] of Object.entries(this.queryParams)) {
      finalUrl.searchParams.append(key, value);
    }
    return finalUrl;
  }

  async execute() {
    try {
      const url = this.buildUrl();
      const headers: Record<string, string> = { Accept: 'application/json' };

      if (this.authToken) {
        headers.Authorization = `Bearer ${this.authToken}`;
      }
      if (this.bodyData !== null && this.bodyData !== undefined) {
        headers['Content-Type'] = 'application/json';
      }

      const response = await fetch(url.toString(), {
        method: this.method,
        headers,
        body: this.bodyData !== null && this.bodyData !== undefined ? JSON.stringify(this.bodyData) : undefined,
      });

      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json')
        ? await response.json()
        : { data: null, error: await response.text() };

      if (!response.ok) {
        return {
          data: null,
          error: payload?.error || response.statusText || 'Erro na API',
          status: response.status,
        };
      }

      return payload;
    } catch (err: any) {
      return { data: null, error: err?.message || 'Falha de conexao' };
    }
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export const api = new ApiClient();
export { AUTH_TOKEN_KEY };
