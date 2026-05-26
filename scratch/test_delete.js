
async function testDelete() {
  try {
    const res = await fetch('http://localhost:3000/api/activity-scores?year=2026', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'auth-token=some-admin-token' // or maybe the endpoint doesn't strictly validate token internally for this test? Or maybe it does. Let's just pass some dummy token
      },
      body: JSON.stringify({ ids: ['dummy-1', 'dummy-2'] })
    });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Response:', text);
  } catch (e) {
    console.error(e);
  }
}
testDelete();
