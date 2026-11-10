import {
  guessTitle,
  normalizeDate,
  parseFrontMatter,
  toBoolean,
  toTags,
  today,
} from "./frontmatter";
import type { Post } from "./types";

/**
 * 浏览器里的「本地草稿」。
 *
 * 静态博客没有云端数据库，写作台把草稿保存在 localStorage 里；
 * 定稿后导出为 .md 文件，放进 content/posts/ 重新构建即可发布。
 */
export interface LocalDraft {
  id: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  /** 逗号分隔，导出时再拆成数组 */
  tags: string;
  draft: boolean;
  description: string;
  content: string;
  updatedAt: string;
}

const STORAGE_KEY = "leanite:drafts:v1";

export function newDraft(): LocalDraft {
  return {
    id: newId(),
    title: "",
    date: today(),
    tags: "",
    draft: true,
    description: "",
    content: "",
    updatedAt: new Date().toISOString(),
  };
}

export function newId(): string {
  return `local-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function loadDrafts(): LocalDraft[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeDraft)
      .filter((draft): draft is LocalDraft => draft !== null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function persistDrafts(drafts: LocalDraft[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch {
    // 浏览器禁用 localStorage 时静默失败，页面上仍可继续导出
  }
}

export function upsertDraft(draft: LocalDraft): LocalDraft[] {
  const drafts = loadDrafts();
  const next = { ...draft, updatedAt: new Date().toISOString() };
  const index = drafts.findIndex((item) => item.id === draft.id);
  if (index >= 0) {
    drafts[index] = next;
  } else {
    drafts.unshift(next);
  }
  persistDrafts(drafts);
  return loadDrafts();
}

export function removeDraft(id: string): LocalDraft[] {
  const drafts = loadDrafts().filter((draft) => draft.id !== id);
  persistDrafts(drafts);
  return drafts;
}

/** 把构建时读到的文章载入写作台（编辑已发布文章） */
export function draftFromPost(post: Post): LocalDraft {
  return {
    id: newId(),
    title: post.title,
    date: post.date,
    tags: post.tags.join(", "),
    draft: post.isDraft,
    description: post.description,
    content: post.content ?? "",
    updatedAt: new Date().toISOString(),
  };
}

/** 导入一个 .md 文件为本地草稿 */
export function draftFromMarkdown(text: string, fileName: string): LocalDraft {
  const parsed = parseFrontMatter(text);
  const data = parsed.data;
  const body = parsed.body.replace(/^\n+/, "");

  const title =
    (typeof data.title === "string" && data.title.trim()) ||
    guessTitle(body) ||
    fileName.replace(/\.(md|markdown|txt)$/i, "");

  return {
    id: newId(),
    title,
    date: normalizeDate(data.date) ?? today(),
    tags: toTags(data.tags).join(", "),
    draft: toBoolean(data.draft, true),
    description:
      typeof data.description === "string" ? data.description.trim() : "",
    content: body,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeDraft(value: unknown): LocalDraft | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string") return null;

  return {
    id: raw.id,
    title: typeof raw.title === "string" ? raw.title : "",
    date: normalizeDate(raw.date) ?? today(),
    tags:
      typeof raw.tags === "string"
        ? raw.tags
        : Array.isArray(raw.tags)
        ? raw.tags.join(", ")
        : "",
    draft: toBoolean(raw.draft, true),
    description:
      typeof raw.description === "string" ? raw.description : "",
    content: typeof raw.content === "string" ? raw.content : "",
    updatedAt:
      typeof raw.updatedAt === "string"
        ? raw.updatedAt
        : new Date().toISOString(),
  };
}
