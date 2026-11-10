/// <reference types="vite/client" />

declare module "virtual:leanite-content" {
  import type { SiteContent } from "./types";

  const content: SiteContent;
  export default content;
}
