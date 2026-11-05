import "server-only";

export const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Sends an HTML message to the team channel. Returns false if Telegram is not configured or failed. */
export async function sendTelegram(lines: (string | false | null | undefined)[]): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines.filter((x): x is string => typeof x === "string").join("\n"),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) console.error("[telegram] failed", res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error("[telegram] failed", err);
    return false;
  }
}
