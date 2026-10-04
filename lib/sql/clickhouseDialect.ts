// Translates the Snowflake SQL used in this app into ClickHouse SQL, so every query keeps a single source
// (written in Snowflake syntax) while DATA_SOURCE=clickhouse is being rolled out.
//
// Covers exactly the constructs the app uses (see docs/ARCHITECTURE.md → Data source):
//   x::DATE → toDate(x)            x::FLOAT → toFloat64(x)        x::VARCHAR → toString(x)
//   DATE_TRUNC('week'|'month'|'year', x) → toMonday / toStartOfMonth / toStartOfYear
//   DATEADD('day'|'week'|'month'|'year', n, x) → addDays / addWeeks / addMonths / addYears(x, n)
//   DATEDIFF('unit', a, b) → dateDiff('unit', a, b)      DAYOFWEEKISO(x) → toDayOfWeek(x)
//   IFF(c, a, b) → if(c, a, b)      CURRENT_DATE() → today()      CURRENT_TIMESTAMP() → now()
//   PERCENTILE_CONT(p) WITHIN GROUP (ORDER BY x) → quantileExactInclusive(p)(x)  (exact + linear, same as Snowflake)
//   REGEXP_REPLACE(s, re, r) → replaceRegexpOne(s, re, r)
//   DB.SCHEMA.TABLE → <clickhouse database>.TABLE         ? binds → {p0:String}, {p1:String}, …
// Anything Snowflake-specific that is not listed here makes assertNoSnowflakeLeft() throw,
// so an untranslated query fails loudly instead of returning wrong numbers.

/** Snowflake "DATABASE.SCHEMA" → ClickHouse database. Table names stay identical. */
export function clickhouseDatabaseMap(): Record<string, string> {
  return {
    "MIGRATION.CONTROL_TOWER": process.env.CLICKHOUSE_DB_CONTROL_TOWER || "CONTROL_TOWER",
    "DATAMART.MANUFACTURE":    process.env.CLICKHOUSE_DB_DATAMART      || "MANUFACTURE",
  };
}

// ── small parser helpers ──────────────────────────────────────────────────────
/** Index of the parenthesis that closes the one at `open` (string literals respected). */
function matchParen(sql: string, open: number): number {
  let depth = 0, inStr = false;
  for (let i = open; i < sql.length; i++) {
    const ch = sql[i];
    if (inStr) { if (ch === "'" && sql[i + 1] === "'") i++; else if (ch === "'") inStr = false; continue; }
    if (ch === "'") inStr = true;
    else if (ch === "(") depth++;
    else if (ch === ")" && --depth === 0) return i;
  }
  throw new Error(`Unbalanced parenthesis in SQL near: ${sql.slice(open, open + 60)}`);
}

/** Split a function's argument list on top-level commas. */
function splitArgs(inner: string): string[] {
  const out: string[] = []; let depth = 0, inStr = false, cur = "";
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (inStr) { cur += ch; if (ch === "'" && inner[i + 1] === "'") { cur += inner[++i]; } else if (ch === "'") inStr = false; continue; }
    if (ch === "'") inStr = true;
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Rewrite every NAME( … ) call, innermost first, with `fn(args)`. */
function rewriteCalls(sql: string, name: string, fn: (args: string[]) => string): string {
  const re = new RegExp(`\\b${name}\\s*\\(`, "i");
  for (let guard = 0; guard < 500; guard++) {
    const m = re.exec(sql);
    if (!m) return sql;
    const open = m.index + m[0].length - 1, close = matchParen(sql, open);
    const inner = rewriteCalls(sql.slice(open + 1, close), name, fn); // nested calls first
    sql = sql.slice(0, m.index) + fn(splitArgs(inner)) + sql.slice(close + 1);
  }
  throw new Error(`Too many ${name} calls to rewrite`);
}

/** Rewrite `operand::TYPE` casts; operand = identifier, ?, placeholder or a balanced (…) / fn(…) expression. */
function rewriteCasts(sql: string): string {
  const CASTS: Record<string, string> = { DATE: "toDate", FLOAT: "toFloat64", VARCHAR: "toString" };
  const re = /::(DATE|FLOAT|VARCHAR)\b/i;
  for (let guard = 0; guard < 500; guard++) {
    const m = re.exec(sql);
    if (!m) return sql;
    let start = m.index - 1;
    if (sql[start] === ")") {
      let depth = 0;
      for (; start >= 0; start--) { if (sql[start] === ")") depth++; else if (sql[start] === "(" && --depth === 0) break; }
      while (start > 0 && /[\w.]/.test(sql[start - 1])) start--; // function name before "("
    } else {
      while (start > 0 && /[\w.?]/.test(sql[start - 1])) start--;
    }
    const operand = sql.slice(start, m.index);
    sql = sql.slice(0, start) + `${CASTS[m[1].toUpperCase()]}(${operand})` + sql.slice(m.index + m[0].length);
  }
  throw new Error("Too many casts to rewrite");
}

const unit = (s: string) => s.replace(/'/g, "").toLowerCase();

// ── translator ────────────────────────────────────────────────────────────────
export function snowflakeToClickHouse(sql: string): string {
  let out = sql;

  // Fully-qualified table names → ClickHouse database.table
  for (const [from, db] of Object.entries(clickhouseDatabaseMap())) {
    out = out.replace(new RegExp(`\\b${from.replace(".", "\\.")}\\.`, "gi"), `${db}.`);
  }

  out = out.replace(/\bCURRENT_DATE\s*\(\s*\)/gi, "today()").replace(/\bCURRENT_TIMESTAMP\s*\(\s*\)/gi, "now()");
  out = rewriteCasts(out);

  out = rewriteCalls(out, "PERCENTILE_CONT", (a) => `__QUANTILE__(${a[0]})`);
  out = out.replace(/__QUANTILE__\(([^)]*)\)\s*WITHIN\s+GROUP\s*\(\s*ORDER\s+BY\s+([^)]+)\)/gi, "quantileExactInclusive($1)($2)");

  out = rewriteCalls(out, "DATE_TRUNC", ([u, x]) => {
    const f = { week: "toMonday", month: "toStartOfMonth", year: "toStartOfYear", day: "toDate" }[unit(u)];
    if (!f) throw new Error(`DATE_TRUNC unit not supported: ${u}`);
    return `${f}(${x})`;
  });
  out = rewriteCalls(out, "DATEADD", ([u, n, x]) => {
    const f = { day: "addDays", week: "addWeeks", month: "addMonths", year: "addYears", minute: "addMinutes", hour: "addHours" }[unit(u)];
    if (!f) throw new Error(`DATEADD unit not supported: ${u}`);
    return `${f}(${x}, ${n})`;
  });
  // Same argument order in ClickHouse — only the name/unit casing changes (regex: the new name would re-match).
  out = out.replace(/\bDATEDIFF\s*\(\s*'(\w+)'/gi, (_m, u: string) => `dateDiff('${u.toLowerCase()}'`);
  out = rewriteCalls(out, "DAYOFWEEKISO", ([x]) => `toDayOfWeek(${x})`);
  out = rewriteCalls(out, "IFF", (a) => `if(${a.join(", ")})`);
  out = rewriteCalls(out, "REGEXP_REPLACE", (a) => `replaceRegexpOne(${a.join(", ")})`);

  return out;
}

/** Replace positional ? binds with typed ClickHouse parameters; returns the SQL and the param map. */
export function bindParams(sql: string, binds: unknown[]): { sql: string; params: Record<string, unknown> } {
  let i = 0, inStr = false, out = "";
  const params: Record<string, unknown> = {};
  for (let c = 0; c < sql.length; c++) {
    const ch = sql[c];
    if (ch === "'") inStr = !inStr;
    if (ch === "?" && !inStr) {
      if (i >= binds.length) throw new Error("More ? placeholders than binds");
      const v = binds[i];
      const type = typeof v === "number" ? (Number.isInteger(v) ? "Int64" : "Float64") : "String";
      params[`p${i}`] = v;
      out += `{p${i}:${type}}`;
      i++;
    } else out += ch;
  }
  if (i !== binds.length) throw new Error(`Bind count mismatch: ${i} placeholders, ${binds.length} binds`);
  return { sql: out, params };
}

/** Throws if a Snowflake-only construct survived translation. */
export function assertNoSnowflakeLeft(sql: string): void {
  const left = sql.match(/::[A-Z]+|\b(DATEADD|DATE_TRUNC|IFF|DAYOFWEEKISO|PERCENTILE_CONT|CURRENT_DATE|CURRENT_TIMESTAMP|REGEXP_REPLACE|QUALIFY|ILIKE|GENERATOR|SEQ4|ANY_VALUE|TO_CHAR)\b/i);
  if (left) throw new Error(`Untranslated Snowflake SQL for ClickHouse: "${left[0]}" — extend lib/sql/clickhouseDialect.ts`);
}
