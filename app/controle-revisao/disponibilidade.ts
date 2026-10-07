// Cruza a escala de revisores (Revisões BSA) com o Calendário de férias/folgas.
// Os nomes não são iguais nos dois módulos ("Marcio Z" na escala x "Marcio Zim" nas férias),
// então o casamento é por prefixo, palavra a palavra: cada palavra do nome da escala precisa
// ser o início da palavra correspondente no nome das férias ("Luciane" → "Luciane Pastore",
// "Marcio Z" → "Marcio Zim" / "Marcio Z.", mas não "Marcio Bastos").

export type Ausencia = { pessoa: string; inicio: string; fim: string; tipo: 'ferias' | 'folga' }

function tokens(nome: string): string[] {
  return nome
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/).filter(Boolean)
}

export function mesmaPessoa(nomeEscala: string, nomeFerias: string): boolean {
  const a = tokens(nomeEscala), b = tokens(nomeFerias)
  if (!a.length || a.length > b.length) return false
  return a.every((t, i) => b[i].startsWith(t))
}

/** Ausência (férias/folga) da pessoa na data (YYYY-MM-DD), ou null se está disponível. */
export function ausenciaNoDia(pessoa: string, data: string, ausencias: Ausencia[]): Ausencia | null {
  if (!pessoa) return null
  return ausencias.find(a => a.inicio <= data && data <= a.fim && mesmaPessoa(pessoa, a.pessoa)) ?? null
}

export const rotuloAusencia = (a: Ausencia) => a.tipo === 'folga' ? 'folga' : 'férias'
