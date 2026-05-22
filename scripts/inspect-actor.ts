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

  const actorId = process.argv[2] ?? 'd0qaDDaqEd9HJ9Y0';
  const actor = client.getRawActor(actorId);
  if (!actor) { console.log('Not found'); process.exit(1); }

  const sys = actor.system as Record<string, unknown>;
  console.log('resources:', JSON.stringify(sys['resources'], null, 2));

  await client.disconnect();
}
main().catch(console.error);
