-- Seed: Veículos, Empresas e BSA
-- Execute no SQL Editor do Supabase

-- ============================================================
-- VEÍCULOS (12 documentos)
-- ============================================================
INSERT INTO public.manuais_documentos (id, categoria_id, titulo, secoes, periodicidade, ativo)
VALUES

('contrato_locacao_veiculo',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'veiculos'),
 'Contrato de Locação/Aluguel',
 '[{"label":"Verificação","items":["Nome da empresa locadora deve ser o mesmo que está no CRLV","Locatário deve ser a mesma empresa que está postando no Portal","Contrato deve estar sempre assinado"]},{"label":"Observações","items":["Periodicidade: única","Não é necessário estar autenticado em cartório"]}]'::jsonb,
 'Única', true),

('rntrc',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'veiculos'),
 'Comprovante RNTRC - Reg. de Transportadores Rodov. de Cargas',
 '[{"label":"Verificação","items":["Nome/CNPJ da empresa","Placa do veículo","Validade","Autorização para transporte explícita","Situação ativa"]},{"label":"Observações","items":["Periodicidade: informada","Deve ser consultado pelo link oficial da ANTT a regularidade do certificado","Somente algumas empresas da Minuano possuem essa solicitação"]}]'::jsonb,
 'Informada', true),

('apolice_seguro_veiculo',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'veiculos'),
 'Apólice de Seguro de Veículo',
 '[{"label":"Verificação","items":["Verificar CNPJ da empresa e/ou razão social","Conferir placa da apólice e a cadastrada no portal","Verificar a vigência (data de emissão e de validade) — conferir com o portal","Para ônibus: seguro de responsabilidade civil do Transportador Rodoviário de Passageiros em Viagens Municipais e Intermunicipais","Consultar no site da SUSEP se a seguradora está cadastrada"]},{"label":"Observações","items":["Não pode ser proposta, deve ser a apólice","Periodicidade: informada (conferir vigência do documento)"]}]'::jsonb,
 'Informada', true),

('cronotacografo',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'veiculos'),
 'Certificado de Verificação do Cronotacógrafo',
 '[{"label":"Verificação","items":["Verificar CNPJ ou razão social da empresa","Conferir placa","Verificar a vigência"]},{"label":"Observações","items":["Periodicidade: informada"]}]'::jsonb,
 'Informada', true),

('litv_veiculo',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'veiculos'),
 'LITV - Laudo de Inspeção Técnica Veicular (ônibus)',
 '[{"label":"Verificação","items":["Verificar CNPJ, razão social e placa","Verificar a vigência","Conferir a página referente aos testes realizados e a página do CREA — sem essas páginas, não validar o laudo"]},{"label":"Observações","items":["Periodicidade: anual","É possível dispensar o LITV do veículo Zero KM, desde que apresente o DRNV (Documento de Registro de Veículo Novo) protocolado no DAER conforme resolução 4926/08"]}]'::jsonb,
 'Anual', true),

('crlv',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'veiculos'),
 'CRLV - Certificado de Registro e Licenciamento de Veículo',
 '[{"label":"Verificação","items":["Verificar CNPJ e/ou razão social da empresa","Se o veículo não for de propriedade da empresa, o nome dela pode estar no campo de observações; caso contrário, cobrar o Contrato de Locação","Conferir placa no portal e no documento"]},{"label":"Vencimento por placa (RS)","items":["A data de vencimento varia conforme o final da placa do veículo","A validade no Portal será um ano à frente da data da tabela. Ex: validade 30/06/23 → 30/06/24 no sistema","Verificar o estado do documento: SC, PR e SP podem ter vencimento diferente — consultar o Detran de cada estado"]},{"label":"Observações","items":["Periodicidade: informada, com data base no exercício do ano anterior"]}]'::jsonb,
 'Informada', true),

('alvara_vigilancia_sanitaria_veiculo',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'veiculos'),
 'Alvará de Vigilância Sanitária de Veículo',
 '[{"label":"Verificação","items":["Verificar CNPJ e/ou razão social da empresa","Conferir placa","Verificar a vigência (emissão e validade)"]},{"label":"Observações","items":["Periodicidade: anual"]}]'::jsonb,
 'Anual', true),

('licenca_fretamento',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'veiculos'),
 'Licença de Fretamento Contínuo',
 '[{"label":"Verificação","items":["Nome da empresa","Placa do veículo","Validade — considerar sempre a data indicada no local grifado no documento","Deve estar assinado pelo DAER"]},{"label":"Observações","items":["Periodicidade: informada","Não confundir com licença de turismo, pois o modelo é semelhante"]}]'::jsonb,
 'Informada', true),

('civ',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'veiculos'),
 'CIV - Certificado de Inspeção Veicular',
 '[{"label":"Aplicação","items":["Inspeção do Inmetro solicitada para veículos — Caminhões ou reboques (tanques) — de transporte de produtos e/ou resíduos perigosos pela ANTT"]},{"label":"Verificação","items":["Verificar Selo Inmetro","Verificar CNPJ ou razão social da empresa","Conferir placa","Conferir datas (emissão e vencimento)","Conferir assinatura"]},{"label":"Observações","items":["Periodicidade: anual"]}]'::jsonb,
 'Anual', true),

('cipp',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'veiculos'),
 'CIPP - Certificado de Inspeção para Transporte de Produtos Perigosos',
 '[{"label":"Aplicação","items":["Inspeção do Inmetro para caminhões com tanque acoplados (caminhões simples) e/ou reboques tanques de transporte de produtos perigosos pela ANTT","Não aplicável a caminhão trator (cavalinho) — excluir nesse caso"]},{"label":"Verificação","items":["Verificar Selo Inmetro","Conferir datas (emissão e vencimento)","Verificar CNPJ ou razão social da empresa","Conferir placa","Conferir tipo do equipamento","Conferir assinaturas"]},{"label":"Observações","items":["Periodicidade: anual"]}]'::jsonb,
 'Anual', true),

('cvv',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'veiculos'),
 'CVV - Certificado de Verificação de Veículo Tanque Rodoviário',
 '[{"label":"Aplicação","items":["Inspeção do Inmetro para caminhões com tanque acoplados (caminhões simples) e/ou reboques tanques de transporte de produtos perigosos pela ANTT","Não aplicável a caminhão trator (cavalinho) — excluir nesse caso"]},{"label":"Verificação","items":["Verificar indicação do Inmetro","Conferir datas (emissão e vencimento)","Verificar CNPJ ou razão social da empresa","Conferir placa","Conferir resultado","Conferir assinaturas"]},{"label":"Observações","items":["Periodicidade: bienal"]}]'::jsonb,
 'Bienal', true),

('checklist_veiculos',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'veiculos'),
 'Check List Veículos Mensal',
 '[{"label":"Verificação","items":["A placa do veículo deve ser igual à cadastrada no portal","O mês de referência (campo \"Rótulos de Linha\") deve ser o mês anterior ao mês atual — a emissão pode ser no mês atual, mas a referência de verificações será sempre o mês anterior","Nome e rubrica da pessoa que executou o check list pela empresa"]},{"label":"Observações","items":["Periodicidade: mensal","Vencimento: todo dia 10"]}]'::jsonb,
 'Mensal', true);


-- ============================================================
-- EMPRESAS (~20 documentos)
-- ============================================================
INSERT INTO public.manuais_documentos (id, categoria_id, titulo, secoes, periodicidade, ativo)
VALUES

('alvara_municipal',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'empresas'),
 'Alvará de Localização e Funcionamento Municipal (cód. 128)',
 '[{"label":"Verificação","items":["Verificar se o documento postado é o solicitado pelo requisito","Razão social e CNPJ devem ser o mesmo do cadastro","Verificar o endereço com o cadastro (GT0220)","Verificar se o objeto social descrito no alvará corresponde à atividade descrita pela empresa no e-mail","Quando não constam todas as atividades, postar juntamente a ''Certidão de Lotação'' onde constam todas as atividades","Para empresas MEI, pode ser postado o CCMEI","Verificar a validade: se indeterminado, atribuir data futura (Ano 2100)"]},{"label":"Casos especiais","items":["P/C - Dispensa do Alvará conforme Resolução 51/06/19 deve estar prevista no CNAE do cartão CNPJ","Prefeitura de Erechin: endereço só como ponto de referência → ''Certidão de Lotação''","Prefeitura de São Marcos: endereço só como ponto de referência → DIM (Declaração de Inscrição Municipal)","Prefeituras SP: Certificado de Licenciamento Integrado ou Auto de Licença e Funcionamento","Prefeitura de Criciúma: validar por um ano da data de emissão"]},{"label":"Observações","items":["Periodicidade: única"]}]'::jsonb,
 'Única', true),

('contrato_social',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'empresas'),
 'Contrato Social (cód. 100)',
 '[{"label":"Verificação","items":["Razão social e CNPJ devem ser os mesmos do cadastro","O documento deve ser postado na íntegra (todas as páginas)","Verificar o registro na Junta Comercial (selo ou rodapé de cada página)","Verificar se o objeto social corresponde à atividade descrita no e-mail (consultar GT0220)","Validar mesmo quando for só alteração (s/consolidação), desde que tenha o objeto social","Para Requerimento de Empresário: ato deve ser inscrição ou alteração — não pode ser extinção","Para SA: postar o Estatuto Social; Para MEI: CCMEI"]},{"label":"Natureza jurídica","items":["213-5: MEI e Empresário Individual","230-5: Eireli","223-2: Sociedade Simples Pura (médicos, advogados)","206-2: Ltda e Sociedade Limitada Unipessoal (MP 881/19)"]},{"label":"Observações","items":["Periodicidade: única"]}]'::jsonb,
 'Única', true),

('cartao_cnpj',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'empresas'),
 'Cartão CNPJ (cód. 101)',
 '[{"label":"Verificação","items":["Verificar CNPJ e razão social — devem ser os mesmos do cadastro","Verificar se a atividade (CNAE) corresponde à atividade descrita no e-mail (consultar GT0220)"]},{"label":"Observações","items":["Dúvidas sobre CNAE: consultar https://cnae.ibge.gov.br/","Periodicidade: única"]}]'::jsonb,
 'Única', true),

('inscricao_estadual_emp',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'empresas'),
 'Cartão de Inscrição Estadual (cód. 151)',
 '[{"label":"Verificação","items":["Verificar CNPJ e razão social — devem ser os mesmos do cadastro","Para transportadoras e empresas de comunicação, verificar se está ativo","Para empresas que não possuem inscrição: postar Certidão de Pessoa Jurídica Não Inscrita no Cadastro Geral de Contribuintes Estaduais"]},{"label":"Observações","items":["Denominação do documento: Consulta Pública ao Cadastro do Estado — emitido em www.sefaz.rs.gov.br > consultas > contribuinte > CNPJ","São listados apenas três CNAEs por inscrição (escolhidos pela Receita Estadual)","Para o estado do PR: aceita a ''Certidão Estadual''","Periodicidade: única"]}]'::jsonb,
 'Única', true),

('pat_emp',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'empresas'),
 'PAT - Comprovante de Adesão (cód. 164)',
 '[{"label":"Verificação","items":["Verificar CNPJ e razão social (emitido para filiais) — devem ser os mesmos do cadastro","Verificar o tipo de serviço"]},{"label":"Observações","items":["Denominação do documento: Comprovante de Registro de PJ Fornecedora — emitido pelo MTE","Periodicidade: única"]}]'::jsonb,
 'Única', true),

('cndt',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'empresas'),
 'CNDT - Certidão de Débitos Trabalhistas (cód. 113)',
 '[{"label":"Verificação","items":["Verificar CNPJ e razão social (para filial, deve ser o CNPJ da filial)","Verificar se a certidão é negativa ou positiva com efeito de negativa","Quando positiva com efeito de negativa: apenas sinalizar na observação — não é necessário aprovar com restrição","Validar pelo vencimento da certidão"]},{"label":"Observações","items":["Periodicidade: semestral"]}]'::jsonb,
 'Semestral', true),

('cnd_federal',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'empresas'),
 'Certidão de Débitos Relativos a Tributos Federais (cód. 106)',
 '[{"label":"Verificação","items":["Verificar CNPJ e razão social — devem ser os mesmos do cadastro","Para filiais, a CND é emitida com o CNPJ da matriz","Verificar se a certidão é negativa ou positiva com efeito de negativa","Quando positiva com efeito de negativa: apenas sinalizar na observação","Validar pelo vencimento da certidão"]},{"label":"Observações","items":["Periodicidade: semestral"]}]'::jsonb,
 'Semestral', true),

('cnd_municipal',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'empresas'),
 'Certidão de Tributos Municipal (cód. 105)',
 '[{"label":"Verificação","items":["Verificar CNPJ e razão social (não pode ser CNPJ da matriz no caso de filiais)","Verificar se a certidão é negativa ou positiva com efeito de negativa","Quando positiva com efeito de negativa: apenas sinalizar","Validar pelo vencimento"]},{"label":"Observações","items":["Periodicidade: conforme vencimento do documento"]}]'::jsonb,
 'Informada', true),

('cnd_estadual',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'empresas'),
 'Certidão de Tributos Estaduais (cód. 152)',
 '[{"label":"Verificação","items":["Verificar CNPJ e razão social (não pode ser CNPJ da matriz para filiais)","Verificar se a certidão é negativa ou positiva com efeito de negativa","Quando positiva com efeito de negativa: apenas sinalizar","Validar pelo vencimento da certidão"]},{"label":"Observações","items":["Periodicidade: informada"]}]'::jsonb,
 'Informada', true),

('crf_fgts_emp',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'empresas'),
 'CRF - Certificado de Regularidade de FGTS (cód. 141)',
 '[{"label":"Verificação","items":["Verificar CNPJ e razão social (não pode ser CNPJ da matriz para filiais)","Verificar se a certidão é negativa ou positiva com efeito de negativa","Quando positiva com efeito de negativa: justificar como risco baixo","Validar pelo vencimento do CRF"]},{"label":"Observações","items":["Periodicidade: informada","Para a Braslux: periodicidade trimestral"]}]'::jsonb,
 'Informada', true),

('fgts_mensal_emp',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'empresas'),
 'FGTS Mensal - Guia + Comprovante de Pagamento (cód. 115)',
 '[{"label":"Verificação","items":["Verificar CNPJ e razão social — devem ser os mesmos do cadastro","Verificar a competência (empresas mensais: ordem cronológica; sob demanda: competência da liberação ou anterior)","Verificar a autenticação bancária — não pode ser agendamento; valor da autenticação deve corresponder ao da guia","Conferir valor da guia com o apurado na GFIP","Quando não houver recolhimento de FGTS, solicitar página da GFIP ''Relação dos Trabalhadores constantes no arquivo SEFIP resumo fechamento''"]},{"label":"Observações","items":["Periodicidade: mensal","Emitir com data do dia 25 do mês seguinte à competência","Quando na GFIP estiver apurado valor de duas guias (menor aprendiz), solicitar as duas guias ou aceitar somente a de maior valor"]}]'::jsonb,
 'Mensal', true),

('inss_irrf_mensal',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'empresas'),
 'INSS + IRRF Mensal - Guia + Comprovante de Pagamento (cód. 102)',
 '[{"label":"Verificação","items":["Verificar CNPJ e razão social — devem ser os mesmos do cadastro","Verificar a competência (ordem cronológica para mensais; competência da liberação ou anterior para sob demanda)","Verificar autenticação bancária ou extrato de contribuições — não pode ser agendamento","Verificar se o valor da guia confere com o apurado na GFIP","Se houver recolhimento de IRRF em guia separada, solicitar também essa guia; a soma deve ser a mesma do Recibo DCTFWeb","Denominação do documento: DARF Numerada (para empresas no E-Social)"]},{"label":"Sem recolhimento","items":["Se não houver recolhimento por compensação ou retenção, solicitar Recibo DCTFWeb ou Recibos PerdComp","Em caso de compensação PerdComp: solicitar recibo + pedido de compensação para prestadores da PLS"]},{"label":"Parcelamento","items":["Postar guia GPS (cód. 4308) / DARF (1124), comprovante de pagamento e relatório (recibo de adesão e negociação)"]},{"label":"Observações","items":["Periodicidade: mensal","Emitir com data do dia 25 do mês seguinte à competência"]}]'::jsonb,
 'Mensal', true),

('detalhe_guia_emitida',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'empresas'),
 'Detalhe da Guia Emitida - Relatório Mensal (cód. 103)',
 '[{"label":"Verificação","items":["Verificar CNPJ e razão social","Verificar competência (mensal: ordem cronológica; sob demanda: competência da liberação ou anterior)","Verificar se todos os funcionários cadastrados no portal estão relacionados — caso contrário, verificar se a admissão é posterior à competência ou se é sócio","Solicitar preferencialmente documento completo: deve constar ao menos a relação dos funcionários e as páginas com apuração do FGTS"]},{"label":"Observações","items":["Estagiários não constam na RE","Periodicidade: mensal","Emitir com data do dia 25 do mês seguinte à competência"]}]'::jsonb,
 'Mensal', true),

('das_simples',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'empresas'),
 'DAS - Simples Nacional / PGMEI (cód. 127)',
 '[{"label":"Aplicação","items":["Documento solicitado somente para empresas MEI"]},{"label":"Verificação","items":["Verificar CNPJ e razão social","Verificar competência (mensal: ordem cronológica; sob demanda: competência da liberação ou anterior)","Se o MEI tiver funcionário, incluir os requisitos GFIP, FGTS e INSS"]},{"label":"Observações","items":["Para MEIs que não possuem guia + comprovante, alternativa é emitir o ''comprovante de arrecadação'' pelo site da RFB","Limite de faturamento 2020: R$81.000,00/ano","Periodicidade: mensal","Emitir com data do dia 25 do mês seguinte à competência"]}]'::jsonb,
 'Mensal', true),

('pgr_pcmso_emp',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'empresas'),
 'PGR e PCMSO (cód. 124 / 107 / 108)',
 '[{"label":"PGR - Verificação","items":["Identificação da empresa adequadamente","Identificação de todas as funções da empresa","Inventário de Riscos","Plano de ação","Identificação e assinatura do responsável legal da empresa prestadora","Para Marcopolo/Neobus/Ciferal/Volare: deve conter frente de serviço","Funções cadastradas no Portal devem estar no PGR (exceto sócios sem ASO)","Para Jungheinrich: necessário também assinatura do elaborador"]},{"label":"PCMSO - Verificação","items":["Identificação da empresa adequadamente","Identificação de todas as funções da empresa conforme o PGR","Exames descritos por função ou grupo de funções a critério do médico","Identificação e assinatura do responsável legal"]},{"label":"Observações","items":["PGR e PCMSO não possuem conceito de vencimento, mas devem ser atualizados no portal a cada dois anos como padrão","Para Jungheinrich: necessário também assinatura do elaborador/médico responsável","Quando a empresa não tiver funcionários, verificar na GFIP se o requisito pode ser excluído"]}]'::jsonb,
 'Bienal', true),

('ata_cipa',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'empresas'),
 'Ata de Posse CIPA (cód. 120)',
 '[{"label":"Verificação","items":["Verificar os membros da ATA com o portal (pelo menos um deles)","Flegar membro da CIPA no sistema","Incluir NR5 anual (cód. 18)","Tirar o flegue dos que não são mais membros da CIPA","Informar fim de vigência do requisito para quem deixa de ser membro/designado: GT0100 > dois cliques no requisito > data final = dia de ontem"]},{"label":"Observações","items":["Exceção para Venetosul: (GT0100 > editar > designado)","Relatórios > Empresas > Relação CIPA (GT3007) > Executar","Membro da CIPA: mais de uma pessoa; Designado da CIPA: uma única pessoa","Periodicidade: anual"]}]'::jsonb,
 'Anual', true),

('contrato_prestacao_servicos',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'empresas'),
 'Contrato de Prestação de Serviços entre Prestadores (cód. 111)',
 '[{"label":"Verificação","items":["Verificar se a contratante e contratada condizem","Verificar se a atividade confere com o que será realizado na contratante","Conferir assinaturas de ambas as partes","Verificar validade: se indeterminado, o requisito permanece em ''única'' e é só validar"]},{"label":"Observações","items":["''A renovação do presente contrato será automática'' = por tempo indeterminado","Se houver validade e prazo definido, inserir o requisito como periódico e o prazo deve ser o mesmo especificado no contrato","Periodicidade: única ou informada"]}]'::jsonb,
 'Única', true),

('autorizacao_fretamento',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'empresas'),
 'Autorização Transporte Fretamento (Certificado Recefitur) (cód. 118)',
 '[{"label":"Verificação","items":["Verificar CNPJ e razão social — devem ser os mesmos do cadastro","Em Serviços Autorizados deve constar FRETAMENTO ou TURISMO","Validar sempre pela data do certificado"]},{"label":"Observações","items":["Documento emitido pela METROPLAN ou DAER","Periodicidade: informada"]}]'::jsonb,
 'Informada', true),

('comprovante_antt',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'empresas'),
 'Comprovante de Registro e Regularidade ANTT (cód. 147)',
 '[{"label":"Verificação","items":["Verificar CNPJ e razão social — devem ser os mesmos do cadastro (cadastro somente para a matriz)","Validar com data de um dia antes da validade do documento"]},{"label":"Observações","items":["Categorias: ETC (Empresa de Transporte Rodoviário de Carga); TAC (Transporte Autônomo de Carga) — Lei 11.442/07","Periodicidade: informada"]}]'::jsonb,
 'Informada', true),

('aet',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'empresas'),
 'AET - Análise Ergonômica do Trabalho',
 '[{"label":"Aplicação","items":["Solicitada para empresas com grau de risco 3 ou 4 (CNAE principal do cartão CNPJ — não considerar CNAEs secundários)","Isentada para grau de risco 1 e 2"]},{"label":"Verificação","items":["Verificar o nome da empresa terceira","Indicação do profissional legalmente habilitado (PLH): nome, registro no conselho de classe e assinatura","Verificar se constam todas as funções"]},{"label":"Observações","items":["Periodicidade de atualização: a cada dois anos (bienal)"]}]'::jsonb,
 'Bienal', true);


-- ============================================================
-- BSA (documentos de empresa e de pessoas)
-- ============================================================
INSERT INTO public.manuais_documentos (id, categoria_id, titulo, secoes, periodicidade, ativo)
VALUES

-- DOCUMENTOS DE EMPRESA
('bsa_contrato_social',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'bsa'),
 'Contrato Social',
 '[{"label":"Verificação","items":["Todas as empresas são de montagem — verificar CNAE 4292-8/01 (Montagem de Estruturas Metálicas)","Exceção: empresas de Automação ou de prestação de serviço (ex.: Analista ou Técnico de Montagem, TST e Topografia) não precisam do CNAE 4292-8/01","Razão social, endereço, atividade prevista, assinaturas e autenticação da junta comercial"]},{"label":"Observações","items":["Acordado que o requisito se manterá único no portal; solicitar atualização somente se houver alteração de razão social ou por demanda da BSA","Não verificar capital social ou quadro societário","Periodicidade: única (informada para facilitar concessão de prazo de atualização)"]}]'::jsonb,
 'Única', true),

('bsa_cartao_cnpj',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'bsa'),
 'Cartão CNPJ',
 '[{"label":"Verificação","items":["Todas as empresas são de montagem — verificar CNAE 4292-8/01 (Montagem de Estruturas Metálicas)","Razão social, endereço, atividade prevista e validade","Pedir CNPJ atualizado"]},{"label":"Observações","items":["Periodicidade: anual"]}]'::jsonb,
 'Anual', true),

('bsa_alvara_localizacao',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'bsa'),
 'Alvará de Localização',
 '[{"label":"Verificação","items":["Verificar CNPJ e razão social","Para empresas recém-constituídas: pode ser aprovado protocolo de abertura de processo + taxa com comprovante de pagamento por 30 dias","Declaração da prefeitura é aceita no lugar do Alvará (definido em 13/08/25)","Verificar endereço e objeto social"]},{"label":"Observações","items":["Periodicidade: anual"]}]'::jsonb,
 'Anual', true),

('bsa_seguro_vida',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'bsa'),
 'Seguro de Vida em Grupo',
 '[{"label":"Verificação","items":["Apólice de seguro em grupo, em nome da empresa, com cobertura para os colaboradores","Valor mínimo: R$50.000,00 total","Coberturas obrigatórias: Morte natural, Morte por acidente, Invalidez total ou parcial","Verificar se a empresa possui cadastro na SUSEP"]},{"label":"Observações","items":["Em caso de apólice com validade superior a um ano (bienal, quinquenal etc.), validar conforme a vigência indicada na apólice ou no Endosso","Periodicidade: anual (informada)"]}]'::jsonb,
 'Anual', true),

('bsa_pgr',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'bsa'),
 'PGR + ART + Certificados dos Equipamentos de Medição',
 '[{"label":"Verificação","items":["Identificação da empresa / funções / Inventário de Riscos / Plano de ações (preenchido) / Identificação e assinatura do responsável da empresa e do elaborador/ART quando emitido por engenheiro","ART assinada por ambas as partes e datada","Se não houver medições quantitativas no PGR, não são necessários certificados de calibração","Se houver medições quantitativas, o certificado de calibração (ou o laudo indicando o certificado, no caso de químicos) deve constar no PGR"]},{"label":"Observações","items":["Periodicidade: bienal/informada","Obs. específica BSA: não verificar a validade dos certificados de calibração para aprovação do PGR"]}]'::jsonb,
 'Bienal', true),

('bsa_ltcat',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'bsa'),
 'LTCAT + ART',
 '[{"label":"Verificação","items":["Identificação da empresa / funções / Inventário de riscos / Plano de ações / Identificação e assinatura do responsável da empresa e do elaborador","ART paga e assinada","Mesmos itens verificados no PGR para consistência"]},{"label":"Observações","items":["Periodicidade: bienal/informada"]}]'::jsonb,
 'Bienal', true),

('bsa_cipa_responsavel',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'bsa'),
 'Certificado de Responsável da CIPA e Assédio',
 '[{"label":"Verificação","items":["Não há um modelo padrão da BSA — cada empresa indica o seu","Verificar dados da empresa e endereço","Baseado na NR 05","Deve constar um indicado (o mesmo que consta na NR 05)","Deve estar assinado pela empresa e pelo indicado","Verificar carga horária: 20 horas (conforme grau de risco 4)","Certificado deve indicar endereço (empresa ou elaborador)","Não é necessário que o funcionário esteja cadastrado no portal"]},{"label":"Observações","items":["Modelo enviado por e-mail pela BSA (Lauri)","Periodicidade: única/anual"]}]'::jsonb,
 'Anual', true),

('bsa_pcmso',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'bsa'),
 'PCMSO',
 '[{"label":"Verificação","items":["Identificação da empresa / funções e riscos conforme PGR / Plano de exames por função / Plano de ações preenchido","Quadro de médicos autorizados para avaliações clínicas e emissão de ASO (examinadores)","Identificação e assinatura do responsável da empresa e do médico elaborador","Para trabalho em altura: exames Eletrocardiograma, Glicemia, Hemograma completo, Audiometria, Acuidade visual, Psicossocial (obs.: Eletroencefalograma isentado conforme e-mail da contratante)","Assinaturas tanto da empresa quanto do elaborador (definido em 13/08/25)"]},{"label":"Observações","items":["Manter a indicação de Bienal no sistema, mas todos os PCMSOs devem ser aprovados como Anual (definido em 07/01 pela BSA)","A partir de 16/09/25: removida a nomenclatura ''bienal'' do requisito no Portal","Em caso de divergência entre médico examinador do ASO e PCMSO: reprovar ambos para adequação","Periodicidade: anual"]}]'::jsonb,
 'Anual', true),

('bsa_cnds',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'bsa'),
 'Certidões de Regularidade (CND Federal / Estadual / Municipal / Trabalhista)',
 '[{"label":"CND Federal","items":["CNPJ, validade — consultar no site da Receita Federal","Periodicidade: semestral"]},{"label":"CND Estadual","items":["CNPJ, validade — consultar nos sites das receitas estaduais","Periodicidade: informada"]},{"label":"CND Municipal","items":["CNPJ, validade — consultar nos sites das receitas municipais","Periodicidade: 180 dias"]},{"label":"CND Trabalhista","items":["CNPJ, validade — consultar no site do TST (Tribunal Superior do Trabalho)","Periodicidade: semestral"]},{"label":"Observações","items":["Certidão tem custo para emissão","Certidão Cível (Fórum): emitida em tjrs.jus.br — verificar se é necessária outra certidão específica","Periodicidade geral: conforme o tipo de certidão"]}]'::jsonb,
 'Semestral', true),

('bsa_fgts_mensal',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'bsa'),
 'FGTS Mensal - Guia + Comprovante de Pagamento',
 '[{"label":"Verificação","items":["Razão social, CNPJ, competência","Conferência de valores com o Detalhe da Guia Emitida","Comprovante de pagamento/autenticação bancária","Há possibilidade de envio da guia autenticada emitida diretamente no site do FGTS Digital onde constam os dados de pagamento"]},{"label":"Para homologação","items":["Solicitar guia + comprovante dos últimos 3 meses"]},{"label":"Observações","items":["Para empresas mensais: cobrar competências em sequência","Periodicidade: mensal"]}]'::jsonb,
 'Mensal', true),

('bsa_inss_mensal',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'bsa'),
 'INSS Mensal - Guia + Comprovante de Pagamento',
 '[{"label":"Verificação","items":["Razão social, CNPJ, competência","Conferência de valor com o Recibo DCTFWeb","Comprovante de pagamento/autenticação bancária","Há possibilidade de envio da guia autenticada emitida no site da Receita Federal","Se houver compensação de valores: solicitar Recibos PerdComp"]},{"label":"Para homologação","items":["Solicitar guia + comprovante dos últimos 3 meses"]},{"label":"Observações","items":["Periodicidade: mensal"]}]'::jsonb,
 'Mensal', true),

('bsa_simples_nacional',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'bsa'),
 'Simples Nacional - Guia + Comprovante + PGDAS',
 '[{"label":"Verificação","items":["Razão social, CNPJ, competência e comprovante de pagamento/autenticação bancária","Solicitar guia + comprovante de pagamento + PGDAS","Há dois requisitos: um de homologação (único) e outro de rotina (mensal)"]},{"label":"Empresa não optante pelo Simples","items":["Na homologação: aprovar a justificativa e isentar o requisito mensal","Em empresas já homologadas: aprovar a primeira entrega com justificativa e isentar o requisito mensal","Caso falte competência de faturamento: empresa deve justificar por e-mail e GT3 repassa à BSA"]},{"label":"Observações","items":["Periodicidade: mensal (após homologação)"]}]'::jsonb,
 'Mensal', true),

('bsa_contrato_prestacao',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'bsa'),
 'Contrato de Prestação de Serviços (Bertolini)',
 '[{"label":"Verificação","items":["Dados da contratante e da contratada","Objeto/atividade","Vigência e assinatura da contratante e contratada","Deve ser o contrato do terceiro com a Bertolini"]},{"label":"Observações","items":["Periodicidade: anual (validar por um ano da data de assinatura quando não houver indicação de validade)","Solicitar o contrato inicial mais o último aditivo para empresas já homologadas","Periodicidade: anual"]}]'::jsonb,
 'Anual', true),

('bsa_conta_bancaria',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'bsa'),
 'Conta Bancária Jurídica',
 '[{"label":"Verificação","items":["Solicitar documento em PDF (não o cartão da empresa)","Deve constar: razão social, indicação da conta bancária e do banco"]},{"label":"Observações","items":["Somente para homologação","Periodicidade: única"]}]'::jsonb,
 'Única', true),

-- DOCUMENTOS DE PESSOAS
('bsa_aso',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'bsa'),
 'ASO - Atestado de Saúde Ocupacional',
 '[{"label":"Verificação","items":["Nome do colaborador, CNPJ, função conforme PGR/PCMSO/Portal, data de admissão","Indicação de aptidão","Assinatura do médico e do colaborador","O médico examinador deve constar na lista de examinadores do PCMSO — em caso de divergência, reprovar ambos para adequação","Vigência conforme PCMSO; nome do médico coordenador/responsável separado do examinador (mesmo que seja a mesma pessoa)","Para NR 33 ou NR 35: solicitada aptidão específica para essas atividades","O médico examinador deve constar na lista de examinadores do PCMSO; caso inexista, alterar vencimento do PCMSO para 15 dias e aprovar o ASO por sua vigência padrão"]},{"label":"Observações","items":["O ASO deve obedecer os critérios da função no PCMSO, que deve obedecer os critérios no PGR (riscos devem ser os mesmos, inclusive na forma de descrição)","Seguir o padrão dos clientes","Mesmo quando conste data do exame clínico, deve constar também a data de saída do ASO","Periodicidade: conforme PCMSO (anual para BSA)"]}]'::jsonb,
 'Anual', true),

('bsa_ficha_epi',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'bsa'),
 'Ficha de EPI',
 '[{"label":"Verificação","items":["Nome e assinatura do colaborador no termo de compromisso (quando há campo)","Indicação do CA dos EPIs","Data (formato d/m/a) e assinatura em cada entrega","Para quem possui NR 35: solicitada entrega de cinto de segurança c/ talabarte + capacete c/ jugular","Se houver entrega sem assinatura (mesmo sem CA, ex.: Uniforme) é necessário reprovar — todos os campos de entrega devem estar assinados"]},{"label":"Observações","items":["Periodicidade: semestral (alterado de anual para semestral a partir de 13/08/25)","Ficha deve estar completa e atualizada nos últimos 6 meses"]}]'::jsonb,
 'Semestral', true),

('bsa_nr01',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'bsa'),
 'NR 01 - Ordem de Serviço Individual',
 '[{"label":"Verificação","items":["Nome do colaborador, nome da empresa, função conforme ASO/Portal","Assinatura do colaborador"]},{"label":"Observações","items":["Periodicidade: única","Reenviar se houver mudança de função"]}]'::jsonb,
 'Única', true),

('bsa_nr10',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'bsa'),
 'NR 10 - Eletricidade',
 '[{"label":"Verificação","items":["Nome e assinatura do colaborador","Nome/assinatura/registro do instrutor (registro no CREA/CFT na área de elétrica)","Nome/assinatura/registro do responsável técnico com registro no CREA/CFT na área de elétrica","Se o CREA/CFT estiver irregular ou inativo: reportar à BSA para rever como proceder","Conteúdo programático","Treinamento 100% online: aceito"]},{"label":"Observações","items":["Para a primeira aprovação: solicitar certificado de 40h + reciclagem, se for o caso","Periodicidade: bienal (geral) / anual (BSA)"]}]'::jsonb,
 'Bienal', true),

('bsa_nr11',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'bsa'),
 'NR 11 - Equipamentos de Movimentação de Cargas (Empilhadeira/Ponte/Talha/Guincho)',
 '[{"label":"Verificação","items":["Nome e assinatura do colaborador","Nome/assinatura/registro do instrutor com registro no CREA/CFT/MTE/IPAF na área de SSO","Conteúdo programático","Parte prática obrigatória — não pode ser 100% online","Ao inserir NR 11 de empilhadeira, incluir também CNH sem bloqueio"]},{"label":"Observações","items":["Pelo menos uma pessoa por empresa deve ter esse treinamento","Para a primeira aprovação de guincho: certificado de 40h + reciclagem de 8h (definido em 17/09/25)","Periodicidade: anual (BSA definiu anual; requisito de origem na função permanece bienal)"]}]'::jsonb,
 'Anual', true),

('bsa_nr12',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'bsa'),
 'NR 12 - Máquinas e Equipamentos',
 '[{"label":"Verificação","items":["Nome e assinatura do colaborador","Nome/assinatura/registro do instrutor com registro no CREA/CFT/MTE na área de SSO ou mecânica/similar","Se o CREA/CFT estiver irregular ou inativo: reportar à BSA","Conteúdo programático","Parte prática obrigatória — não pode ser 100% online","Não aceitar Eng. Civil como responsável técnico (mesmo que haja TST como instrutor — definido em 12/08/25)"]},{"label":"Observações","items":["Periodicidade: anual (BSA) / bienal (geral — requisito origem na função)","Altera com data de corte em 29/07/25: certificados anteriores podem ter ficado com validade bienal"]}]'::jsonb,
 'Anual', true),

('bsa_nr18',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'bsa'),
 'NR 18 - Construção Civil / PEMT',
 '[{"label":"NR 18 (Construção Civil)","items":["Nome e assinatura do colaborador","Nome/assinatura/registro do instrutor (CREA/CFT/MTE, área de SSO)","Conteúdo programático","Parte prática obrigatória — não pode ser 100% online","Não solicitado treinamento específico para integração de obras (4h) — cumprido pela integração da empresa"]},{"label":"NR 18 PEMT - Plataforma Elevatória Motorizada de Trabalho","items":["Nome e assinatura do colaborador","Nome/assinatura/registro do instrutor e do responsável técnico","Conteúdo programático e endereço do local de treinamento","Treinamento 100% online: aceito","Sempre questionar a empresa terceira sobre quem irá operar a PEMT (pelo menos uma pessoa)"]},{"label":"Observações","items":["Periodicidade: anual para ambos"]}]'::jsonb,
 'Anual', true),

('bsa_nr33',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'bsa'),
 'NR 33 - Espaços Confinados',
 '[{"label":"Verificação","items":["Nome e assinatura do colaborador","Nome/assinatura/registro do instrutor com registro no CREA/CFT/MTE na área de SSO","Conteúdo programático","Parte prática obrigatória — não pode ser 100% online","Para a primeira aprovação: certificado de 40h (Supervisor: 40h + reciclagem; Vigia: 16h + reciclagem)"]},{"label":"Observações","items":["Periodicidade: anual","Pelo menos duas pessoas devem ter esse treinamento"]}]'::jsonb,
 'Anual', true),

('bsa_nr35',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'bsa'),
 'NR 35 - Trabalho em Altura',
 '[{"label":"Verificação","items":["Nome e assinatura do colaborador","Nome/assinatura/registro do instrutor com registro no CREA/CFT/MTE na área de SSO","Conteúdo programático","Parte prática obrigatória — não pode ser 100% online","Não pode ser somente Eng. Civil como instrutor ou responsável técnico"]},{"label":"Observações","items":["Para todos os colaboradores com aptidão no ASO","Periodicidade: anual","Item era bienal — passou a ser anual a partir de 29/07/25 (altera com data de corte)"]}]'::jsonb,
 'Anual', true),

('bsa_documento_identidade',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'bsa'),
 'Documento de Identidade',
 '[{"label":"Verificação","items":["Aceito: CNH, RG (antigo) ou Carteira de Identidade (nova)","Deve ser colorido","Legível — não pode ser recortado de outro arquivo","Não pode ser muito antiga (subjetivo)"]},{"label":"Observações","items":["Denominação do requisito alterado de ''Cópia RG e CPF colorido'' para ''Documento de identidade'' em 24/06/25","Para RGs antigos: prazo no Portal até dez/32 (mesmo sendo documento para fins de identificação, não pode estar vencido)","Periodicidade: informada"]}]'::jsonb,
 'Informada', true),

('bsa_comprovante_residencia',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'bsa'),
 'Comprovante de Residência',
 '[{"label":"Verificação","items":["Deve ser um comprovante de residência com todos os dados legíveis","Aceito declaração de residência individual (sem modelo específico)","Deve ter sido emitido nos últimos 6 meses (data a contar da emissão do documento ou declaração)","Em nome do colaborador ou acompanhado de declaração"]},{"label":"Observações","items":["Reconfigurado para não bloquear acesso","Periodicidade: anual"]}]'::jsonb,
 'Anual', true),

('bsa_foto',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'bsa'),
 'Foto 3x4',
 '[{"label":"Verificação","items":["Legível, de busto (do peito para cima), próximo ao formato 3x4","Evitar selfie distante","Deve ser colorida (definido pela BSA — a partir de 16/09/25)","Não aceitar fotos recortadas de outro documento (a partir de 13/08/25)"]},{"label":"Observações","items":["Requisito reconfigurado exclusivamente para BSA (removido em outros clientes por questões de LGPD)","Periodicidade: única"]}]'::jsonb,
 'Única', true),

('bsa_ficha_registro',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'bsa'),
 'Ficha Registro',
 '[{"label":"Verificação","items":["Nome do colaborador / CPF / Nome da empresa / CNPJ","Assinatura do colaborador e da empresa (obrigatório desde 24/06/25)","Não aceitar fichas do eSocial","Se a ficha tiver campo para foto, solicitar foto (a partir de 13/08/25)","Reenviar atualizada em caso de mudança de função"]},{"label":"Observações","items":["A partir de 12/02/26: não precisa mais ter foto na ficha registro","Periodicidade: única"]}]'::jsonb,
 'Única', true),

('bsa_ctps',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'bsa'),
 'CTPS - Carteira de Trabalho Digital',
 '[{"label":"Verificação","items":["Nome do colaborador, nome da empresa, função similar conforme ASO/Portal","Se o CBO na FR e na CTPS for o mesmo e a função tiver nomenclatura similar, é possível aceitar","Em nova admissão: aceitar eSocial por 15 dias até a CTPS atualizar","Reenviar atualizada em caso de mudança de função","Aceitar apenas modelo digital"]},{"label":"Observações","items":["A partir de julho/25: função deve estar idêntica entre CTPS e ficha registro/ASO","A partir de 18/09/25: aceita nomenclatura similar ao CBO","Periodicidade: única (atualizar quando mudar função)"]}]'::jsonb,
 'Única', true),

('bsa_holerite',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'bsa'),
 'Holerite + Comprovante de Pagamento',
 '[{"label":"Verificação","items":["Nome do colaborador / competência / valor líquido visível / comprovante de pagamento em anexo","Valor total do comprovante deve corresponder ao indicado no holerite (tolerância de R$5,00 para mais ou para menos — definido em 16/03/26)","Para pagamento em espécie: recibo de pagamento assinado pelo funcionário junto ao holerite","Para adiantamento: comprovante do adiantamento + comprovante do residual (soma = valor do holerite)"]},{"label":"Observações","items":["Os holerites devem ser aprovados somente com o comprovante de pagamento","Periodicidade: mensal (dia 12)"]}]'::jsonb,
 'Mensal', true),

('bsa_carteira_vacinacao',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'bsa'),
 'Carteira de Vacinação',
 '[{"label":"Verificação","items":["Verificar nome do colaborador","Verificar se possui vacina Febre Amarela","Verificar vacina Antitetânica (dentro de 10 anos)"]},{"label":"Observações","items":["Periodicidade: informada — a partir de 20/08/25, alterado de bienal para informado, considerando 10 anos a contar da vacina antitetânica"]}]'::jsonb,
 'Informada', true),

('bsa_contrato_trabalho',
 (SELECT id FROM public.manuais_categorias WHERE slug = 'bsa'),
 'Contrato de Trabalho',
 '[{"label":"Verificação","items":["Nome do colaborador / CPF / Nome da empresa / CNPJ","Assinatura do colaborador e da empresa"]},{"label":"Observações","items":["Periodicidade: única (atualizar quando mudar função)"]}]'::jsonb,
 'Única', true);
