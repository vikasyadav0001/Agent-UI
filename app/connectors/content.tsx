"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

import { getConnections, authorizeConnection, disconnectConnection, saveApiKeyConnection, testConnection } from "@/lib/api";

const CONNECTOR_META: Record<string, { icon: string; type: "oauth" | "apikey"; fallbackLabel: string }> = {
  github: { icon: "/github-dark.svg", type: "oauth", fallbackLabel: "GitHub" },
  google_gmail: { icon: "/gmail-2026.svg", type: "oauth", fallbackLabel: "Gmail" },
  google_drive: { icon: "/google-drive-2026.svg", type: "oauth", fallbackLabel: "Google Drive" },
  google_sheets: { icon: "/google-sheets-2026.svg", type: "oauth", fallbackLabel: "Google Sheets" },
  google_docs: { icon: "/google-docs-2026.svg", type: "oauth", fallbackLabel: "Google Docs" },
  google_calendar: { icon: "/google-calendar-2026.svg", type: "oauth", fallbackLabel: "Google Calendar" },
  notion: { icon: "/notion.svg", type: "oauth", fallbackLabel: "Notion" },
  slack: { icon: "/slack.svg", type: "oauth", fallbackLabel: "Slack" },
  atlassian: { icon: "/atlassian.svg", type: "oauth", fallbackLabel: "Atlassian" },
  firecrawl: { icon: "/firecrawl-light.svg", type: "apikey", fallbackLabel: "Firecrawl" },
  exa: { icon: "/exa.svg", type: "apikey", fallbackLabel: "Exa" },
};

type Connector = {
  id: string;
  name: string;
  icon: string;
  type: "oauth" | "apikey";
};

type ConnectionStatus = Record<string, { connected: boolean; tested?: boolean }>;

export default function ConnectorsContent() {
  const [status, setStatus] = useState<ConnectionStatus>({});
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, string>>({});
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch all connection statuses
  useEffect(() => {
    getConnections()
      .then(async r => {
        if (!r.ok) {
          console.error("Failed to fetch connections", await r.text());
          return {};
        }
        return r.json();
      })
      .then(data => {
        const map: ConnectionStatus = {};
        if (Array.isArray(data)) {
          data.forEach((c: any) => {
            map[c.name] = { connected: c.connected };
          });
          setConnectors(
            data.map((c: any) => {
              const meta = CONNECTOR_META[c.name] ?? {
                icon: "/globe.svg",
                type: c.auth_type === "api_key" ? "apikey" : "oauth",
                fallbackLabel: c.label ?? c.name,
              };
              return {
                id: c.name,
                name: c.label ?? meta.fallbackLabel,
                icon: meta.icon,
                type: meta.type,
              };
            }),
          );
        } else {
          Object.entries(data).forEach(([k, v]: any) => {
            map[k] = { connected: v.connected ?? v };
          });
          setConnectors(
            Object.keys(data).map((name) => {
              const meta = CONNECTOR_META[name] ?? {
                icon: "/globe.svg",
                type: "oauth" as const,
                fallbackLabel: name,
              };
              return {
                id: name,
                name: meta.fallbackLabel,
                icon: meta.icon,
                type: meta.type,
              };
            }),
          );
        }
        setStatus(map);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleConnect = async (provider: string) => {
    setConnecting(provider);
    setError(null);
    try {
      const res = await authorizeConnection(provider);
      if (!res.ok) {
        const errText = await res.text().catch(() => "Unknown error");
        setError(`Failed to connect ${provider}: ${errText}`);
        return;
      }
      const data = await res.json();
      // Redirect to OAuth consent screen
      window.location.href = data.authorization_url ?? data.url ?? data;
    } catch (err: any) {
      setError(`Failed to connect ${provider}: ${err.message || err}`);
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (provider: string) => {
    await disconnectConnection(provider);
    setStatus(prev => ({ ...prev, [provider]: { connected: false } }));
  };

  const handleApiKey = async (provider: string) => {
    const key = apiKeyInputs[provider];
    if (!key) return;
    await saveApiKeyConnection(provider, key);
    setStatus(prev => ({ ...prev, [provider]: { connected: true } }));
    setApiKeyInputs(prev => ({ ...prev, [provider]: "" }));
    setShowApiKey(prev => ({ ...prev, [provider]: false }));
  };

  const handleTest = async (provider: string) => {
    const res = await testConnection(provider);
    const ok = res.ok;
    setStatus(prev => ({ ...prev, [provider]: { ...prev[provider], tested: ok } }));
  };

  if (loading) return (
    <div className="flex h-full items-center justify-center text-white/40 text-sm">
      Loading connectors...
    </div>
  );

  const oauthConnectors = connectors.filter(c => c.type === "oauth");
  const apikeyConnectors = connectors.filter(c => c.type === "apikey");

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">Connectors</h1>
      <p className="text-white/40 text-sm mb-8">
        Connect your accounts so Orphic can act on your behalf.
      </p>

      {/* Error banner */}
      {error && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-4 text-red-400/60 hover:text-red-400">✕</button>
        </div>
      )}

      {/* OAuth Section */}
      <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
        OAuth Accounts
      </p>
      <div className="grid grid-cols-3 gap-3 mb-8">
        {oauthConnectors.map((c) => {
          const s = status[c.id];
          const isConnected = s?.connected;
          const isConnecting = connecting === c.id;
          return (
            <div key={c.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3 min-h-[56px]">
              <div className="flex items-center gap-2 min-w-0">
                <img src={c.icon} className="size-5 object-contain shrink-0" alt={c.name} />
                <span className="text-sm text-white font-medium truncate">{c.name}</span>
              </div>
              <button
                onClick={() => isConnected ? handleDisconnect(c.id) : handleConnect(c.id)}
                disabled={isConnecting}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-lg border transition-colors shrink-0 ml-2 disabled:opacity-50",
                  isConnected
                    ? "border-red-500/30 text-red-400 hover:border-red-500/30 hover:text-red-400 hover:bg-red-500/10"
                    : "border-white/20 text-white/70 hover:bg-white/10"
                )}
              >
                {isConnecting ? (
                  <span className="flex items-center gap-1.5">
                    <span className="size-3 animate-spin rounded-full border border-white/30 border-t-white" />
                  </span>
                ) : isConnected ? "Disconnect" : "Connect"}
              </button>
            </div>
          );
        })}
      </div>

      {/* API Key Section */}
      <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
        API Keys
      </p>
      <div className="grid grid-cols-3 gap-3 mb-8">
        {apikeyConnectors.map((c) => {
          const isConnected = status[c.id]?.connected;
          const showInput = showApiKey[c.id];
          return (
            <div key={c.id} className="flex flex-col bg-white/5 border border-white/10 rounded-xl px-4 py-3 gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src={c.icon} className="size-5 object-contain" alt={c.name} />
                  <span className="text-sm text-white font-medium">{c.name}</span>
                  {isConnected && (
                    <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                      Connected
                    </span>
                  )}
                </div>
                <button
                  onClick={() => isConnected
                    ? handleDisconnect(c.id)
                    : setShowApiKey(prev => ({ ...prev, [c.id]: !showInput }))
                  }
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-lg border transition-colors",
                    isConnected
                      ? "border-red-500/30 text-red-400 hover:bg-red-500/10"
                      : "border-white/20 text-white/70 hover:bg-white/10"
                  )}
                >
                  {isConnected ? "Disconnect" : showInput ? "Cancel" : "Add Key"}
                </button>
              </div>
              {showInput && (
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder={`Paste your ${c.name} API key`}
                    value={apiKeyInputs[c.id] ?? ""}
                    onChange={e => setApiKeyInputs(prev => ({ ...prev, [c.id]: e.target.value }))}
                    className="w-full max-w-md bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/30"
                  />
                  <button
                    onClick={() => handleApiKey(c.id)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
                  >
                    Save
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
