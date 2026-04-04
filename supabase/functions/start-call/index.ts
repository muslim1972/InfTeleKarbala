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

console.log('🌟 Function loaded');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('📡 Request received');

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. استلام البيانات من المتصفح (بما فيها SDP Offer)
    const { recipientId, conversationId, sdpOffer, senderId } = await req.json()
    console.log(`📞 Call: ${senderId} → ${recipientId}`);

    // 2. إنشاء جلسة + إضافة Track في Cloudflare (طلب واحد)
    const cfUrl = `https://rtc.live.cloudflare.com/v1/apps/${CLOUDFLARE_APP_ID}/sessions/new`
    console.log(`📧 Cloudflare URL: ${cfUrl}`);

    const cfBody = {
      sessionDescription: {
        type: 'offer',
        sdp: sdpOffer
      },
      tracks: [{
        location: 'local',
        trackName: `audio-${senderId}`,
      }]
    }

    const cfResponse = await fetch(cfUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(cfBody)
    })

    const cfRawText = await cfResponse.text()
    console.log(`📧 CF Status: ${cfResponse.status}`);
    console.log(`📧 CF Body: ${cfRawText.substring(0, 500)}`);

    if (!cfResponse.ok) {
      throw new Error(`Cloudflare Error (${cfResponse.status}): ${cfRawText}`)
    }

    const cfData = JSON.parse(cfRawText)
    const sessionId = cfData.sessionId
    const sdpAnswer = cfData.sessionDescription
    console.log(`✅ CF Session: ${sessionId}`);

    // 3. حفظ سجل المكالمة في قاعدة البيانات
    console.log('💾 Saving to DB...');
    const { data: callRecord, error: callError } = await supabaseClient
      .from('calls')
      .insert({
        sender_id: senderId,
        recipient_id: recipientId,
        conversation_id: conversationId,
        cloudflare_session_id: sessionId,
        status: 'calling',
        offer_sdp: { audioTrack: `audio-${senderId}` }
      })
      .select()
      .single()

    if (callError) {
      console.error('❌ DB Error:', callError);
      throw callError;
    }
    console.log(`✅ DB Record: ${callRecord.id}`);

    // 4. إرسال إشعار OneSignal (لا نوقف الدالة إذا فشل)
    try {
      console.log('🔔 Sending notification...');
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
          data: { type: "voice_call", callId: callRecord.id, sessionId, conversationId },
          android_channel_id: "calls-channel",
        })
      })
      console.log(`🔔 Notification: ${osResponse.status}`);
    } catch (notifError) {
      console.error('⚠️ Notification failed (non-blocking):', notifError);
    }

    // 5. إرجاع كل شيء للمتصفح
    return new Response(
      JSON.stringify({ 
        callId: callRecord.id, 
        sessionId,
        sdpAnswer // الـ SDP Answer من Cloudflare
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error(`🚨 Error: ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
