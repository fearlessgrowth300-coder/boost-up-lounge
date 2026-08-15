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
        {
          property: "og:image",
          content: "https://boost-up-lounge.vercel.app/streamboost-social.png",
        },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:image:alt", content: "StreamBoost Twitch Channel Growth Report" },
        { name: "twitter:card", content: "summary_large_image" },
        {
          name: "twitter:image",
          content: "https://boost-up-lounge.vercel.app/streamboost-social.png",
        },
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
