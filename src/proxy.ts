import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Skip API, Studio, the app's start screen (/app), cabinet login links (/c/...), Next internals and files with an extension (images, icons, robots.txt...)
  matcher: ["/((?!api|studio|admin|pitch|app$|app/|c/|_next|_vercel|.*\\..*).*)"],
};
