async function testGet() {
  try {
    const res = await fetch('http://localhost:3001/api/activity-scores?year=2026');
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Response snippet:', text.substring(0, 500));
  } catch (e) {
    console.error("Fetch error:", e);
  }
}
testGet();
