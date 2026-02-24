require('dotenv').config();
const puppeteer = require('puppeteer');

(async () => {

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    // slowMo: 50
  });

  const page = await browser.newPage();

  // 🔐 Credenciais do .env
  const USERNAME = process.env.EC_USERNAME;
  const PASSWORD = process.env.EC_PASSWORD;

  if (!USERNAME || !PASSWORD) {
    console.error("Variáveis USERNAME ou PASSWORD não definidas no .env");
    process.exit(1);
  }

  // 1️⃣ Acessar o site
  await page.goto('https://enrollmentcounselor.byupathway.edu/Actions-1/', {
    waitUntil: 'networkidle2'
  });

  // 2️⃣ Login
  await page.type('#Username', USERNAME);
  await page.type('#PasswordValue', PASSWORD);

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2' }),
    page.click('#submit-signin-local')
  ]);

  console.log("Login realizado com sucesso!");

  // 🔹 Esperar tabela carregar
  await page.waitForSelector('tr[data-entity="task"]');

  const total = await page.$$eval(
    'tr[data-entity="task"]',
    rows => rows.length
  );

  console.log(`Encontrados ${total} itens`);

  for (let i = 0; i < total; i++) {

    console.log(`\nProcessando item ${i + 1} de ${total}`);

    const selector = `tr[data-entity="task"]:nth-of-type(${i + 1})`;

    await page.waitForSelector(selector);

    const row = await page.$(selector);

    const phone = await row.$eval(
      'td[data-attribute="description"]',
      el => {
        const match = el.innerText.match(/Mobile Phone:\s*([^\n]+)/);
        return match ? match[1].trim() : null;
      }
    );

    console.log("Telefone encontrado:", phone);

    const menuButton = await row.$('button[data-toggle="dropdown"]');
    await menuButton.click();

    await new Promise(r => setTimeout(r, 500));

    const viewDetails = await row.$('a.details-link.launch-modal');
    await viewDetails.click();

    await page.waitForSelector('.modal-dialog', { timeout: 10000 });

    console.log("Modal aberto");

    // 👉 AÇÃO AQUI

    await new Promise(r => setTimeout(r, 1500));

    await page.keyboard.press('Escape');

    await new Promise(r => setTimeout(r, 1000));
  }

  console.log("\nTodos os itens foram processados!");

})();