import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGroqClient, GROQ_CHAT_MODEL_PRIORITY, isGroqModelUnavailable } from "@/lib/ai-provider";
import { executeQuery } from "@/lib/snowflake";
import type Groq from "groq-sdk";

type ChatMessage = {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_call_id?: string;
};

const TOOLS: Groq.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_kpi_data",
      description: "Ambil nilai KPI manufacturing dari Snowflake untuk periode dan plant tertentu.",
      parameters: {
        type: "object",
        properties: {
          kpi_type: {
            type: "string",
            enum: [
              "lead_time", "bulk_loss", "pack_loss", "rft",
              "output_bulk", "output_fg", "oee",
              "productivity_e2e", "productivity_upstream", "productivity_downstream",
            ],
            description: "Jenis KPI yang ingin diambil",
          },
          start_date: { type: "string", description: "Format YYYY-MM-DD (default: awal tahun ini)" },
          end_date: { type: "string", description: "Format YYYY-MM-DD (default: hari ini)" },
          plant: { type: "string", description: "Nama plant spesifik, atau 'All Plant' untuk semua" },
        },
        required: ["kpi_type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_weekly_trend",
      description: "Ambil data tren mingguan sebuah KPI untuk analisa pola dan anomali.",
      parameters: {
        type: "object",
        properties: {
          kpi_type: {
            type: "string",
            enum: ["leadtime", "upstream", "downstream", "e2e", "output", "batch"],
            description: "Jenis KPI untuk tren",
          },
          start_date: { type: "string", description: "Format YYYY-MM-DD" },
          end_date: { type: "string", description: "Format YYYY-MM-DD" },
          plant: { type: "string", description: "Nama plant atau 'All Plant'" },
        },
        required: ["kpi_type"],
      },
    },
  },
];

function buildSystemPrompt(context?: { plant?: string; startDate?: string; endDate?: string }) {
  const filterCtx = context?.startDate
    ? `Konteks filter aktif — Plant: ${context.plant || "Semua Plant"}, Periode: ${context.startDate} s/d ${context.endDate}.`
    : "Gunakan YTD sebagai default periode jika user tidak menyebutkan.";

  return `Kamu adalah AI Analyst untuk Control Tower Manufacturing di perusahaan farmasi berskala besar.
Kamu memiliki akses langsung ke database Snowflake melalui tools yang tersedia.

${filterCtx}

Panduan:
- Gunakan tool get_kpi_data atau get_weekly_trend sebelum menjawab pertanyaan berbasis data
- Jangan mengarang angka — selalu ambil dari database
- Jawab dalam Bahasa Indonesia, profesional dan ringkas
- Maksimal 5 kalimat untuk analisa, lebih singkat untuk lookup data sederhana
- Sertakan angka aktual dan konteks (target, perbandingan, tren)
- Jika ada anomali atau temuan penting, sebutkan implikasinya

KPI Targets:
- Lead Time: semakin rendah semakin baik
- Bulk Loss: target < 3%
- Pack Loss: target < 1%
- Right First Time (RFT): target ≥ 95%
- OEE: target ≥ 65%

Highlight tagging: Saat menyebut nilai aktual sebuah KPI, tambahkan tag [kpi:ID] tepat setelah angkanya:
[kpi:leadtime] = Lead Time · [kpi:yield] = Bulk/Pack Loss · [kpi:rft] = RFT · [kpi:output] = Output FG/Bulk · [kpi:oee] = OEE · [kpi:ope] = OPE · [kpi:productivity] = Produktivitas
Contoh: "Lead Time saat ini 5.2 hari [kpi:leadtime], OEE 67.3% [kpi:oee]."
Gunakan tag HANYA saat menyebut nilai angka aktual KPI tersebut, bukan saat membahas topik secara umum.`;
}

function validateDate(d?: string): string | undefined {
  if (!d) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined;
}

function sanitizePlant(p?: string): string {
  if (!p || p === "All Plant") return "";
  return p.replace(/['"\\;]/g, "");
}

async function executeGetKpiData(args: {
  kpi_type: string;
  start_date?: string;
  end_date?: string;
  plant?: string;
}): Promise<string> {
  const startDate = validateDate(args.start_date) ?? `${new Date().getFullYear()}-01-01`;
  const endDate = validateDate(args.end_date) ?? new Date().toISOString().split("T")[0];
  const plant = sanitizePlant(args.plant);
  const plantFilter = plant ? `AND PLANT = '${plant}'` : "";

  try {
    let rows: unknown[];

    switch (args.kpi_type) {
      case "lead_time": {
        rows = await executeQuery(`
          SELECT AVG(gross_minutes)/1440.0 AS AVG_GROSS_DAYS, AVG(nett_minutes)/1440.0 AS AVG_NETT_DAYS, COUNT(*) AS TOTAL_PO
          FROM (
            SELECT PROCESS_ORDER_FG,
              DATEDIFF('minute', MIN(CASE WHEN ACTIVITY='PO' THEN ACTIVITY_START END),
                MAX(CASE WHEN ACTIVITY='RECEIVE NDC' THEN ACTIVITY_STOP END)) AS gross_minutes,
              SUM(CASE WHEN ACTIVITY_TYPE='ACTUAL' AND LINE_CATEGORY IS NOT NULL THEN NET_LEADTIME ELSE 0 END) AS nett_minutes
            FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
            WHERE PO_FG_DONE_DATE::DATE BETWEEN '${startDate}' AND '${endDate}' ${plantFilter}
            GROUP BY PROCESS_ORDER_FG
            HAVING MIN(CASE WHEN ACTIVITY='PO' THEN ACTIVITY_START END) IS NOT NULL
              AND MAX(CASE WHEN ACTIVITY='RECEIVE NDC' THEN ACTIVITY_STOP END) IS NOT NULL
          ) sub
        `);
        break;
      }
      case "bulk_loss": {
        rows = await executeQuery(`
          SELECT SUM(BULK_LOSS_QUANTITY) AS BULK_LOSS_KG,
            SUM(THEORETICAL_QUANTITY) AS THEORETICAL_KG,
            SUM(BULK_LOSS_QUANTITY)/NULLIF(SUM(THEORETICAL_QUANTITY),0)*100 AS BULK_LOSS_PCT
          FROM DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_OLAH
          WHERE CORRECTION_DATE BETWEEN '${startDate}' AND '${endDate}'
        `);
        break;
      }
      case "pack_loss": {
        rows = await executeQuery(`
          SELECT SUM(QTY_FG_GOOD) AS TOTAL_GOOD, SUM(QTY_FG_RETUR) AS TOTAL_RETUR,
            SUM(QTY_TOTAL) AS TOTAL_QTY,
            SUM(QTY_FG_RETUR)/NULLIF(SUM(QTY_TOTAL),0)*100 AS PACK_LOSS_PCT
          FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
          WHERE KEMAS_COMPLETED_AT::DATE BETWEEN '${startDate}' AND '${endDate}' ${plantFilter}
        `);
        break;
      }
      case "rft": {
        rows = await executeQuery(`
          SELECT COUNT(CASE WHEN ACTIVITY<>'ADJUST' THEN 1 END)*100.0/NULLIF(COUNT(*),0) AS RFT_PCT,
            COUNT(*) AS TOTAL_ROWS
          FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
          WHERE PO_FG_DONE_DATE::DATE BETWEEN '${startDate}' AND '${endDate}' ${plantFilter}
        `);
        break;
      }
      case "output_bulk": {
        rows = await executeQuery(`
          SELECT SUM(REALIZATION_QUANTITY) AS TOTAL_BULK_KG
          FROM DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_OLAH
          WHERE CORRECTION_DATE BETWEEN '${startDate}' AND '${endDate}'
        `);
        break;
      }
      case "output_fg": {
        rows = await executeQuery(`
          SELECT SUM(QUANTITY) AS TOTAL_FG_PCS
          FROM DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_FG
          WHERE CORRECTION_DATE BETWEEN '${startDate}' AND '${endDate}'
        `);
        break;
      }
      case "oee": {
        rows = await executeQuery(`
          SELECT PLANT,
            AVG((CASE WHEN QTY_TOTAL>0 THEN QTY_FG_GOOD::FLOAT/QTY_TOTAL ELSE 0 END)*
              (CASE WHEN ACTIVITY_PRODUCTIVITY_STD>0 THEN LEAST(PRODUCTIVITY::FLOAT/ACTIVITY_PRODUCTIVITY_STD,1.0) ELSE 0 END))*100 AS OEE_PCT
          FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
          WHERE KEMAS_COMPLETED_AT::DATE BETWEEN '${startDate}' AND '${endDate}' ${plantFilter}
          GROUP BY PLANT ORDER BY OEE_PCT DESC
        `);
        break;
      }
      case "productivity_e2e": {
        rows = await executeQuery(`
          SELECT AVG(E2E_PRODUCTIVITY) AS AVG_E2E_PROD FROM MIGRATION.CONTROL_TOWER.CT_MANUF_E2E
          WHERE KEMAS_COMPLETED_AT::DATE BETWEEN '${startDate}' AND '${endDate}' ${plantFilter}
        `);
        break;
      }
      case "productivity_upstream": {
        rows = await executeQuery(`
          WITH activity_lvl AS (
            SELECT
              PROCESS_ORDER_SFG, POSITION, ACTIVITY, ACTIVITY_ID,
              MAX(CASE WHEN RELEASE_BULK IS NOT NULL THEN RELEASE_BULK END)       AS release_bulk_sfg,
              MAX(CASE WHEN RELEASE_BULK IS NOT NULL THEN LEADTIME_IN_MINUTE END) AS leadtime_per_act,
              MAX(CASE WHEN RELEASE_BULK IS NOT NULL THEN OPERATOR_COUNT END)     AS operator_per_act
            FROM MIGRATION.CONTROL_TOWER.CT_MANUF_OLAH
            WHERE OLAH_COMPLETED_AT::DATE BETWEEN '${startDate}' AND '${endDate}' ${plantFilter}
            GROUP BY PROCESS_ORDER_SFG, POSITION, ACTIVITY, ACTIVITY_ID
          ),
          position_lvl AS (
            SELECT PROCESS_ORDER_SFG,
              MAX(release_bulk_sfg) AS release_bulk_sfg,
              SUM(leadtime_per_act) AS leadtime_sum,
              SUM(operator_per_act) AS operator_per_position
            FROM activity_lvl GROUP BY PROCESS_ORDER_SFG, POSITION
          ),
          sfg_lvl AS (
            SELECT PROCESS_ORDER_SFG,
              MAX(release_bulk_sfg)      AS max_release_bulk,
              SUM(leadtime_sum)          AS total_leadtime_min,
              SUM(operator_per_position) AS total_operators
            FROM position_lvl GROUP BY PROCESS_ORDER_SFG
          )
          SELECT AVG(
            CASE WHEN total_leadtime_min > 0 AND total_operators > 0
            THEN max_release_bulk / (total_leadtime_min / 60.0) / total_operators END
          ) AS AVG_UPSTREAM_PROD
          FROM sfg_lvl WHERE max_release_bulk > 0
        `);
        break;
      }
      case "productivity_downstream": {
        rows = await executeQuery(`
          SELECT AVG(PO_PROD) AS AVG_DOWNSTREAM_PROD
          FROM (
            SELECT PROCESS_ORDER_FG,
              SUM(QTY_FG_GOOD)/NULLIF(SUM(LEADTIME_IN_MINUTE)/60.0,0)/NULLIF(MAX(OPERATOR_COUNT),0) AS PO_PROD
            FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
            WHERE KEMAS_COMPLETED_AT::DATE BETWEEN '${startDate}' AND '${endDate}'
              AND LEADTIME_IN_MINUTE>0 AND OPERATOR_COUNT>0 ${plantFilter}
            GROUP BY PROCESS_ORDER_FG
          ) sub
        `);
        break;
      }
      default:
        return JSON.stringify({ error: "kpi_type tidak dikenali" });
    }

    return JSON.stringify({ kpi: args.kpi_type, period: `${startDate} to ${endDate}`, plant: plant || "All Plant", data: rows });
  } catch (err) {
    return JSON.stringify({ error: "Query gagal", detail: String(err) });
  }
}

async function executeGetWeeklyTrend(args: {
  kpi_type: string;
  start_date?: string;
  end_date?: string;
  plant?: string;
}): Promise<string> {
  const startDate = validateDate(args.start_date) ?? `${new Date().getFullYear()}-01-01`;
  const endDate = validateDate(args.end_date) ?? new Date().toISOString().split("T")[0];
  const plant = sanitizePlant(args.plant);
  const plantFilter = plant ? `AND PLANT = '${plant}'` : "";

  const queryMap: Record<string, string> = {
    leadtime: `
      SELECT WEEK, PLANT, AVG(po_days) AS KPI_VALUE FROM (
        SELECT PROCESS_ORDER_FG, DATE_TRUNC('week', PO_FG_DONE_DATE::DATE) AS WEEK, PLANT,
          DATEDIFF('minute', MIN(CASE WHEN ACTIVITY='PO' THEN ACTIVITY_START END),
            MAX(CASE WHEN ACTIVITY='RECEIVE NDC' THEN ACTIVITY_STOP END))/1440.0 AS po_days
        FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
        WHERE PO_FG_DONE_DATE::DATE BETWEEN '${startDate}' AND '${endDate}' ${plantFilter}
        GROUP BY PROCESS_ORDER_FG, WEEK, PLANT
        HAVING MIN(CASE WHEN ACTIVITY='PO' THEN ACTIVITY_START END) IS NOT NULL
          AND MAX(CASE WHEN ACTIVITY='RECEIVE NDC' THEN ACTIVITY_STOP END) IS NOT NULL
      ) sub GROUP BY WEEK, PLANT ORDER BY WEEK`,
    upstream: `
      WITH activity_lvl AS (
        SELECT PROCESS_ORDER_SFG, PLANT, DATE_TRUNC('week', OLAH_COMPLETED_AT::DATE) AS WEEK,
          POSITION, ACTIVITY, ACTIVITY_ID,
          MAX(CASE WHEN RELEASE_BULK IS NOT NULL THEN RELEASE_BULK END)       AS release_bulk_sfg,
          MAX(CASE WHEN RELEASE_BULK IS NOT NULL THEN LEADTIME_IN_MINUTE END) AS leadtime_per_act,
          MAX(CASE WHEN RELEASE_BULK IS NOT NULL THEN OPERATOR_COUNT END)     AS operator_per_act
        FROM MIGRATION.CONTROL_TOWER.CT_MANUF_OLAH
        WHERE OLAH_COMPLETED_AT::DATE BETWEEN '${startDate}' AND '${endDate}' ${plantFilter}
        GROUP BY PROCESS_ORDER_SFG, PLANT, WEEK, POSITION, ACTIVITY, ACTIVITY_ID
      ),
      position_lvl AS (
        SELECT PROCESS_ORDER_SFG, PLANT, WEEK,
          MAX(release_bulk_sfg) AS release_bulk_sfg,
          SUM(leadtime_per_act) AS leadtime_sum,
          SUM(operator_per_act) AS operator_per_position
        FROM activity_lvl GROUP BY PROCESS_ORDER_SFG, PLANT, WEEK, POSITION
      ),
      sfg_lvl AS (
        SELECT PROCESS_ORDER_SFG, PLANT, WEEK,
          MAX(release_bulk_sfg)      AS max_release_bulk,
          SUM(leadtime_sum)          AS total_leadtime_min,
          SUM(operator_per_position) AS total_operators
        FROM position_lvl GROUP BY PROCESS_ORDER_SFG, PLANT, WEEK
      )
      SELECT WEEK, PLANT, AVG(
        CASE WHEN total_leadtime_min > 0 AND total_operators > 0
        THEN max_release_bulk / (total_leadtime_min / 60.0) / total_operators END
      ) AS KPI_VALUE
      FROM sfg_lvl WHERE max_release_bulk > 0
      GROUP BY WEEK, PLANT ORDER BY WEEK`,
    e2e: `
      SELECT WEEK, PLANT, AVG(po_prod) AS KPI_VALUE FROM (
        SELECT PROCESS_ORDER_FG, DATE_TRUNC('week', KEMAS_COMPLETED_AT::DATE) AS WEEK, PLANT, AVG(E2E_PRODUCTIVITY) AS po_prod
        FROM MIGRATION.CONTROL_TOWER.CT_MANUF_E2E
        WHERE KEMAS_COMPLETED_AT::DATE BETWEEN '${startDate}' AND '${endDate}' ${plantFilter}
        GROUP BY PROCESS_ORDER_FG, WEEK, PLANT
      ) sub GROUP BY WEEK, PLANT ORDER BY WEEK`,
    output: `
      SELECT WEEK, PLANT, SUM(po_fg) AS KPI_VALUE FROM (
        SELECT PROCESS_ORDER_FG, DATE_TRUNC('week', PO_FG_DONE_DATE::DATE) AS WEEK, PLANT, SUM(RELEASE_FG) AS po_fg
        FROM MIGRATION.CONTROL_TOWER.CT_MANUF_TRENDS
        WHERE PO_FG_DONE_DATE::DATE BETWEEN '${startDate}' AND '${endDate}' ${plantFilter}
        GROUP BY PROCESS_ORDER_FG, WEEK, PLANT
      ) sub GROUP BY WEEK, PLANT ORDER BY WEEK`,
    batch: `
      SELECT WEEK, PLANT, SUM(nomo_batch) AS KPI_VALUE FROM (
        SELECT NOMO, DATE_TRUNC('week', OLAH_COMPLETED_AT::DATE) AS WEEK, PLANT, MAX(BESAR_BATCH) AS nomo_batch
        FROM MIGRATION.CONTROL_TOWER.CT_MANUF_OLAH
        WHERE OLAH_COMPLETED_AT::DATE BETWEEN '${startDate}' AND '${endDate}' ${plantFilter}
        GROUP BY NOMO, WEEK, PLANT
      ) sub GROUP BY WEEK, PLANT ORDER BY WEEK`,
  };

  const sql = queryMap[args.kpi_type];
  if (!sql) return JSON.stringify({ error: "kpi_type tren tidak dikenali" });

  try {
    const rows = await executeQuery(sql);
    return JSON.stringify({ kpi: args.kpi_type, period: `${startDate} to ${endDate}`, plant: plant || "All Plant", trend: rows });
  } catch (err) {
    return JSON.stringify({ error: "Query tren gagal", detail: String(err) });
  }
}

async function dispatchTool(name: string, args: Record<string, unknown>): Promise<string> {
  if (name === "get_kpi_data") return executeGetKpiData(args as Parameters<typeof executeGetKpiData>[0]);
  if (name === "get_weekly_trend") return executeGetWeeklyTrend(args as Parameters<typeof executeGetWeeklyTrend>[0]);
  return JSON.stringify({ error: `Tool '${name}' tidak dikenal` });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: "GROQ_API_KEY not configured" }, { status: 503 });
  }

  const body = await req.json();
  const { messages, context } = body as {
    messages: { role: "user" | "assistant"; content: string }[];
    context?: { plant?: string; startDate?: string; endDate?: string };
  };

  const groq = getGroqClient();
  const allMessages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(context) },
    ...messages,
  ];

  const MAX_TOOL_ROUNDS = 3;

  // Find first available model
  let selectedModel = GROQ_CHAT_MODEL_PRIORITY[0];
  let modelResolved = false;

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      let response: Groq.Chat.ChatCompletion | null = null;

      if (!modelResolved) {
        let lastErr: unknown;
        for (const model of GROQ_CHAT_MODEL_PRIORITY) {
          try {
            response = await groq.chat.completions.create({
              model,
              messages: allMessages as Groq.Chat.ChatCompletionMessageParam[],
              tools: TOOLS,
              tool_choice: "auto",
              max_tokens: 1500,
              temperature: 0.3,
            });
            selectedModel = model;
            modelResolved = true;
            break;
          } catch (err) {
            if (isGroqModelUnavailable(err)) { lastErr = err; continue; }
            throw err;
          }
        }
        if (!response) {
          const msg = lastErr instanceof Error ? lastErr.message : "No Groq model available";
          return NextResponse.json({ error: msg }, { status: 503 });
        }
      } else {
        response = await groq.chat.completions.create({
          model: selectedModel,
          messages: allMessages as Groq.Chat.ChatCompletionMessageParam[],
          tools: TOOLS,
          tool_choice: "auto",
          max_tokens: 1500,
          temperature: 0.3,
        });
      }

      const choice = response.choices[0];
      const msg = choice.message;

      if (choice.finish_reason !== "tool_calls" || !msg.tool_calls?.length) {
        break; // no more tools — proceed to streaming final answer
      }

      allMessages.push({
        role: "assistant",
        content: msg.content ?? "",
        ...(msg.tool_calls ? { tool_calls: msg.tool_calls } : {}),
      } as ChatMessage);

      for (const toolCall of msg.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments ?? "{}") as Record<string, unknown>;
        const result = await dispatchTool(toolCall.function.name, args);
        allMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      }
    }

    // Stream final answer with the resolved model
    const finalStream = await groq.chat.completions.create({
      model: selectedModel,
      messages: allMessages as Groq.Chat.ChatCompletionMessageParam[],
      max_tokens: 800,
      temperature: 0.3,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of finalStream) {
            const text = chunk.choices[0]?.delta?.content ?? "";
            if (text) controller.enqueue(encoder.encode(text));
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });

  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json({ error: "AI chat gagal", detail: String(err) }, { status: 500 });
  }
}
