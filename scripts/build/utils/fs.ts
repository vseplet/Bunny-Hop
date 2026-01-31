/**
 * File System Utilities
 */

import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";

export async function exists(path: string): Promise<boolean> {
  return existsSync(path);
}

export async function ensureDir(path: string): Promise<void> {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

export async function copy(src: string, dest: string): Promise<void> {
  cpSync(src, dest, { recursive: true });
}

export async function safeRemove(path: string): Promise<boolean> {
  try {
    if (!existsSync(path)) {
      return false;
    }
    rmSync(path, { recursive: true, force: true });
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

export async function cleanDir(path: string): Promise<void> {
  await safeRemove(path);
  await ensureDir(path);
}

export async function copyDir(src: string, dest: string): Promise<void> {
  await safeRemove(dest);
  await copy(src, dest);
}

export async function readTextFile(path: string): Promise<string | null> {
  try {
    const file = Bun.file(path);
    if (!(await file.exists())) {
      return null;
    }
    return await file.text();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function writeTextFile(path: string, content: string): Promise<void> {
  const dir = dirname(path);
  if (dir && dir !== ".") {
    await ensureDir(dir);
  }
  await Bun.write(path, content);
}

export async function writeBinaryFile(path: string, data: Uint8Array): Promise<void> {
  const dir = dirname(path);
  if (dir && dir !== ".") {
    await ensureDir(dir);
  }
  await Bun.write(path, data);
}
