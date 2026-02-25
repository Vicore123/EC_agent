const openai = require("../config/openai");
const {
  resumoSystemPrompt,
  classificacaoSystemPrompt
} = require("../constants/prompts");

async function gerarResumo(conversa) {
  console.log("Gerando resumo...");

  const resposta = await openai.chat.completions.create({
    model: "gpt-5-mini",
    messages: [
      { role: "system", content: resumoSystemPrompt },
      {
        role: "user",
        content: `Summarize the following WhatsApp conversation in English in a maximum of 15 words.\n\n${conversa.substring(0, 15000)}`
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
      { role: "system", content: classificacaoSystemPrompt },
      {
        role: "user",
        content: conversa.substring(0, 15000)
      }
    ]
  });

  return parseInt(resposta.choices[0].message.content.trim()) || 0;
}

module.exports = {
  gerarResumo,
  classificarResposta
};