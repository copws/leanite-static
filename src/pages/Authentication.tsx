import React, { useState } from "react";
import {
  App,
  Button,
  Form,
  Input,
  type FormProps,
} from "antd";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import InfoCard from "../components/InfoCard";
import { usePageMeta } from "../lib";
import {
  isAuthenticated,
  isCryptoAvailable,
  signIn,
  verifyCredentials,
} from "../auth";

type FieldType = {
  username?: string;
  password?: string;
};

export default function Authentication() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);

  usePageMeta("管理员登录");

  const state = location.state as { from?: string } | null;
  const from = state?.from;
  const target =
    from && from.startsWith("/") && !from.startsWith("//")
      ? from
      : "/adminHome";

  if (isAuthenticated()) {
    return <Navigate to={target} replace />;
  }

  const onFinish: FormProps<FieldType>["onFinish"] = async (values) => {
    if (!isCryptoAvailable()) {
      message.error(
        "当前环境不支持密码校验，请通过 https 或 localhost 访问本站"
      );
      return;
    }

    setSubmitting(true);
    try {
      const ok = await verifyCredentials(
        values.username ?? "",
        values.password ?? ""
      );
      if (!ok) {
        message.error("验证失败！");
        return;
      }
      signIn();
      message.success("验证成功！");
      navigate(target, { replace: true });
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const onFinishFailed: FormProps<FieldType>["onFinishFailed"] = (
    errorInfo
  ) => {
    for (const field of errorInfo.errorFields) {
      message.error(field.errors);
    }
  };

  return (
    <InfoCard>
      <Form
        name="basic"
        labelCol={{ span: 4 }}
        wrapperCol={{ span: 18 }}
        style={{ maxWidth: 600 }}
        onFinish={onFinish}
        onFinishFailed={onFinishFailed}
        autoComplete="off"
      >
        <Form.Item wrapperCol={{ offset: 4, span: 18 }}>
          <h3>管理员登录</h3>
        </Form.Item>
        <Form.Item<FieldType>
          label="账号"
          name="username"
          rules={[{ required: true, message: "请输入管理员账号" }]}
        >
          <Input autoComplete="username" />
        </Form.Item>

        <Form.Item<FieldType>
          label="密码"
          name="password"
          rules={[{ required: true, message: "请输入管理员密码" }]}
        >
          <Input.Password autoComplete="current-password" />
        </Form.Item>

        <Form.Item wrapperCol={{ offset: 4, span: 18 }}>
          <Button type="primary" htmlType="submit" loading={submitting}>
            确认
          </Button>
        </Form.Item>
      </Form>
    </InfoCard>
  );
}
