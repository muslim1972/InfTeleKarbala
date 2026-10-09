import { RoomServiceClient } from 'livekit-server-sdk';

const livekitHost = 'wss://info-tele-karbala-l87sl248.livekit.cloud';
const apiKey = 'APIKftLbfyRPBAM';
const apiSecret = 'tAhoYjew8OjGD1t6G8N5jtEze5tgVh9pl5eaR6WVEcZB';

async function checkLiveKit() {
  const roomService = new RoomServiceClient(livekitHost, apiKey, apiSecret);
  try {
    console.log("Checking LiveKit connection...");
    const rooms = await roomService.listRooms();
    console.log("Success! Found rooms:", rooms.length);
  } catch (error) {
    console.error("Failed to connect to LiveKit:", error.message);
  }
}

checkLiveKit();
