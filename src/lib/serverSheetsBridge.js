const SOLDIER_SCRIPT_URL = process.env.SOLDIER_SHEETS_SCRIPT_URL;
const RECEPTION_SCRIPT_URL = process.env.RECEPTION_SCRIPT_URL;
const LEFT_SOLDIERS_SCRIPT_URL = process.env.LEFT_SOLDIERS_SCRIPT_URL;
const SHEETS_BRIDGE_SECRET = process.env.SHEETS_BRIDGE_SECRET;

function withBridgeSecret(url) {
  if (!SHEETS_BRIDGE_SECRET) return url;
  const u = new URL(url);
  u.searchParams.set('secret', SHEETS_BRIDGE_SECRET);
  return u.toString();
}

export function ensureBridgeConfig(name, value) {
  if (!value) throw new Error(`${name} is not configured`);
}

export async function fetchAllSoldiersFromSheets() {
  ensureBridgeConfig('SOLDIER_SHEETS_SCRIPT_URL', SOLDIER_SCRIPT_URL);
  const url = withBridgeSecret(`${SOLDIER_SCRIPT_URL}?action=getAllSoldiers`);
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Sheets read failed: HTTP ${response.status}`);
  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'Sheets read failed');
  return data.soldiers || [];
}

export async function searchSoldiersInSheets(searchTerm) {
  ensureBridgeConfig('SOLDIER_SHEETS_SCRIPT_URL', SOLDIER_SCRIPT_URL);
  const term = String(searchTerm || '').trim();
  if (term.length < 2) return [];
  const url = withBridgeSecret(
    `${SOLDIER_SCRIPT_URL}?action=searchSoldiers&searchTerm=${encodeURIComponent(term)}`
  );
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Sheets search failed: HTTP ${response.status}`);
  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'Sheets search failed');
  return data.soldiers || [];
}

export async function updateSoldierInSheets(sheetPayload) {
  ensureBridgeConfig('SOLDIER_SHEETS_SCRIPT_URL', SOLDIER_SCRIPT_URL);
  const body = { action: 'updateSoldierData', data: sheetPayload };
  const url = withBridgeSecret(SOLDIER_SCRIPT_URL);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Sheets update failed: HTTP ${response.status}`);
  const data = await response.json();
  if (!data.success) throw new Error(data.error || data.message || 'Sheets update failed');
  return data;
}

export async function fetchReceptionRows() {
  ensureBridgeConfig('RECEPTION_SCRIPT_URL', RECEPTION_SCRIPT_URL);
  const url = withBridgeSecret(`${RECEPTION_SCRIPT_URL}?t=${Date.now()}`);
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Reception read failed: HTTP ${response.status}`);
  return response.json();
}

export async function updateReceptionStatusById(id, status) {
  ensureBridgeConfig('RECEPTION_SCRIPT_URL', RECEPTION_SCRIPT_URL);
  const url = withBridgeSecret(RECEPTION_SCRIPT_URL);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, status }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Reception update failed: HTTP ${response.status}`);
  const data = await response.json();
  if (data.status !== 'success') throw new Error(data.message || 'Reception update failed');
  return data;
}

export async function archiveSoldierToSheet(exportData) {
  ensureBridgeConfig('LEFT_SOLDIERS_SCRIPT_URL', LEFT_SOLDIERS_SCRIPT_URL);
  const url = withBridgeSecret(LEFT_SOLDIERS_SCRIPT_URL);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'archiveSoldier', data: exportData }),
    cache: 'no-store',
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Archive export failed: HTTP ${response.status} - ${text}`);
  try {
    const parsed = JSON.parse(text);
    if (!parsed.success) throw new Error(parsed.error || 'Archive export failed');
    return parsed;
  } catch (error) {
    throw new Error(error.message || 'Archive export returned invalid response');
  }
}
