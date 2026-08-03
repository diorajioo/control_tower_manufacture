"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, RefreshCw, AlertCircle } from "lucide-react";

// Tipe props: data KPI, filter aktif, dan flag ready yang menandakan data sudah siap dikirim ke AI
interface AISummaryProps {
  kpi: unknown;
  filters: {
    plant: string;
    startDate: string;
    endDate: string;
    dataLevel: string;
  };
  ready: boolean;
}

export function AISummary({ kpi, filters, ready }: AISummaryProps) {
  // State lokal untuk teks ringkasan, status loading/error, dan toggle expand
  const [summary,  setSummary]  = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Kirim KPI dan filter ke API lalu baca respons streaming chunk per chunk
  const fetchSummary = async () => {
    if (!kpi || !ready) return;

    // Batalkan request sebelumnya kalau masih berjalan
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setSummary("");
    setError(false);

    try {
      const res = await fetch("/api/dashboard/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kpi, filters }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error("Failed");

      // Baca stream respons dan gabungkan teks per chunk ke state summary
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setSummary((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") setError(true);
    } finally {
      setLoading(false);
    }
  };

  // Jalankan fetchSummary otomatis setiap kali filter atau status ready berubah
  useEffect(() => {
    if (ready) fetchSummary();
    return () => abortRef.current?.abort();
  }, [ready, filters.plant, filters.startDate, filters.endDate]);

  return (
    <div className="bg-gradient-to-r from-brand-800 via-brand-700 to-brand-600 rounded-xl px-3 py-2 mb-2 shadow-sm">
      <div className="flex items-center gap-2">
        {/* Ikon sparkle dan label AI Summary di sebelah kiri */}
        <div className="bg-white/10 rounded-md p-1 shrink-0">
          <Sparkles size={11} className="text-blue-300" />
        </div>
        <span className="text-[10px] font-semibold text-blue-200 uppercase tracking-wider shrink-0">AI Summary</span>

        {/* Area teks ringkasan dengan skeleton loading saat data belum tiba */}
        <div className="flex-1 min-w-0">
          {(loading && !summary) && (
            <div className="flex gap-1.5 items-center">
              <div className="h-2 bg-white/10 rounded-full w-48 animate-pulse" />
              <div className="h-2 bg-white/10 rounded-full w-32 animate-pulse" />
            </div>
          )}
          {(summary || loading) && (
            <p className="text-xs text-blue-50 leading-relaxed">
              {summary}
              {loading && <span className="inline-block w-0.5 h-3 bg-blue-300 ml-0.5 animate-pulse align-middle" />}
            </p>
          )}
          {/* Pesan error kalau fetch ke API summary gagal */}
          {error && (
            <div className="flex items-center gap-1.5 text-[11px] text-red-300">
              <AlertCircle size={11} />
              <span>Gagal memuat. Pastikan ANTHROPIC_API_KEY sudah dikonfigurasi.</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button onClick={fetchSummary} disabled={loading}
            className="flex items-center gap-1 text-[10px] text-blue-300 hover:text-white transition-colors px-1.5 py-0.5 rounded hover:bg-white/10 disabled:opacity-50">
            <RefreshCw size={10} className={loading ? "animate-spin" : ""} />
            {loading ? "..." : "Refresh"}
          </button>
        </div>
      </div>
    </div>
  );
}
