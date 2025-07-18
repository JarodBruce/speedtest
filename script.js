const startBtn = document.getElementById('startBtn');
const downloadResult = document.getElementById('download');
const uploadResult = document.getElementById('upload');
const connectionsInput = document.getElementById('connections');
const durationInput = document.getElementById('duration');
const ipResult = document.getElementById('ip');

// Establish a single, persistent WebSocket connection
const socket = new WebSocket('ws://' + location.host + '/ws');

socket.onopen = () => {
    console.log('WebSocket connection established.');
    startBtn.disabled = false;
};

socket.onmessage = (event) => {
    // Handle messages from the server
    if (event.data.startsWith('Your IP is:')) {
        console.log('IP message received:', ipResult.textContent);
        if(ipResult.textContent.includes("172.16.0.10")) {
            ipResult.textContent = "172.17.0.1";
            console.log('IP message received:', ipResult.textContent);
            ipResult.textContent = event.data.split(': ')[1];
        }else if(ipResult.textContent.includes("172.16.0.20")) {
            ipResult.textContent = "172.18.0.1";
            console.log('IP message received:', ipResult.textContent);
            ipResult.textContent = event.data.split(': ')[1];
        }
    } else {
        // Assume other messages are for speed testing
        // This part needs further implementation if the server sends back speed results
    }
};

socket.onclose = () => {
    console.log('WebSocket connection closed.');
    startBtn.disabled = true;
};

socket.onerror = (error) => {
    console.error('WebSocket error:', error);
    startBtn.disabled = true;
};

startBtn.addEventListener('click', () => {
    const connections = parseInt(connectionsInput.value);
    const duration = parseInt(durationInput.value) * 1000;
    
    // For simplicity, we'll still create temporary connections for the test
    // A more advanced implementation would multiplex over the single connection
    startTest(connections, duration);
});

async function startTest(connections, duration) {
    downloadResult.textContent = 'Testing...';
    uploadResult.textContent = 'Testing...';

    const downloadSpeed = await measureDownload(connections, duration);
    downloadResult.textContent = downloadSpeed.toFixed(2);

    const uploadSpeed = await measureUpload(connections, duration);
    uploadResult.textContent = uploadSpeed.toFixed(2);
}

function createWebSocket() {
    // This now creates temporary sockets for the test itself
    return new WebSocket('ws://' + location.host + '/ws');
}

async function measureDownload(connectionCount, duration) {
    let totalBytes = 0;
    const sockets = [];

    for (let i = 0; i < connectionCount; i++) {
        const socket = createWebSocket();
        socket.binaryType = 'arraybuffer';
        sockets.push(socket);

        // We need to skip the initial IP message
        let ipMessageSkipped = false;
        socket.onmessage = (event) => {
            if (typeof event.data === 'string' && event.data.startsWith('Your IP is:')) {
                ipMessageSkipped = true;
                return;
            }
            totalBytes += event.data.byteLength;
        };

        await new Promise(resolve => socket.onopen = () => {
            socket.send('download');
            resolve();
        });
    }

    await new Promise(resolve => setTimeout(resolve, duration));

    sockets.forEach(socket => socket.close());

    return (totalBytes * 8) / (duration / 1000) / 1000000; // Mbps
}

async function measureUpload(connectionCount, duration) {
    let totalBytes = 0;
    const sockets = [];
    const data = new ArrayBuffer(1024 * 64); // 64KB chunk
    const highWaterMark = 1024 * 1024 * 4; // 4MB buffer limit

    for (let i = 0; i < connectionCount; i++) {
        const socket = createWebSocket();
        sockets.push(socket);
        
        // We need to handle the initial IP message here too
        socket.onmessage = (event) => { /* We don't expect messages during upload test */ };

        await new Promise(resolve => socket.onopen = () => {
            socket.send('upload');
            resolve();
        });
    }

    const startTime = Date.now();
    let running = true;

    setTimeout(() => running = false, duration);

    async function sendData(socket) {
        while (running) {
            if (socket.bufferedAmount < highWaterMark) {
                socket.send(data);
                totalBytes += data.byteLength;
            } else {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
    }

    await Promise.all(sockets.map(sendData));

    sockets.forEach(socket => socket.close());

    const actualDuration = Date.now() - startTime;

    return (totalBytes * 8) / (actualDuration / 1000) / 1000000; // Mbps
}