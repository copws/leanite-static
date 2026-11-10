import {
  Link,
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import React, { useEffect } from "react";
import InfoCard from "../components/InfoCard";
import { Space, Divider, Tag, Breadcrumb, App } from "antd";
import MetaView from "../components/MetaView";
import { HomeOutlined } from "@ant-design/icons";
import Markdown from "../components/Markdown";
import {
  formatDate,
  getPost,
  postYear,
  publishedPosts,
  settings,
  usePageMeta,
  type Post,
} from "../lib";

const Article = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const { id } = useParams();
  const legacyId = search.get("id");

  const post = id ? getPost(id) : undefined;
  usePageMeta(
    post && !post.isDraft ? post.title : "归档",
    post ? post.description : `${settings.name}的文章归档`
  );

  useEffect(() => {
    if (id && (!post || post.isDraft)) {
      message.error("文章不存在");
      navigate("/article", { replace: true });
    }
  }, [id, post, message, navigate]);

  // 兼容旧版 /article?id=xxx 的链接
  if (legacyId) {
    return (
      <Navigate
        to={"/article/" + encodeURIComponent(legacyId) + "/"}
        replace
      />
    );
  }

  if (id) {
    if (!post || post.isDraft) return null;

    return (
      <div>
        <InfoCard>
          <Breadcrumb
            items={[
              {
                title: (
                  <Link to="/home">
                    <HomeOutlined />
                  </Link>
                ),
              },
              {
                title: (
                  <Link to={"/article/" + encodeURIComponent(post.id) + "/"}>
                    {post.title}
                  </Link>
                ),
              },
            ]}
          />
        </InfoCard>
        <InfoCard>
          <h1>{post.title}</h1>
          <Space style={{ color: "grey" }}>
            发布：{formatDate(post.date)}
            <Divider type="vertical" />
            标签：
            {post.tags.length > 0
              ? post.tags.map((tag) => (
                  <Tag key={tag}>
                    <Link to={"/tag/" + encodeURIComponent(tag) + "/"}>{tag}</Link>
                  </Tag>
                ))
              : "无"}
          </Space>
          <div style={{ marginTop: "10px" }}>
            <Markdown id={"post-" + post.id} value={post.content} />
          </div>
        </InfoCard>
      </div>
    );
  }

  const groups: { year: number; posts: Post[] }[] = [];
  for (const item of publishedPosts) {
    const year = postYear(item.date);
    const last = groups[groups.length - 1];
    if (!last || last.year !== year) {
      groups.push({ year, posts: [item] });
    } else {
      last.posts.push(item);
    }
  }

  return (
    <div>
      <InfoCard>
        <Breadcrumb
          items={[
            {
              title: (
                <Link to="/home">
                  <HomeOutlined />
                </Link>
              ),
            },
            {
              title: <Link to="/article">归档</Link>,
            },
          ]}
        />
      </InfoCard>
      {groups.length > 0 ? (
        groups.map((group) => (
          <InfoCard key={group.year}>
            <h3>{group.year}</h3>
            {group.posts.map((meta) => (
              <MetaView key={meta.id} meta={meta} />
            ))}
          </InfoCard>
        ))
      ) : (
        <></>
      )}
    </div>
  );
};

export default Article;
