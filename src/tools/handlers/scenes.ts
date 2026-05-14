/**
 * @fileoverview Scene management tool handlers
 *
 * Handles scene information retrieval and management.
 */

import type { FoundryClient } from '../../foundry/client.js';
import { withToolError } from './utils.js';

const DISPOSITION_LABELS: Record<number, string> = {
  [-1]: 'Hostile',
  [0]: 'Neutral',
  [1]: 'Friendly',
  [2]: 'Secret',
};

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
export async function handleGetSceneActors(
  args: {
    sceneId?: string;
    includeHidden?: boolean;
  },
  foundryClient: FoundryClient,
) {
  const { sceneId, includeHidden = false } = args;

  return withToolError('get scene actors', async () => {
    const tokens = foundryClient.getSceneActors(sceneId);

    const visible = includeHidden ? tokens : tokens.filter((t) => !t.hidden);

    if (visible.length === 0) {
      return {
        content: [{ type: 'text', text: 'No tokens found on the current scene.' }],
      };
    }

    const lines = visible.map((t) => {
      const disposition = DISPOSITION_LABELS[t.disposition] ?? 'Unknown';
      const a = t.actor;

      let hpStr = 'HP: Unknown';
      if (a) {
        const sys = a.system as Record<string, unknown>;
        const attrs = sys.attributes as Record<string, unknown> | undefined;
        const hp = attrs?.hp as Record<string, unknown> | undefined;
        if (hp && typeof hp.value === 'number' && typeof hp.max === 'number') {
          hpStr = `HP: ${hp.value}/${hp.max}`;
        }
      }

      const type = a ? ` (${a.type})` : '';
      const actorNote = a ? '' : ' ⚠️ unlinked token';
      return `- **${t.tokenName}**${type} — ${disposition} — ${hpStr}${actorNote}`;
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
