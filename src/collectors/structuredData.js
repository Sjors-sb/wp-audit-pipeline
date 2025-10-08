import axios from 'axios';

export async function collectStructuredData(url) {
  const { data: html } = await axios.get(url, { timeout: 20000 });
  const scripts = [...html.matchAll(/<script[^>]+type=\"application\/ld\+json\"[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(m => m[1]);
  const parsed = scripts.map((s) => {
    try { return JSON.parse(s); } catch (e) { return null; }
  }).filter(Boolean);
  return {
    found: parsed.length > 0,
    items: parsed.slice(0, 3)
  };
}
