import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Save, Store } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/sb/app-header";
import { useAppAuth } from "@/hooks/use-app-auth";
import { getAccountSettings, saveAccountSettings } from "@/lib/streamboost.functions";

export const Route = createFileRoute("/account")({ component: AccountPage });

function AccountPage() {
  const ready = useAppAuth();
  const queryClient = useQueryClient();
  const settingsFn = useServerFn(getAccountSettings);
  const saveSettingsFn = useServerFn(saveAccountSettings);
  const [fiverrProfileUrl, setFiverrProfileUrl] = useState("");
  const { data, isPending } = useQuery({
    queryKey: ["account-settings"],
    queryFn: () => settingsFn({}),
    enabled: ready,
  });

  useEffect(() => {
    if (data) setFiverrProfileUrl(data.fiverrProfileUrl ?? "");
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      saveSettingsFn({ data: { fiverrProfileUrl: fiverrProfileUrl.trim() || null } }),
    onSuccess: async () => {
      toast.success("Campaign purchase link saved.");
      await queryClient.invalidateQueries({ queryKey: ["account-settings"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not save account settings."),
  });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-5 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-extrabold">Account settings</h1>
            <p className="mt-2 text-muted-foreground">
              Configure the campaign checkout destination used by your streamer reports.
            </p>
          </div>
          <Store className="size-8 text-neon" />
        </div>

        <section className="mt-8 sb-card p-6">
          <h2 className="font-display text-xl font-bold">Fiverr campaign link</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Add your Fiverr seller profile or campaign gig URL. Every “Purchase Campaign Token”
            button on your public streamer reports will use this link.
          </p>
          <label className="mt-5 block text-sm font-semibold" htmlFor="fiverr-url">
            Fiverr profile or gig URL
          </label>
          <input
            id="fiverr-url"
            value={fiverrProfileUrl}
            onChange={(event) => setFiverrProfileUrl(event.target.value)}
            placeholder="https://www.fiverr.com/your_seller_name"
            disabled={isPending}
            className="mt-2 w-full rounded-lg border border-border bg-input px-4 py-3 text-sm outline-none focus:border-neon"
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={save.isPending || isPending}
              onClick={() => save.mutate()}
              className="inline-flex items-center gap-2 rounded-lg bg-neon px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              <Save className="size-4" /> {save.isPending ? "Saving…" : "Save campaign link"}
            </button>
            {data?.fiverrProfileUrl ? (
              <a
                href={data.fiverrProfileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-bold"
              >
                Test saved link <ExternalLink className="size-4" />
              </a>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
