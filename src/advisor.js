// advisor.js — Builds a Diplomacy prompt from game state and calls the background
// service worker to get Ollama's order suggestions.
//
// Exported global: window.getAdvisorSuggestions(gameState) → Promise<SuggestionResult>
//
// SuggestionResult shape:
//   { ok: true,  result: { orders: [{unit, order, reason}], analysis: string } }
//   { ok: false, error: string }

const SYSTEM_PROMPT = `You are an expert Diplomacy board game strategist. You know the rules perfectly.

STRICT RULES — never violate these:
1. Each unit gets exactly ONE order.
2. Army (A): can only move to adjacent LAND or COASTAL territories. Cannot move to pure sea zones. Cannot convoy itself.
3. Fleet (F): can only move to adjacent SEA zones or COASTAL territories. Cannot move inland.
4. A fleet CONVOYS an army across water: the fleet stays put and writes "F SEA C A LAND1 - LAND2". The army writes "A LAND1 - LAND2". The fleet does NOT move when convoying.
5. Support: a unit supports an adjacent unit. "A X S A Y - Z" means army in X supports army in Y moving to Z. The supporting unit must be adjacent to the destination.
6. You cannot move to a territory already occupied by your own unit (unless it is moving away simultaneously).
7. Hold is always legal: "A X H".

STANDARD TERRITORY ADJACENCIES (key ones):
- ANK (Ankara, coastal): adjacent to BLA, CON, ARM, SMY is NOT adjacent to ANK directly
- CON (Constantinople, coastal): adjacent to BUL, ANK, SMY, AEG, BLA
- SMY (Smyrna, coastal): adjacent to CON, ANK, ARM, SYR, AEG, EAS
- BLA (Black Sea): adjacent to ANK, CON, BUL/EC, RUM, SEV, ARM
- BUL (Bulgaria): has coasts BUL/EC (east) and BUL/SC (south). Adjacent to CON, GRE, SER, RUM
- ARM (Armenia, coastal): adjacent to ANK, SMY, SEV, BLA

CLASSIC TURKEY OPENINGS (Spring 1901):
- Aggressive: F ANK - BLA, A CON - BUL, A SMY - CON  (contests Black Sea, takes Bulgaria)
- Safe: F ANK - CON, A CON - BUL, A SMY - ARM  (avoids Black Sea conflict)
- Lepanto setup: F ANK - CON, A CON - SMY, A SMY - ARM  (stack fleets for Mediterranean)

OUTPUT FORMAT — respond with ONLY valid JSON, no markdown, no preamble:
{
  "orders": [
    {
      "unit": "F ANK",
      "order": "F ANK - BLA",
      "reason": "Contests the Black Sea, key for Turkish expansion"
    }
  ],
  "analysis": "2-3 sentence strategic overview of the position and plan"
}

Think step by step about adjacency before writing each order. Only suggest moves that are physically possible.`;

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
