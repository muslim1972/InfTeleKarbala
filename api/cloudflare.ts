// api/cloudflare.ts
// مسار Vercel Serverless Function لخدمة InfTeleKarbala كبروكسي آمن لـ Cloudflare Calls

export default async function handler(req: any, res: any) {
  // نقبل فقط طلبات POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { action, sessionId, payload } = req.body;
  const APP_ID = process.env.VITE_CLOUDFLARE_APP_ID;
  const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

  if (!APP_ID || !API_TOKEN) {
    return res.status(500).json({ error: 'Missing Cloudflare credentials in Vercel environment' });
  }

  const BASE_URL = `https://rtc.live.cloudflare.com/v1/apps/${APP_ID}`;
  const headers = {
    'Authorization': `Bearer ${API_TOKEN}`,
    'Content-Type': 'application/json'
  };

  try {
    if (action === 'createSession') {
      const r = await fetch(`${BASE_URL}/sessions/new`, { method: 'POST', headers });
      const data = await r.json();
      return res.status(r.status).json(data);
    } 
    else if (action === 'addTracks') {
      if (!sessionId || !payload) return res.status(400).json({ error: 'Missing sessionId or payload' });
      const r = await fetch(`${BASE_URL}/sessions/${sessionId}/tracks/new`, {
        method: 'POST', headers, body: JSON.stringify(payload)
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    } 
    else if (action === 'renegotiate') {
      if (!sessionId || !payload) return res.status(400).json({ error: 'Missing sessionId or payload' });
      const r = await fetch(`${BASE_URL}/sessions/${sessionId}/renegotiate`, {
        method: 'PUT', headers, body: JSON.stringify(payload)
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    } 
    else {
      return res.status(400).json({ error: 'Invalid action parameter' });
    }
  } catch (error: any) {
    console.error('Cloudflare Proxy Error:', error);
    return res.status(500).json({ error: 'Proxy request failed', details: error.message });
  }
}
