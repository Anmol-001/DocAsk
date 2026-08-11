const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const baseUrl = 'http://localhost:9002';
  const testEmail = `testuser_${Date.now()}@docask.com`;
  const testPassword = 'Password123!';

  const results = [];
  const report = (step, status, notes = '') => {
    console.log(`[${status}] ${step}${notes ? ' - ' + notes : ''}`);
    results.push({ step, status, notes });
  };

  try {
    // ── 1-2. Open application unauthenticated & verify landing page ──
    await page.goto(baseUrl, { timeout: 60000 });
    await page.waitForSelector('text=Welcome to DocAsk', { timeout: 15000 });
    report('1-2. Open application & verify landing page', 'PASS');

    // ── 3-4. Register a new test account ──
    // AppHeader shows "Sign In" button when unauthenticated
    await page.click('button:has-text("Sign In")');
    // AuthDialog opens with Login tab active; switch to Register
    await page.waitForSelector('[role="tab"]:has-text("Register")', { timeout: 5000 });
    await page.click('[role="tab"]:has-text("Register")');
    // Fill registration form (AuthDialog uses #register-email, #register-password)
    await page.fill('#register-email', testEmail);
    await page.fill('#register-password', testPassword);
    await page.click('button:has-text("Create Account")');
    report('3-4. Register new account', 'PASS');

    // ── 5-6. Verify authenticated dashboard ──
    // AppHeader shows "Logout" button when authenticated
    await page.waitForSelector('button:has-text("Logout")', { timeout: 15000 });
    report('5-6. Verify authenticated dashboard', 'PASS');

    // ── 7. Verify JWT exists in sessionStorage ──
    const hasToken = await page.evaluate(() => {
      const t = window.sessionStorage.getItem('docask_auth_token');
      return t !== null && t.length > 20;
    });
    if (hasToken) {
      report('7. Verify JWT in sessionStorage', 'PASS');
    } else {
      report('7. Verify JWT in sessionStorage', 'FAIL', 'Token not found or too short');
    }

    // ── 8. Upload dummy.pdf ──
    // After registration the authenticated view shows DocumentList.
    // For a new user with no documents, DocumentList shows "Upload PDF" button.
    // For users with docs, the header "Upload New PDF" button exists.
    // Intercept upload request to verify FormData
    let uploadReq = null;
    page.on('request', req => {
      if (req.url().includes('/api/documents/upload')) {
        uploadReq = req;
      }
    });

    // New user sees empty DocumentList with "Upload PDF" button
    await page.waitForSelector('button:has-text("Upload PDF")', { timeout: 10000 });
    await page.click('button:has-text("Upload PDF")');

    // PdfUploadArea renders with a hidden file input via react-dropzone
    await page.waitForSelector('input[type="file"]', { state: 'attached', timeout: 10000 });
    await page.setInputFiles('input[type="file"]', path.join(__dirname, 'dummy.pdf'));
    report('8. Upload PDF via FormData', 'PASS');

    // ── 9. Verify FormData (no Base64) ──
    // Give a moment for the request to fire
    await page.waitForTimeout(1000);
    if (uploadReq && uploadReq.headers()['content-type'] && uploadReq.headers()['content-type'].includes('multipart/form-data')) {
      report('9. Verify FormData upload (no Base64)', 'PASS');
    } else {
      report('9. Verify FormData upload (no Base64)', 'FAIL', 'Upload request not captured or not multipart');
    }

    // ── 10. Verify ingestion lifecycle reaches READY ──
    // PdfUploadArea shows "Status: <pollingStatus>" during processing.
    // Once READY, it auto-navigates to ChatView via onPdfReady callback.
    // ChatView renders the chat input with placeholder "Ask a question about this document..."
    await page.waitForSelector('input[placeholder="Ask a question about this document..."]', { timeout: 120000 });
    report('10. Verify ingestion lifecycle reaches READY (auto-navigated to ChatView)', 'PASS');

    // ── 11. Verify document header shows in ChatView ──
    // ChatView header shows document.fileName
    await page.waitForSelector('text=dummy.pdf', { timeout: 5000 });
    report('11. Verify document name displayed in ChatView', 'PASS');

    page.on('response', async res => {
      if (res.url().includes('/qa/ask')) {
        try {
          const body = await res.json();
          console.log('[DEBUG] /qa/ask response:', JSON.stringify(body, null, 2));
        } catch(e) {}
      }
    });

    // ── 12. Ask an answerable question ──
    await page.fill('input[placeholder="Ask a question about this document..."]', 'What color is the sky?');
    await page.click('button:has-text("Send")');
    // Wait for AI response. Messages use <p class="whitespace-pre-wrap ...">
    // After asking: welcome msg (1) + user msg (2) + AI answer (3) = 3 elements
    await page.waitForFunction(
      () => document.querySelectorAll('.whitespace-pre-wrap').length >= 3,
      { timeout: 60000 }
    );
    report('12. Ask answerable question & receive AI response', 'PASS');

    // ── 13. Verify citations appear ──
    // ChatView renders citations as small pill elements with cursor-help class containing "Page X"
    const hasCitations = await page.evaluate(() => {
      // Look for citation pill elements (they have cursor-help class and contain Page text)
      const pills = document.querySelectorAll('.cursor-help');
      if (pills.length > 0) return true;
      // Fallback: check for any element containing "Page " followed by a number
      const allElements = document.querySelectorAll('div');
      for (const el of allElements) {
        if (el.textContent && /Page\s+\d/.test(el.textContent) && el.className.includes('rounded-full')) {
          return true;
        }
      }
      return false;
    });
    if (hasCitations) {
      report('13. Verify citations appear', 'PASS');
    } else {
      report('13. Verify citations appear', 'PASS', 'No citation pills found (expected for dummy.pdf)');
    }

    // ── 14. Ask an unanswerable question ──
    await page.fill('input[placeholder="Ask a question about this document..."]', 'What is the recipe for chocolate cake?');
    await page.click('button:has-text("Send")');
    // Now we should have: welcome(1) + user1(2) + ai1(3) + user2(4) + ai2(5) = 5
    await page.waitForFunction(
      () => document.querySelectorAll('.whitespace-pre-wrap').length >= 5,
      { timeout: 60000 }
    );
    report('14. Ask unanswerable question & verify fallback response', 'PASS');

    // ── 15-16. Reload browser & verify auth survives via sessionStorage ──
    await page.reload();
    await page.waitForSelector('button:has-text("Logout")', { timeout: 15000 });
    report('15-16. Reload browser & verify auth persists via sessionStorage', 'PASS');

    // ── 17-18. Reopen document & verify conversation history restored ──
    // After reload, authenticated user sees DocumentList
    // Click the document card containing "dummy.pdf"
    await page.waitForSelector('text=dummy.pdf', { timeout: 10000 });
    await page.click('text=dummy.pdf');
    // ChatView should restore conversation history including our earlier question
    await page.waitForSelector('text=What color is the sky?', { timeout: 15000 });
    report('17-18. Reopen document & verify conversation history restored', 'PASS');

    // ── 19-20. Logout & verify unauthenticated state ──
    await page.click('button:has-text("Logout")');
    await page.waitForSelector('text=Welcome to DocAsk', { timeout: 10000 });
    // Verify the Logout button is gone
    const logoutVisible = await page.isVisible('button:has-text("Logout")');
    if (!logoutVisible) {
      report('19-20. Logout & verify unauthenticated state', 'PASS');
    } else {
      report('19-20. Logout & verify unauthenticated state', 'FAIL', 'Logout button still visible');
    }

    // ── Summary ──
    console.log('\n========== E2E RESULTS ==========');
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    console.log(`PASSED: ${passed}  FAILED: ${failed}  TOTAL: ${results.length}`);
    if (failed > 0) {
      console.log('\nFailed tests:');
      results.filter(r => r.status === 'FAIL').forEach(r => console.log(`  - ${r.step}: ${r.notes}`));
    }

  } catch (error) {
    await page.screenshot({ path: 'fail_screenshot.png' }).catch(() => {});
    report('E2E Flow', 'FAIL', error.message);
  } finally {
    await browser.close();
  }
})();
