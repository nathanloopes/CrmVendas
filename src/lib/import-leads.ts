import * as XLSX from "xlsx";
import { normalizePhone, stripPhone } from "./phone-utils";

export interface ParsedLeadRow {
  name: string | null;
  phone_raw: string;
  phone_normalized: string;
  ddd: string | null;
  city: string | null;
  state: string | null;
  region: string | null;
  source: string | null;
  status: string | null;
  notes: string | null;
  is_valid: boolean;
  invalid_reason: string | null;
}

export interface ImportStats {
  total: number;
  valid: number;
  invalid: number;
  noDDD: number;
  duplicatesInFile: number;
  skippedEmpty: number;
}

export interface ParseResult {
  rows: ParsedLeadRow[];
  stats: ImportStats;
  detectedColumns: {
    phone: { index: number; header: string | null; method: "header" | "content" | "single-column" } | null;
    name: { index: number; header: string | null } | null;
    city: { index: number; header: string | null } | null;
    state: { index: number; header: string | null } | null;
    source: { index: number; header: string | null } | null;
    status: { index: number; header: string | null } | null;
    notes: { index: number; header: string | null } | null;
  };
  preview: Array<{ name: string | null; phone_raw: string; phone_normalized: string; is_valid: boolean }>;
  hasHeader: boolean;
  warning?: string;
}

const HEADER_ALIASES: Record<string, string[]> = {
  name: [
    "nome", "name", "lead", "contato", "contact", "cliente", "client",
    "nome do contato", "nome contato", "full name", "fullname",
    "primeiro nome", "first name",
  ],
  phone_raw: [
    "telefone", "telefones", "phone", "phones", "celular", "celulares",
    "whatsapp", "whats", "wpp", "wp", "fone", "fones",
    "numero", "número", "numeros", "números", "number", "numbers",
    "tel", "mobile", "cel", "contato whatsapp",
    "phone_number", "phonenumber", "telephone", "recipient", "recipients",
    "destinatario", "destinatário", "destino",
  ],
  city: ["cidade", "city", "municipio", "município", "localidade"],
  state: ["estado", "state", "uf", "província", "provincia"],
  source: ["origem", "source", "canal", "campanha", "campaign", "lista"],
  status: ["status", "situação", "situacao", "etapa"],
  notes: [
    "observacoes", "observações", "notes", "obs", "comentarios", "comentários",
    "anotacoes", "anotações", "descricao", "descrição",
  ],
};

function normalizeKey(s: string): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Detecta se uma string é "parecida com header" (texto curto, sem muitos dígitos). */
function looksLikeHeader(cell: unknown): boolean {
  if (cell === null || cell === undefined) return false;
  const s = String(cell).trim();
  if (!s) return false;
  const digits = s.replace(/\D/g, "");
  // Se mais da metade da célula é dígito, parece dado, não header.
  if (digits.length > 0 && digits.length / s.length > 0.5) return false;
  if (s.length > 60) return false;
  return true;
}

/** Verifica se a primeira linha é cabeçalho ou já é dado. */
function detectHasHeader(firstRow: any[]): boolean {
  if (!firstRow || firstRow.length === 0) return false;
  const nonNull = firstRow.filter((c) => c !== null && c !== undefined && String(c).trim() !== "");
  if (nonNull.length === 0) return false;
  // Se >70% das células parecem header, considera header.
  const headerLike = nonNull.filter(looksLikeHeader).length;
  return headerLike / nonNull.length >= 0.7;
}

function buildHeaderMap(headerRow: string[]): Record<string, { index: number; header: string }> {
  const map: Record<string, { index: number; header: string }> = {};
  headerRow.forEach((h, idx) => {
    const key = normalizeKey(h);
    if (!key) return;
    for (const [target, aliases] of Object.entries(HEADER_ALIASES)) {
      if (map[target]) continue;
      // match exato OU contém algum alias como palavra
      if (aliases.includes(key) || aliases.some((a) => key.includes(a))) {
        map[target] = { index: idx, header: String(h) };
      }
    }
  });
  return map;
}

/**
 * Quando o cabeçalho não dá pista, escaneia até 30 linhas de cada coluna
 * e elege como "telefone" a coluna onde >60% das células viram telefone válido (≥10 dígitos).
 */
function detectPhoneColumnByContent(dataRows: any[][], colCount: number): number | null {
  const sampleSize = Math.min(30, dataRows.length);
  let bestCol = -1;
  let bestScore = 0;

  for (let col = 0; col < colCount; col++) {
    let validCount = 0;
    let nonEmpty = 0;
    for (let i = 0; i < sampleSize; i++) {
      const cell = dataRows[i]?.[col];
      if (cell === null || cell === undefined || String(cell).trim() === "") continue;
      nonEmpty++;
      const digits = stripPhone(cell);
      if (digits.length >= 10 && digits.length <= 13) validCount++;
    }
    if (nonEmpty === 0) continue;
    const score = validCount / nonEmpty;
    if (score > bestScore && score >= 0.6) {
      bestScore = score;
      bestCol = col;
    }
  }
  return bestCol >= 0 ? bestCol : null;
}

function pickCell(row: any[], idx: number | undefined | null): string | null {
  if (idx === undefined || idx === null || idx < 0) return null;
  const v = row[idx];
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

export async function parseLeadsFile(file: File): Promise<ParseResult> {
  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: "array" });
  const firstSheetName = wb.SheetNames[0];

  const emptyResult: ParseResult = {
    rows: [],
    stats: { total: 0, valid: 0, invalid: 0, noDDD: 0, duplicatesInFile: 0, skippedEmpty: 0 },
    detectedColumns: { phone: null, name: null, city: null, state: null, source: null, status: null, notes: null },
    preview: [],
    hasHeader: false,
  };

  if (!firstSheetName) return emptyResult;

  const sheet = wb.Sheets[firstSheetName];
  const json = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null, raw: false, blankrows: false });
  if (json.length === 0) return emptyResult;

  // Maior número de colunas de qualquer linha (planilhas costumam ter linhas com tamanho diferente)
  const colCount = json.reduce((m, r) => Math.max(m, Array.isArray(r) ? r.length : 0), 0);

  const hasHeader = detectHasHeader(json[0] as any[]);
  const headerRow = hasHeader ? (json[0] as any[]).map((c) => String(c ?? "")) : [];
  const dataRows = (hasHeader ? json.slice(1) : json) as any[][];

  // 1) Tenta mapear via cabeçalho
  const map = hasHeader ? buildHeaderMap(headerRow) : {};

  let phoneCol: number | null = map.phone_raw?.index ?? null;
  let phoneMethod: "header" | "content" | "single-column" = "header";
  let phoneHeader: string | null = map.phone_raw?.header ?? null;

  // 2) Se for planilha de coluna única, é telefone
  if (phoneCol === null && colCount === 1) {
    phoneCol = 0;
    phoneMethod = "single-column";
    phoneHeader = hasHeader ? headerRow[0] ?? null : null;
  }

  // 3) Detecção por conteúdo
  if (phoneCol === null) {
    const detected = detectPhoneColumnByContent(dataRows, colCount);
    if (detected !== null) {
      phoneCol = detected;
      phoneMethod = "content";
      phoneHeader = hasHeader ? headerRow[detected] ?? null : null;
    }
  }

  // Se mesmo assim não achamos coluna de telefone, retorna vazio com warning.
  if (phoneCol === null) {
    return {
      ...emptyResult,
      hasHeader,
      stats: { total: dataRows.length, valid: 0, invalid: 0, noDDD: 0, duplicatesInFile: 0, skippedEmpty: 0 },
      warning:
        "Não foi possível identificar a coluna de telefone. Renomeie a coluna para 'telefone', 'numero' ou 'whatsapp' e tente novamente.",
    };
  }

  console.log(
    `[ImportLeads] Coluna de telefone detectada via ${phoneMethod}: índice ${phoneCol}` +
      (phoneHeader ? ` (cabeçalho: "${phoneHeader}")` : " (sem cabeçalho)")
  );

  const detectedColumns = {
    phone: { index: phoneCol, header: phoneHeader, method: phoneMethod },
    name: map.name ?? null,
    city: map.city ?? null,
    state: map.state ?? null,
    source: map.source ?? null,
    status: map.status ?? null,
    notes: map.notes ?? null,
  };

  const seen = new Set<string>();
  const rows: ParsedLeadRow[] = [];
  let invalid = 0;
  let noDDD = 0;
  let duplicatesInFile = 0;
  let skippedEmpty = 0;

  for (const r of dataRows) {
    if (!Array.isArray(r) || r.every((c) => c === null || c === undefined || String(c).trim() === "")) {
      skippedEmpty++;
      continue;
    }

    const phoneRaw = pickCell(r, phoneCol) || "";
    const digitsOnly = stripPhone(phoneRaw);

    // Descarta linhas sem nenhum dígito de telefone (não polui o banco com lixo)
    if (!digitsOnly) {
      skippedEmpty++;
      continue;
    }

    const norm = normalizePhone(phoneRaw);
    const name = pickCell(r, map.name?.index);
    const city = pickCell(r, map.city?.index);
    const state = pickCell(r, map.state?.index);
    const source = pickCell(r, map.source?.index);
    const status = pickCell(r, map.status?.index);
    const notes = pickCell(r, map.notes?.index);

    const row: ParsedLeadRow = {
      name,
      phone_raw: phoneRaw,
      phone_normalized: norm.normalized || digitsOnly,
      ddd: norm.ddd,
      city,
      state: state ? state.toUpperCase().slice(0, 2) : null,
      region: null,
      source,
      status: status || "Novo",
      notes,
      is_valid: norm.isValid,
      invalid_reason: norm.reason || null,
    };

    if (!norm.isValid) {
      invalid++;
      if (!norm.ddd) noDDD++;
    } else if (!norm.ddd) {
      noDDD++;
    }

    // Deduplicação dentro do mesmo arquivo (chave estável: phone_normalized)
    const dedupKey = row.phone_normalized;
    if (seen.has(dedupKey)) {
      duplicatesInFile++;
      continue;
    }
    seen.add(dedupKey);
    rows.push(row);
  }

  const preview = rows.slice(0, 5).map((r) => ({
    name: r.name,
    phone_raw: r.phone_raw,
    phone_normalized: r.phone_normalized,
    is_valid: r.is_valid,
  }));

  return {
    rows,
    stats: {
      total: dataRows.length,
      valid: rows.filter((r) => r.is_valid).length,
      invalid,
      noDDD,
      duplicatesInFile,
      skippedEmpty,
    },
    detectedColumns,
    preview,
    hasHeader,
  };
}
