/**
 * Leanite 静态版的数据结构。
 *
 * 这些类型同时被构建插件（plugin/blog-content.ts）和浏览器端代码使用，
 * 所以这里不能引入任何依赖 DOM 或 Node 的代码。
 */

/** blog.config.json 的结构 */
export interface BlogSettings {
  /** 浏览器标签页标题 */
  title: string;
  /** 站点名称（页面标题后缀、侧栏资料卡） */
  name: string;
  /** 一句话简介 */
  desc: string;
  /** 头像 URL（支持 / 开头的站内路径） */
  avatarURL: string;
  /** 浏览器标签页图标 URL（支持 / 开头的站内路径） */
  blogIcon: string;
  /** 侧栏公告，支持 Markdown */
  bulletin: string;
  /** 站点完整地址，用于 canonical 和 sitemap，例如 https://example.com/ */
  siteURL: string;
  /** 部署子路径，例如 /leanite/；部署在域名根目录时填 / */
  base: string;
  /** 页脚显示的版本号 */
  version: string;
  /** 站点语言，写入 <html lang> */
  language: string;
  /** 控制台登录用户名 */
  adminUsername: string;
  /** 控制台登录密码的 SHA-256 哈希（不存明文） */
  adminPasswordHash: string;
}

/** 一篇文章的元数据 */
export interface PostMeta {
  /** URL 中的文章 id（由文件名或 front matter 的 slug 生成） */
  id: string;
  title: string;
  /** 发布日期，格式 YYYY-MM-DD */
  date: string;
  tags: string[];
  isDraft: boolean;
  /** 摘要，用于 meta description */
  description: string;
  /** 源文件名，便于写作台定位文件 */
  source: string;
  /** 源文件最后修改时间（ISO 字符串） */
  updatedAt: string;
}

/** 一篇文章（草稿的 content 为 null，构建时不会把草稿正文打进包里） */
export interface Post extends PostMeta {
  content: string | null;
}

/** 由文章自动汇总出来的标签 */
export interface TagInfo {
  name: string;
  /** 拥有该标签的文章 id，按发布日期降序 */
  ids: string[];
  count: number;
}

/** 构建插件注入到前端的全部内容 */
export interface SiteContent {
  settings: BlogSettings;
  posts: Post[];
  tags: TagInfo[];
  warnings: string[];
  generatedAt: string;
}

/** 兼容旧代码里的名字 */
export type BlogMeta = PostMeta;
