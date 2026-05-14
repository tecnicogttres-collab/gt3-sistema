import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import AppShell from './components/AppShell'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })

export const metadata: Metadata = {
  title: 'GT3 Sistema',
  description: 'Sistema interno GT3 Consultoria',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={geist.variable}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
