// game-parser.js — Extracts game state from the Backstabbr DOM.
//
// IMPORTANT: Backstabbr has no public API, so this file scrapes the DOM directly.
// If Backstabbr updates their UI and this stops working, open DevTools (F12 > Elements)
// on a live game page and update the TODO selectors below to match the new structure.
//
// Exported globals (attached to window so content.js can call them):
//   window.parseGameState()  → GameState object
//   window.setupGameObserver(callback) → MutationObserver

// ---------------------------------------------------------------------------
// TODO: Verify / update these selectors against a live backstabbr.com game page.
// Open DevTools > Elements and look for these patterns.
// ---------------------------------------------------------------------------
const SEL = {
  // Element showing phase text, e.g. "Spring 1901 — Movement Phase"
  // Try multiple candidates; first match wins.
  PHASE: [
    '.phase-display',
    '.game-phase',
    '[class*="phase-name"]',
    '[class*="turn-header"]',
    'h1[class*="turn"]',
    'h2[class*="turn"]',
  ],

  // Element showing the player's own country, e.g. "England"
  MY_COUNTRY: [
    '[class*="my-country"]',
    '[class*="my-power"]',
    '[class*="player-power"]',
    '[class*="user-country"]',
    '.power-flag + span',
  ],

  // List items / rows that describe unit orders, e.g. "A LON H"
  ORDER_ITEMS: [
    '[class*="order-list"] li',
    '[class*="orders"] li',
    '.order-row',
    '[class*="order-item"]',
    '[data-order]',
  ],

  // Supply centre table rows or list items
  SUPPLY_CENTERS: [
    '[class*="supply"] tr',
    '[class*="supply"] li',
    '[class*="sc-count"]',
    '[class*="center-count"]',
  ],

  // The root game container to watch for DOM mutations
  GAME_ROOT: [
    '[class*="game-container"]',
    '[class*="game-board"]',
    '#app',
    'main',
    'body',
  ],
};

// Standard Diplomacy 3-letter territory abbreviations (used for validation)
const VALID_TERRITORIES = new Set([
  'ADR','AEG','ALB','ANK','APU','ARM','BAL','BAR','BEL','BER',
  'BLA','BOH','BRE','BUD','BUL','BUR','CLY','CON','DEN','EAS',
  'ECH','EDI','FIN','GAL','GAS','GOB','GOL','GRE','HEL','HOL',
  'ION','IRI','KIE','LON','LVN','LVP','MAO','MAR','MED','MOS',
  'MUN','NAF','NAO','NAP','NOR','NTH','NWG','NWY','PAR','PIC',
  'PIE','POR','PRU','ROM','RUH','RUM','SER','SEV','SIL','SKA',
  'SMY','SPA','STP','SWE','SYR','TRI','TUN','TUS','TYR','TYS',
  'UKR','VEN','VIA','VIE','WAL','WAR','WES','YOR',
  // Coastal variants
  'STP/NC','STP/SC','SPA/NC','SPA/SC','BUL/EC','BUL/SC',
]);

// ---------------------------------------------------------------------------
// Helper: find first matching element from a list of selectors
// ---------------------------------------------------------------------------
function queryFirst(selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

function queryAll(selectors) {
  for (const sel of selectors) {
    const els = document.querySelectorAll(sel);
    if (els.length > 0) return Array.from(els);
  }
  return [];
}

// ---------------------------------------------------------------------------
// Phase / season / year parser
// ---------------------------------------------------------------------------
function parsePhase() {
  const candidates = [
    queryFirst(SEL.PHASE)?.textContent,
    document.title,
    document.querySelector('h1')?.textContent,
    document.querySelector('h2')?.textContent,
  ];

  for (const text of candidates) {
    if (!text) continue;
    // Match "Spring 1901, Movement" or "Fall 1902 — Retreat Phase" etc.
    const m = text.match(/(Spring|Fall|Winter)\s+(\d{4})[^A-Za-z]*([A-Za-z]+(?:\s+Phase)?)/i);
    if (m) {
      return { season: m[1], year: parseInt(m[2], 10), phase: m[3].trim() };
    }
    // Just season + year without phase name
    const m2 = text.match(/(Spring|Fall|Winter)\s+(\d{4})/i);
    if (m2) {
      return { season: m2[1], year: parseInt(m2[2], 10), phase: 'Unknown' };
    }
  }
  return { season: null, year: null, phase: null };
}

// ---------------------------------------------------------------------------
// Country parser
// ---------------------------------------------------------------------------
function parseMyCountry() {
  const el = queryFirst(SEL.MY_COUNTRY);
  if (el) return el.textContent.trim();

  // Fallback: look for a country name in a prominent heading near the orders panel
  const powers = ['Austria','England','France','Germany','Italy','Russia','Turkey'];
  for (const power of powers) {
    // Case-insensitive search in page text near order panels
    const els = document.querySelectorAll('[class*="order"], [class*="power"], [class*="country"]');
    for (const el of els) {
      if (el.textContent.includes(power)) return power;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Unit parser — tries several DOM representations backstabbr might use
// ---------------------------------------------------------------------------
function parseUnits() {
  const units = [];
  const seen = new Set();

  function addUnit(type, territory) {
    const t = territory.toUpperCase().trim();
    if (!seen.has(t)) {
      seen.add(t);
      units.push({ type, territory: t });
    }
  }

  // Strategy 1: SVG <text> or <title> elements labelling units on the map
  // Backstabbr renders the map as SVG; units have labels like "A LON" or "F NTH"
  document.querySelectorAll('svg text, svg title').forEach((el) => {
    const text = el.textContent.trim();
    const m = text.match(/^([AF])\s+([A-Z]{2,3}(?:\/[NS][CE])?)\s*$/);
    if (m) addUnit(m[1] === 'A' ? 'Army' : 'Fleet', m[2]);
  });

  // Strategy 2: data attributes on SVG groups or circles
  document.querySelectorAll('[data-unit], [data-province][data-unit-type]').forEach((el) => {
    const type = el.dataset.unitType || el.dataset.unit;
    const territory = el.dataset.province || el.dataset.territory;
    if (type && territory) {
      addUnit(type.includes('fleet') || type === 'F' ? 'Fleet' : 'Army', territory);
    }
  });

  // Strategy 3: Order list items often list units e.g. "A PAR - BUR"
  queryAll(SEL.ORDER_ITEMS).forEach((el) => {
    const text = el.textContent.trim();
    const m = text.match(/\b([AF])\s+([A-Z]{2,3}(?:\/[NS][CE])?)\b/);
    if (m && VALID_TERRITORIES.has(m[2])) {
      addUnit(m[1] === 'A' ? 'Army' : 'Fleet', m[2]);
    }
  });

  return units;
}

// ---------------------------------------------------------------------------
// Submitted orders parser
// ---------------------------------------------------------------------------
function parseSubmittedOrders() {
  const orders = [];
  queryAll(SEL.ORDER_ITEMS).forEach((el) => {
    const text = el.textContent.trim();
    if (text.length > 2) orders.push(text);
  });
  return orders;
}

// ---------------------------------------------------------------------------
// Supply centre count parser
// ---------------------------------------------------------------------------
function parseSupplyCenters() {
  const counts = {};
  const powers = ['Austria','England','France','Germany','Italy','Russia','Turkey'];

  // Try dedicated supply-centre elements
  queryAll(SEL.SUPPLY_CENTERS).forEach((el) => {
    const text = el.textContent.trim();
    // "England: 3" or "France (5)" or "Germany — 4"
    const m = text.match(/([A-Za-z]+)\s*[:\(\-–]\s*(\d+)/);
    if (m && powers.some((p) => p.toLowerCase().startsWith(m[1].toLowerCase().slice(0, 3)))) {
      counts[m[1]] = parseInt(m[2], 10);
    }
  });

  // Fallback: scan all text nodes for power + number patterns
  if (Object.keys(counts).length === 0) {
    powers.forEach((power) => {
      const regex = new RegExp(power + '\\D+(\\d+)\\s*(?:SC|supply|center)', 'i');
      const m = document.body.textContent.match(regex);
      if (m) counts[power] = parseInt(m[1], 10);
    });
  }

  return counts;
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------
window.parseGameState = function () {
  const { season, year, phase } = parsePhase();
  return {
    season,
    year,
    phase,
    myCountry: parseMyCountry(),
    units: parseUnits(),
    supplyCenters: parseSupplyCenters(),
    submittedOrders: parseSubmittedOrders(),
  };
};

// ---------------------------------------------------------------------------
// MutationObserver — calls callback when the game state likely changed
// (phase transition, order update, etc.)
// ---------------------------------------------------------------------------
window.setupGameObserver = function (callback) {
  let debounceTimer = null;

  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => callback(window.parseGameState()), 500);
  });

  const root = queryFirst(SEL.GAME_ROOT) || document.body;
  observer.observe(root, { childList: true, subtree: true, characterData: true });
  return observer;
};
