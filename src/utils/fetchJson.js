import axios from 'axios';
export async function fetchJson(url) { const {data} = await axios.get(url); return data; }
