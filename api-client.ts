const API_URL = 'http://localhost:3001';

class ApiClient implements PromiseLike<any> {
    private table: string = '';
    private queryParams: Record<string, string> = {};
    private method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET';
    private bodyData: any = null;

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

    async execute() {
        const urlString = `${API_URL}/${this.table}`;
        const finalUrl = new URL(urlString, window.location.origin);
        Object.keys(this.queryParams).forEach(key => finalUrl.searchParams.append(key, this.queryParams[key]));

        const options: RequestInit = {
            method: this.method,
            headers: { 'Content-Type': 'application/json' },
        };

        if (this.bodyData) {
            options.body = JSON.stringify(this.bodyData);
        }

        try {
            const response = await fetch(finalUrl.toString(), options);
            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                return { data: null, error: errData.error || response.statusText };
            }
            return await response.json();
        } catch (err: any) {
            return { data: null, error: err.message };
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
