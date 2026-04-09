// advisor.js — Builds a Diplomacy prompt from game state and calls the background
// service worker to get Ollama's order suggestions.
//
// Exported global: window.getAdvisorSuggestions(gameState) → Promise<SuggestionResult>
//
// SuggestionResult shape:
//   { ok: true,  result: { orders: [{unit, order, reason}], analysis: string } }
//   { ok: false, error: string }

const SYSTEM_PROMPT = `You are an expert Diplomacy strategy advisor. The user is playing on Backstabbr.com.

Given the current game state (season, phase, country, unit positions, supply center counts, and existing orders), suggest the best order for EACH of the player's units. Also provide a short overall strategic analysis.

OUTPUT FORMAT — respond with ONLY valid JSON, no markdown, no extra text:
{
  "orders": [
    {
      "unit": "A PAR",
      "order": "A PAR - BUR",
      "reason": "Captures a neutral supply center"
    }
  ],
  "analysis": "2-3 sentence strategic overview"
}

Diplomacy order notation:
- Hold:            A LON H
- Move:            A LON - YOR
- Support hold:    A LON S F NTH H
- Support move:    A LON S A YOR - EDI
- Convoy:          F NTH C A LON - NWY   (fleet convoys an army)
- Convoy move:     A LON - NWY via convoy (army being convoyed)

Units are Army (A) or Fleet (F). Each unit is in one territory.
If the game state is sparse or you cannot determine exact positions, still provide your best strategic advice based on what is available.`;

function buildUserMessage(gameState) {
  const { season, year, phase, myCountry, units, supplyCenters, submittedOrders } = gameState;

  const context = {
    currentTurn: `${season || '?'} ${year || '?'} — ${phase || '?'} Phase`,
    myCountry: myCountry || 'Unknown',
    myUnits: units.length > 0
      ? units.map((u) => `${u.type === 'Army' ? 'A' : 'F'} ${u.territory}`)
      : ['(no units detected — describe your position manually)'],
    supplyCenterCounts: Object.keys(supplyCenters).length > 0
      ? supplyCenters
      : '(not detected)',
    alreadySubmittedOrders: submittedOrders.length > 0
      ? submittedOrders
      : [],
  };

  return JSON.stringify(context, null, 2);
}

window.getAdvisorSuggestions = function (gameState) {
  return new Promise((resolve) => {
    const userMessage = buildUserMessage(gameState);

    chrome.runtime.sendMessage(
      { type: 'OLLAMA_REQUEST', systemPrompt: SYSTEM_PROMPT, userMessage },
      (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: 'Extension messaging error: ' + chrome.runtime.lastError.message });
          return;
        }
        resolve(response || { ok: false, error: 'No response from background worker.' });
      }
    );
  });
};
