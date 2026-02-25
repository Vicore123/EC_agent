require('dotenv').config();

const { initWhatsApp, buscarConversa } = require('./services/whatsapp');
const { gerarResumo, classificarResposta } = require('./services/openaiService');
const { initBrowser } = require('./services/puppeteerService');
const { delay } = require('./utils/delay');

(async () => {

  const waClient = await initWhatsApp();
  const { browser, page } = await initBrowser();

  let continuar = true;

  while (continuar) {

    await page.waitForSelector('tr[data-entity="task"]');

    const total = await page.$$eval(
      'tr[data-entity="task"]',
      rows => rows.length
    );

    console.log(`Encontrados ${total} itens\n`);

    for (let i = 0; i < total; i++) {

      const selector = `tr[data-entity="task"]:nth-of-type(${i + 1})`;
      await page.waitForSelector(selector);

      const phone = await page.$eval(
        `${selector} td[data-attribute="description"]`,
        el => {
          const match = el.innerText.match(/Mobile Phone:\s*([+0-9]+)/);
          return match ? match[1].trim() : null;
        }
      );

      if (!phone) continue;

      console.log(`Telefone: ${phone}`);

      const { conversa, houveResposta } = await buscarConversa(waClient, phone);

      if (!conversa) continue;

      let textoFinal = conversa;

      if (houveResposta) {
        const resumo = await gerarResumo(conversa);
        textoFinal = `${resumo}\n\n${conversa}`;
      }

      const classificacao = await classificarResposta(conversa, houveResposta);

      console.log("Classificação:", classificacao);

      // Aqui você pode continuar a lógica do modal e save
      // Mantive separado para evitar node detached

    }

    continuar = false; // simplificado
  }

  await browser.close();
  process.exit();

})();