# GT3 Sistema — Dados dos Módulos (v3 — completo)

Cole seções específicas no Claude Code conforme for desenvolvendo cada módulo.

---

## MÓDULO: Observações

### Categorias disponíveis
```json
[
  { "key": "Funcionários", "label": "Funcionários", "icon": "👤" },
  { "key": "Empresas", "label": "Empresas", "icon": "🏢" },
  { "key": "PGR & PCMSO & LTCAT", "label": "PGR / PCMSO / LTCAT", "icon": "📋" },
  { "key": "Contratantes", "label": "Contratantes", "icon": "🤝" },
  { "key": "BSA", "label": "BSA", "icon": "🔵" }
]
```

### Sub-categoria: Funcionários → Ficha Registro
```json
[
  { "tag": "S/ CNPJ", "texto": "Favor rever: necessário constar CNPJ da empresa. Sugerimos carimbo." },
  { "tag": "CNPJ DIFERE", "texto": "Favor rever: CNPJ da empresa difere do cadastrado. Dentro do CNPJ cadastrado, apenas será possível aprovar pessoas sob o mesmo CNPJ.\n\nEntrar em contato, enviando o cartão CNPJ para cadastro@gttres.com.br" },
  { "tag": "Função não consta PGR/PCMSO", "texto": "Favor rever: função não consta no PGR e PCMSO vigentes da empresa no Portal. Caso tenha os adendos com a nova função, favor enviar para laudos@gttres.com.br\nDeves contatar com a sua Medicina Ocupacional\n\nOu, se for o caso, alterar a função do ASO conforme alguma existente no PGR/PCMSO" },
  { "tag": "Função cf ASO", "texto": "Favor rever: necessário enviar ficha registro com função atualizada conforme ASO. Se preferir, podes enviar ficha do eSocial." },
  { "tag": "Qual correta? ASO", "texto": "Favor rever: função difere entre ficha registro e ASO. Qual está correta? Estando a do ASO correta, iremos alterar no Portal e será necessário anexar ficha registro novamente. Sendo a da ficha correta, necessário ajustar o ASO." },
  { "tag": "Ficha original", "texto": "Favor anexar junto a ficha registro original. Se preferir, podes anexar ficha do eSocial. Caso tenha dúvidas em como unir ou separar arquivos, sugerimos o uso do https://www.ilovepdf.com/pt" },
  { "tag": "Qual correta? Ficha", "texto": "Favor rever: função difere entre ficha registro e ASO. Qual está correta? Estando a da ficha correta, iremos alterar no Portal e será necessário anexar docs novamente. Sendo a do ASO correta, necessário ajustar Ficha Registro com alteração de função." }
]
```

### Sub-categoria: Funcionários → ASO
```json
[
  { "tag": "Difere CNPJ", "texto": "Favor rever: refere-se a outro CNPJ/razão social." },
  { "tag": "S/ CNPJ", "texto": "Favor rever: necessário constar CNPJ da empresa." },
  { "tag": "Exames complementares", "texto": "Favor rever: enviar apenas ASO, sem exames complementares, pois os mesmos são de sigilo médico. Caso tenha dúvidas em como unir ou separar arquivos, sugerimos o uso do https://www.ilovepdf.com/pt" },
  { "tag": "Função difere", "texto": "Favor rever: função difere do antigo ASO e Portal. Ele alterou função? Se sim, favor contatar por aqui, que iremos alterar função no Portal e será necessário enviar novos docs com a função atualizada." },
  { "tag": "Assinatura", "texto": "Favor rever: necessário coletar assinatura do funcionário." },
  { "tag": "Função não consta PGR/PCMSO", "texto": "Favor rever: função não consta no PGR e PCMSO vigentes da empresa no Portal. Caso tenha os adendos com a nova função, favor enviar para laudos@gttres.com.br\n\nDeves contatar com a sua Medicina Ocupacional.\n\nOu, se for o caso, alterar a função do ASO conforme alguma existente no PGR/PCMSO." }
]
```

### Sub-categoria: Funcionários → EPI
```json
[
  { "tag": "EPI + xx dias", "texto": "Favor rever: necessário enviar ficha de EPI atualizada, com entregas de equipamentos com CA dentro de 365 dias." },
  { "tag": "Mesma ficha", "texto": "Favor rever: necessário anexar ficha atualizada, com novas entregas de equipamentos com CA. A ficha enviada já está aprovada no Portal." },
  { "tag": "Data de Devolução", "texto": "Favor indicar novas entregas, sem data de devolução preenchidas." },
  { "tag": "NR 35", "texto": "Favor rever: não identificado entregas de EPIs para trabalhos em altura, como cinto de segurança/talabarte e capacete com jugular." },
  { "tag": "S/ identificação", "texto": "Favor anexar junto a página de identificação do colaborador e da empresa." },
  { "tag": "S/ CA", "texto": "Favor rever: necessário constar o CA dos EPIs." },
  { "tag": "Formato dia/mês/ano", "texto": "Preenchidas com dia/mês/ano. Consta apenas dia/mês." },
  { "tag": "Assinatura entregas", "texto": "Favor rever: necessário coletar assinatura nas entregas." },
  { "tag": "S/ Data entregas", "texto": "Favor rever: necessário indicar data de entrega de cada EPI, em formato de dia/mês/ano." },
  { "tag": "Termo Recebimento", "texto": "Favor rever: necessário constar assinatura na declaração de recebimento/termo de compromisso." }
]
```

---

## MÓDULO: Cadastro de Contratantes

### Contratante: MADAL
```json
{
  "nome": "MADAL",
  "campos": [
    { "tipo": "text", "rotulo": "AUTORIZAÇÃO P/CADASTRO", "valor": "Sim. l.sommer@palfinger.com" },
    { "tipo": "text", "rotulo": "CONTATO UNIDADES", "valor": "Sommer Luiz Henrique" },
    { "tipo": "text", "rotulo": "TELEFONE", "valor": "54 99681 1577" },
    { "tipo": "text", "rotulo": "E-MAIL", "valor": "l.sommer@palfinger.com" },
    { "tipo": "text", "rotulo": "GT0180", "valor": "Somente as SOB DEMANDA" },
    { "tipo": "text", "rotulo": "INTEGRAÇÃO EAD", "valor": "Orientação da integração EAD material pasta Madal" },
    { "tipo": "text", "rotulo": "INFORMAÇÕES ADICIONAIS", "valor": "" },
    { "tipo": "text", "rotulo": "GT0120", "valor": "Não possui documento ignorados" }
  ]
}
```

### Contratante: MEINCOL (VOESTALPINE)
```json
{
  "nome": "MEINCOL",
  "campos": [
    { "tipo": "text", "rotulo": "AUTORIZAÇÃO P/CADASTRO", "valor": "SIM. Jessica Pereira" },
    { "tipo": "text", "rotulo": "CONTATO UNIDADES", "valor": "Mateus Seimetz\nAndre Tinoco\nJessica Pereira" },
    { "tipo": "text", "rotulo": "TELEFONE", "valor": "54 3220-9146" },
    { "tipo": "text", "rotulo": "E-MAIL", "valor": "Mateus.Seimetz@voestalpine.com\nJessica.Pereira@voestalpine.com\nAltemir.Darosa@voestalpine.com\nBruno.Caprini@voestalpine.com" },
    { "tipo": "text", "rotulo": "INTEGRAÇÃO EAD", "valor": "Orientação da integração EAD material pasta MEINCOL" },
    { "tipo": "text", "rotulo": "INFORMAÇÕES ADICIONAIS", "valor": "Com COPARTICIPAÇÃO.\nUso do APP GT MOBILE para envio de documentos para a VOESTALPINE TRANSPORTADORAS" },
    {
      "tipo": "table", "rotulo": "GT0120",
      "tabela": {
        "headers": ["Cód", "Documento", "Doc. Completa", "Doc. Reduzida", "MEI s/ funcionários"],
        "rows": [
          ["128","ALVARÁ DE LOCALIZAÇÃO E FUNCIONAMENTO - PERIÓDICO","X","X","X"],
          ["100","CONTRATO SOCIAL","X","X","X"],
          ["101","CARTÃO CNPJ","X","X","X"],
          ["212","RECIBO DCTFWEB - MENSAL","X","Ignorar","Não se aplica"],
          ["102","INSS + IRRF MENSAL - GUIA MAIS COMPROVANTE DE PAGTO","X","Ignorar","Não se aplica"],
          ["115","FGTS MENSAL - GUIA MAIS COMPROVANTE DE PAGTO","X","Ignorar","Não se aplica"],
          ["103","DETALHE DA GUIA EMITIDA - RELATÓRIO DO FGTS MENSAL","X","X","Não se aplica"],
          ["105","CERTIDÃO DE TRIBUTOS MUNICIPAIS","X","Ignorar","Não se aplica"],
          ["152","CERTIDÃO DE TRIBUTOS ESTADUAIS - INFORMADA","X","Ignorar","Ignorar"],
          ["106","CERTIDÃO DE DÉBITOS RELATIVOS TRIBUTOS FEDERAIS - SEMESTRAL","X","Ignorar","Ignorar"],
          ["113","CERTIDÃO TRABALHISTA CNDT (TST) - SEMESTRAL","X","Ignorar","Ignorar"],
          ["215","PCMSO - PROGRAMA CONTROLE MÉDICO SAÚDE OCUPACIONAL - BIENAL","X","X","Avaliação"],
          ["124","PGR - PROGRAMA DE GERENCIAMENTO DE RISCO - BIENAL","X","X","Avaliação"],
          ["135","CONTRATO ENTRE PRESTADORES","X","X","X"],
          ["127","DAS - DOCUMENTO ARRECADAÇÃO SIMPLES NACIONAL/PGMEI - MENSAL","Não se aplica","Não se aplica","X"]
        ]
      }
    }
  ]
}
```

---

## MÓDULO: E-mails Padrão

```json
{
  "de_nome": "GT3 Consultoria",
  "de_email": "cadastro@gttres.com.br",
  "telefones": "54 9 9122 4460 · 54 3292 4088 · 54 3196 0500"
}
```

### E-mail 1 — MARCOPOLO
```json
{
  "cliente": "MARCOPOLO", "categoria": "Portal de Terceiros",
  "assunto": "MARCOPOLO - Portal de Terceiros - Orientações",
  "resumo": "5 passos: Cadastrar Pessoas, Integração, Política SI, Notif. Ex-colaborador, LGPD",
  "body_html": "<p>Prezado prestador,</p><p>Seu cadastro foi realizado com sucesso.</p><h3>Acesso ao Portal</h3><p>Acessar <a href='http://www.gttres.com.br'>www.gttres.com.br</a> → ícone Portal de Terceiros.</p><ul><li><b>LOGIN:</b> XXXX.XXXX</li><li><b>SENHA:</b> GT2025 (alterar no primeiro acesso)</li></ul><h3>PRÓXIMOS PASSOS</h3><p><b>1º Passo — Cadastrar Pessoas</b><br>Cadastrar no portal (ver TUTORIAL). Ao selecionar a função, os documentos requeridos são carregados.<br><em>Obs.: para alterar documentos, contate a GT3.</em></p><p><b>2º Passo — Integração de Terceiros</b><br>Presencial, via agendamento no Portal. Apresentar-se 15 min antes.<br><b>LOCAL:</b> MARCOPOLO – Portaria Principal - Av. Rio Branco, 4889, Ana Rech, Caxias do Sul. EPIs obrigatórios: sapato fechado, óculos e protetor auditivo. Auditório da Montagem B.</p><p><b>3º Passo — Política de Segurança da Informação</b><br>Em anexo: orientação para postar no requisito POLÍTICA DE SEGURANÇA DA INFORMAÇÃO.</p><p><b>4º Passo — Notificação Ex-colaborador</b><br>Em anexo: NOTIFICAÇÃO de EX-COLABORADOR. Atente às orientações do documento.</p><p><b>5º Passo — Contrato GT3 e Termo LGPD</b><br>No portal serão carregados 2 documentos:<br>a. <b>CONTRATO DE PRESTAÇÃO DE SERVIÇOS</b> — GT3 como operadora dos dados junto à MARCOPOLO.<br>b. <b>TERMO MÚTUO CONSENTIMENTO LGPD</b> — Lei 13.709/18.<br>Aceite pelo LOGIN do responsável diretamente no portal.</p><h3>ENVIO DE DOCUMENTOS</h3><p>Todos os docs (empresa + pessoas) em PDF pelo portal. Acesso liberado somente após envio completo e participação na Integração.</p><p>TUTORIAL RÁPIDO disponível no portal (PDF e VÍDEO).</p><p><b>Contato:</b> 54 9 9122 4460 · 54 3292 4088 · <a href='mailto:cadastro@gttres.com.br'>cadastro@gttres.com.br</a></p><p>Atenciosamente,<br><b>Cadastro GT3</b></p>"
}
```

### E-mail 2 — FCC CAMPO BOM
```json
{
  "cliente": "FCC CAMPO BOM", "categoria": "Portal de Terceiros",
  "assunto": "FCC CAMPO BOM - Portal de Terceiros - Orientações",
  "resumo": "4 passos: Cadastrar Pessoas, Integração, LGPD, Envio de documentos",
  "body_html": "<p>Prezado prestador,</p><p>Seu cadastro foi realizado com sucesso.</p><h3>Acesso ao Portal</h3><p>Acessar <a href='http://www.gttres.com.br'>www.gttres.com.br</a> → ícone Portal de Terceiros.</p><ul><li><b>LOGIN:</b> XXX.XXX</li><li><b>SENHA:</b> GT2025 (alterar no primeiro acesso)</li></ul><h3>PRÓXIMOS PASSOS</h3><p><b>1º Passo — Cadastrar Pessoas</b><br>Cadastrar no portal. Ao selecionar a função, os documentos requeridos são carregados.<br><em>Obs.: para alterar documentos, contate a GT3.</em></p><p><b>2º Passo — Integração de Terceiros</b><br>Presencial, agendamento pelo portal para cada funcionário (ver Agendar Treinamento).</p><p><b>3º Passo — Contrato GT3 e Termo LGPD</b><br>No portal serão carregados 2 documentos:<br>a. <b>CONTRATO DE PRESTAÇÃO DE SERVIÇOS</b>.<br>b. <b>TERMO LGPD MÚTUO CONSENTIMENTO</b> — Lei 13.709/18.<br>Aceite pelo LOGIN do REPRESENTANTE LEGAL no portal.</p><p><b>4º Passo — Envio de documentos</b><br>a. PESSOA(s): parte SUPERIOR do DASHBOARD.<br>b. EMPRESA: parte INFERIOR do DASHBOARD.<br><em>Obs.: docs entram com status VENCIDO mesmo na 1ª entrega. Formato: PDF.</em></p><p>TUTORIAL RÁPIDO disponível no portal (PDF e VÍDEO).</p><p><b>Contato:</b> 54 9 9122 4460 · 54 3292 4088 · <a href='mailto:cadastro@gttres.com.br'>cadastro@gttres.com.br</a></p><p>Atenciosamente,<br><b>Cadastro GT3</b></p>"
}
```

---

## MÓDULO: Manuais

### Documento: Foto 3x4
```json
{
  "id": "foto3x4", "nome": "Foto 3x4", "categoria": "Funcionários", "periodicidade": "Única",
  "secoes": [
    { "label": "Verificação", "itens": [
      "Foto legível com possibilidade de identificação da pessoa",
      "Formato aceito: JPEG, GIF, PNG ou PDF (para confecção de crachá)",
      "Fundo da foto liso, de preferência branco (para eventual emissão de crachás)",
      "Se possível, comparar com a foto da ficha registro"
    ]},
    { "label": "Observações", "itens": ["Periodicidade: única"] }
  ]
}
```

### Documento: Ficha Registro do Empregado
```json
{
  "id": "ficha_registro", "nome": "Ficha Registro do Empregado", "categoria": "Funcionários", "periodicidade": "Única",
  "secoes": [
    { "label": "Verificação", "itens": [
      "Função do funcionário descrita no PGR e condizente com a função cadastrada no portal de terceiros",
      "Razão social e CNPJ (deve ser o mesmo número do cadastrado no portal)",
      "Assinatura do funcionário e da empresa",
      "Data de admissão preenchida"
    ]},
    { "label": "Observações", "itens": [
      "Aceitar ficha do eSocial como alternativa",
      "Em caso de função divergente entre ficha e ASO, solicitar esclarecimento ao prestador"
    ]}
  ]
}
```

---

## MÓDULO: Home Office

### Configuração padrão
```json
{
  "colaboradores_padrao": ["Marcio Z", "Luciane", "Rodrigo Balem"],
  "opcoes_status": ["Presencial", "Home Office", "Férias", "Licença", "Feriado"],
  "storage_key": "gt3_home_office_v1"
}
```

### Comportamentos
- Gera tabela mensal automaticamente (dias úteis apenas, pula fins de semana)
- Cada célula: dropdown com as opções de status
- Mês vigente: editável | Histórico: somente leitura
- Ao virar o mês, arquiva automaticamente em histórico[ano][mês]
- Adicionar/remover colaboradores da lista
- Navegação no histórico por ano → mês

---

## MÓDULO: Controle de Revisão

### Configuração padrão
```json
{
  "colaboradores_padrao": ["Marcio Z", "Luciane", "Rodrigo Balem", "Camila"],
  "storage_key": "gt3_controle_revisao_v1"
}
```

### Estrutura de dados: Revisão
```json
{
  "id": "uid",
  "data": "13/05/2026",
  "documento": "ASO",
  "empresa": "Nome da empresa",
  "responsavel": "Rodrigo Balem",
  "inconsistencia": "Descrição da inconsistência encontrada",
  "resolvido": false
}
```

### Estrutura de dados: Escala diária
```json
{
  "dia": 13,
  "revisor": "Rodrigo Balem"
}
```

### Comportamentos
- Tabela de revisões: filtro por busca, status resolvido/pendente
- Escala: tabela com os dias do mês × revisor atribuído
- Mês vigente editável, histórico read-only
- Arquivamento automático mensal

---

## MÓDULO: PDI — Natália Fumagali Chaxim

### Identificação
```json
{
  "nome": "Natália Fumagali Chaxim",
  "funcao": "Auxiliar Administrativo",
  "periodo": "12/08/2024 — 14/11/2025",
  "ciclo": "1º PDI"
}
```

### Matriz de Avaliação
```json
{
  "competencias": ["Relacionamento Interpessoal","Inteligência Emocional","E-mail","WhatsApp","Comprometimento","Doc funcionário","Doc empresa","PGR/PCMSO/LTCAT","Cadastro","Doc veículo","Atendimento ao cliente"],
  "diretiva": [2,2,3,1,3,2,1,1,4,1,2],
  "auto":     [3,4,3,2,5,3,2,1,4,1,3],
  "ambicao":  [5,5,5,5,5,4,5,4,4,3,4],
  "totais": { "diretiva": 22, "auto": 31, "ambicao": 49, "max": 55 }
}
```

### Plano de Ação
```json
[
  { "competencia": "Proatividade", "desenvolver": "Desempenhar tarefas cotidianas sem solicitação prévia", "acoes": "Dominar as tarefas do dia a dia, não deixando atividades pertinentes sem ação ou no aguardo de que seja solicitado.", "resultados_esperados": "Segurança técnica e emocional para realização dos itens.", "status": "Em andamento", "inicio": "17/11/2025", "termino": "28/02/2026" },
  { "competencia": "Proatividade", "desenvolver": "Iniciativa de perguntar/questionar", "acoes": "Através de situações diversas (e-mail/ligação), conversar com demais integrantes.", "resultados_esperados": "Aumentar entrosamento e gama de conhecimento sobre demais áreas.", "status": "Não iniciado", "inicio": "17/11/2025", "termino": "28/02/2026" },
  { "competencia": "Documentação", "desenvolver": "Realizar aprovação de ASO e ficha registro", "acoes": "Passar a considerar estes documentos como parte da gama de docs a serem avaliados.", "resultados_esperados": "Entender o conceito da solicitação destes itens, realizando avaliações com segurança.", "status": "Em andamento", "inicio": "17/11/2025", "termino": "28/02/2026" },
  { "competencia": "Documentação", "desenvolver": "Entendimento conceitual dos docs da empresa", "acoes": "Questionar, pesquisar, buscar conhecer a gama de documentos.", "resultados_esperados": "Conhecimento satisfatório sobre o motivo da solicitação.", "status": "Não iniciado", "inicio": "17/11/2025", "termino": "28/02/2026" },
  { "competencia": "Comportamental", "desenvolver": "Uso do fone de ouvido", "acoes": "Cessar o uso do fone durante horário de expediente.", "resultados_esperados": "Aumentar atenção e facilitar troca de informações.", "status": "Concluído", "inicio": "17/11/2025", "termino": "28/02/2026" },
  { "competencia": "Comportamental", "desenvolver": "Desenvolver senso de urgência", "acoes": "Identificar itens próximos a vencimento e tratar contratantes com prazos curtos.", "resultados_esperados": "Entender momentos que precisam priorização.", "status": "Em andamento", "inicio": "17/11/2025", "termino": "28/02/2026" },
  { "competencia": "WhatsApp", "desenvolver": "Começar a utilizar o WhatsApp", "acoes": "Passar a responder o WhatsApp no que tange documentação.", "resultados_esperados": "Ampliar domínio de canais com timing e qualidade.", "status": "Não iniciado", "inicio": "17/11/2025", "termino": "28/02/2026" },
  { "competencia": "Telefone", "desenvolver": "Começar a atender ligações", "acoes": "Passar a atender ligações e resolver assuntos de documentação.", "resultados_esperados": "Ampliar domínio de canais com timing e qualidade.", "status": "Não iniciado", "inicio": "17/11/2025", "termino": "28/02/2026" }
]
```

### Perfil Comportamental — Natália
```json
{
  "eneagrama": [
    { "rank": 1, "tipo": "Tipo 2 — Ajudante", "pontuacao": "20/25", "pontos_fortes": ["Gosta de ajudar e ser útil","Afetiva, empática e colaborativa","Constrói relações de confiança"], "riscos": ["Dificuldade em dizer não","Pode se sobrecarregar"] },
    { "rank": 2, "tipo": "Tipo 7 — Otimista", "pontuacao": "18/25", "pontos_fortes": ["Entusiasta e positiva","Aprende rápido"], "riscos": ["Pode perder foco em rotinas longas"] },
    { "rank": 3, "tipo": "Tipo 9 — Mediadora", "pontuacao": "18/25", "pontos_fortes": ["Busca harmonia","Boa ouvinte"], "riscos": ["Tendência à passividade"] }
  ],
  "animais": [
    { "animal": "Lobo 🐺", "percentual": 36, "perfil": "Relacional / Seguradora" },
    { "animal": "Gato 🐱", "percentual": 32, "perfil": "Analítica / Cuidadosa" },
    { "animal": "Águia 🦅", "percentual": 16, "perfil": "Estratégica / Visão" },
    { "animal": "Tubarão 🦈", "percentual": 16, "perfil": "Executor / Ação" }
  ],
  "conclusoes": {
    "forcas": ["Cumpre rotinas com consistência","Atua bem com controles e conferências","Mantém ambiente harmonioso","Gera clima de confiança interna"],
    "onde_agrega": ["Rotinas administrativas e documentais","Conferência e padronização","Apoio na gestão de prestadores","Comunicação entre áreas"],
    "riscos": ["Cobrança agressiva pode gerar retração","Falta de clareza causa lentidão","Desmotiva sem reconhecimento"],
    "como_liderar": ["Dar metas claras com prazos","Feedback positivo público","Nunca cobrar em público","Acompanhar de perto no início"]
  }
}
```

---

## MÓDULO: PDI — Marina Magnaguagno Zanella

### Identificação
```json
{
  "nome": "Marina Magnaguagno Zanella",
  "funcao": "Analista de Serviços",
  "periodo": "05/09/2022 — 04/03/2026",
  "ciclo": "PDI em andamento"
}
```

### Matriz de Avaliação
```json
{
  "competencias": ["Relacionamento Interpessoal","Inteligência Emocional no Trabalho","E-mail","WhatsApp","Comprometimento","Doc funcionário","Doc empresa","PGR/PCMSO/LTCAT","Cadastro e itens relacionados","Doc veículo","Atendimento ao cliente"],
  "diretiva": [3,3,4,4,5,3,4,1,2,1,3],
  "auto":     [4,3,4,4,5,3,5,2,3,2,4],
  "ambicao":  [4,4,5,5,5,3,5,3,4,2,5],
  "totais": { "diretiva": 33, "auto": 39, "ambicao": 45, "max": 55 }
}
```

### Plano de Ação
```json
[
  { "competencia": "Mudança de mentalidade", "desenvolver": "Competências maiores dentro de sua área e de pessoas, maior autonomia de decisões técnicas", "acoes": "Buscar estar mais envolvida nas soluções de itens que não pertencem apenas à sua área, ampliar competências.", "resultados_esperados": "Abertura para se desenvolver mais em outras documentações. Desenvolver autonomia e capacidade de passar conhecimento e conduzir assuntos (reuniões com clientes)", "status": "Em andamento", "inicio": "05/03/2026", "termino": "" },
  { "competencia": "Desacelerar o ritmo", "desenvolver": "Buscar não tentar resolver tudo/zerar tudo incessantemente", "acoes": "Identificar principalmente aquilo que é prioridade a partir do meio da tarde nos dias mais corridos.", "resultados_esperados": "Chegar em um nível de fluxo de processos que não seja mais necessário a revisão completa, mas sim por amostragem", "status": "Em andamento", "inicio": "05/03/2026", "termino": "" },
  { "competencia": "Conhecer mais documentos", "desenvolver": "Ter maior acervo de documentos que domina", "acoes": "Em épocas de baixa, buscar conhecer aos poucos novas documentações, como funcionários", "resultados_esperados": "Poder realizar, ao menos, avaliações de documentos de pessoas administrativos e alguns de Segurança do Trabalho mais simples", "status": "Em andamento", "inicio": "05/03/2026", "termino": "" },
  { "competencia": "Rotinas do sistema", "desenvolver": "Ampliar conhecimento das rotinas do sistema", "acoes": "Desenvolver ampla capacidade de operação em todos os processos no sistema, desde o cadastro até a liberação do funcionário terceiro.", "resultados_esperados": "Dominar as rotinas de processo de sistema no portal", "status": "Em andamento", "inicio": "05/03/2026", "termino": "" },
  { "competencia": "Flexibilização de critérios quando oportuno", "desenvolver": "Compreender cada vez mais o papel da GT3 — propósito da análise de documentos: auxiliar o terceiro para liberação no sistema com agilidade e assertividade legal.", "acoes": "Entender o impacto de flexibilizar em alguns itens, entendendo que o papel de fiscalizador não cabe à GT3", "resultados_esperados": "Chegar em um nível de sobriedade técnica cada vez maior para entender impacto de decisões", "status": "Em evolução", "inicio": "02/03/2026", "termino": "" },
  { "competencia": "Agilizar processos", "desenvolver": "Identificar processos que podem ser melhorados para tornar mais fluído", "acoes": "Copiar o prestador em e-mails direcionados à contratante, evitando e-mails paralelos e centralizando a comunicação", "resultados_esperados": "Fluidez maior de processo, visto que a maioria dos e-mails ocorrem na época mais corrida do mês", "status": "Em andamento", "inicio": "02/03/2026", "termino": "" }
]
```

### Perfil Comportamental — Marina
```json
{
  "eneagrama": {
    "pontos_fortes": ["Confiabilidade operacional muito alta","Postura firme quando identifica inconsistência","Clima positivo no time","Aderência a processos e regras"],
    "pontos_atencao": ["Tendência à rigidez excessiva","Possível inflexibilidade decisória","Pode assumir papel de fiscal em vez de facilitadora"],
    "como_desenvolver": ["Reuniões rápidas de calibragem","Acompanhamento de casos reais"]
  },
  "mbti": {
    "tipo": "ESTJ",
    "descricao": "Extroversão · Sensação · Pensamento · Julgamento",
    "combinacao": "Tipo 1 Eneagrama + Lobo Alto = Guardiã do Sistema",
    "nucleo": ["Segurança → regra → execução correta","Forte necessidade de estrutura previsível","Alto senso de responsabilidade pessoal","Orientação natural para manter o sistema funcionando"],
    "tomada_decisao": ["O que a regra diz?","O documento está correto?","Qual o impacto da decisão?"]
  },
  "conclusoes": {
    "forcas": ["Comprometimento muito alto","Confiabilidade operacional","Persistência diante de dificuldades","Forte aderência a processos"],
    "pontos_atencao": ["Tendência a aplicar a regra de forma muito literal","Resistência a mudanças de procedimento","Dificuldade em análises mais interpretativas","Rigidez excessiva com clientes"],
    "onde_agrega": ["Atividades que exigem padronização","Análise documental rotineira","Funções com regras claras e pouco grau de ambiguidade","Padronização de processos","Controle de conformidade"],
    "como_liderar": ["Apresentar mudanças com justificativa lógica e baseada em regras","Dar espaço para ela questionar antes de implementar","Reconhecer publicamente a consistência operacional","Calibrar periodicamente o que é flexibilizável vs. inegociável"]
  }
}
```
