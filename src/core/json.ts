import { randomUUID } from "node:crypto";
import { open, readFile, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { AppError, EXIT, errorMessage } from "./errors.js";
import { ensurePrivateDirectory } from "./paths.js";

export async function readJsonFile(file: string, maxBytes = 1_048_576): Promise<unknown | undefined> {
  try {
    const info = await stat(file);
    if (!info.isFile()) {
      throw new AppError("CONFIG_INVALID", `Expected a file: ${file}`, EXIT.CONFIG);
    }
    if (info.size > maxBytes) {
      throw new AppError("CONFIG_TOO_LARGE", `File exceeds ${maxBytes} bytes: ${file}`, EXIT.CONFIG);
    }
    return JSON.parse(await readFile(file, "utf8")) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    if (error instanceof AppError) throw error;
    throw new AppError("CONFIG_INVALID", `Cannot read ${file}: ${errorMessage(error)}`, EXIT.CONFIG);
  }
}

export async function writeTextAtomic(file: string, text: string, mode = 0o600): Promise<void> {
  const directory = path.dirname(file);
  const temporary = path.join(directory, `.${path.basename(file)}.${randomUUID()}.tmp`);
  await ensurePrivateDirectory(directory);
  try {
    const handle = await open(temporary, "wx", mode);
    try {
      await handle.writeFile(text, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, file);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw new AppError("WRITE_FAILED", `Cannot write ${file}: ${errorMessage(error)}`, EXIT.FAILURE);
  }
}

export async function writeJsonAtomic(file: string, value: unknown): Promise<void> {
  await writeTextAtomic(file, `${JSON.stringify(value, null, 2)}\n`);
}
