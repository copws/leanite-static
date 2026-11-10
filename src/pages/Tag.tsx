import { List, Space, Breadcrumb } from "antd";
import InfoCard from "../components/InfoCard";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import MetaView from "../components/MetaView";
import MiniCard from "../components/MiniCard";
import {
  getPost,
  getTag,
  settings,
  tags,
  usePageMeta,
} from "../lib";
import { HomeOutlined } from "@ant-design/icons";

export default function Tag() {
  const { name } = useParams();
  const [search] = useSearchParams();
  const legacyName = search.get("name");
  const current = name ? getTag(name) : undefined;

  usePageMeta(
    name ? `标签：${name}` : "标签",
    name
      ? `标签“${name}”下的文章`
      : `${settings.name}的全部标签`
  );

  // 兼容旧版 /tag?name=xxx 的链接
  if (legacyName) {
    return (
      <Navigate to={"/tag/" + encodeURIComponent(legacyName) + "/"} replace />
    );
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
              title: <Link to="/tag">标签</Link>,
            },
          ]}
        />
        <Space
          style={{ marginTop: "15px", display: "flex", flexWrap: "wrap" }}
        >
          <Link style={{ color: "black" }} to="/tag">
            <MiniCard>
              <strong>标签总览</strong>
            </MiniCard>
          </Link>
          {tags.map((tag) => (
            <Link
              key={tag.name}
              style={{ color: "black" }}
              to={"/tag/" + encodeURIComponent(tag.name) + "/"}
            >
              <MiniCard>
                <strong>{"#" + tag.name}</strong>
              </MiniCard>
            </Link>
          ))}
        </Space>
      </InfoCard>

      <InfoCard>
        {name && tags.length > 0 ? (
          <List
            header={<div>{name}</div>}
            dataSource={current ? current.ids : []}
            renderItem={(item: string) => {
              const meta = getPost(item);
              if (!meta || meta.isDraft) return null;
              return (
                <List.Item>
                  <MetaView meta={meta} />
                </List.Item>
              );
            }}
          />
        ) : (
          <List
            header={<div>标签总览</div>}
            dataSource={tags}
            renderItem={(item) => (
              <List.Item>
                <Link to={"/tag/" + encodeURIComponent(item.name) + "/"}>
                  {item.name}
                </Link>
              </List.Item>
            )}
          />
        )}
      </InfoCard>
    </div>
  );
}
