const { Client, LocalAuth } = require('whatsapp-web.js');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function perguntar(q) {
  return new Promise(r => rl.question(q, r));
}

(async () => {

  let numeros, nomes;

  try {
    numeros = JSON.parse(await perguntar("Numeros em JSON: "));
    nomes = JSON.parse(await perguntar("Nomes em JSON: "));
  } catch {
    console.log("JSON inválido.");
    process.exit();
  }

  if (numeros.length !== nomes.length) {
    console.log("Quantidade de nomes e números não coincide.");
    process.exit();
  }

  rl.close();

  const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: false }
  });

  client.on('ready', async () => {

    for (let i = 0; i < numeros.length; i++) {

      const numero = String(numeros[i]).replace(/\D/g, '');
      const nome = nomes[i];

      const id = await client.getNumberId(numero);
      if (!id) continue;

      const mensagem = `Bom dia ${nome}

Meu nome é Vinicius Alves, sou estudante e conselheiro de matrícula para os alunos da BYU-Pathway, gostaria de prestar meus parabéns por sua admissão no PathwayConnect da BYU-Pathway Worldwide! Estamos muito felizes em ter você conosco! Como conselheiro de matrícula, estou aqui para ajudar você a dar os próximos passos com sucesso no processo de matrícula.

Aqui estão os próximos passos que você deve seguir para se registrar até o início das aulas dia 2 de Março:

✅ Acesse o portal do estudante
Visite portal.byupathway.edu e selecione "Student Portal".
Escolha sua conta Microsoft @byupathway.edu.
Caso não consiga selecioná-la, digite o e-mail exatamente como você recebeu.
Entre utilizando as credenciais da sua conta da Igreja.

✅ Resolva qualquer pendência (holds)
✅ Escolha um grupo de reunião (gathering)

A partir de 28 de Janeiro:
✅ Siga este passo a passo para realizar a registração:
https://help.byupathway.edu/pt-BR/knowledgebase/article/?kb=KA-03020&lang=pt

⚠️ Importante para alunos do Programa Piloto em Português
Se estiver iniciando o Programa Piloto em Português, poderá participar apenas de um curso do PathwayConnect e um curso de religião nos dois primeiros períodos.

Você não está sozinho! Se tiver dúvidas ou enfrentar qualquer problema, estou à disposição para ajudar.`;

      await client.sendMessage(id._serialized, mensagem);
      console.log("Enviado para:", nome);

      const delay = Math.floor(Math.random() * (9000 - 4000 + 1)) + 4000;
      await new Promise(r => setTimeout(r, delay));
    }

    console.log("Finalizado.");
    process.exit();
  });

  client.initialize();

})();