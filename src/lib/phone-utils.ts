// Utilitários para normalização e classificação de telefones brasileiros.

export interface NormalizedPhone {
  normalized: string;        // 55 + DDD + número (apenas dígitos)
  countryCode: string;       // sempre "55" para válidos
  ddd: string | null;        // 2 dígitos quando válido
  localNumber: string | null; // número sem DDD nem país
  isValid: boolean;
  reason?: string;
}

/** Remove tudo que não for dígito. */
export function stripPhone(input: unknown): string {
  if (input === null || input === undefined) return "";
  return String(input).replace(/\D+/g, "");
}

/**
 * Normaliza telefone para o padrão 55+DDD+número.
 * Aceita formatos comuns brasileiros, com ou sem código do país.
 */
export function normalizePhone(raw: unknown): NormalizedPhone {
  const digits = stripPhone(raw);

  if (!digits) {
    return { normalized: "", countryCode: "", ddd: null, localNumber: null, isValid: false, reason: "Telefone vazio" };
  }

  let withCountry = digits;

  // Se já começa com 55 e o tamanho total bate, mantém.
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    withCountry = digits;
  } else if (digits.length === 10 || digits.length === 11) {
    // DDD + número (sem país) — adiciona o 55.
    withCountry = "55" + digits;
  } else if (digits.startsWith("0") && (digits.length === 11 || digits.length === 12)) {
    // Algumas planilhas trazem 0 na frente do DDD.
    withCountry = "55" + digits.replace(/^0+/, "");
  } else {
    return {
      normalized: digits,
      countryCode: "",
      ddd: null,
      localNumber: null,
      isValid: false,
      reason: "Quantidade de dígitos fora do padrão brasileiro",
    };
  }

  if (withCountry.length !== 12 && withCountry.length !== 13) {
    return {
      normalized: withCountry,
      countryCode: "55",
      ddd: null,
      localNumber: null,
      isValid: false,
      reason: "Telefone com tamanho inválido após normalização",
    };
  }

  const ddd = withCountry.slice(2, 4);
  const localNumber = withCountry.slice(4);

  // Validação básica do DDD (10–99, primeiro dígito 1-9, segundo 1-9 — DDDs do Brasil não usam 0 no segundo).
  const dddNum = parseInt(ddd, 10);
  if (Number.isNaN(dddNum) || dddNum < 11 || dddNum > 99) {
    return {
      normalized: withCountry,
      countryCode: "55",
      ddd: null,
      localNumber,
      isValid: false,
      reason: "DDD fora da faixa válida",
    };
  }

  return {
    normalized: withCountry,
    countryCode: "55",
    ddd,
    localNumber,
    isValid: true,
  };
}

/** Formata um telefone normalizado para exibição: +55 (11) 99999-9999. */
export function formatPhoneDisplay(normalized: string): string {
  const d = stripPhone(normalized);
  if (d.length === 13 && d.startsWith("55")) {
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  }
  if (d.length === 12 && d.startsWith("55")) {
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  }
  return normalized;
}
