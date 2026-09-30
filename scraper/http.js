// Identify the scraper honestly, with a link back to this project, so EIA
// can see who is fetching and why.
const DEFAULT_HEADERS = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "User-Agent": "spr-tracker/1.0 (+https://github.com/brianlzhou/spr)"
};

async function fetchOnce(url, options, readBody) {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: { ...DEFAULT_HEADERS, ...(options.headers ?? {}) },
      redirect: "follow",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText} for ${url}`);
    }

    return await readBody(response);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWithRetries(url, options, readBody) {
  const retries = options.retries ?? 2;
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchOnce(url, options, readBody);
    } catch (error) {
      lastError = error;

      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 1_500 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

export async function fetchText(url, options = {}) {
  return fetchWithRetries(url, options, (response) => response.text());
}

export async function fetchBuffer(url, options = {}) {
  const arrayBuffer = await fetchWithRetries(url, options, (response) => response.arrayBuffer());
  return Buffer.from(arrayBuffer);
}

export async function fetchJson(url, options = {}) {
  const text = await fetchText(url, {
    ...options,
    headers: { Accept: "application/json", ...(options.headers ?? {}) }
  });

  return JSON.parse(text);
}
