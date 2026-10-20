import { Suspense } from 'react'
import EnquetesClient from './EnquetesClient'

export default function EnquetesPage() {
  return (
    <Suspense>
      <EnquetesClient />
    </Suspense>
  )
}
