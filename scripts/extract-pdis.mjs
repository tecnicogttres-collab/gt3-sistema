import XLSX from 'xlsx'
import fs from 'fs'

const DIR = 'C:/Users/rodri/gt3-sistema/pdis-dados'
const OUT = 'C:/Users/rodri/gt3-sistema/data/pdis'
fs.mkdirSync(OUT, { recursive: true })

// ── helpers ──────────────────────────────────────────────────────
function clean(v) {
  if (v === null || v === undefined || v === '') return ''
  return String(v).replace(/\r\n/g, ' ').replace(/[\r\n]/g, ' ').trim()
}
function fmtDate(v) {
  if (!v) return ''
  if (typeof v === 'number') return XLSX.SSF.format('dd/mm/yyyy', v)
  return clean(v)
}
function rows(wb, name) {
  if (!wb.SheetNames.includes(name)) return []
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' })
}
function slug(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
}
function camel(s) {
  return s.replace(/-([a-z])/g,(_, c) => c.toUpperCase())
}
// Extract value from a row that may have "Label: value" in one cell, or label in col0 + value in col1+
function extractRowValue(row, labelRe) {
  for (let c = 0; c < row.length; c++) {
    const v = clean(row[c])
    if (!v) continue
    if (labelRe.test(v)) {
      // Check if the value is in the same cell (after stripping the label)
      const stripped = v.replace(labelRe, '').replace(/^[:\s]+/, '').trim()
      if (stripped && /\d/.test(stripped)) return stripped // has date/number → real value
      if (stripped && stripped.length > 5 && !stripped.match(/^(de |do |da )/i)) return stripped
      // Otherwise look in subsequent cells
      for (let nc = c + 1; nc < row.length; nc++) {
        const nv = clean(row[nc])
        if (nv) return nv
      }
    }
  }
  return ''
}

// ── PDI Sheet ────────────────────────────────────────────────────
function extractPdi(wb) {
  const r = rows(wb, 'PDI')

  const nome = extractRowValue(r[2] || [], /^Nome/i)
  const periodo = extractRowValue(r[3] || [], /^Per[ií]odo/i)
  const funcao = extractRowValue(r[5] || [], /^Fun[çc][aã]o/i)

  // Find evaluation section: label → header (label+1) → score row (label+2, if filled)
  function findSection(startRow, labelRe) {
    let labelRow = -1
    for (let i = startRow; i < r.length; i++) {
      if (labelRe.test(clean(r[i]?.[0]))) { labelRow = i; break }
    }
    if (labelRow < 0) return { labelRow: -1, scoreRow: -1, headerRow: -1 }
    const headerRow = labelRow + 1           // competencias row
    const expectedScore = labelRow + 2       // where scores should be
    const eRow = r[expectedScore] || []
    const numCount = eRow.slice(0, 11).filter(v => typeof v === 'number').length
    const scoreRow = numCount >= 3 ? expectedScore : -1  // -1 = not filled in
    return { labelRow, scoreRow, headerRow }
  }

  const dir = findSection(6, /diretiva/i)
  const aut = findSection(dir.labelRow >= 0 ? dir.labelRow + 1 : 6, /auto(avalia|[çc][aã]o)?/i)
  const amb = findSection(aut.labelRow >= 0 ? aut.labelRow + 1 : 10, /ambi[çc][aã]o/i)

  // Competencias from diretiva header row (always exists even if scores not filled)
  const compHeaderRow = dir.headerRow >= 0 ? dir.headerRow : aut.headerRow
  const competencias = compHeaderRow >= 0
    ? (r[compHeaderRow] || []).slice(0, 11).map(clean).filter(Boolean)
    : []

  function scoresFrom(rowIdx) {
    if (rowIdx < 0 || !r[rowIdx]) return new Array(11).fill(0)
    return (r[rowIdx]).slice(0, 11).map(v => (v === '' || v === null ? 0 : Number(v)))
  }

  const diretiva = scoresFrom(dir.scoreRow)
  const auto = scoresFrom(aut.scoreRow)
  const ambicao = scoresFrom(amb.scoreRow)

  const totalDir = dir.scoreRow >= 0 && r[dir.scoreRow]?.[11] ? Number(r[dir.scoreRow][11]) : diretiva.reduce((a,b)=>a+b,0)
  const totalAuto = aut.scoreRow >= 0 && r[aut.scoreRow]?.[11] ? Number(r[aut.scoreRow][11]) : auto.reduce((a,b)=>a+b,0)
  const totalAmb = amb.scoreRow >= 0 && r[amb.scoreRow]?.[11] ? Number(r[amb.scoreRow][11]) : ambicao.reduce((a,b)=>a+b,0)

  return { nome, periodo, funcao, competencias, diretiva, auto, ambicao, totalDir, totalAuto, totalAmb }
}

// ── Ações Sheet ──────────────────────────────────────────────────
function extractAcoes(wb) {
  const r = rows(wb, 'Ações')
  // Find header row
  let header = -1
  for (let i = 0; i < Math.min(10, r.length); i++) {
    if (r[i] && clean(r[i][0]).match(/Competên|Competenc|Item a/i)) { header = i; break }
  }
  if (header < 0) return []
  const hdrs = r[header]

  function colIdx(...pats) {
    for (const p of pats) {
      const i = hdrs.findIndex(h => new RegExp('^' + p, 'i').test(clean(h)))
      if (i >= 0) return i
    }
    // Fallback: contains
    for (const p of pats) {
      const i = hdrs.findIndex(h => new RegExp(p, 'i').test(clean(h)))
      if (i >= 0) return i
    }
    return -1
  }

  // Determine column layout
  // "Competência/Item a desenvolver" is col 0 = competencia
  // "A desenvolver" = desenvolver (col 1 usually)
  const iComp = 0
  const iDes = (() => {
    // Find "A desenvolver" col — must be different from iComp
    for (let i = 1; i < hdrs.length; i++) {
      if (/^A desenvolver/i.test(clean(hdrs[i]))) return i
    }
    return 1 // fallback
  })()
  const iAcoes = colIdx('Ações para', 'Ações')
  const iRes = colIdx('Resultados Esperados', 'Resultado')
  const iIni = colIdx('Data de Início', 'Início', 'Inicio', 'Data Início')
  const iTer = colIdx('Data Término', 'Término', 'Termino')
  const iStat = colIdx('Status')

  const acoes = []
  for (let i = header + 1; i < r.length; i++) {
    const row = r[i]
    const comp = clean(row[iComp])
    const des = iDes >= 0 ? clean(row[iDes]) : ''
    if (!comp && !des) continue
    // If desenvolver is same as competencia (single-col format), put content in acoes
    acoes.push({
      competencia: comp,
      desenvolver: des === comp ? '' : des,
      acoes: iAcoes >= 0 ? clean(row[iAcoes]) : '',
      resultadosEsperados: iRes >= 0 ? clean(row[iRes]) : '',
      inicio: iIni >= 0 ? fmtDate(row[iIni]) : '',
      termino: iTer >= 0 ? fmtDate(row[iTer]) : '',
      status: iStat >= 0 ? clean(row[iStat]) : '',
    })
  }
  return acoes
}

// ── Eneagrama e Animais Sheet ────────────────────────────────────
function extractEneagrama(wb) {
  const r = rows(wb, 'Eneagrama e Animais')
  if (!r.length) return { ranking: [], pontosFortes: [], pontosAtencao: [], comoDesenvolver: [], animais: [] }

  // Ranking from row 0, cols 12/15/19
  const ENE_NUM = { Perfeccionista:1, Ajudante:2, Vencedor:3, Romântico:4, Observador:5, Analítico:5, Precavido:6, Otimista:7, Poderoso:8, Mediador:9, Mediadora:9 }
  function parseEne(s) {
    const m = String(s).match(/Tipo\s*(\d*)\s*[–—\-–]+\s*([^(]+)\((\d+\/\d+)\)/)
    if (!m) return null
    const nome = m[2].trim()
    const num = m[1] || String(ENE_NUM[nome] || '')
    return { tipo: `Tipo ${num} — ${nome}`, pontuacao: m[3] }
  }
  const row0 = r[0] || []
  const ranking = [
    { rank: 1, ...parseEne(row0[12]) },
    { rank: 2, ...parseEne(row0[15]) },
    { rank: 3, ...parseEne(row0[19]) },
  ].filter(e => e.tipo)

  // Points from col 10
  const pontosFortes = [], pontosAtencao = [], comoDesenvolver = []
  let sec = 'fortes'
  for (let i = 1; i < r.length; i++) {
    const v = clean(r[i][10])
    if (!v) continue
    if (/PONTOS FORTES/i.test(v)) { sec = 'fortes'; continue }
    if (/⚠️|PONTOS DE ATEN/i.test(v)) { sec = 'atencao'; continue }
    if (/🎯|🚀|COMO DESENVOLVER|PAPEL IDEAL/i.test(v)) { sec = 'desenvolver'; continue }
    if (sec === 'fortes') pontosFortes.push(v)
    else if (sec === 'atencao') pontosAtencao.push(v)
    else comoDesenvolver.push(v)
  }

  // Animais — detect by emoji in col 0
  const ANIMAL_EMOJIS = [
    { name: 'Gato', emoji: '🐱' },
    { name: 'Tubarão', emoji: '🦈' },
    { name: 'Lobo', emoji: '🐺' },
    { name: 'Águia', emoji: '🦅' },
  ]
  const animais = []
  let cur = null
  for (let i = 0; i < r.length; i++) {
    const v = clean(r[i][0])
    if (!v) continue
    const found = ANIMAL_EMOJIS.find(a => v.includes(a.emoji) || v.includes(a.name))
    if (found && (v.includes(found.emoji) || new RegExp('^' + found.name).test(v))) {
      cur = { animal: found.name, emoji: found.emoji, pontoForte: '', tendencia: '' }
      animais.push(cur)
      continue
    }
    if (cur) {
      if (/^Ponto forte/i.test(v)) cur.pontoForte = v.replace(/^Ponto forte:?\s*/i, '')
      else if (/^Tendên|^Tendenc|^Comportamento chave|^Neste caso/i.test(v))
        cur.tendencia = v.replace(/^(Tendência|Tendencia|Comportamento chave|Neste caso):?\s*/i, '')
    }
  }

  return { ranking, pontosFortes, pontosAtencao, comoDesenvolver, animais }
}

// ── MTBI Sheet ───────────────────────────────────────────────────
function extractMbti(wb) {
  if (!wb.SheetNames.includes('MTBI')) return null
  const r = rows(wb, 'MTBI')
  const nucleo = clean(r[1]?.[0]) || ''
  const tipoMatch = nucleo.match(/\b(ISFP|ISTP|ISTJ|INFP|ENFP|ESTJ|ESTP|ENTJ|ENTP|INFJ|INTJ|INTP|ENFJ|ESFJ|ESFP|ISFJ)\b/)
  const tipo = tipoMatch?.[1] || ''
  const veredito = clean(r[13]?.[23]) || ''
  return { tipo, nucleo: nucleo.slice(0, 500), veredito: veredito.slice(0, 600) }
}

// ── Conclusões Perfil Sheet ──────────────────────────────────────
function extractConclusoes(wb) {
  const r = rows(wb, 'Conclusões Perfil')
  if (!r.length) return { forcas: [], pontosAtencao: [], ondeAgrega: [], comoPodeApoiar: [], riscos: [], comoLiderar: [] }

  const forcas = [], pontosAtencao = [], ondeAgrega = [], comoPodeApoiar = [], riscos = [], comoLiderar = []
  let leftSec = 'forcas'
  let rightSec = 'agrega'
  let inLiderar = false, inRiscos = false

  for (let i = 0; i < r.length; i++) {
    const row = r[i]
    const c0 = clean(row[0])
    const c5 = clean(row[5]) || clean(row[4]) || clean(row[3])
    const c8 = clean(row[8]) || clean(row[9])

    // Section markers — left col
    if (/Pontos de aten/i.test(c0)) { leftSec = 'atencao'; continue }
    if (/For[çc]as vis[ií]veis/i.test(c0)) { leftSec = 'forcas'; continue }

    // Section markers — right col
    if (/Pode apoiar bem/i.test(c5)) { rightSec = 'apoiar'; continue }
    if (/Melhores frentes/i.test(c5)) { rightSec = 'agrega'; continue }

    // Section markers — col 8
    if (/Como liderar/i.test(c8)) { inLiderar = true; inRiscos = false; continue }
    if (/Riscos se mal/i.test(c8)) { inRiscos = true; inLiderar = false; continue }
    if (/Estilo de comunica/i.test(c8)) { inLiderar = false; inRiscos = false; continue }

    // Collect left col
    if (c0 && !/^📌|^→|^✅|^⚠️|^\*/.test(c0)) {
      if (leftSec === 'forcas') forcas.push(c0)
      else pontosAtencao.push(c0)
    }

    // Collect right col
    if (c5 && !/^📌|Onde esse|^✅|Pode apoiar/.test(c5)) {
      const item = c5.replace(/^→\s*/, '')
      if (rightSec === 'agrega') ondeAgrega.push(item)
      else comoPodeApoiar.push(item)
    }

    // Collect col 8
    if (c8 && c8.length > 10) {
      if (inLiderar) comoLiderar.push(c8)
      else if (inRiscos) riscos.push(c8)
    }
  }

  return {
    forcas: forcas.filter(Boolean),
    pontosAtencao: pontosAtencao.filter(Boolean),
    ondeAgrega: ondeAgrega.filter(Boolean),
    comoPodeApoiar: comoPodeApoiar.filter(Boolean),
    riscos: riscos.filter(Boolean),
    comoLiderar: comoLiderar.filter(Boolean),
  }
}

// ── Main ─────────────────────────────────────────────────────────
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.xlsx'))
const results = []

for (const file of files) {
  let wb
  try { wb = XLSX.readFile(`${DIR}/${file}`) }
  catch (e) { console.warn(`⚠️  ${file}: ${e.message}`); continue }

  const pdi = extractPdi(wb)
  const acoes = extractAcoes(wb)
  const ene = extractEneagrama(wb)
  const mbti = extractMbti(wb)
  const conc = extractConclusoes(wb)

  const nomeLimpo = pdi.nome.replace(/\s+/g, ' ').trim() || file.replace('.xlsx', '')
  const id = slug(nomeLimpo)
  const varName = camel(id)

  const data = {
    id,
    nome: nomeLimpo,
    funcao: pdi.funcao,
    periodo: pdi.periodo,
    matrizAvaliacao: {
      competencias: pdi.competencias,
      diretiva: pdi.diretiva,
      auto: pdi.auto,
      ambicao: pdi.ambicao,
      totais: {
        diretiva: pdi.totalDir,
        auto: pdi.totalAuto,
        ambicao: pdi.totalAmb,
        max: pdi.competencias.length * 5,
      },
    },
    planoDeAcao: acoes,
    perfilComportamental: {
      eneagrama: {
        ranking: ene.ranking,
        pontosFortes: ene.pontosFortes,
        pontosAtencao: ene.pontosAtencao,
        comoDesenvolver: ene.comoDesenvolver,
      },
      animais: ene.animais,
      ...(mbti ? { mbti } : {}),
    },
    conclusoes: conc,
  }

  // Serialize to TS — keep double quotes in values to avoid apostrophe issues
  const json = JSON.stringify(data, null, 2)
    .replace(/"([a-zA-Z_][a-zA-Z0-9_]*)"\s*:/g, '$1:')

  const ts = `import type { PdiColaborador } from './types'\n\nconst ${varName}: PdiColaborador = ${json}\n\nexport default ${varName}\n`
  fs.writeFileSync(`${OUT}/${id}.ts`, ts)
  console.log(`✅ ${file} → ${id}.ts  [${pdi.diretiva.join(',')} | ações:${acoes.length} | ene:${ene.ranking.length} | animais:${ene.animais.length}]`)
  results.push({ id, varName })
}

// index.ts
const idx = results.map(({ id, varName }) => `export { default as ${varName} } from './${id}'`).join('\n') + '\n'
fs.writeFileSync(`${OUT}/index.ts`, idx)
console.log(`\n📦 index.ts com ${results.length} colaboradores`)
