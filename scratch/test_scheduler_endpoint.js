const http = require('http');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: JSON.parse(data),
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data,
          });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (postData) {
      req.write(JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== Automated Backup Scheduler Route Verification ===\n');

  // Test 1: GET request (Real Tick/Default Check)
  console.log('Test 1: Fetching scheduler status (GET)...');
  try {
    const res1 = await makeRequest({
      hostname: 'localhost',
      port: 4028,
      path: '/api/system-jobs/auto-backup',
      method: 'GET',
    });
    console.log('Test 1 Result:', JSON.stringify(res1.body, null, 2));
    console.log('');

    const scheduledDate = res1.body.scheduledDate;
    if (!scheduledDate) {
      throw new Error("Could not retrieve scheduled date from response.");
    }

    const scheduledParts = scheduledDate.split('-');
    const year = Number(scheduledParts[0]);
    const month = Number(scheduledParts[1]);
    const day = Number(scheduledParts[2]);

    // Test 2: POST request simulating exactly 3 days prior (Warning Reminder)
    const warningDate = new Date(Date.UTC(year, month - 1, day));
    warningDate.setUTCDate(warningDate.getUTCDate() - 3);
    const simulatedWarningStr = warningDate.toISOString().split('T')[0];

    console.log(`Test 2: Simulating 3-day Pre-Due Warning on simulated date: ${simulatedWarningStr} (POST)...`);
    const res2 = await makeRequest({
      hostname: 'localhost',
      port: 4028,
      path: '/api/system-jobs/auto-backup',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }, { simulatedDate: simulatedWarningStr });
    
    console.log('Test 2 Result:', JSON.stringify(res2.body, null, 2));
    console.log('');

    // Test 3: POST request simulating exactly 0 days (Due Date Archive Run)
    const dueDateStr = scheduledDate;
    console.log(`Test 3: Simulating Auto-Backup Due Date on simulated date: ${dueDateStr} (POST)...`);
    const res3 = await makeRequest({
      hostname: 'localhost',
      port: 4028,
      path: '/api/system-jobs/auto-backup',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }, { simulatedDate: dueDateStr });

    console.log('Test 3 Result:', JSON.stringify(res3.body, null, 2));
    console.log('');

  } catch (err) {
    console.error('Error during test execution:', err.message || err);
  }
}

// Wait for dev server to start
setTimeout(() => {
  runTests();
}, 2000);
