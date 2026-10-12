"use client";
import { useRef } from "react";

export function Fade({ depKey, children, className }: { depKey: unknown; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const prevKey = useRef(depKey);

  if (prevKey.current !== depKey) {
    prevKey.current = depKey;
    if (ref.current) {
      ref.current.classList.remove("ui-fade-in");
      void ref.current.offsetWidth; // trigger reflow
      ref.current.classList.add("ui-fade-in");
    }
  }

  return (
    <div ref={ref} className={`contents ui-fade-in${className ? ` ${className}` : ""}`}>
      {children}
    </div>
  );
}
