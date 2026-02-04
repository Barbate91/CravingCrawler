import { writeFile } from "fs/promises";

export function toJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export async function writeJsonToPath(data: unknown, path: string): Promise<void> {
  const body = toJson(data);
  await writeFile(path, body, { encoding: "utf8" });
}
