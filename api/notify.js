
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { recipientId, title, message, url, data } = req.body;

  if (!recipientId || !message) {
    return res.status(400).json({ error: 'Missing recipientId or message' });
  }

  const appId = "beae0757-7abe-46a8-b223-8f6c65e47fb5";
  const restKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!restKey) {
    return res.status(500).json({ error: 'OneSignal REST API Key not configured' });
  }

  try {
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
        headings: { en: title || "New Notification", ar: title || "تنبيه جديد" },
        url: url || null,
        data: data || {},
        // Ensure sound and priority are high
        android_sound: "notification",
        ios_sound: "notification.wav",
        priority: 10, // High priority for Android
        android_visibility: 1, // Public
        ios_badgeType: "Increase",
        ios_badgeCount: 1,
        ttl: 3600, // 1 hour time to live
        android_group: conversationId || "chat",
        thread_id: conversationId || "chat"
      })
    });

    const result = await response.json();
    return res.status(200).json(result);
  } catch (error) {
    console.error('OneSignal notification error:', error);
    return res.status(500).json({ error: 'Failed to send notification' });
  }
}
