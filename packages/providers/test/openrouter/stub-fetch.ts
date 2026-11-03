export type RecordedCall = { url: string; init: RequestInit; body: ReturnType<typeof JSON.parse> };

export function stubFetch(respond: (call: RecordedCall) => Response | Promise<Response>) {
  const calls: RecordedCall[] = [];
  const fetchImplementation = ((input: string | URL | Request, init: RequestInit = {}) => {
    const call = {
      url: String(input),
      init,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    const signal = init.signal;
    return new Promise<Response>((resolve, reject) => {
      if (signal?.aborted) return reject(signal.reason);
      signal?.addEventListener('abort', () => reject(signal.reason));
      Promise.resolve(respond(call)).then(resolve, reject);
    });
  }) as typeof fetch;
  return { fetchImplementation, calls };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export const textCompletion = {
  choices: [{ message: { role: 'assistant', content: 'hello' } }],
  usage: { prompt_tokens: 12, completion_tokens: 5, cost: 0.0004 },
};

export const pngBase64 = Buffer.from([137, 80, 78, 71, 1, 2, 3]).toString('base64');

export const imageCompletion = {
  choices: [
    {
      message: {
        role: 'assistant',
        content: '',
        images: [{ type: 'image_url', image_url: { url: `data:image/png;base64,${pngBase64}` } }],
      },
    },
  ],
  usage: { prompt_tokens: 20, completion_tokens: 0, cost: 0.04 },
};
