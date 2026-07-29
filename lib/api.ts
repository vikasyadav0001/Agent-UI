const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TOKEN_COOKIE_NAMES = ["scalekit_token", "orphic_auth"];
const TOKEN_STORAGE_KEYS = ["orphic_token", "auth_token", "access_token"];

// Helper to get token for API requests
export const getToken = () => {
  if (typeof document === "undefined") return null;

  for (const cookieName of TOKEN_COOKIE_NAMES) {
    const match = document.cookie.match(new RegExp(`(^| )${cookieName}=([^;]+)`));
    if (match) return decodeURIComponent(match[2]);
  }

  try {
    for (const storageKey of TOKEN_STORAGE_KEYS) {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) return stored;
    }
  } catch {
    // Storage can be unavailable in some browser contexts.
  }

  return null;
};

// Helper to get standard headers
export const getHeaders = (): Record<string, string> => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const persistAuthToken = (token: string) => {
  if (typeof document !== "undefined") {
    document.cookie = `orphic_auth=${encodeURIComponent(token)}; path=/; max-age=${60 * 60 * 24 * 7}`;
  }

  try {
    window.localStorage.setItem("orphic_token", token);
  } catch {
    // Storage can be unavailable in some browser contexts.
  }
};

export const clearAuthToken = () => {
  if (typeof document !== "undefined") {
    document.cookie = "orphic_auth=; path=/; max-age=0";
    document.cookie = "scalekit_token=; path=/; max-age=0";
  }

  try {
    TOKEN_STORAGE_KEYS.forEach((storageKey) => window.localStorage.removeItem(storageKey));
  } catch {
    // Storage can be unavailable in some browser contexts.
  }
};

// ==========================================
// AUTH ENDPOINTS
// ==========================================

export const register = (email: string, password: string) => {
  return fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
};

export const login = (email: string, password: string) => {
  const form = new URLSearchParams();
  form.append("username", email);
  form.append("password", password);

  return fetch(`${API}/auth/jwt/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    credentials: "include", // needed if backend sets HTTPOnly cookie
  });
};

export const logout = () => {
  return fetch(`${API}/auth/jwt/logout`, {
    method: "POST",
    headers: getHeaders(),
    credentials: "include",
  });
};

// ==========================================
// CHAT ENDPOINTS
// ==========================================

export const chatStream = (formData: FormData, abortSignal?: AbortSignal) => {
  return fetch(`${API}/chat/stream`, {
    method: "POST",
    headers: getHeaders(),
    body: formData,
    signal: abortSignal,
  });
};

export const chatResume = (
  sessionId: string,
  resumeBody: {
    interrupt_id: string;
    decision: "connected" | "approve" | "reject" | "cancel" | "skip" | "submit";
    input?: Record<string, unknown>;
  },
  abortSignal?: AbortSignal
) => {
  return fetch(`${API}/chat/resume/${sessionId}`, {
    method: "POST",
    headers: { ...getHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(resumeBody),
    signal: abortSignal,
  });
};

// ==========================================
// CONVERSATION ENDPOINTS
// ==========================================

export const getConversations = () => {
  return fetch(`${API}/api/v1/conversations/`, {
    headers: getHeaders(),
  });
};

export const createConversation = (title: string = "New Chat") => {
  return fetch(`${API}/api/v1/conversations/`, {
    method: "POST",
    headers: { ...getHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
};

export const getConversationMessages = (threadId: string) => {
  return fetch(`${API}/api/v1/conversations/${threadId}/messages`, {
    headers: getHeaders(),
  });
};

export const renameConversation = (threadId: string, title: string) => {
  return fetch(`${API}/api/v1/conversations/${threadId}`, {
    method: "PATCH",
    headers: { ...getHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
};

export const deleteConversation = (threadId: string) => {
  return fetch(`${API}/api/v1/conversations/${threadId}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
};

// ==========================================
// CONNECTION ENDPOINTS
// ==========================================

export const getConnections = () => {
  return fetch(`${API}/connections/`, {
    headers: getHeaders(),
  });
};

// NEW: only providers the user has active connections for
export const getConnectedProviders = () => {
  return fetch(`${API}/connections/connected`, {
    headers: getHeaders(),
  });
};

export const authorizeConnection = (provider: string, sessionId?: string) => {
  const qs = sessionId ? `?session_id=${sessionId}` : "";
  return fetch(`${API}/connections/${provider}/authorize${qs}`, {
    headers: getHeaders(),
  });
};

export const disconnectConnection = (provider: string) => {
  return fetch(`${API}/connections/${provider}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
};

export const saveApiKeyConnection = (provider: string, apiKey: string) => {
  return fetch(`${API}/connections/${provider}/apikey`, {
    method: "POST",
    headers: { ...getHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey }),
  });
};

export const testConnection = (provider: string) => {
  return fetch(`${API}/connections/${provider}/test`, {
    headers: getHeaders(),
  });
};

// ==========================================
// UTILITY ENDPOINTS
// ==========================================

export const healthCheck = () => {
  return fetch(`${API}/health`);
};
