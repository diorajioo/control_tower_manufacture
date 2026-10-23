"use client";

// Tactical → Output, row below the trend chart: FG released per brand / variant / SKU group (treemap)
// next to the top 10 SKU by output. The treemap has no height of its own: it fills the row, whose
// height comes from the SKU table, so both cards end on the same line.
// Tile shade = share of released FG (darker = larger). No target data yet, so no health colors.
// Long tails (355 variants) are cut to the top MAX_TILES; a caption states what the tiles cover.
// Cross-filter (outputPick.ts): a tile click picks that group for every Output chart; the treemap keeps all
// its tiles and dims the others, the SKU table follows any pick.

import { useEffect, useMemo, useState } from "react";
import { ResponsiveTreeMapHtml, type NodeProps } from "@nivo/treemap";
import { Fade } from "@/components/ui/Fade";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { ToggleSelect } from "@/components/ui/ToggleSelect";
import { LineTooltip } from "@/components/charts/StandardLine";
import { useT, type TranslationKey } from "@/lib/i18n";
import { outputParams, pickOpacity, type OutputBaseFilters, type OutputPick } from "@/components/dashboard/outputPick";

type GroupDim = "brand" | "variant" | "su_group";

interface GroupRow { name: string; qtyPo: number; qtyReal: number }
interface SkuRow { code: string; name: string; qtyPo: number; qtyReal: number; pctContrib: number }
interface Tile { id: string; value: number; qtyPo: number; share: number; color: string; text: string; opacity: number }

const MAX_TILES = 15;          // 16th+ group left out; the caption says how much the tiles cover
const NAVY = [30, 64, 118];    // #1E4076
const TINT = [238, 244, 251];  // #EEF4FB

const DIM_TITLE: Record<GroupDim, TranslationKey> = {
  brand: "output_mix_title_brand",
  variant: "output_mix_title_variant",
  su_group: "output_mix_title_su_group",
};

function shade(t: number): { color: string; text: string } {
  const k = 0.18 + 0.82 * Math.max(0, Math.min(1, t));
  const c = TINT.map((v, i) => Math.round(v + (NAVY[i] - v) * k));
  return { color: `rgb(${c[0]},${c[1]},${c[2]})`, text: k > 0.5 ? "#FFFFFF" : "#16305C" };
}

export function fmtPcs(v: number): string {
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)} M pcs`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)} K pcs`;
  return `${Math.round(v).toLocaleString()} pcs`;
}

function TileNode({ node }: NodeProps<Tile>) {
  const { x, y, width: w, height: h } = node;
  const d = node.data;
  const showName = w >= 44 && h >= 20;
  const showDetail = w >= 76 && h >= 50;
  return (
    <div
      onMouseEnter={node.onMouseEnter}
      onMouseMove={node.onMouseMove}
      onMouseLeave={node.onMouseLeave}
      onClick={node.onClick}
      style={{
        position: "absolute", left: x, top: y, width: w, height: h,
        background: d.color, color: d.text, boxShadow: "inset 0 0 0 1px #FFFFFF",
        padding: "5px 7px", overflow: "hidden", lineHeight: 1.3, cursor: "pointer",
        opacity: d.opacity, transition: "opacity 0.15s ease",
      }}
    >
      {showName && <p style={{ fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.id}</p>}
      {showDetail && (
        <>
          <p style={{ fontSize: 10.5, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{fmtPcs(d.value)}</p>
          <p style={{ fontSize: 10.5, whiteSpace: "nowrap", opacity: 0.85, fontVariantNumeric: "tabular-nums" }}>{d.share.toFixed(1)}%</p>
        </>
      )}
    </div>
  );
}

// No overflow-hidden on the treemap card: the tile tooltip must never be clipped (CLAUDE.md → Tooltips)
const CARD = "rounded-lg border border-[#EBEBEB] bg-white flex flex-col";
const TABLE_CARD = `${CARD} overflow-hidden`;
const TITLE: React.CSSProperties = { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b", flex: 1 };
const EMPTY: React.CSSProperties = { flex: 1, minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#98a2b3", fontSize: 11 };

export function OutputMixRow({ filters, metric, pick, onPick }: {
  filters: OutputBaseFilters; metric: "fg" | "bulk"; pick: OutputPick | null; onPick: (p: OutputPick) => void;
}) {
  const { t } = useT();
  const [dim, setDim] = useState<GroupDim>("brand");
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [skus, setSkus] = useState<SkuRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (metric === "bulk") { setGroups([]); setSkus([]); setLoading(false); return; }
    setLoading(true);
    setError(false);
    // Treemap ignores a pick on its own dimension (it highlights instead); the SKU table follows every pick
    const gp = outputParams(filters, pick, dim);
    gp.set("dim", dim); gp.set("part", "groups");
    const sp = outputParams(filters, pick, []);
    sp.set("dim", dim); sp.set("part", "skus");
    const get = (p: URLSearchParams) => fetch(`/api/dashboard/output-mix?${p}`).then((r) => (r.ok ? r.json() : Promise.reject()));
    Promise.all([get(gp), get(sp)])
      .then(([g, k]) => { setGroups(g.groups ?? []); setSkus(k.skus ?? []); })
      .catch(() => { setError(true); setGroups([]); setSkus([]); })
      .finally(() => setLoading(false));
  }, [filters.plant, filters.startDate, filters.endDate, filters.period, metric, dim, pick]);

  const { tiles, coverage } = useMemo(() => {
    const valid = groups.filter((g) => g.qtyReal > 0);
    const total = valid.reduce((s, g) => s + g.qtyReal, 0);
    if (total <= 0) return { tiles: [] as Tile[], coverage: null };
    const top = valid.slice(0, MAX_TILES);
    const max = top[0].qtyReal;
    const tiles: Tile[] = top.map((g) => ({
      id: g.name, value: g.qtyReal, qtyPo: g.qtyPo, share: (g.qtyReal * 100) / total, ...shade(g.qtyReal / max),
      opacity: pickOpacity(pick, dim, g.name),
    }));
    const shown = tiles.reduce((s, x) => s + x.share, 0);
    return { tiles, coverage: valid.length > top.length ? { shown: top.length, total: valid.length, share: shown } : null };
  }, [groups, pick, dim]);

  const dimOptions: { key: GroupDim; label: string }[] = [
    { key: "brand", label: t("output_mix_dim_brand") },
    { key: "variant", label: t("output_mix_dim_variant") },
    { key: "su_group", label: t("output_mix_dim_su_group") },
  ];

  const emptyText = metric === "bulk" ? t("output_line_bulk_coming_soon") : error ? t("output_mix_error") : t("output_trend_no_data");

  return (
    <div className="grid grid-cols-2 gap-4 items-stretch" style={{ fontFamily: "Lato, sans-serif" }}>
      {/* Treemap — fills the row height set by the SKU table */}
      <div className={CARD}>
        <div style={{ padding: "11px 13px 8px", display: "flex", alignItems: "center", gap: 6 }}>
          <p style={TITLE}>{t(DIM_TITLE[dim])}</p>
          <InfoTooltip text={t("output_mix_tooltip")} size={13} width={240} />
          <ToggleSelect<GroupDim> ariaLabel={t("output_mix_group_by")} options={dimOptions} value={dim} onChange={setDim} align="right" />
        </div>
        {loading ? (
          <div style={{ flex: 1, minHeight: 200, margin: "0 13px 13px", background: "#f9fafb" }} className="animate-pulse rounded" />
        ) : tiles.length === 0 ? (
          <div style={EMPTY}>{emptyText}</div>
        ) : (
          <Fade depKey={`${dim}|${filters.plant}|${filters.startDate}|${filters.endDate}|${filters.period}|${pick && pick.dim !== dim ? `${pick.dim}:${pick.value}` : ""}`}>
            <div style={{ position: "relative", flex: 1, minHeight: 200, margin: "0 13px 13px" }}>
              <div style={{ position: "absolute", inset: 0 }}>
                <ResponsiveTreeMapHtml<Tile>
                  data={{ id: "root", children: tiles } as unknown as Tile}
                  identity="id"
                  value="value"
                  leavesOnly
                  tile="squarify"
                  innerPadding={0}
                  outerPadding={0}
                  enableParentLabel={false}
                  animate={false}
                  nodeComponent={TileNode}
                  onClick={(node) => onPick({ dim, value: node.data.id, label: `${dimOptions.find((o) => o.key === dim)?.label}: ${node.data.id}` })}
                  tooltip={({ node }) => (
                    <LineTooltip
                      title={node.data.id}
                      rows={[
                        { label: t("output_mix_tt_released"), value: fmtPcs(node.data.value), strong: true },
                        { label: t("output_mix_tt_share"), value: `${node.data.share.toFixed(1)}%` },
                        { label: t("output_mix_tt_pos"), value: node.data.qtyPo.toLocaleString() },
                      ]}
                    />
                  )}
                />
              </div>
            </div>
            {coverage && (
              <p style={{ margin: "-6px 13px 10px", fontSize: 10, color: "#98a2b3" }}>
                {t("output_mix_coverage")
                  .replace("{n}", String(coverage.shown))
                  .replace("{total}", String(coverage.total))
                  .replace("{pct}", Math.min(coverage.share, 99.9).toFixed(1))}
              </p>
            )}
          </Fade>
        )}
      </div>

      <TopSkuTable skus={skus} loading={loading} emptyText={emptyText} />
    </div>
  );
}

// ── Top SKU by output ─────────────────────────────────────────────────────────

function TopSkuTable({ skus, loading, emptyText }: { skus: SkuRow[]; loading: boolean; emptyText: string }) {
  const { t } = useT();
  const [sortCol, setSortCol] = useState<keyof SkuRow>("qtyReal");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => [...skus].sort((a, b) => {
    const av = a[sortCol], bv = b[sortCol];
    return sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
  }), [skus, sortCol, sortDir]);

  const toggleSort = (col: keyof SkuRow) => {
    if (col === sortCol) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("desc"); }
  };

  const TH = ({ col, label, right }: { col?: keyof SkuRow; label: string; right?: boolean }) => (
    <th
      onClick={col ? () => toggleSort(col) : undefined}
      style={{
        padding: "7px 10px", fontSize: 10.5, fontWeight: 700, color: "white",
        textAlign: right ? "right" : "left", cursor: col ? "pointer" : "default",
        background: "#1E4076", whiteSpace: "nowrap", userSelect: "none",
      }}
    >
      {label}
      {col && <> <span style={{ opacity: sortCol === col ? 1 : 0.4 }}>{sortCol === col ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span></>}
    </th>
  );

  const num: React.CSSProperties = { padding: "6px 10px", textAlign: "right", color: "#344054", fontVariantNumeric: "tabular-nums" };
  const dash: React.CSSProperties = { padding: "6px 10px", textAlign: "right", color: "#98a2b3" };

  return (
    <div className={TABLE_CARD}>
      <div style={{ padding: "11px 13px 8px", display: "flex", alignItems: "center", gap: 6, minHeight: 45 }}>
        <p style={TITLE}>{t("output_sku_title")}</p>
        <InfoTooltip text={t("output_sku_tooltip")} size={13} width={240} />
      </div>
      {loading ? (
        <div style={{ height: 260, background: "#f9fafb" }} className="animate-pulse" />
      ) : skus.length === 0 ? (
        <div style={EMPTY}>{emptyText}</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr>
                <TH col="name"       label={t("output_sku_th_sku")} />
                <TH col="qtyPo"      label={t("output_line_th_qty_po")} right />
                <TH col="qtyReal"    label={t("output_line_th_qty_real")} right />
                <TH                  label={t("output_line_th_theoretical")} right />
                <TH                  label={t("output_line_th_gap")} right />
                <TH col="pctContrib" label={t("output_line_th_pct_contrib")} right />
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, i) => (
                <tr key={s.code} style={{ background: i % 2 === 0 ? "white" : "#fafafa", borderBottom: "1px solid #f0f1f3" }}>
                  <td title={s.code} style={{ padding: "6px 10px", fontWeight: 700, color: "#1E4076", maxWidth: 260, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {s.name}
                  </td>
                  <td style={num}>{s.qtyPo.toLocaleString()}</td>
                  <td style={num}>{s.qtyReal.toLocaleString()}</td>
                  <td style={dash}>—</td>
                  <td style={dash}>—</td>
                  <td style={{ ...num, fontWeight: 700 }}>{s.pctContrib.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
