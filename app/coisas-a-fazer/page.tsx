import { Suspense } from 'react'
import CoisasAFazerClient from './CoisasAFazerClient'

export default function CoisasAFazerPage() {
  return (
    <Suspense>
      <CoisasAFazerClient />
    </Suspense>
  )
}
