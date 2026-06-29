import Image from 'next/image';

export function SiteFooter() {
  return (
    <footer className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-4 py-8 text-center text-xs text-[#1c1a16]/35">
      <div className="flex items-center gap-2">
        <Image
          src="/school-emblem.png"
          alt="분당대진고등학교 엠블럼"
          width={20}
          height={20}
          className="h-5 w-5 object-contain"
        />
        <span>
          © {new Date().getFullYear()} 분당대진고등학교 양민정 · 2026mjyang@gmail.com
        </span>
      </div>
      <span>Hosted by Vercel Inc.</span>
    </footer>
  );
}
