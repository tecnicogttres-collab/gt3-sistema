import { Suspense } from 'react'
import AtasContratantesClient from './AtasContratantesClient'

export default function AtasContratantesPage() {
  return (
    <Suspense>
      <AtasContratantesClient />
    </Suspense>
  )
}
