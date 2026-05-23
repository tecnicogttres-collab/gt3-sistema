import { Suspense } from 'react'
import AtasClient from './AtasClient'

export default function AtasPage() {
  return (
    <Suspense>
      <AtasClient />
    </Suspense>
  )
}
