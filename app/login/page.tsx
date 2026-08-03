"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Factory } from "lucide-react";

const REMEMBER_KEY = "ct_remember_email";
const REMEMBER_PENDING = "ct_remember_pending";

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);
  const [savedEmail, setSavedEmail] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user?.email) {
      // If user checked "remember me" before OAuth redirect, save their email now
      if (localStorage.getItem(REMEMBER_PENDING) === "true") {
        localStorage.setItem(REMEMBER_KEY, session.user.email);
        localStorage.removeItem(REMEMBER_PENDING);
      }
      router.replace("/dashboard");
    }
  }, [session, router]);

  useEffect(() => {
    const stored = localStorage.getItem(REMEMBER_KEY);
    if (stored) {
      setSavedEmail(stored);
      setRemember(true);
    }
  }, []);

  const handleSignIn = async () => {
    setLoading(true);
    if (remember) {
      localStorage.setItem(REMEMBER_PENDING, "true");
    } else {
      localStorage.removeItem(REMEMBER_PENDING);
      localStorage.removeItem(REMEMBER_KEY);
      setSavedEmail(null);
    }
    await signIn("azure-ad", { callbackUrl: "/dashboard" });
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-800 to-brand-900">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-800 via-brand-900 to-[#0a1228]">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-blue-500 opacity-5"
            style={{
              width: `${100 + i * 80}px`,
              height: `${100 + i * 80}px`,
              top: `${10 + i * 12}%`,
              left: `${5 + i * 15}%`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-sm px-4">
        {/* Card */}
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-10 shadow-2xl">
          <div className="flex flex-col items-center gap-6">
            {/* Logo */}
            <div className="bg-brand-600 p-4 rounded-2xl shadow-lg">
              <Factory size={36} className="text-white" />
            </div>

            <div className="text-center">
              <h1 className="text-2xl font-bold text-white">Control Tower</h1>
              <p className="text-blue-200 text-sm mt-1">Manufacturing Dashboard</p>
            </div>

            <div className="w-full border-t border-white/10" />

            {/* Saved account indicator */}
            {savedEmail && (
              <div className="w-full bg-white/10 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 bg-brand-600 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-white text-xs font-bold">
                    {savedEmail.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white font-medium truncate">{savedEmail}</p>
                  <p className="text-[10px] text-blue-300">Akun tersimpan</p>
                </div>
                <button
                  onClick={() => {
                    localStorage.removeItem(REMEMBER_KEY);
                    setSavedEmail(null);
                    setRemember(false);
                  }}
                  className="text-blue-300 hover:text-white text-[10px] transition-colors shrink-0"
                >
                  Hapus
                </button>
              </div>
            )}

            <div className="w-full flex flex-col gap-3">
              <p className="text-blue-100 text-sm text-center">
                {savedEmail ? "Lanjutkan masuk dengan akun yang tersimpan" : "Sign in dengan akun Microsoft perusahaan"}
              </p>

              <button
                onClick={handleSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 px-6 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-60"
              >
                <MicrosoftLogo />
                {loading ? "Signing in..." : savedEmail ? "Masuk sebagai " + savedEmail.split("@")[0] : "Sign in with Microsoft"}
              </button>

              {/* Remember me */}
              <label className="flex items-center gap-2 cursor-pointer group select-none">
                <div
                  onClick={() => setRemember(!remember)}
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                    remember ? "bg-brand-500 border-brand-500" : "border-white/40 hover:border-white/60"
                  }`}
                >
                  {remember && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span
                  onClick={() => setRemember(!remember)}
                  className="text-xs text-blue-200 group-hover:text-white transition-colors"
                >
                  Ingat akun saya di perangkat ini
                </span>
              </label>
            </div>

            <p className="text-xs text-blue-300 text-center">
              Akses dibatasi untuk personel yang berwenang
            </p>
          </div>
        </div>

        {/* Version */}
        <p className="text-center text-[10px] text-blue-400/50 mt-4">
          Control Tower Manufacture v1.0 · PT Paracorp Group
        </p>
      </div>
    </div>
  );
}

function MicrosoftLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}
