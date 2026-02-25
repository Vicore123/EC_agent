const puppeteer = require('puppeteer');

async function initBrowser() {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null
  });

  const page = await browser.newPage();

  await page.goto('https://enrollmentcounselor.byupathway.edu/Actions-1/', {
    waitUntil: 'networkidle2'
  });

  await page.type('#Username', process.env.EC_USERNAME);
  await page.type('#PasswordValue', process.env.EC_PASSWORD);

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2' }),
    page.click('#submit-signin-local')
  ]);

  console.log("Login realizado!");

  return { browser, page };
}

module.exports = { initBrowser };