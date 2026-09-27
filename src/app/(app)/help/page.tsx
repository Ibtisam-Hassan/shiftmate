import { TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { type Block, topicsFor } from "@/content/help";
import { requireActor } from "@/server/authz/actor";

export const metadata = { title: "Help" };

function HelpBlock({ block }: { block: Block }) {
  if ("p" in block) return <p>{block.p}</p>;
  if ("steps" in block) return <ol className="list-decimal space-y-1 pl-5">{block.steps.map((s) => <li key={s}>{s}</li>)}</ol>;
  if ("list" in block) return <ul className="list-disc space-y-1 pl-5">{block.list.map((s) => <li key={s}>{s}</li>)}</ul>;
  return (
    <p className="flex gap-2 rounded-md border-l-4 border-warning bg-warning-bg p-3">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      <span>{block.note}</span>
    </p>
  );
}

export default async function HelpPage() {
  const actor = await requireActor();
  const topics = topicsFor(actor.role);
  return (
    <>
      <PageHeader title="Help" description="How ShiftMate works. Pick a topic." />
      <div className="grid gap-8 lg:grid-cols-[14rem_1fr]">
        <nav aria-label="Help topics" className="lg:sticky lg:top-20 lg:self-start">
          <ul className="grid gap-1 text-sm">
            {topics.map((t) => (
              <li key={t.id}><a href={`#${t.id}`} className="block rounded px-2 py-1 text-muted-foreground hover:bg-accent hover:text-foreground">{t.title}</a></li>
            ))}
          </ul>
        </nav>
        <div className="grid max-w-[68ch] gap-10">
          {topics.map((t) => (
            <section key={t.id} id={t.id} aria-labelledby={`${t.id}-h`} className="scroll-mt-20">
              <h2 id={`${t.id}-h`} className="mb-3 font-numeric text-2xl leading-none">{t.title}</h2>
              <div className="grid gap-3 leading-relaxed">
                {t.blocks.map((b, i) => <HelpBlock key={i} block={b} />)}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
