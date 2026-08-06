"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Panel, PixelButton, Badge, TextInput, Notice } from "@/components/ui";
import { ArrowRightIcon } from "@/components/icons";
import { supabaseBrowser } from "@/lib/supabase/client";
import { SUPABASE_CONFIGURED } from "@/lib/supabase/env";
import { usePlan } from "@/lib/use-plan";
import { useSignedIn } from "@/lib/use-auth";
import { PLANS } from "@/lib/plans";
import { copyText } from "@/lib/copy";
import { clsx } from "@/lib/clsx";

interface TokenRow {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used: string | null;
}

export function McpTokens() {
  // Two different questions, answered by the hook that actually knows each.
  //
  // `usePlan()` used to answer both, and its `signedIn` is false until two
  // table reads land — so this panel greeted every signed-in user with "Sign
  // in to create a token" for as long as that took, and forever if the reads
  // failed. `useSignedIn()` is the auth question on its own, and its `null`
  // means "not known yet", which is a state this panel can render honestly.
  const signedIn = useSignedIn();
  const { plan } = usePlan();
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [fresh, setFresh] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Which row is one press away from being revoked. Two presses rather than a
  // browser confirm(), matching how the home page deletes an agent — and for a
  // stronger reason: revoking is instant, permanent, and breaks whatever CLI is
  // holding that token right now, with no way to get the same string back.
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = supabaseBrowser();
    if (!sb) return;
    const { data } = await sb
      .from("api_tokens")
      .select("id,name,prefix,created_at,last_used")
      .order("created_at", { ascending: false });
    setTokens((data as TokenRow[]) ?? []);
  }, []);

  useEffect(() => {
    if (signedIn) void load();
  }, [signedIn, load]);

  if (!SUPABASE_CONFIGURED) return null;

  const canServe = plan ? PLANS[plan].mcp : false;
  // Signed in, but which plan has not landed. Same rule as the auth question
  // one line up: an unknown plan must not render as "you are on a plan without
  // this", which is what a bare `!canServe` said to every Pro user for the
  // length of the read.
  const planPending = signedIn === true && plan === null;

  const create = async () => {
    const sb = supabaseBrowser();
    if (!sb) return;
    setBusy(true);
    setError(null);
    const { data, error } = await sb.rpc("create_api_token", { token_name: name });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    // The only time the plaintext is ever available — the server keeps a hash.
    setFresh(data as string);
    setName("");
    void load();
  };

  const revoke = async (id: string) => {
    const sb = supabaseBrowser();
    if (!sb) return;
    setConfirming(null);
    const { error } = await sb.from("api_tokens").delete().eq("id", id);
    // A revoke that silently fails leaves a live token on screen looking dead —
    // the one outcome worse than not revoking at all.
    if (error) setError(error.message);
    void load();
  };

  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="font-pixel text-[10px] uppercase">Serve from your account</span>
        {plan && <Badge tone={canServe ? "coral" : "stone"}>{PLANS[plan].label}</Badge>}
      </div>

      <p className="font-mono text-xs text-muted leading-relaxed">
        With a token the MCP server pulls the agent from your account instead of
        a file on disk, so it follows you between machines.
      </p>

      {signedIn === null || planPending ? (
        // Auth or the plan has not answered. Holding the slot at the height of
        // the button that is about to fill it, rather than guessing
        // signed-out and swapping a beat later.
        <div className="mt-4 h-[38px] border-2 border-line bg-stone grid place-items-center">
          <span className="font-mono text-[10px] text-muted">
            {signedIn === null ? "checking your session…" : "reading your plan…"}
          </span>
        </div>
      ) : !signedIn ? (
        <Link href="/login?next=%2Fmcp" className="block mt-4">
          <PixelButton variant="coral" className="w-full">
            <span className="inline-flex items-center gap-1.5">
              Sign in to create a token
              <ArrowRightIcon size={12} />
            </span>
          </PixelButton>
        </Link>
      ) : !canServe ? (
        <div className="mt-4">
          <p className="font-mono text-[11px] text-muted">
            Serving over MCP is a Pro feature. The file-based setup below works
            on every plan, including Free.
          </p>
          <Link href="/pricing" className="block mt-3">
            <PixelButton variant="ghost" className="w-full">
              <span className="inline-flex items-center gap-1.5">
                See plans
                <ArrowRightIcon size={12} />
              </span>
            </PixelButton>
          </Link>
        </div>
      ) : (
        <>
          <div className="flex items-stretch gap-1.5 mt-4">
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="token name (e.g. laptop)"
              className="flex-1 min-w-0"
            />
            <PixelButton variant="coral" onClick={create} disabled={busy} className="shrink-0">
              {busy ? "…" : "New token"}
            </PixelButton>
          </div>

          {error && <Notice className="mt-2">{error}</Notice>}

          {fresh && (
            <div className="mt-3 border-2 border-coral p-3">
              <p className="font-mono text-[10px] uppercase text-coral-deep mb-1.5">
                Copy it now — it is never shown again
              </p>
              <code className="block bg-stone border-2 border-line px-2 py-1.5 font-mono text-[10px] break-all">
                {fresh}
              </code>
              <PixelButton
                onClick={async () => {
                  if (await copyText(fresh)) {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1600);
                  }
                }}
                className="mt-2 w-full !text-[9px]"
              >
                {copied ? "Copied" : "Copy token"}
              </PixelButton>
            </div>
          )}

          {tokens.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {tokens.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-2 border-2 border-line px-2 py-1.5"
                >
                  <span className="min-w-0">
                    <span className="font-mono text-[11px] block truncate">{t.name}</span>
                    <span className="font-mono text-[9px] text-muted">
                      {t.prefix}… ·{" "}
                      {t.last_used
                        ? `used ${new Date(t.last_used).toLocaleDateString()}`
                        : "never used"}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={
                      confirming === t.id ? `Confirm revoking ${t.name}` : `Revoke ${t.name}`
                    }
                    title={
                      confirming === t.id
                        ? "Press again to revoke"
                        : "Revoke this token — anything using it stops working"
                    }
                    onClick={() =>
                      confirming === t.id ? void revoke(t.id) : setConfirming(t.id)
                    }
                    onBlur={() => setConfirming((id) => (id === t.id ? null : id))}
                    className={clsx(
                      "font-mono text-[10px] px-2 py-1 border-2 border-line transition-colors shrink-0 cursor-pointer",
                      confirming === t.id
                        ? "bg-coral-text text-paper"
                        : "hover:bg-coral-text hover:text-paper",
                    )}
                  >
                    {confirming === t.id ? "Sure?" : "Revoke"}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4">
            <div className="font-mono text-[9px] uppercase text-muted mb-1">run it</div>
            <code className="block bg-stone border-2 border-line px-2 py-1.5 font-mono text-[10px] overflow-auto whitespace-nowrap">
              npx -y @manudev.jsx/creagent --token &lt;your-token&gt;
            </code>
          </div>
        </>
      )}
    </Panel>
  );
}
