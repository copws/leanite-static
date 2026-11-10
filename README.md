# Leanite Static

访问[我们的开发日志网站](https://copws.github.io/leanite-static/)预览博客效果

从之前的 [Leanite 动态版本](https://github.com/copws/leanite)迁移而来。此前的Leanite项目由于基于LeanCloud，而随着现在LeanCloud的停服，原项目也就自然死亡了。截至写本文时开发者已基本失去React编程能力，至于为什么有这个项目，还要感谢[DeepSeek Harness](https://www.deepseek.com/harness/)，梁圣送了6块赠金，本项目只花了3块……

Leanite Static的界面设计和原来基本一致（有一些设计是我指使大肥鱼改的，比如顶栏删了），但是已经完全转向静态博客了。具体操作细节我就不多说了，看肥鱼表演：

一个用 Markdown 写作、构建时生成页面的静态博客系统。界面仍然是原来的 Leanite（React + Ant Design + md-editor-rt），但不再依赖 LeanCloud：文章、标签和站点设置都来自项目里的文件，`npm run build` 生成可以直接部署的静态网站。

> 从 0.2.x 的 LeanCloud 动态版升级而来。详细的写文章、配置、部署和迁移说明见 **[使用说明书](docs/使用说明书.md)**。

## 特点

- 文章就是 `content/posts/*.md`，支持 front matter、标签、草稿和描述；
- 标签从文章自动汇总，不再单独维护；
- 每篇文章、标签、归档和后台页面都生成独立的 HTML，刷新和分享深链接不会 404；
- 构建时自动生成 `<title>`、description、canonical、Open Graph 和 `sitemap.xml`；
- 不需要服务器、数据库、账号或密钥，部署到 GitHub Pages / Netlify / 任意静态服务器即可；
- 保留原来的 Leanite 界面风格：配色、卡片、侧栏、导航和 Markdown 预览样式基本没变（顶部空白栏已移除，控制台入口放在右侧导航菜单）；
- 后台改成浏览器里的写作台：本地草稿、导入/导出 Markdown、生成站点配置。

## 快速开始

需要 Node.js `^20.19.0` 或 `>=22.12.0`。

```bash
npm install
npm run dev      # 本地预览，默认 http://localhost:5173/leanite-static/
npm run build    # 构建到 dist/
npm run preview  # 预览构建产物
```

> 项目默认的部署路径是 `/leanite-static/`（对应 GitHub Pages 仓库页）。如果部署在域名根目录，把 `blog.config.json` 里的 `base` 改成 `/`。

## 写一篇文章

在 `content/posts/` 下新建 `2024-06-15-hello.md`：

```markdown
---
title: "你好，世界"
date: 2024-06-15
tags:
  - "随笔"
draft: false
---

正文用 Markdown 写。
```

文章网址是 `/article/hello/`。文件名开头的日期只用于排序，不会进入网址；也可以用 front matter 的 `slug` 手动指定网址。

字段、图片、站内链接、草稿等细节见 [使用说明书](docs/使用说明书.md)。

## 站点设置

站点名称、简介、头像、图标、公告、部署路径等都在根目录的 `blog.config.json` 里。也可以在后台「设置」页可视化编辑，然后生成配置文件替换它。

## 后台

- `/adminHome/` 控制台
- `/modifyArticle/` 文章管理 + 写作台
- `/modifyTags/` 标签总览（只读）
- `/settings/` 站点设置生成器

进入控制台需要登录，默认用户名和密码均为 `admin`，可在「设置 → 管理员账号」里修改。登录只是前端门禁，能挡住随手点进来的访客，但挡不住查看源码的人，不要在里面放真正的秘密。

## 目录结构

```text
content/posts/        Markdown 文章
public/               图片等静态资源
blog.config.json      站点设置
plugin/               Markdown 构建插件
scripts/              LeanCloud 数据迁移脚本
src/                  React 界面
docs/使用说明书.md     完整说明
```

## 从 LeanCloud 迁移

如果导出过 LeanCloud 的 `BlogContent` / `BlogMeta` 数据：

```bash
npm run import:leancloud -- ./leancloud-export --dry-run
npm run import:leancloud -- ./leancloud-export
```

脚本会按文章 `id` 合并正文和元数据，生成 `content/posts/日期-标题.md`，并保留标签和草稿状态（旧版的 `reader` 字段会被忽略）。详见说明书第 10 节。

## 技术栈

- React 19 + TypeScript
- Ant Design 5
- [md-editor-rt](https://github.com/imzbf/md-editor-rt)
- Vite 7 + 自定义 Markdown 构建插件
- React Router 6

## 版本

0.3.0（静态博客版）
