import { timeAgo } from "~/lib/radar/format";
import type { HfModel, NewsItem } from "~/lib/radar/types";

function ModelCard({ m }: { m: HfModel }) {
  const t2v = m.pipeline === "text-to-video";
  return (
    <a
      href={`https://huggingface.co/${m.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="min-w-[280px] rounded border border-outline-variant bg-surface-container-high p-4 transition-colors hover:border-primary"
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="material-symbols-outlined notranslate text-[22px] text-primary">smart_toy</span>
        <p className="truncate font-body-sm text-body-sm font-bold text-on-surface">{m.id}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-on-surface-variant">
        <span
          className={`rounded px-2 py-0.5 font-medium ${t2v ? "bg-primary/15 text-primary" : "bg-surface-variant text-on-surface-variant"}`}
        >
          {t2v ? "텍스트→영상" : "이미지→영상"}
        </span>
        <span>❤️ {m.likes.toLocaleString()}</span>
        <span>⬇️ {m.downloads.toLocaleString()}</span>
        {m.createdAt && <span>{m.createdAt.slice(0, 10)}</span>}
      </div>
    </a>
  );
}

function ModelRow({ title, tag, models }: { title: string; tag: string; models: HfModel[] }) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <h3 className="font-headline-sm text-headline-sm text-on-surface">{title}</h3>
        <span className="rounded border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
          {tag}
        </span>
      </div>
      {models.length ? (
        <div className="custom-scrollbar flex gap-card-gap overflow-x-auto pb-4">
          {models.map((m) => (
            <ModelCard key={m.id} m={m} />
          ))}
        </div>
      ) : (
        <p className="py-6 text-center font-body-sm text-body-sm text-on-surface-variant">모델이 없습니다.</p>
      )}
    </div>
  );
}

export function AiPanel({
  models,
  news,
  nowMs,
}: {
  models: { latest: HfModel[]; trending: HfModel[] };
  news: NewsItem[];
  nowMs: number;
}) {
  return (
    <div className="space-y-8">
      <ModelRow title="새로 나온 영상 생성 모델" tag="HuggingFace" models={models.latest} />
      <ModelRow title="트렌딩 모델" tag="AI Tech" models={models.trending} />
      <div className="border-t border-outline-variant pt-8">
        <h3 className="mb-4 font-headline-sm text-headline-sm text-on-surface">AI 트렌드 뉴스</h3>
        <div className="space-y-2">
          {news.slice(0, 20).map((n, i) => (
            <a
              key={i}
              href={n.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 rounded border border-outline-variant/30 bg-surface-container-low p-3 transition-colors hover:bg-surface-container"
            >
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${n.region === "국내" ? "bg-primary/10 text-primary" : "bg-surface-variant text-on-surface-variant"}`}
              >
                {n.region}
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 font-body-md text-body-md font-medium text-on-surface">{n.title}</p>
                <span className="text-[10px] text-on-surface-variant">
                  {(n.source ? n.source + " · " : "") + timeAgo(n.ts, nowMs)}
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
