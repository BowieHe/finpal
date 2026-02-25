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
      <body className="min-h-screen antialiased bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}
