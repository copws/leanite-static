import { Breadcrumb, Divider, Space, Tag } from "antd";
import InfoCard from "../components/InfoCard";
import { publishedPosts, formatDate, settings, usePageMeta } from "../lib";
import { Link } from "react-router-dom";
import { HomeOutlined } from "@ant-design/icons";
import Markdown from "../components/Markdown";

export default function Home() {
  usePageMeta(undefined, settings.desc);

  const latest = publishedPosts.slice(0, 5);

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
              title: <Link to="/home">首页</Link>,
            },
          ]}
        />
      </InfoCard>
      {latest.map((post) => (
        <InfoCard key={post.id}>
          <h2>
            <Link
              to={"/article/" + encodeURIComponent(post.id) + "/"}
              style={{ color: "black" }}
            >
              {post.title}
            </Link>
          </h2>
          <Space style={{ color: "grey", width: "100%" }}>
            发布：
            {formatDate(post.date)}
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
            <Markdown
              id={"preview-" + post.id}
              value={post.content}
              style={{ width: "100%" }}
            />
          </div>
        </InfoCard>
      ))}
    </div>
  );
}
