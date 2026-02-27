require('dotenv').config();

const { initWhatsApp } = require('./services/whatsapp');
const { initBrowser } = require('./services/puppeteerService');
const { delay } = require('./utils/delay');

function extrairTelefone(texto, campo) {
  const regex = new RegExp(`${campo}:\\s*([+\\d\\s]{8,20})`);
  const match = texto.match(regex);
  if (!match) return null;

  const numero = match[1].replace(/\D/g, '');
  if (!numero || numero.length < 10) return null;

  return numero;
}

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

    console.log(`\n==============================`);
    console.log(`Encontrados ${total} itens`);
    console.log(`==============================\n`);

    for (let i = 0; i < total; i++) {

      console.log(`Processando ${i + 1}/${total}`);

      const selector = `tr[data-entity="task"]:nth-of-type(${i + 1})`;

      await page.waitForSelector(selector);

      // ================= SUBJECT =================

      const subject = await page.$eval(
        `${selector} td[data-attribute="subject"]`,
        el => el.innerText.trim()
      ).catch(() => null);

      if (!subject) {
        console.log("Subject não encontrado.\n");
        continue;
      }

      console.log("Subject:", subject);

      // ================= DESCRIPTION =================

      const description = await page.$eval(
        `${selector} td[data-attribute="description"]`,
        el => el.innerText
      ).catch(() => null);

      if (!description) {
        console.log("Descrição não encontrada.\n");
        continue;
      }

      // ================= NOME DO ESTUDANTE =================

      let nome = await page.$eval(
        `${selector} td[data-attribute="regardingobjectid"]`,
        el => {
          const nomeCompleto = el.innerText.trim();
          return nomeCompleto.split(/\s+/)[0]; // pega apenas o primeiro nome
        }
      ).catch(() => null);

      if (!nome || nome.length < 2) {
        nome = "Student";
      }

      console.log("Primeiro nome encontrado:", nome);

      // ================= TELEFONE =================

      let telefone =
        extrairTelefone(description, "Mobile Phone") ||
        extrairTelefone(description, "WhatsApp");

      if (!telefone) {
        console.log("Nenhum telefone válido encontrado.\n");
        continue;
      }

      console.log("Telefone encontrado no site:", telefone);

      // ================= VERIFICAR WHATSAPP =================

      let numberId = null;

      try {
        numberId = await waClient.getNumberId(telefone);
      } catch (err) {
        console.log("Erro ao verificar número no WhatsApp:", err.message);
        continue;
      }

      if (!numberId) {
        console.log("Número NÃO existe no WhatsApp.\n");
        continue;
      }

      console.log("Número existe no WhatsApp.");

      // ================= IDIOMA =================

      const isBrasil = telefone.startsWith("55");
      const idioma = isBrasil ? "PT" : "EN";

      console.log("Idioma definido:", idioma);

      // ================= PROGRAMA (REQUEST INFO) =================

      let programMatch = description.match(/Program Interest:\s*(.*)/);
      let programName = programMatch ? programMatch[1].trim() : "";

      let programaAdmit =
        subject === "EC3 Admit"
          ? "EnglishConnect 3"
          : "PathwayConnect";

      let mensagem = "";

      // ================= APPLICATION START =================

      if (
        subject === "Application Start" ||
        subject === "Portuguese Application Start"
      ) {

        console.log("Template usado: Application Start");

        if (idioma === "PT") {

          mensagem = `Boa tarde ${nome}!

Meu nome é Vinicius, sou Aluno e Conselheiro de Matrículas do BYU-Pathway. Vi que você começou seu processo de applicação no Programa PathwayConnect, mas não o completou. Você está tendo alguma dificuldade nesta etapa?

Quero te lembrar que o BYU-Pathway oferece uma educação de qualidade, centralizada em Jesus Cristo, com a flexibilidade de estudar online e a oportunidade de conquistar um diploma com um custo acessível. Além disso, você conta com o apoio de uma comunidade que está ao seu lado e torce pelo seu sucesso.

Se você tiver qualquer dúvida ou estiver com dificuldades para se matricular, estou à disposição para te ajudar.
É só me chamar!`;

        } else {

          mensagem = `Good afternoon ${nome}!

My name is Vinicius, I am a student and Enrollment Counselor for BYU-Pathway. I noticed you started your application for PathwayConnect but did not complete it. Are you having any difficulty at this stage?

BYU-Pathway offers quality education centered on Jesus Christ, with the flexibility of studying online and the opportunity to earn a degree at an affordable cost. You will also have the support of a community that is cheering for your success.

If you have any questions or are having difficulty enrolling, I am here to help!`;
        }
      }

      // ================= ADMIT =================

      else if (
        subject === "EC3 Admit" ||
        subject === "PC Admit" ||
        subject === "Portuguese PC Admit"
      ) {

        console.log("Template usado: Admit");

        if (idioma === "PT") {

          const linkBrasil = isBrasil
            ? `\nA partir de 28 de Janeiro:
✅ Siga este passo a passo para realizar a registração:
https://help.byupathway.edu/pt-BR/knowledgebase/article/?kb=KA-03020&lang=pt`
            : `\n✅ registre-se para as aulas`;

          mensagem = `Bom dia ${nome}

Meu nome é Vinicius Alves, sou estudante e conselheiro de matricula para os alunos da BYU-Pathway, gostaria de prestar meus parabéns por sua admissão no ${programaAdmit} da BYU-Pathway Worldwide! Estamos muito felizes em ter você conosco! Como conselheiro de matrícula, estou aqui para ajudar você a dar os próximos passos com sucesso no processo de matrícula.
Aqui estão os próximos passos que você deve seguir para se registrar até o inicio das aulas dia 2 de Março:

✅ Acesse o portal do estudante
Visite portal.byupathway.edu e selecione "Student Portal".
Escolha sua conta Microsoft @byupathway.edu.
Caso não consiga selecioná-la, digite o e-mail exatamente como você recebeu.
Entre utilizando as credenciais da sua conta da Igreja.

✅ Resolva qualquer pendência (holds)
✅ Escolha um grupo de reunião (gathering)
${linkBrasil}

Você não está sozinho! Se tiver dúvidas, travar em alguma etapa ou enfrentar qualquer problema, estou à disposição para ajudar. Vou continuar acompanhando para garantir que tudo siga no caminho certo.`;

        } else {

          mensagem = `Good morning ${nome}

My name is Vinicius Alves, I am a student and Enrollment Counselor for BYU-Pathway. Congratulations on your admission to ${programaAdmit} at BYU-Pathway Worldwide!

Here are your next steps:

✅ Access the Student Portal at portal.byupathway.edu
✅ Resolve any holds
✅ Choose a gathering

You are not alone! If you have any questions or face any problems, I am here to help.`;
        }
      }

      // ================= REQUEST INFO =================

      else if (
        subject === "EC Request Info Contact" ||
        subject === "Request Info Lead"
      ) {

        console.log("Template usado: Request Info");

        if (idioma === "PT") {

          mensagem = `Bom dia ${nome}!

Meu nome é Vinicius, sou Aluno e Conselheiro de Matrículas do BYU-Pathway. Vi que você está interessado no programa ${programName}! Você tem alguma pergunta ou algo especifico que você gostaria de saber sobre o programa?

Quero te lembrar que o BYU-Pathway oferece uma educação de qualidade, centralizada em Jesus Cristo, com a flexibilidade de estudar online e a oportunidade de conquistar um diploma com um custo acessível. Além disso, você conta com o apoio de uma comunidade que está ao seu lado e torce pelo seu sucesso.

Se você tiver qualquer dúvida ou estiver com dificuldades para se matricular, estou à disposição para te ajudar.
É só me chamar!`;

        } else {

          mensagem = `Good morning ${nome}!

My name is Vinicius, I am a student and Enrollment Counselor for BYU-Pathway. I saw that you are interested in ${programName}! Do you have any specific questions about the program?

BYU-Pathway offers quality education centered on Jesus Christ, with the flexibility of studying online and the opportunity to earn a degree at an affordable cost. You will also have the support of a community that is cheering for your success.

If you have any questions, I am here to help!`;
        }
      }

      else {
        console.log("Subject não mapeado. Pulando.\n");
        continue;
      }

      // ================= ENVIO =================

      try {
        await waClient.sendMessage(numberId._serialized, mensagem);
        console.log("Mensagem enviada com sucesso!\n");
      } catch (err) {
        console.log("Erro ao enviar mensagem:", err.message);
        continue;
      }

      const randomDelay = Math.floor(Math.random() * 5000) + 4000;
      await delay(randomDelay);
    }

    const nextExists = await page.$(
      '.entity-pager-next-link:not([aria-disabled="true"])'
    );

    if (nextExists) {
      console.log("Indo para próxima página...\n");
      await page.click('.entity-pager-next-link');
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