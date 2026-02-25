const puppeteer = require('puppeteer');

async function initBrowser() {

  const headlessMode = process.env.HEADLESS === "true";

  const browser = await puppeteer.launch({
    headless: headlessMode,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ],
    defaultViewport: null
  });

  const page = await browser.newPage();

  await page.goto(
    'https://enrollmentcounselor.byupathway.edu/Actions-1/',
    { waitUntil: 'networkidle2' }
  );

  await page.type('#Username', process.env.EC_USERNAME);
  await page.type('#PasswordValue', process.env.EC_PASSWORD);

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2' }),
    page.click('#submit-signin-local')
  ]);

  console.log("Login realizado!");
  console.log("Modo Headless:", headlessMode);

  return { browser, page };
}

module.exports = { initBrowser };