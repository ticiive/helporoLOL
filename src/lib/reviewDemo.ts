/** Partida de exemplo (sintética) pra prévia sem o cliente: mesma estrutura que a API local devolve.
 * Roteiro: o time sai na frente, perde uma luta no meio sem a sup, entrega dragões e Barão e perde. */
export function demoGame() {
  // Soraka, Sejuani, Swain, Caitlyn, Ornn x Thresh, Lee Sin, Ahri, Jinx, Sett (ids do Data Dragon)
  const champs = [16, 113, 50, 51, 516, 412, 64, 103, 222, 875];
  const roles = [["BOTTOM", "DUO_SUPPORT"], ["JUNGLE", "NONE"], ["MIDDLE", "SOLO"], ["BOTTOM", "DUO_CARRY"], ["TOP", "SOLO"]];
  const kda = [[1, 6, 14], [4, 6, 8], [3, 7, 6], [6, 5, 5], [2, 7, 4], [2, 3, 20], [6, 4, 14], [12, 3, 9], [8, 5, 10], [3, 4, 9]];
  const dmg = [7000, 16000, 14000, 22000, 9000, 9000, 18000, 31000, 26000, 15000];
  const parts = champs.map((c, i) => ({ participantId: i + 1, championId: c, teamId: i < 5 ? 100 : 200,
    spell1Id: i % 5 === 1 ? 11 : 4, spell2Id: i % 5 === 0 ? 3 : 14,
    timeline: { lane: roles[i % 5][0], role: roles[i % 5][1] },
    stats: { kills: kda[i][0], deaths: kda[i][1], assists: kda[i][2], win: i >= 5, item0: i % 5 === 0 ? 3869 : 0,
      totalDamageDealtToChampions: dmg[i], visionScore: i === 0 ? 38 : 20, visionWardsBoughtInGame: i === 0 ? 2 : 1,
      totalMinionsKilled: i % 5 === 0 ? 30 : 190, neutralMinionsKilled: i % 5 === 1 ? 150 : 5 } }));
  return { gameId: 1, gameDuration: 31 * 60, participants: parts, participantIdentities: parts.map((p) => ({ participantId: p.participantId, player: { gameName: p.participantId === 1 ? "ticiive" : `p${p.participantId}` } })) };
}
export function demoTimeline() {
  const frames = [] as { participantFrames: Record<string, { position: { x: number; y: number } }>; events: unknown[] }[];
  const lane: Record<number, [number, number]> = { 1: [11500, 1500], 2: [4000, 7500], 3: [7200, 7200], 4: [11800, 1300], 5: [1200, 11500], 6: [13500, 3300], 7: [10800, 7400], 8: [7700, 7700], 9: [13400, 3500], 10: [3400, 13500] };
  // ouro: azul na frente até os 17, depois o vermelho dispara; o mid azul perde a lane
  const gold = (pid: number, m: number) => {
    const blue = pid <= 5, base = 500 + m * 340;
    const swing = m <= 17 ? m * 35 : 17 * 35 - (m - 17) * 120;
    const mid = pid === 3 ? -Math.min(m, 15) * 90 : pid === 8 ? Math.min(m, 15) * 60 : 0;
    return Math.round(base + (blue ? swing : -swing) + mid);
  };
  for (let m = 0; m <= 31; m++) {
    const pf: Record<string, { position: { x: number; y: number } }> = {};
    for (let pid = 1; pid <= 10; pid++) {
      const [x, y] = lane[pid]; const j = Math.sin(m * 1.3 + pid) * 900;
      pf[pid] = { position: { x: Math.max(300, Math.min(14500, x + j)), y: Math.max(300, Math.min(14500, y - j)) }, totalGold: gold(pid, m), level: Math.min(18, 1 + Math.floor(m / (pid === 3 ? 1.9 : 1.6))) } as never;
    }
    if (m === 11) pf[1] = { ...pf[1], position: { x: 9300, y: 5000 } };
    if (m === 15) pf[1] = { ...pf[1], position: { x: 4800, y: 10200 } };
    frames.push({ participantFrames: pf, events: [] });
  }
  const ev = (t: number, e: object) => frames[Math.min(31, Math.floor(t / 60))].events.push({ timestamp: t * 1000, ...e });
  const kill = (t: number, killer: number, victim: number, assists: number[], x: number, y: number) => ev(t, { type: "CHAMPION_KILL", killerId: killer, victimId: victim, assistingParticipantIds: assists, position: { x, y } });
  const mon = (t: number, killer: number, team: number, type: string) => ev(t, { type: "ELITE_MONSTER_KILL", killerId: killer, killerTeamId: team, monsterType: type });
  kill(300, 4, 9, [1], 12500, 2200); kill(420, 2, 6, [1, 4], 11000, 3000);
  kill(410, 8, 3, [7], 7400, 7400); kill(662, 8, 1, [7], 9500, 4900); kill(800, 8, 3, [], 7100, 7000);
  kill(922, 8, 1, [], 4700, 10300);
  mon(330, 2, 100, "DRAGON"); mon(975, 7, 200, "RIFTHERALD"); mon(990, 7, 200, "DRAGON");
  for (const t of [70, 150, 260, 400, 560, 700, 820, 1000, 1150, 1400, 1600]) ev(t, { type: "WARD_PLACED", creatorId: 1, wardType: t % 400 === 0 ? "CONTROL_WARD" : "YELLOW_TRINKET" });
  ev(430, { type: "WARD_KILL", killerId: 1 });
  kill(1300, 2, 8, [1, 3], 7600, 7600);
  // luta perdida no rio aos 18:30, a sup morre primeiro, dragão deles logo depois
  kill(1110, 6, 1, [7], 9700, 5100); kill(1114, 8, 4, [6, 9], 9800, 5000); kill(1118, 7, 3, [8], 9600, 5300); kill(1121, 9, 2, [10], 9900, 4900); kill(1125, 4, 9, [], 9800, 5000);
  mon(1170, 7, 200, "DRAGON");
  kill(1500, 9, 4, [10], 12000, 2000); kill(1580, 10, 5, [], 2500, 9500);
  // luta do Barão
  kill(1720, 6, 1, [7, 8, 10], 9800, 8200); kill(1724, 8, 2, [7], 5200, 10300); kill(1727, 9, 3, [8], 5100, 10400); kill(1731, 7, 4, [], 5000, 10500);
  mon(1780, 7, 200, "BARON_NASHOR"); mon(1500, 7, 200, "DRAGON");
  for (const t of [600, 1200, 1250, 1800, 1830]) ev(t, { type: "BUILDING_KILL", teamId: 100, buildingType: "TOWER_BUILDING" });
  ev(840, { type: "BUILDING_KILL", teamId: 200, buildingType: "TOWER_BUILDING" });
  return { frames };
}
