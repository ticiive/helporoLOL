import { Component, type ReactNode } from "react";
import { checkUpdate, installUpdate } from "./lib/updater";

/** Se algo quebrar na tela, mostra o erro em vez de deixar tudo em branco, com saída pelo próprio app. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { err: Error | null; msg: string }> {
  state = { err: null as Error | null, msg: "" };
  static getDerivedStateFromError(err: Error) { return { err, msg: "" }; }

  reset = () => {
    try { Object.keys(localStorage).filter((k) => k.startsWith("helporo.") && !k.startsWith("helporo.games.")).forEach((k) => localStorage.removeItem(k)); } catch { /* sem storage */ }
    location.reload();
  };

  update = async () => {
    this.setState({ msg: "Procurando atualização..." });
    const u = await checkUpdate();
    if (!u) { this.setState({ msg: "Nenhuma atualização nova agora." }); return; }
    this.setState({ msg: `Instalando ${u.version}...` });
    try { await installUpdate(u); } catch (e) { this.setState({ msg: `Falhou: ${String(e)}` }); }
  };

  render() {
    if (!this.state.err) return this.props.children;
    const b = { padding: "10px 16px", marginRight: 8, borderRadius: 8, border: 0, cursor: "pointer", fontWeight: 600 } as const;
    return (
      <div style={{ padding: 32, fontFamily: "system-ui", color: "#e8e6e3", background: "#0f1115", minHeight: "100vh" }}>
        <h2>O helporoLOL encontrou um erro</h2>
        <p>Seus jogos salvos ficam guardados. "Limpar ajustes" apaga só configurações e cache.</p>
        <pre style={{ whiteSpace: "pre-wrap", background: "#1a1d24", padding: 12, borderRadius: 8 }}>{String(this.state.err?.stack || this.state.err)}</pre>
        <button style={{ ...b, background: "#c89b3c" }} onClick={this.reset}>Limpar ajustes e recarregar</button>
        <button style={{ ...b, background: "#3c7bc8", color: "#fff" }} onClick={this.update}>Procurar atualização</button>
        <p>{this.state.msg}</p>
      </div>
    );
  }
}
