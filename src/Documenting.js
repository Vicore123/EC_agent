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

      console.log(`Processando ${i + 1}/${total}`);

      const selector = `tr[data-entity="task"]:nth-of-type(${i + 1})`;

      await page.waitForSelector(selector);

      // ================= EXTRAIR TELEFONES =================

      const contato = await page.$eval(
        `${selector} td[data-attribute="description"]`,
        el => {
          const texto = el.innerText;

          const mobileMatch = texto.match(/Mobile Phone:\s*([+0-9]+)/);
          const whatsappMatch = texto.match(/WhatsApp:\s*([+0-9]+)/);

          return {
            mobile: mobileMatch ? mobileMatch[1].trim() : null,
            whatsapp: whatsappMatch ? whatsappMatch[1].trim() : null
          };
        }
      ).catch(() => null);

      if (!contato) {
        console.log("Contato não encontrado.\n");
        continue;
      }

      let telefoneParaBuscar = contato.mobile;
      let resultado = null;

      if (telefoneParaBuscar) {
        resultado = await buscarConversa(waClient, telefoneParaBuscar);
      }

      // Se não achou conversa no Mobile, tenta WhatsApp
      if ((!resultado || !resultado.conversa) && contato.whatsapp) {
        console.log("Sem conversa no Mobile. Tentando WhatsApp...");
        telefoneParaBuscar = contato.whatsapp;
        resultado = await buscarConversa(waClient, telefoneParaBuscar);
      }

      if (!resultado || !resultado.conversa) {
        console.log("Nenhuma conversa encontrada em nenhum número.\n");
        continue;
      }

      console.log(`Usando telefone: ${telefoneParaBuscar}`);

      const { conversa, houveResposta } = resultado;

      let textoFinal = conversa;

      if (houveResposta) {
        const resumo = await gerarResumo(conversa);
        textoFinal = `${resumo}\n\n${conversa}`;
      } else {
        console.log("Estudante não respondeu. Resumo não gerado.");
      }

      const classificacao = await classificarResposta(conversa, houveResposta);

      console.log("Classificação sugerida:", classificacao);

      // ================= ABRIR MODAL =================

      await page.click(`${selector} button[data-toggle="dropdown"]`);
      await delay(800);

      await page.click(`${selector} a.details-link.launch-modal`);
      await delay(2000);

      // ================= ENCONTRAR FRAME =================

      let formFrame = null;

      for (const frame of page.frames()) {
        const el = await frame.$('#pw_note');
        if (el) {
          formFrame = frame;
          break;
        }
      }

      if (!formFrame) {
        console.log("Frame do formulário não encontrado.\n");
        continue;
      }

      // ================= INSERIR TEXTO =================

      await formFrame.evaluate((texto) => {
        const textarea = document.querySelector('#pw_note');
        textarea.value = texto;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }, textoFinal.substring(0, 39000));

      console.log("Texto inserido!");

      // ================= MÉTODO DE COMUNICAÇÃO =================

      await formFrame.evaluate(() => {
        const select = document.querySelector('#pw_communicationmethod');
        if (select) {
          select.value = "111110000";
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });

      // ================= CLASSIFICAÇÃO COM PROTEÇÃO 13 =================

      const deveAtualizarClassificacao = await formFrame.evaluate((novaClassificacao) => {
        const input = document.querySelector('#pw_studentresponsekey');
        if (!input) return false;

        const valorAtual = input.value;

        // Se já for 13, não alterar
        if (valorAtual === "13") {
          return false;
        }

        input.value = novaClassificacao;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;

      }, classificacao);

      if (!deveAtualizarClassificacao) {
        console.log("Classificação já é 13. Não alterada.");
      } else {
        console.log("Classificação atualizada.");
      }

      // ================= SAVE =================

      await formFrame.evaluate(() => {
        const btn = document.querySelector('#UpdateButton');
        if (btn) btn.click();
      });

      console.log("Botão Save acionado!");

      await delay(4000);

      console.log("Salvo com sucesso!\n");

      await delay(1500);
    }

    // ================= PAGINAÇÃO SEGURA =================

    const currentPage = await page.$eval(
      '.pagination li.active a',
      el => el.textContent.trim()
    ).catch(() => null);

    const nextExists = await page.$(
      '.entity-pager-next-link:not([aria-disabled="true"])'
    );

    if (nextExists && currentPage) {

      console.log("Indo para próxima página...\n");

      await page.click('.entity-pager-next-link');

      await page.waitForFunction(
        (oldPage) => {
          const active = document.querySelector('.pagination li.active a');
          return active && active.textContent.trim() !== oldPage;
        },
        {},
        currentPage
      );

      await page.waitForSelector('tr[data-entity="task"]');
      await delay(1500);

    } else {
      continuar = false;
    }
  }

  console.log("Processamento concluído.");

  await browser.close();
  process.exit();

})();