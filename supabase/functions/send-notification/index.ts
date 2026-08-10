import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { recipientId, title, message, url, data, isBuzz, type } = await req.json()

    if (!recipientId || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing recipientId or message' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const appId = Deno.env.get('VITE_ONESIGNAL_APP_ID') || "beae0757-7abe-46a8-b223-8f6c65e47fb5";
    let restKey = Deno.env.get('ONESIGNAL_REST_API_KEY');

    if (!restKey) {
      console.error('OneSignal: REST API Key is missing in environment variables');
      return new Response(
        JSON.stringify({ error: 'OneSignal REST API Key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (restKey.startsWith('Basic ')) {
      restKey = restKey.replace('Basic ', '');
    }

    console.log(`OneSignal: Attempting to notify recipient ${recipientId} [Type: ${type || 'default'}]`);
    
    let androidCategory = type === 'call' ? 'call' : 'msg';
    
    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': restKey.startsWith('os_v2_app_') ? `Key ${restKey}` : `Basic ${restKey}`
      },
      body: JSON.stringify({
        app_id: appId,
        include_aliases: { external_id: [recipientId] },
        target_channel: "push",
        contents: { en: message, ar: message },
        headings: { 
          en: isBuzz ? "🚨 ALERT 🚨" : (title || "New Notification"), 
          ar: isBuzz ? "🚨 تنبيه عاجل 🚨" : (title || "تنبيه جديد") 
        },
        url: url || undefined,
        data: { ...(data || {}), isBuzz: !!isBuzz, type: type || 'default' },
        android_channel_id: "3baae7ba-ec2d-483a-8c60-8aaefcd2ff08",
        android_category: androidCategory,
        content_available: true,
        ...(isBuzz ? {
          android_sound: "buzz",
          ios_sound: "buzz.wav",
          android_vibration_pattern: [200, 100, 200, 100, 1000],
          ttl: 3600,
          web_push_topic: "urgent_call"
        } : {
          ttl: 3600,
        }),
        priority: 10,
        android_visibility: 1,
        ios_badgeType: "Increase",
        ios_badgeCount: 1,
        android_group: data?.conversationId || "chat",
        thread_id: data?.conversationId || "chat"
      })
    });

    const result = await response.json();
    console.log('OneSignal API Response:', JSON.stringify(result));
    
    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('OneSignal notification error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to send notification' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
