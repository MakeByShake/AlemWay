import { notFound } from "next/navigation";

// Any unknown path inside /ru or /kk shows the localized 404 page.
export default function CatchAll() {
  notFound();
}
