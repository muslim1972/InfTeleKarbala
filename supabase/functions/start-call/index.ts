// supabase/functions/start-call/index.ts
// دالة إرسال إشعار المكالمة الواردة عبر OneSignal
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const ONESIGNAL_APP_ID = Deno.env.get('VITE_ONESIGNAL_APP_ID')
const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { recipientId, callId, callerName } = await req.json()
    console.log(`🔔 Sending call notification to ${recipientId}`);

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      console.warn('⚠️ OneSignal not configured');
      return new Response(
        JSON.stringify({ sent: false, reason: 'OneSignal not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_external_user_ids: [recipientId],
        headings: { en: "مكالمة واردة 📞", ar: "مكالمة واردة 📞" },
        contents: { 
          en: `${callerName || 'زميل'} يتصل بك...`, 
          ar: `${callerName || 'زميل'} يتصل بك...` 
        },
        data: { 
          type: "voice_call", 
          callId 
        },
        android_channel_id: "calls-channel",
        priority: 10,
        ttl: 30, // تنتهي صلاحية الإشعار بعد 30 ثانية
      })
    })

    const result = await response.text()
    console.log(`🔔 OneSignal response (${response.status}): ${result.substring(0, 200)}`);

    return new Response(
      JSON.stringify({ sent: response.ok, status: response.status }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return new Response(
      JSON.stringify({ sent: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
