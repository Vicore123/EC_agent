require('dotenv').config();

const fs = require('fs');
const { initBrowser } = require('./services/puppeteerService');
const { delay } = require('./utils/delay');

async function waitForModalInAnyFrame(page, timeout = 20000) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    for (const frame of page.frames()) {
      const modal = await frame.$('.modal');
      if (modal) {
        return frame;
      }
    }
    await new Promise(r => setTimeout(r, 500));
  }

  throw new Error("Modal não encontrado em nenhum iframe.");
}

(async () => {

  const { browser, page } = await initBrowser();

  console.log("Selecionando CLOSED...");

  await page.waitForSelector('.selected-view.dropdown-toggle');
  await page.click('.selected-view.dropdown-toggle');
  await delay(800);

  const closedOptions = await page.$$('.dropdown-menu a');

  for (const option of closedOptions) {
    const text = await page.evaluate(el => el.innerText, option);
    if (text.includes("Closed")) {
      await option.click();
      break;
    }
  }

  await page.waitForSelector('table tbody tr');
  await delay(2000);

  const nomes = fs.readFileSync('src/nomes.txt', 'utf-8')
    .split('\n')
    .map(n => n.trim())
    .filter(Boolean);

  console.log(`\n${nomes.length} nomes carregados\n`);

  for (const nome of nomes) {

    console.log(`🔎 Pesquisando: ${nome}`);

    await page.waitForSelector('input.query');
    await page.click('input.query', { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await delay(500);

    await page.type('input.query', nome);
    await page.keyboard.press('Enter');
    await delay(3000);

    const rows = await page.$$('table tbody tr');

    if (rows.length === 0) {
      console.log(`❌ Nenhum registro encontrado para ${nome}`);
      continue;
    }

    let reabriu = false;

    for (const row of rows) {

      const textoLinha = await page.evaluate(el => el.innerText, row);

      if (
        textoLinha.includes("PC not registered") ||
        textoLinha.includes("EC3 not registered")
      ) {
        continue;
      }

      console.log("Abrindo menu...");

      const menuBtn = await row.$('button[data-toggle="dropdown"]');
      if (!menuBtn) continue;

      await menuBtn.click();
      await delay(1000);

      const reopenLinks = await page.$$('a.workflow-link');

      let clicou = false;

      for (const link of reopenLinks) {
        const texto = await page.evaluate(el => el.innerText, link);
        const visivel = await page.evaluate(el => el.offsetParent !== null, link);

        if (texto.includes("Re-open") && visivel) {
          await link.click();
          clicou = true;
          break;
        }
      }

      if (!clicou) continue;

      console.log("Esperando modal em qualquer iframe...");

      // 🔥 ESPERA MODAL EM QUALQUER FRAME
      const modalFrame = await waitForModalInAnyFrame(page);

      console.log("Modal encontrado. Clicando no botão...");

      await modalFrame.evaluate(() => {
        const buttons = Array.from(
          document.querySelectorAll('.modal-footer button')
        );

        const reopenBtn = buttons.find(btn =>
          btn.innerText.trim().toLowerCase() === 're-open'
        );

        if (!reopenBtn) {
          throw new Error("Botão Re-open não encontrado no modal.");
        }

        reopenBtn.click();
      });

      console.log("Botão clicado. Aguardando fechar...");

      await delay(3000);

      console.log(`✅ Reaberto: ${nome}\n`);

      reabriu = true;
      break;
    }

    if (!reabriu) {
      console.log(`Nenhum item válido para reabrir: ${nome}\n`);
    }

    await page.click('input.query', { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await delay(1000);
  }

  console.log("Processo finalizado.");
  await browser.close();
  process.exit();

})();