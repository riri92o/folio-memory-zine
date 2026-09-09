import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Folio — 思い出を、一冊に。',
  icons: {
    icon: `${process.env.VITE_BASE_PATH || '/'}favicon.svg`,
  },
  description:
    '写真を選んで、自由に飾って。あなただけの思い出の一冊をつくるローカル保存のスクラップブック。',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
