/**
 * @fileoverview Scene management tool handlers
 *
 * Handles scene information retrieval and management.
 */

import type { FoundryClient } from '../../foundry/client.js';
import { withToolError } from './utils.js';

const DISPOSITION_LABELS: Record<number, string> = {
  [-2]: 'Secret',
  [-1]: 'Hostile',
  [0]: 'Neutral',
  [1]: 'Friendly',
};

// PF2e stores alliance on the actor rather than using token disposition.
// "party" = party member, "opposition" = enemy, null = neutral/context-dependent.
function resolveAlliance(actor: { type: string; system: Record<string, unknown> } | null, disposition: number): string {
  if (actor) {
    if (actor.type === 'familiar') return 'Party';
    const details = actor.system.details as Record<string, unknown> | undefined;
    if (details && 'alliance' in details) {
      const alliance = details.alliance;
      if (alliance === 'party') return 'Party';
      if (alliance === 'opposition') return 'Opposition';
      if (alliance === null) return 'Neutral';
    }
  }
  return DISPOSITION_LABELS[disposition] ?? 'Unknown';
}

/**
 * Handles scene information requests
 */
export async function handleGetSceneInfo(
  args: {
    sceneId?: string;
  },
  foundryClient: FoundryClient,
) {
  const { sceneId } = args;

  return withToolError('get scene info', async () => {
    const scene = await foundryClient.getCurrentScene(sceneId);

    return {
      content: [
        {
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
        },
      ],
    };
  });
}

/**
 * Handles requests for actors currently placed on a scene
 */
const OBJECT_ACTOR_TYPES = new Set(['loot', 'vehicle', 'hazard']);

export async function handleGetSceneActors(
  args: {
    sceneId?: string;
    includeHidden?: boolean;
    includeObjects?: boolean;
  },
  foundryClient: FoundryClient,
) {
  const { sceneId, includeHidden = false, includeObjects = false } = args;

  return withToolError('get scene actors', async () => {
    const tokens = foundryClient.getSceneActors(sceneId);

    const visible = tokens.filter((t) => {
      if (!includeHidden && t.hidden) return false;
      if (!includeObjects && t.actor && OBJECT_ACTOR_TYPES.has(t.actor.type)) return false;
      return true;
    });

    if (visible.length === 0) {
      return {
        content: [{ type: 'text', text: 'No tokens found on the current scene.' }],
      };
    }

    const lines = visible.map((t) => {
      const a = t.actor;
      const alliance = resolveAlliance(a, t.disposition);
      const hiddenMarker = t.hidden ? ' [Hidden]' : '';

      let hpStr = 'HP: Unknown';
      if (a) {
        const sys = a.system as Record<string, unknown>;
        const attrs = sys.attributes as Record<string, unknown> | undefined;
        const hp = attrs?.hp as Record<string, unknown> | undefined;
        if (hp) {
          const val = typeof hp.value === 'number' ? hp.value : null;
          const max = typeof hp.max === 'number' && hp.max > 0 ? hp.max : null;
          if (val !== null) {
            hpStr = max !== null ? `HP: ${val}/${max}` : `HP: ${val}`;
          }
        }
      }

      // Collect active conditions — PF2e stores these as embedded items of type "condition"
      const conditions: string[] = [];
      if (a?.items) {
        for (const item of a.items) {
          if (item.type === 'condition') {
            conditions.push(item.name);
          }
        }
      }
      // Also include non-disabled active effects (covers non-PF2e systems and general effects)
      if (a?.effects) {
        for (const effect of a.effects) {
          if (!effect.disabled && !conditions.includes(effect.name)) {
            conditions.push(effect.name);
          }
        }
      }
      const conditionStr = conditions.length > 0 ? ` — *${conditions.join(', ')}*` : '';

      const type = a ? ` (${a.type})` : '';
      const actorNote = a ? '' : ' ⚠️ unlinked token';
      return `- **${t.tokenName}**${type}${hiddenMarker} — ${alliance} — ${hpStr}${conditionStr}${actorNote}`;
    });

    const sceneName = sceneId ? `scene ${sceneId}` : 'current scene';

    return {
      content: [
        {
          type: 'text',
          text: `🎭 **Tokens on ${sceneName}** (${visible.length} total)\n\n${lines.join('\n')}`,
        },
      ],
    };
  });
}
