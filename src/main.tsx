import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import { ConfigProvider, App as AntdApp } from "antd";
import { settings } from "./lib";

const basename =
  settings.base === "/" ? "/" : settings.base.replace(/\/+$/, "");

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);
root.render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#80cbc4",
        },
        components: {
          Layout: {
            headerBg: "white",
          },
        },
      }}
    >
      <BrowserRouter basename={basename}>
        <AntdApp>
          <App />
        </AntdApp>
      </BrowserRouter>
    </ConfigProvider>
  </React.StrictMode>
);
