import Image from 'next/image';

export function SchoolBadge({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Image
        src="/school-emblem.png"
        alt="분당대진고등학교 엠블럼"
        width={32}
        height={32}
        className="h-8 w-8 object-contain"
      />
      <span className="font-display text-sm font-bold text-[#1c1a16]/80">분당대진고등학교 양민정</span>
    </div>
  );
}
