import { useState } from "react";

// 구독 계정 칩 + 추가 입력 (릴스/X/스레드/틱톡). 레퍼런스 renderAccountChips/updateAccount 재현.
export function AccountManager({
  accounts,
  placeholder,
  onAdd,
  onRemove,
}: {
  accounts: string[];
  placeholder: string;
  onAdd: (username: string) => void;
  onRemove: (username: string) => void;
}) {
  const [value, setValue] = useState("");
  const submit = () => {
    const name = value.trim().replace(/^@/, "");
    if (!name) return;
    setValue("");
    onAdd(name);
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="font-body-sm text-body-sm text-on-surface-variant">모니터링 계정:</span>
      <div className="flex flex-wrap items-center gap-2">
        {accounts.map((name) => (
          <span
            key={name}
            className="flex items-center gap-1.5 rounded border border-outline-variant bg-surface-container-highest px-3 py-1 font-body-sm text-body-sm text-on-surface transition-colors hover:border-primary/50"
          >
            @{name}
            <button
              type="button"
              title="삭제"
              onClick={() => onRemove(name)}
              className="material-symbols-outlined notranslate text-[14px] text-on-surface-variant transition-colors hover:text-error"
            >
              close
            </button>
          </span>
        ))}
        <div className="flex items-center gap-1">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={placeholder}
            className="w-56 rounded border border-outline-variant bg-surface-container-lowest px-3 py-1 font-body-sm text-body-sm text-on-surface outline-none transition-colors focus:border-primary"
          />
          <button
            type="button"
            onClick={submit}
            className="flex items-center gap-1 rounded border border-primary/30 px-3 py-1 font-body-sm text-body-sm text-primary transition-colors hover:bg-primary/10"
          >
            <span className="material-symbols-outlined notranslate text-[16px]">add</span>
            계정 추가
          </button>
        </div>
      </div>
    </div>
  );
}
