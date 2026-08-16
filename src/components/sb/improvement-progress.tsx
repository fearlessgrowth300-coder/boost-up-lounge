type Snapshot = {
  recorded_at: string;
  followers: number;
  viewer_count: number;
  health_score: number;
};

export function ImprovementProgress({ snapshots }: { snapshots: Snapshot[] }) {
  const ordered = [...snapshots].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
  );
  const first = ordered[0];
  const latest = ordered.at(-1);
  const hasHistory = ordered.length >= 2 && first && latest;
  const followerChange = hasHistory ? latest.followers - first.followers : 0;
  const viewerChange = hasHistory ? latest.viewer_count - first.viewer_count : 0;
  const healthChange = hasHistory ? latest.health_score - first.health_score : 0;
  const healthValues = ordered.map((snapshot) => snapshot.health_score);
  const min = Math.min(...healthValues, 0);
  const max = Math.max(...healthValues, 100);
  const points = ordered.length > 1
    ? ordered.map((snapshot, index) => {
        const x = (index / (ordered.length - 1)) * 100;
        const y = 100 - ((snapshot.health_score - min) / Math.max(1, max - min)) * 82 - 9;
        return `${x},${y}`;
      }).join(" ")
    : "";

  return (
    <section className="sb-card overflow-hidden">
      <div className="border-b border-border bg-gradient-to-r from-cyan/10 via-neon/10 to-transparent p-6">
        <h2 className="font-display text-xl font-bold">Improvement Progress Over Time</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Progress is recorded each time the channel is refreshed from Twitch.
        </p>
      </div>
      {!hasHistory ? (
        <div className="p-6 text-sm text-muted-foreground">
          Baseline captured. Refresh this channel again after changes or a new stream to start showing verified progress.
        </div>
      ) : (
        <div className="p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Metric label="Follower growth" value={followerChange} suffix="followers" />
            <Metric label="Viewer change" value={viewerChange} suffix="viewers" />
            <Metric label="Health Score change" value={healthChange} suffix="points" />
          </div>
          <div className="mt-6 rounded-xl border border-border bg-secondary/30 p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Health Score trend</span>
              <span>{ordered.length} saved checks</span>
            </div>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mt-3 h-32 w-full overflow-visible">
              <line x1="0" x2="100" y1="91" y2="91" stroke="currentColor" className="text-border" strokeWidth="1" />
              <polyline points={points} fill="none" stroke="currentColor" className="text-neon" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
              {ordered.map((snapshot, index) => {
                const x = (index / (ordered.length - 1)) * 100;
                const y = 100 - ((snapshot.health_score - min) / Math.max(1, max - min)) * 82 - 9;
                return <circle key={snapshot.recorded_at} cx={x} cy={y} r="2.5" className="fill-neon" />;
              })}
            </svg>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>{new Date(first.recorded_at).toLocaleDateString()}</span>
              <span>{new Date(latest.recorded_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value, suffix }: { label: string; value: number; suffix: string }) {
  const positive = value >= 0;
  return (
    <div className="rounded-xl bg-secondary/60 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${positive ? "text-neon" : "text-destructive"}`}>
        {positive ? "+" : ""}{value.toLocaleString()} <span className="text-sm">{suffix}</span>
      </p>
    </div>
  );
}
