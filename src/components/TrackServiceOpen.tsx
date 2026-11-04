"use client";

import { useEffect } from "react";
import { trackGoal } from "@/lib/analytics";

export function TrackServiceOpen({ slug }: { slug: string }) {
  useEffect(() => {
    trackGoal("service_open", { service: slug });
  }, [slug]);
  return null;
}
