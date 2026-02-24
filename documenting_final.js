require('dotenv').config();
const puppeteer = require('puppeteer');
const { Client, LocalAuth } = require('whatsapp-web.js');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {

  // ================= WHATSAPP =================

  const waClient = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: false }
  });

  await new Promise(resolve => {
    waClient.on('ready', resolve);
    waClient.initialize();
  });

  console.log("WhatsApp conectado!");

  const meuContato = await waClient.getContactById(waClient.info.wid._serialized);
  const meuNome = meuContato.pushname || "Eu";

  async function buscarConversa(numeroBruto) {

    const numero = String(numeroBruto).replace(/\D/g, '');

    try {

      const numberId = await waClient.getNumberId(numero);
      if (!numberId) return "Número não encontrado no WhatsApp.";

      const chat = await waClient.getChatById(numberId._serialized);
      const mensagens = await chat.fetchMessages({ limit: 2000 });

      if (!mensagens.length) return "Conversa vazia.";

      let conversa = "";

      for (let msg of mensagens) {

        const dataObj = new Date(msg.timestamp * 1000);

        const hora = dataObj.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });

        const data = dataObj.toLocaleDateString('en-US');
        const autor = msg.fromMe ? meuNome : numero;

        conversa += `[${hora}, ${data}] ${autor}: ${msg.body}\n`;
      }

      return conversa;

    } catch (err) {
      console.log("Erro ao buscar conversa:", err.message);
      return "Erro ao buscar conversa.";
    }
  }

  // ================= PUPPETEER =================

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null
  });

  const page = await browser.newPage();

  const USERNAME = process.env.EC_USERNAME;
  const PASSWORD = process.env.EC_PASSWORD;

  await page.goto('https://enrollmentcounselor.byupathway.edu/Actions-1/', {
    waitUntil: 'networkidle2'
  });

  await page.type('#Username', USERNAME);
  await page.type('#PasswordValue', PASSWORD);

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2' }),
    page.click('#submit-signin-local')
  ]);

  console.log("Login realizado!");

  await page.waitForSelector('tr[data-entity="task"]');

  const total = await page.$$eval(
    'tr[data-entity="task"]',
    rows => rows.length
  );

  console.log(`Encontrados ${total} itens`);

  for (let i = 0; i < total; i++) {

    console.log(`\nProcessando ${i + 1}/${total}`);

    const selector = `tr[data-entity="task"]:nth-of-type(${i + 1})`;

    await page.waitForSelector(selector);
    const row = await page.$(selector);

    const phone = await row.$eval(
      'td[data-attribute="description"]',
      el => {
        const match = el.innerText.match(/Mobile Phone:\s*([+0-9]+)/);
        return match ? match[1].trim() : null;
      }
    );

    console.log("Telefone:", phone);

    if (!phone) continue;

    const conversa = await buscarConversa(phone);

    const menuButton = await row.$('button[data-toggle="dropdown"]');
    await menuButton.click();
    await delay(800);

    const viewDetails = await row.$('a.details-link.launch-modal');
    await viewDetails.click();

    await delay(2000);

    const frames = page.frames();
    let formFrame = null;

    for (const frame of frames) {
      try {
        const el = await frame.$('#pw_note');
        if (el) {
          formFrame = frame;
          break;
        }
      } catch {}
    }

    if (!formFrame) {
      console.log("Textarea não encontrado.");
      continue;
    }

    await formFrame.evaluate((texto) => {
      const textarea = document.querySelector('#pw_note');
      textarea.value = texto;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }, conversa.substring(0, 39000));

    console.log("Conversa inserida!");

    await formFrame.waitForSelector('#UpdateButton', { timeout: 15000 });

    await formFrame.evaluate(() => {
      const btn = document.querySelector('#UpdateButton');
      if (btn) btn.click();
    });

    console.log("Botão Save acionado!");

    await delay(5000);

    console.log("Salvo (aguardado postback).");

    await delay(1500);
  }

  console.log("\nTodos os itens processados!");

})();