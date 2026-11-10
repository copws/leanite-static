import * as fs from "node:fs";
import * as path from "node:path";
import type { Plugin } from "vite";
import {
  deriveSlug,
  excerptMarkdown,
  FrontMatterError,
  guessTitle,
  normalizeDate,
  parseFrontMatter,
  toBoolean,
  toTags,
  validateTag,
} from "../src/frontmatter";
import type {
  BlogSettings,
  Post,
  SiteContent,
  TagInfo,
} from "../src/types";

/**
 * Leanite 静态版的内容构建插件。
 *
 * 它负责：
 * 1. 读取 blog.config.json 和 content/posts/*.md；
 * 2. 校验 front matter，生成文章、标签数据；
 * 3. 通过 virtual:leanite-content 把数据注入前端；
 * 4. 构建结束后为每个路由写出真正的 HTML 文件（含标题 / 描述 / canonical），
 *    这样刷新、分享深链接和在 GitHub Pages 上直接访问都能正常工作；
 * 5. 生成 sitemap.xml 和 404.html。
 */

const VIRTUAL_MODULE_ID = "virtual:leanite-content";
const RESOLVED_VIRTUAL_MODULE_ID = `\0${VIRTUAL_MODULE_ID}`;
const HEAD_START = "<!--leanite-head:start-->";
const HEAD_END = "<!--leanite-head:end-->";
const HEAD_PLACEHOLDER = "<!--leanite-head-->";

export interface BlogContentPluginOptions {
  /** 文章目录，默认 content/posts */
  contentDir?: string;
  /** 站点配置文件，默认 blog.config.json */
  configFile?: string;
}

interface PageMeta {
  /** 相对 dist 的路由，例如 "" / "article/hello" */
  route: string;
  title: string;
  description: string;
  noindex?: boolean;
  ogType?: "website" | "article";
  published?: string;
}

const DEFAULT_SETTINGS: BlogSettings = {
  title: "Leanite 博客",
  name: "Leanite 博客",
  desc: "一个用 Markdown 写成的静态博客",
  avatarURL: "/27_16_34_19_bxs-pyramid.png",
  blogIcon: "/27_16_34_19_bxs-pyramid.png",
  bulletin: "欢迎来到 Leanite！这里的内容都来自 Markdown 文件。",
  siteURL: "",
  base: "/",
  version: "0.3.1",
  language: "zh-CN",
  adminUsername: "admin",
  // SHA-256("admin")
  adminPasswordHash:
    "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918",
};

export function normalizeBase(input: string): string {
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

function readSettings(
  root: string,
  configFile: string
): { settings: BlogSettings; warnings: string[] } {
  const fullPath = path.resolve(root, configFile);
  if (!fs.existsSync(fullPath)) {
    throw new Error(
      `[Leanite] 找不到站点配置文件 ${configFile}，请确认它在项目根目录。`
    );
  }

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(fs.readFileSync(fullPath, "utf8")) as Record<
      string,
      unknown
    >;
  } catch (error) {
    throw new Error(
      `[Leanite] ${configFile} 不是合法的 JSON：${(error as Error).message}`
    );
  }

  const warnings: string[] = [];
  const settings: BlogSettings = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof BlogSettings)[]) {
    const value = raw[key];
    if (typeof value === "string") settings[key] = value;
  }

  settings.base = normalizeBase(settings.base);
  if (!settings.name.trim()) settings.name = DEFAULT_SETTINGS.name;
  if (!settings.title.trim()) settings.title = settings.name;
  settings.language = settings.language.trim() || DEFAULT_SETTINGS.language;

  settings.adminUsername =
    settings.adminUsername.trim() || DEFAULT_SETTINGS.adminUsername;
  const adminPasswordHash = settings.adminPasswordHash.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(adminPasswordHash)) {
    throw new Error(
      "[Leanite] blog.config.json 的 adminPasswordHash 必须是 SHA-256 哈希（64 位十六进制），不能填明文密码。默认 admin 的哈希是 8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918，也可以在设置页生成。"
    );
  }
  settings.adminPasswordHash = adminPasswordHash;

  if (settings.siteURL.trim()) {
    if (!/^https?:\/\//i.test(settings.siteURL)) {
      warnings.push(
        `blog.config.json 里的 siteURL “${settings.siteURL}” 不是 http(s) 地址，已忽略（canonical 和 sitemap 将不会生成）`
      );
      settings.siteURL = "";
    } else if (!settings.siteURL.endsWith("/")) {
      settings.siteURL = `${settings.siteURL}/`;
    }
  } else {
    settings.siteURL = "";
  }

  return { settings, warnings };
}

function loadPosts(postsDir: string): {
  posts: Post[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const posts: Post[] = [];

  if (!fs.existsSync(postsDir)) {
    warnings.push(
      `内容目录 ${path.relative(process.cwd(), postsDir)} 不存在，已按空博客处理`
    );
    return { posts, warnings };
  }

  const files = fs
    .readdirSync(postsDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        /\.md$/i.test(entry.name) &&
        !entry.name.startsWith("_") &&
        !entry.name.startsWith(".")
    )
    .map((entry) => entry.name)
    .sort();

  const seenIds = new Map<string, string>();

  for (const file of files) {
    const fullPath = path.join(postsDir, file);
    const stat = fs.statSync(fullPath);

    let parsed;
    try {
      parsed = parseFrontMatter(fs.readFileSync(fullPath, "utf8"));
    } catch (error) {
      const message =
        error instanceof FrontMatterError ? error.message : String(error);
      throw new Error(`[Leanite] ${file} 的 front matter 有误：${message}`);
    }

    const data = parsed.data;
    const body = parsed.body.trim();

    let title = typeof data.title === "string" ? data.title.trim() : "";
    if (!title) {
      title = guessTitle(body);
      if (title) {
        warnings.push(
          `${file} 没有写 title，已使用正文里的一级标题“${title}”`
        );
      } else {
        title = file.replace(/\.md$/i, "");
        warnings.push(`${file} 没有写 title，已使用文件名“${title}”`);
      }
    }

    let date = normalizeDate(data.date);
    if (!date) {
      const fromName = normalizeDate(file.slice(0, 10));
      if (fromName) {
        date = fromName;
        warnings.push(
          `${file} 没有写 date，已使用文件名里的日期 ${date}`
        );
      } else {
        date = formatLocalDate(stat.mtime);
        warnings.push(
          `${file} 没有写 date，已使用文件修改时间 ${date}（建议补上 date）`
        );
      }
    }

    const id = deriveSlug(file, data.slug);
    const exist = seenIds.get(id);
    if (exist) {
      throw new Error(
        `[Leanite] ${file} 和 ${exist} 生成了相同的文章 id “${id}”。请修改文件名或 front matter 里的 slug。`
      );
    }
    seenIds.set(id, file);

    const tags = toTags(data.tags);
    for (const tag of tags) {
      const problem = validateTag(tag);
      if (problem) {
        throw new Error(
          `[Leanite] ${file} 的标签“${tag}”不能用于网址：${problem}`
        );
      }
    }

    const isDraft = toBoolean(data.draft, false);
    const description =
      typeof data.description === "string" ? data.description.trim() : "";

    if (!body) {
      warnings.push(`${file} 的正文是空的`);
    }

    posts.push({
      id,
      title,
      date,
      tags,
      isDraft,
      // 草稿不打包正文，也不能用正文生成摘要，否则会泄漏草稿内容
      description: isDraft
        ? description
        : description || excerptMarkdown(body),
      source: file,
      updatedAt: stat.mtime.toISOString(),
      content: isDraft ? null : body,
    });
  }

  posts.sort(
    (a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)
  );

  return { posts, warnings };
}

function collectTags(posts: Post[]): TagInfo[] {
  const map = new Map<string, TagInfo>();
  for (const post of posts) {
    if (post.isDraft) continue;
    for (const tag of post.tags) {
      const info = map.get(tag) ?? { name: tag, ids: [], count: 0 };
      info.ids.push(post.id);
      info.count += 1;
      map.set(tag, info);
    }
  }
  return [...map.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-Hans-CN")
  );
}

function formatLocalDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default function blogContentPlugin(
  options: BlogContentPluginOptions = {}
): Plugin {
  const contentDir = options.contentDir ?? "content/posts";
  const configFile = options.configFile ?? "blog.config.json";

  let root = process.cwd();
  let outDir = path.resolve(root, "dist");
  let settings: BlogSettings = { ...DEFAULT_SETTINGS };
  let posts: Post[] = [];
  let tags: TagInfo[] = [];
  let warnings: string[] = [];
  let generatedAt = new Date().toISOString();

  function refresh(): void {
    const parsedSettings = readSettings(root, configFile);
    const parsedPosts = loadPosts(path.resolve(root, contentDir));
    settings = parsedSettings.settings;
    posts = parsedPosts.posts;
    tags = collectTags(posts);
    warnings = [...parsedSettings.warnings, ...parsedPosts.warnings];
    generatedAt = new Date().toISOString();

    if (!settings.siteURL) {
      warnings.push(
        "blog.config.json 里没有填写 siteURL，将不会生成 canonical 和 sitemap.xml"
      );
    }
  }

  function siteTitle(): string {
    return settings.title || settings.name;
  }

  function pageTitle(title: string): string {
    if (!title || title === settings.name || title === siteTitle()) {
      return title || siteTitle();
    }
    return `${title} - ${settings.name}`;
  }

  function absoluteUrl(route: string): string {
    if (!settings.siteURL) return "";
    try {
      return new URL(route ? `${route}/` : "", settings.siteURL).toString();
    } catch {
      return "";
    }
  }

  function renderHead(page: PageMeta): string {
    const lines: string[] = [HEAD_START];
    lines.push(`<title>${escapeHtml(page.title)}</title>`);
    if (page.description) {
      lines.push(
        `<meta name="description" content="${escapeHtml(
          page.description
        )}" />`
      );
    }
    lines.push(
      `<meta name="generator" content="Leanite ${escapeHtml(
        settings.version
      )}" />`
    );

    const canonical = absoluteUrl(page.route);
    if (canonical) {
      lines.push(`<link rel="canonical" href="${escapeHtml(canonical)}" />`);
      lines.push(
        `<meta property="og:url" content="${escapeHtml(canonical)}" />`
      );
    }
    lines.push(
      `<meta property="og:type" content="${page.ogType ?? "website"}" />`
    );
    lines.push(
      `<meta property="og:title" content="${escapeHtml(page.title)}" />`
    );
    if (page.description) {
      lines.push(
        `<meta property="og:description" content="${escapeHtml(
          page.description
        )}" />`
      );
    }
    lines.push(
      `<meta property="og:site_name" content="${escapeHtml(settings.name)}" />`
    );
    lines.push(`<meta name="twitter:card" content="summary" />`);
    if (page.published) {
      lines.push(
        `<meta property="article:published_time" content="${page.published}" />`
      );
    }
    if (page.noindex) {
      lines.push(`<meta name="robots" content="noindex, nofollow" />`);
    }
    lines.push(HEAD_END);
    return lines.join("\n    ");
  }

  function injectHead(html: string, page: PageMeta): string {
    const block = renderHead(page);
    if (html.includes(HEAD_PLACEHOLDER)) {
      return html.replace(HEAD_PLACEHOLDER, block);
    }
    return html.replace(/<\/head>/i, `    ${block}\n  </head>`);
  }

  function replaceHead(html: string, page: PageMeta): string {
    const pattern = new RegExp(
      `${escapeRegExp(HEAD_START)}[\\s\\S]*?${escapeRegExp(HEAD_END)}`
    );
    if (pattern.test(html)) return html.replace(pattern, renderHead(page));
    return injectHead(html, page);
  }

  function buildPages(): PageMeta[] {
    const pages: PageMeta[] = [
      {
        route: "",
        title: siteTitle(),
        description: settings.desc,
      },
      {
        route: "home",
        title: siteTitle(),
        description: settings.desc,
      },
      {
        route: "tag",
        title: pageTitle("标签"),
        description: `${settings.name}的全部标签`,
      },
      {
        route: "article",
        title: pageTitle("归档"),
        description: `${settings.name}的文章归档`,
      },
    ];

    for (const tag of tags) {
      pages.push({
        route: `tag/${tag.name}`,
        title: pageTitle(`标签：${tag.name}`),
        description: `标签“${tag.name}”下的 ${tag.count} 篇文章`,
      });
    }

    for (const post of posts) {
      if (post.isDraft) continue;
      pages.push({
        route: `article/${post.id}`,
        title: pageTitle(post.title),
        description: post.description,
        ogType: "article",
        published: post.date,
      });
    }

    pages.push(
      {
        route: "authentication",
        title: pageTitle("管理员登录"),
        description: "Leanite 控制台登录",
        noindex: true,
      },
      {
        route: "adminHome",
        title: pageTitle("控制台"),
        description: "Leanite 写作台",
        noindex: true,
      },
      {
        route: "modifyArticle",
        title: pageTitle("文章管理"),
        description: "管理 Markdown 文章与本地草稿",
        noindex: true,
      },
      {
        route: "modifyTags",
        title: pageTitle("标签总览"),
        description: "查看由文章自动汇总的标签",
        noindex: true,
      },
      {
        route: "settings",
        title: pageTitle("站点设置"),
        description: "生成 blog.config.json",
        noindex: true,
      }
    );

    return pages;
  }

  function writeSitemap(): void {
    if (!settings.siteURL) return;
    const entries = buildPages()
      .filter((page) => !page.noindex)
      .map((page) => {
        const loc = absoluteUrl(page.route);
        if (!loc) return "";
        const lastmod = page.published
          ? `\n    <lastmod>${page.published}</lastmod>`
          : "";
        return `  <url>\n    <loc>${escapeXml(loc)}</loc>${lastmod}\n  </url>`;
      })
      .filter(Boolean);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`;
    fs.writeFileSync(path.join(outDir, "sitemap.xml"), xml, "utf8");
  }

  function emitRoutePages(): void {
    const indexPath = path.join(outDir, "index.html");
    if (!fs.existsSync(indexPath)) return;

    const template = fs.readFileSync(indexPath, "utf8");
    for (const page of buildPages()) {
      if (!page.route) continue;
      const html = replaceHead(template, page);
      const targetDir = path.join(outDir, ...page.route.split("/"));
      fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(path.join(targetDir, "index.html"), html, "utf8");
    }

    const notFound = replaceHead(template, {
      route: "",
      title: pageTitle("页面不存在"),
      description: settings.desc,
      noindex: true,
    });
    fs.writeFileSync(path.join(outDir, "404.html"), notFound, "utf8");
    writeSitemap();
  }

  return {
    name: "leanite:blog-content",
    enforce: "pre",

    configResolved(config) {
      root = config.root;
      outDir = path.resolve(config.root, config.build.outDir);
    },

    buildStart() {
      refresh();
      if (warnings.length > 0) {
        for (const warning of warnings) {
          this.warn(`[Leanite] ${warning}`);
        }
      }
    },

    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) return RESOLVED_VIRTUAL_MODULE_ID;
      return null;
    },

    load(id) {
      if (id !== RESOLVED_VIRTUAL_MODULE_ID) return null;
      if (!generatedAt) refresh();

      const content: SiteContent = {
        settings,
        posts,
        tags,
        warnings,
        generatedAt,
      };
      const json = JSON.stringify(content).replace(/</g, "\\u003c");
      return `export default ${json};`;
    },

    transformIndexHtml: {
      order: "pre",
      handler(html) {
        if (!generatedAt) refresh();
        const withLanguage = html.replace(
          /<html\b[^>]*>/i,
          `<html lang="${escapeHtml(settings.language)}">`
        );
        return injectHead(withLanguage, {
          route: "",
          title: siteTitle(),
          description: settings.desc,
        });
      },
    },

    configureServer(server) {
      const postsDir = path.resolve(root, contentDir);
      const configPath = path.resolve(root, configFile);
      server.watcher.add(postsDir);
      server.watcher.add(configPath);

      let timer: ReturnType<typeof setTimeout> | undefined;
      const scheduleRefresh = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          try {
            refresh();
          } catch (error) {
            const message = (error as Error).message;
            server.config.logger.error(message);
            server.ws.send({
              type: "error",
              err: {
                message,
                stack: (error as Error).stack ?? "",
              },
            });
            return;
          }

          const virtualModule = server.moduleGraph.getModuleById(
            RESOLVED_VIRTUAL_MODULE_ID
          );
          if (virtualModule) {
            server.moduleGraph.invalidateModule(virtualModule);
          }
          server.ws.send({ type: "full-reload" });
        }, 80);
      };

      server.watcher.on("all", (event, file) => {
        if (event !== "add" && event !== "change" && event !== "unlink") {
          return;
        }
        const fullPath = path.resolve(file);
        const isPost =
          fullPath.startsWith(`${postsDir}${path.sep}`) &&
          /\.md$/i.test(fullPath);
        if (isPost || fullPath === configPath) scheduleRefresh();
      });
    },

    closeBundle() {
      if (generatedAt) emitRoutePages();
    },
  };
}
