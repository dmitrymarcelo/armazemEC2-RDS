const https = require('https');

const user = 'gregory.sylvestre';
const pass = 'Norte2025@#$';
const auth = 'Basic ' + Buffer.from(user + ':' + pass).toString('base64');

console.log(`Testing Basic Auth for ${user}...`);

const options = {
    hostname: 'cubogpm-frota.nortesistech.com',
    path: '/api/veiculos/?format=json',
    method: 'GET',
    headers: {
        'Authorization': auth,
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0'
    }
};

const req = https.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        if (res.statusCode === 200) {
            console.log("SUCCESS! Basic Auth worked.");
            const jsonData = JSON.parse(data);
            console.log(`Total items found: ${jsonData.count}`);
        } else {
            console.log(`Failed. Response: ${data.substring(0, 200)}`);
        }
    });
});

req.on('error', (e) => {
    console.error(`Error: ${e.message}`);
});

req.end();
