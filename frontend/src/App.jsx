const { useEffect, useMemo, useRef, useState } = React;

const SESSION_STORAGE_KEY = "chatllm_lab_sessions";
const ACTIVE_SESSION_STORAGE_KEY = "chatllm_lab_active_session_id";

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createSession(title = "Nova sessão", messages = []) {
  return { id: createMessageId(), title, messages };
}

function deriveSessionTitle(text) {
  const raw = String(text || "").trim();
  if (!raw) return "Nova sessão";

  const normalized = raw.replace(/\s+/g, " ").trim();
  const firstSentence = normalized.split(/[.?!]/)[0].trim();
  const subjectMatch = firstSentence.match(/sobre\s+(.+)$/i);
  let subject = subjectMatch ? subjectMatch[1] : firstSentence.replace(/^(?:pergunta |pergunte |como |por que |porquê |qual |quais |o que |me explique |explique |me mostre |diga |faça )/i, "").trim();

  if (!subject) {
    subject = firstSentence;
  }

  subject = subject.replace(/\s+/g, " ").trim();
  subject = subject.charAt(0).toUpperCase() + subject.slice(1);
  if (subject.length > 40) {
    subject = `${subject.slice(0, 40).trim()}...`;
  }

  return `Chat sobre ${subject}`;
}

function isAutoSessionTitle(title) {
  const value = String(title || "").trim().toLowerCase();
  return (
    value === "nova sessão" ||
    value === "sessão inicial" ||
    value === "sessao inicial" ||
    value === "nova sessao" ||
    value === ""
  );
}

function loadSessionsFromStorage() {
  try {
    const text = window.localStorage.getItem(SESSION_STORAGE_KEY);
    const activeId = window.localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    if (!text) return null;

    const sessions = JSON.parse(text);
    if (!Array.isArray(sessions) || sessions.length === 0) return null;

    return {
      sessions,
      activeSessionId: activeId && sessions.some((session) => session.id === activeId)
        ? activeId
        : sessions[0].id,
    };
  } catch {
    return null;
  }
}

function App() {
  const saved = typeof window !== "undefined" ? loadSessionsFromStorage() : null;
  const initialSessions =
    saved?.sessions ||
    [
      createSession("Sessão inicial", [
        {
          id: createMessageId(),
          role: "assistant",
          content: "Bem-vindo ao ChatLLM Lab. Como posso ajudar voce hoje?",
        },
      ]),
    ];

  const [sessions, setSessions] = useState(initialSessions);
  const [activeSessionId, setActiveSessionId] = useState(
    saved?.activeSessionId || initialSessions[0].id
  );
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const messagesRef = useRef(null);
  const abortControllerRef = useRef(null);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) || sessions[0],
    [sessions, activeSessionId]
  );

  const chatHistory = useMemo(
    () => activeSession.messages.filter((msg) => msg.role === "user" || msg.role === "assistant"),
    [activeSession.messages]
  );

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeSession.messages]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const updateSessionById = (id, updater) => {
    setSessionsAndPersist((prev) => prev.map((session) => (session.id === id ? updater(session) : session)));
  };

  const updateActiveSession = (updater) => updateSessionById(activeSessionId, updater);

  const persistSessions = (nextSessions, nextActiveSessionId) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSessions));
    window.localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, nextActiveSessionId);
  };

  const setSessionsAndPersist = (updater, nextActiveId = activeSessionId) => {
    setSessions((prev) => {
      const nextSessions = typeof updater === "function" ? updater(prev) : updater;
      persistSessions(nextSessions, nextActiveId);
      return nextSessions;
    });
  };

  const setActiveSessionIdAndPersist = (id) => {
    setActiveSessionId(id);
    persistSessions(sessions, id);
  };

  const onCreateSession = () => {
    const session = createSession();
    setSessionsAndPersist((prev) => [session, ...prev], session.id);
    setActiveSessionId(session.id);
    setText("");
    setError("");
  };

  const onSelectSession = (id) => {
    setActiveSessionIdAndPersist(id);
    setError("");
  };

  const onClearHistory = () => {
    const initial = [
      createSession("Sessão inicial", [
        {
          id: createMessageId(),
          role: "assistant",
          content: "Bem-vindo ao ChatLLM Lab. Como posso ajudar voce hoje?",
        },
      ]),
    ];

    setSessionsAndPersist(initial, initial[0].id);
    setActiveSessionId(initial[0].id);
    setText("");
    setError("");
  };

  const onStop = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setBusy(false);
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    const cleaned = text.trim();
    if (!cleaned || busy) return;

    setError("");

    const userMessage = { id: createMessageId(), role: "user", content: cleaned };
    const assistantMessageId = createMessageId();
    const sessionId = activeSessionId;

    updateSessionById(sessionId, (session) => ({
      ...session,
      messages: [
        ...session.messages,
        userMessage,
        { id: assistantMessageId, role: "assistant", content: "" },
      ],
    }));

    setText("");
    setBusy(true);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      await sendMessageStream({
        message: cleaned,
        history: chatHistory,
        signal: abortController.signal,
        onDelta: (delta) => {
          updateSessionById(sessionId, (session) => ({
            ...session,
            messages: session.messages.map((msg) =>
              msg.id === assistantMessageId ? { ...msg, content: `${msg.content}${delta}` } : msg
            ),
          }));
        },
      });

      updateSessionById(sessionId, (session) => ({
        ...session,
        messages: session.messages.map((msg) =>
          msg.id === assistantMessageId && !msg.content.trim()
            ? { ...msg, content: "Nao foi possivel obter resposta do modelo agora." }
            : msg
        ),
      }));

      if (isAutoSessionTitle(activeSession.title)) {
        const newTitle = deriveSessionTitle(cleaned);
        if (newTitle !== "Nova sessão") {
          updateActiveSession((session) => ({ ...session, title: newTitle }));
        }
      }
    } catch (err) {
      const aborted = err?.name === "AbortError";
      if (!aborted) {
        setError(err.message || "Falha inesperada ao gerar resposta.");
        updateSessionById(sessionId, (session) => ({
          ...session,
          messages: session.messages.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: msg.content.trim()
                    ? msg.content
                    : "Nao foi possivel obter resposta do modelo agora.",
                }
              : msg
          ),
        }));
      } else {
        updateSessionById(sessionId, (session) => ({
          ...session,
          messages: session.messages.map((msg) =>
            msg.id === assistantMessageId && !msg.content.trim()
              ? { ...msg, content: "Resposta interrompida." }
              : msg
          ),
        }));
      }
    } finally {
      abortControllerRef.current = null;
      setBusy(false);
    }
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div>Sessões</div>
          <div className="sidebar-actions">
            <button type="button" onClick={onCreateSession}>
              +
            </button>
            <button type="button" className="clear-history" onClick={onClearHistory}>
              Limpar
            </button>
          </div>
        </div>

        <div className="session-list">
          {sessions.map((session) => (
            <button
              key={session.id}
              type="button"
              className={`session-item ${session.id === activeSessionId ? "active" : ""}`}
              onClick={() => onSelectSession(session.id)}
            >
              <span>{session.title}</span>
              <span className="session-badge">{session.messages.length}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="chat-panel">
        <header className="app-header">
          <div className="brand">ChatLLM Lab</div>
          <div className="session-title">{activeSession.title}</div>
        </header>

        <section className="messages" aria-live="polite" ref={messagesRef}>
          <div className="messages-inner">
            {activeSession.messages.map((msg) => (
              <article key={msg.id} className={`bubble ${msg.role}`}>
                <MessageContent content={msg.content} />
              </article>
            ))}
          </div>
        </section>

        <Composer
          text={text}
          busy={busy}
          error={error}
          onChangeText={setText}
          onSubmit={onSubmit}
          onStop={onStop}
        />

        <div className="warning-banner">Lembre-se, você precisa focar no experimento!!!</div>
      </section>
    </main>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);

