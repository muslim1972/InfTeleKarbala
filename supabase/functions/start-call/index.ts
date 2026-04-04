// supabase/functions/start-call/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CLOUDFLARE_APP_ID = Deno.env.get('VITE_CLOUDFLARE_APP_ID')
const CLOUDFLARE_API_TOKEN = Deno.env.get('CLOUDFLARE_API_TOKEN')
const ONESIGNAL_APP_ID = Deno.env.get('VITE_ONESIGNAL_APP_ID')
const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. معالجة الـ CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. التحقق من هوية المتصل
    const authHeader = req.headers.get('Authorization')!
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

    const { recipientId, conversationId } = await req.json()

    // 3. إنشاء جلسة في Cloudflare Calls
    const cfResponse = await fetch(
      `https://rtc.live.cloudflare.com/v1/apps/${CLOUDFLARE_APP_ID}/sessions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      }
    )

    const cfData = await cfResponse.json()
    if (!cfResponse.ok) throw new Error(`Cloudflare Error: ${JSON.stringify(cfData)}`)

    const sessionId = cfData.sessionId

    // 4. إنشاء سجل المكالمة في قاعدة البيانات
    const { data: callRecord, error: callError } = await supabaseClient
      .from('calls')
      .insert({
        sender_id: user.id,
        recipient_id: recipientId,
        conversation_id: conversationId,
        cloudflare_session_id: sessionId,
        status: 'calling'
      })
      .select()
      .single()

    if (callError) throw callError

    // 5. إرسال الإشعار عبر OneSignal لإيقاظ المستقبل
    const osResponse = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_external_user_ids: [recipientId],
        headings: { en: "مكالمة واردة", ar: "مكالمة واردة" },
        contents: { en: "لديك اتصال صوتي جديد...", ar: "لديك اتصال صوتي جديد..." },
        data: { 
          type: "voice_call", 
          callId: callRecord.id, 
          sessionId: sessionId,
          conversationId: conversationId
        },
        // أندرويد يحتاج صوت تنبيه طويل (يمكنك تخصيصه لاحقاً)
        android_channel_id: "calls-channel", 
        ios_badgeType: "Increase",
        ios_badgeCount: 1
      })
    })

    return new Response(
      JSON.stringify({ callId: callRecord.id, sessionId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
