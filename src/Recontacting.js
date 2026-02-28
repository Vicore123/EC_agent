require('dotenv').config();

const readline = require('readline');
const { initWhatsApp } = require('./services/whatsapp');
const { delay } = require('./utils/delay');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function perguntar(pergunta) {
  return new Promise(resolve => rl.question(pergunta, resolve));
}

function validarNumero(numero) {
  const clean = numero.replace(/\D/g, '');
  return clean.length >= 10 ? clean : null;
}

(async () => {

  console.log("🚀 Iniciando envio manual...\n");

  const waClient = await initWhatsApp();

  // ================= LISTA DE NÚMEROS =================

  let numerosInput = await perguntar(
    "📱 Insira a lista de números no formato [5511999999999, 5541998888888]:\n"
  );

  let numeros;

  try {
    numeros = JSON.parse(numerosInput);
  } catch {
    console.log("❌ Formato inválido. Use exatamente: [5511999999999, 5541998888888]");
    process.exit();
  }

  if (!Array.isArray(numeros) || numeros.length === 0) {
    console.log("❌ Lista vazia ou inválida.");
    process.exit();
  }

  // ================= MENSAGEM =================

  const mensagem = await perguntar("\n💬 Digite a mensagem que deseja enviar:\n");

  if (!mensagem || mensagem.trim().length < 2) {
    console.log("❌ Mensagem inválida.");
    process.exit();
  }

  console.log("\n📋 Iniciando disparo...\n");

  // ================= ENVIO =================

  for (let i = 0; i < numeros.length; i++) {

    console.log(`➡️ ${i + 1}/${numeros.length}`);

    const numeroValidado = validarNumero(String(numeros[i]));

    if (!numeroValidado) {
      console.log("❌ Número inválido. Pulando.\n");
      continue;
    }

    let numberId;

    try {
      numberId = await waClient.getNumberId(numeroValidado);
    } catch (err) {
      console.log("❌ Erro ao verificar número:", err.message);
      continue;
    }

    if (!numberId) {
      console.log("❌ Número não existe no WhatsApp.\n");
      continue;
    }

    try {
      await waClient.sendMessage(numberId._serialized, mensagem);
      console.log("📤 Mensagem enviada com sucesso!\n");
    } catch (err) {
      console.log("❌ Erro ao enviar mensagem:", err.message);
      continue;
    }

    const randomDelay = Math.floor(Math.random() * 4000) + 5000; // 5s a 9s
    console.log(`⏳ Aguardando ${randomDelay}ms...\n`);
    await delay(randomDelay);
  }

  console.log("🏁 Envio concluído.");
  rl.close();
  process.exit();

})();