const { Client, LocalAuth } = require('whatsapp-web.js');

async function initWhatsApp() {
  const waClient = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: false }
  });

  await new Promise(resolve => {
    waClient.on('ready', resolve);
    waClient.initialize();
  });

  console.log("WhatsApp conectado!");
  return waClient;
}

async function buscarConversa(waClient, numeroBruto) {
  const numero = String(numeroBruto).replace(/\D/g, '');

  try {
    const numberId = await waClient.getNumberId(numero);
    if (!numberId) return { conversa: null, houveResposta: false };

    const chat = await waClient.getChatById(numberId._serialized);
    const mensagens = await chat.fetchMessages({ limit: 2000 });

    if (!mensagens.length) return { conversa: null, houveResposta: false };

    let conversa = "";
    let houveResposta = false;

    const meuContato = await waClient.getContactById(waClient.info.wid._serialized);
    const meuNome = meuContato.pushname || "Eu";

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

    if (!conversa) return { conversa: null, houveResposta: false };

    return { conversa, houveResposta };

  } catch {
    return { conversa: null, houveResposta: false };
  }
}

module.exports = {
  initWhatsApp,
  buscarConversa
};