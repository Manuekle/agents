import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MCP server",
  description: "Serve your agent over MCP to any model with @agents-dev/mcp.",
};

export default function McpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
