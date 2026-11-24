import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import AppShell from './components/AppShell'
import { UserProvider } from './components/UserContext'
import { ModulesProvider } from './components/ModulesContext'
import { TemaSazonalProvider } from './components/tema/TemaSazonal'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })

export const metadata: Metadata = {
  title: 'Sistema Interno GT3',
  description: 'Sistema interno GT3 Consultoria',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={geist.variable}>
      <body>
        <UserProvider>
          <ModulesProvider>
            <TemaSazonalProvider>
              <AppShell>{children}</AppShell>
            </TemaSazonalProvider>
          </ModulesProvider>
        </UserProvider>
      </body>
    </html>
  )
}
