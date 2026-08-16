export type AuditStatus = "critical" | "warning" | "review";
export type AuditClassification = "verified" | "process";

export type GrowthAuditItem = {
  id: string;
  phase: string;
  title: string;
  status: AuditStatus;
  whatItIs: string;
  whyFixIt: string;
  classification?: AuditClassification;
};

export type GrowthAuditChannel = {
  followers?: number | null;
  is_live?: boolean | null;
  description?: string | null;
  recent_videos?: unknown;
};

type AuditVideo = { viewCount?: number };

const PROCESS_ISSUE_IDS = new Set([
  // These are growth recommendations. Twitch's public API does not expose enough
  // evidence to diagnose them as current channel failures.
  "algorithmic-flags-visibility-block",
  "unoptimized-metadata-discovery-gaps",
  "poor-seo-performance",
  "weak-on-page-seo",
  "technical-seo-channel-health",
  "unfocused-audience-targeting",
  "inconsistent-unprofessional-branding",
  "low-viewer-engagement-retention",
  "awareness",
  "evaluation",
  "decision",
  "subscriber",
  "retention",
  "landing-page",
  "campaigns",
  "newsletter",
  "ads",
  "leads",
  "chat",
  "niche",
]);

export function getAuditClassification(issue: GrowthAuditItem): AuditClassification {
  return PROCESS_ISSUE_IDS.has(issue.id) ? "process" : "verified";
}

export function getAuditActionPlan(issue: GrowthAuditItem) {
  const critical = issue.status === "critical";
  return {
    priority: critical ? "High" : "Medium",
    impact: critical ? "High growth impact" : "Improves channel conversion and discovery",
    difficulty: critical ? "Focused work" : "Quick improvement",
    deadlineDays: critical ? 7 : 14,
    actions:
      getAuditClassification(issue) === "verified"
        ? [
            "Review the Twitch evidence shown in this report.",
            "Update the affected channel setting, content, schedule, or branding asset.",
            "Mark this issue complete and attach an evidence link.",
            "Refresh the analysis to confirm the backend data changed.",
          ]
        : [
            "Complete this step after the verified channel-health issues are addressed.",
            "Apply the recommendation consistently for at least two stream cycles.",
            "Track the resulting follower, view, and engagement change.",
          ],
  };
}

export function calculateHealthScore(issues: GrowthAuditItem[], completedIds: string[] = []) {
  const completed = new Set(completedIds);
  const penalty = issues.reduce((total, issue) => {
    // A recommendation is useful guidance, not a measured defect. It must never
    // reduce a channel's evidence-based score.
    if (getAuditClassification(issue) !== "verified") return total;
    if (completed.has(issue.id)) return total;
    return total + (issue.status === "critical" ? 5 : 3);
  }, 0);
  return Math.max(0, 100 - penalty);
}

const CHANNEL_VISIBILITY_AUDIT: GrowthAuditItem[] = [
  {
    id: "algorithmic-flags-visibility-block",
    phase: "Twitch Channel Health",
    title: "Algorithmic Flags & Visibility Block",
    status: "critical",
    whatItIs:
      'Twitch\'s hidden algorithms can silently "flag" your channel if it detects patterns like inconsistent streaming, low viewer-to-follower ratios, or outdated channel data. These flags actively suppress your channel, making it much harder for new viewers to find you.',
    whyFixIt:
      "If Twitch thinks your channel is inactive or low-quality, it simply won't recommend you. You'll be stuck trying to grow in stealth mode, no matter how hard you stream. Removing these flags is like getting your channel back on Twitch's radar, allowing you to actually be discovered.",
  },
  {
    id: "unoptimized-metadata-discovery-gaps",
    phase: "Twitch Channel Health",
    title: "Unoptimized Metadata & Discovery Gaps",
    status: "critical",
    whatItIs:
      "This refers to all the crucial, often hidden information that tells Twitch (and other search engines) exactly what your stream is about—your game tags, category choices, stream titles, and descriptions. If this data is vague or incorrect, Twitch struggles to connect you with the right audience.",
    whyFixIt:
      "Optimized metadata is how Twitch learns who your perfect viewer is. Without it, your stream gets lost in a sea of generic content, appearing to people who aren't interested, or not appearing at all to those who are. It's essential for targeted discovery.",
  },
  {
    id: "poor-seo-performance",
    phase: "Twitch Channel Health",
    title: "Poor SEO Performance",
    status: "warning",
    whatItIs:
      "SEO (Search Engine Optimization) isn't just for websites; it's about making your content discoverable outside of live Twitch browsing. This includes how easily your past broadcasts, clips, or even your channel page are found on Google, YouTube, or other social platforms.",
    whyFixIt:
      "Your streams are valuable content that can attract new fans even when you're offline! Low SEO means you're missing out on a massive stream of potential viewers who could convert into live followers, as your content isn't reaching them where they search.",
  },
  {
    id: "weak-on-page-seo",
    phase: "Twitch Channel Health",
    title: "Weak On-Page SEO",
    status: "warning",
    whatItIs:
      "This focuses specifically on the content on your Twitch channel page—your About Me, panels, VOD titles, and descriptions. It's about using compelling, keyword-rich text and clear calls-to-action so Twitch and human visitors instantly understand your brand and content.",
    whyFixIt:
      "Your channel page is your digital storefront. Beyond just looking good, optimized on-page SEO signals to Twitch the exact audience you're trying to reach and gives new visitors a clear reason to follow, subscribe, or even just stay and watch.",
  },
  {
    id: "technical-seo-channel-health",
    phase: "Twitch Channel Health",
    title: "Technical SEO & Channel Health",
    status: "warning",
    whatItIs:
      'This involves the underlying technical structure and health of your channel that impacts how easily Twitch can "crawl" and categorize your content. Think about things like consistent category usage, proper stream health settings, and internal linking within your Twitch ecosystem.',
    whyFixIt:
      "Your channel needs a solid technical foundation. If this 'engine' isn't running smoothly, Twitch might miscategorize your streams or struggle to push them effectively, impacting your overall visibility and making it harder for your content to gain traction.",
  },
  {
    id: "unfocused-audience-targeting",
    phase: "Twitch Channel Health",
    title: "Unfocused Audience Targeting",
    status: "critical",
    whatItIs:
      "You're attracting a broad, general audience instead of a dedicated niche that truly connects with your content. This leads to low viewer retention, inconsistent chat engagement, and makes it difficult to build a loyal, active community.",
    whyFixIt:
      "To grow big, you need loyal fans, not just random viewers. We need to identify your ideal audience and route genuine, niche-relevant viewers who care about your specific games and personality straight to your live chat. This turns casual viewers into a committed community.",
  },
  {
    id: "inconsistent-unprofessional-branding",
    phase: "Twitch Channel Health",
    title: "Inconsistent & Unprofessional Branding",
    status: "critical",
    whatItIs:
      "Your channel lacks a cohesive, professional visual identity (e.g., basic panels, missing custom banner, generic overlays). This makes it difficult for first-time visitors to perceive you as a serious, top-tier creator and build instant trust.",
    whyFixIt:
      'Your channel\'s aesthetic is your first impression. A polished brand (custom banners, attractive panels, unique overlays) instantly signals "big streamer" quality, boosting credibility and encouraging new viewers to stick around, follow, and become part of your community.',
  },
  {
    id: "low-viewer-engagement-retention",
    phase: "Twitch Channel Health",
    title: "Low Viewer Engagement & Retention",
    status: "warning",
    whatItIs:
      "While viewers might click into your stream, they're not staying for long or actively participating in chat. This signals to Twitch that your content isn't captivating enough, which in turn reduces your algorithm ranking and potential for further recommendations.",
    whyFixIt:
      "High retention and active chat signal to Twitch that your content is valuable and engaging. This boosts your channel's visibility and makes it more attractive to new viewers. Turning casual viewers into consistent chatters is key to sustained growth.",
  },
];

const GROWTH_FUNNEL_AUDIT: GrowthAuditItem[] = [
  {
    id: "awareness",
    phase: "Awareness Phase",
    title: "Discovery Blackout",
    status: "critical",
    whatItIs:
      "Your channel is effectively invisible to new, relevant viewers. Whether on Twitch, social media, or search engines, your content isn't being consistently presented to people who would love it.",
    whyFixIt:
      "If no one knows you exist, you can't grow. This phase is about opening the floodgates to genuine potential fans, which requires advanced backend optimization and targeted outreach beyond just hoping Twitch promotes you.",
  },
  {
    id: "evaluation",
    phase: "Evaluation Phase",
    title: "The Leaky Bucket",
    status: "critical",
    whatItIs:
      "New viewers are finding your stream, but they're not staying for long, following, or joining your community. This indicates a problem with your channel's first impression, stream quality, or how engaging your content is during those critical first few minutes.",
    whyFixIt:
      "It's exhausting to constantly attract new viewers if they immediately leave. Fixing this means optimizing your entire stream experience—from branding to on-stream engagement—so initial interest converts into sustained viewership and loyalty.",
  },
  {
    id: "decision",
    phase: "Decision Phase",
    title: "Missed Conversion Cues",
    status: "critical",
    whatItIs:
      "Viewers who genuinely enjoy your content aren't taking the next step—subscribing, following, or joining your Discord. This often stems from unclear calls-to-action, a lack of compelling reasons, or confusing monetization and community pathways.",
    whyFixIt:
      "You're leaving money and community growth on the table! This phase is crucial for transforming casual viewers into dedicated supporters. We need to clearly guide your fans on how to commit and why it benefits them (and you!).",
  },
  {
    id: "subscriber",
    phase: "Subscriber Phase",
    title: "Stagnant Loyalty Growth",
    status: "warning",
    whatItIs:
      "You're not effectively encouraging viewers to become paying subscribers or consistent supporters, which limits your ability to unlock essential Twitch features, stabilize income, and build a truly dedicated fan base.",
    whyFixIt:
      "Subscribers are your channel's foundation. Growing this base isn't just about income; it's about signaling to Twitch that your content has high value, which can boost your algorithmic ranking and open doors to new opportunities.",
  },
  {
    id: "retention",
    phase: "Re-evaluation & Re-subscribe Phase",
    title: "Fading Engagement",
    status: "warning",
    whatItIs:
      "Your existing followers and subscribers aren't consistently re-engaging, renewing their support, or participating in your community beyond the live stream. This suggests a need for better off-stream communication and loyalty-building strategies.",
    whyFixIt:
      "Retaining loyal fans is more impactful than constantly chasing new ones. Nurturing this phase builds long-term community strength, provides predictable support, and keeps your core audience excited and active.",
  },
  {
    id: "landing-page",
    phase: "Key Strategic Tools & Tactics",
    title: "Missing or Unoptimized Landing Page",
    status: "critical",
    whatItIs:
      "You don't have a dedicated, high-converting webpage to capture interest from external traffic (e.g., social media, ads) and effectively guide them to your Twitch channel or community.",
    whyFixIt:
      "Your landing page is your centralized hub for converting external attention. Without it, you're sending potential fans to generic links, losing a huge opportunity to introduce your brand, highlight your best content, and funnel them directly into your community.",
  },
  {
    id: "campaigns",
    phase: "Key Strategic Tools & Tactics",
    title: "Absence of Strategic Promotional Campaigns",
    status: "critical",
    whatItIs:
      'You\'re not running structured, goal-oriented campaigns (e.g., "Road to Affiliate" pushes, specific game launches, community challenges) to generate hype, attract new viewers, and rally your existing community.',
    whyFixIt:
      "Campaigns create excitement and urgency! They're essential for setting clear, measurable growth goals and activating your community to help you achieve them, leading to significant spikes in viewership, engagement, and new followers.",
  },
  {
    id: "newsletter",
    phase: "Key Strategic Tools & Tactics",
    title: "No Live Stream Newsletter Strategy",
    status: "warning",
    whatItIs:
      "You're missing an email list or newsletter strategy to communicate directly with your audience outside of Twitch, inform them of upcoming streams, share exclusive content, or simply stay top-of-mind.",
    whyFixIt:
      "Email is a powerful, direct channel to your most engaged fans that you own. Relying solely on Twitch notifications means you're at the mercy of their algorithm; a newsletter ensures your message always gets through, building a more robust connection.",
  },
  {
    id: "ads",
    phase: "Key Strategic Tools & Tactics",
    title: "Ineffective Social Media Ads (e.g., Facebook Ads)",
    status: "warning",
    whatItIs:
      "You're either not utilizing paid advertising, or your current ad campaigns are poorly targeted, have weak creative, or lack clear calls-to-action, resulting in wasted ad spend and minimal returns.",
    whyFixIt:
      "Targeted ads can dramatically accelerate growth by putting your content in front of highly specific, interested audiences who are already off Twitch. Done correctly, it's a direct, measurable pipeline to new, quality viewers and followers.",
  },
  {
    id: "leads",
    phase: "Lead Management & Content Optimization",
    title: "Uncaptured Leads & Inefficient Follow-up",
    status: "critical",
    whatItIs:
      "You're generating interest (e.g., new followers, chatters, social media interactions) but don't have a system to capture their contact info or nurture them into dedicated community members beyond a single interaction.",
    whyFixIt:
      "Every interaction is a potential lead for long-term growth. Without a system to capture and nurture these, you're constantly starting from scratch, missing crucial opportunities to build a loyal fanbase that can be engaged and monetize beyond Twitch.",
  },
  {
    id: "chat",
    phase: "Lead Management & Content Optimization",
    title: "Low-Converting Chat Conversations",
    status: "critical",
    whatItIs:
      "Your chat interactions aren't effectively converting viewers into loyal followers, subscribers, or active community members. This indicates missed opportunities for engaging, connecting, and encouraging deeper commitment during your live streams.",
    whyFixIt:
      "Chat is where true community is built and where you connect with your audience in real-time. Maximizing these conversations is crucial for transforming passive viewers into active participants and committed supporters, directly boosting retention and growth.",
  },
  {
    id: "niche",
    phase: "Lead Management & Content Optimization",
    title: "Undefined Niche Content Strategy (e.g., Roblox.txt)",
    status: "warning",
    whatItIs:
      "Your content for specific games or niches (like Roblox) lacks a clear, unique angle, consistent strategy, or proper optimization. This makes it hard to stand out in a crowded category and attract dedicated fans looking for your specific type of content.",
    whyFixIt:
      "Generic content gets lost in the shuffle. A well-defined niche strategy for your games helps you attract a highly engaged, dedicated audience who are passionate about that specific content, leading to higher retention, more authentic engagement, and organic growth.",
  },
];

export function buildGrowthAudit(channel: GrowthAuditChannel): GrowthAuditItem[] {
  const followers = channel.followers ?? 0;
  const videos = (
    Array.isArray(channel.recent_videos) ? channel.recent_videos : []
  ) as AuditVideo[];
  const averageViews = videos.length
    ? videos.reduce((total, video) => total + Number(video.viewCount ?? 0), 0) / videos.length
    : 0;
  const detected: GrowthAuditItem[] = [];

  if (!channel.is_live) {
    detected.push({
      id: "channel-offline",
      phase: "Twitch Channel Health",
      title: "CHANNEL OFFLINE — LOSING MOMENTUM",
      status: "critical",
      whatItIs:
        "The channel is currently offline, reducing opportunities for live discovery and engagement.",
      whyFixIt:
        "Going live consistently gives viewers more opportunities to discover the channel, participate in chat, follow, and return for future streams.",
    });
  }
  if (followers < 25) {
    detected.push({
      id: "affiliate-followers",
      phase: "Twitch Channel Health",
      title: "AFFILIATE FOLLOWER REQUIREMENT NOT MET",
      status: "critical",
      whatItIs: `Current: ${followers} · Required: 25 · Gap: ${25 - followers}.`,
      whyFixIt:
        "The channel must reach Twitch's follower requirement before it can complete the follower portion of the Affiliate path.",
    });
  }
  if (!channel.description || channel.description.trim().length < 80) {
    detected.push({
      id: "about-description",
      phase: "Twitch Channel Health",
      title: "ABOUT DESCRIPTION IS TOO SHORT",
      status: "warning",
      whatItIs: channel.description
        ? `The public About description is only ${channel.description.trim().length} characters.`
        : "No public About description was returned by Twitch.",
      whyFixIt:
        "A complete About description helps first-time visitors quickly understand the streamer, the content, and why they should follow.",
    });
  }
  if (videos.length && averageViews < 25) {
    detected.push({
      id: "recent-vod-reach",
      phase: "Twitch Channel Health",
      title: "RECENT VOD REACH IS LOW",
      status: "warning",
      whatItIs: `${averageViews.toFixed(1)} average public views across the latest ${videos.length} archived broadcasts.`,
      whyFixIt:
        "Low replay reach limits discovery between live streams and reduces the number of viewers who can become future followers and regulars.",
    });
  }

  return [...detected, ...CHANNEL_VISIBILITY_AUDIT, ...GROWTH_FUNNEL_AUDIT].map((issue) => ({
    ...issue,
    classification: getAuditClassification(issue),
  }));
}
