import { writeFile, rename } from "fs/promises";

export function toJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export async function writeJsonToPath(data: unknown, path: string): Promise<void> {
  const tmp = `${path}.tmp`;
  await writeFile(tmp, toJson(data), { encoding: "utf8" });
  await rename(tmp, path);
}
