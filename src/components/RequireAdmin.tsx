import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isAuthenticated } from "../auth";

/**
 * 控制台路由守卫：未登录时跳到登录页，并记住原本要去的页面。
 *
 * 再次强调：这是前端门禁，只能挡住普通访客，不能保护源码级别的秘密。
 */
export default function RequireAdmin({ children }: { children: ReactNode }) {
  const location = useLocation();

  if (!isAuthenticated()) {
    return (
      <Navigate
        to="/authentication"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  return <>{children}</>;
}
