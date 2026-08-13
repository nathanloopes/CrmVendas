import * as XLSX from "xlsx";

export interface ExportLeadRow {
  name: string | null;
  phone_normalized: string;
  ddd: string | null;
  city: string | null;
  state: string | null;
  region: string | null;
  source: string | null;
  status: string | null;
  notes: string | null;
  created_at: string;
}

const HEADERS = [
  "Nome",
  "Telefone",
  "DDD",
  "Cidade",
  "Estado",
  "Região",
  "Origem",
  "Status",
  "Observações",
  "Data de importação",
];

function toMatrix(rows: ExportLeadRow[]): (string | null)[][] {
  return rows.map((r) => [
    r.name,
    r.phone_normalized,
    r.ddd,
    r.city,
    r.state,
    r.region,
    r.source,
    r.status,
    r.notes,
    r.created_at ? new Date(r.created_at).toLocaleString("pt-BR") : "",
  ]);
}

export function exportLeadsToXlsx(rows: ExportLeadRow[], filename = "leads.xlsx") {
  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...toMatrix(rows)]);
  ws["!cols"] = [
    { wch: 28 }, { wch: 16 }, { wch: 6 }, { wch: 22 }, { wch: 8 },
    { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 40 }, { wch: 20 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Leads");
  XLSX.writeFile(wb, filename);
}

export function exportLeadsToCsv(rows: ExportLeadRow[], filename = "leads.csv") {
  const escape = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",;\n]/.test(s) ? `"${s}"` : s;
  };
  const lines = [HEADERS.join(";")];
  for (const r of toMatrix(rows)) {
    lines.push(r.map(escape).join(";"));
  }
  const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
