import puppeteer from 'puppeteer';

const results = [];

function assert(condition, testName, details = '') {
  if (condition) {
    results.push({ name: testName, passed: true, details });
    console.log(`  [PASS] ${testName}`);
  } else {
    results.push({ name: testName, passed: false, details });
    console.error(`  [FAIL] ${testName} - ${details}`);
  }
}

export async function runBrowserTests() {
  console.log('\n========================================');
  console.log('  RUNNING PUPPETEER E2E BROWSER SUITE');
  console.log('========================================\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream'
    ]
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore benign HMR/socket disconnect messages if any
      if (!text.includes('favicon') && !text.includes('WebSocket')) {
        consoleErrors.push(text);
      }
    }
  });

  page.on('pageerror', err => {
    pageErrors.push(err.message);
  });

  try {
    // 1. Initial Load Test
    console.log('--- Test Group 1: Application Startup & Routing ---');
    const response = await page.goto('http://localhost:5173/login', {
      waitUntil: 'networkidle2',
      timeout: 15000
    });
    assert(response.status() === 200, 'Login page returns HTTP 200');

    const title = await page.title();
    assert(!!title, 'Page has valid title', title);

    // Switch to login view if on marketing view
    const getStartedBtn = await page.$('.get-started-btn');
    if (getStartedBtn) {
      await getStartedBtn.click();
      await page.waitForSelector('.right-section.active-view input[type="password"]', { timeout: 5000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 400));
    }

    // 2. Password Visibility Toggle Test
    console.log('\n--- Test Group 2: Password Visibility Toggle Exact Behavior ---');
    const passwordInput = await page.$('.right-section.active-view input[type="password"], input[type="password"]');
    assert(!!passwordInput, 'Password input found in DOM');

    const initialType = await page.evaluate(el => el.getAttribute('type'), passwordInput);
    assert(initialType === 'password', 'State 1: Initial password input type is "password"');

    // Find the toggle button
    const eyeToggleBtn = await page.$('.right-section.active-view .password-toggle-btn, .password-toggle-btn');
    assert(!!eyeToggleBtn, 'Password Eye Toggle button located');

    if (eyeToggleBtn) {
      // Click 1: Show password
      await eyeToggleBtn.click();
      await new Promise(r => setTimeout(r, 100));
      const typeAfterClick1 = await page.evaluate(el => el.getAttribute('type'), passwordInput);
      assert(typeAfterClick1 === 'text', 'State 2: Clicking Eye changes input type to "text"');

      // Click 2: Hide password again
      await eyeToggleBtn.click();
      await new Promise(r => setTimeout(r, 100));
      const typeAfterClick2 = await page.evaluate(el => el.getAttribute('type'), passwordInput);
      assert(typeAfterClick2 === 'password', 'State 3: Clicking Eye-Off changes input type back to "password"');

      // Rapid Toggling (5 cycles)
      let toggleInSync = true;
      for (let i = 0; i < 5; i++) {
        await eyeToggleBtn.click();
        const expectedType = (i % 2 === 0) ? 'text' : 'password';
        const currType = await page.evaluate(el => el.getAttribute('type'), passwordInput);
        if (currType !== expectedType) {
          toggleInSync = false;
          break;
        }
      }
      assert(toggleInSync, 'Rapid Toggling (5 cycles) preserves 100% synchronization');

      // Verify button type is 'button' and does not submit form
      const btnType = await page.evaluate(el => el.getAttribute('type'), eyeToggleBtn);
      assert(btnType === 'button', 'Eye button has type="button" to prevent accidental form submission');
    }

    // 3. Global Notification Architecture Test
    console.log('\n--- Test Group 3: Singleton Notification Container Verification ---');
    const toastContainers = await page.$$('.global-toast-viewport, .toast-container');
    assert(toastContainers.length <= 1, 'Only one global toast container mounted in DOM', `Found: ${toastContainers.length}`);

    const oldContainers = await page.$$('.toast-container:not(.global-toast-viewport)');
    assert(oldContainers.length === 0, 'Zero duplicate legacy .toast-container elements in DOM');

    // 4. Responsive Viewport Verification (Zero Horizontal Overflow)
    console.log('\n--- Test Group 4: Responsive Viewports & Zero Horizontal Overflow ---');
    const viewports = [
      { width: 360, height: 740, name: '360px (Small Mobile)' },
      { width: 390, height: 844, name: '390px (iPhone 12/13/14)' },
      { width: 394, height: 851, name: '394px (Standard Android)' },
      { width: 412, height: 915, name: '412px (Pixel / Galaxy)' },
      { width: 480, height: 800, name: '480px (Phablet)' },
      { width: 768, height: 1024, name: '768px (iPad Mini / Tablet)' },
      { width: 1024, height: 768, name: '1024px (iPad Pro / Small Laptop)' },
      { width: 1366, height: 768, name: '1366px (HD Laptop)' },
      { width: 1920, height: 1080, name: '1920px (Full HD Desktop)' }
    ];

    for (const vp of viewports) {
      await page.setViewport({ width: vp.width, height: vp.height });
      await new Promise(r => setTimeout(r, 150));

      const overflow = await page.evaluate(() => {
        const docWidth = document.documentElement.scrollWidth;
        const winWidth = window.innerWidth;
        return {
          hasOverflow: docWidth > winWidth + 1,
          scrollWidth: docWidth,
          innerWidth: winWidth
        };
      });

      assert(!overflow.hasOverflow, `Viewport ${vp.name}: No horizontal overflow (${overflow.scrollWidth}px <= ${overflow.innerWidth}px)`);
    }

    // 5. Console & Runtime Stability Checks
    console.log('\n--- Test Group 5: Browser Console & Runtime Stability ---');
    assert(pageErrors.length === 0, 'Zero unhandled page errors during browser session', pageErrors.join('; '));
    assert(consoleErrors.length === 0, 'Zero fatal console errors logged', consoleErrors.join('; '));

  } catch (err) {
    assert(false, 'Browser Execution Exception', err.message);
  } finally {
    await browser.close();
  }

  return results;
}

if (process.argv[1].endsWith('test_e2e_browser.mjs')) {
  runBrowserTests().then(res => {
    const passed = res.filter(r => r.passed).length;
    const failed = res.filter(r => !r.passed).length;
    console.log(`\nBrowser Suite Summary: Total: ${res.length} | Passed: ${passed} | Failed: ${failed}`);
    process.exit(failed > 0 ? 1 : 0);
  }).catch(e => {
    console.error('Fatal browser test error:', e);
    process.exit(1);
  });
}
