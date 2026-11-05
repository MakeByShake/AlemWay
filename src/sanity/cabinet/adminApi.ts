import { useCallback } from "react";
import { useClient } from "sanity";

/**
 * Calls the site's /api/admin/* endpoints from the Studio.
 * The server checks the manager's Sanity login token (the Studio uses token login, see sanity.config.ts).
 */
export function useAdminFetch() {
  const client = useClient({ apiVersion: "2025-10-01" });
  return useCallback(
    async (path: string, init: RequestInit = {}) => {
      const token = client.config().token;
      if (!token) throw new Error("Нет входа в админку. Обновите страницу и войдите снова.");
      const res = await fetch(path, {
        ...init,
        headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        let msg = `Ошибка ${res.status}`;
        try {
          const j = await res.json();
          if (j?.message) msg = j.message;
        } catch {}
        throw new Error(msg);
      }
      return res;
    },
    [client]
  );
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
