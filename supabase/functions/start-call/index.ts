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
        target_channel: "push",
        // تمت إزالة app_url: url لمنع مشكلة فتح علامة تبويب PWA إضافية، 
        // بدون رابط سيقوم المتصفح/الهاتف بوضع التركيز Focus على التطبيق المفتوح حالياً
        // استخدام الطريقة الحديثة لتحديد المستلم
        include_aliases: { external_id: [recipientId] },
        // التوافق الرجعي
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
        priority: 10,
        android_visibility: 1,
        android_channel_id: "3baae7ba-ec2d-483a-8c60-8aaefcd2ff08",
        android_category: "call",
        content_available: true,
        lock_screen_visibility: 1,
        require_interaction: true, // الإشعار يبقى ظاهراً حتى يتفاعل معه المستخدم
        ttl: 30, // تنتهي صلاحية الإشعار بعد 30 ثانية
      })
    })

    const result = await response.text()
    console.log(`🔔 OneSignal response (${response.status}): ${result.substring(0, 200)}`);

    return new Response(
      JSON.stringify({ sent: response.ok, status: response.status }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    console.error(`❌ Error: ${err.message}`);
    return new Response(
      JSON.stringify({ sent: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
