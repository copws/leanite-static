import { useEffect } from "react";
import content from "virtual:leanite-content";
import type { BlogSettings, Post, PostMeta, TagInfo } from "./types";

export type { BlogSettings, Post, PostMeta, TagInfo };
export type BlogMeta = PostMeta;

/** 构建时从 blog.config.json 读到的站点设置 */
export const settings: BlogSettings = content.settings;
/** 全部文章（含草稿，草稿的 content 为 null） */
export const posts: Post[] = content.posts;
/** 由文章自动汇总出来的标签 */
export const tags: TagInfo[] = content.tags;
/** 构建时的提示信息（例如某篇文章没写日期） */
export const warnings: string[] = content.warnings;
/** 本次构建时间 */
export const generatedAt: string = content.generatedAt;

/** 只包含已发布文章，按日期从新到旧 */
export const publishedPosts: Post[] = posts.filter((post) => !post.isDraft);

const BASE = settings.base.endsWith("/") ? settings.base : `${settings.base}/`;

export function getPost(id: string): Post | undefined {
  return posts.find((post) => post.id === id);
}

export function getTag(name: string): TagInfo | undefined {
  return tags.find((tag) => tag.name === name);
}

/** 2024-05-01 → 2024/5/1（与原来 toLocaleDateString 的观感一致） */
export function formatDate(date: string): string {
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return date;
  return `${Number(year)}/${Number(month)}/${Number(day)}`;
}

export function postYear(date: string): number {
  return Number(date.slice(0, 4));
}

/** 规范化部署子路径：保证以 / 开头和结尾 */
export function normalizeBasePath(input: string): string {
  let value = (input || "/").trim();
  if (/^https?:\/\//i.test(value)) {
    try {
      value = new URL(value).pathname;
    } catch {
      value = "/";
    }
  }
  if (!value.startsWith("/")) value = `/${value}`;
  if (!value.endsWith("/")) value = `${value}/`;
  return value;
}

/** 把 /images/a.png 这样的站内路径补上部署子路径 */
export function assetUrl(url?: string): string {
  const value = (url ?? "").trim();
  if (!value) return "";
  if (/^(?:https?:)?\/\//i.test(value) || /^data:/i.test(value)) return value;
  if (value.startsWith("#")) return value;
  return `${BASE}${value.replace(/^\/+/, "")}`;
}

/**
 * 把渲染后 HTML 里以 / 开头的图片、链接补上部署子路径。
 * 这样在 Markdown 里写 `/images/a.png` 就能自动适配 /leanite/ 这类子路径部署。
 * 只处理真正的 <img>/<a> 标签，不会碰到代码块里的示例文本。
 */
export function rewriteRootUrls(html: string): string {
  if (BASE === "/") return html;
  return html
    .replace(/(<img\b[^>]*?\bsrc=")\/(?!\/)/gi, `$1${BASE}`)
    .replace(/(<a\b[^>]*?\bhref=")\/(?!\/)/gi, `$1${BASE}`);
}

/** 同步更新浏览器标题和 description */
export function usePageMeta(title?: string, description?: string): void {
  useEffect(() => {
    document.title = title
      ? `${title} - ${settings.name}`
      : settings.title || settings.name;

    if (!description) return;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", description);
  }, [title, description]);
}
