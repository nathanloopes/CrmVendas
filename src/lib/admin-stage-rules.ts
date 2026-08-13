// Regras de atribuição automática de responsável administrativo por estágio.
// Centraliza o id da Alexandra Lodonha e o estágio "Envio de COF".

export const ALEXANDRA_USER_ID = "4c40139c-182e-4daf-8a7b-8e6277cfdc3a";

/** Compara estágio de forma case/acento-insensível com "envio de cof" */
export function isEnvioDeCofStage(stage?: string | null): boolean {
  if (!stage) return false;
  const normalized = stage
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  return normalized === "envio de cof";
}

/**
 * Retorna o id do responsável administrativo a ser definido para o novo estágio,
 * ou `undefined` se não houver regra aplicável (não mexe no campo).
 */
export function getAdministrativeResponsibleForStage(
  newStage: string,
  currentAdminId?: string | null
): string | undefined {
  if (isEnvioDeCofStage(newStage) && !currentAdminId) {
    return ALEXANDRA_USER_ID;
  }
  return undefined;
}
