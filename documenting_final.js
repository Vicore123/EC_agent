require('dotenv').config();
const puppeteer = require('puppeteer');
const { Client, LocalAuth } = require('whatsapp-web.js');
const OpenAI = require("openai");

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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
      if (!numberId) return { conversa: null, houveResposta: false };

      const chat = await waClient.getChatById(numberId._serialized);
      const mensagens = await chat.fetchMessages({ limit: 2000 });

      if (!mensagens.length) return { conversa: null, houveResposta: false };

      let conversa = "";
      let houveResposta = false;

      for (let msg of mensagens) {

        // 🚫 Ignorar mensagens de sistema
        const tiposIgnorados = [
          'e2e_notification',
          'notification',
          'protocol',
          'ciphertext',
          'revoked'
        ];

        if (tiposIgnorados.includes(msg.type)) continue;

        // Ignorar mensagens vazias reais
        if (!msg.body || msg.body.trim() === "") continue;

        if (!msg.fromMe) houveResposta = true;

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

      if (!conversa) return { conversa: null, houveResposta: false };

      return { conversa, houveResposta };

    } catch (err) {
      console.log("Erro ao buscar conversa:", err.message);
      return { conversa: null, houveResposta: false };
    }
  }

  async function gerarResumo(conversa) {

    const resposta = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: "You generate very short CRM summaries in English (max 15 words)."
        },
        {
          role: "user",
          content: conversa.substring(0, 15000)
        }
      ]
    });

    return resposta.choices[0].message.content.trim();
  }

  async function classificarResposta(conversa, houveResposta) {

    if (!houveResposta) return 0;

    const resposta = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: `
Return ONLY ONE NUMBER from this list:

1 No longer interested
2 Requested more information
3 Learned more about EnglishConnect
4 Interested but scheduling conflict
5 Waiting financial information
6 Needed guidance with application
7 Technical issue
8 Completed application successfully
9 Returning student waiting provision
10 Plans to register future term
13 Successfully registered

Return only the number.
`
        },
        {
          role: "user",
          content: conversa.substring(0, 15000)
        }
      ]
    });

    const numero = resposta.choices[0].message.content.trim();
    return parseInt(numero) || 0;
  }

  // ================= PUPPETEER =================

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

  await page.waitForSelector('tr[data-entity="task"]');

  const total = await page.$$eval(
    'tr[data-entity="task"]',
    rows => rows.length
  );

  for (let i = 0; i < total; i++) {

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

    if (!phone) continue;

    const { conversa, houveResposta } = await buscarConversa(phone);
    if (!conversa) continue;

    let textoFinal = conversa;

    if (houveResposta) {
      const resumo = await gerarResumo(conversa);
      textoFinal = `${resumo}\n\n${conversa}`;
    }

    const classificacao = await classificarResposta(conversa, houveResposta);

    const menuButton = await row.$('button[data-toggle="dropdown"]');
    await menuButton.click();
    await delay(800);

    const viewDetails = await row.$('a.details-link.launch-modal');
    await viewDetails.click();
    await delay(2000);

    const frames = page.frames();
    let formFrame = null;

    for (const frame of frames) {
      const el = await frame.$('#pw_note');
      if (el) {
        formFrame = frame;
        break;
      }
    }

    if (!formFrame) continue;

    // Inserir texto
    await formFrame.evaluate((texto) => {
      const textarea = document.querySelector('#pw_note');
      textarea.value = texto;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }, textoFinal.substring(0, 39000));

    // Definir Contact Method = WhatsApp
    await formFrame.evaluate(() => {
      const select = document.querySelector('#pw_communicationmethod');
      if (select) {
        select.value = "111110000";
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    // Definir Student Response Key
    await formFrame.evaluate((valor) => {
      const input = document.querySelector('#pw_studentresponsekey');
      if (input) {
        input.value = valor;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, classificacao);

    // Salvar
    await formFrame.evaluate(() => {
      const btn = document.querySelector('#UpdateButton');
      if (btn) btn.click();
    });

    await delay(4000);
  }

  console.log("Finalizado. Fechando navegador...");

  await browser.close();
  process.exit();

})();