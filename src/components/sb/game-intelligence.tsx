import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Gamepad2 } from "lucide-react";
import { getGameIntelligence } from "@/lib/streamboost.functions";

export function GameIntelligencePanel({ category }: { category: string | null | undefined }) {
  const gameFn = useServerFn(getGameIntelligence);
  const { data: game } = useQuery({
    queryKey: ["igdb-game-intelligence", category],
    queryFn: () => gameFn({ data: { category: category! } }),
    enabled: Boolean(category),
    staleTime: 6 * 60 * 60 * 1000,
  });

  if (!game) return null;
  return (
    <section className="overflow-hidden rounded-xl border border-cyan/30 bg-cyan/5">
      <div className="flex items-center gap-2 border-b border-cyan/20 px-5 py-4">
        <Gamepad2 className="size-5 text-cyan" />
        <div>
          <h3 className="font-display font-bold">Game Intelligence</h3>
          <p className="text-xs text-muted-foreground">Game data powered by IGDB</p>
        </div>
      </div>
      <div className="flex gap-4 p-5">
        {game.coverUrl ? (
          <img src={game.coverUrl} alt={`${game.name} cover`} className="h-28 w-20 rounded-lg object-cover" />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-display text-lg font-bold">{game.name}</h4>
            {game.rating ? <span className="rounded-full bg-neon/15 px-2 py-0.5 text-xs font-bold text-neon">{game.rating}/100</span> : null}
          </div>
          {game.summary ? <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{game.summary}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {game.genres.slice(0, 3).map((genre) => <span key={genre} className="rounded-full bg-secondary px-2 py-1">{genre}</span>)}
            {game.platforms.slice(0, 3).map((platform) => <span key={platform} className="rounded-full bg-secondary px-2 py-1">{platform}</span>)}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
            {game.releaseDate ? <span>Released {new Date(game.releaseDate).getFullYear()}</span> : null}
            {game.igdbUrl ? <a href={game.igdbUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-cyan">View on IGDB <ExternalLink className="size-3" /></a> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
