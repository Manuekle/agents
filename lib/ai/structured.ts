import { isLocalUrl, providerOf, type Transport } from "./providers";

// One call: "here is an instruction, an input and a JSON shape — give me back
// an object of that shape". Every provider in ./providers can answer it; this
// module is the translation layer between that one request and the three wire
// formats they actually speak.
//
// Isomorphic on purpose. The same function runs in the browser for a
// bring-your-own-key draft (the key never touches our servers, and a localhost
// Ollama is only reachable from there anyway) and on the server for the hosted
// Foundry path.

export interface AiConfig {
  provider: string;
  model: string;
  apiKey?: string;
  /** Overrides the provider's default root. Required for `custom`. */
  baseUrl?: string;
  /**
   * Allow falling back to /api/ai/relay when the provider's CORS policy blocks
   * a direct browser call. The key travels through our server for that one
   * request and is never stored. Never applies to local endpoints.
   */
  allowRelay?: boolean;
}

export interface StructuredRequest {
  instructions: string;
  input: string;
  schemaName: string;
  schema: Record<string, unknown>;
  maxTokens: number;
}

export class AiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AiError";
  }
}

const RELAY_PATH = "/api/ai/relay";
const TIMEOUT_MS = 60_000;

export function resolveBaseUrl(config: AiConfig): string {
  const fallback = providerOf(config.provider)?.baseUrl ?? "";
  return (config.baseUrl || fallback).replace(/\/+$/, "");
}

function transportOf(config: AiConfig): Transport {
  return providerOf(config.provider)?.transport ?? "openai-chat";
}

// ---- request building -----------------------------------------------------

interface Wire {
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

/**
 * `strict` asks the provider to constrain the output to the schema. Not every
 * OpenAI-compatible endpoint implements that (Ollama's older builds, some
 * gateways), so a rejected strict call is retried without it — see `run`.
 */
function build(config: AiConfig, req: StructuredRequest, strict: boolean): Wire {
  const base = resolveBaseUrl(config);
  if (!base) throw new AiError("No API base URL — set one in AI provider settings.");

  const key = config.apiKey?.trim() ?? "";
  // Without a schema to constrain it, the shape has to be asked for in words.
  const instructions = strict
    ? req.instructions
    : `${req.instructions}\n\nReply with a single JSON object matching this schema, and nothing else — no prose, no markdown fences:\n${JSON.stringify(req.schema)}`;

  switch (transportOf(config)) {
    case "anthropic":
      return {
        url: `${base}/v1/messages`,
        headers: {
          "content-type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          // Anthropic blocks browser calls unless this opts in. It is the
          // documented flag for exactly this case: the key belongs to the
          // person at the keyboard, not to a server sharing one key.
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: {
          model: config.model,
          max_tokens: req.maxTokens,
          system: instructions,
          messages: [{ role: "user", content: req.input }],
          // No `temperature` and no `thinking`: both are rejected outright on
          // current Claude models, and the caller picks the model here.
          ...(strict
            ? { output_config: { format: { type: "json_schema", schema: req.schema } } }
            : {}),
        },
      };

    case "openai-responses":
      return {
        url: `${base}/responses`,
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: {
          model: config.model,
          instructions,
          input: req.input,
          max_output_tokens: req.maxTokens,
          ...(strict
            ? {
                text: {
                  format: {
                    type: "json_schema",
                    name: req.schemaName,
                    strict: true,
                    schema: req.schema,
                  },
                },
              }
            : {}),
        },
      };

    default:
      return {
        url: `${base}/chat/completions`,
        headers: {
          "content-type": "application/json",
          ...(key ? { authorization: `Bearer ${key}` } : {}),
        },
        body: {
          model: config.model,
          max_tokens: req.maxTokens,
          messages: [
            { role: "system", content: instructions },
            { role: "user", content: req.input },
          ],
          ...(strict
            ? {
                response_format: {
                  type: "json_schema",
                  json_schema: { name: req.schemaName, strict: true, schema: req.schema },
                },
              }
            : {}),
        },
      };
  }
}

// ---- response reading -----------------------------------------------------

function textFrom(transport: Transport, data: unknown): string {
  const d = data as Record<string, unknown>;

  if (transport === "anthropic") {
    const blocks = Array.isArray(d.content) ? d.content : [];
    return blocks
      .filter((b): b is { type: string; text: string } => {
        const block = b as { type?: unknown; text?: unknown };
        return block.type === "text" && typeof block.text === "string";
      })
      .map((b) => b.text)
      .join("");
  }

  if (transport === "openai-responses") {
    if (typeof d.output_text === "string") return d.output_text;
    // Older shape: walk the output array for text parts.
    const output = Array.isArray(d.output) ? d.output : [];
    return output
      .flatMap((item) => {
        const content = (item as { content?: unknown }).content;
        return Array.isArray(content) ? content : [];
      })
      .map((part) => (part as { text?: unknown }).text)
      .filter((t): t is string => typeof t === "string")
      .join("");
  }

  const choices = Array.isArray(d.choices) ? d.choices : [];
  const message = (choices[0] as { message?: { content?: unknown } } | undefined)?.message;
  return typeof message?.content === "string" ? message.content : "";
}

/**
 * Parse a model's reply as JSON. Strict mode gives clean JSON, but the lenient
 * retry (and any small local model) will happily wrap it in prose or a fenced
 * block, so the object is dug out rather than demanded.
 */
export function parseJson<T>(text: string): T {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // Fall through to extraction.
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(candidate.slice(start, end + 1)) as T;
    } catch {
      // Fall through to the error below.
    }
  }
  throw new AiError("The model did not return JSON. Try a more capable model.");
}

// ---- sending --------------------------------------------------------------

function errorMessage(status: number, raw: string): string {
  try {
    const data = JSON.parse(raw) as { error?: { message?: string } | string; message?: string };
    const err = data.error;
    const message =
      (typeof err === "string" ? err : err?.message) ?? data.message ?? raw.slice(0, 300);
    return `${status}: ${message}`;
  } catch {
    return `${status}: ${raw.slice(0, 300) || "request failed"}`;
  }
}

async function send(wire: Wire, config: AiConfig): Promise<unknown> {
  const local = isLocalUrl(wire.url);
  const request = {
    method: "POST",
    headers: wire.headers,
    body: JSON.stringify(wire.body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  } satisfies RequestInit;

  let res: Response;
  try {
    res = await fetch(wire.url, request);
  } catch (e) {
    // A CORS rejection is indistinguishable from a network failure in fetch —
    // both surface as an opaque TypeError. The relay covers the CORS case; a
    // local endpoint can only be reached from this machine, so it gets the
    // setup hint instead.
    const canRelay =
      !local && config.allowRelay !== false && typeof window !== "undefined";
    if (!canRelay) {
      if (local) {
        throw new AiError(
          `Could not reach ${wire.url}. Is the server running, and does it allow requests from ${typeof window !== "undefined" ? window.location.origin : "this page"}?`,
        );
      }
      throw new AiError(e instanceof Error ? e.message : "network request failed");
    }
    return relay(wire);
  }

  const raw = await res.text();
  if (!res.ok) throw new AiError(errorMessage(res.status, raw), res.status);
  return raw ? JSON.parse(raw) : {};
}

/** Same request, forwarded by our server for providers that refuse browsers. */
async function relay(wire: Wire): Promise<unknown> {
  const res = await fetch(RELAY_PATH, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(wire),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const raw = await res.text();
  if (!res.ok) throw new AiError(errorMessage(res.status, raw), res.status);
  return raw ? JSON.parse(raw) : {};
}

// ---- entry point ----------------------------------------------------------

export async function runStructured<T>(
  config: AiConfig,
  req: StructuredRequest,
): Promise<T> {
  if (!config.model.trim()) throw new AiError("No model selected.");
  const provider = providerOf(config.provider);
  if (provider?.needsKey && !config.apiKey?.trim()) {
    throw new AiError(`${provider.label} needs an API key.`);
  }

  const transport = transportOf(config);

  let data: unknown;
  try {
    data = await send(build(config, req, true), config);
  } catch (e) {
    // 400 on the strict call almost always means "I don't know this schema
    // parameter" rather than "your prompt is wrong", so ask again in words.
    if (!(e instanceof AiError) || e.status !== 400) throw e;
    data = await send(build(config, req, false), config);
  }

  return parseJson<T>(textFrom(transport, data));
}
