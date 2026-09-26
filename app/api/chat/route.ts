import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getClientForModel, isAIModelUnavailable, buildChatModelPriority } from "@/lib/ai-provider";
import { isValidModelId } from "@/lib/ai-models";
import { routeModel } from "@/lib/agent-router";
import { buildSystemPrompt, type KPISnapshot } from "@/lib/diagnostic-prompt";
import { executeQuery } from "@/lib/snowflake";
import type OpenAI from "openai";

// Allow up to 60 s on Vercel — tool calls to Snowflake + a streamed answer can exceed the default limit.
export const maxDuration = 60;

type ChatMessage = {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_call_id?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tool_calls?: any[];
};

// Tool definitions use the OpenAI schema (structurally identical to Groq)
const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_kpi_data",
      description: "Fetch manufacturing KPI values from Snowflake for a given period and plant.",
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
            description: "KPI type to fetch",
          },
          start_date: { type: "string", description: "Format YYYY-MM-DD (default: start of this year)" },
          end_date:   { type: "string", description: "Format YYYY-MM-DD (default: today)" },
          plant:      { type: "string", description: "Specific plant name, or 'All Plant' for all plants" },
        },
        required: ["kpi_type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_weekly_trend",
      description: "Fetch weekly trend data for a KPI to analyze patterns and anomalies.",
      parameters: {
        type: "object",
        properties: {
          kpi_type: {
            type: "string",
            enum: ["leadtime", "upstream", "downstream", "e2e", "oee", "rft", "output", "batch"],
            description: "KPI type for the trend",
          },
          start_date: { type: "string", description: "Format YYYY-MM-DD" },
          end_date:   { type: "string", description: "Format YYYY-MM-DD" },
          plant:      { type: "string", description: "Plant name or 'All Plant'" },
        },
        required: ["kpi_type"],
      },
    },
  },
];


function validateDate(d?: string): string | undefined {
  if (!d) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return undefined;
  const ts = Date.parse(d);
  if (isNaN(ts)) return undefined;
  const date = new Date(ts);
  if (date > new Date() || date.getFullYear() < 2020) return undefined;
  return d;
}

function sanitizePlant(p?: string): string {
  if (!p || p === "All Plant") return "";
  return p.replace(/[^A-Za-z0-9 \-]/g, "").trim().slice(0, 64);
}

async function executeGetKpiData(args: {
  kpi_type: string;
  start_date?: string;
  end_date?: string;
  plant?: string;
}): Promise<string> {
  const startDate = validateDate(args.start_date) ?? `${new Date().getFullYear()}-01-01`;
  const endDate   = validateDate(args.end_date)   ?? new Date().toISOString().split("T")[0];
  const plant     = sanitizePlant(args.plant);
  const dateBinds = [startDate, endDate] as unknown[];
  const withPlant = plant ? [...dateBinds, plant] : dateBinds;
  const pf = plant ? "AND PLANT = ?" : "";

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
            WHERE PO_FG_DONE_DATE::DATE BETWEEN ? AND ? ${pf}
            GROUP BY PROCESS_ORDER_FG
            HAVING MIN(CASE WHEN ACTIVITY='PO' THEN ACTIVITY_START END) IS NOT NULL
              AND MAX(CASE WHEN ACTIVITY='RECEIVE NDC' THEN ACTIVITY_STOP END) IS NOT NULL
          ) sub
        `, withPlant);
        break;
      }
      case "bulk_loss": {
        rows = await executeQuery(`
          SELECT SUM(BULK_LOSS_QUANTITY) AS BULK_LOSS_KG,
            SUM(THEORETICAL_QUANTITY) AS THEORETICAL_KG,
            SUM(BULK_LOSS_QUANTITY)/NULLIF(SUM(THEORETICAL_QUANTITY),0)*100 AS BULK_LOSS_PCT
          FROM DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_OLAH
          WHERE CORRECTION_DATE BETWEEN ? AND ?
        `, dateBinds);
        break;
      }
      case "pack_loss": {
        rows = await executeQuery(`
          SELECT SUM(QTY_FG_GOOD) AS TOTAL_GOOD, SUM(QTY_FG_RETUR) AS TOTAL_RETUR,
            SUM(QTY_TOTAL) AS TOTAL_QTY,
            SUM(QTY_FG_RETUR)/NULLIF(SUM(QTY_TOTAL),0)*100 AS PACK_LOSS_PCT
          FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
          WHERE KEMAS_COMPLETED_AT::DATE BETWEEN ? AND ? ${pf}
        `, withPlant);
        break;
      }
      case "rft": {
        rows = await executeQuery(`
          SELECT COUNT(CASE WHEN ACTIVITY<>'ADJUST' THEN 1 END)*100.0/NULLIF(COUNT(*),0) AS RFT_PCT,
            COUNT(*) AS TOTAL_ROWS
          FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
          WHERE PO_FG_DONE_DATE::DATE BETWEEN ? AND ? ${pf}
        `, withPlant);
        break;
      }
      case "output_bulk": {
        rows = await executeQuery(`
          SELECT SUM(REALIZATION_QUANTITY) AS TOTAL_BULK_KG
          FROM DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_OLAH
          WHERE CORRECTION_DATE BETWEEN ? AND ?
        `, dateBinds);
        break;
      }
      case "output_fg": {
        rows = await executeQuery(`
          SELECT SUM(QUANTITY) AS TOTAL_FG_PCS
          FROM DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_FG
          WHERE CORRECTION_DATE BETWEEN ? AND ?
        `, dateBinds);
        break;
      }
      case "oee": {
        rows = await executeQuery(`
          SELECT PLANT,
            AVG((CASE WHEN QTY_TOTAL>0 THEN QTY_FG_GOOD::FLOAT/QTY_TOTAL ELSE 0 END)*
              (CASE WHEN ACTIVITY_PRODUCTIVITY_STD>0 THEN LEAST(PRODUCTIVITY::FLOAT/ACTIVITY_PRODUCTIVITY_STD,1.0) ELSE 0 END))*100 AS OEE_PCT
          FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
          WHERE KEMAS_COMPLETED_AT::DATE BETWEEN ? AND ? ${pf}
          GROUP BY PLANT ORDER BY OEE_PCT DESC
        `, withPlant);
        break;
      }
      case "productivity_e2e": {
        rows = await executeQuery(`
          SELECT AVG(E2E_PRODUCTIVITY) AS AVG_E2E_PROD FROM MIGRATION.CONTROL_TOWER.CT_MANUF_E2E
          WHERE KEMAS_COMPLETED_AT::DATE BETWEEN ? AND ? ${pf}
        `, withPlant);
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
            WHERE OLAH_COMPLETED_AT::DATE BETWEEN ? AND ? ${pf}
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
        `, withPlant);
        break;
      }
      case "productivity_downstream": {
        rows = await executeQuery(`
          SELECT AVG(PO_PROD) AS AVG_DOWNSTREAM_PROD
          FROM (
            SELECT PROCESS_ORDER_FG,
              SUM(QTY_FG_GOOD)/NULLIF(SUM(LEADTIME_IN_MINUTE)/60.0,0)/NULLIF(MAX(OPERATOR_COUNT),0) AS PO_PROD
            FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
            WHERE KEMAS_COMPLETED_AT::DATE BETWEEN ? AND ?
              AND LEADTIME_IN_MINUTE>0 AND OPERATOR_COUNT>0 ${pf}
            GROUP BY PROCESS_ORDER_FG
          ) sub
        `, withPlant);
        break;
      }
      default:
        return JSON.stringify({ error: "Unrecognized kpi_type" });
    }

    return JSON.stringify({ kpi: args.kpi_type, period: `${startDate} to ${endDate}`, plant: plant || "All Plant", data: rows });
  } catch (err) {
    console.error("[chat] get_kpi_data query failed:", err);
    return JSON.stringify({ error: "Query failed. Please try again." });
  }
}

async function executeGetWeeklyTrend(args: {
  kpi_type: string;
  start_date?: string;
  end_date?: string;
  plant?: string;
}): Promise<string> {
  const startDate = validateDate(args.start_date) ?? `${new Date().getFullYear()}-01-01`;
  const endDate   = validateDate(args.end_date)   ?? new Date().toISOString().split("T")[0];
  const plant     = sanitizePlant(args.plant);
  const pf        = plant ? "AND PLANT = ?" : "";
  const binds: unknown[] = [startDate, endDate, ...(plant ? [plant] : [])];

  const queryMap: Record<string, string> = {
    leadtime: `
      SELECT WEEK, PLANT, AVG(po_days) AS KPI_VALUE FROM (
        SELECT PROCESS_ORDER_FG, DATE_TRUNC('week', PO_FG_DONE_DATE::DATE) AS WEEK, PLANT,
          DATEDIFF('minute', MIN(CASE WHEN ACTIVITY='PO' THEN ACTIVITY_START END),
            MAX(CASE WHEN ACTIVITY='RECEIVE NDC' THEN ACTIVITY_STOP END))/1440.0 AS po_days
        FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
        WHERE PO_FG_DONE_DATE::DATE BETWEEN ? AND ? ${pf}
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
        WHERE OLAH_COMPLETED_AT::DATE BETWEEN ? AND ? ${pf}
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
        WHERE KEMAS_COMPLETED_AT::DATE BETWEEN ? AND ? ${pf}
        GROUP BY PROCESS_ORDER_FG, WEEK, PLANT
      ) sub GROUP BY WEEK, PLANT ORDER BY WEEK`,
    output: `
      SELECT WEEK, PLANT, SUM(po_fg) AS KPI_VALUE FROM (
        SELECT PROCESS_ORDER_FG, DATE_TRUNC('week', PO_FG_DONE_DATE::DATE) AS WEEK, PLANT, SUM(RELEASE_FG) AS po_fg
        FROM MIGRATION.CONTROL_TOWER.CT_MANUF_TRENDS
        WHERE PO_FG_DONE_DATE::DATE BETWEEN ? AND ? ${pf}
        GROUP BY PROCESS_ORDER_FG, WEEK, PLANT
      ) sub GROUP BY WEEK, PLANT ORDER BY WEEK`,
    batch: `
      SELECT WEEK, PLANT, SUM(nomo_batch) AS KPI_VALUE FROM (
        SELECT NOMO, DATE_TRUNC('week', OLAH_COMPLETED_AT::DATE) AS WEEK, PLANT, MAX(BESAR_BATCH) AS nomo_batch
        FROM MIGRATION.CONTROL_TOWER.CT_MANUF_OLAH
        WHERE OLAH_COMPLETED_AT::DATE BETWEEN ? AND ? ${pf}
        GROUP BY NOMO, WEEK, PLANT
      ) sub GROUP BY WEEK, PLANT ORDER BY WEEK`,
    downstream: `
      SELECT WEEK, PLANT, AVG(po_prod) AS KPI_VALUE FROM (
        SELECT PROCESS_ORDER_FG, PLANT, DATE_TRUNC('week', KEMAS_COMPLETED_AT::DATE) AS WEEK,
          SUM(QTY_FG_GOOD)/NULLIF(SUM(LEADTIME_IN_MINUTE)/60.0,0)/NULLIF(MAX(OPERATOR_COUNT),0) AS po_prod
        FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
        WHERE KEMAS_COMPLETED_AT::DATE BETWEEN ? AND ?
          AND LEADTIME_IN_MINUTE>0 AND OPERATOR_COUNT>0 ${pf}
        GROUP BY PROCESS_ORDER_FG, PLANT, WEEK
      ) sub GROUP BY WEEK, PLANT ORDER BY WEEK`,
    oee: `
      SELECT DATE_TRUNC('week', KEMAS_COMPLETED_AT::DATE) AS WEEK, PLANT,
        AVG(
          (CASE WHEN QTY_TOTAL>0 THEN QTY_FG_GOOD::FLOAT/QTY_TOTAL ELSE 0 END) *
          (CASE WHEN ACTIVITY_PRODUCTIVITY_STD>0 THEN LEAST(PRODUCTIVITY::FLOAT/ACTIVITY_PRODUCTIVITY_STD,1.0) ELSE 0 END)
        )*100 AS KPI_VALUE
      FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
      WHERE KEMAS_COMPLETED_AT::DATE BETWEEN ? AND ? ${pf}
      GROUP BY WEEK, PLANT ORDER BY WEEK`,
    rft: `
      SELECT DATE_TRUNC('week', PO_FG_DONE_DATE::DATE) AS WEEK, PLANT,
        COUNT(CASE WHEN ACTIVITY<>'ADJUST' THEN 1 END)*100.0/NULLIF(COUNT(*),0) AS KPI_VALUE
      FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
      WHERE PO_FG_DONE_DATE::DATE BETWEEN ? AND ? ${pf}
      GROUP BY WEEK, PLANT ORDER BY WEEK`,
  };

  const sql = queryMap[args.kpi_type];
  if (!sql) return JSON.stringify({ error: "Unrecognized trend kpi_type" });

  try {
    const rows = await executeQuery(sql, binds);
    return JSON.stringify({ kpi: args.kpi_type, period: `${startDate} to ${endDate}`, plant: plant || "All Plant", trend: rows });
  } catch (err) {
    console.error("[chat] get_weekly_trend query failed:", err);
    return JSON.stringify({ error: "Trend query failed. Please try again." });
  }
}

async function dispatchTool(name: string, args: Record<string, unknown>): Promise<string> {
  if (name === "get_kpi_data")    return executeGetKpiData(args as Parameters<typeof executeGetKpiData>[0]);
  if (name === "get_weekly_trend") return executeGetWeeklyTrend(args as Parameters<typeof executeGetWeeklyTrend>[0]);
  return JSON.stringify({ error: `Unknown tool '${name}'` });
}

// Generic completion call that works with both Groq and OpenAI/DeepSeek clients
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callCompletion(modelId: string, params: Record<string, any>): Promise<any> {
  const client = getClientForModel(modelId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).chat.completions.create({ model: modelId, ...params });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hasDeepSeek = !!process.env.DEEPSEEK_API_KEY;
  const hasGroq     = !!process.env.GROQ_API_KEY;
  if (!hasDeepSeek && !hasGroq) {
    return NextResponse.json({ error: "No AI API key configured" }, { status: 503 });
  }

  const body = await req.json();
  const { messages, context, model: requestedModel, kpiSnapshot, alerts } = body as {
    messages: { role: "user" | "assistant"; content: string }[];
    context?: { plant?: string; startDate?: string; endDate?: string; period?: string };
    model?: string;
    kpiSnapshot?: KPISnapshot;
    alerts?: { severity: string; kpi: string; message: string }[];
  };

  // Agent routing: classify the latest user message and pick optimal model.
  // For complex questions the agent overrides the user's manual selection.
  const latestUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const agentRoute = routeModel(latestUserMessage);
  const resolvedModel = agentRoute.complexity === "complex"
    ? agentRoute.modelId
    : (requestedModel && isValidModelId(requestedModel) ? requestedModel : agentRoute.modelId);

  const systemPrompt = buildSystemPrompt({
    plant:       context?.plant,
    startDate:   context?.startDate,
    endDate:     context?.endDate,
    period:      context?.period,
    kpiSnapshot,
    alerts,
  });

  const allMessages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...messages.slice(-10),
  ];

  const MAX_TOOL_ROUNDS = 3;
  const chatModelPriority = buildChatModelPriority(resolvedModel);
  let selectedModel = chatModelPriority[0];
  let modelResolved = false;

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let response: any = null;

      if (!modelResolved) {
        let lastErr: unknown;
        for (const modelId of chatModelPriority) {
          try {
            response = await callCompletion(modelId, {
              messages: allMessages,
              tools: TOOLS,
              tool_choice: "auto",
              max_tokens: 2000,
              temperature: 0.3,
            });
            selectedModel = modelId;
            modelResolved = true;
            break;
          } catch (err) {
            if (isAIModelUnavailable(err)) { lastErr = err; continue; }
            throw err;
          }
        }
        if (!response) {
          const msg = lastErr instanceof Error ? lastErr.message : "No AI model available";
          return NextResponse.json({ error: msg }, { status: 503 });
        }
      } else {
        response = await callCompletion(selectedModel, {
          messages: allMessages,
          tools: TOOLS,
          tool_choice: "auto",
          max_tokens: 2000,
          temperature: 0.3,
        });
      }

      const choice = response.choices[0];
      const msg = choice.message;

      if (choice.finish_reason !== "tool_calls" || !msg.tool_calls?.length) {
        break;
      }

      allMessages.push({
        role: "assistant",
        content: msg.content ?? "",
        tool_calls: msg.tool_calls,
      });

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
    const finalStream = await callCompletion(selectedModel, {
      messages: allMessages,
      max_tokens: 3000,
      temperature: 0.3,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of finalStream) {
            const text = (chunk as { choices?: [{ delta?: { content?: string } }] })
              .choices?.[0]?.delta?.content ?? "";
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
    console.error("[chat] POST handler error:", err);
    return NextResponse.json({ error: "AI chat failed. Please try again." }, { status: 500 });
  }
}
