/**
 * Creates (or resets the password of) a login for the /admin panel.
 *   npx tsx --env-file=.env.local scripts/create-admin.ts <login> "<Name>" <owner|manager> [password]
 * Without a password a random one is generated and printed once.
 */
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";
import { createClient } from "@sanity/client";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

async function main() {
  const [login, name, role = "manager", given] = process.argv.slice(2);
  if (!login || !/^[a-z0-9_.-]{3,30}$/.test(login) || !name) {
    console.error('Usage: scripts/create-admin.ts <login> "<Name>" <owner|manager> [password]');
    process.exit(1);
  }
  const password = given ?? randomBytes(9).toString("base64url");
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  const client = createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
    apiVersion: "2025-10-01",
    token: process.env.SANITY_API_WRITE_TOKEN,
    useCdn: false,
  });
  const id = `admins.${login}`;
  const existing = await client.fetch<{ sessionVersion?: number } | null>(`*[_id == $id][0]{sessionVersion}`, { id });
  await client.createOrReplace({
    _id: id,
    _type: "adminUser",
    login,
    name,
    role: role === "owner" ? "owner" : "manager",
    passwordHash: `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`,
    sessionVersion: (existing?.sessionVersion ?? 0) + 1,
    createdAt: new Date().toISOString(),
  });
  console.log(`OK  login: ${login}  password: ${password}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
