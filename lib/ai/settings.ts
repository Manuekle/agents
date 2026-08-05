"use client";

import { useSyncExternalStore } from "react";
import { providerOf, type Provider } from "./providers";
import type { AiConfig } from "./structured";

// Where the "use my own API" choice lives. Everything here stays on the user's
// machine: the key is written to storage in this browser and read back by the
// draft call, which goes straight from the page to the provider. It is never
// posted to our server — the one exception is the CORS relay, which the user
// opts into and which forwards the key for a single request without storing it.
//
// Threat model worth stating plainly: a key in web storage is readable by any
// script that runs on this origin. That is the same trade every BYOK tool
// makes, and `remember: false` narrows it to the life of the tab.

export type AiMode = "hosted" | "byok";

export interface AiSettings {
  mode: AiMode;
  provider: string;
  model: string;
  /** Empty means "use the provider's default". */
  baseUrl: string;
  apiKey: string;
  /** localStorage when true, sessionStorage when false. Key only. */
  remember: boolean;
  allowRelay: boolean;
}

const SETTINGS_KEY = "agents-dev:ai";
const API_KEY = "agents-dev:ai-key";

export const DEFAULT_SETTINGS: AiSettings = {
  mode: "hosted",
  provider: "anthropic",
  model: "claude-opus-5",
  baseUrl: "",
  apiKey: "",
  remember: true,
  allowRelay: true,
};

const listeners = new Set<() => void>();
let cache: AiSettings | null = null;

function read(): AiSettings {
  if (cache) return cache;
  if (typeof window === "undefined") return DEFAULT_SETTINGS;

  let stored: Partial<AiSettings> = {};
  try {
    stored = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? "{}");
  } catch {
    stored = {};
  }

  // The key is kept out of the settings blob so `remember` can move it between
  // stores without rewriting anything else.
  let apiKey = "";
  try {
    apiKey =
      window.sessionStorage.getItem(API_KEY) ?? window.localStorage.getItem(API_KEY) ?? "";
  } catch {
    apiKey = "";
  }

  cache = { ...DEFAULT_SETTINGS, ...stored, apiKey };
  return cache;
}

function write(next: AiSettings) {
  cache = next;
  if (typeof window !== "undefined") {
    try {
      const { apiKey, ...rest } = next;
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(rest));
      // Written to exactly one store, and cleared from the other, so toggling
      // `remember` off actually forgets the key rather than shadowing it.
      const keep = next.remember ? window.localStorage : window.sessionStorage;
      const drop = next.remember ? window.sessionStorage : window.localStorage;
      drop.removeItem(API_KEY);
      if (apiKey) keep.setItem(API_KEY, apiKey);
      else keep.removeItem(API_KEY);
    } catch {
      // Private mode or a full quota — the settings still apply for this page.
    }
  }
  for (const l of listeners) l();
}

export function setAiSettings(patch: Partial<AiSettings>) {
  write({ ...read(), ...patch });
}

export function useAiSettings(): AiSettings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => DEFAULT_SETTINGS,
  );
}

export function aiConfig(s: AiSettings): AiConfig {
  return {
    provider: s.provider,
    model: s.model.trim(),
    apiKey: s.apiKey.trim(),
    baseUrl: s.baseUrl.trim(),
    allowRelay: s.allowRelay,
  };
}

/** Null when the settings are usable, otherwise why they are not. */
export function settingsProblem(s: AiSettings): string | null {
  if (s.mode !== "byok") return null;
  const provider: Provider | undefined = providerOf(s.provider);
  if (!provider) return "Pick a provider.";
  if (!s.model.trim()) return "Enter a model id.";
  if (!provider.baseUrl && !s.baseUrl.trim()) return "Enter the API base URL.";
  if (provider.needsKey && !s.apiKey.trim()) return `Enter your ${provider.label} API key.`;
  return null;
}
