// content.js — Injects the Diplomacy Advisor overlay panel into Backstabbr game pages.
//
// The panel is mounted inside a Shadow DOM so its styles never conflict with
// Backstabbr's CSS.
//
// Keyboard shortcut: Alt+D  — toggle panel visibility

// ---------------------------------------------------------------------------
// Styles (inlined so we don't need web_accessible_resources for a CSS file)
// ---------------------------------------------------------------------------
const PANEL_CSS = `
  :host {
    all: initial;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.4;
  }

  #panel {
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 340px;
    max-height: 80vh;
    background: #1a1f2e;
    color: #e8eaf0;
    border: 1px solid #3a4060;
    border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 2147483647;
    transition: opacity 0.2s, transform 0.2s;
    user-select: none;
  }

  #panel.hidden {
    opacity: 0;
    pointer-events: none;
    transform: translateY(8px);
  }

  /* ---------- Header ---------- */
  #header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: #252c42;
    border-bottom: 1px solid #3a4060;
    cursor: grab;
    flex-shrink: 0;
  }

  #header:active { cursor: grabbing; }

  #header-title {
    font-weight: 700;
    font-size: 13px;
    color: #c9a84c;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  #header-controls {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .ctrl-btn {
    background: none;
    border: 1px solid #4a5070;
    color: #9aa0b8;
    border-radius: 4px;
    padding: 2px 7px;
    font-size: 11px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .ctrl-btn:hover {
    background: #3a4060;
    color: #e8eaf0;
  }

  /* ---------- Game info bar ---------- */
  #game-info {
    padding: 8px 14px;
    background: #1e2436;
    border-bottom: 1px solid #2e3450;
    font-size: 12px;
    color: #7a82a0;
    flex-shrink: 0;
  }

  #game-info span {
    color: #a0a8c0;
    font-weight: 600;
  }

  /* ---------- Scrollable body ---------- */
  #body {
    overflow-y: auto;
    flex: 1;
    padding: 12px 14px;
    scrollbar-width: thin;
    scrollbar-color: #3a4060 transparent;
  }

  /* ---------- Analyze button ---------- */
  #analyze-btn {
    width: 100%;
    padding: 9px;
    background: #c9a84c;
    color: #1a1f2e;
    font-weight: 700;
    font-size: 13px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    margin-bottom: 14px;
    transition: background 0.15s, opacity 0.15s;
    letter-spacing: 0.3px;
  }

  #analyze-btn:hover { background: #e0bf60; }
  #analyze-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ---------- Loading spinner ---------- */
  #loading {
    display: none;
    text-align: center;
    padding: 20px 0;
    color: #7a82a0;
    font-size: 12px;
  }

  #loading.visible { display: block; }

  .spinner {
    display: inline-block;
    width: 20px;
    height: 20px;
    border: 2px solid #3a4060;
    border-top-color: #c9a84c;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 6px;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  /* ---------- Error message ---------- */
  #error-msg {
    display: none;
    background: #2e1a1a;
    border: 1px solid #5a2a2a;
    border-radius: 6px;
    padding: 10px 12px;
    color: #f08080;
    font-size: 12px;
    margin-bottom: 12px;
    white-space: pre-wrap;
  }

  #error-msg.visible { display: block; }

  /* ---------- Orders list ---------- */
  #orders-section { margin-bottom: 14px; }

  .section-title {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #5a6080;
    margin-bottom: 8px;
    font-weight: 600;
  }

  .order-card {
    background: #202638;
    border: 1px solid #2e3450;
    border-radius: 6px;
    padding: 8px 10px;
    margin-bottom: 6px;
  }

  .order-text {
    font-family: 'Courier New', Courier, monospace;
    font-size: 13px;
    font-weight: 700;
    color: #c9d0e8;
    margin-bottom: 3px;
  }

  .order-reason {
    font-size: 11px;
    color: #6a72a0;
  }

  /* ---------- Analysis section ---------- */
  #analysis-section { margin-bottom: 4px; }

  #analysis-toggle {
    background: none;
    border: none;
    color: #5a6080;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    cursor: pointer;
    padding: 0;
    margin-bottom: 8px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  #analysis-toggle:hover { color: #9aa0b8; }

  #analysis-toggle .arrow {
    display: inline-block;
    transition: transform 0.2s;
  }

  #analysis-toggle.open .arrow { transform: rotate(90deg); }

  #analysis-text {
    display: none;
    background: #1e2436;
    border: 1px solid #2e3450;
    border-radius: 6px;
    padding: 10px 12px;
    font-size: 12px;
    color: #8a92b0;
    line-height: 1.6;
  }

  #analysis-text.visible { display: block; }

  /* ---------- Empty state ---------- */
  #empty-state {
    text-align: center;
    color: #4a5070;
    font-size: 12px;
    padding: 10px 0 4px;
  }

  /* ---------- Footer hint ---------- */
  #footer {
    padding: 6px 14px 8px;
    font-size: 10px;
    color: #3a4060;
    text-align: center;
    flex-shrink: 0;
    border-top: 1px solid #252c42;
  }
`;

// ---------------------------------------------------------------------------
// HTML template for the panel body
// ---------------------------------------------------------------------------
const PANEL_HTML = `
  <div id="panel">
    <div id="header">
      <span id="header-title">Diplomacy Advisor</span>
      <div id="header-controls">
        <button class="ctrl-btn" id="refresh-btn" title="Re-read game state">↻</button>
        <button class="ctrl-btn" id="minimize-btn" title="Minimize (Alt+D)">−</button>
      </div>
    </div>

    <div id="game-info">
      Turn: <span id="info-turn">—</span> &nbsp;|&nbsp;
      Country: <span id="info-country">—</span> &nbsp;|&nbsp;
      Units: <span id="info-units">—</span>
    </div>

    <div id="body">
      <button id="analyze-btn">Analyze Position</button>

      <div id="loading">
        <div class="spinner"></div><br>Thinking…
      </div>

      <div id="error-msg"></div>

      <div id="orders-section" style="display:none">
        <div class="section-title">Suggested Orders</div>
        <div id="orders-list"></div>
      </div>

      <div id="analysis-section" style="display:none">
        <button id="analysis-toggle">
          <span class="arrow">▶</span> Strategic Notes
        </button>
        <div id="analysis-text"></div>
      </div>

      <div id="empty-state">Click "Analyze Position" to get order suggestions.</div>
    </div>

    <div id="footer">Alt+D to toggle &nbsp;·&nbsp; drag header to move</div>
  </div>
`;

// ---------------------------------------------------------------------------
// Mount the Shadow DOM overlay
// ---------------------------------------------------------------------------
function mountOverlay() {
  // Avoid double-mounting
  if (document.getElementById('diplomacy-advisor-root')) return;

  const host = document.createElement('div');
  host.id = 'diplomacy-advisor-root';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = PANEL_CSS;
  shadow.appendChild(style);

  const wrapper = document.createElement('div');
  wrapper.innerHTML = PANEL_HTML;
  shadow.appendChild(wrapper);

  // Shorthand accessors into the shadow DOM
  const $ = (id) => shadow.getElementById(id);

  const panel       = $('panel');
  const analyzeBtn  = $('analyze-btn');
  const refreshBtn  = $('refresh-btn');
  const minimizeBtn = $('minimize-btn');
  const loadingEl   = $('loading');
  const errorEl     = $('error-msg');
  const ordersSection  = $('orders-section');
  const ordersList     = $('orders-list');
  const analysisSection = $('analysis-section');
  const analysisToggle  = $('analysis-toggle');
  const analysisText    = $('analysis-text');
  const emptyState      = $('empty-state');
  const infoTurn    = $('info-turn');
  const infoCountry = $('info-country');
  const infoUnits   = $('info-units');

  // ---------------------------------------------------------------------------
  // Game info bar
  // ---------------------------------------------------------------------------
  let currentGameState = null;

  function updateInfoBar(gs) {
    currentGameState = gs;
    infoTurn.textContent = gs.season && gs.year
      ? `${gs.season} ${gs.year}`
      : '—';
    infoCountry.textContent = gs.myCountry || '—';
    infoUnits.textContent = gs.units.length > 0
      ? gs.units.map((u) => `${u.type === 'Army' ? 'A' : 'F'} ${u.territory}`).join(', ')
      : '—';
  }

  // Initial read
  updateInfoBar(window.parseGameState());

  // Watch for phase transitions
  window.setupGameObserver((gs) => updateInfoBar(gs));

  // ---------------------------------------------------------------------------
  // Analyze button
  // ---------------------------------------------------------------------------
  analyzeBtn.addEventListener('click', async () => {
    const gs = currentGameState || window.parseGameState();

    // Show loading, hide old results
    analyzeBtn.disabled = true;
    loadingEl.classList.add('visible');
    errorEl.classList.remove('visible');
    ordersSection.style.display = 'none';
    analysisSection.style.display = 'none';
    emptyState.style.display = 'none';

    const response = await window.getAdvisorSuggestions(gs);

    loadingEl.classList.remove('visible');
    analyzeBtn.disabled = false;

    if (!response || !response.ok) {
      errorEl.textContent = response?.error || 'Unknown error.';
      errorEl.classList.add('visible');
      emptyState.style.display = 'block';
      return;
    }

    const { orders = [], analysis = '' } = response.result || {};

    // Render order cards
    ordersList.innerHTML = '';
    if (orders.length > 0) {
      orders.forEach(({ unit, order, reason }) => {
        const card = document.createElement('div');
        card.className = 'order-card';
        card.innerHTML = `
          <div class="order-text">${escapeHtml(order || unit)}</div>
          ${reason ? `<div class="order-reason">${escapeHtml(reason)}</div>` : ''}
        `;
        ordersList.appendChild(card);
      });
      ordersSection.style.display = 'block';
    }

    // Render analysis
    if (analysis) {
      analysisText.textContent = analysis;
      analysisSection.style.display = 'block';
    }

    if (orders.length === 0 && !analysis) {
      emptyState.style.display = 'block';
      emptyState.textContent = 'No suggestions returned. Try again or check Ollama.';
    }
  });

  // ---------------------------------------------------------------------------
  // Refresh button — re-reads game state without re-analyzing
  // ---------------------------------------------------------------------------
  refreshBtn.addEventListener('click', () => {
    updateInfoBar(window.parseGameState());
  });

  // ---------------------------------------------------------------------------
  // Minimize button
  // ---------------------------------------------------------------------------
  minimizeBtn.addEventListener('click', () => {
    panel.classList.toggle('hidden');
  });

  // ---------------------------------------------------------------------------
  // Analysis toggle (collapsible)
  // ---------------------------------------------------------------------------
  analysisToggle.addEventListener('click', () => {
    analysisToggle.classList.toggle('open');
    analysisText.classList.toggle('visible');
  });

  // ---------------------------------------------------------------------------
  // Drag-to-move (header)
  // ---------------------------------------------------------------------------
  let dragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  $('header').addEventListener('mousedown', (e) => {
    dragging = true;
    const rect = panel.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    e.preventDefault();
  });

  // Use document-level listeners so drag works even if cursor leaves the header
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const x = e.clientX - dragOffsetX;
    const y = e.clientY - dragOffsetY;
    // Remove fixed bottom/right positioning and switch to top/left
    panel.style.bottom = 'auto';
    panel.style.right = 'auto';
    panel.style.left = `${Math.max(0, x)}px`;
    panel.style.top = `${Math.max(0, y)}px`;
  });

  document.addEventListener('mouseup', () => { dragging = false; });

  // ---------------------------------------------------------------------------
  // Alt+D keyboard shortcut
  // ---------------------------------------------------------------------------
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key === 'd') {
      panel.classList.toggle('hidden');
      e.preventDefault();
    }
  });

  return shadow;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Entry point — wait for the game board to be ready before mounting
// ---------------------------------------------------------------------------
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountOverlay);
} else {
  mountOverlay();
}
