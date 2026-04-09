// background.js — Service worker that relays requests to the local Ollama instance.
// Runs in the extension's isolated context so it can reach localhost without CORS issues.

const DEFAULT_MODEL = 'llama3.2';
const DEFAULT_PORT = 11434;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'OLLAMA_REQUEST') {
    handleOllamaRequest(message).then(sendResponse);
    return true; // Keep message channel open for async response
  }

  if (message.type === 'OLLAMA_PING') {
    pingOllama().then(sendResponse);
    return true;
  }
});

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ ollamaModel: DEFAULT_MODEL, ollamaPort: DEFAULT_PORT }, resolve);
  });
}

async function pingOllama() {
  const { ollamaPort } = await getSettings();
  try {
    const res = await fetch(`http://localhost:${ollamaPort}/api/tags`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      return { ok: false, error: `Ollama returned status ${res.status}` };
    }
    const data = await res.json();
    const models = (data.models || []).map((m) => m.name);
    return { ok: true, models };
  } catch (e) {
    return {
      ok: false,
      error: "Ollama not running — start it with: ollama serve",
    };
  }
}

async function handleOllamaRequest({ systemPrompt, userMessage }) {
  const { ollamaModel, ollamaPort } = await getSettings();

  try {
    const res = await fetch(`http://localhost:${ollamaPort}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        stream: false,
        options: {
          temperature: 0.2, // Low temperature for consistent JSON output
        },
      }),
      signal: AbortSignal.timeout(90000), // 90s — local models can be slow
    });

    if (!res.ok) {
      const text = await res.text();
      // Common case: model not found
      if (res.status === 404) {
        return {
          error: `Model "${ollamaModel}" not found. Run: ollama pull ${ollamaModel}`,
        };
      }
      return { error: `Ollama error ${res.status}: ${text}` };
    }

    const data = await res.json();
    const content = data.message?.content || '';

    // Strip markdown code fences if the model wrapped the JSON
    const cleaned = content
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```\s*$/m, '')
      .trim();

    try {
      const parsed = JSON.parse(cleaned);
      return { ok: true, result: parsed };
    } catch {
      // Model returned non-JSON — wrap it as plain analysis text
      return { ok: true, result: { orders: [], analysis: content.trim() } };
    }
  } catch (e) {
    if (e.name === 'TimeoutError') {
      return {
        error: 'Ollama timed out. The model may still be loading — try again.',
      };
    }
    return {
      error: "Cannot reach Ollama — make sure 'ollama serve' is running.",
    };
  }
}
