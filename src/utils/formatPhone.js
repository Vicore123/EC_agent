function formatarNumeroWhatsApp(numero) {
  if (!numero) return null;

  // Remove tudo que não for número
  let digits = numero.replace(/\D/g, '');

  // Remove zeros à esquerda
  digits = digits.replace(/^0+/, '');

  // Se já começar com 55 (Brasil)
  if (digits.startsWith('55')) {
    return `+${digits}`;
  }

  // Se tiver 11 dígitos (DDD + 9 + número)
  if (digits.length === 11) {
    return `+55${digits}`;
  }

  // Se tiver 10 dígitos (DDD + número sem o 9)
  if (digits.length === 10) {
    const ddd = digits.substring(0, 2);
    const numeroSem9 = digits.substring(2);
    return `+55${ddd}9${numeroSem9}`;
  }

  // Caso inesperado, só adiciona +
  return `+${digits}`;
}

module.exports = { formatarNumeroWhatsApp };