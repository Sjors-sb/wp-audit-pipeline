import axios from 'axios';

const REQUIRED = [
  'strict-transport-security',
  'content-security-policy',
  'x-content-type-options',
  'x-frame-options',
  'referrer-policy',
  'permissions-policy'
];

export async function collectHeaders(url) {
  const { headers: h } = await axios.get(url, {
    maxRedirects: 5,
    timeout: 15000,
  });
  const headers = Object.fromEntries(
    Object.entries(h).map(([k, v]) => [k.toLowerCase(), v])
  );
  const missing = REQUIRED.filter((k) => !(k in headers));
  return { present: headers, missing };
}
