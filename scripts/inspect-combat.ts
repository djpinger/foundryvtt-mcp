import dotenv from 'dotenv';
import { FoundryClient } from '../src/foundry/client.js';
dotenv.config();

async function main() {
  const client = new FoundryClient({
    baseUrl: process.env.FOUNDRY_URL!,
    username: process.env.FOUNDRY_USERNAME,
    password: process.env.FOUNDRY_PASSWORD,
  });
  await client.connect();

  const scenes = client.getScenes();
  const active = scenes.find((s: any) => s.active) as any;
  
  console.log('Grid:', JSON.stringify(active?.grid));
  console.log('Scene size:', active?.width, 'x', active?.height);
  
  // Show all tokens with positions
  const tokens = active?.tokens as any[];
  tokens?.forEach((t: any) => {
    console.log(`Token: "${t.name}" actorId=${t.actorId} x=${t.x} y=${t.y} hidden=${t.hidden}`);
  });

  await client.disconnect();
}
main().catch(console.error);
