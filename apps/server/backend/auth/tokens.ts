// Tokens for devices and links: long random strings handed out once; the server keeps only their SHA-256.
import { createHash, randomBytes } from "node:crypto";

export const newToken = (): string => randomBytes(32).toString("base64url");

export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");
