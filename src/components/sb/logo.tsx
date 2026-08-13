export function Logo({ suffix }: { suffix?: string }) {
  return (
    <span className="font-display text-2xl font-extrabold tracking-tight">
      Stream<span className="text-neon">Boost</span>
      {suffix ? <span className="text-foreground"> {suffix}</span> : null}
    </span>
  );
}