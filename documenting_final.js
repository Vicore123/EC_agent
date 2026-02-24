require('dotenv').config();
const puppeteer = require('puppeteer');
const { Client, LocalAuth } = require('whatsapp-web.js');
const OpenAI = require("openai");

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function log(step, message) {
  const time = new Date().toLocaleTimeString();
  console.log(`[${time}] [${step}] ${message}`);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

(async () => {

  const startTime = Date.now();
  log("SYSTEM", "Iniciando automação...");

  // ================= WHATSAPP =================

  log("WHATSAPP", "Inicializando cliente...");
  const waClient = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: false }
  });

  await new Promise(resolve => {
    waClient.on('ready', resolve);
    waClient.initialize();
  });

  log("WHATSAPP", "Conectado com sucesso!");

  const meuContato = await waClient.getContactById(waClient.info.wid._serialized);
  const meuNome = meuContato.pushname || "Eu";

  async function buscarConversa(numeroBruto) {

    const numero = String(numeroBruto).replace(/\D/g, '');
    log("WHATSAPP", `Buscando conversa do número: ${numero}`);

    try {

      const numberId = await waClient.getNumberId(numero);
      if (!numberId) {
        log("WHATSAPP", "Número não encontrado no WhatsApp.");
        return { conversa: null, houveResposta: false };
      }

      const chat = await waClient.getChatById(numberId._serialized);
      const mensagens = await chat.fetchMessages({ limit: 2000 });

      log("WHATSAPP", `${mensagens.length} mensagens encontradas.`);

      if (!mensagens.length) return { conversa: null, houveResposta: false };

      let conversa = "";
      let houveResposta = false;

      for (let msg of mensagens) {

        const tiposIgnorados = [
          'e2e_notification',
          'notification',
          'protocol',
          'ciphertext',
          'revoked'
        ];

        if (tiposIgnorados.includes(msg.type)) continue;
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

      if (!conversa) {
        log("WHATSAPP", "Conversa válida não encontrada.");
        return { conversa: null, houveResposta: false };
      }

      log("WHATSAPP", `Conversa montada. Houve resposta: ${houveResposta}`);
      return { conversa, houveResposta };

    } catch (err) {
      log("ERROR", `Erro ao buscar conversa: ${err.message}`);
      return { conversa: null, houveResposta: false };
    }
  }

  async function gerarResumo(conversa) {
    log("AI", "Gerando resumo...");
    const resposta = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages: [
          {
            role: "system",
            content: "You are a CRM assistant (Vinicius Alves Enrollment Counsellor) that generates very short, objective summaries in English only."
          },
          {
            role: "user",
            content: `Summarize the following WhatsApp conversation in English in a maximum of 15 words. Example: "Student unable to access portal and requested password reset."\n\n${conversa.substring(0, 15000)}`
          }
        ]
      });

    const resumo = resposta.choices[0].message.content.trim();
    log("AI", `Resumo gerado: ${resumo}`);
    return resumo;
  }

  async function classificarResposta(conversa, houveResposta) {

    if (!houveResposta) {
      log("AI", "Sem resposta do aluno → Classificação 0");
      return 0;
    }

    log("AI", "Classificando resposta do aluno...");

    const resposta = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: `
You must return ONLY ONE NUMBER from this list:

0 No response
1 No longer interested
2 Requested more information
3 Learned more about EnglishConnect
4 Interested but scheduling conflict
5 Waiting financial information
6 Needed guidance with application
7 Technical issue
8 Completed application successfully (use this if the student is admited and you're unsure)
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

    const numero = parseInt(resposta.choices[0].message.content.trim()) || 0;
    log("AI", `Classificação definida como: ${numero}`);
    return numero;
  }

  // ================= PUPPETEER =================

  log("CRM", "Abrindo navegador...");
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null
  });

  const page = await browser.newPage();

  log("CRM", "Acessando página de login...");
  await page.goto('https://enrollmentcounselor.byupathway.edu/Actions-1/', {
    waitUntil: 'networkidle2'
  });

  log("CRM", "Inserindo credenciais...");
  await page.type('#Username', process.env.EC_USERNAME);
  await page.type('#PasswordValue', process.env.EC_PASSWORD);

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2' }),
    page.click('#submit-signin-local')
  ]);

  log("CRM", "Login realizado com sucesso!");

  await page.waitForSelector('tr[data-entity="task"]');

  const total = await page.$$eval(
    'tr[data-entity="task"]',
    rows => rows.length
  );

  log("CRM", `Total de tarefas encontradas: ${total}`);

  for (let i = 0; i < total; i++) {

    log("CRM", `Processando tarefa ${i + 1} de ${total}`);

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

    log("CRM", `Telefone encontrado: ${phone}`);

    if (!phone) continue;

    const { conversa, houveResposta } = await buscarConversa(phone);
    if (!conversa) continue;

    let textoFinal = conversa;

    if (houveResposta) {
      const resumo = await gerarResumo(conversa);
      textoFinal = `${resumo}\n\n${conversa}`;
    }

    const classificacao = await classificarResposta(conversa, houveResposta);

    log("CRM", "Abrindo modal de detalhes...");
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

    if (!formFrame) {
      log("ERROR", "Formulário não encontrado.");
      continue;
    }

    log("CRM", "Inserindo nota...");
    await formFrame.evaluate((texto) => {
      const textarea = document.querySelector('#pw_note');
      textarea.value = texto;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }, textoFinal.substring(0, 39000));

    log("CRM", "Definindo Contact Method...");
    await formFrame.evaluate(() => {
      const select = document.querySelector('#pw_communicationmethod');
      if (select) {
        select.value = "111110000";
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    log("CRM", `Definindo Student Response Key: ${classificacao}`);
    await formFrame.evaluate((valor) => {
      const input = document.querySelector('#pw_studentresponsekey');
      if (input) {
        input.value = valor;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, classificacao);

    log("CRM", "Salvando...");
    await formFrame.evaluate(() => {
      const btn = document.querySelector('#UpdateButton');
      if (btn) btn.click();
    });

    await delay(4000);
    log("CRM", "Salvo com sucesso!");
  }

  log("SYSTEM", "Processamento concluído.");
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  log("SYSTEM", `Tempo total: ${duration}s`);

  await browser.close();
  process.exit();

})();