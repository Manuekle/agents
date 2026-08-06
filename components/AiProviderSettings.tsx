"use client";

import { useId, useState } from "react";
import { Badge, Field, Panel, Segmented, Select, TextInput } from "@/components/ui";
import { ArrowRightIcon } from "@/components/icons";
import { PROVIDERS, isLocalUrl, providerOf } from "@/lib/ai/providers";
import { setAiSettings, useAiSettings, type AiMode } from "@/lib/ai/settings";
import { SITE_URL } from "@/lib/site";

// Where a visitor points the onboarding draft at their own model instead of
// ours. The panel is deliberately blunt about where the key goes, because
// "paste your API key here" is a request that has to earn trust in one screen.

const MODES: { id: AiMode; label: string }[] = [
  { id: "hosted", label: "Use creagent" },
  { id: "byok", label: "Use my own API" },
];

function Check({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex gap-2.5 items-start cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-coral cursor-pointer"
      />
      <span className="min-w-0">
        <span className="font-mono text-xs">{label}</span>
        <span className="block font-mono text-[10px] text-muted leading-relaxed">{hint}</span>
      </span>
    </label>
  );
}

export function AiProviderSettings() {
  const settings = useAiSettings();
  const provider = providerOf(settings.provider) ?? PROVIDERS[0];
  const [showKey, setShowKey] = useState(false);
  const modelsId = useId();

  const effectiveBase = settings.baseUrl.trim() || provider.baseUrl;
  // Checked against the URL, not the provider row: a custom entry aimed at
  // localhost is just as unreachable from our server as Ollama is.
  const local = provider.local || isLocalUrl(effectiveBase);

  return (
    <Panel className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-pixel text-[10px] uppercase tracking-wide">Model</h2>
        {settings.mode === "byok" && <Badge tone="coral">Your key</Badge>}
      </div>

      <Segmented<AiMode>
        options={MODES}
        value={settings.mode}
        onChange={(mode) => setAiSettings({ mode })}
      />

      {settings.mode === "hosted" ? (
        <p className="font-mono text-xs text-ink-soft leading-relaxed">
          Drafts run on our Azure AI Foundry deployment and count against your monthly
          draft allowance. Nothing to configure.
        </p>
      ) : (
        <>
          <p className="font-mono text-xs text-ink-soft leading-relaxed">
            Your browser calls the provider directly — the key is stored in this browser
            and never sent to our servers. Drafts cost you whatever your provider charges
            and don&apos;t touch your monthly allowance.
          </p>

          <Field label="Provider">
            <Select
              aria-label="Model provider"
              options={PROVIDERS.map((p) => ({ id: p.id, label: p.label, hint: p.vendor }))}
              value={settings.provider}
              onChange={(id) => {
                const next = providerOf(id);
                // Model and base URL belong to the provider that was selected,
                // so switching resets both rather than carrying over an id the
                // new endpoint has never heard of.
                setAiSettings({
                  provider: id,
                  model: next?.models[0] ?? "",
                  baseUrl: "",
                });
              }}
            />
          </Field>

          <Field
            label="Model"
            hint={provider.models.length > 0 ? "or type any id" : "required"}
          >
            <TextInput
              list={modelsId}
              placeholder={provider.models[0] ?? "model id"}
              value={settings.model}
              onChange={(e) => setAiSettings({ model: e.target.value })}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <datalist id={modelsId}>
            {provider.models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>

          {provider.needsKey && (
            <Field
              label="API key"
              hint={provider.keyUrl ? undefined : "stays in this browser"}
            >
              <div className="flex gap-2">
                <TextInput
                  type={showKey ? "text" : "password"}
                  placeholder="sk-…"
                  value={settings.apiKey}
                  onChange={(e) => setAiSettings({ apiKey: e.target.value })}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="shrink-0 border-2 border-line px-3 font-mono text-xs hover:bg-stone cursor-pointer"
                >
                  {showKey ? "hide" : "show"}
                </button>
              </div>
            </Field>
          )}

          {provider.keyUrl && (
            <p className="font-mono text-[10px] text-muted -mt-2">
              <a
                href={provider.keyUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="underline hover:text-ink"
              >
                <span className="inline-flex items-center gap-1">
                  Get a {provider.label} key
                  <ArrowRightIcon size={10} />
                </span>
              </a>
            </p>
          )}

          <Field
            label="Base URL"
            hint={provider.baseUrl ? "optional" : "required"}
          >
            <TextInput
              placeholder={provider.baseUrl || "https://…/v1"}
              value={settings.baseUrl}
              onChange={(e) => setAiSettings({ baseUrl: e.target.value })}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>

          {provider.hint && (
            <p className="font-mono text-[11px] text-muted leading-relaxed">{provider.hint}</p>
          )}

          <div className="space-y-2.5 pt-1">
            {provider.needsKey && (
              <Check
                label="Remember this key"
                hint={
                  settings.remember
                    ? "Kept in this browser until you clear it."
                    : "Forgotten when you close the tab."
                }
                checked={settings.remember}
                onChange={(remember) => setAiSettings({ remember })}
              />
            )}
            {/* Hidden for local endpoints: our server cannot reach your
                machine, so there is no relay to offer. */}
            {!local && (
              <Check
                label="Relay if the provider blocks browsers"
                hint="Some vendors send no CORS headers. With this on, that one request is forwarded through creagent — your key passes through and is not stored."
                checked={settings.allowRelay}
                onChange={(allowRelay) => setAiSettings({ allowRelay })}
              />
            )}
          </div>

          {local && (
            <div className="border-2 border-line bg-stone-deep p-3">
              <p className="font-mono text-[11px] text-ink-soft leading-relaxed">
                A local model only answers this page if you let it. For Ollama, start it
                with your origin allowed:
              </p>
              <code className="mt-2 block font-mono text-[10px] break-all">
                OLLAMA_ORIGINS=
                {typeof window === "undefined" ? SITE_URL : window.location.origin}{" "}
                ollama serve
              </code>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
