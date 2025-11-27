// Simple test script: POST then GET messages from chat server
(async () => {
  try {
    const postRes = await fetch('http://localhost:6001/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'test-script', text: 'hello from test script' }),
    });
    const postText = await postRes.text();
    console.log('POST status', postRes.status, 'body', postText);

    const getRes = await fetch('http://localhost:6001/messages');
    const data = await getRes.json();
    console.log('GET status', getRes.status, 'body', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('TEST ERROR', e);
    process.exit(1);
  }
})();
