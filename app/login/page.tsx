"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Factory, BarChart2, Clock, Shield, Zap, Package, Activity, Gauge, TrendingUp, AlertTriangle } from "lucide-react";

const REMEMBER_KEY     = "ct_remember_email";
const REMEMBER_PENDING = "ct_remember_pending";

const PHRASES = [
  "One screen.",
  "No blind spots.",
  "Zero reports.",
  "Always on.",
  "Every plant, at a glance.",
];

const FLOAT_ICONS = [
  { Icon: BarChart2,     top: "8%",  left: "5%",   delay: 0,    size: 16 },
  { Icon: Clock,         top: "14%", left: "40%",  delay: -2,   size: 15 },
  { Icon: Shield,        top: "7%",  left: "68%",  delay: -4,   size: 15 },
  { Icon: Zap,           top: "70%", left: "7%",   delay: -1,   size: 15 },
  { Icon: Package,       top: "82%", left: "35%",  delay: -3,   size: 16 },
  { Icon: Activity,      top: "88%", left: "62%",  delay: -5,   size: 15 },
  { Icon: Gauge,         top: "52%", left: "2%",   delay: -2.5, size: 15 },
  { Icon: TrendingUp,    top: "38%", left: "44%",  delay: -1.5, size: 15 },
  { Icon: AlertTriangle, top: "20%", left: "84%",  delay: -3.5, size: 14 },
  { Icon: Factory,       top: "66%", left: "80%",  delay: -0.5, size: 16 },
];

function useTypewriter(phrases: string[]) {
  const [text, setText] = useState("");
  const [idx,  setIdx]  = useState(0);
  const [del,  setDel]  = useState(false);

  useEffect(() => {
    const phrase = phrases[idx];
    let t: ReturnType<typeof setTimeout>;
    if (!del && text === phrase) {
      t = setTimeout(() => setDel(true), 1800);
    } else if (del && text === "") {
      setDel(false);
      setIdx((i) => (i + 1) % phrases.length);
    } else if (del) {
      t = setTimeout(() => setText((s) => s.slice(0, -1)), 40);
    } else {
      t = setTimeout(() => setText((s) => phrase.slice(0, s.length + 1)), 75);
    }
    return () => clearTimeout(t);
  }, [text, idx, del, phrases]);

  return text;
}

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading,    setLoading]    = useState(false);
  const [remember,   setRemember]   = useState(false);
  const [savedEmail, setSavedEmail] = useState<string | null>(null);
  const typedText = useTypewriter(PHRASES);

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
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden px-8"
      style={{ background: "linear-gradient(160deg,#1e1b6e 0%,#131055 45%,#0d0b38 100%)" }}>

      {/* Aurora blobs */}
      <div className="aurora-root">
        <div className="aurora-blob" style={{ width:700,height:580,background:"radial-gradient(ellipse,#6366f1,transparent)",top:"-15%",left:"-8%" }} />
        <div className="aurora-blob" style={{ width:560,height:460,background:"radial-gradient(ellipse,#8b5cf6,transparent)",bottom:"-10%",right:"-5%",animationDelay:"-5s",animationDuration:"11s" }} />
        <div className="aurora-blob" style={{ width:440,height:380,background:"radial-gradient(ellipse,#3b82f6,transparent)",bottom:"25%",left:"32%",animationDelay:"-9s",animationDuration:"17s" }} />
      </div>

      {/* Grid */}
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage:"linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)",backgroundSize:"48px 48px" }} />

      {/* Floating icon circles */}
      {FLOAT_ICONS.map(({ Icon, top, left, delay, size }, i) => (
        <div key={i} className="float-icon absolute flex items-center justify-center rounded-full pointer-events-none"
          style={{ top, left, width:44, height:44, animationDelay:`${delay}s`, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", backdropFilter:"blur(8px)" }}>
          <Icon size={size} style={{ color:"rgba(165,180,252,0.5)" }} strokeWidth={1.5} />
        </div>
      ))}

      {/* Center container */}
      <div className="relative z-10 w-full max-w-[1040px] flex items-center gap-20">

        {/* ── LEFT: Branding ─────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-9 text-[11px] font-semibold"
            style={{ background:"rgba(99,102,241,0.22)",border:"1px solid rgba(129,140,248,0.4)",color:"#c7d2fe" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live · Snowflake
          </div>

          {/* Headline + typewriter */}
          <div className="mb-5" style={{ fontFamily:"'Space Grotesk',sans-serif",letterSpacing:"-0.04em",lineHeight:1.05 }}>
            <div className="font-bold text-white" style={{ fontSize:58 }}>Every KPI.</div>
            <div className="font-bold" style={{ fontSize:58, color:"#a5b4fc", minHeight:"1.1em" }}>
              {typedText}<span className="cursor-blink">|</span>
            </div>
          </div>

          <p className="text-[14px] leading-relaxed mb-10" style={{ color:"rgba(199,210,254,0.58)", maxWidth:400 }}>
            Real-time production visibility across every plant.<br />No reports. No waiting.
          </p>

          {/* Feature bullets */}
          <div className="flex flex-col gap-3">
            {[
              { icon:"grid", text:"7 live KPIs — OEE, RFT, Lead Time, Loss, Output & more" },
              { icon:"ai",   text:"AI summaries & analyst chat, powered by Snowflake" },
              { icon:"bell", text:"Instant Teams alerts, routed per recipient" },
            ].map((f) => (
              <div key={f.icon} className="flex items-center gap-3 text-[13px] font-medium" style={{ color:"rgba(199,210,254,0.72)" }}>
                <div className="w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0"
                  style={{ background:"rgba(99,102,241,0.2)",border:"1px solid rgba(129,140,248,0.28)" }}>
                  <FeatureIcon type={f.icon} />
                </div>
                {f.text}
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT: Login card ──────────────────────────────────── */}
        <div className="shrink-0 w-[360px]">
          <div className="w-full rounded-[22px] p-7"
            style={{ background:"rgba(255,255,255,0.09)",border:"1px solid rgba(255,255,255,0.16)",boxShadow:"0 32px 72px rgba(0,0,0,0.45),inset 0 1px 0 rgba(255,255,255,0.1)",backdropFilter:"blur(28px)" }}>

            {/* Logo + title */}
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-12 h-12 rounded-[14px] flex items-center justify-center mb-4"
                style={{ background:"linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%)",boxShadow:"0 6px 20px rgba(79,70,229,0.45)" }}>
                <Factory size={20} className="text-white" />
              </div>
              <p className="font-bold text-white leading-none" style={{ fontFamily:"'Space Grotesk',sans-serif",fontSize:16,letterSpacing:"-0.02em" }}>Control Tower</p>
              <p className="text-[10px] mt-1" style={{ color:"rgba(165,180,252,0.45)" }}>PT Paracorp Group</p>
            </div>

            <div className="h-px mb-5" style={{ background:"rgba(255,255,255,0.08)" }} />

            <p className="font-semibold text-white text-center mb-0.5" style={{ fontSize:13 }}>Sign in</p>
            <p className="text-[11px] text-center mb-5" style={{ color:"rgba(165,180,252,0.5)" }}>Internal access only.</p>

            {savedEmail && (
              <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 mb-4"
                style={{ background:"rgba(99,102,241,0.16)",border:"1px solid rgba(99,102,241,0.32)" }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-[11px]"
                  style={{ background:"linear-gradient(135deg,#4f46e5,#7c3aed)" }}>
                  {savedEmail.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold truncate" style={{ color:"rgba(255,255,255,0.9)" }}>{savedEmail}</p>
                  <p className="text-[10px]" style={{ color:"rgba(129,140,248,0.55)" }}>Saved account</p>
                </div>
                <button onClick={() => { localStorage.removeItem(REMEMBER_KEY); setSavedEmail(null); setRemember(false); }}
                  className="text-[10px] transition-colors hover:text-white shrink-0" style={{ color:"rgba(129,140,248,0.4)" }}>
                  Remove
                </button>
              </div>
            )}

            <button onClick={handleSignIn} disabled={loading}
              className="w-full relative flex items-center justify-center rounded-xl py-3 font-semibold text-gray-800 bg-white transition-all hover:bg-gray-50 disabled:opacity-60 mb-3"
              style={{ fontSize:14, boxShadow:"0 4px 20px rgba(0,0,0,0.3)" }}>
              <span className="absolute left-4"><MicrosoftLogo /></span>
              {loading ? "Signing in…" : savedEmail ? `Sign in as ${savedEmail.split("@")[0]}` : "Continue with Microsoft"}
            </button>

            <p className="text-[11px] leading-relaxed text-center mb-5" style={{ color:"rgba(165,180,252,0.42)" }}>
              Use your Paracorp work account. Access is limited to the Paracorp directory.
            </p>

            <label className="flex items-center justify-center gap-2 cursor-pointer select-none">
              <div onClick={() => setRemember(!remember)}
                className="w-4 h-4 rounded flex items-center justify-center shrink-0 transition-all"
                style={{ background:remember?"rgba(99,102,241,0.38)":"rgba(99,102,241,0.14)",border:`1.5px solid ${remember?"rgba(129,140,248,0.65)":"rgba(99,102,241,0.28)"}` }}>
                {remember && (
                  <svg width="9" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="#a5b4fc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <span onClick={() => setRemember(!remember)} className="text-[11px]" style={{ color:"rgba(165,180,252,0.5)" }}>
                Remember me on this device
              </span>
            </label>
          </div>

          <div className="flex justify-center mt-4">
            <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1"
              style={{ background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px]" style={{ color:"rgba(255,255,255,0.38)" }}>Control Tower v1.1 · System active</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .aurora-root { position:absolute;inset:0;pointer-events:none; }
        .aurora-blob { position:absolute;border-radius:50%;filter:blur(90px);opacity:0.4;animation:drift 14s ease-in-out infinite alternate; }
        @keyframes drift { 0%{transform:translate(0,0) scale(1)} 50%{transform:translate(28px,-20px) scale(1.05)} 100%{transform:translate(-20px,30px) scale(0.96)} }
        .float-icon { animation:floatIcon 8s ease-in-out infinite alternate; }
        @keyframes floatIcon { 0%{transform:translateY(0) scale(1)} 100%{transform:translateY(-14px) scale(1.04)} }
        .cursor-blink { display:inline-block;color:#a5b4fc;font-weight:200;margin-left:2px;animation:blink 1s step-end infinite; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
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
