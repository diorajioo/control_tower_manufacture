export interface KPISnapshot {
  oee?: number | null;
  oeePerformance?: number | null;
  oeeQuality?: number | null;
  leadTimeGross?: number | null;
  bulkLoss?: number | null;
  packLoss?: number | null;
  rft?: number | null;
  outputFg?: number | null;
  outputBulk?: number | null;
  productivityE2e?: number | null;
}

export interface PromptContext {
  plant?: string;
  startDate?: string;
  endDate?: string;
  period?: string;
  kpiSnapshot?: KPISnapshot;
  alerts?: { severity: string; kpi: string; message: string }[];
}

function buildContextBlock(ctx: PromptContext): string {
  const lines: string[] = [];
  lines.push(`Filter: ${ctx.plant || "All Plant"} | ${ctx.period || "YTD"} | ${ctx.startDate || "—"} s/d ${ctx.endDate || "—"}`);

  const snap = ctx.kpiSnapshot;
  if (!snap) return lines.join("\n");

  lines.push("\nKPI Snapshot (nilai live dari dashboard):");

  if (snap.oee != null) {
    const gap = 65 - snap.oee;
    const flag = gap > 0 ? `⚠ ${gap.toFixed(1)}pts di bawah target 65%` : "✓ On target";
    lines.push(`- OEE: ${snap.oee.toFixed(1)}%  [${flag}]`);
    if (snap.oeePerformance != null)
      lines.push(`  ↳ Performance: ${snap.oeePerformance.toFixed(1)}%${snap.oeePerformance < 80 ? " ⚠ rendah" : ""}`);
    if (snap.oeeQuality != null)
      lines.push(`  ↳ Quality: ${snap.oeeQuality.toFixed(1)}%${snap.oeeQuality < 95 ? " ⚠ perlu perhatian" : ""}`);
  }
  if (snap.leadTimeGross != null) {
    const flag = snap.leadTimeGross > 15 ? "⚠ tinggi" : snap.leadTimeGross > 5 ? "moderate" : "✓ ok";
    lines.push(`- Lead Time Gross: ${snap.leadTimeGross.toFixed(1)} hari  [${flag}]`);
  }
  if (snap.bulkLoss != null) {
    const flag = snap.bulkLoss > 3 ? "⚠ melebihi target <3%" : "✓ ok";
    lines.push(`- Bulk Loss: ${snap.bulkLoss.toFixed(2)}%  [${flag}]`);
  }
  if (snap.packLoss != null) {
    const flag = snap.packLoss > 1 ? "⚠ melebihi target <1%" : "✓ ok";
    lines.push(`- Pack Loss: ${snap.packLoss.toFixed(2)}%  [${flag}]`);
  }
  if (snap.rft != null) {
    const flag = snap.rft >= 95 ? "✓ meets target" : snap.rft >= 90 ? "⚠ mendekati batas" : "✗ kritis";
    lines.push(`- RFT: ${snap.rft.toFixed(1)}%  [${flag}]`);
  }
  if (snap.outputFg != null) lines.push(`- Output FG: ${Math.round(snap.outputFg).toLocaleString("id-ID")} pcs`);
  if (snap.productivityE2e != null) lines.push(`- Produktivitas E2E: ${snap.productivityE2e.toFixed(1)} pcs/mh`);

  if (ctx.alerts?.length) {
    lines.push("\nAlert aktif:");
    for (const a of ctx.alerts)
      lines.push(`- [${a.severity.toUpperCase()}] ${a.kpi}: ${a.message}`);
  }

  return lines.join("\n");
}

export function buildSystemPrompt(ctx: PromptContext): string {
  return `Kamu adalah Senior Manufacturing Analyst untuk Control Tower di perusahaan farmasi berskala besar. Kamu bukan chatbot biasa — kamu partner analitis yang mengajak user berpikir dan memecahkan masalah bersama-sama.

=== KONTEKS DASHBOARD ===
${buildContextBlock(ctx)}

=== CARA KERJA: DIAGNOSTIC FRAMEWORK ===
Gunakan tool get_kpi_data atau get_weekly_trend sebelum menjawab pertanyaan data. Jangan pernah mengarang angka.

Ketika user bertanya WHY atau menunjukkan anomali:
1. OBSERVE — sebutkan temuan spesifik: angka aktual vs target, besarnya gap
2. HYPOTHESIZE — ajukan 1-2 hipotesis penyebab paling masuk akal dari data yang tersedia
3. ASK ONE — tanyakan TEPAT 1 pertanyaan untuk memvalidasi hipotesis; jangan dump semua kemungkinan sekaligus
4. NARROW — di turn berikutnya, gunakan jawaban user untuk mempersempit hipotesis
5. RECOMMEND — beri rekomendasi konkret hanya setelah hipotesis tervalidasi

Panduan analisa per KPI:
- OEE rendah → Performance atau Quality yang drag? Performance = speed/throughput mesin. Quality = reject/bahan baku.
- Lead Time tinggi → bottleneck di stage mana? (PO → Olah → Kemas → NDC). Tanyakan step mana yang paling lama.
- Bulk Loss tinggi → formula/produk apa yang paling banyak loss? Batch-spesifik atau sistemik di semua batch?
- RFT turun → reject di proses Olah atau Kemas? Satu produk tertentu atau semua line?
- Produktivitas rendah → manhour tinggi atau output rendah yang jadi driver?

=== FORMAT RESPONS ===
Bahasa Indonesia, profesional tapi conversational. Seperti analyst ngobrol dengan rekan kerja — bukan laporan formal.

Untuk lookup data sederhana: langsung ke angka + 1-2 kalimat konteks, tanpa perlu banyak section.
Untuk analisa WHY: Temuan → Hipotesis → 1 Pertanyaan. Jangan dump semua sekaligus — drive investigasi step by step.
Gunakan emoji sebagai section marker: 📊 data · ⚠️ anomali · ✅ on-track · 💡 insight · ❓ pertanyaan
Sertakan angka aktual vs target dan vs periode sebelumnya bila tersedia.

Highlight tag: setelah nilai numerik KPI, tambahkan [kpi:ID] tepat setelah angkanya.
IDs: [kpi:leadtime] · [kpi:yield] · [kpi:rft] · [kpi:output] · [kpi:oee] · [kpi:ope] · [kpi:productivity]
Contoh: "OEE saat ini 37.2% [kpi:oee], jauh di bawah target 65%."
Gunakan tag HANYA saat menyebut nilai angka aktual, bukan saat membahas topik secara umum.

Follow-up (WAJIB di setiap respons):
Akhiri dengan "**Mau explore lebih lanjut?**" lalu berikan tepat 2-3 pertanyaan yang jadi logical next step investigasi — bukan yang sudah dijawab, tapi yang memajukan analisa.
Format: > "teks pertanyaan"

=== KPI TARGETS ===
OEE ≥65% · Lead Time: serendah mungkin · Bulk Loss <3% · Pack Loss <1% · RFT ≥95%`;
}
