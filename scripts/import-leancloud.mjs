#!/usr/bin/env node
/**
 * 把 LeanCloud 数据导出转换成 Leanite 静态博客的 Markdown 文件。
 *
 * 用法：
 *   node scripts/import-leancloud.mjs <导出目录> [--dry-run]
 *   npm run import:leancloud -- ./leancloud-export
 *
 * 导出目录里应包含 BlogContent 和 BlogMeta 的导出文件（.jsonl 或 .json）。
 * LeanCloud 控制台的「数据存储 → 导出」会按 Class 生成 JSON Lines 文件。
 * 脚本会按文章的 id 字段把正文和元数据合并，输出到 content/posts/。
 */

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const flags = new Set();
const positional = [];
let outArgument = null;
for (let index = 0; index < args.length; index += 1) {
  const argument = args[index];
  if (argument === "--out") {
    outArgument = args[index + 1];
    index += 1;
  } else if (argument.startsWith("--")) {
    flags.add(argument);
  } else {
    positional.push(argument);
  }
}
const sourceDir = positional[0];
const dryRun = flags.has("--dry-run");
const outDir = path.resolve(
  process.cwd(),
  outArgument ?? "content/posts"
);

if (!sourceDir) {
  console.log(`用法：node scripts/import-leancloud.mjs <LeanCloud 导出目录> [选项]

参数：
  <导出目录>      包含 BlogContent / BlogMeta 导出文件的目录（会递归查找 .json/.jsonl）
  --out <目录>    输出目录，默认为 content/posts
  --dry-run       只显示将要生成的文件，不实际写入

示例：
  npm run import:leancloud -- ./leancloud-export
  node scripts/import-leancloud.mjs ./leancloud-export --dry-run`);
  process.exit(1);
}

const sourceRoot = path.resolve(process.cwd(), sourceDir);
if (!fs.existsSync(sourceRoot)) {
  console.error(`找不到目录：${sourceRoot}`);
  process.exit(1);
}

/* -------------------------------------------------------------------------- */
/* 读取                                                                       */
/* -------------------------------------------------------------------------- */

function walk(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...walk(fullPath));
    } else if (/\.(jsonl?|ndjson)$/i.test(entry.name)) {
      result.push(fullPath);
    }
  }
  return result;
}

function parseFile(file) {
  const text = fs.readFileSync(file, "utf8").trim();
  if (!text) return [];

  // 先尝试整体 JSON（数组，或 { results: [...] }）
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object") {
      if (Array.isArray(parsed.results)) return parsed.results;
      return [parsed];
    }
  } catch {
    // 不是整体 JSON，按 JSON Lines 处理
  }

  const records = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      records.push(JSON.parse(trimmed));
    } catch {
      console.warn(`[跳过] 无法解析的一行：${file}`);
    }
  }
  return records;
}

function fileHint(file) {
  const base = path.basename(file).toLowerCase();
  if (base.includes("blogcontent")) return "content";
  if (base.includes("blogmeta")) return "meta";
  return null;
}

function recordId(record) {
  const id = record.id ?? record.articleId ?? record.blogId;
  if (id === undefined || id === null || id === "") return "";
  return String(id);
}

/* -------------------------------------------------------------------------- */
/* 合并                                                                       */
/* -------------------------------------------------------------------------- */

const metaById = new Map();
const contents = new Map();
let totalRecords = 0;

for (const file of walk(sourceRoot)) {
  const hint = fileHint(file);
  for (const record of parseFile(file)) {
    if (!record || typeof record !== "object") continue;
    totalRecords += 1;
    const id = recordId(record);
    if (!id) continue;

    const type =
      hint ??
      (typeof record.content === "string" ? "content" : "meta");

    if (type === "content") {
      contents.set(id, record);
    } else {
      metaById.set(id, { ...(metaById.get(id) ?? {}), ...record });
    }
  }
}

if (contents.size === 0) {
  console.error(
    "没有找到任何 BlogContent 记录。请确认导出目录里包含 BlogContent 的 .jsonl 文件。"
  );
  process.exit(1);
}

/* -------------------------------------------------------------------------- */
/* 生成 Markdown                                                              */
/* -------------------------------------------------------------------------- */

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function slugify(input) {
  return (
    String(input)
      .normalize("NFKC")
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, "-")
      .replace(/[\\/:*?"<>|#%&{}$!'@+`=~^[\];,]/g, "")
      .replace(/-+/g, "-")
      .replace(/^[.-]+|[.-]+$/g, "")
      .slice(0, 80)
      .replace(/[.-]+$/g, "") || "post"
  );
}

function yamlString(value) {
  return JSON.stringify(String(value).replace(/\r?\n/g, " ").trim());
}

fs.mkdirSync(outDir, { recursive: true });

const usedNames = new Set(
  fs
    .readdirSync(outDir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => name.toLowerCase())
);

let written = 0;
const missingMeta = [];

for (const [id, content] of contents) {
  const meta = metaById.get(id);
  if (!meta) missingMeta.push(id);

  const title = String(meta?.title ?? content.title ?? "未命名文章").trim();
  const date =
    toDate(meta?.createdAt) ??
    toDate(content.createdAt) ??
    toDate(meta?.updatedAt) ??
    toDate(new Date());

  const rawTags = Array.isArray(meta?.tags)
    ? meta.tags
    : Array.isArray(content.tags)
    ? content.tags
    : [];
  const tags = [...new Set(rawTags.map((tag) => String(tag).trim()).filter(Boolean))];

  const isDraft = Boolean(meta?.isDraft ?? content.isDraft ?? false);

  const body = String(content.content ?? "").replace(/\r\n/g, "\n").trim();

  let fileName = `${date}-${slugify(title)}.md`;
  let counter = 2;
  while (usedNames.has(fileName.toLowerCase())) {
    fileName = `${date}-${slugify(title)}-${counter}.md`;
    counter += 1;
  }
  usedNames.add(fileName.toLowerCase());

  const tagsBlock =
    tags.length > 0
      ? `tags:\n${tags.map((tag) => `  - ${yamlString(tag)}`).join("\n")}`
      : "tags: []";

  const markdown = `---
title: ${yamlString(title)}
date: ${date}
${tagsBlock}
draft: ${isDraft}
---

${body}
`;

  const target = path.join(outDir, fileName);
  if (dryRun) {
    console.log(`[预览] ${fileName}  ${title}${isDraft ? "（草稿）" : ""}`);
  } else {
    fs.writeFileSync(target, markdown, "utf8");
    console.log(`[写入] ${path.relative(process.cwd(), target)}  ${title}${isDraft ? "（草稿）" : ""}`);
  }
  written += 1;
}

console.log("");
console.log(`共读取 ${totalRecords} 条记录，生成 ${written} 篇文章。`);
if (missingMeta.length > 0) {
  console.warn(
    `有 ${missingMeta.length} 篇文章没有找到对应的 BlogMeta（标签、发布日期可能使用了正文里的值）：${missingMeta
      .slice(0, 10)
      .join(", ")}${missingMeta.length > 10 ? " ……" : ""}`
  );
}
if (dryRun) {
  console.log("这是预览模式，没有写入任何文件。去掉 --dry-run 即可正式生成。");
} else {
  console.log(`输出目录：${outDir}`);
  console.log("接下来运行 npm run dev 预览，或 npm run build 重新构建。");
}
