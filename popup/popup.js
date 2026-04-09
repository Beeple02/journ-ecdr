// popup.js — Settings UI for Diplomacy Advisor.
// Saves Ollama model name and port to chrome.storage.sync.

const DEFAULT_MODEL = 'llama3.2';
const DEFAULT_PORT = 11434;

const modelInput    = document.getElementById('model-input');
const portInput     = document.getElementById('port-input');
const saveBtn       = document.getElementById('save-btn');
const testBtn       = document.getElementById('test-btn');
const statusEl      = document.getElementById('status');
const modelList     = document.getElementById('model-list');
const modelsDivider = document.getElementById('models-divider');
const modelsContainer = document.getElementById('models-container');

// ---------------------------------------------------------------------------
// Load saved settings on popup open
// ---------------------------------------------------------------------------
chrome.storage.sync.get(
  { ollamaModel: DEFAULT_MODEL, ollamaPort: DEFAULT_PORT },
  ({ ollamaModel, ollamaPort }) => {
    modelInput.value = ollamaModel;
    portInput.value = ollamaPort;
  }
);

// ---------------------------------------------------------------------------
// Save button
// ---------------------------------------------------------------------------
saveBtn.addEventListener('click', () => {
  const model = modelInput.value.trim() || DEFAULT_MODEL;
  const port = parseInt(portInput.value, 10) || DEFAULT_PORT;

  modelInput.value = model;
  portInput.value = port;

  chrome.storage.sync.set({ ollamaModel: model, ollamaPort: port }, () => {
    showStatus('ok', 'Settings saved.');
    setTimeout(() => hideStatus(), 2000);
  });
});

// ---------------------------------------------------------------------------
// Test connection button
// ---------------------------------------------------------------------------
testBtn.addEventListener('click', async () => {
  // Save current values first so background picks them up
  const model = modelInput.value.trim() || DEFAULT_MODEL;
  const port = parseInt(portInput.value, 10) || DEFAULT_PORT;
  await new Promise((resolve) =>
    chrome.storage.sync.set({ ollamaModel: model, ollamaPort: port }, resolve)
  );

  testBtn.disabled = true;
  showStatus('info', 'Connecting to Ollama…');
  modelsContainer.style.display = 'none';
  modelsDivider.style.display = 'none';

  chrome.runtime.sendMessage({ type: 'OLLAMA_PING' }, (response) => {
    testBtn.disabled = false;

    if (chrome.runtime.lastError) {
      showStatus('error', 'Extension error: ' + chrome.runtime.lastError.message);
      return;
    }

    if (!response || !response.ok) {
      showStatus('error', response?.error || 'Could not reach Ollama.');
      return;
    }

    const { models = [] } = response;
    showStatus('ok', `Connected! ${models.length} model(s) available.`);

    if (models.length > 0) {
      renderModelChips(models);
      modelsDivider.style.display = 'block';
      modelsContainer.style.display = 'block';
    }
  });
});

// ---------------------------------------------------------------------------
// Render clickable model chips
// ---------------------------------------------------------------------------
function renderModelChips(models) {
  modelList.innerHTML = '';
  models.forEach((name) => {
    const chip = document.createElement('span');
    chip.className = 'model-chip';
    chip.textContent = name;
    chip.title = `Use ${name}`;
    chip.addEventListener('click', () => {
      modelInput.value = name;
      chrome.storage.sync.set({ ollamaModel: name }, () => {
        showStatus('ok', `Model set to "${name}".`);
        setTimeout(() => hideStatus(), 2000);
      });
    });
    modelList.appendChild(chip);
  });
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------
function showStatus(type, message) {
  statusEl.className = type;
  statusEl.textContent = message;
  statusEl.style.display = 'block';
}

function hideStatus() {
  statusEl.style.display = 'none';
  statusEl.className = '';
}
