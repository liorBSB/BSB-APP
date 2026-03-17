import { appendFile } from 'node:fs/promises';

const LOG_PATH = '/Users/liorpeisakhovsky/Documents/עבודה/BSB app/.cursor/debug-acd7a1.log';

export async function POST(request) {
  try {
    const payload = await request.json();
    await appendFile(LOG_PATH, `${JSON.stringify(payload)}\n`, 'utf8');
    return new Response('ok', { status: 200 });
  } catch (e) {
    return new Response('error', { status: 500 });
  }
}

