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
        <p className="note">Mesma rede Wi-Fi do PC. Aponte a câmera pro QR ou digite o endereço; salve nos favoritos, ele não muda.</p>
        {img && <img className="qr" src={img} alt={`QR code de ${url}`} />}
        <code className="addr">{url}</code>
        {urls.length > 1 && (
          <button className="link" onClick={() => setWhich(which ? 0 : 1)}>
            {which ? "Usar o endereço fixo (helporo.local)" : "Não abriu? Use o IP deste PC"}
          </button>
        )}
        <p className="note">O endereço helporo.local funciona no iPhone, no Mac e no Windows. Em alguns Android ele não abre: aí use o IP. Se o IP vive mudando, fixe o IP do PC no roteador (reserva de DHCP).</p>
      </div>
    </div>
  );
}
