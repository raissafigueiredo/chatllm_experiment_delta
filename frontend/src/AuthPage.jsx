const { useState, useEffect } = React;

function AuthPage({ onLoginSuccess }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Email e senha são obrigatórios");
      return;
    }

    setLoading(true);

    try {
      const data = mode === "login" ? await login(email, password) : await register(email, password);

      console.debug("Auth response:", data);

      if (mode === "register") {
        setError("");
        setMode("login");
        setEmail("");
        setPassword("");
      } else {
        localStorage.setItem("authToken", data.access_token);
        localStorage.setItem("user", JSON.stringify(data.user));
        onLoginSuccess(data.user);
        // Fallback: force reload so a routing/render state is ensured
        try {
          window.location.reload();
        } catch (e) {
          /* ignore */
        }
      }
    } catch (err) {
      setError(err.message || "Erro ao processar requisição");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-container">
        <h1>ChatLLM Lab</h1>

        <form className="auth-form" onSubmit={handleSubmit}>
          <h2>{mode === "login" ? "Entrar" : "Criar Conta"}</h2>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? "Carregando..." : mode === "login" ? "Entrar" : "Criar Conta"}
          </button>

          <div className="auth-footer">
            {mode === "login" ? (
              <>
                Não tem conta?{" "}
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    setMode("register");
                    setError("");
                  }}
                >
                  Cadastre-se
                </button>
              </>
            ) : (
              <>
                Já tem conta?{" "}
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    setMode("login");
                    setError("");
                  }}
                >
                  Faça login
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}
