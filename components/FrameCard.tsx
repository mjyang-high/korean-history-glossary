function CornerMark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`pointer-events-none absolute h-2.5 w-2.5 rotate-45 border border-[#1c1a16]/70 bg-[#f4efe3] ${className}`}
    />
  );
}

export function FrameCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative rounded-[28px] border-[3px] border-[#1c1a16]/85 bg-[#fbf8f0] ${className}`}>
      <CornerMark className="-left-1 -top-1" />
      <CornerMark className="-right-1 -top-1" />
      <CornerMark className="-bottom-1 -left-1" />
      <CornerMark className="-bottom-1 -right-1" />
      {children}
    </div>
  );
}
