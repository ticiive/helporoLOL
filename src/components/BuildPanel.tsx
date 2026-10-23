import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Role } from "../engine/engine";
import { activeConditions, itemIcon, runeIcon, shardName, spellIcon, type Build, type Names } from "../lib/builds";
import { inTauri } from "../lib/lcu";

interface Props { champ: string; role: Role; build: Build | undefined; names: Names | null; enemies: string[]; flags: (n: string) => string }

function Item({ id, names, label }: { id: number; names: Names | null; label?: string }) {
  const name = names?.items.get(id) ?? `Item ${id}`;
  return (
    <div className="bitem" title={name}>
      {names ? <img src={itemIcon(names.version, id)} alt="" /> : <span className="ph" />}
      <span>{label ?? name}</span>
    </div>
  );
}

export function BuildPanel({ champ, role, build, names, enemies, flags }: Props) {
  const [msg, setMsg] = useState("");
  if (!build) return <p className="note">Ainda sem dados de runas e build pra {champ} nessa rota. Eles aparecem conforme a coleta junta partidas Mestre+ desse campeão.</p>;
  const r = build.runas;
  const rn = (id: number) => names?.runes.get(id);
  const active = activeConditions(enemies, flags);
  const situ = build.situacionais.filter((s) => active.has(s.cond));
  const other = build.situacionais.filter((s) => !active.has(s.cond)).slice(0, 3);

  const exportRunes = async () => {
    setMsg("Enviando…");
    try {
      await invoke("set_rune_page", { name: `helporo ${champ}`, primary: r.primaria, sub: r.secundaria, perks: [...r.perks, ...r.fragmentos] });
      setMsg("Página de runas criada no cliente.");
    } catch (e) {
      setMsg(String(e).includes("fechado") ? "Abra o cliente do LoL pra exportar." : `Não deu pra criar a página: ${String(e).slice(0, 120)}`);
    }
  };

  return (
    <div className="build">
      <div className="bhead">
        <span className="lbl">Runas e build de {champ} ({role})</span>
        <span className="note">{build.fonte === "opgg" ? `op.gg, Esmeralda+ (provisório) · ${build.wr}%` : `${build.jogos.toLocaleString("pt-BR")} jogos Mestre+ · ${build.wr}%`}</span>
      </div>
      <div className="runes">
        {[r.primaria, ...r.perks.slice(0, 4)].map((id, i) => id > 0 && rn(id) && (
          <img key={`p${i}`} className={i === 1 ? "key" : ""} src={runeIcon(rn(id)!.icon)} title={rn(id)!.name} alt={rn(id)!.name} />
        ))}
        <span className="sep" />
        {[r.secundaria, ...r.perks.slice(4)].map((id, i) => rn(id) && <img key={`s${i}`} src={runeIcon(rn(id)!.icon)} title={rn(id)!.name} alt={rn(id)!.name} />)}
      </div>
      <p className="note">{rn(r.perks[0])?.name ?? ""} · {r.fragmentos.map(shardName).join(" · ")} · página com {r.wr}% em {r.jogos} jogos</p>
      {inTauri() && <button className="ghost" onClick={exportRunes}>Exportar runas pro cliente</button>}
      {msg && <p className="note">{msg}</p>}

      <div className="lbl">Feitiços</div>
      <div className="brow">
        {build.feiticos.map((id) => { const s = names?.spells.get(id); return s && names ? <div key={id} className="bitem"><img src={spellIcon(names.version, s.img)} alt="" /><span>{s.name}</span></div> : null; })}
      </div>
      <div className="lbl">Build principal</div>
      <div className="brow">
        {build.item_sup && <Item id={build.item_sup} names={names} />}
        {build.core.map((id) => <Item key={id} id={id} names={names} />)}
        {build.botas && <Item id={build.botas} names={names} />}
      </div>
      {build.extras && build.extras.length > 0 && (<>
        <div className="lbl">Outros itens comuns</div>
        <div className="brow">{build.extras.map((id) => <Item key={id} id={id} names={names} />)}</div>
      </>)}
      {build.fonte !== "opgg" && <div className="lbl">Situacionais pra esse draft</div>}
      {build.fonte === "opgg" ? null : situ.length ? (
        <div className="situ">{situ.map((s) => <div key={s.item + s.cond}><Item id={s.item} names={names} /><span className="note">{s.quando}: {s.wr}% com o item ({s.ganho > 0 ? "+" : ""}{s.ganho} pts, {s.jogos} jogos)</span></div>)}</div>
      ) : <p className="note">Nada fora do comum nesse draft: vai na build principal.</p>}
      {other.length > 0 && (
        <details><summary className="note">Outras situações</summary>
          <div className="situ">{other.map((s) => <div key={s.item + s.cond}><Item id={s.item} names={names} /><span className="note">{s.quando} (+{s.ganho} pts)</span></div>)}</div>
        </details>
      )}
    </div>
  );
}
