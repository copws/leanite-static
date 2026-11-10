import React, { useState } from "react";
import { App, Avatar, Button, Input, Space } from "antd";
import InfoCard from "../../components/InfoCard";
import OptionCard from "../../components/OptionCard";
import {
  assetUrl,
  normalizeBasePath,
  settings,
  usePageMeta,
} from "../../lib";
import { copyText, downloadText } from "../../download";
import type { BlogSettings } from "../../types";
import {
  getCredentials,
  hashPassword,
  isCryptoAvailable,
  setCredentials,
  type AdminCredentials,
} from "../../auth";
import { MdEditor } from "md-editor-rt";
import "md-editor-rt/lib/style.css";

export default function Settings() {
  const { message } = App.useApp();
  usePageMeta("站点设置");

  const [form, setForm] = useState<BlogSettings>(() => {
    const credentials = getCredentials();
    return {
      ...settings,
      adminUsername: credentials.username,
      adminPasswordHash: credentials.passwordHash,
    };
  });
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");

  const update = (patch: Partial<BlogSettings>) =>
    setForm((previous) => ({ ...previous, ...patch }));

  const reset = () => {
    const credentials = getCredentials();
    setForm({
      ...settings,
      adminUsername: credentials.username,
      adminPasswordHash: credentials.passwordHash,
    });
    setNewPassword("");
    setConfirmPassword("");
    message.info("已恢复为当前构建使用的配置");
  };

  /** 校验账号设置；没有填写新密码时沿用现有哈希 */
  const resolveCredentials = async (): Promise<AdminCredentials | null> => {
    const username = form.adminUsername.trim();
    if (!username) {
      message.error("管理员用户名不能为空");
      return null;
    }

    if (!newPassword && !confirmPassword) {
      return { username, passwordHash: form.adminPasswordHash };
    }
    if (!newPassword) {
      message.error("请输入新密码");
      return null;
    }
    if (newPassword !== confirmPassword) {
      message.error("两次输入的密码不一致");
      return null;
    }
    if (!isCryptoAvailable()) {
      message.error(
        "当前环境不支持密码哈希，请通过 https 或 localhost 访问本站"
      );
      return null;
    }

    try {
      return { username, passwordHash: await hashPassword(newPassword) };
    } catch (error) {
      message.error((error as Error).message);
      return null;
    }
  };

  const buildConfig = (
    credentials: AdminCredentials
  ): BlogSettings | null => {
    if (!form.name.trim()) {
      message.error("站点名称不能为空");
      return null;
    }
    if (!form.title.trim()) {
      message.error("网站标题不能为空");
      return null;
    }

    return {
      ...form,
      title: form.title.trim(),
      name: form.name.trim(),
      desc: form.desc.trim(),
      avatarURL: form.avatarURL.trim(),
      blogIcon: form.blogIcon.trim(),
      bulletin: form.bulletin,
      siteURL: form.siteURL.trim()
        ? form.siteURL.trim().endsWith("/")
          ? form.siteURL.trim()
          : `${form.siteURL.trim()}/`
        : "",
      base: normalizeBasePath(form.base),
      version: form.version.trim() || "0.3.1",
      language: form.language.trim() || "zh-CN",
      adminUsername: credentials.username,
      adminPasswordHash: credentials.passwordHash,
    };
  };

  const applyCredentials = (credentials: AdminCredentials) => {
    setCredentials(credentials);
    update({
      adminUsername: credentials.username,
      adminPasswordHash: credentials.passwordHash,
    });
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleGenerate = async () => {
    const credentials = await resolveCredentials();
    if (!credentials) return;
    const config = buildConfig(credentials);
    if (!config) return;

    downloadText(
      "blog.config.json",
      `${JSON.stringify(config, null, 2)}\n`
    );
    applyCredentials(credentials);
    message.success(
      "已生成 blog.config.json。新账号已在当前浏览器生效；替换文件并重新构建后对所有访客生效。",
      7
    );
  };

  const handleCopy = async () => {
    const credentials = await resolveCredentials();
    if (!credentials) return;
    const config = buildConfig(credentials);
    if (!config) return;

    const ok = await copyText(`${JSON.stringify(config, null, 2)}\n`);
    if (!ok) {
      message.error("复制失败，请改用“生成配置文件”");
      return;
    }
    applyCredentials(credentials);
    message.success(
      "配置已复制。新账号已在当前浏览器生效；替换文件并重新构建后对所有访客生效。",
      7
    );
  };

  const handleSaveAccount = async () => {
    const credentials = await resolveCredentials();
    if (!credentials) return;
    applyCredentials(credentials);
    message.success(
      "账号已更新，当前浏览器立即生效。要发布给所有访客，请生成配置并重新构建。",
      6
    );
  };

  return (
    <>
      <InfoCard>
        <Space style={{ width: "100%" }} wrap>
          <h2>设置</h2>
          <Button onClick={reset}>撤销</Button>
          <Button onClick={handleCopy}>复制配置</Button>
          <Button type="primary" onClick={handleGenerate}>
            生成配置文件
          </Button>
        </Space>
        <p style={{ color: "grey", marginBottom: 0 }}>
          静态博客的设置写在项目根目录的 <code>blog.config.json</code> 里。
          这里可以先生成一份，替换文件后运行 <code>npm run build</code> 生效；
          其中「部署路径」改变后还需要重新启动 <code>npm run dev</code>。
        </p>
        <h3>个人信息</h3>
        <OptionCard>
          名称：
          <Input
            value={form.name}
            onChange={(event) => update({ name: event.currentTarget.value })}
            placeholder="取个名字吧……"
          />
        </OptionCard>
        <OptionCard>
          简介：
          <Input
            value={form.desc}
            onChange={(event) => update({ desc: event.currentTarget.value })}
          />
        </OptionCard>
        <OptionCard>
          头像 URL：
          <Input
            value={form.avatarURL}
            onChange={(event) =>
              update({ avatarURL: event.currentTarget.value })
            }
            placeholder="头像 URL，或 /images/avatar.png"
          />
          <Avatar src={assetUrl(form.avatarURL)} />
        </OptionCard>
      </InfoCard>

      <InfoCard>
        <h3>公告板</h3>
        <OptionCard>
          <Space direction="vertical">公告信息（支持 MarkDown 语法）：</Space>
        </OptionCard>
      </InfoCard>
      <MdEditor
        value={form.bulletin}
        onChange={(value) => update({ bulletin: value })}
        placeholder="写些什么吧……"
        style={{
          marginTop: "30px",
          border: 0,
        }}
      />

      <InfoCard>
        <h3>博客配置</h3>
        <OptionCard>
          网站标题（浏览器标签页显示）：
          <Input
            value={form.title}
            onChange={(event) => update({ title: event.currentTarget.value })}
            placeholder="Leanite 博客"
          />
        </OptionCard>
        <OptionCard>
          网站图标 URL（浏览器标签页）：
          <Input
            value={form.blogIcon}
            onChange={(event) =>
              update({ blogIcon: event.currentTarget.value })
            }
            placeholder="图标 URL 或 /images/icon.png"
          />
        </OptionCard>
        <OptionCard>
          网站地址（用于 canonical 和 sitemap，留空则不生成）：
          <Input
            value={form.siteURL}
            onChange={(event) => update({ siteURL: event.currentTarget.value })}
            placeholder="https://example.com/"
          />
        </OptionCard>
        <OptionCard>
          部署路径：
          <Input
            value={form.base}
            onChange={(event) => update({ base: event.currentTarget.value })}
            placeholder="/leanite/"
          />
        </OptionCard>
        <OptionCard>
          版本号：
          <Input
            value={form.version}
            onChange={(event) => update({ version: event.currentTarget.value })}
            placeholder="0.3.1"
          />
        </OptionCard>
      </InfoCard>

      <InfoCard>
        <h3>管理员账号</h3>
        <p style={{ color: "grey" }}>
          用于进入控制台。默认用户名和密码均为 <code>admin</code>；
          密码只保存 SHA-256 哈希，不会保存明文。
        </p>
        <OptionCard>
          用户名：
          <Input
            value={form.adminUsername}
            onChange={(event) =>
              update({ adminUsername: event.currentTarget.value })
            }
            placeholder="admin"
          />
        </OptionCard>
        <OptionCard>
          新密码：
          <Input.Password
            value={newPassword}
            onChange={(event) => setNewPassword(event.currentTarget.value)}
            placeholder="留空表示不修改"
            autoComplete="new-password"
          />
        </OptionCard>
        <OptionCard>
          确认新密码：
          <Input.Password
            value={confirmPassword}
            onChange={(event) =>
              setConfirmPassword(event.currentTarget.value)
            }
            placeholder="再次输入新密码"
            autoComplete="new-password"
          />
        </OptionCard>
        <Space>
          <Button onClick={handleSaveAccount}>保存账号到本浏览器</Button>
        </Space>
        <p style={{ color: "grey", marginBottom: 0 }}>
          「保存账号到本浏览器」立即生效；要发布给所有访客，请点上方
          「生成配置文件」，替换后重新构建。
        </p>
      </InfoCard>

      <InfoCard>
        <strong>提示</strong>
        <p style={{ marginBottom: 0 }}>
          部署在域名根目录时，部署路径填 <code>/</code>；
          部署在 GitHub Pages 的仓库子路径（例如 copws.github.io/leanite-static/）时，
          填 <code>/leanite-static/</code>。这个值同时决定静态资源路径和页面路由前缀，
          写错会导致页面白屏或图片 404。
        </p>
      </InfoCard>
    </>
  );
}
