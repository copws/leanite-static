import React from "react";
import type { PostMeta } from "../lib";
import { Space, Tag } from "antd";
import { Link } from "react-router-dom";
import { formatDate } from "../lib";

const MetaView = (props: { meta: PostMeta }) => {
  const { meta } = props;

  return (
    <Space direction="horizontal">
      <strong>
        <Link
          to={"/article/" + encodeURIComponent(meta.id) + "/"}
          style={{ color: "black" }}
        >
          {meta.title}
        </Link>
      </strong>
      {meta.tags.map((tag) => (
        <Tag key={tag}>
          <Link to={"/tag/" + encodeURIComponent(tag) + "/"}>{tag}</Link>
        </Tag>
      ))}
      <div style={{ color: "grey" }}>{formatDate(meta.date)}</div>
    </Space>
  );
};

export default MetaView;
