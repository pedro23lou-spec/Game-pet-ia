export function containsProxyDisabled(value: unknown): boolean {
  if (!value) return false;
  if (typeof value === 'string') {
    return value.toUpperCase().includes('PROXY_GENERATION_DISABLED');
  }
  if (typeof value === 'object') {
    const obj = value as { code?: unknown; error?: unknown; message?: unknown };
    return (
      containsProxyDisabled(obj.code) ||
      containsProxyDisabled(obj.error) ||
      containsProxyDisabled(obj.message)
    );
  }
  return false;
}

export async function safeFetchJson<T>(
  url: string,
  options?: RequestInit
): Promise<
  | { ok: true; data: T }
  | { ok: false; error: string; status: number; code?: string }
> {
  try {
    const response = await fetch(url, options);
    const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
    const rawText = await response.text();

    if (containsProxyDisabled(rawText)) {
      return {
        ok: false,
        status: response.status || 503,
        code: 'PROXY_GENERATION_DISABLED',
        error: '',
      };
    }

    const trimmed = rawText.trim();
    if (!contentType.includes('application/json') || trimmed.startsWith('<')) {
      return {
        ok: false,
        status: response.status || 502,
        error: 'O servidor ainda está preparando a resposta. Tente novamente em instantes.',
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return {
        ok: false,
        status: response.status || 502,
        error: 'Resposta inesperada recebida do servidor.',
      };
    }

    if (containsProxyDisabled(parsed)) {
      return {
        ok: false,
        status: response.status || 503,
        code: 'PROXY_GENERATION_DISABLED',
        error: '',
      };
    }

    if (!response.ok) {
      const parsedObj =
        parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
      const errMsg =
        parsedObj && typeof parsedObj.error === 'string'
          ? parsedObj.error
          : 'Não foi possível completar a solicitação.';
      const errCode =
        parsedObj && typeof parsedObj.code === 'string' ? parsedObj.code : undefined;
      return { ok: false, status: response.status, error: errMsg, code: errCode };
    }

    return { ok: true, data: parsed as T };
  } catch (err) {
    if (containsProxyDisabled(err)) {
      return {
        ok: false,
        status: 503,
        code: 'PROXY_GENERATION_DISABLED',
        error: '',
      };
    }
    return {
      ok: false,
      status: 0,
      error:
        err instanceof Error
          ? err.message
          : 'Falha de conexão com o servidor.',
    };
  }
}
