import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '한국사 용어 도우미',
  description: '교과서 속 모르는 용어를 쉽게 설명해드려요',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
