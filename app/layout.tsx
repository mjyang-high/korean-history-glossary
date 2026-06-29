import type { Metadata } from 'next';
import { Noto_Serif_KR } from 'next/font/google';
import './globals.css';

const notoSerifKr = Noto_Serif_KR({
  subsets: ['latin'],
  weight: ['500', '700', '900'],
  variable: '--font-serif-kr',
  display: 'swap',
});

export const metadata: Metadata = {
  title: '한국사 학습 도우미',
  description: '교과서 속 모르는 용어부터 기출문제까지, 한국사 공부를 도와드려요',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={notoSerifKr.variable}>{children}</body>
    </html>
  );
}
