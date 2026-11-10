import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  App,
  Button,
  Divider,
  Input,
  List,
  Popconfirm,
  Select,
  Space,
  Tag as AntdTag,
  Upload,
} from "antd";
import { publish } from "pubsub-js";
import { MdEditor } from "md-editor-rt";
import InfoCard from "../../components/InfoCard";
import {
  getPost,
  posts,
  rewriteRootUrls,
  usePageMeta,
  type Post,
} from "../../lib";
import {
  draftFromMarkdown,
  draftFromPost,
  loadDrafts,
  newDraft,
  removeDraft,
  upsertDraft,
  type LocalDraft,
} from "../../drafts";
import { copyText, downloadText } from "../../download";
import {
  normalizeDate,
  slugify,
  stringifyFrontMatter,
  toTags,
} from "../../frontmatter";
import "md-editor-rt/lib/style.css";

interface EditorState extends LocalDraft {
  /** 编辑已有文章时，原文章的 URL id */
  sourceSlug?: string;
  /** 编辑已有文章时，原文件名 */
  sourceFile?: string;
}

function toLocalDraft(state: EditorState): LocalDraft {
  return {
    id: state.id,
    title: state.title,
    date: state.date,
    tags: state.tags,
    draft: state.draft,
    description: state.description,
    content: state.content,
    updatedAt: new Date().toISOString(),
  };
}

function validate(state: EditorState): string | null {
  if (!state.title.trim()) return "请先填写标题";
  if (!normalizeDate(state.date)) return "日期格式应为 YYYY-MM-DD，例如 2024-05-01";
  return null;
}

export default function ModifyArticle() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const id = search.get("id");
  const isNew = search.get("new") === "1";

  const [drafts, setDrafts] = useState<LocalDraft[]>(() => loadDrafts());
  const [editor, setEditor] = useState<EditorState | null>(null);

  usePageMeta(editor ? "写作台" : "文章管理");

  useEffect(() => {
    if (isNew) {
      setEditor({ ...newDraft() });
      return;
    }
    if (!id) {
      setEditor(null);
      return;
    }
    if (id.startsWith("local-")) {
      const found = loadDrafts().find((draft) => draft.id === id);
      if (!found) {
        message.error("找不到这个本地草稿");
        navigate("/modifyArticle", { replace: true });
        return;
      }
      setEditor({ ...found });
      return;
    }

    const post = getPost(id);
    if (!post) {
      message.error("找不到这篇文章");
      navigate("/modifyArticle", { replace: true });
      return;
    }
    if (post.content === null) {
      message.info(
        "这是草稿文件：正文没有被放进页面里，请直接用编辑器打开 content/posts/"
      );
      navigate("/modifyArticle", { replace: true });
      return;
    }
    setEditor({
      ...draftFromPost(post),
      sourceSlug: post.id,
      sourceFile: post.source,
    });
    // 只在 id / new 变化时重新载入，避免 message、navigate 的引用变化覆盖正在编辑的内容
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew]);

  const editing = editor !== null;
  useEffect(() => {
    publish(editing ? "closeSidebar" : "openSidebar");
    return () => {
      publish("openSidebar");
    };
  }, [editing]);

  const update = (patch: Partial<EditorState>) => {
    setEditor((previous) =>
      previous ? { ...previous, ...patch } : previous
    );
  };

  const handleSaveLocal = () => {
    if (!editor) return;
    const problem = validate(editor);
    if (problem) {
      message.error(problem);
      return;
    }
    const date = normalizeDate(editor.date) ?? editor.date;
    const next = upsertDraft(toLocalDraft({ ...editor, date }));
    setDrafts(next);
    message.success("已保存到浏览器本地草稿");
    if (isNew) {
      navigate(`/modifyArticle?id=${editor.id}`, { replace: true });
    }
  };

  const handleExport = () => {
    if (!editor) return;
    const problem = validate(editor);
    if (problem) {
      message.error(problem);
      return;
    }

    const date = normalizeDate(editor.date) as string;
    const slug = editor.sourceSlug ?? slugify(editor.title);
    const filename = editor.sourceFile ?? `${date}-${slug}.md`;
    const markdown = stringifyFrontMatter(
      {
        title: editor.title.trim(),
        date,
        tags: toTags(editor.tags),
        draft: editor.draft,
        description: editor.description.trim() || undefined,
        slug: editor.sourceSlug,
      },
      editor.content
    );

    downloadText(filename, markdown);
    setDrafts(upsertDraft(toLocalDraft({ ...editor, date })));
    message.success(
      `已导出 ${filename}，把它放进 content/posts/ 后重新构建即可生效。`,
      6
    );
  };

  const exportDraft = (draft: LocalDraft) => {
    const date = normalizeDate(draft.date) ?? draft.date;
    const filename = `${date}-${slugify(draft.title || "post")}.md`;
    const markdown = stringifyFrontMatter(
      {
        title: draft.title.trim() || "未命名文章",
        date,
        tags: toTags(draft.tags),
        draft: draft.draft,
        description: draft.description.trim() || undefined,
      },
      draft.content
    );
    downloadText(filename, markdown);
    message.success(`已导出 ${filename}`);
  };

  const handleDeleteDraft = (draft: LocalDraft) => {
    setDrafts(removeDraft(draft.id));
    message.success("已删除本地草稿");
  };

  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const draft = draftFromMarkdown(
          String(reader.result ?? ""),
          file.name
        );
        setDrafts(upsertDraft(draft));
        message.success("已导入为本地草稿");
        navigate(`/modifyArticle?id=${draft.id}`);
      } catch (error) {
        message.error(`导入失败：${(error as Error).message}`);
      }
    };
    reader.onerror = () => message.error("读取文件失败");
    reader.readAsText(file, "utf-8");
    return false;
  };

  const copyPost = async (post: Post) => {
    if (post.content === null) {
      message.info("草稿文件的正文不在页面里，请直接在本地复制源文件");
      return;
    }
    const markdown = stringifyFrontMatter(
      {
        title: post.title,
        date: post.date,
        tags: post.tags,
        draft: post.isDraft,
        description: post.description || undefined,
        slug: post.id,
      },
      post.content
    );
    const ok = await copyText(markdown);
    if (ok) message.success("已复制 Markdown 源码");
    else message.error("复制失败，请手动打开源文件");
  };

  if (editor) {
    return (
      <div>
        <InfoCard>
          <Space direction="horizontal" wrap>
            <strong>标题：</strong>
            <Input
              value={editor.title}
              onChange={(event) => update({ title: event.currentTarget.value })}
              style={{ width: "50vw" }}
              placeholder="文章标题"
            />
            <Button type="primary" onClick={handleExport}>
              导出 Markdown
            </Button>
            <Button onClick={handleSaveLocal}>保存本地草稿</Button>
            <Button
              onClick={() => {
                setEditor(null);
                navigate("/modifyArticle");
              }}
            >
              取消
            </Button>
          </Space>
          <Space
            direction="horizontal"
            wrap
            size="middle"
            style={{ marginTop: "12px" }}
          >
            <span style={{ whiteSpace: "nowrap" }}>
              <strong>日期：</strong>
              <Input
                value={editor.date}
                onChange={(event) =>
                  update({ date: event.currentTarget.value })
                }
                style={{ width: "140px" }}
                placeholder="YYYY-MM-DD"
              />
            </span>
            <span style={{ whiteSpace: "nowrap" }}>
              <strong>标签：</strong>
              <Input
                value={editor.tags}
                onChange={(event) =>
                  update({ tags: event.currentTarget.value })
                }
                style={{ width: "240px" }}
                placeholder="用逗号分隔，如：技术, 随笔"
              />
            </span>
            <span style={{ whiteSpace: "nowrap" }}>
              <strong>描述：</strong>
              <Input
                value={editor.description}
                onChange={(event) =>
                  update({ description: event.currentTarget.value })
                }
                style={{ width: "260px" }}
                placeholder="留空则自动截取正文"
              />
            </span>
            <span style={{ whiteSpace: "nowrap" }}>
              <strong>状态：</strong>
              <Select
                value={editor.draft ? "draft" : "published"}
                onChange={(value) => update({ draft: value === "draft" })}
                options={[
                  { value: "published", label: "发布" },
                  { value: "draft", label: "草稿" },
                ]}
                style={{ width: "100px" }}
              />
            </span>
          </Space>
          <p style={{ color: "grey", marginBottom: 0 }}>
            {editor.sourceSlug
              ? `正在编辑已有文章“${editor.sourceSlug}”，导出时会沿用原文件名 ${editor.sourceFile}。`
              : "新文章导出后，文件名（去掉日期前缀）就是它的网址，建议用英文短名。"}
          </p>
        </InfoCard>
        <MdEditor
          value={editor.content}
          onChange={(value) => update({ content: value })}
          style={{
            marginTop: "30px",
            border: 0,
          }}
          previewTheme="github"
          sanitize={rewriteRootUrls}
        />
      </div>
    );
  }

  return (
    <div>
      <InfoCard>
        <List
          header="文章总览"
          dataSource={posts}
          pagination={{
            position: "bottom",
            align: "center",
            pageSize: 5,
            total: posts.length,
          }}
          footer={
            <Space style={{ float: "right" }}>
              <Upload
                accept=".md,.markdown,.txt"
                showUploadList={false}
                beforeUpload={handleImportFile}
              >
                <Button>导入 Markdown</Button>
              </Upload>
              <Button
                type="primary"
                onClick={() => navigate("/modifyArticle?new=1")}
              >
                创建新文章
              </Button>
            </Space>
          }
          renderItem={(post) => (
            <List.Item
              actions={[
                <Button
                  key="read"
                  onClick={() =>
                    navigate(`/article/${encodeURIComponent(post.id)}`)
                  }
                >
                  阅读
                </Button>,
                <Button key="edit" onClick={() => navigate(`/modifyArticle?id=${post.id}`)}>
                  编辑
                </Button>,
                <Button key="copy" onClick={() => void copyPost(post)}>
                  复制源码
                </Button>,
              ]}
            >
              <span>
                {post.title.trimEnd()}
                <Divider type="vertical" />
                {post.isDraft ? (
                  <AntdTag color="orange">草稿</AntdTag>
                ) : (
                  <AntdTag color="green">已发布</AntdTag>
                )}
                <span style={{ color: "grey" }}>{post.source}</span>
              </span>
            </List.Item>
          )}
        />
      </InfoCard>

      <InfoCard>
        <List
          header="本地草稿（只保存在这个浏览器里）"
          dataSource={drafts}
          locale={{
            emptyText: "还没有本地草稿。点击“创建新文章”或“导入 Markdown”开始。",
          }}
          pagination={{
            position: "bottom",
            align: "center",
            pageSize: 5,
            total: drafts.length,
          }}
          renderItem={(draft) => (
            <List.Item
              actions={[
                <Button
                  key="edit"
                  onClick={() => navigate(`/modifyArticle?id=${draft.id}`)}
                >
                  编辑
                </Button>,
                <Button key="export" onClick={() => exportDraft(draft)}>
                  导出
                </Button>,
                <Popconfirm
                  key="delete"
                  title="删除草稿"
                  description="删除后无法恢复，确定吗？"
                  onConfirm={() => handleDeleteDraft(draft)}
                  okText="确认"
                  cancelText="取消"
                >
                  <Button danger>删除</Button>
                </Popconfirm>,
              ]}
            >
              <span>
                {draft.title.trim() || "（未命名）"}
                <Divider type="vertical" />
                <AntdTag color={draft.draft ? "orange" : "green"}>
                  {draft.draft ? "草稿" : "待发布"}
                </AntdTag>
                <span style={{ color: "grey" }}>{draft.date}</span>
              </span>
            </List.Item>
          )}
        />
      </InfoCard>
    </div>
  );
}
