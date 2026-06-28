// 한국사 교과서 표지 느낌의 미니 라인아트 일러스트 (엽전ㆍ도자기ㆍ두루마기ㆍ인물)
function Coin({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className}>
      <circle cx="32" cy="32" r="26" stroke="currentColor" strokeWidth="3" />
      <circle cx="32" cy="32" r="18" stroke="currentColor" strokeWidth="2" />
      <rect x="24" y="24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" />
      <path d="M32 6 V14 M32 50 V58 M6 32 H14 M50 32 H58" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function Vase({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className}>
      <path
        d="M26 6 H38 L36 16 C44 22 46 30 44 40 C42 50 38 58 32 58 C26 58 22 50 20 40 C18 30 20 22 28 16 Z"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M22 30 C28 26 36 26 42 30" stroke="currentColor" strokeWidth="2" />
      <path d="M21 42 C28 46 36 46 43 42" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function Scroll({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className}>
      <rect x="14" y="10" width="36" height="44" rx="3" stroke="currentColor" strokeWidth="3" />
      <path d="M22 22 H42 M22 30 H42 M22 38 H36" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="14" cy="32" r="5" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="50" cy="32" r="5" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  );
}

function ReadingFigure({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className}>
      <circle cx="32" cy="16" r="8" stroke="currentColor" strokeWidth="3" />
      <path
        d="M16 56 C16 40 22 32 32 32 C42 32 48 40 48 56"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M22 46 H42" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function HistoryMotifRow({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-end gap-4 ${className}`}>
      <Coin className="h-9 w-9 text-[#c1392d]" />
      <Vase className="h-11 w-11 text-[#1c1a16]/80" />
      <Scroll className="h-9 w-9 text-[#1f7a7a]" />
      <ReadingFigure className="h-10 w-10 text-[#1c1a16]/60" />
    </div>
  );
}
