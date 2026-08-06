import snowflake from "snowflake-sdk";

// Tables this app is allowed to query. Adding a new table requires an
// explicit entry here — any query referencing an unlisted table throws.
const TABLE_ALLOWLIST = new Set([
  "MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME",
  "MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS",
  "MIGRATION.CONTROL_TOWER.CT_MANUF_OLAH",
  "MIGRATION.CONTROL_TOWER.CT_MANUF_E2E",
  "MIGRATION.CONTROL_TOWER.CT_MANUF_TRENDS",
  "DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_OLAH",
  "DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_FG",
  "MIGRATION.INFORMATION_SCHEMA.COLUMNS",
]);

function assertTablesAllowed(sql: string): void {
  const refs = sql.match(/\b([A-Z_]+\.[A-Z_]+\.[A-Z_]+)\b/gi) ?? [];
  for (const ref of refs) {
    if (!TABLE_ALLOWLIST.has(ref.toUpperCase())) {
      throw new Error(`Query references unauthorized table: ${ref}`);
    }
  }
}

let connection: snowflake.Connection | null = null;
let connectingPromise: Promise<snowflake.Connection> | null = null;

export async function getConnection(): Promise<snowflake.Connection> {
  if (connection?.isUp()) return connection;

  // Prevent multiple simultaneous connect attempts
  if (connectingPromise) return connectingPromise;

  connectingPromise = new Promise<snowflake.Connection>((resolve, reject) => {
    const conn = snowflake.createConnection({
      account: process.env.SNOWFLAKE_ACCOUNT!,
      username: process.env.SNOWFLAKE_USERNAME!,
      password: process.env.SNOWFLAKE_PASSWORD!,
      warehouse: process.env.SNOWFLAKE_WAREHOUSE || "COMPUTE_WH",
      database: process.env.SNOWFLAKE_DATABASE || "MIGRATION",
      schema: process.env.SNOWFLAKE_SCHEMA || "CONTROL_TOWER",
    });

    conn.connect((err) => {
      connectingPromise = null;
      if (err) {
        reject(err);
      } else {
        connection = conn;
        resolve(conn);
      }
    });
  });

  return connectingPromise;
}

export async function executeQuery<T = Record<string, unknown>>(
  sql: string,
  binds: unknown[] = []
): Promise<T[]> {
  assertTablesAllowed(sql);
  const conn = await getConnection();

  return new Promise((resolve, reject) => {
    conn.execute({
      sqlText: sql,
      binds: binds as snowflake.Binds,
      complete: (err, _stmt, rows) => {
        if (err) {
          // Reset connection on error so next call reconnects fresh
          connection = null;
          reject(err);
        } else {
          resolve((rows as T[]) || []);
        }
      },
    });
  });
}
