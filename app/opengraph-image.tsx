import { ImageResponse } from "next/og";
import { BRAND, habibiFont } from "@/lib/brand";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "agents — build AI agents, powered by ai";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: BRAND.paper,
          color: BRAND.ink,
          padding: "72px 80px",
          // the coral baseline from the previous card, kept as the brand cue
          borderBottom: `18px solid ${BRAND.coral}`,
        }}
      >
        <div style={{ display: "flex", fontFamily: "Habibi", fontSize: 60 }}>
          agents
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontFamily: "Habibi",
              fontSize: 104,
              lineHeight: 1.05,
            }}
          >
            <span>Build AI agents.</span>
            <span>Ship your skills.</span>
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 28,
              fontSize: 30,
              color: BRAND.muted,
            }}
          >
            Compose AI agents with skills. Export to Claude Code, Codex &amp; any
            MCP model.
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: [await habibiFont()] },
  );
}
