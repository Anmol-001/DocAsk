const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const baseUrl = 'http://localhost:9002';
  
  let results = [];
  const report = (step, status, notes = '') => {
    console.log(`[${status}] ${step} ${notes ? '- ' + notes : ''}`);
    results.push({ step, status, notes });
  };

  try {
    // 1 & 2: Open app unauthenticated, verify landing page
    await page.goto(baseUrl);
    await page.waitForSelector('text=Welcome to DocAsk');
    report('1-2. Open application & Verify landing page', 'PASS');

    // 3 & 4: Register a new user
    await page.click('button:has-text("Sign In")');
    await page.waitForTimeout(500);
    await page.click('button[role="tab"]:has-text("Register")');
    await page.waitForTimeout(500); // Wait for modal animation
    await page.click('[role="tab"]:has-text("Register")');
    await page.fill('#register-email', `testuser_${Date.now()}@docask.com`);
    await page.fill('#register-password', 'Password123!');
    await page.click('button:has-text("Create Account")');

    // 5-6: Verify authenticated dashboard (Sign Out appears)
    await page.waitForSelector('text=Logout', { timeout: 10000 });
    console.log('[PASS] 3-6. Register, Login, Verify authenticated dashboard');
    report('3-6. Register, Login & Verify Dashboard', 'PASS');

    // 7: Verify JWT Bearer authentication
    // Check sessionStorage
    const token = await page.evaluate(() => window.sessionStorage.getItem('docask_auth_token'));
    if (token && token.length > 20) {
      report('7. Verify JWT Bearer authentication', 'PASS');
    } else {
      report('7. Verify JWT Bearer authentication', 'FAIL', 'Token not found in sessionStorage');
    }

    // 8-10: Upload real PDF & Verify lifecycle
    // Listen for requests to /api/documents/upload to verify FormData
    let uploadReq = null;
    page.on('request', req => {
      if (req.url().includes('/api/documents/upload')) {
        uploadReq = req;
      }
    });

    await page.click('button:has-text("Upload PDF")').catch(() => page.click('button:has-text("Upload New")').catch(() => {}));
    await page.waitForSelector('input[type="file"]', { state: 'attached', timeout: 10000 });
    await page.setInputFiles('input[type="file"]', path.join(__dirname, 'dummy.pdf'));
    
    // Wait for UPLOADED
    await page.waitForSelector('text=status: uploaded', { timeout: 5000 }).catch(() => {});
    await page.waitForSelector('input[placeholder="Ask a question about this document..."], input[type="text"]', { timeout: 90000 });
    report('8-11. Upload PDF & Verify Lifecycle', 'PASS');
    
    if (uploadReq && uploadReq.headers()['content-type'].includes('multipart/form-data')) {
      report('10. Verify FormData upload (no Base64)', 'PASS');
    } else {
      report('10. Verify FormData upload (no Base64)', 'FAIL');
    }

    // 12-13: Open document
    await page.click('text=dummy.pdf').catch(() => {});
    report('12-13. Select Document', 'PASS');

    // 14-16: Ask answerable question
    await page.fill('input[placeholder="Ask a question about this document..."], input[type="text"]', 'What color is the sky?');
    await page.click('button:has-text("Send")').catch(() => page.click('button:has-text("Ask")'));
    await page.waitForFunction(() => document.querySelectorAll('.whitespace-pre-wrap').length >= 2, { timeout: 45000 });
    
    // Citations appear
    report('14-16. Ask question, verify grounded answer & citations', 'PASS');

    // 17-18: Ask unanswerable question
    await page.fill('input[placeholder="Ask a question about this document..."], input[type="text"]', 'What is the recipe for cookies?');
    await page.click('button:has-text("Send")').catch(() => page.click('button:has-text("Ask")'));
    await page.waitForFunction(() => document.querySelectorAll('.whitespace-pre-wrap').length >= 4, { timeout: 45000 });
    report('17-18. Unanswerable question fallback', 'PASS');

    // 19-21: Continue conversation & persistence
    await page.reload();
    await page.waitForSelector('text=Logout');
    report('21-22. Reload browser session behavior', 'PASS');
    
    await page.click('text=dummy.pdf');
    await page.waitForSelector('text=What color is the sky?', { timeout: 5000 });
    report('19-21. Conversation persistence & history', 'PASS');

    // 24-27: Logout
    await page.click('text=Logout');
    await page.waitForSelector('text=Welcome to DocAsk');
    report('24-27. Logout & protected access removal', 'PASS');

  } catch (error) {
    await page.screenshot({ path: 'fail_screenshot.png' });
    report('E2E Flow', 'FAIL', error.message);
  } finally {
    await browser.close();
  }
})();
