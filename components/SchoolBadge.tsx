import Image from 'next/image';

export function SchoolBadge({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Image
        src="/school-logo.png"
        alt="분당대진고등학교 로고"
        width={375}
        height={81}
        priority
        className="h-9 w-auto object-contain"
      />
      <span className="h-5 w-px bg-[#1c1a16]/20" />
      <span className="font-display text-sm font-bold text-[#1c1a16]/80">양민정</span>
    </div>
  );
}
