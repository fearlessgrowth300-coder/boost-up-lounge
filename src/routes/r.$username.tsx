import { createFileRoute } from "@tanstack/react-router";
import { ChannelReport } from "./channel-preview.$id";

export const Route = createFileRoute("/r/$username")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.username} Channel Growth Report — StreamBoost` },
      { name: "description", content: `Public Twitch growth report for ${params.username}.` },
    ],
  }),
  component: FriendlyChannelReport,
});

function FriendlyChannelReport() {
  const { username } = Route.useParams();
  return <ChannelReport identifier={username} />;
}
