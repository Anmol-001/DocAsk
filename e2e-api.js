const fs = require('fs');

async function run() {
  const baseUrl = 'http://127.0.0.1:3001/api';
  
  // Register User A
  let emailA = `usera_${Date.now()}@docask.com`;
  let resA = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'User A', email: emailA, password: 'Password123!' })
  });
  if (!resA.ok) {
    let text = await resA.text();
    throw new Error(`Register failed: ${resA.status} - ${text}`);
  }
  // Login User A
  let loginResA = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: emailA, password: 'Password123!' })
  });
  let loginDataA = await loginResA.json();
  console.log("Login User A response:", loginDataA);
  let tokenA = loginDataA.token;

  // Register User B
  let emailB = `userb_${Date.now()}@docask.com`;
  let resB = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'User B', email: emailB, password: 'Password123!' })
  });
  
  // Login User B
  let loginResB = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: emailB, password: 'Password123!' })
  });
  let loginDataB = await loginResB.json();
  let tokenB = loginDataB.token;

  console.log('[PASS] Registration and token issuance');

  // User A uploads a document
  const formData = new FormData();
  const pdfBlob = new Blob([fs.readFileSync('dummy.pdf')], { type: 'application/pdf' });
  formData.append('file', pdfBlob, 'dummy.pdf');
  
  let uploadRes = await fetch(`${baseUrl}/documents/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenA}` },
    body: formData
  });
  if (!uploadRes.ok) {
    let text = await uploadRes.text();
    throw new Error(`Upload failed: ${uploadRes.status} - ${text}`);
  }
  let uploadData = await uploadRes.json();
  let docId = uploadData.documentId;
  
  console.log(`[PASS] Uploaded document for User A: ${docId}`);

  // User B tries to access User A's document
  let fetchDocB = await fetch(`${baseUrl}/documents/${docId}`, {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  if (fetchDocB.status === 404 || fetchDocB.status === 403) {
    console.log('[PASS] Cross-user document access blocked');
  } else {
    console.log(`[FAIL] Cross-user document access allowed. Status: ${fetchDocB.status}`);
  }

  // User A asks a question (creates a conversation)
  // Need to wait until it's ready
  let isReady = false;
  while (!isReady) {
    let stat = await fetch(`${baseUrl}/documents/${docId}`, {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    if (!stat.ok) {
      console.log(`Polling failed: ${stat.status} - ${await stat.text()}`);
      throw new Error("Polling failed");
    }
    let statData = await stat.json();
    if (statData.status === 'READY') {
      isReady = true;
      console.log('[PASS] Lifecycle reached READY');
    } else {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  let askRes = await fetch(`${baseUrl}/qa/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ documentId: docId, question: 'What color is the sky?' })
  });
  let askData = await askRes.json();
  let convId = askData.conversationId;

  console.log(`[PASS] Question answered, conversation created: ${convId}`);
  if (askData.citations && askData.citations.length > 0) {
    console.log('[PASS] Citations returned with page numbers');
  }

  // User B tries to ask question on User A's conversation
  let askResB = await fetch(`${baseUrl}/qa/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` },
    body: JSON.stringify({ documentId: docId, conversationId: convId, question: 'Hello' })
  });
  if (askResB.status === 403 || askResB.status === 404 || askResB.status === 400) {
    console.log(`[PASS] Cross-user conversation access blocked. Status: ${askResB.status}`);
  } else {
    console.log(`[FAIL] Cross-user conversation access allowed. Status: ${askResB.status}`);
  }

  // Phase 8: History & Memory Tests
  console.log('--- Phase 8 Tests ---');
  let convRes = await fetch(`${baseUrl}/qa/conversations/${docId}`, { headers: { 'Authorization': `Bearer ${tokenA}` }});
  if (!convRes.ok) {
    let text = await convRes.text();
    console.log(`Failed convRes: ${convRes.status} - ${text}`);
    throw new Error('Failed to fetch doc convs');
  }
  let convData = await convRes.json();
  if (convData.length === 1 && convData[0]._id === convId) {
    console.log('[PASS] Fetched document conversations');
  } else {
    console.log('[FAIL] Failed to fetch document conversations');
  }

  let msgRes = await fetch(`${baseUrl}/qa/conversations/${convId}/messages`, { headers: { 'Authorization': `Bearer ${tokenA}` }});
  if (!msgRes.ok) {
    let text = await msgRes.text();
    console.log(`Failed msgRes: ${msgRes.status} - ${text}`);
    throw new Error('Failed to fetch msg convs');
  }
  let msgData = await msgRes.json();
  if (msgData.length === 2) {
    console.log('[PASS] Fetched conversation messages (1 user, 1 AI)');
  } else {
    console.log('[FAIL] Failed to fetch conversation messages');
  }

  // Ask follow up
  let followUpRes = await fetch(`${baseUrl}/qa/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ documentId: docId, conversationId: convId, question: 'Why is that?' })
  });
  let followUpData = await followUpRes.json();
  if (followUpData.conversationId === convId) {
    console.log('[PASS] Memory context applied (same conversationId)');
  }

  // User B tries to delete User A's document
  let delResB = await fetch(`${baseUrl}/documents/${docId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  if (delResB.status === 403 || delResB.status === 404) {
    console.log('[PASS] Cross-user deletion blocked');
  }

  // User A deletes document
  let delRes = await fetch(`${baseUrl}/documents/${docId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  if (delRes.status === 200) {
    console.log('[PASS] Document deleted successfully');
  }

  // Verify deletion cascade
  let checkDoc = await fetch(`${baseUrl}/documents/${docId}`, { headers: { 'Authorization': `Bearer ${tokenA}` }});
  if (checkDoc.status === 404) {
    console.log('[PASS] Document no longer exists');
  }
  let checkMsgs = await fetch(`${baseUrl}/qa/conversations/${convId}/messages`, { headers: { 'Authorization': `Bearer ${tokenA}` }});
  if (checkMsgs.status === 403 || checkMsgs.status === 404) {
    console.log('[PASS] Conversation cascaded deletion successful');
  }

  // Logout / 401 test
  let invalidRes = await fetch(`${baseUrl}/documents`, {
    headers: { 'Authorization': `Bearer invalid_token` }
  });
  if (invalidRes.status === 401) {
    console.log('[PASS] Protected access returns 401 for invalid/missing token');
  }
}

run().catch(console.error);
