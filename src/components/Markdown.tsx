import type { CSSProperties } from "react";
import { MdPreview } from "md-editor-rt";
import { rewriteRootUrls } from "../lib";

interface MarkdownProps {
  value?: string | null;
  style?: CSSProperties;
  /** 同一页面渲染多篇内容时，传不同的 id 避免锚点冲突 */
  id?: string;
}

/**
 * 统一封装的 Markdown 预览。
 *
 * 原来的页面直接使用 MdPreview，这里保持完全相同的参数，
 * 只额外把站内绝对路径（/images/a.png）补上部署子路径。
 */
export default function Markdown({ value, style, id }: MarkdownProps) {
  return (
    <MdPreview
      id={id}
      value={value ?? ""}
      previewTheme="github"
      style={style}
      sanitize={rewriteRootUrls}
    />
  );
}
