import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

export async function collectUptime(url) {
  const token = process.env.BETTERUPTIME_API_TOKEN;
  if (!token) return { error: 'Missing BETTERUPTIME_API_TOKEN' };

  try {
    const hostname = new URL(url).hostname;
    const base = 'https://betteruptime.com/api/v2';
    const headers = { 'Authorization': `Bearer ${token}` };

    const monitors = await axios.get(`${base}/monitors`, { headers, timeout: 20000 })
      .then(r => r.data?.data || []);

    const match = monitors.find(m => {
      const attrs = m?.attributes || {};
      return (attrs.url || '').includes(hostname) || (attrs.name || '').includes(hostname);
    });

    if (!match) return { error: `No monitor found for host ${hostname}` };

    const m = match.attributes;
    return {
      id: match.id,
      name: m.name,
      url: m.url,
      status: m.status,
      lastCheckAt: m.last_check_at,
      lastIncidentAt: m.last_incident_at,
      expectedStatusCode: m.expected_status_code,
      monitorType: m.monitor_type
    };
  } catch (e) {
    return { error: e?.response?.data?.error || e?.message || String(e) };
  }
}
