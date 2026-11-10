import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import * as fs from "node:fs";
import * as path from "node:path";
import blogContentPlugin, { normalizeBase } from "./plugin/blog-content";

// eslint-disable-next-line no-control-regex
const INVALID_CHAR_REGEX = /[\u0000-\u001F"#$&*+,:;<=>?[\]^`{|}\u007F]/g;
const DRIVE_LETTER_REGEX = /^[a-z]:/i;

/** 与插件共用同一份 base 规则，保证 Vite 资源和 Router basename 一致 */
function readBase(): string {
  try {
    const raw = fs.readFileSync(
      path.resolve(process.cwd(), "blog.config.json"),
      "utf8"
    );
    const config = JSON.parse(raw) as { base?: unknown };
    return normalizeBase(typeof config.base === "string" ? config.base : "/");
  } catch {
    return "/";
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: readBase(),
  plugins: [react(), blogContentPlugin()],
  server: {
    watch: {
      // 编辑器保存时可能产生临时文件，Windows 上监听它们会触发 EBUSY
      ignored: ["**/.*.tmpdir/**", "**/*.tmp"],
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    // 消除打包大小超过 500kb 的警告
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: {
        index: "index.html",
      },
      output: {
        chunkFileNames: "static/js/[name]-[hash].js",
        entryFileNames: "static/js/[name]-[hash].js",
        assetFileNames: "static/[ext]/[name]-[hash].[ext]",
        // 处理 GitHub Pages 部署时文件名里的特殊字符
        sanitizeFileName(name: string) {
          const match = DRIVE_LETTER_REGEX.exec(name);
          const driveLetter = match ? match[0] : "";
          return (
            driveLetter +
            name.slice(driveLetter.length).replace(INVALID_CHAR_REGEX, "")
          );
        },
      },
    },
  },
});
