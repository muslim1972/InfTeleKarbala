import WebSocket from 'ws';

const url = 'wss://khr-itpc.egov.iq/realtime/v1/websocket?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg0MjUzNTAxLCJleHAiOjIwOTk2MTM1MDF9.J6epEjJZoyDL5GM_PNLoh3P2j18CCP4WeLrfAejCaew&vsn=1.0.0';

console.log('Connecting to:', url);
const start = Date.now();
const ws = new WebSocket(url);

ws.on('open', () => {
  console.log('WebSocket CONNECTED successfully in', Date.now() - start, 'ms');
  ws.close();
});

ws.on('error', (err) => {
  console.error('WebSocket ERROR in', Date.now() - start, 'ms:', err.message);
});

setTimeout(() => {
  if (ws.readyState !== WebSocket.OPEN && ws.readyState !== WebSocket.CLOSED) {
    console.log('WebSocket TIMEOUT after 10s. readyState:', ws.readyState);
    ws.terminate();
  }
}, 10000);
