const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:9002');
  await page.waitForLoadState('networkidle');
  const html = await page.content();
  console.log('HTML length:', html.length);
  console.log('Register button exists:', await page.isVisible('button:has-text("Register")'));
  console.log('Sign In button exists:', await page.isVisible('button:has-text("Sign In")'));
  console.log('Welcome to DocAsk exists:', await page.isVisible('text=Welcome to DocAsk'));
  await browser.close();
})();
