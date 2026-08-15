import { createFileRoute } from "@tanstack/react-router";
import { ChannelReport } from "./channel-preview.$id";

export const Route = createFileRoute("/r/$username")({
  head: ({ params }) => {
    const title = `${params.username} Channel Growth Report — StreamBoost`;
    const description = `View ${params.username}'s public Twitch channel health, growth opportunities and promotion report on StreamBoost.`;

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:site_name", content: "StreamBoost" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
    };
  },
  component: FriendlyChannelReport,
});

function FriendlyChannelReport() {
  const { username } = Route.useParams();
  return <ChannelReport identifier={username} />;
}
