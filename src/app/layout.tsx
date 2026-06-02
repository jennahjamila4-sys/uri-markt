import type { Metadata, Viewport } from 'next'
import { Syne, DM_Sans } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '600', '700', '800'],
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Uri-Markt – Regional. Genau was es brucht.',
  description: 'Der smarteste lokale Marktplatz im Kanton Uri.',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className="dark">
      <body className={`${syne.variable} ${dmSans.variable} font-body bg-obsidian text-white`}>
        {children}
        <Toaster
          theme="dark"
          position="top-center"
          toastOptions={{
            style: { background: '#161616', border: '1px solid rgba(255,255,255,0.10)', color: '#fff' },
          }}
        />
      </body>
    </html>
  )
}
