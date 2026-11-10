import React, { useEffect, useState } from "react";
import {
  Col,
  Layout,
  Row,
  Menu,
  Button,
  Space,
  Card,
  Avatar,
} from "antd";
import {
  TagsOutlined,
  ProfileOutlined,
  HomeOutlined,
  ReadOutlined,
  ControlOutlined,
  SettingOutlined,
  EditOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import { Link, useLocation, useNavigate, useRoutes } from "react-router-dom";
import { subscribe, unsubscribe } from "pubsub-js";
import routes from "./routes";
import {
  assetUrl,
  settings,
} from "./lib";
import InfoCard from "./components/InfoCard";
import Markdown from "./components/Markdown";
import { signOut } from "./auth";

const { Footer, Content } = Layout;

const items = [
  {
    key: "1",
    label: <Link to="/home">首页</Link>,
    icon: <HomeOutlined />,
  },
  {
    key: "2",
    label: <Link to="/tag">标签</Link>,
    icon: <TagsOutlined />,
  },
  {
    key: "3",
    label: <Link to="/article">归档</Link>,
    icon: <ProfileOutlined />,
  },
  {
    key: "4",
    label: "阅读",
    icon: <ReadOutlined />,
  },
  {
    key: "5",
    label: <Link to="/adminHome">控制台</Link>,
    icon: <ControlOutlined />,
  },
];

const adminItems = [
  {
    key: "5",
    label: <Link to="/adminHome">控制台</Link>,
    icon: <ControlOutlined />,
  },
  {
    key: "6",
    label: <Link to="/modifyArticle">文章管理</Link>,
    icon: <EditOutlined />,
  },
  {
    key: "7",
    label: <Link to="/modifyTags">标签管理</Link>,
    icon: <TagsOutlined />,
  },
  {
    key: "8",
    label: <Link to="/settings">设置</Link>,
    icon: <SettingOutlined />,
  },
];

function App() {
  const route = useRoutes(routes);
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedKeys, setSelectedKeys] = useState<string[]>(["1"]);
  const [useAdminMenu, setUseAdminMenu] = useState<boolean>(false);
  const [showSidebar, setShowSidebar] = useState(true);

  useEffect(() => {
    const openSidebar = () => setShowSidebar(true);
    const closeSidebar = () => setShowSidebar(false);
    const openToken = subscribe("openSidebar", openSidebar);
    const closeToken = subscribe("closeSidebar", closeSidebar);

    return () => {
      unsubscribe(openToken);
      unsubscribe(closeToken);
    };
  }, []);

  useEffect(() => {
    const pathname = location.pathname;

    if (
      pathname.startsWith("/adminHome") ||
      pathname.startsWith("/modify") ||
      pathname.startsWith("/settings")
    ) {
      setUseAdminMenu(true);
      if (pathname.startsWith("/modifyArticle")) setSelectedKeys(["6"]);
      else if (pathname.startsWith("/modifyTags")) setSelectedKeys(["7"]);
      else if (pathname.startsWith("/settings")) setSelectedKeys(["8"]);
      else setSelectedKeys(["5"]);
      return;
    }

    setUseAdminMenu(false);
    if (pathname.startsWith("/tag")) setSelectedKeys(["2"]);
    else if (pathname === "/article" || pathname === "/article/")
      setSelectedKeys(["3"]);
    else if (pathname.startsWith("/article/")) setSelectedKeys(["4"]);
    else setSelectedKeys(["1"]);
  }, [location.pathname]);

  useEffect(() => {
    const icon = assetUrl(settings.blogIcon);
    if (!icon) return;
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = icon;
  }, []);

  const onAuthPage = location.pathname.startsWith("/authentication");
  const publicItems = onAuthPage ? items.slice(0, 4) : items;
  const handleSignOut = () => {
    signOut();
    navigate("/home");
  };

  return (
    <Layout
      className="App"
      style={{ backgroundColor: "#fafafa", width: "100%" }}
    >
      <Content>
        {!showSidebar && useAdminMenu ? (
          <div
            style={{
              position: "fixed",
              top: "14px",
              right: "24px",
              zIndex: 1000,
            }}
          >
            <Button
              type="text"
              size="small"
              icon={<LogoutOutlined />}
              onClick={handleSignOut}
            >
              退出登录
            </Button>
          </div>
        ) : null}
        <Row>
          <Col span={2} />
          <Col span={showSidebar ? 12 : 20}>{route}</Col>
          <Col span={showSidebar ? 1 : 2} />
          {showSidebar ? (
            <Col span={7}>
              {!useAdminMenu ? (
                <>
                  <InfoCard>
                    <div
                      style={{
                        paddingLeft: "20px",
                        paddingRight: "20px",
                      }}
                    >
                      <Markdown
                        id="bulletin"
                        value={"#### 公告\n\n" + settings.bulletin}
                      />
                    </div>
                  </InfoCard>
                  <Card
                    style={{
                      marginTop: "30px",
                      borderRadius: "7px",
                      boxShadow: "0 0 40px 0px rgba(0,0,0,0.04)",
                      width: "100%",
                    }}
                  >
                    <Card.Meta
                      avatar={<Avatar src={assetUrl(settings.avatarURL)} />}
                      title={settings.name}
                      description={settings.desc}
                    />
                  </Card>
                </>
              ) : (
                <InfoCard>
                  <strong>Leanite Static 控制台</strong>
                  <p>
                    文章来自项目里的 Markdown 文件，构建时统一打包成页面。
                    控制台用于写作、生成配置和查看标签，不会再改动线上数据。
                  </p>
                  <Space wrap>
                    <Button
                      type="primary"
                      onClick={() => navigate("/adminHome")}
                    >
                      前往控制台
                    </Button>
                    <Button
                      icon={<LogoutOutlined />}
                      onClick={handleSignOut}
                    >
                      退出登录
                    </Button>
                  </Space>
                </InfoCard>
              )}
              <InfoCard>
                {useAdminMenu ? (
                  <Menu
                    mode="inline"
                    theme="light"
                    items={adminItems}
                    defaultSelectedKeys={["5"]}
                    selectedKeys={selectedKeys}
                    selectable={false}
                  />
                ) : (
                  <Menu
                    mode="inline"
                    theme="light"
                    items={publicItems}
                    defaultSelectedKeys={["1"]}
                    selectedKeys={selectedKeys}
                    selectable={false}
                  />
                )}
              </InfoCard>
              <div
                style={{
                  marginTop: "30px",
                  width: "100%",
                  color: "lightgrey",
                }}
              >
                Leanite Blog, 版本 {settings.version}
              </div>
            </Col>
          ) : (
            <></>
          )}
        </Row>
      </Content>
      <Footer style={{ backgroundColor: "rgba(0,0,0,0)" }} />
    </Layout>
  );
}

export default App;
