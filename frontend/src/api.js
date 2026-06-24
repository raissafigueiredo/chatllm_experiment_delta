const API_BASE = window.location.origin;

function normalizeHistory(history) {
  return Array.isArray(history)
    ? history.map((item) => ({ role: item.role, content: item.content }))
    : [];
}

async function sendMessageStream({ message, history, onDelta, signal }) {
  const response = await fetch(`${API_BASE}/api/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "text/event-stream",
    },
    body: JSON.stringify({ message, history: normalizeHistory(history) }),
    signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = body?.detail || "Erro ao enviar mensagem para o servidor.";
    throw new Error(detail);
  }

  if (!response.body) {
    throw new Error("Streaming nao suportado no ambiente atual.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: true });
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() || "";

    for (const rawEvent of events) {
      const line = rawEvent
        .split(/\r?\n/)
        .map((part) => part.trim())
        .find((part) => part.startsWith("data:"));
      if (!line) continue;

      const payloadText = line.slice(5).trim();
      if (!payloadText || payloadText === "[DONE]") continue;

      let payload;
      try {
        payload = JSON.parse(payloadText);
      } catch {
        continue;
      }

      if (payload.error) {
        throw new Error(payload.error);
      }

      if (typeof payload.delta === "string" && payload.delta) {
        onDelta(payload.delta);
      }
    }

    if (done) break;
  }

  if (buffer.trim()) {
    const payloadText = buffer.trim();
    if (payloadText !== "[DONE]") {
      try {
        const payload = JSON.parse(payloadText);
        if (payload.error) {
          throw new Error(payload.error);
        }
        if (typeof payload.delta === "string" && payload.delta) {
          onDelta(payload.delta);
        }
      } catch {
        // ignore malformed leftover buffer
      }
    }
  }
}

async function sendMessage({ message, history }) {
  const response = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history: normalizeHistory(history) }),
  });

  if (!response.ok) {
    const body = await response.json().catch(async () => ({ detail: await response.text().catch(() => null) }));
    const detail = body?.detail || "Erro ao enviar mensagem para o servidor.";
    throw new Error(detail);
  }

  const data = await response.json();
  if (!data?.reply) {
    throw new Error("Resposta do servidor invalida.");
  }

  return data.reply;
}

// Auth functions
async function register(email, password) {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = body?.detail || "Erro ao registrar usuário.";
    throw new Error(detail);
  }

  return await response.json();
}

async function login(email, password) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = body?.detail || "Erro ao fazer login.";
    throw new Error(detail);
  }

  return await response.json();
}

async function logout() {
  const response = await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error("Erro ao fazer logout.");
  }

  return await response.json();
}

async function getCurrentUser(token) {
  const response = await fetch(`${API_BASE}/auth/me`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Erro ao obter usuário atual.");
  }

  return await response.json();
}
