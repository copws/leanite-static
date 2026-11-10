import React from "react";
import { Button, Divider, List, Space, Tag as AntdTag } from "antd";
import { Link, useSearchParams } from "react-router-dom";
import InfoCard from "../../components/InfoCard";
import { getPost, getTag, tags, usePageMeta } from "../../lib";

export default function ModifyTags() {
  const [search] = useSearchParams();
  const name = search.get("name");
  const current = name ? getTag(name) : undefined;

  usePageMeta("标签总览");

  return (
    <div>
      <InfoCard>
        {name && tags.length > 0 ? (
          <List
            header={<div>{name}</div>}
            dataSource={current ? current.ids : []}
            footer={
              <Space style={{ float: "right" }}>
                <Link to={"/tag/" + encodeURIComponent(name)}>
                  <Button>查看公开页面</Button>
                </Link>
                <Link to="/modifyTags">
                  <Button>返回上一级</Button>
                </Link>
              </Space>
            }
            renderItem={(item: string) => {
              const meta = getPost(item);
              if (!meta || meta.isDraft) return null;
              return (
                <List.Item>
                  <Link to={"/article/" + encodeURIComponent(meta.id)}>
                    {meta.title}
                    <Divider type="vertical" />
                    <AntdTag color="green">已发布</AntdTag>
                  </Link>
                </List.Item>
              );
            }}
          />
        ) : (
          <List
            header={<div>标签总览</div>}
            pagination={{
              position: "bottom",
              align: "center",
              pageSize: 5,
              total: tags.length,
            }}
            dataSource={tags}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Link
                    key="view"
                    to={"/modifyTags?name=" + encodeURIComponent(item.name)}
                  >
                    <Button>查看文章</Button>
                  </Link>,
                ]}
              >
                <Link
                  to={"/modifyTags?name=" + encodeURIComponent(item.name)}
                >
                  {item.name}
                </Link>
                <span style={{ color: "grey", marginLeft: "12px" }}>
                  {item.count} 篇
                </span>
              </List.Item>
            )}
          />
        )}
      </InfoCard>

      <InfoCard>
        <strong>关于标签</strong>
        <p style={{ marginBottom: 0 }}>
          标签由文章 front matter 里的 <code>tags</code> 自动汇总，不再需要单独维护。
          要新增、重命名或删除标签，直接修改对应 Markdown 文件后重新构建即可。
          标签里不能包含 <code>\ / : * ? " &lt; &gt; | # %</code> 这些字符。
        </p>
      </InfoCard>
    </div>
  );
}
