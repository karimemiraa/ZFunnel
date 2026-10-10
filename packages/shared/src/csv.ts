/** RFC 4180 CSV parser: quoted fields, escaped quotes, CRLF/LF, commas or semicolons. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim()));
}

/** Quotes a value for CSV and neutralizes spreadsheet formula injection. */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Lower-case, letters and digits only: "First Name", "first_name" and "firstname" compare equal. */
const normHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Header names recognised by the contacts import, including ClickFunnels exports:
 * classic ("Email", "First Name", "Last Name", "Phone", "Tags", "Created At" / created_at)
 * and 2.0 ("Email Address", "Phone Number", "Contact Tags", "Created"). See docs/IMPORT.md.
 */
const CONTACT_HEADERS = {
  email: ["email", "e-mail", "email address", "contact email", "primary email"],
  name: ["name", "full name", "contact name"],
  firstName: ["first name", "first", "given name"],
  lastName: ["last name", "last", "surname", "family name"],
  phone: ["phone", "phone number", "mobile", "mobile phone", "cell phone", "telephone", "primary phone"],
  tags: ["tags", "tag", "contact tags", "tag list", "labels"],
  createdAt: ["created at", "created", "created date", "date created", "date added", "signup date", "opted in at"],
} as const;

export type ContactColumns = Record<keyof typeof CONTACT_HEADERS, number>;

/** Finds each contact field's column index (-1 when absent) in a CSV header row. */
export function mapContactColumns(header: string[]): ContactColumns {
  const norm = header.map(normHeader);
  const out = {} as ContactColumns;
  for (const [key, names] of Object.entries(CONTACT_HEADERS) as [keyof ContactColumns, readonly string[]][]) {
    out[key] = norm.findIndex((h) => names.some((n) => normHeader(n) === h));
  }
  return out;
}

/** Name from a full-name column, or first + last name columns. */
export function contactName(row: string[], cols: ContactColumns): string | null {
  const full = cols.name >= 0 ? (row[cols.name] ?? "").trim() : "";
  if (full) return full.slice(0, 120);
  const parts = [cols.firstName, cols.lastName].map((i) => (i >= 0 ? (row[i] ?? "").trim() : "")).filter(Boolean);
  return parts.join(" ").slice(0, 120) || null;
}

/** Parses a created-date cell (ISO, "2024-03-01 10:00:00 UTC", "03/01/2024"); null when unusable or in the future. */
export function parseCreatedDate(value: string | undefined): Date | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  const d = new Date(v.replace(/ UTC$/i, "Z").replace(/^(\d{4}-\d{2}-\d{2}) (\d)/, "$1T$2"));
  if (Number.isNaN(d.getTime()) || d.getTime() > Date.now() + 86_400_000 || d.getFullYear() < 1990) return null;
  return d;
}
