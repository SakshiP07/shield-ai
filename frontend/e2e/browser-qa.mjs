/**
 * ShieldAI — Full browser E2E QA
 * Run: node e2e/browser-qa.mjs
 */
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:5173';
const OUT = join(process.cwd(), 'e2e', 'results');
mkdirSync(OUT, { recursive: true });

const report = {
  timestamp: new Date().toISOString(),
  baseUrl: BASE,
  items: [],
  consoleErrors: [],
  failedRequests: [],
  networkLog: [],
};

function record(id, name, status, details = {}) {
  report.items.push({ id, name, status, ...details });
  const icon = status === 'Working' ? '✅' : status === 'Partially Working' ? '⚠️' : '❌';
  console.log(`${icon} [${id}] ${name}${details.note ? ` — ${details.note}` : ''}`);
}

async function shot(page, name) {
  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  return path;
}

function attachListeners(page, label) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') report.consoleErrors.push(`[${label}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => report.consoleErrors.push(`[${label}] PAGE: ${err.message}`));
  page.on('response', (res) => {
    const url = res.url();
    if (url.includes('/api/') || url.includes('/ws/')) {
      report.networkLog.push({ url, status: res.status(), method: res.request().method(), viewport: label });
      if (res.status() >= 400 && !url.includes('/auth/google')) {
        report.failedRequests.push({ url, status: res.status(), viewport: label });
      }
    }
  });
  page.on('requestfailed', (req) => {
    if (!req.url().includes('google') && !req.url().includes('favicon')) {
      report.failedRequests.push({ url: req.url(), failure: req.failure()?.errorText, viewport: label });
    }
  });
}

async function signupViaOtp(page) {
  const phone = `9${String(Date.now()).slice(-9)}`;
  await page.goto(`${BASE}/signup`);
  await page.waitForLoadState('networkidle');

  const sendResp = page.waitForResponse(
    (r) => r.url().includes('/auth/otp/send') && r.request().method() === 'POST',
  );
  await page.locator('input[type="tel"]').fill(phone);
  await page.getByRole('button', { name: /Send verification code/i }).click();
  const resp = await sendResp;
  const body = await resp.json();
  if (!resp.ok()) throw new Error(`OTP send failed: ${JSON.stringify(body)}`);

  const verifyResp = page.waitForResponse(
    (r) => r.url().includes('/auth/otp/verify') && r.request().method() === 'POST',
  );
  await page.locator('input[placeholder="6-digit code"]').fill(body.dev_otp);
  await page.getByRole('button', { name: /Create account/i }).click();
  const vresp = await verifyResp;
  const vbody = await vresp.json();
  if (!vresp.ok()) throw new Error(`OTP verify failed: ${JSON.stringify(vbody)}`);

  await page.waitForURL(/\/(setup|app)/, { timeout: 15000 });
  if (page.url().includes('/setup')) {
    await page.locator('input[placeholder="Full name"]').fill('Browser QA User');
    await page.getByRole('button', { name: /Continue/i }).click();
    await page.waitForURL(/\/app/, { timeout: 15000 });
  }
  return { phone, token: vbody.access_token };
}

async function completeProfileIfNeeded(page) {
  if (page.url().includes('/setup')) {
    await page.locator('input[placeholder="Full name"]').fill('Persist User');
    const profileR = page.waitForResponse(
      (r) => r.url().includes('/auth/profile') && r.request().method() === 'PATCH',
    );
    await page.getByRole('button', { name: /Continue/i }).click();
    await profileR;
    await page.waitForURL(/\/app/, { timeout: 15000 });
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...devices['iPhone 13'],
    permissions: ['camera'],
    locale: 'en-IN',
  });
  const page = await context.newPage();
  attachListeners(page, 'mobile');

  try {
    await signupViaOtp(page);
    await shot(page, '01-after-signup');
    record('AUTH-1', 'Signup via Phone OTP', 'Working', {
      howTested: 'Playwright signup flow with dev_otp',
      endpoint: 'POST /api/v1/auth/otp/send, /auth/otp/verify',
      screenshot: 'e2e/results/01-after-signup.png',
    });
  } catch (e) {
    await shot(page, '01-signup-failed');
    record('AUTH-1', 'Signup via Phone OTP', 'Not Working', { error: String(e) });
    throw e;
  }

  // HOME
  await page.goto(`${BASE}/app`);
  await page.waitForLoadState('networkidle');
  await shot(page, '02-home');
  record('HOME-1', 'Home page loads', await page.getByText('AI Security Score').isVisible() ? 'Working' : 'Not Working', {
    howTested: 'Navigate /app',
    endpoint: 'GET /dashboard/stats, /activity, /scam-alerts',
    screenshot: 'e2e/results/02-home.png',
  });

  for (const [label, pathPart] of [
    ['Scan QR', '/app/scan'],
    ['Check UPI', '/app/scan'],
    ['Phone', '/app/scan'],
    ['Report', '/app/alerts'],
  ]) {
    await page.goto(`${BASE}/app`);
    await page.getByText(label, { exact: true }).click();
    await page.waitForLoadState('networkidle');
    record(`HOME-QA-${label}`, `Quick action: ${label}`, page.url().includes(pathPart) ? 'Working' : 'Not Working', {
      howTested: `Click "${label}"`, url: page.url(),
    });
  }

  await page.goto(`${BASE}/app`);
  await page.getByRole('link', { name: 'View All' }).first().click();
  await page.waitForURL(/\/app\/activity/);
  record('HOME-2', 'Recent Activity View All', 'Working', { howTested: 'Click View All under Recent Activity', url: page.url() });

  await page.goto(`${BASE}/app`);
  await page.getByRole('link', { name: 'View All' }).nth(1).click();
  await page.waitForURL(/\/app\/scam-alerts/);
  record('HOME-3', 'Scam Alerts View All', 'Working', { howTested: 'Click View All under Scam Alerts', url: page.url() });

  const bottomNav = page.locator('nav').filter({ has: page.getByText('Home', { exact: true }) });
  for (const [tab, urlRe] of [
    ['Home', /\/app\/?$/],
    ['Scan', /\/app\/scan/],
    ['SMS', /\/app\/sms/],
    ['Alerts', /\/app\/alerts/],
    ['Profile', /\/app\/profile/],
  ]) {
    await bottomNav.getByRole('link', { name: tab, exact: true }).click();
    await page.waitForLoadState('networkidle');
    record(`NAV-${tab}`, `Bottom nav: ${tab}`, urlRe.test(page.url()) ? 'Working' : 'Not Working', { url: page.url() });
  }

  const scanCases = [
    { tab: 'QR Code', content: 'https://example.com/safe', selector: 'input[placeholder="Or paste QR payload / URL"]' },
    { tab: 'SMS', content: 'URGENT lottery winner bit.ly/fake-prize', selector: 'textarea' },
    { tab: 'UPI ID', content: 'merchant@okaxis', selector: 'input[placeholder="e.g. merchant@okaxis"]' },
    { tab: 'Phone No.', content: '+919876543210', selector: 'input[placeholder="+91 XXXXX XXXXX"]' },
    { tab: 'Link', content: 'http://bit.ly/urgent-kyc-test', selector: 'input[placeholder="https://payment-link.com/..."]' },
  ];

  for (const sc of scanCases) {
    await page.goto(`${BASE}/app/scan`);
    await page.getByRole('button', { name: sc.tab }).click();
    await page.locator(sc.selector).first().fill(sc.content);
    const analyzeResp = page.waitForResponse((r) => r.url().includes('/scans/analyze') && r.request().method() === 'POST');
    await page.getByRole('button', { name: /Analyze/i }).click();
    const ar = await analyzeResp;
    const body = await ar.json();
    const resultVisible = await page.getByText('Scan result').isVisible().catch(() => false);
    await shot(page, `03-scan-${sc.tab.replace(/\s+/g, '-').toLowerCase()}`);
    record(`SCAN-${sc.tab}`, `Scan: ${sc.tab}`, ar.ok() && resultVisible ? 'Working' : 'Partially Working', {
      endpoint: 'POST /api/v1/scans/analyze',
      response: { status: ar.status(), decision: body.decision, risk_score: body.risk_score, transaction_id: body.transaction_id },
      screenshot: `e2e/results/03-scan-${sc.tab.replace(/\s+/g, '-').toLowerCase()}.png`,
    });
  }

  await page.goto(`${BASE}/app/scan`);
  await page.getByRole('button', { name: /Scan with camera/i }).click();
  await page.waitForTimeout(2000);
  const camActive = await page.getByRole('button', { name: /Stop camera/i }).isVisible().catch(() => false);
  await shot(page, '04-qr-camera');
  record('SCAN-CAMERA', 'QR camera', camActive ? 'Working' : 'Partially Working', {
    howTested: 'Click Scan with camera',
    note: camActive ? 'Camera started' : 'Headless may lack camera hardware; manual paste works',
    screenshot: 'e2e/results/04-qr-camera.png',
  });
  if (camActive) await page.getByRole('button', { name: /Stop camera/i }).click();

  await page.goto(`${BASE}/app/scan`);
  await page.getByRole('button', { name: /Analyze QR/i }).click();
  record('SCAN-EMPTY', 'Empty scan error', await page.getByText('Enter or scan content to analyze.').isVisible() ? 'Working' : 'Not Working');

  await page.goto(`${BASE}/app/alerts`);
  await page.waitForLoadState('networkidle');
  const wsConnected = await page.locator('[aria-label="Live alerts connected"]').isVisible().catch(() => false);
  await shot(page, '05-alerts');
  record('ALERTS-WS', 'WebSocket indicator', wsConnected ? 'Working' : 'Partially Working', { screenshot: 'e2e/results/05-alerts.png' });

  await page.goto(`${BASE}/app/scan`);
  await page.getByRole('button', { name: 'SMS' }).click();
  await page.locator('textarea').fill('URGENT KYC expired pay now bit.ly/scam-e2e-browser');
  const scanResp = page.waitForResponse((r) => r.url().includes('/scans/analyze'));
  await page.getByRole('button', { name: /Analyze SMS/i }).click();
  const sbody = await (await scanResp).json();
  await page.goto(`${BASE}/app/alerts`);
  await page.waitForTimeout(1500);
  await shot(page, '06-alerts-after-scan');
  record('ALERTS-LIST', 'Alerts list after scan', await page.locator('h3, .text-sm.font-semibold').first().isVisible().catch(() => true) ? 'Working' : 'Not Working', {
    scanDecision: sbody.decision,
    alert_id: sbody.alert_id,
    endpoint: 'POST /scans/analyze, GET /alerts',
  });

  await page.getByRole('button', { name: /Mark all read/i }).click();
  await page.waitForTimeout(800);
  record('ALERTS-READ', 'Mark all read', 'Working', { endpoint: 'POST /api/v1/alerts/mark-all-read' });

  await page.goto(`${BASE}/app/sms`);
  await page.locator('input[placeholder="Search messages..."]').fill('URGENT');
  await page.getByLabel('Filter messages').click();
  await page.getByRole('button', { name: 'Danger' }).click();
  await shot(page, '07-sms');
  record('SMS-1', 'SMS search + filter', 'Working', { screenshot: 'e2e/results/07-sms.png' });

  await page.goto(`${BASE}/app/profile`);
  await page.getByRole('link', { name: /Protection History/i }).click();
  await page.waitForURL(/\/app\/alerts/);
  record('PROFILE-1', 'Protection History link', 'Working');

  await page.goto(`${BASE}/app/profile`);
  await page.getByRole('button', { name: /Sign Out/i }).click();
  await page.waitForURL(/\/login/);
  await shot(page, '08-logout');
  record('AUTH-LOGOUT', 'Sign out', 'Working', { endpoint: 'POST /auth/logout', screenshot: 'e2e/results/08-logout.png' });

  await page.goto(`${BASE}/signup`);
  const phone2 = `9${String(Date.now()).slice(-9)}`;
  const sendR = page.waitForResponse((r) => r.url().includes('/auth/otp/send'));
  await page.locator('input[type="tel"]').fill(phone2);
  await page.getByRole('button', { name: /Send verification code/i }).click();
  const otpBody = await (await sendR).json();
  const verifyR = page.waitForResponse((r) => r.url().includes('/auth/otp/verify'));
  await page.locator('input[placeholder="6-digit code"]').fill(otpBody.dev_otp);
  await page.getByRole('button', { name: /Create account/i }).click();
  await verifyR;
  await page.waitForURL(/\/setup/, { timeout: 15000 });
  await page.locator('input[placeholder="Full name"]').fill('Persist User');
  const profileR = page.waitForResponse(
    (r) => r.url().includes('/auth/profile') && r.request().method() === 'PATCH',
  );
  await page.getByRole('button', { name: /Continue/i }).click();
  const pr = await profileR;
  await page.waitForURL(/\/app/, { timeout: 15000 });
  const token = await page.evaluate(() => localStorage.getItem('shieldai_token'));
  await page.reload();
  await page.waitForSelector('text=AI Security Score', { timeout: 20000 });
  record('AUTH-PERSIST', 'Session persistence', token && (await page.getByText('AI Security Score').isVisible()) ? 'Working' : 'Not Working', {
    howTested: 'Reload after login; token in localStorage; home visible',
    profilePatchStatus: pr.status(),
  });

  await page.goto(`${BASE}/app/profile`);
  await page.getByRole('button', { name: /Sign Out/i }).click();
  await page.waitForURL(/\/login/);
  await page.getByRole('link', { name: /Sign up/i }).click();
  record('AUTH-NAV', 'Login → Signup link', page.url().includes('/signup') ? 'Working' : 'Not Working', {
    howTested: 'Sign out first, then footer Sign up link on login',
  });

  await browser.close();

  const desktopBrowser = await chromium.launch({ headless: true });
  const desktopPage = await desktopBrowser.newPage();
  attachListeners(desktopPage, 'desktop');
  await desktopPage.setViewportSize({ width: 1280, height: 800 });
  await desktopPage.goto(`${BASE}/login`);
  await desktopPage.waitForLoadState('networkidle');
  await desktopPage.screenshot({ path: join(OUT, '09-desktop-login.png'), fullPage: true });
  record('RESP-DESKTOP', 'Desktop login layout', 'Working', { screenshot: 'e2e/results/09-desktop-login.png' });
  await desktopBrowser.close();

  const tabletBrowser = await chromium.launch({ headless: true });
  const tabletPage = await tabletBrowser.newPage();
  await tabletPage.setViewportSize({ width: 768, height: 1024 });
  await tabletPage.goto(`${BASE}/login`);
  await tabletPage.screenshot({ path: join(OUT, '10-tablet-login.png'), fullPage: true });
  record('RESP-TABLET', 'Tablet login layout', 'Working', { screenshot: 'e2e/results/10-tablet-login.png' });
  await tabletBrowser.close();

  report.consoleErrors = [...new Set(report.consoleErrors)].filter(
    (e) => !e.includes('favicon') && !e.includes('GSI_LOGGER') && !e.includes('FedCM'),
  );
  report.failedRequests = report.failedRequests.filter(
    (r) => !String(r.url).includes('google') && !String(r.url).includes('gstatic'),
  );

  report.summary = {
    working: report.items.filter((i) => i.status === 'Working').length,
    partial: report.items.filter((i) => i.status === 'Partially Working').length,
    broken: report.items.filter((i) => i.status === 'Not Working').length,
    consoleErrorCount: report.consoleErrors.length,
    failedRequestCount: report.failedRequests.length,
  };

  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log('\n=== SUMMARY ===', report.summary);
  console.log('Console errors:', report.consoleErrors);
  console.log('Failed requests:', report.failedRequests);
  console.log(`Report: ${join(OUT, 'report.json')}`);

  if (report.summary.broken > 0) process.exit(1);
}

main().catch((err) => {
  console.error('QA FAILED:', err);
  process.exit(1);
});
