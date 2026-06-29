import Image from 'next/image';

export function SiteFooter() {
  return (
    <footer className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-4 py-8 text-xs text-[#1c1a16]/35">
      <div className="flex items-center gap-2.5">
        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[#f4efe3]">
          <Image
            src="/school-emblem.png"
            alt="분당대진고등학교 엠블럼"
            width={36}
            height={36}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="text-left leading-tight">
          <p>© {new Date().getFullYear()} 분당대진고등학교 양민정</p>
          <p>2026mjyang@gmail.com</p>
        </div>
      </div>
      <span>Hosted by Vercel Inc.</span>
    </footer>
  );
}
