import { settings } from "./lib";

/**
 * 控制台登录。
 *
 * 静态站点没有服务器，所以这套校验只能算「前端门禁」：它能挡住随手点进来的访客，
 * 但挡不住查看源码或修改 localStorage/sessionStorage 的人。请不要把真正的秘密
 * 放在这个站点里。
 *
 * 密码以 SHA-256 哈希的形式保存在 blog.config.json 或浏览器 localStorage 中，
 * 不保存明文。默认用户名和密码均为 admin。
 */

export interface AdminCredentials {
  username: string;
  passwordHash: string;
}

/** SHA-256("admin") */
const DEFAULT_PASSWORD_HASH =
  "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918";

const CREDENTIALS_KEY = "leanite:admin-credentials:v1";
const SESSION_KEY = "leanite:authed";

export function isCryptoAvailable(): boolean {
  return (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.subtle !== "undefined"
  );
}

export async function hashPassword(password: string): Promise<string> {
  if (!isCryptoAvailable()) {
    throw new Error("当前环境不支持密码校验，请通过 https 或 localhost 访问");
  }
  const bytes = new TextEncoder().encode(password);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** 当前生效的账号：优先用设置页保存到本浏览器的账号，否则用构建配置里的账号 */
export function getCredentials(): AdminCredentials {
  const stored = readStoredCredentials();
  if (stored) return stored;

  const username = settings.adminUsername.trim() || "admin";
  const passwordHash = /^[a-f0-9]{64}$/i.test(settings.adminPasswordHash)
    ? settings.adminPasswordHash.toLowerCase()
    : DEFAULT_PASSWORD_HASH;

  return { username, passwordHash };
}

/** 把新账号保存到当前浏览器（立即生效，但只影响这个浏览器） */
export function setCredentials(credentials: AdminCredentials): void {
  try {
    localStorage.setItem(
      CREDENTIALS_KEY,
      JSON.stringify({
        username: credentials.username.trim(),
        passwordHash: credentials.passwordHash.toLowerCase(),
      })
    );
  } catch {
    // 浏览器禁用 localStorage 时忽略，仍可通过 blog.config.json 生效
  }
}

export async function verifyCredentials(
  username: string,
  password: string
): Promise<boolean> {
  const credentials = getCredentials();
  if (username.trim() !== credentials.username) return false;
  const passwordHash = await hashPassword(password);
  return passwordHash === credentials.passwordHash;
}

export function isAuthenticated(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function signIn(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    // 无法写入时保持未登录状态，用户会看到登录页
  }
}

export function signOut(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // 忽略
  }
}

function readStoredCredentials(): AdminCredentials | null {
  try {
    const raw = localStorage.getItem(CREDENTIALS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const username =
      typeof parsed.username === "string" ? parsed.username.trim() : "";
    const passwordHash =
      typeof parsed.passwordHash === "string"
        ? parsed.passwordHash.trim().toLowerCase()
        : "";
    if (!username || !/^[a-f0-9]{64}$/.test(passwordHash)) return null;
    return { username, passwordHash };
  } catch {
    return null;
  }
}
