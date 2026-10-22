import { useMemo, useRef, useState } from "react";
import { iconUrl, norm, type Catalog, type Champ } from "../lib/ddragon";
import { TAG_TEXT } from "../engine/champions";

const CLASS_COLOR = (f: string) =>
  f.includes("R") ? "var(--c-support)" : f.includes("X") ? "var(--c-assassin)" : f.includes("F") && !f.includes("A") ? "var(--c-tank)"
  : f.includes("F") ? "var(--c-fighter)" : f.includes("Y") || (f.includes("A") && !f.includes("M")) ? "var(--c-mark)" : f.includes("P") ? "var(--c-mage)" : "var(--c-fighter)";

export function Icon({ cat, champ, size = 44, ring }: { cat: Catalog; champ: Champ | null; size?: number; ring?: string }) {
  const url = champ ? iconUrl(cat, champ) : "";
  const border = ring ?? (champ ? CLASS_COLOR(champ.flags) : "var(--line)");
  return (
    <div className="ava" style={{ width: size, height: size, borderColor: border }}>
      {url ? <img src={url} alt="" draggable={false} /> : <span>{champ ? champ.name.slice(0, 2).toUpperCase() : ""}</span>}
    </div>
  );
}

interface Props { id: string; label: string; cat: Catalog; value: string | null; onChange: (v: string | null) => void; disabled?: boolean; side: "a" | "e" }

export function ChampInput({ id, label, cat, value, onChange, disabled, side }: Props) {
  const champ = value ? cat.byName.get(norm(value)) ?? null : null;
  const [text, setText] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  const q = text ?? "";
  const matches = useMemo(() => {
    const n = norm(q);
    if (!n) return [];
    return cat.list.filter((c) => norm(c.name).startsWith(n)).concat(cat.list.filter((c) => !norm(c.name).startsWith(n) && norm(c.name).includes(n))).slice(0, 7);
  }, [q, cat]);

  const pick = (c: Champ | null) => { onChange(c ? c.name : null); setText(null); setOpen(false); ref.current?.blur(); };
  const tags = champ ? [...champ.flags].map((c) => TAG_TEXT[c]).filter(Boolean).slice(0, 3).join(" · ") : "";

  return (
    <div className={`slot ${side === "e" ? "enemy" : ""}`}>
      <Icon cat={cat} champ={champ} />
      <div className="slot-body">
        <label htmlFor={id}>{label}<span className="fl">{tags}</span></label>
        <input
          id={id} ref={ref} disabled={disabled} autoComplete="off" spellCheck={false} placeholder="vazio"
          value={text ?? champ?.name ?? value ?? ""}
          onFocus={() => { setText(""); setOpen(true); setHi(0); }}
          onBlur={() => setTimeout(() => { setOpen(false); setText(null); }, 120)}
          onChange={(e) => { setText(e.target.value); setOpen(true); setHi(0); if (!e.target.value) onChange(null); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { setHi((h) => Math.min(h + 1, matches.length - 1)); e.preventDefault(); }
            else if (e.key === "ArrowUp") { setHi((h) => Math.max(h - 1, 0)); e.preventDefault(); }
            else if (e.key === "Enter" && matches[hi]) pick(matches[hi]);
            else if (e.key === "Escape") { setText(null); ref.current?.blur(); }
            else if (e.key === "Backspace" && !q && value) pick(null);
          }}
        />
        {open && matches.length > 0 && (
          <ul className="menu" role="listbox">
            {matches.map((c, i) => (
              <li key={c.name} role="option" aria-selected={i === hi} onMouseDown={(e) => { e.preventDefault(); pick(c); }} onMouseEnter={() => setHi(i)}>
                <Icon cat={cat} champ={c} size={26} /> {c.name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
