import dotenv from 'dotenv';
dotenv.config();

const restKey = process.env.ONESIGNAL_REST_API_KEY;
const appId = "beae0757-7abe-46a8-b223-8f6c65e47fb5";
const recipientId = "4b16b87b-04ba-4bc7-8958-462f74b8c073";

async function testPush() {
  console.log("Using REST API KEY:", restKey ? "Found" : "Not Found");
  try {
    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${restKey}`
      },
      body: JSON.stringify({
        app_id: appId,
        include_aliases: { external_id: [recipientId] },
        target_channel: "push",
        contents: { en: "Test message", ar: "رسالة تجريبية" },
        headings: { en: "Test", ar: "تجربة" },
      })
    });
    const result = await response.json();
    console.log("Response:", response.status, result);
  } catch (error) {
    console.error("Error:", error);
  }
}

testPush();
