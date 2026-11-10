import React from "react";
import { Alert, Button, Space } from "antd";
import { Link } from "react-router-dom";
import InfoCard from "../../components/InfoCard";
import {
  generatedAt,
  posts,
  publishedPosts,
  settings,
  tags,
  usePageMeta,
  warnings,
} from "../../lib";
import { loadDrafts } from "../../drafts";

export default function AdminHome() {
  usePageMeta("控制台");
  const draftFiles = posts.filter((post) => post.isDraft);
  const localDrafts = loadDrafts();

  return (
    <div>
      <InfoCard>
        <h2>Leanite 控制台</h2>
        <Space wrap>
          <Link to="/modifyArticle">
            <Button type="primary">开始写作</Button>
          </Link>
          <Link to="/settings">
            <Button>站点设置</Button>
          </Link>
          <Link to="/home">
            <Button>返回博客</Button>
          </Link>
        </Space>
      </InfoCard>

      <InfoCard>
        <h3>当前内容</h3>
        <Space size="large" wrap style={{ color: "grey" }}>
          <span>已发布：{publishedPosts.length} 篇</span>
          <span>草稿文件：{draftFiles.length} 篇</span>
          <span>本地草稿：{localDrafts.length} 篇</span>
          <span>标签：{tags.length} 个</span>
          <span>
            最近构建：
            {new Date(generatedAt).toLocaleString("zh-CN")}
          </span>
        </Space>
        <p style={{ color: "grey", marginBottom: 0 }}>
          当前站点：{settings.name}
          {settings.siteURL ? ` · ${settings.siteURL}` : ""}
        </p>
      </InfoCard>

      <InfoCard>
        <h3>工作流程</h3>
        <ol style={{ marginTop: 0, marginBottom: 0 }}>
          <li>
            在「文章管理」里新建文章，或导入已有的 Markdown 文件；
          </li>
          <li>
            写完以后点「导出 Markdown」，把下载的 .md 文件放进项目里的{" "}
            <code>content/posts/</code>；
          </li>
          <li>
            运行 <code>npm run dev</code> 本地预览，或运行{" "}
            <code>npm run build</code> 生成 <code>dist/</code> 发布；
          </li>
          <li>
            要改站点名称、公告、头像等，去「设置」生成{" "}
            <code>blog.config.json</code>，替换项目根目录里的同名文件后重新构建。
          </li>
        </ol>
      </InfoCard>

      {warnings.length > 0 ? (
        <InfoCard>
          <Alert
            type="warning"
            showIcon
            message="构建时有这些提示"
            description={
              <ul style={{ marginBottom: 0, paddingLeft: "20px" }}>
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            }
          />
        </InfoCard>
      ) : null}
    </div>
  );
}
