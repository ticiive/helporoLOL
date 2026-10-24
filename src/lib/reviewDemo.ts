/** Partida de exemplo (sintética) pra prévia sem o cliente: mesma estrutura que a API local devolve. */
export function demoGame() {
  // Soraka, Sejuani, Swain, Caitlyn, Ornn x Thresh, Lee Sin, Ahri, Jinx, Sett (ids do Data Dragon)
  const champs = [16, 113, 50, 51, 516, 412, 64, 103, 222, 875];
  const roles = ["UTILITY", "JUNGLE", "MIDDLE", "BOTTOM", "TOP"];
  const parts = champs.map((c, i) => ({ participantId: i + 1, championId: c, teamId: i < 5 ? 100 : 200,
    timeline: { lane: roles[i % 5] }, stats: i === 0 ? { kills: 1, deaths: 5, assists: 24, visionScore: 62, win: true } : { kills: i < 5 ? 8 : 5, deaths: 4, assists: 6 } }));
  return { gameId: 1, gameDuration: 31 * 60, participants: parts, participantIdentities: parts.map((p) => ({ participantId: p.participantId, player: { gameName: p.participantId === 1 ? "ticiive" : `p${p.participantId}` } })) };
}
export function demoTimeline() {
  const frames = [] as { participantFrames: Record<string, { position: { x: number; y: number } }>; events: unknown[] }[];
  const lane: Record<number, [number, number]> = { 1: [11500, 1500], 2: [4000, 7500], 3: [7200, 7200], 4: [11800, 1300], 5: [1200, 11500], 6: [13500, 3300], 7: [10800, 7400], 8: [7700, 7700], 9: [13400, 3500], 10: [3400, 13500] };
  for (let m = 0; m <= 31; m++) {
    const pf: Record<string, { position: { x: number; y: number } }> = {};
    for (let pid = 1; pid <= 10; pid++) {
      const [x, y] = lane[pid]; const j = Math.sin(m * 1.3 + pid) * 900;
      pf[pid] = { position: { x: Math.max(300, Math.min(14500, x + j)), y: Math.max(300, Math.min(14500, y - j)) } };
    }
    if (m === 11) pf[1] = { position: { x: 9300, y: 5000 } };
    if (m === 15) pf[1] = { position: { x: 4800, y: 10200 } };
    frames.push({ participantFrames: pf, events: [] });
  }
  const kill = (t: number, killer: number, victim: number, assists: number[], x: number, y: number) => frames[Math.floor(t / 60)].events.push({ type: "CHAMPION_KILL", timestamp: t * 1000, killerId: killer, victimId: victim, assistingParticipantIds: assists, position: { x, y } });
  kill(662, 8, 1, [7], 9500, 4900);
  kill(922, 8, 1, [], 4700, 10300);
  frames[16].events.push({ type: "ELITE_MONSTER_KILL", timestamp: 975000, killerId: 7, monsterType: "RIFTHERALD" });
  kill(1300, 2, 8, [1, 3], 7600, 7600);
  kill(1500, 9, 4, [10], 12000, 2000);
  kill(1720, 6, 1, [7, 8, 10], 9800, 8200);
  return { frames };
}
