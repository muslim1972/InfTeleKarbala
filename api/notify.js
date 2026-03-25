export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { recipientId, title, message, url, data, isBuzz } = req.body;

  if (!recipientId || !message) {
    return res.status(400).json({ error: 'Missing recipientId or message' });
  }

  const appId = "beae0757-7abe-46a8-b223-8f6c65e47fb5";
  let restKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!restKey) {
    console.error('OneSignal: REST API Key is missing in environment variables');
    return res.status(500).json({ error: 'OneSignal REST API Key not configured' });
  }

  // Ensure restKey is just the key, not starting with "Basic "
  if (restKey.startsWith('Basic ')) {
    restKey = restKey.replace('Basic ', '');
  }

  try {
    console.log(`OneSignal: Attempting to notify recipient ${recipientId}`);
    
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${restKey}`
      },
        body: JSON.stringify({
          app_id: appId,
          include_external_user_ids: [recipientId],
          contents: { en: message, ar: message },
          headings: { 
            en: isBuzz ? "🚨 ALERT 🚨" : (title || "New Notification"), 
            ar: isBuzz ? "🚨 تنبيه عاجل 🚨" : (title || "تنبيه جديد") 
          },
          url: url || null,
          data: { ...(data || {}), isBuzz: !!isBuzz },
          // Custom sound and channel ONLY for Buzz
          ...(isBuzz ? {
            android_sound: "buzz",
            ios_sound: "buzz.wav",
            android_channel_id: "buzz_channel",
            ttl: 0,
          } : {
            // Normal message settings
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
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('OneSignal notification error:', error);
    return res.status(500).json({ error: 'Failed to send notification' });
  }
}
