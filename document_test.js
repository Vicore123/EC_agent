const { Client, LocalAuth } = require('whatsapp-web.js');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function perguntar(q) {
  return new Promise(r => rl.question(q, r));
}

(async () => {

  let numeros;

  try {
    numeros = JSON.parse(await perguntar("Numeros em JSON: "));
  } catch {
    console.log("JSON inválido.");
    process.exit();
  }

  rl.close();

  const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: false }
  });

  client.on('ready', async () => {

    console.log("Cliente pronto!");

    const meuContato = await client.getContactById(client.info.wid._serialized);
    const meuNome = meuContato.pushname || "Eu";

    for (let numeroBruto of numeros) {

      const numero = String(numeroBruto).replace(/\D/g, '');
      const chatId = numero + "@c.us";

      try {

        const chat = await client.getChatById(chatId);
        const mensagens = await chat.fetchMessages({ limit: 1000 });

        // mensagens.reverse();

        let conversaString = "";

        for (let msg of mensagens) {

          const dataObj = new Date(msg.timestamp * 1000);

          const hora = dataObj.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });

          const data = dataObj.toLocaleDateString('en-US');

          const autor = msg.fromMe ? meuNome : numero;

          conversaString += `[${hora}, ${data}] ${autor}: ${msg.body}\n`;
        }

        console.log(conversaString);

      } catch (err) {
        console.log(`Erro ao processar ${numero}:`, err.message);
      }
    }

    console.log("Finalizado.");
    process.exit();
  });

  client.initialize();

})();