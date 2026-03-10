import { createHash } from "node:crypto";

export function createInterviewPasswordHash(password: string): string {
  return createHash("sha256").update(String(password || "")).digest("hex");
}

export function createInterviewPasswordToken(password: string): string {
  return Buffer.from(String(password || ""), "utf8").toString("base64");
}

export function createInterviewStorageSecret(passwordHash: string): string {
  return createHash("sha256").update(`fly-interview-center:${passwordHash}:state:v1`).digest("hex");
}
