"use client";

import { useSession } from "next-auth/react";

export function SecurityOverlay() {
  const { data: session } = useSession();

  const userLabel =
    session?.user?.email ?? session?.user?.name ?? "Authorized User";

  const now = new Date();
  const dateLabel = [
    String(now.getDate()).padStart(2, "0"),
    String(now.getMonth() + 1).padStart(2, "0"),
    now.getFullYear(),
  ].join("/");

  return (
    <div
      className="fixed inset-0 pointer-events-none select-none overflow-hidden"
      style={{ zIndex: 9000 }}
      aria-hidden="true"
    >
      <svg
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block" }}
      >
        <defs>
          <pattern
            id="ct-watermark"
            x="0"
            y="0"
            width="320"
            height="130"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-28)"
          >
            <text
              x="12"
              y="52"
              fontSize="11"
              fill="rgba(15,23,42,0.045)"
              fontFamily="Inter, ui-sans-serif, sans-serif"
              fontWeight="500"
              letterSpacing="0.3"
            >
              {userLabel}
            </text>
            <text
              x="12"
              y="70"
              fontSize="9.5"
              fill="rgba(15,23,42,0.03)"
              fontFamily="Inter, ui-sans-serif, sans-serif"
            >
              Confidential · Manufacturing Control Tower · {dateLabel}
            </text>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#ct-watermark)" />
      </svg>
    </div>
  );
}
