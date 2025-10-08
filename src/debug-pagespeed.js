// src/debug-pagespeed.js
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const key = process.env.PSI_API_KEY;
const url = 'https://wpbrothers.nl';

async function run(strategy) {
  try {
    const res = await axios.get(
      `${API}?url=${encodeURIComponent(url)}&strategy=${strategy}&category=performance&key=${key}`
    );
    console.log(`✅ ${strategy} score:`, res.data.lighthouseResult.categories.performance.score);
  } catch (e) {
    console.error(`❌ ${strategy} error:`, e.response?.data?.error || e.message);
  }
}

(async () => {
  await run('mobile');
  await run('desktop');
})();
