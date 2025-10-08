import axios from 'axios';
export async function fetchJson(url, config = {}) {
  const { data } = await axios.get(url, { timeout: 30000, ...config });
  return data;
}
