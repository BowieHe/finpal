import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FinPal - 乐观与悲观',
  description: '基于 LangGraph 的双人格 AI 对话助手',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased">
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
          {children}
        </div>
      </body>
    </html>
  );
}
