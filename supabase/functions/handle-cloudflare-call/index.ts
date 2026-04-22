// supabase/functions/handle-cloudflare-call/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, sessionId, payload } = await req.json()
    
    // الحصول على المفاتيح من بيئة سوبابيس (يجب ضبطها مسبقاً عبر supabase secrets set)
    // نستخدم VITE_CLOUDFLARE_APP_ID للتوافق مع ملف .env الموجود
    const APP_ID = Deno.env.get('VITE_CLOUDFLARE_APP_ID') || Deno.env.get('CLOUDFLARE_APP_ID')
    const API_TOKEN = Deno.env.get('CLOUDFLARE_API_TOKEN')

    if (!APP_ID || !API_TOKEN) {
      console.error('Missing Cloudflare credentials in environment')
      return new Response(JSON.stringify({ error: 'Config error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const BASE_URL = `https://rtc.live.cloudflare.com/v1/apps/${APP_ID}`
    const headers = {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json'
    }

    let url = ''
    let method = 'POST'
    let body = JSON.stringify(payload || {})

    if (action === 'createSession') {
      url = `${BASE_URL}/sessions/new`
    } else if (action === 'addTracks') {
      if (!sessionId) throw new Error('Missing sessionId')
      url = `${BASE_URL}/sessions/${sessionId}/tracks/new`
    } else if (action === 'renegotiate') {
      if (!sessionId) throw new Error('Missing sessionId')
      url = `${BASE_URL}/sessions/${sessionId}/renegotiate`
      method = 'PUT'
    } else {
      return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    console.log(`📡 Cloudflare Request: ${method} ${url}`)
    const response = await fetch(url, { method, headers, body })
    const data = await response.json()

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error('❌ Cloudflare Edge Function Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
