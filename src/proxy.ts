import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Skip API, Studio, Next internals and files with an extension (images, icons, robots.txt...)
  matcher: ["/((?!api|studio|_next|_vercel|.*\\..*).*)"],
};
