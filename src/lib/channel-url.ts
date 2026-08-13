export type ParsedChannel = { platform: "twitch" | "kick" | "youtube"; username: string; url: string };

export function parseChannelUrl(raw: string): ParsedChannel | null {
  const value = raw.trim();
  if (!value) return null;
  const withProtocol = value.startsWith("http") ? value : `https://${value}`;

  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^(www|m)\./, "").toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);

  if (host.endsWith("twitch.tv")) {
    const username = segments[0];
    if (!username) return null;
    return { platform: "twitch", username: username.toLowerCase(), url: `https://twitch.tv/${username}` };
  }

  if (host.endsWith("kick.com")) {
    const username = segments[0];
    if (!username) return null;
    return { platform: "kick", username: username.toLowerCase(), url: `https://kick.com/${username}` };
  }

  if (host.endsWith("youtube.com") || host === "youtu.be") {
    const handle = segments.find((s) => s.startsWith("@")) ?? segments[segments.length - 1];
    if (!handle) return null;
    return {
      platform: "youtube",
      username: handle.replace(/^@/, "").toLowerCase(),
      url: `https://youtube.com/${handle.startsWith("@") ? handle : `@${handle}`}`,
    };
  }

  return null;
}