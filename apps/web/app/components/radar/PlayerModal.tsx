// 유튜브 임베드 모달. 레퍼런스 openPlayer/closePlayer 재현(쇼츠는 세로 9:16).
export function PlayerModal({
  videoId,
  vertical,
  onClose,
}: {
  videoId: string;
  vertical: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`flex flex-col gap-3 ${vertical ? "w-auto" : "w-full max-w-4xl"}`}>
        <div
          className={`overflow-hidden rounded-xl border border-outline-variant bg-black shadow-2xl ${vertical ? "aspect-[9/16] h-[80vh]" : "aspect-video w-full"}`}
        >
          <iframe
            title="youtube-player"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
            allow="autoplay; encrypted-media"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
        <div className="flex items-center justify-end gap-2">
          <a
            href={`https://www.youtube.com/watch?v=${videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border border-outline-variant bg-surface-container px-4 py-2 font-body-sm text-body-sm text-on-surface transition-colors hover:border-primary"
          >
            유튜브에서 열기 ↗
          </a>
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-primary px-4 py-2 font-body-sm text-body-sm font-semibold text-on-primary transition-colors hover:bg-primary-fixed"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
