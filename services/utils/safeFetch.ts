const RETRYABLE_STATUSES = new Set([502, 503, 504]);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isHtmlResponse = (response: Response): boolean => {
    const ct = (response.headers.get('content-type') || '').toLowerCase();
    return ct.includes('text/html');
};

/**
 * Executa fetch com retentativa curta e automática apenas para falhas transitórias
 * de rede/inicialização (TypeError: Failed to fetch, 502/503/504 ou resposta HTML inesperada).
 */
export async function safeFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
    maxRetries: number = 2
): Promise<Response> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (init?.signal?.aborted) {
            throw new DOMException('Aborted', 'AbortError');
        }

        try {
            const response = await fetch(input, init);
            const shouldRetryStatus = RETRYABLE_STATUSES.has(response.status) || isHtmlResponse(response);

            if (shouldRetryStatus && attempt < maxRetries) {
                await delay(450 * (attempt + 1));
                continue;
            }

            return response;
        } catch (err: any) {
            lastError = err;
            if (err?.name === 'AbortError' || init?.signal?.aborted) {
                throw err;
            }
            const isNetworkError = err instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(String(err?.message || ''));
            if (!isNetworkError || attempt >= maxRetries) {
                throw err;
            }
            await delay(450 * (attempt + 1));
        }
    }

    throw lastError instanceof Error ? lastError : new Error('Falha transitória na requisição');
}

/**
 * Faz o parse de JSON protegendo contra respostas HTML (ex.: fallback do proxy/gateway)
 * para evitar SyntaxError: Unexpected token '<', "<!doctype "... is not valid JSON.
 */
export async function safeParseJson<T = any>(response: Response, contextLabel = 'API'): Promise<T> {
    if (isHtmlResponse(response)) {
        throw new Error(`${contextLabel}: resposta HTML inesperada (HTTP ${response.status})`);
    }

    const rawText = await response.text();
    const trimmed = rawText.trim();

    if (!trimmed) {
        throw new Error(`${contextLabel}: resposta vazia (HTTP ${response.status})`);
    }

    if (trimmed.startsWith('<')) {
        throw new Error(`${contextLabel}: conteúdo HTML recebido em vez de JSON (HTTP ${response.status})`);
    }

    return JSON.parse(trimmed) as T;
}
