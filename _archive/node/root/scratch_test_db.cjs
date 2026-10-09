const net = require('net');

function checkPort(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      resolve(false);
    });
    socket.connect(port, 'khr-itpc.egov.iq');
  });
}

async function testPorts() {
  console.log('5432:', await checkPort(5432));
  console.log('6543:', await checkPort(6543));
  console.log('54322:', await checkPort(54322));
}

testPorts();
