import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Endereço da página ao vivo: o fixo (helporo.local) e o IP, com QR code pra abrir no celular apontando a câmera. */
export function PhoneLink({ urls, onClose }: { urls: string[]; onClose: () => void }) {
  const [which, setWhich] = useState(0);
  const [img, setImg] = useState("");
  const url = urls[which] ?? urls[0] ?? "";
  useEffect(() => { if (url) QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: "#0a0f16", light: "#ffffff" } }).then(setImg).catch(() => setImg("")); }, [url]);
  return (
    <div className="modal" role="dialog" aria-label="Abrir no celular" onClick={onClose}>
      <div className="mbox phone" onClick={(e) => e.stopPropagation()}>
        <div className="dhead"><b>Coach ao vivo no celular ou no Mac</b><button className="ghost" onClick={onClose}>Fechar</button></div>
        <p className="note">Aponte a câmera do celular pro QR e salve a página nos favoritos (ou na tela inicial). Funciona em qualquer rede, até no 4G: o app manda a partida pela internet.</p>
        {img && <img className="qr" src={img} alt={`QR code de ${url}`} />}
        <code className="addr">{url}</code>
        {urls.length > 1 && (
          <button className="link" onClick={() => setWhich((which + 1) % urls.length)}>
            {which === 0 ? "Prefiro pela rede de casa (sem internet)" : "Voltar pro link da internet"}
          </button>
        )}
        <p className="note">O link é secreto e só deste PC. Vão pro canal só campeões, níveis, feitiços, itens, tempo de partida, objetivos e as dicas; nenhum nome de jogador.</p>
      </div>
    </div>
  );
}
