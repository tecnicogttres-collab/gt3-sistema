import ResponderClient from './ResponderClient'

export const metadata = { title: 'Questionário — GT3 Consultoria' }

export default async function QuestionarioPublicoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <ResponderClient token={token} />
}
