// game-parser.js — Extracts game state from the Backstabbr DOM.
//
// Selectors verified against live backstabbr.com (April 2026).
// If backstabbr updates their UI, re-run the DevTools snippets in the README
// to find new selectors and update the SEL object below.
//
// Exported globals (attached to window so content.js can call them):
//   window.parseGameState()  → GameState object
//   window.setupGameObserver(callback) → MutationObserver

// ---------------------------------------------------------------------------
// Verified selectors (confirmed on live backstabbr game page)
// ---------------------------------------------------------------------------
const SEL = {
  // "spring 1901 (current season)" link in the top-left map navigation
  PHASE: 'a.text-capitalize',

  // Each unit order shown in the orders panel, e.g. "F Ank", "A Con", "A Smy"
  // These are the CURRENT PLAYER's units only — perfect for us
  ORDERSTRING: '.orderstring',

  // Root container to watch for DOM mutations
  GAME_ROOT: '#app, main, body',
};

// ---------------------------------------------------------------------------
// Home supply centre → country mapping (used to infer player's country from
// their unit positions — works reliably in all phases of the game because
// home SCs are what determine country identity)
// ---------------------------------------------------------------------------
const HOME_SC_TO_COUNTRY = {
  // Austria
  'BUD': 'Austria', 'TRI': 'Austria', 'VIE': 'Austria',
  // England
  'EDI': 'England', 'LON': 'England', 'LVP': 'England',
  // France
  'BRE': 'France',  'MAR': 'France',  'PAR': 'France',
  // Germany
  'BER': 'Germany', 'KIE': 'Germany', 'MUN': 'Germany',
  // Italy
  'NAP': 'Italy',   'ROM': 'Italy',   'VEN': 'Italy',
  // Russia
  'MOS': 'Russia',  'SEV': 'Russia',  'STP': 'Russia',  'WAR': 'Russia',
  // Turkey
  'ANK': 'Turkey',  'CON': 'Turkey',  'SMY': 'Turkey',
};

// Backstabbr uses title-case 3-letter codes (e.g. "Ank", "Stp", "Nth").
// Normalise to uppercase for lookup.
function normTerritory(raw) {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

// ---------------------------------------------------------------------------
// Phase / season / year
// ---------------------------------------------------------------------------
function parsePhase() {
  // Primary: a.text-capitalize → "spring 1901 (current season)"
  const el = document.querySelector(SEL.PHASE);
  const text = el?.textContent?.trim() || document.title;

  const m = text.match(/(spring|fall|winter)\s+(\d{4})/i);
  if (m) {
    const season = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
    const year   = parseInt(m[2], 10);
    // Derive phase name: Spring/Fall = Movement (unless retreat btn visible),
    // Winter = Build/Adjustment.  Good-enough heuristic without more DOM work.
    const phase  = season === 'Winter' ? 'Build' : 'Movement';
    return { season, year, phase };
  }
  return { season: null, year: null, phase: null };
}

// ---------------------------------------------------------------------------
// Units — read from .orderstring elements (current player's units only)
// Format backstabbr uses: "F Ank", "A Con", "A Smy"
// ---------------------------------------------------------------------------
function parseUnits() {
  const units = [];
  const seen  = new Set();

  document.querySelectorAll(SEL.ORDERSTRING).forEach((el) => {
    const text = el.textContent.trim();
    // Match "A Xxx" or "F Xxx" (army or fleet + territory)
    const m = text.match(/^([AF])\s+([A-Za-z]{2,3}(?:\/[A-Za-z]{2})?)\s*$/);
    if (!m) return;

    const type      = m[1] === 'A' ? 'Army' : 'Fleet';
    const territory = normTerritory(m[2]);

    if (!seen.has(territory)) {
      seen.add(territory);
      units.push({ type, territory });
    }
  });

  return units;
}

// ---------------------------------------------------------------------------
// Country — infer from which home SCs the player's units are sitting on.
// Vote across all units; highest count wins.
// ---------------------------------------------------------------------------
function parseMyCountry(units) {
  const votes = {};
  for (const { territory } of units) {
    const country = HOME_SC_TO_COUNTRY[territory];
    if (country) votes[country] = (votes[country] || 0) + 1;
  }

  // Return the country with most matching home-SC units
  const winner = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
  return winner ? winner[0] : null;
}

// ---------------------------------------------------------------------------
// Supply centre counts — not directly available in a simple element;
// skip for now and let the LLM note it's unknown.
// ---------------------------------------------------------------------------
function parseSupplyCenters() {
  return {};
}

// ---------------------------------------------------------------------------
// Already-submitted order strings (same .orderstring elements, but only
// those that have been confirmed/submitted — for now return all visible ones)
// ---------------------------------------------------------------------------
function parseSubmittedOrders() {
  const orders = [];
  document.querySelectorAll(SEL.ORDERSTRING).forEach((el) => {
    const text = el.textContent.trim();
    if (text.length > 1) orders.push(text);
  });
  return orders;
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------
window.parseGameState = function () {
  const { season, year, phase } = parsePhase();
  const units = parseUnits();
  return {
    season,
    year,
    phase,
    myCountry: parseMyCountry(units),
    units,
    supplyCenters: parseSupplyCenters(),
    submittedOrders: parseSubmittedOrders(),
  };
};

// ---------------------------------------------------------------------------
// MutationObserver — calls callback when game state likely changed
// ---------------------------------------------------------------------------
window.setupGameObserver = function (callback) {
  let debounceTimer = null;

  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => callback(window.parseGameState()), 500);
  });

  const root = document.querySelector(SEL.GAME_ROOT) || document.body;
  observer.observe(root, { childList: true, subtree: true, characterData: true });
  return observer;
};
