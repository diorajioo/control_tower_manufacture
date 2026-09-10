"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Factory } from "lucide-react";

const REMEMBER_KEY     = "ct_remember_email";
const REMEMBER_PENDING = "ct_remember_pending";

const ROTATING_LINES = [
  "One screen.",
  "In the palm of your hand.",
  "Zero reports.",
  "Always on.",
  "Every plant, at a glance.",
];

const SHOWCASE_KPIS = [
  { label: "OEE",             value: "71.3", unit: "%",   trend: "+2.1%",      trendUp: true,  bar: 71, color: "#6366f1", pos: { top: 0,   left: 0   } },
  { label: "Lead Time",       value: "12.4", unit: "days",trend: "−1.2 days",  trendUp: true,  bar: 62, color: "#4f46e5", pos: { top: 28,  left: 200 } },
  { label: "Right First Time",value: "96.2", unit: "%",   trend: "On target",  trendUp: true,  bar: 96, color: "#10b981", pos: { top: 120, left: 60  } },
  { label: "Bulk Loss",       value: "3.8",  unit: "%",   trend: "Above limit",trendUp: false, bar: 76, color: "#ef4444", pos: { top: 108, left: 240 } },
];

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading,    setLoading]    = useState(false);
  const [remember,   setRemember]   = useState(false);
  const [savedEmail, setSavedEmail] = useState<string | null>(null);
  const [lineIdx,    setLineIdx]    = useState(0);
  const [visible,    setVisible]    = useState(true);

  useEffect(() => {
    if (session?.user?.email) {
      if (localStorage.getItem(REMEMBER_PENDING) === "true") {
        localStorage.setItem(REMEMBER_KEY, session.user.email);
        localStorage.removeItem(REMEMBER_PENDING);
      }
      router.replace("/dashboard");
    }
  }, [session, router]);

  useEffect(() => {
    const stored = localStorage.getItem(REMEMBER_KEY);
    if (stored) { setSavedEmail(stored); setRemember(true); }
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setLineIdx((i) => (i + 1) % ROTATING_LINES.length);
        setVisible(true);
      }, 350);
    }, 2800);
    return () => clearInterval(id);
  }, []);

  const handleSignIn = async () => {
    setLoading(true);
    if (remember) localStorage.setItem(REMEMBER_PENDING, "true");
    else { localStorage.removeItem(REMEMBER_PENDING); localStorage.removeItem(REMEMBER_KEY); setSavedEmail(null); }
    await signIn("azure-ad", { callbackUrl: "/dashboard" });
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(160deg,#1e1b6e 0%,#131055 45%,#0d0b38 100%)" }}>
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex overflow-hidden" style={{ background: "linear-gradient(160deg,#1e1b6e 0%,#131055 45%,#0d0b38 100%)" }}>

      {/* ── LEFT: Showcase ───────────────────────────────────────────────── */}
      <div className="flex-1 relative flex flex-col items-center justify-center px-10 py-16 overflow-hidden min-w-0">
        {/* Aurora blobs */}
        <div className="aurora-root">
          <div className="aurora-blob" style={{ width:620,height:520,background:"radial-gradient(ellipse,#6366f1,transparent)",top:"-12%",left:"-5%" }} />
          <div className="aurora-blob" style={{ width:500,height:420,background:"radial-gradient(ellipse,#8b5cf6,transparent)",bottom:"-5%",right:"5%",animationDelay:"-5s",animationDuration:"10s" }} />
          <div className="aurora-blob" style={{ width:400,height:340,background:"radial-gradient(ellipse,#3b82f6,transparent)",bottom:"25%",left:"35%",animationDelay:"-9s",animationDuration:"17s" }} />
        </div>
        {/* Grid */}
        <div className="absolute inset-0" style={{ backgroundImage:"linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px)",backgroundSize:"44px 44px" }} />

        <div className="relative z-10 w-full max-w-[580px]">
          {/* Live badge */}
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-8 text-[11px] font-semibold" style={{ background:"rgba(99,102,241,0.22)",border:"1px solid rgba(129,140,248,0.4)",color:"#c7d2fe" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live · Snowflake
          </div>

          {/* Headline with rotating second line */}
          <h1 className="mb-4" style={{ fontFamily:"'Space Grotesk',sans-serif",fontSize:44,fontWeight:700,color:"white",letterSpacing:"-0.04em",lineHeight:1.1 }}>
            Every KPI.<br />
            <span style={{ color:"#a5b4fc",display:"inline-block",minHeight:"1.15em",opacity:visible?1:0,transform:visible?"translateY(0)":"translateY(6px)",transition:"opacity 0.35s ease, transform 0.35s ease" }}>
              {ROTATING_LINES[lineIdx]}
            </span>
          </h1>
          <p className="text-[14px] leading-relaxed mb-10" style={{ color:"rgba(199,210,254,0.6)" }}>
            Real-time production visibility across every plant.<br />No reports. No waiting.
          </p>

          {/* Floating KPI cards — wider spread */}
          <div className="relative mb-12" style={{ height:220 }}>
            {SHOWCASE_KPIS.map((kpi, i) => (
              <div key={kpi.label} className="kpi-float absolute rounded-2xl px-4 py-3.5"
                style={{ minWidth:158,...kpi.pos,animationDuration:`${[6,7,5.5,8][i]}s`,animationDelay:`${[0,-2,-4,-1][i]}s` }}>
                <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color:"rgba(199,210,254,0.7)" }}>{kpi.label}</div>
                <div className="font-bold leading-none mb-2" style={{ fontFamily:"'Space Grotesk',sans-serif",fontSize:23,color:kpi.trendUp?"white":"#f87171",letterSpacing:"-0.03em" }}>
                  {kpi.value}<span className="text-xs font-medium ml-1" style={{ color:"rgba(199,210,254,0.55)" }}>{kpi.unit}</span>
                </div>
                <div className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold mb-2.5"
                  style={{ background:kpi.trendUp?"rgba(16,185,129,0.18)":"rgba(239,68,68,0.18)",color:kpi.trendUp?"#34d399":"#f87171" }}>
                  {kpi.trendUp ? "▲" : "▼"} {kpi.trend}
                </div>
                <div className="h-0.5 rounded-full overflow-hidden" style={{ background:"rgba(255,255,255,0.12)" }}>
                  <div className="h-full rounded-full" style={{ width:`${kpi.bar}%`,background:`linear-gradient(90deg,${kpi.color},${kpi.color}88)` }} />
                </div>
              </div>
            ))}
          </div>

          {/* Feature bullets */}
          <div className="flex flex-col gap-3">
            {[
              { icon:"grid", text:"7 live KPIs — OEE, RFT, Lead Time, Loss, Output & more" },
              { icon:"ai",   text:"AI summaries & analyst chat, powered by Snowflake" },
              { icon:"bell", text:"Instant Teams alerts, routed per recipient" },
            ].map((f) => (
              <div key={f.icon} className="flex items-center gap-3 text-[13px] font-medium" style={{ color:"rgba(199,210,254,0.75)" }}>
                <div className="w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0" style={{ background:"rgba(99,102,241,0.2)",border:"1px solid rgba(129,140,248,0.3)" }}>
                  <FeatureIcon type={f.icon} />
                </div>
                {f.text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT: Login form ─────────────────────────────────────────────── */}
      <div className="w-[400px] shrink-0 flex items-center justify-center px-8 py-10" style={{ background:"rgba(255,255,255,0.05)",borderLeft:"1px solid rgba(255,255,255,0.09)" }}>
        <div className="w-full">
          <div className="w-full rounded-[20px] p-8" style={{ background:"rgba(255,255,255,0.11)",border:"1px solid rgba(255,255,255,0.18)",boxShadow:"0 24px 56px rgba(0,0,0,0.35),inset 0 0 0 1px rgba(255,255,255,0.07)" }}>
            {/* Logo */}
            <div className="w-12 h-12 rounded-[14px] mx-auto mb-5 flex items-center justify-center" style={{ background:"linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%)",boxShadow:"0 8px 24px rgba(79,70,229,0.4)" }}>
              <Factory size={22} className="text-white" />
            </div>
            <h2 className="text-xl font-bold text-white text-center mb-1" style={{ fontFamily:"'Space Grotesk',sans-serif",letterSpacing:"-0.03em" }}>Control Tower</h2>
            <p className="text-[11px] text-center mb-6" style={{ color:"rgba(165,180,252,0.45)" }}>Manufacturing Dashboard · PT Paracorp Group</p>
            <div className="h-px mb-5" style={{ background:"rgba(255,255,255,0.09)" }} />

            {savedEmail && (
              <div className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 mb-4" style={{ background:"rgba(99,102,241,0.16)",border:"1px solid rgba(99,102,241,0.32)" }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-[12px]" style={{ background:"linear-gradient(135deg,#4f46e5,#7c3aed)",fontFamily:"'Space Grotesk',sans-serif" }}>
                  {savedEmail.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold truncate" style={{ color:"rgba(255,255,255,0.9)" }}>{savedEmail}</p>
                  <p className="text-[10px]" style={{ color:"rgba(129,140,248,0.55)" }}>Saved account</p>
                </div>
                <button onClick={() => { localStorage.removeItem(REMEMBER_KEY); setSavedEmail(null); setRemember(false); }}
                  className="text-[10px] transition-colors shrink-0 hover:text-white" style={{ color:"rgba(129,140,248,0.45)" }}>
                  Remove
                </button>
              </div>
            )}

            <p className="text-[12px] text-center mb-3.5" style={{ color:"rgba(165,180,252,0.5)" }}>
              {savedEmail ? "Continue with saved account" : "Sign in with your company account"}
            </p>

            <button onClick={handleSignIn} disabled={loading}
              className="w-full relative flex items-center justify-center rounded-xl py-3 font-semibold text-[14px] text-gray-800 bg-white transition-all hover:bg-gray-50 disabled:opacity-60"
              style={{ boxShadow:"0 4px 16px rgba(0,0,0,0.3)" }}>
              <span className="absolute left-4">
                <MicrosoftLogo />
              </span>
              {loading ? "Signing in…" : savedEmail ? `Sign in as ${savedEmail.split("@")[0]}` : "Sign in with Microsoft"}
            </button>

            <label className="flex items-center gap-2 mt-3.5 cursor-pointer select-none">
              <div onClick={() => setRemember(!remember)}
                className="w-4 h-4 rounded flex items-center justify-center shrink-0 transition-all"
                style={{ background:remember?"rgba(99,102,241,0.38)":"rgba(99,102,241,0.14)",border:`1.5px solid ${remember?"rgba(129,140,248,0.65)":"rgba(99,102,241,0.3)"}` }}>
                {remember && (
                  <svg width="9" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="#a5b4fc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span onClick={() => setRemember(!remember)} className="text-[11px]" style={{ color:"rgba(165,180,252,0.55)" }}>
                Remember me on this device
              </span>
            </label>

            <p className="mt-6 text-[10px] text-center leading-relaxed" style={{ color:"rgba(165,180,252,0.4)" }}>
              Authorized personnel only.<br />Use your corporate Microsoft account.
            </p>
          </div>

          <div className="flex justify-center mt-4">
            <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1" style={{ background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px]" style={{ color:"rgba(255,255,255,0.4)" }}>Control Tower v1.1 · System active</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .aurora-root { position:absolute;inset:0;pointer-events:none; }
        .aurora-blob { position:absolute;border-radius:50%;filter:blur(80px);opacity:0.45;animation:drift 14s ease-in-out infinite alternate; }
        @keyframes drift { 0%{transform:translate(0,0) scale(1)} 50%{transform:translate(24px,-18px) scale(1.04)} 100%{transform:translate(-18px,26px) scale(0.97)} }
        .kpi-float { background:rgba(255,255,255,0.11);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.18);box-shadow:0 8px 24px rgba(0,0,0,0.25);animation:floatCard 6s ease-in-out infinite alternate; }
        @keyframes floatCard { 0%{transform:translateY(0)} 100%{transform:translateY(-10px)} }
      `}</style>
    </div>
  );
}

function FeatureIcon({ type }: { type: string }) {
  const s = { width:14,height:14,fill:"none" as const,stroke:"rgba(165,180,252,0.9)",strokeWidth:2,strokeLinecap:"round" as const,strokeLinejoin:"round" as const };
  if (type === "grid") return <svg viewBox="0 0 24 24" {...s}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
  if (type === "ai")   return <svg viewBox="0 0 24 24" {...s}><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>;
  return <svg viewBox="0 0 24 24" {...s}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
}

function MicrosoftLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" rx="1"/>
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" rx="1"/>
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" rx="1"/>
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" rx="1"/>
    </svg>
  );
}
