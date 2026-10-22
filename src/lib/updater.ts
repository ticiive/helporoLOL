/** Atualização do app pelo GitHub Releases (plugin oficial do Tauri, com assinatura). */
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type Pending = Update;

export async function checkUpdate(): Promise<Pending | null> {
  try {
    return await check();
  } catch {
    return null; // sem internet ou sem release com atualização: tenta na próxima abertura
  }
}

export async function installUpdate(u: Pending) {
  await u.downloadAndInstall();
  await relaunch();
}
