import { useCallback, useEffect, useRef, useState } from "react";
import { AccountManager } from "~/components/radar/AccountManager";
import { AiPanel } from "~/components/radar/AiPanel";
import { PostList, VerticalGrid, VideoGrid } from "~/components/radar/cards";
import { PlayerModal } from "~/components/radar/PlayerModal";
import { RadarTabs } from "~/components/radar/RadarTabs";
import { SortMenu } from "~/components/radar/SortMenu";
import { CATEGORY_LIST } from "~/lib/radar/constants";
import { updatedAt } from "~/lib/radar/format";
import type {
  HfModel,
  NewsItem,
  RadarTab,
  Reel,
  SortOption,
  ThreadPost,
  TikTokPost,
  Video,
  XPost,
} from "~/lib/radar/types";

export function meta() {
  return [{ title: "Celine Intelligence · 트렌드 뷰어" }];
}

export function loader() {
  // SSR: 카테고리 목록 + timeAgo 안정 렌더용 기준 시각.
  return { categories: CATEGORY_LIST, nowMs: Date.now() };
}

const VIDEO_SORTS: SortOption[] = [
  { key: "views", label: "조회수순", icon: "👁️" },
  { key: "likes", label: "좋아요순", icon: "👍" },
];
const GRID_SORTS: SortOption[] = [
  { key: "views", label: "조회수순", icon: "👁️" },
  { key: "likes", label: "좋아요순", icon: "❤️" },
  { key: "comments", label: "댓글순", icon: "💬" },
];
const X_SORTS: SortOption[] = [
  { key: "likes", label: "좋아요순", icon: "❤️" },
  { key: "replies", label: "댓글순", icon: "💬" },
  { key: "reposts", label: "리트윗순", icon: "🔁" },
  { key: "views", label: "조회수순", icon: "👁️" },
];
const THREADS_SORTS: SortOption[] = [
  { key: "likes", label: "좋아요순", icon: "❤️" },
  { key: "replies", label: "댓글순", icon: "💬" },
  { key: "reposts", label: "리포스트순", icon: "🔁" },
];

const PERIODS: { key: string; label: string }[] = [
  { key: "day", label: "오늘" },
  { key: "week", label: "이번 주" },
  { key: "month", label: "이번 달" },
];

export default function Radar({ loaderData }: { loaderData: { categories: string[]; nowMs: number } }) {
  const { categories, nowMs } = loaderData;

  const [tab, setTab] = useState<RadarTab>("youtube");
  const [category, setCategory] = useState("전체");
  const [period, setPeriod] = useState("week");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // 정렬 상태 (탭별)
  const [vidSort, setVidSort] = useState<"views" | "likes">("views");
  const [reelsSort, setReelsSort] = useState<"views" | "likes" | "comments">("views");
  const [tiktokSort, setTiktokSort] = useState<"views" | "likes" | "comments">("views");
  const [xSort, setXSort] = useState("likes");
  const [thSort, setThSort] = useState("likes");

  // 데이터 상태
  const [videos, setVideos] = useState<Video[]>([]);
  const [vidHasLikes, setVidHasLikes] = useState(false);
  const [reels, setReels] = useState<Reel[]>([]);
  const [reelsAcc, setReelsAcc] = useState<string[]>([]);
  const [xPosts, setXPosts] = useState<XPost[]>([]);
  const [xAcc, setXAcc] = useState<string[]>([]);
  const [thPosts, setThPosts] = useState<ThreadPost[]>([]);
  const [thAcc, setThAcc] = useState<string[]>([]);
  const [tiktok, setTiktok] = useState<TikTokPost[]>([]);
  const [ttAcc, setTtAcc] = useState<string[]>([]);
  const [ai, setAi] = useState<{ models: { latest: HfModel[]; trending: HfModel[] }; news: NewsItem[] } | null>(null);

  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);

  // 요청 경합 방지 시퀀스
  const seqRef = useRef(0);

  const loadVideos = useCallback(
    async (opts: { force?: boolean; enrich?: boolean } = {}) => {
      const seq = ++seqRef.current;
      setLoading(true);
      setErrored(false);
      const q = new URLSearchParams({
        category,
        period,
        shorts: tab === "shorts" ? "1" : "0",
        enrich: opts.enrich ? "1" : "0",
      });
      if (search) q.set("q", search);
      if (opts.force) q.set("force", "1");
      try {
        const d: any = await (await fetch("/radar/api/videos?" + q)).json();
        if (seq !== seqRef.current) return;
        const list: Video[] = d.videos ?? [];
        setVideos(list);
        setVidHasLikes(list.some((v) => v.likes));
        setFetchedAt(d.fetchedAt);
      } catch {
        if (seq === seqRef.current) setErrored(true);
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    },
    [category, period, search, tab],
  );

  const loadTab = useCallback(async (t: RadarTab, force = false) => {
    const seq = ++seqRef.current;
    setLoading(true);
    setErrored(false);
    try {
      const d: any = await (await fetch(`/radar/api/${t}${force ? "?force=1" : ""}`)).json();
      if (seq !== seqRef.current) return;
      setFetchedAt(d.fetchedAt);
      if (t === "ai") setAi({ models: d.models, news: d.news });
      else if (t === "reels") {
        setReels(d.reels ?? []);
        setReelsAcc(d.accounts ?? []);
      } else if (t === "x") {
        setXPosts(d.posts ?? []);
        setXAcc(d.accounts ?? []);
      } else if (t === "threads") {
        setThPosts(d.posts ?? []);
        setThAcc(d.accounts ?? []);
      } else if (t === "tiktok") {
        setTiktok(d.posts ?? []);
        setTtAcc(d.accounts ?? []);
      }
    } catch {
      if (seq === seqRef.current) setErrored(true);
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, []);

  // 탭/필터/검색 변경 시 로드
  useEffect(() => {
    if (tab === "youtube" || tab === "shorts") loadVideos({ enrich: vidSort === "likes" });
    else loadTab(tab);
    // vidSort는 별도 핸들러에서 처리(의도적으로 deps 제외)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, category, period, search]);

  // 유튜브 좋아요순 선택 시: 데이터에 좋아요 없으면 서버 재요청(enrich)
  const onVideoSort = (key: string) => {
    setVidSort(key as "views" | "likes");
    if (key === "likes" && !vidHasLikes) loadVideos({ enrich: true });
  };

  const onRefresh = () => {
    if (tab === "youtube" || tab === "shorts") loadVideos({ force: true, enrich: vidSort === "likes" });
    else loadTab(tab, true);
  };

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const kw = searchInput.trim();
    setSearch(kw);
    if (tab !== "youtube" && tab !== "shorts") setTab("youtube");
  };

  const onCategory = (cat: string) => {
    setSearch("");
    setSearchInput("");
    setCategory(cat);
  };

  const updateAccount = async (
    source: "reels" | "x" | "threads" | "tiktok",
    action: "add" | "remove",
    username: string,
  ) => {
    try {
      const res = await fetch("/radar/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, action, username }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        alert(`계정 ${action === "add" ? "추가" : "삭제"} 실패: ${body?.error ?? `HTTP ${res.status}`}`);
        return;
      }
    } catch {
      alert("계정 변경 요청에 실패했습니다. 네트워크를 확인해 주세요.");
      return;
    }
    loadTab(source, true);
  };

  // 유튜브 임베드 모달
  const [player, setPlayer] = useState<{ id: string; vertical: boolean } | null>(null);

  const isVideoTab = tab === "youtube" || tab === "shorts";
  const xField = (xSort === "reposts" ? "retweets" : xSort) as any;

  return (
    <div className="flex min-h-full flex-col">
      {/* 페이지 서브헤더 */}
      <div className="flex flex-col gap-4 border-b border-outline-variant px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-container-padding">
        <div>
          <h1 className="font-headline-sm text-headline-sm text-on-surface">트렌드 뷰어</h1>
          <p className="mt-0.5 text-[12px] text-on-surface-variant">매일 보는 소셜·AI 영상 트렌드</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={onSearchSubmit} className="relative">
            <span className="material-symbols-outlined notranslate absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant">
              search
            </span>
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="유튜브 검색어 입력 (예: AI 광고)"
              className="w-72 rounded-full border border-outline-variant bg-surface-container-lowest py-2 pl-10 pr-4 font-body-sm text-body-sm text-on-surface outline-none transition-colors focus:border-primary"
            />
          </form>
          <button
            type="button"
            onClick={onRefresh}
            className="flex items-center gap-1.5 font-body-sm text-body-sm text-on-surface-variant transition-colors hover:text-primary"
          >
            <span className="material-symbols-outlined notranslate text-[20px]">refresh</span>
            새로고침
          </button>
          {fetchedAt && (
            <span className="text-[11px] font-medium text-on-surface-variant/70">
              업데이트: {updatedAt(fetchedAt)}
            </span>
          )}
        </div>
      </div>

      {/* 플랫폼 탭바 */}
      <RadarTabs active={tab} onChange={setTab} />

      {/* 유튜브/쇼츠 툴바 */}
      {isVideoTab && (
        <div className="flex flex-col gap-3 px-4 py-4 sm:px-container-padding lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {categories.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => onCategory(c)}
                className={`rounded-full border px-4 py-1.5 font-body-sm text-body-sm transition-colors ${
                  !search && category === c
                    ? "border-primary bg-primary text-on-primary"
                    : "border-outline-variant bg-transparent text-on-surface-variant hover:border-primary-container"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded border border-outline-variant bg-surface-container p-1">
              {PERIODS.map((p) => (
                <button
                  type="button"
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={`rounded-sm px-3 py-1 font-body-sm text-body-sm transition-colors ${
                    period === p.key
                      ? "bg-surface-container-high text-on-surface"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <SortMenu options={VIDEO_SORTS} value={vidSort} onPick={onVideoSort} />
          </div>
        </div>
      )}

      {/* 계정 관리 + 정렬 (릴스/X/스레드/틱톡) */}
      {tab === "reels" && (
        <ToolbarRow
          accounts={reelsAcc}
          placeholder="인스타그램 계정명 (예: runwayapp)"
          onAdd={(u) => updateAccount("reels", "add", u)}
          onRemove={(u) => updateAccount("reels", "remove", u)}
          sortOptions={GRID_SORTS}
          sortValue={reelsSort}
          onSort={(k) => setReelsSort(k as any)}
          count={reels.length}
        />
      )}
      {tab === "tiktok" && (
        <ToolbarRow
          accounts={ttAcc}
          placeholder="틱톡 계정명 (@ 없이, 예: khaby.lame)"
          onAdd={(u) => updateAccount("tiktok", "add", u)}
          onRemove={(u) => updateAccount("tiktok", "remove", u)}
          sortOptions={GRID_SORTS}
          sortValue={tiktokSort}
          onSort={(k) => setTiktokSort(k as any)}
          count={tiktok.length}
        />
      )}
      {tab === "x" && (
        <ToolbarRow
          accounts={xAcc}
          placeholder="X(트위터) 계정명 (예: OpenAI)"
          onAdd={(u) => updateAccount("x", "add", u)}
          onRemove={(u) => updateAccount("x", "remove", u)}
          sortOptions={X_SORTS}
          sortValue={xSort}
          onSort={setXSort}
          count={xPosts.length}
        />
      )}
      {tab === "threads" && (
        <ToolbarRow
          accounts={thAcc}
          placeholder="스레드 계정명 (예: openai)"
          onAdd={(u) => updateAccount("threads", "add", u)}
          onRemove={(u) => updateAccount("threads", "remove", u)}
          sortOptions={THREADS_SORTS}
          sortValue={thSort}
          onSort={setThSort}
          count={thPosts.length}
        />
      )}

      {/* 콘텐츠 영역 */}
      <div className="flex-1 px-4 pb-8 pt-2 sm:px-container-padding">
        {loading ? (
          <StatusMsg>불러오는 중입니다... (계정이 많으면 수십 초 걸릴 수 있어요)</StatusMsg>
        ) : errored ? (
          <StatusMsg>불러오기에 실패했습니다. 네트워크를 확인해 주세요.</StatusMsg>
        ) : (
          <>
            {isVideoTab &&
              (videos.length ? (
                <VideoGrid
                  videos={videos}
                  sort={vidSort}
                  vertical={tab === "shorts"}
                  onOpen={(id, vertical) => setPlayer({ id, vertical })}
                />
              ) : (
                <StatusMsg>가져온 영상이 없습니다. 다른 카테고리나 기간을 선택해 보세요.</StatusMsg>
              ))}

            {tab === "ai" && ai && <AiPanel models={ai.models} news={ai.news} nowMs={nowMs} />}

            {tab === "reels" &&
              (reels.length ? (
                <VerticalGrid items={reels} sort={reelsSort} />
              ) : (
                <StatusMsg>
                  가져온 릴스가 없습니다. 계정을 추가해 보시거나 잠시 후 새로고침해 주세요.
                  (인스타그램이 일시적으로 요청을 제한하는 경우가 있습니다)
                </StatusMsg>
              ))}

            {tab === "tiktok" &&
              (tiktok.length ? (
                <VerticalGrid items={tiktok} sort={tiktokSort} />
              ) : (
                <StatusMsg>
                  가져온 영상이 없습니다. 잠시 후 새로고침해 주세요. (무료 API가 일시적으로 제한되는 경우가 있습니다)
                </StatusMsg>
              ))}

            {tab === "x" &&
              (xPosts.length ? (
                <PostList posts={xPosts} kind="x" sortField={xField} />
              ) : (
                <StatusMsg>가져온 글이 없습니다. 계정을 확인하거나 잠시 후 새로고침해 주세요.</StatusMsg>
              ))}

            {tab === "threads" &&
              (thPosts.length ? (
                <PostList posts={thPosts} kind="threads" sortField={thSort as any} />
              ) : (
                <ThreadsFallback accounts={thAcc} />
              ))}
          </>
        )}
      </div>

      {player && (
        <PlayerModal videoId={player.id} vertical={player.vertical} onClose={() => setPlayer(null)} />
      )}
    </div>
  );
}

function ToolbarRow({
  accounts,
  placeholder,
  onAdd,
  onRemove,
  sortOptions,
  sortValue,
  onSort,
  count,
}: {
  accounts: string[];
  placeholder: string;
  onAdd: (u: string) => void;
  onRemove: (u: string) => void;
  sortOptions: SortOption[];
  sortValue: string;
  onSort: (k: string) => void;
  count: number;
}) {
  return (
    <div className="space-y-3 px-4 py-4 sm:px-container-padding">
      <AccountManager accounts={accounts} placeholder={placeholder} onAdd={onAdd} onRemove={onRemove} />
      <div className="flex items-center gap-3">
        <SortMenu options={sortOptions} value={sortValue} onPick={onSort} />
        {count > 0 && <span className="font-body-sm text-body-sm text-on-surface-variant">총 {count}개</span>}
      </div>
    </div>
  );
}

function StatusMsg({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-outline-variant/60 bg-surface-container-low p-12 text-center font-body-sm text-body-sm text-on-surface-variant">
      {children}
    </div>
  );
}

function ThreadsFallback({ accounts }: { accounts: string[] }) {
  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-outline-variant/60 bg-surface-container-low p-4 font-body-sm text-body-sm text-on-surface-variant">
        ⚠️ 지금은 스레드가 로그인 없는 조회를 차단하고 있어 실시간 글을 가져오지 못했습니다. 아래에서 각 계정을 바로 열어볼 수 있습니다.
        (메타가 접근을 다시 허용하면 자동으로 목록이 채워집니다.)
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {accounts.map((name) => (
          <a
            key={name}
            href={`https://www.threads.com/@${name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col gap-1 rounded border border-outline-variant bg-surface-container p-4 transition-colors hover:border-primary"
          >
            <span className="font-body-md text-body-md font-semibold text-on-surface">🧵 @{name}</span>
            <span className="text-[11px] text-on-surface-variant">스레드에서 열기 ↗</span>
          </a>
        ))}
      </div>
    </div>
  );
}
