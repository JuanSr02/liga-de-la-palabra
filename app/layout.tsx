import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Liga de La Palabra',
  description: 'La competencia familiar de cada día. Resultados y estadísticas de la liga.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/liga-favicon.png',
        type: 'image/png',
        sizes: '512x512',
      },
    ],
    shortcut: '/liga-favicon.png',
    apple: '/liga-favicon.png',
  },
  openGraph: {
    title: 'Liga de La Palabra',
    description: 'La competencia familiar de cada día.',
    type: 'website',
    locale: 'es_AR',
    images: [{ url: '/liga-favicon.png', width: 512, height: 512, alt: 'Liga de La Palabra' }],
  },
  twitter: {
    card: 'summary',
    title: 'Liga de La Palabra',
    description: 'La competencia familiar de cada día.',
    images: ['/liga-favicon.png'],
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
