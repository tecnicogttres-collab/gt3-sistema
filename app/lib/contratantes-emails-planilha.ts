import { Workbook, type Worksheet } from 'exceljs'
import {
  extrairEmailsCadastro, origemDeContato, PLANILHA_EMAILS_COLUNAS, PLANILHA_EMAILS_SEPARADOR_ORIGEM,
} from './contratantes-emails'

const porNome = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })

/** Cabeçalho em negrito, congelado, com autofiltro e colunas na largura do conteúdo. */
function formatar(ws: Worksheet) {
  ws.getRow(1).font = { bold: true }
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(ws.rowCount, 1), column: ws.columnCount } }
  ws.columns.forEach(col => {
    let max = 0
    col.eachCell?.({ includeEmpty: false }, c => { max = Math.max(max, String(c.value ?? '').length) })
    col.width = Math.min(Math.max(max + 4, 10), 80) // +4: espaço da seta do filtro
  })
}

/** "Exportar e-mails para planilha": aba 1 com uma linha por e-mail (Empresa | Nome | PrimeiroNome |
 *  Email | CampoOrigem | Incluir) e aba "Sem e-mail". Só lê o cadastro. */
export async function planilhaEmailsContratantes(cad: { id: string; name: string; fields: unknown }[]) {
  const { linhas, semEmail } = extrairEmailsCadastro(cad)
  const ordenadas = linhas
    .map((l, i) => ({ ...l, i }))
    .sort((a, b) => porNome(a.empresa, b.empresa) || a.i - b.i)

  const wb = new Workbook()
  const ws = wb.addWorksheet('E-mails')
  ws.addRow([...PLANILHA_EMAILS_COLUNAS])
  for (const l of ordenadas) {
    ws.addRow([
      l.empresa, l.nome, l.nome.split(' ')[0] ?? '', l.email,
      l.origens.join(PLANILHA_EMAILS_SEPARADOR_ORIGEM),
      l.origens.some(origemDeContato) ? 'Sim' : 'Não',
    ])
  }
  formatar(ws)

  const ws2 = wb.addWorksheet('Sem e-mail')
  ws2.addRow(['Empresa'])
  for (const s of [...semEmail].sort((a, b) => porNome(a.empresa, b.empresa))) ws2.addRow([s.empresa])
  formatar(ws2)

  return { buffer: await wb.xlsx.writeBuffer(), linhas: ordenadas.length, semEmail: semEmail.length }
}
