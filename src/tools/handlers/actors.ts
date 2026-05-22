/**
 * @fileoverview Actor management tool handlers
 *
 * Handles searching for actors and retrieving detailed actor information.
 */

import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import type { FoundryClient } from '../../foundry/client.js';
import { withToolError } from './utils.js';

/**
 * Handles actor search requests
 */
export async function handleSearchActors(
  args: {
    query?: string;
    type?: string;
    limit?: number;
  },
  foundryClient: FoundryClient,
) {
  const { query, type, limit = 10 } = args;

  return withToolError('search actors', async () => {
    const searchParams: { query: string; type?: string; limit: number } = {
      query: query || '',
      limit,
    };
    if (type) {
      searchParams.type = type;
    }
    const result = await foundryClient.searchActors(searchParams);

    const actorList = result.actors
      .map(
        (actor) =>
          `- **${actor.name}** (${actor.type}) - Level ${actor.level || 'Unknown'} - HP: ${actor.hp?.value || 'Unknown'}/${actor.hp?.max || 'Unknown'} - ID: \`${actor._id}\``,
      )
      .join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `🎭 **Actor Search Results**
**Query:** ${query || 'All actors'}
**Type Filter:** ${type || 'All types'}
**Results:** ${result.actors.length}/${result.total} total

${actorList || 'No actors found matching the criteria.'}

**Page:** ${result.page} | **Limit:** ${result.limit}`,
        },
      ],
    };
  });
}

/** Helper to extract a nested value from a Record<string, unknown> safely */
function dig(obj: Record<string, unknown>, ...keys: string[]): unknown {
  let cur: unknown = obj;
  for (const k of keys) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

/**
 * Handles detailed actor information requests — uses getRawActor for full PF2e data
 */
export async function handleGetActorDetails(
  args: {
    actorId: string;
  },
  foundryClient: FoundryClient,
) {
  const { actorId } = args;

  if (!actorId || typeof actorId !== 'string') {
    throw new McpError(ErrorCode.InvalidParams, 'Actor ID is required and must be a string');
  }

  return withToolError('get actor details', async () => {
    const raw = foundryClient.getRawActor(actorId);
    if (!raw) {
      throw new McpError(ErrorCode.InvalidParams, `Actor ${actorId} not found`);
    }

    const sys = raw.system;

    // ── Basic stats ─────────────────────────────────────────────────────────
    const level = num(dig(sys, 'details', 'level', 'value')) ?? num(dig(sys, 'details', 'cr')) ?? '?';
    const hpVal = num(dig(sys, 'attributes', 'hp', 'value')) ?? '?';
    const hpMax = num(dig(sys, 'attributes', 'hp', 'max')) ?? '?';
    const ac = num(dig(sys, 'attributes', 'ac', 'value')) ?? num(dig(sys, 'attributes', 'ac', 'base')) ?? '?';

    // ── Speed ────────────────────────────────────────────────────────────────
    const speedLand = num(dig(sys, 'attributes', 'speed', 'value'));
    const otherSpeeds = (dig(sys, 'attributes', 'speed', 'otherSpeeds') as Array<{type: string; value: number}> | undefined) ?? [];
    const speedParts: string[] = [];
    if (speedLand !== undefined) speedParts.push(`${speedLand} ft`);
    for (const s of otherSpeeds) {
      if (s?.type && s?.value) speedParts.push(`${s.type} ${s.value} ft`);
    }
    const speedStr = speedParts.length ? speedParts.join(', ') : '?';

    // ── Saving throws ────────────────────────────────────────────────────────
    const saves = dig(sys, 'saves') as Record<string, unknown> | undefined;
    const saveStr = saves
      ? Object.entries(saves)
          .map(([k, v]) => {
            const mod = num(dig(v as Record<string, unknown>, 'value'));
            return mod !== undefined ? `${k} ${mod >= 0 ? '+' : ''}${mod}` : null;
          })
          .filter(Boolean)
          .join(' | ')
      : '?';

    // ── Perception ───────────────────────────────────────────────────────────
    const percMod = num(dig(sys, 'perception', 'mod')) ?? num(dig(sys, 'attributes', 'perception', 'value'));
    const percStr = percMod !== undefined ? `${percMod >= 0 ? '+' : ''}${percMod}` : '?';

    // ── Resistances / immunities ─────────────────────────────────────────────
    const resistances = (dig(sys, 'attributes', 'resistances') as Array<{type: string; value: number}> | undefined) ?? [];
    const immunities = (dig(sys, 'traits', 'di', 'value') as string[] | undefined) ??
                       (dig(sys, 'attributes', 'immunities') as string[] | undefined) ?? [];
    const weaknesses = (dig(sys, 'attributes', 'weaknesses') as Array<{type: string; value: number}> | undefined) ?? [];

    // ── Abilities (PF2e stores mods directly) ────────────────────────────────
    const abilityObj = dig(sys, 'abilities') as Record<string, unknown> | undefined;
    const abilityStr = abilityObj
      ? Object.entries(abilityObj)
          .map(([k, v]) => {
            const mod = num(dig(v as Record<string, unknown>, 'mod'));
            return mod !== undefined ? `${k.toUpperCase()} ${mod >= 0 ? '+' : ''}${mod}` : null;
          })
          .filter(Boolean)
          .join(' | ')
      : '(not available)';

    // ── Spell item lookup map (id → item) ────────────────────────────────────
    const spellItems = (raw.items ?? []).filter((i) => i.type === 'spell');
    const spellById = new Map(spellItems.map((sp) => [sp._id, sp]));

    /** Format a single spell item for display */
    function fmtSpell(sp: (typeof spellItems)[0]): string {
      const spSys = sp.system;
      const spLevel = num(dig(spSys, 'level', 'value')) ?? '?';
      const actions = str(dig(spSys, 'time', 'value')) ?? str(dig(spSys, 'cast', 'value')) ?? '?';
      const range = str(dig(spSys, 'range', 'value')) ?? '';
      const area = dig(spSys, 'area') as Record<string, unknown> | null | undefined;
      const areaStr =
        area?.value && area?.areaType
          ? `${area.value}-ft ${area.areaType}`
          : area?.value
            ? `${area.value}-ft area`
            : '';
      const traits = (dig(spSys, 'traits', 'value') as string[] | undefined)?.join(', ') ?? '';
      const meta = [range && `range: ${range}`, areaStr && `area: ${areaStr}`, traits && `[${traits}]`]
        .filter(Boolean)
        .join(' ');
      return `**${sp.name}** (rank ${spLevel}, ${actions}⬛)${meta ? ` ${meta}` : ''}`;
    }

    // ── Strikes / attacks ────────────────────────────────────────────────────
    const strikeItems = (raw.items ?? []).filter(
      (i) => i.type === 'melee' || i.type === 'ranged' || i.type === 'weapon',
    );
    const strikeLines = strikeItems.map((s) => {
      const atkBonus =
        str(dig(s.system, 'bonus', 'value')) ??
        num(dig(s.system, 'bonus', 'value'))?.toString() ??
        '?';
      const dmgRolls = dig(s.system, 'damageRolls') as
        | Record<string, { damage: string; damageType: string }>
        | undefined;
      const dmgStr = dmgRolls
        ? Object.values(dmgRolls)
            .map((d) => `${d.damage} ${d.damageType}`)
            .join(' + ')
        : '?';
      const traits = (dig(s.system, 'traits', 'value') as string[] | undefined)?.join(', ') ?? '';
      return `  • **${s.name}** +${atkBonus} — ${dmgStr}${traits ? ` [${traits}]` : ''}`;
    });

    // ── Spell slots — read from prepared[].expended, not the legacy value field ──
    const spellcasting = (raw.items ?? []).filter((i) => i.type === 'spellcastingEntry');
    const slotLines: string[] = [];

    // Focus points pool
    const focusVal = num(dig(sys, 'resources', 'focus', 'value'));
    const focusMax = num(dig(sys, 'resources', 'focus', 'max'));

    for (const entry of spellcasting) {
      const entSys = entry.system;
      const tradition = str(dig(entSys, 'tradition', 'value')) ?? '';
      const preparedType = str(dig(entSys, 'prepared', 'value')) ?? '';
      const isFocus = preparedType === 'focus';
      const spellDC = num(dig(entSys, 'spelldc', 'dc')) ?? '?';
      const spellAtk = num(dig(entSys, 'spelldc', 'value'));
      const atkStr = spellAtk !== undefined ? ` attack: +${spellAtk}` : '';

      slotLines.push(
        `  • **${entry.name}** (${tradition}${isFocus ? ' focus' : ''}) DC ${spellDC}${atkStr}`,
      );

      if (isFocus) {
        // Focus spells are listed separately; just show pool size
        if (focusVal !== undefined && focusMax !== undefined) {
          slotLines.push(`    Focus points: ${focusVal}/${focusMax}`);
        }
        // List focus spells assigned to this entry
        const focusSpells = spellItems.filter(
          (sp) => (dig(sp.system, 'location', 'value') as string) === entry._id,
        );
        for (const fs of focusSpells) {
          slotLines.push(`    • ${fmtSpell(fs)}`);
        }
        continue;
      }

      // Prepared / spontaneous entry — iterate real slot arrays
      const slots = dig(entSys, 'slots') as
        | Record<string, { prepared?: Array<{ id: string; expended: boolean }>; max: number }>
        | undefined;
      if (!slots) continue;

      for (let rank = 0; rank <= 10; rank++) {
        const slotKey = `slot${rank}`;
        const slotData = slots[slotKey];
        if (!slotData || !slotData.prepared?.length) continue;

        const rankLabel = rank === 0 ? 'Cantrips' : `Rank ${rank}`;
        const entries = slotData.prepared.map((p) => {
          const sp = spellById.get(p.id);
          const name = sp?.name ?? `(unknown ${p.id.slice(0, 6)})`;
          return p.expended ? `~~${name}~~ ❌` : `${name} ✅`;
        });
        const ready = slotData.prepared.filter((p) => !p.expended).length;
        const total = slotData.prepared.length;
        slotLines.push(`    ${rankLabel} (${ready}/${total} ready): ${entries.join(', ')}`);
      }
    }

    const lines: string[] = [
      `🎭 **${raw.name}** (${raw.type})`,
      `**Level:** ${level} | **HP:** ${hpVal}/${hpMax} | **AC:** ${ac}`,
      `**Speed:** ${speedStr}`,
      `**Perception:** ${percStr}`,
      '',
      `**Saves:** ${saveStr}`,
      `**Abilities:** ${abilityStr}`,
    ];

    if (immunities.length) lines.push(`**Immunities:** ${immunities.join(', ')}`);
    if (resistances.length) lines.push(`**Resistances:** ${resistances.map((r) => `${r.type} ${r.value}`).join(', ')}`);
    if (weaknesses.length) lines.push(`**Weaknesses:** ${weaknesses.map((w) => `${w.type} ${w.value}`).join(', ')}`);

    if (strikeLines.length) {
      lines.push('', '**⚔️ Strikes:**');
      lines.push(...strikeLines);
    }

    if (slotLines.length) {
      lines.push('', '**🔮 Spellcasting:**');
      lines.push(...slotLines);
    }

    return {
      content: [{ type: 'text', text: lines.join('\n') }],
    };
  });
}
