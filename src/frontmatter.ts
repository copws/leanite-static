/**
 * 一个最小的 YAML front matter 解析器 / 生成器。
 *
 * 只支持写博客真正会用到的语法子集，好处是：
 * - 构建时（Node）和浏览器里（写作台导入）共用同一份实现；
 * - 不引入额外依赖，出错时能给出「第几行」的明确提示。
 *
 * 支持：
 *   key: value
 *   key: "带引号的值"
 *   key: 2024-05-01
 *   key: true / false
 *   key: 12
 *   key: [a, b, c]
 *   key:
 *     - a
 *     - b
 *   key: |
 *     多行文本
 */
export class FrontMatterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FrontMatterError";
  }
}

export interface FrontMatterResult {
  data: Record<string, unknown>;
  body: string;
}

export interface FrontMatterInput {
  title: string;
  date: string;
  tags: string[];
  draft: boolean;
  description?: string;
  slug?: string;
}

const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]*$/;

export function parseFrontMatter(raw: string): FrontMatterResult {
  const text = raw.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const lines = text.split("\n");

  if (lines.length === 0 || lines[0].trim() !== "---") {
    return { data: {}, body: text };
  }

  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      end = i;
      break;
    }
  }
  if (end < 0) {
    throw new FrontMatterError("front matter 缺少结束的 --- 行");
  }

  const data = parseYamlBlock(lines.slice(1, end));
  const body = lines
    .slice(end + 1)
    .join("\n")
    .replace(/^\n+/, "");

  return { data, body };
}

export function stringifyFrontMatter(
  data: FrontMatterInput,
  body: string
): string {
  const lines: string[] = ["---"];
  lines.push(`title: ${quoteYaml(data.title)}`);
  lines.push(`date: ${data.date}`);
  if (data.tags.length > 0) {
    lines.push("tags:");
    for (const tag of data.tags) lines.push(`  - ${quoteYaml(tag)}`);
  } else {
    lines.push("tags: []");
  }
  lines.push(`draft: ${data.draft}`);
  if (data.slug) lines.push(`slug: ${quoteYaml(data.slug)}`);
  if (data.description) {
    lines.push(`description: ${quoteYaml(data.description)}`);
  }
  lines.push("---");
  return `${lines.join("\n")}\n\n${body.replace(/^\n+/, "")}`;
}

/* -------------------------------------------------------------------------- */
/* 解析                                                                       */
/* -------------------------------------------------------------------------- */

function parseYamlBlock(lines: string[]): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const lineNumber = index + 2; // front matter 第一行在文件里是第 2 行

    if (!line.trim() || line.trim().startsWith("#")) {
      index += 1;
      continue;
    }
    if (/^\s/.test(line)) {
      throw new FrontMatterError(
        `第 ${lineNumber} 行：不该缩进，请检查上一行的写法`
      );
    }

    const separator = findKeySeparator(line);
    if (separator < 0) {
      throw new FrontMatterError(
        `第 ${lineNumber} 行：缺少冒号，格式应为 “key: value”`
      );
    }

    const key = line.slice(0, separator).trim();
    if (!KEY_PATTERN.test(key)) {
      throw new FrontMatterError(
        `第 ${lineNumber} 行：不支持的字段名 “${key}”（只能用字母、数字、下划线和短横线）`
      );
    }
    if (key in data) {
      throw new FrontMatterError(`第 ${lineNumber} 行：字段 “${key}” 重复了`);
    }

    const valueText = stripComment(line.slice(separator + 1)).trim();

    if (valueText === "") {
      const block = readBlockArray(lines, index + 1);
      data[key] = block.items.length > 0 ? block.items : null;
      index = block.next;
      continue;
    }

    if (/^[|>][+-]?$/.test(valueText)) {
      const block = readBlockScalar(lines, index + 1, valueText);
      data[key] = block.value;
      index = block.next;
      continue;
    }

    data[key] = parseInlineValue(valueText, lineNumber);
    index += 1;
  }

  return data;
}

function findKeySeparator(line: string): number {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quote) {
      if (char === "\\" && quote === '"') {
        i += 1;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
    } else if (char === ":") {
      return i;
    }
  }
  return -1;
}

function stripComment(text: string): string {
  let quote: string | null = null;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quote) {
      if (char === "\\" && quote === '"') {
        i += 1;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
    } else if (char === "#" && (i === 0 || /\s/.test(text[i - 1]))) {
      return text.slice(0, i).trimEnd();
    }
  }
  return text;
}

function readBlockArray(
  lines: string[],
  start: number
): { items: string[]; next: number } {
  const items: string[] = [];
  let index = start;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    const match = /^\s+-\s*(.*)$/.exec(line);
    if (!match) break;
    const value = stripComment(match[1]).trim();
    items.push(String(parseInlineValue(value, index + 2)));
    index += 1;
  }

  return { items, next: index };
}

function readBlockScalar(
  lines: string[],
  start: number,
  indicator: string
): { value: string; next: number } {
  const folded = indicator.startsWith(">");
  const stripFinalNewline = indicator.endsWith("-");
  const collected: string[] = [];
  let index = start;

  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === "" || /^\s/.test(line)) {
      collected.push(line);
      index += 1;
    } else {
      break;
    }
  }

  while (collected.length > 0 && !collected[collected.length - 1].trim()) {
    collected.pop();
  }

  let indent = Number.POSITIVE_INFINITY;
  for (const line of collected) {
    if (!line.trim()) continue;
    const width = /^\s*/.exec(line)?.[0].length ?? 0;
    indent = Math.min(indent, width);
  }
  if (!Number.isFinite(indent)) indent = 0;

  let value = collected
    .map((line) => line.slice(Math.min(indent, line.length)))
    .join("\n");

  if (folded) {
    value = value.replace(/\n+/g, " ").trim();
  } else if (!stripFinalNewline) {
    value = `${value}\n`;
  }

  return { value, next: index };
}

function parseInlineValue(text: string, lineNumber: number): unknown {
  if (text.startsWith("[")) {
    if (!text.endsWith("]")) {
      throw new FrontMatterError(
        `第 ${lineNumber} 行：数组缺少右方的 ]，或者请改用 “- 项目” 的多行写法`
      );
    }
    const content = text.slice(1, -1).trim();
    if (!content) return [];
    return splitTopLevel(content).map((part) =>
      parseScalar(part.trim(), lineNumber)
    );
  }
  return parseScalar(text, lineNumber);
}

function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quote: string | null = null;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quote) {
      current += char;
      if (char === "\\" && quote === '"' && i + 1 < text.length) {
        current += text[i + 1];
        i += 1;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
    } else if (char === ",") {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts;
}

function parseScalar(text: string, lineNumber: number): unknown {
  if (!text) return null;

  if (text.startsWith('"')) {
    if (!text.endsWith('"') || text.length < 2) {
      throw new FrontMatterError(
        `第 ${lineNumber} 行：双引号没有成对出现（值里如果有英文双引号，请用 \\" 转义）`
      );
    }
    const inner = text.slice(1, -1);
    try {
      return JSON.parse(`"${inner}"`);
    } catch {
      return inner.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    }
  }

  if (text.startsWith("'")) {
    if (!text.endsWith("'") || text.length < 2) {
      throw new FrontMatterError(`第 ${lineNumber} 行：单引号没有成对出现`);
    }
    return text.slice(1, -1).replace(/''/g, "'");
  }

  const lower = text.toLowerCase();
  if (lower === "true" || lower === "yes" || lower === "on") return true;
  if (lower === "false" || lower === "no" || lower === "off") return false;
  if (lower === "null" || lower === "~") return null;
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return Number(text);

  return text;
}

/* -------------------------------------------------------------------------- */
/* 生成                                                                       */
/* -------------------------------------------------------------------------- */

/** 统一用双引号字符串输出，避免冒号、#、引号等字符带来的歧义 */
function quoteYaml(value: string): string {
  return JSON.stringify(value.replace(/\r?\n/g, " ").trim());
}

/* -------------------------------------------------------------------------- */
/* 字段归一化                                                                 */
/* -------------------------------------------------------------------------- */

/** 把 front matter 里的 tags 统一成字符串数组 */
export function toTags(value: unknown): string[] {
  if (value === null || value === undefined) return [];

  let list: unknown[];
  if (Array.isArray(value)) {
    list = value;
  } else if (typeof value === "string") {
    list = value.split(/[,，]/);
  } else {
    list = [value];
  }

  const tags: string[] = [];
  for (const item of list) {
    const name = String(item ?? "").trim();
    if (name && !tags.includes(name)) tags.push(name);
  }
  return tags;
}

/** 把 front matter 里的 date 统一成 YYYY-MM-DD，失败返回 null */
export function normalizeDate(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    if (["true", "yes", "on", "1"].includes(lower)) return true;
    if (["false", "no", "off", "0"].includes(lower)) return false;
  }
  if (typeof value === "number") return value !== 0;
  return fallback;
}

/** 生成安全的文件 / URL 片段 */
export function slugify(input: string): string {
  const cleaned = input
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[\\/:*?"<>|#%&{}$!'@+`=~^[\];,]/g, "")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 80)
    .replace(/[.-]+$/g, "");

  if (!cleaned) return "post";
  if (isReservedWindowsName(cleaned)) return `post-${cleaned}`;
  return cleaned;
}

/**
 * 从文件名推导文章 id：
 * - front matter 里写了 slug，则用 slug；
 * - 否则去掉扩展名；
 * - 如果文件名形如 2024-05-01-hello.md，则去掉日期前缀，只保留 hello。
 */
export function deriveSlug(fileName: string, explicitSlug?: unknown): string {
  if (typeof explicitSlug === "string" && explicitSlug.trim()) {
    return slugify(explicitSlug);
  }
  let base = fileName.replace(/\.(md|markdown)$/i, "");
  const dated = /^\d{4}-\d{2}-\d{2}[-_ ]+(.+)$/.exec(base);
  if (dated) base = dated[1];
  return slugify(base);
}

function isReservedWindowsName(name: string): boolean {
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(name);
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** 校验标签能否安全地变成目录名 */
export function validateTag(tag: string): string | null {
  if (!tag.trim()) return "标签不能为空";
  if (/[\\/:*?"<>|#%]/.test(tag)) {
    return '标签里不能包含 \\ / : * ? " < > | # % 这些字符';
  }
  if (tag.startsWith(".")) return "标签不能以点开头";
  if (/[. ]$/.test(tag)) return "标签不能以点或空格结尾";
  if (isReservedWindowsName(tag)) {
    return `“${tag}” 是 Windows 保留名称，请换一个标签名`;
  }
  return null;
}

/** 把 Markdown 压缩成一段纯文本摘要 */
export function excerptMarkdown(markdown: string, limit = 120): string {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_`~|-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}…`;
}

/** 用一段 Markdown 猜标题（第一个一级标题） */
export function guessTitle(markdown: string): string {
  const match = /^\s{0,3}#\s+(.+?)\s*#*\s*$/m.exec(markdown);
  return match ? match[1].trim() : "";
}

/** 当前本地日期，YYYY-MM-DD */
export function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(
    now.getDate()
  )}`;
}
