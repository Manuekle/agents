// The catalogue of model providers the onboarding draft can run on. Client
// safe by construction: nothing here holds a key, only the shape of a request
// to each vendor. Whoever brings their own key picks a row from this table.
//
// `transport` is the only thing that really varies. Almost every vendor speaks
// OpenAI chat completions, so most rows share one code path in ./structured.

export type Transport = "openai-chat" | "openai-responses" | "anthropic";

export interface Provider {
  id: string;
  label: string;
  vendor: string;
  transport: Transport;
  /** Default API root. The user can override it — see `custom`. */
  baseUrl: string;
  /** Suggestions, not a whitelist: a model id typed in by hand still works. */
  models: string[];
  needsKey: boolean;
  /**
   * Runs on the user's own machine. Two consequences: the call has to be made
   * from the browser (a server on Vercel cannot reach anyone's localhost), and
   * the relay in /api/ai/relay must refuse it.
   */
  local: boolean;
  /** Where to get a key, linked from the settings panel. */
  keyUrl?: string;
  hint?: string;
}

export const PROVIDERS: Provider[] = [
  {
    id: "anthropic",
    label: "Claude",
    vendor: "Anthropic",
    transport: "anthropic",
    baseUrl: "https://api.anthropic.com",
    models: ["claude-opus-5", "claude-sonnet-5", "claude-haiku-4-5"],
    needsKey: true,
    local: false,
    keyUrl: "https://platform.claude.com/settings/keys",
  },
  {
    id: "openai",
    label: "ChatGPT",
    vendor: "OpenAI",
    transport: "openai-chat",
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-5.5", "gpt-5.4-mini"],
    needsKey: true,
    local: false,
    keyUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "moonshot",
    label: "Kimi",
    vendor: "Moonshot",
    transport: "openai-chat",
    baseUrl: "https://api.moonshot.ai/v1",
    models: ["kimi-latest", "kimi-k2-turbo-preview"],
    needsKey: true,
    local: false,
    keyUrl: "https://platform.moonshot.ai/console/api-keys",
    hint: "Mainland accounts: swap the base URL for https://api.moonshot.cn/v1",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    vendor: "DeepSeek",
    transport: "openai-chat",
    baseUrl: "https://api.deepseek.com/v1",
    models: ["deepseek-chat", "deepseek-reasoner"],
    needsKey: true,
    local: false,
    keyUrl: "https://platform.deepseek.com/api_keys",
  },
  {
    id: "google",
    label: "Gemini",
    vendor: "Google",
    transport: "openai-chat",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    models: ["gemini-3-pro", "gemini-3-flash"],
    needsKey: true,
    local: false,
    keyUrl: "https://aistudio.google.com/apikey",
  },
  {
    id: "groq",
    label: "Groq",
    vendor: "Groq",
    transport: "openai-chat",
    baseUrl: "https://api.groq.com/openai/v1",
    models: ["llama-3.3-70b-versatile", "moonshotai/kimi-k2-instruct"],
    needsKey: true,
    local: false,
    keyUrl: "https://console.groq.com/keys",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    vendor: "OpenRouter",
    transport: "openai-chat",
    baseUrl: "https://openrouter.ai/api/v1",
    models: ["anthropic/claude-sonnet-5", "openai/gpt-5.5", "moonshotai/kimi-k2"],
    needsKey: true,
    local: false,
    keyUrl: "https://openrouter.ai/keys",
    hint: "One key, every vendor — handy if you don't want an account per provider.",
  },
  {
    id: "ollama",
    label: "Ollama",
    vendor: "local",
    transport: "openai-chat",
    baseUrl: "http://localhost:11434/v1",
    models: ["qwen3:8b", "llama3.2", "mistral"],
    needsKey: false,
    local: true,
    hint: "Ollama must accept requests from this page: run it with OLLAMA_ORIGINS set (see the note below).",
  },
  {
    id: "lmstudio",
    label: "LM Studio",
    vendor: "local",
    transport: "openai-chat",
    baseUrl: "http://localhost:1234/v1",
    models: ["local-model"],
    needsKey: false,
    local: true,
    hint: "Start the LM Studio local server and enable CORS in its settings.",
  },
  {
    id: "custom",
    label: "Custom",
    vendor: "OpenAI-compatible",
    transport: "openai-chat",
    baseUrl: "",
    models: [],
    needsKey: true,
    local: false,
    hint: "Any endpoint that speaks OpenAI chat completions — vLLM, LiteLLM, Azure, a gateway of your own.",
  },
];

export function providerOf(id: string): Provider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

/**
 * True when the endpoint lives on the machine running the browser. Checked
 * against the resolved base URL rather than the provider row, so a custom
 * entry pointed at localhost is treated as local too.
 */
export function isLocalUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "0.0.0.0" ||
      hostname.endsWith(".local")
    );
  } catch {
    return false;
  }
}
