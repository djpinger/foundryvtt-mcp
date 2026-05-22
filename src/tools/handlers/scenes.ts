/**
 * @fileoverview Scene management tool handlers
 *
 * Handles scene information retrieval and management.
 */

import type { FoundryClient } from '../../foundry/client.js';
import { withToolError } from './utils.js';

// ── Shared geometry helpers ───────────────────────────────────────────────────

/** Euclidean distance in feet between two grid-square positions. */
function distanceFt(
  ax: number, ay: number,
  bx: number, by: number,
  ftPerSquare: number,
): number {
  const dx = (bx - ax) * ftPerSquare;
  const dy = (by - ay) * ftPerSquare;
  return Math.round(Math.sqrt(dx * dx + dy * dy) / ftPerSquare) * ftPerSquare;
}

/** Counter-clockwise turn test — used for segment intersection. */
function ccw(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): boolean {
  return (cy - ay) * (bx - ax) > (by - ay) * (cx - ax);
}

/** Returns true if segment A→B intersects segment C→D. */
function segmentsIntersect(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): boolean {
  return (
    ccw(ax, ay, cx, cy, dx, dy) !== ccw(bx, by, cx, cy, dx, dy) &&
    ccw(ax, ay, bx, by, cx, cy) !== ccw(ax, ay, bx, by, dx, dy)
  );
}

// ── Wall parsing ──────────────────────────────────────────────────────────────

type EdgeType = 'wall' | 'door-closed' | 'door-open' | 'door-locked';

function hEdgeStr(type: EdgeType): string {
  switch (type) {
    case 'wall':        return '─────';
    case 'door-closed': return '──D──';
    case 'door-open':   return '──d──';
    case 'door-locked': return '──L──';
  }
}

function vEdgeChar(type: EdgeType): string {
  switch (type) {
    case 'wall':        return '│';
    case 'door-closed': return 'D';
    case 'door-open':   return 'd';
    case 'door-locked': return 'L';
  }
}

/**
 * Parse raw scene walls into grid-snapped edge maps for ASCII rendering.
 * Axis-aligned walls snap to grid boundaries; diagonal walls are skipped for
 * the map but still available via the raw scene data for LoS checks.
 */
function parseWalls(
  walls: Array<Record<string, unknown>>,
  gridSize: number,
): { hEdgeMap: Map<string, EdgeType>; vEdgeMap: Map<string, EdgeType> } {
  const hEdgeMap = new Map<string, EdgeType>(); // "col,row" → wall above row
  const vEdgeMap = new Map<string, EdgeType>(); // "col,row" → wall left of col

  for (const wall of walls) {
    const c = wall.c as [number, number, number, number] | undefined;
    if (!c) continue;
    const [wx1, wy1, wx2, wy2] = c;

    const blocksSight = (wall.sight as number) !== 0;
    const blocksMove  = (wall.move  as number) !== 0;
    if (!blocksSight && !blocksMove) continue;

    const isDoor    = (wall.door as number) > 0;
    const ds        = wall.ds as number;
    const edgeType: EdgeType = isDoor
      ? (ds === 2 ? 'door-locked' : ds === 1 ? 'door-open' : 'door-closed')
      : 'wall';

    const gx1 = wx1 / gridSize;
    const gy1 = wy1 / gridSize;
    const gx2 = wx2 / gridSize;
    const gy2 = wy2 / gridSize;

    const isH = Math.abs(gy1 - gy2) < 0.35;
    const isV = Math.abs(gx1 - gx2) < 0.35;

    if (isH && !isV) {
      const gy   = Math.round((gy1 + gy2) / 2);
      const gxLo = Math.floor(Math.min(gx1, gx2));
      const gxHi = Math.ceil(Math.max(gx1, gx2));
      for (let gc = gxLo; gc < gxHi; gc++) {
        hEdgeMap.set(`${gc},${gy}`, edgeType);
      }
    } else if (isV && !isH) {
      const gx   = Math.round((gx1 + gx2) / 2);
      const gyLo = Math.floor(Math.min(gy1, gy2));
      const gyHi = Math.ceil(Math.max(gy1, gy2));
      for (let gr = gyLo; gr < gyHi; gr++) {
        vEdgeMap.set(`${gx},${gr}`, edgeType);
      }
    }
  }

  return { hEdgeMap, vEdgeMap };
}

// ── Combat positions ──────────────────────────────────────────────────────────

/**
 * Handles combat position requests:
 *   • ASCII battle map with walls/doors overlaid
 *   • Alliance-grouped legend
 *   • Pairwise distance table with cross-alliance markers
 */
export async function handleGetCombatPositions(
  args: { sceneId?: string },
  foundryClient: FoundryClient,
) {
  return withToolError('get combat positions', async () => {
    // Use raw WorldScene (has tokens + walls) rather than the stripped FoundryScene
    const scenes = foundryClient.getScenes();
    const rawScene = (args.sceneId
      ? scenes.find((s) => s._id === args.sceneId)
      : scenes.find((s) => s.active)) as Record<string, unknown> | undefined;

    if (!rawScene) {
      return {
        content: [{
          type: 'text',
          text: args.sceneId ? `Scene not found: ${args.sceneId}` : 'No active scene.',
        }],
      };
    }

    const scene     = await foundryClient.getCurrentScene(args.sceneId);
    const tokens    = (rawScene.tokens ?? []) as Array<Record<string, unknown>>;
    const walls     = (rawScene.walls  ?? []) as Array<Record<string, unknown>>;
    const gridData  = rawScene.grid as Record<string, unknown> | undefined;
    const gridSize  = (gridData?.size     as number | undefined) ?? 100;
    const ftPerSquare = (gridData?.distance as number | undefined) ?? 5;

    // Fast token lookup by _id (unique per instance)
    const tokenById = new Map<string, Record<string, unknown>>();
    for (const t of tokens) {
      if (t._id) tokenById.set(t._id as string, t);
    }

    // Parse walls for map rendering
    const { hEdgeMap, vEdgeMap } = parseWalls(walls, gridSize);

    // ── Alliance resolution ─────────────────────────────────────────────────
    function allianceLabel(actor: Record<string, unknown> | undefined, disposition: unknown): string {
      const details = (actor?.system as Record<string, unknown> | undefined)
        ?.details as Record<string, unknown> | undefined;
      const pf2e = details?.alliance as string | undefined;
      if (pf2e === 'party')      return 'Party';
      if (pf2e === 'opposition') return 'Opposition';
      if (pf2e === 'neutral')    return 'Neutral';
      switch (disposition) {
        case  1: return 'Party';
        case  0: return 'Neutral';
        case -1: return 'Opposition';
        default: return 'Unknown';
      }
    }

    function allianceGlyph(alliance: string): string {
      switch (alliance) {
        case 'Party':      return 'P';
        case 'Opposition': return 'E';
        case 'Neutral':    return 'N';
        default:           return '?';
      }
    }

    // ── Resolve combatants ──────────────────────────────────────────────────
    const combat = foundryClient.getCombatState() as unknown as Record<string, unknown> | null;
    const combatants = (combat?.combatants as Array<Record<string, unknown>> | undefined) ?? [];

    type CombatantInfo = {
      name: string; abbr: string;
      gridX: number; gridY: number;
      hp: string; initiative: number | null;
      defeated: boolean; current: boolean; alliance: string;
    };

    const located: CombatantInfo[] = [];
    const missing: string[] = [];

    const sorted = [...combatants].sort(
      (a, b) => ((b.initiative as number) ?? -999) - ((a.initiative as number) ?? -999),
    );

    sorted.forEach((c, i) => {
      const tokenId = c.tokenId as string | undefined;
      const actorId = c.actorId as string | undefined;

      const token = (tokenId && tokenById.get(tokenId)) ||
        tokens.find((t) => t.actorId === actorId && !t.hidden);

      const actor = actorId
        ? (foundryClient.getRawActor(actorId) as Record<string, unknown> | undefined)
        : undefined;
      const name =
        (c.name as string | undefined) ||
        (actor?.name as string | undefined) ||
        `Combatant${i + 1}`;

      const attrs  = (actor?.system as Record<string, unknown> | undefined)
        ?.attributes as Record<string, unknown> | undefined;
      const hpData = attrs?.hp as { value?: number; max?: number } | undefined;
      const hp     = hpData ? `${hpData.value ?? '?'}/${hpData.max ?? '?'}` : '?/?';

      const alliance = allianceLabel(actor, token?.disposition);

      if (token) {
        const defeated = c.defeated as boolean;
        const nameAbbr = name.replace(/['"]/g, '').replace(/\s+/g, '').slice(0, 2);
        const abbr     = defeated ? 'xxx' : `${allianceGlyph(alliance)}${nameAbbr}`;

        located.push({
          name, abbr,
          gridX: Math.floor((token.x as number) / gridSize),
          gridY: Math.floor((token.y as number) / gridSize),
          hp, initiative: c.initiative as number | null,
          defeated, current: combat?.turn === i, alliance,
        });
      } else {
        missing.push(name);
      }
    });

    if (located.length === 0) {
      return {
        content: [{ type: 'text', text: 'No combatants with visible tokens found on the active scene.' }],
      };
    }

    // ── ASCII battle map with walls ─────────────────────────────────────────
    const xs = located.map((c) => c.gridX);
    const ys = located.map((c) => c.gridY);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    // Expand bounds by 1 so walls on the edges are visible
    const mapMinX = minX - 1;
    const mapMaxX = maxX + 1;
    const mapMinY = minY - 1;
    const mapMaxY = maxY + 1;

    // Cell map (deduplicated abbrs per position)
    const cellMap = new Map<string, string[]>();
    located.forEach((c) => {
      const key = `${c.gridX},${c.gridY}`;
      const existing = cellMap.get(key) ?? [];
      if (!existing.includes(c.abbr)) existing.push(c.abbr);
      cellMap.set(key, existing);
    });

    // Each slot = 5 chars: [left-border:1][content:3][pad:1]
    const SLOT = 5;
    const rowPfx = (label: string) => label.padStart(4) + ' '; // 5 chars
    const colCount = mapMaxX - mapMinX + 1;

    const header = '     ' + Array.from({ length: colCount }, (_, i) =>
      String(mapMinX + i).padStart(SLOT)
    ).join('');

    const mapLines: string[] = [header];

    for (let row = mapMinY; row <= mapMaxY + 1; row++) {
      // Horizontal separator (walls above this row)
      const hSlots = Array.from({ length: colCount }, (_, ci) => {
        const col = mapMinX + ci;
        const et  = hEdgeMap.get(`${col},${row}`);
        return et ? hEdgeStr(et) : '     ';
      });
      if (hSlots.some((s) => s.trim())) {
        mapLines.push('     ' + hSlots.join(''));
      }
      if (row > mapMaxY) break;

      // Cell content row
      const cellSlots = Array.from({ length: colCount }, (_, ci) => {
        const col   = mapMinX + ci;
        const vType = vEdgeMap.get(`${col},${row}`);
        const left  = vType ? vEdgeChar(vType) : ' ';
        const cell  = cellMap.get(`${col},${row}`);
        const txt   = (cell ? cell.join('+') : '.').slice(0, 3).padEnd(3);
        return left + txt + ' '; // 1+3+1 = 5
      });
      mapLines.push(rowPfx(String(row)) + cellSlots.join(''));
    }

    const mapKey =
      'Walls/Doors: │─ solid  D closed  d open  L locked  |  P=Party E=Enemy N=Neutral xxx=Defeated';
    const asciiMap = [...mapLines, '', mapKey].join('\n');

    // ── Legend (grouped by alliance) ────────────────────────────────────────
    const allianceOrder = ['Party', 'Neutral', 'Opposition', 'Unknown'];
    const byAlliance    = new Map<string, CombatantInfo[]>();
    for (const a of allianceOrder) byAlliance.set(a, []);
    located.forEach((c) => {
      (byAlliance.get(c.alliance) ?? byAlliance.get('Unknown')!).push(c);
    });

    const legend = allianceOrder
      .filter((a) => (byAlliance.get(a)?.length ?? 0) > 0)
      .map((a) => {
        const entries = byAlliance.get(a)!.map((c) => {
          const cur  = c.current  ? ' ◄ CURRENT' : '';
          const def  = c.defeated ? ' [DEFEATED]' : '';
          const init = c.initiative !== null ? `[${c.initiative}]` : '[?]';
          return `    ${c.abbr} = ${c.name} ${init} HP:${c.hp} (${c.gridX},${c.gridY})${cur}${def}`;
        });
        return [`  ── ${a} ──`, ...entries].join('\n');
      })
      .join('\n');

    // ── Distance table ───────────────────────────────────────────────────────
    const active = located.filter((c) => !c.defeated);
    const seen   = new Set<string>();
    const unique = active.filter((c) => {
      const key = `${c.name}|${c.gridX}|${c.gridY}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const pairs: Array<{ a: string; b: string; dist: number; crossAlliance: boolean }> = [];
    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        const a = unique[i]!;
        const b = unique[j]!;
        pairs.push({
          a: a.name, b: b.name,
          dist: distanceFt(a.gridX, a.gridY, b.gridX, b.gridY, ftPerSquare),
          crossAlliance: a.alliance !== b.alliance,
        });
      }
    }
    pairs.sort((a, b) => a.dist - b.dist);

    const adjacent = pairs.filter((p) => p.dist <= ftPerSquare);
    const close    = pairs.filter((p) => p.dist > ftPerSquare && p.dist <= 30);
    const far      = pairs.filter((p) => p.dist > 30);

    const fmtPair = (p: { a: string; b: string; dist: number; crossAlliance: boolean }) =>
      `  ${p.crossAlliance ? '⚔️ ' : '  '}${p.a} ↔ ${p.b}: ${p.dist} ft`;

    const distSection = [
      adjacent.length ? `**Adjacent (≤${ftPerSquare}ft / melee reach):**\n${adjacent.map(fmtPair).join('\n')}` : '',
      close.length    ? `**Close (≤30ft):**\n${close.map(fmtPair).join('\n')}`                                  : '',
      far.length      ? `**Far (>30ft):**\n${far.map(fmtPair).join('\n')}`                                       : '',
    ].filter(Boolean).join('\n\n');

    const missingNote = missing.length
      ? `\n\n⚠️ No visible token found for: ${missing.join(', ')}`
      : '';

    return {
      content: [{
        type: 'text',
        text:
          `🗺️ **Battle Map — ${scene.name}** (grid: ${ftPerSquare}ft/sq)\n\n` +
          `\`\`\`\n${asciiMap}\n\`\`\`\n\n` +
          `**Legend** (col, row):\n${legend}\n\n` +
          `**Distances:**\n${distSection}` +
          missingNote,
      }],
    };
  });
}

// ── Line-of-sight checker ─────────────────────────────────────────────────────

/**
 * Checks line of sight between two named combatants in the active combat.
 * Uses exact pixel-space segment intersection against all sight-blocking walls.
 * Open doors are treated as transparent.
 */
export async function handleCheckLineOfSight(
  args: { combatantA: string; combatantB: string; sceneId?: string },
  foundryClient: FoundryClient,
) {
  return withToolError('check line of sight', async () => {
    const scenes = foundryClient.getScenes();
    const rawScene = (args.sceneId
      ? scenes.find((s) => s._id === args.sceneId)
      : scenes.find((s) => s.active)) as Record<string, unknown> | undefined;

    if (!rawScene) {
      return { content: [{ type: 'text', text: 'No active scene.' }] };
    }

    const tokens  = (rawScene.tokens ?? []) as Array<Record<string, unknown>>;
    const walls   = (rawScene.walls  ?? []) as Array<Record<string, unknown>>;
    const gridData = rawScene.grid as Record<string, unknown> | undefined;
    const gridSize = (gridData?.size     as number | undefined) ?? 100;
    const ftPerSquare = (gridData?.distance as number | undefined) ?? 5;

    const tokenById = new Map<string, Record<string, unknown>>();
    for (const t of tokens) {
      if (t._id) tokenById.set(t._id as string, t);
    }

    const combat     = foundryClient.getCombatState() as unknown as Record<string, unknown> | null;
    const combatants = (combat?.combatants as Array<Record<string, unknown>> | undefined) ?? [];

    /** Find a combatant by partial case-insensitive name match and return pixel-center + display name. */
    function findCombatant(query: string): {
      name: string; px: number; py: number; gridX: number; gridY: number;
    } | null {
      const q = query.toLowerCase();
      const c = combatants.find((cb) => {
        const actorId = cb.actorId as string | undefined;
        const actor   = actorId
          ? (foundryClient.getRawActor(actorId) as Record<string, unknown> | undefined)
          : undefined;
        const n = ((cb.name as string | undefined) || (actor?.name as string | undefined) || '').toLowerCase();
        return n.includes(q);
      });
      if (!c) return null;

      const tokenId = c.tokenId as string | undefined;
      const actorId = c.actorId as string | undefined;
      const token   = (tokenId && tokenById.get(tokenId)) ||
        tokens.find((t) => t.actorId === actorId);
      if (!token) return null;

      const actor   = actorId
        ? (foundryClient.getRawActor(actorId) as Record<string, unknown> | undefined)
        : undefined;
      const name    = (c.name as string | undefined) || (actor?.name as string | undefined) || query;
      const w       = ((token.width  as number | undefined) ?? 1) * gridSize;
      const h       = ((token.height as number | undefined) ?? 1) * gridSize;
      const px      = (token.x as number) + w / 2;
      const py      = (token.y as number) + h / 2;

      return { name, px, py, gridX: Math.floor(px / gridSize), gridY: Math.floor(py / gridSize) };
    }

    const a = findCombatant(args.combatantA);
    const b = findCombatant(args.combatantB);

    if (!a) return { content: [{ type: 'text', text: `❓ Could not find combatant matching: "${args.combatantA}"` }] };
    if (!b) return { content: [{ type: 'text', text: `❓ Could not find combatant matching: "${args.combatantB}"` }] };

    // Check every sight-blocking wall for intersection with the A→B line
    const blockingWalls: string[] = [];
    const openDoors: string[]     = [];

    for (const wall of walls) {
      const c2 = wall.c as [number, number, number, number] | undefined;
      if (!c2) continue;

      const blocksSight = (wall.sight as number) !== 0;
      if (!blocksSight) continue;

      const isDoor = (wall.door as number) > 0;
      const isOpen = (wall.ds  as number) === 1;

      // Open doors don't block LoS
      if (isDoor && isOpen) {
        if (segmentsIntersect(a.px, a.py, b.px, b.py, c2[0], c2[1], c2[2], c2[3])) {
          openDoors.push(`open door at (${(c2[0] / gridSize).toFixed(1)},${(c2[1] / gridSize).toFixed(1)})`);
        }
        continue;
      }

      if (segmentsIntersect(a.px, a.py, b.px, b.py, c2[0], c2[1], c2[2], c2[3])) {
        const type  = isDoor ? 'Door' : 'Wall';
        const isLocked = (wall.ds as number) === 2;
        const state = isDoor ? (isLocked ? ' [locked]' : ' [closed]') : '';
        blockingWalls.push(
          `${type}${state} from (${(c2[0] / gridSize).toFixed(1)},${(c2[1] / gridSize).toFixed(1)}) to (${(c2[2] / gridSize).toFixed(1)},${(c2[3] / gridSize).toFixed(1)})`,
        );
      }
    }

    const dist   = distanceFt(a.gridX, a.gridY, b.gridX, b.gridY, ftPerSquare);
    const hasLoS = blockingWalls.length === 0;

    const openNote = openDoors.length
      ? `\n\n✅ Passes through ${openDoors.length} open door(s) — no obstruction:\n${openDoors.map((d) => `  • ${d}`).join('\n')}`
      : '';

    const result = hasLoS
      ? `✅ **${a.name}** has line of sight to **${b.name}**\n` +
        `   Distance: ${dist} ft  |  Positions: (${a.gridX},${a.gridY}) → (${b.gridX},${b.gridY})` +
        openNote
      : `❌ **${a.name}** does NOT have line of sight to **${b.name}**\n` +
        `   Distance: ${dist} ft  |  Positions: (${a.gridX},${a.gridY}) → (${b.gridX},${b.gridY})\n\n` +
        `**Blocked by (${blockingWalls.length}):**\n` +
        blockingWalls.map((w) => `  • ${w}`).join('\n');

    return { content: [{ type: 'text', text: result }] };
  });
}

// ── Scene info ────────────────────────────────────────────────────────────────

/**
 * Handles scene information requests
 */
export async function handleGetSceneInfo(
  args: { sceneId?: string },
  foundryClient: FoundryClient,
) {
  const { sceneId } = args;

  return withToolError('get scene info', async () => {
    const scene = await foundryClient.getCurrentScene(sceneId);

    return {
      content: [{
        type: 'text',
        text: `🗺️ **Scene Information**
**Name:** ${scene.name}
**ID:** ${scene._id}
**Active:** ${scene.active ? 'Yes' : 'No'}
**Navigation:** ${scene.navigation ? 'Enabled' : 'Disabled'}
**Dimensions:** ${scene.width} x ${scene.height} pixels
**Padding:** ${scene.padding * 100}%
**Global Light:** ${scene.globalLight ? 'Enabled' : 'Disabled'}
**Darkness Level:** ${scene.darkness * 100}%

**Description:** ${scene.description || 'No description available.'}`,
      }],
    };
  });
}
