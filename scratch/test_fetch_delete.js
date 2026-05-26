async function testDelete() {
  try {
    const res = await fetch('http://localhost:3000/api/activity-scores?year=2026', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ids: ['dummy-1', 'dummy-2'] })
    });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Response:', text);
  } catch (e) {
    console.error("Fetch error:", e);
  }
}
testDelete();
