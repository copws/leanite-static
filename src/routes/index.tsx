import type { ReactNode } from "react";
import Tag from "../pages/Tag";
import Home from "../pages/Home";
import Article from "../pages/Article";
import Authentication from "../pages/Authentication";
import AdminHome from "../pages/admin/AdminHome";
import ModifyArticle from "../pages/admin/ModifyArticle";
import ModifyTags from "../pages/admin/ModifyTags";
import Settings from "../pages/admin/Settings";
import RequireAdmin from "../components/RequireAdmin";
import { Navigate } from "react-router-dom";

const admin = (element: ReactNode) => (
  <RequireAdmin>{element}</RequireAdmin>
);

const routes = [
  {
    path: "/",
    element: <Navigate to="/home" replace />,
  },
  {
    path: "/home",
    element: <Home />,
  },
  {
    path: "/tag",
    element: <Tag />,
  },
  {
    path: "/tag/:name",
    element: <Tag />,
  },
  {
    path: "/article",
    element: <Article />,
  },
  {
    path: "/article/:id",
    element: <Article />,
  },
  {
    path: "/authentication",
    element: <Authentication />,
  },
  {
    path: "/adminHome",
    element: admin(<AdminHome />),
  },
  {
    path: "/modifyArticle",
    element: admin(<ModifyArticle />),
  },
  {
    path: "/modifyTags",
    element: admin(<ModifyTags />),
  },
  {
    path: "/settings",
    element: admin(<Settings />),
  },
  {
    path: "*",
    element: <Navigate to="/home" replace />,
  },
];

export default routes;
