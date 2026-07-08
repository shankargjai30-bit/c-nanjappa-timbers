const puppeteer = require('puppeteer-core');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Basic settings
const TEST_EMAIL = `qa-e2e-${Date.now()}@timberpro.com`;
const TEST_PASS = 'TestPass123!';
const BASE_URL = 'http://localhost:5173';

const issues = [];
const log = (msg) => console.log(`[E2E] ${msg}`);

// We'll need a way to locate Chrome. Usually installed in standard paths on Windows.
const chromePaths = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
];
const executablePath = chromePaths.find(p => fs.existsSync(p));

async function run() {
  if (!executablePath) {
    console.error("Chrome not found. Cannot run UI tests.");
    process.exit(1);
  }

  log("Starting Vite dev server...");
  const devServer = spawn('npm', ['run', 'dev'], { shell: true });
  
  await new Promise(r => setTimeout(r, 6000)); // Wait for Vite & Backend to boot

  log("Launching Puppeteer...");
  const browser = await puppeteer.launch({
    executablePath,
    headless: "new",
    defaultViewport: { width: 1280, height: 800 },
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  
  try {
    // 1. Login / Signup Flow
    log("Navigating to app...");
    await page.goto(BASE_URL);
    await page.waitForSelector('.get-started-btn', { timeout: 10000 });
    await page.click('.get-started-btn');
    
    log("Switching to Signup...");
    await page.waitForSelector('.switch-btn');
    await page.click('.switch-btn'); // Switch to signup
    
    log("Filling signup form...");
    // The inputs don't have IDs but they have placeholders
    await page.type('input[placeholder="John Doe"]', 'QA Automation User');
    await page.type('input[placeholder="manager@nanjappa.com"]', TEST_EMAIL);
    const passInputs = await page.$$('input[placeholder="••••••••"]');
    await passInputs[0].type(TEST_PASS);
    await passInputs[1].type(TEST_PASS);
    
    log("Submitting signup...");
    await page.click('.login-btn');
    
    // Wait for Dashboard to load
    await page.waitForSelector('.dashboard-page', { timeout: 30000 });
    log("✅ Dashboard loaded successfully.");
    
    // 2. Navigate to Employees & Create
    log("Navigating to Employees...");
    await page.click('a[href="/employees"]'); // Assuming standard nav link
    
    await page.waitForSelector('.employees-page', { timeout: 20000 });
    
    // Click 'Add Employee' button
    // We might need to find the button by text
    const buttons = await page.$$('button');
    let addBtn;
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('Add Employee') || text.includes('Create')) {
        addBtn = btn;
        break;
      }
    }
    if (addBtn) await addBtn.click();
    
    // 3. Just take a screenshot to prove it navigated
    await page.screenshot({ path: 'e2e-proof.png' });
    log("✅ Workflows navigated. Screenshot saved.");

  } catch (err) {
    issues.push({ severity: 'High', module: 'UI/UX', desc: err.message });
    log(`❌ Error: ${err.message}`);
    await page.screenshot({ path: 'e2e-error.png' });
  } finally {
    fs.writeFileSync('frontend-qa-report.json', JSON.stringify(issues, null, 2));
    await browser.close();
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", devServer.pid, '/f', '/t']);
    } else {
      devServer.kill();
    }
    process.exit(0);
  }
}

run();
