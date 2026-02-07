
const https = require('https');

const options = {
    hostname: 'cubogpm-frota.nortesistech.com',
    path: '/api/veiculos/?format=json',
    method: 'GET',
    headers: {
        'Authorization': 'Token 42eee9fe816a9a49c7edcc909eba561db2ea23dc',
        'Content-Type': 'application/json'
    }
};

const req = https.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        try {
            const jsonData = JSON.parse(data);
            // Log the first 2 items to check structure
            console.log(JSON.stringify(Array.isArray(jsonData) ? jsonData.slice(0, 2) : jsonData, null, 2));
        } catch (e) {
            console.log("Raw body:", data);
        }
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.end();
