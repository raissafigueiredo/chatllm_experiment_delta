const { useEffect, useRef } = React;

function Composer({ text, busy, error, onChangeText, onSubmit, onStop }) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (!busy) {
      inputRef.current?.focus();
    }
  }, [busy]);

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(event, inputRef);
  };

  const handleStop = () => {
    onStop();
    inputRef.current?.focus();
  };

  return (
    <div className="composer-wrap">
      {error && <div className="note error">{error}</div>}
      <form className="composer" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          value={text}
          onChange={(event) => onChangeText(event.target.value)}
          placeholder="Mensagem para ChatLLM Lab"
          maxLength={8000}
          disabled={busy}
          autoFocus
        />
        <button
          type={busy ? "button" : "submit"}
          onClick={busy ? handleStop : undefined}
          disabled={!busy && !text.trim()}
          aria-label={busy ? "Parar" : "Enviar"}
        >
          {busy ? (
            <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor" aria-hidden="true">
              <rect x="0" y="0" width="13" height="13" rx="2.5" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="8" y1="13" x2="8" y2="3" />
              <polyline points="4,7 8,3 12,7" />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}
