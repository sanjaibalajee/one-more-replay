import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "One More Replay", description: "Competitor Reel research with linked evidence and practical ideas." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('replay-theme')||'system';document.documentElement.dataset.theme=t==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t}catch(e){}" }} /></head><body>{children}</body></html>;
}
