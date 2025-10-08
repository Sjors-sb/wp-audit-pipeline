import axios from 'axios';
import dns from 'dns';
import { promisify } from 'util';

const REQUIRED = [
  'strict-transport-security',
  'content-security-policy',
  'x-content-type-options',
  'x-frame-options',
  'referrer-policy',
  'permissions-policy'
];

const resolve6 = promisify(dns.resolve6);

export async function collectHeaders(url) {
  const { headers: h } = await axios.get(url, {
    maxRedirects: 5,
    timeout: 20000,
  });
  const headers = Object.fromEntries(
    Object.entries(h).map(([k, v]) => [k.toLowerCase(), v])
  );
  const missing = REQUIRED.filter((k) => !(k in headers));

  // IPv6 check
  let ipv6 = false;
  try {
    const hostname = new URL(url).hostname;
    const addrs = await resolve6(hostname);
    ipv6 = Array.isArray(addrs) && addrs.length > 0;
  } catch (_) {
    ipv6 = false;
  }

  return { present: headers, missing, ipv6 };
}
