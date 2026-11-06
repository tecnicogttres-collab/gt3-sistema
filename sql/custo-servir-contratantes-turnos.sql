-- GT3 Sistema - Custo de Servir: contratantes reais, descricao de turnos e contratante principal
-- Execute uma vez no SQL Editor do Supabase (depois de custo-servir-ajustes.sql). Idempotente.
--
-- 1) Contratante principal: uma unidade (ex.: GUTEN, GLOW, ALIMENTAR) pode pertencer a um
--    contratante principal (ex.: 5 - SEDE / MATRIZ). A contagem continua separada por unidade
--    e o modulo tambem mostra o grupo somado. Os vinculos ficam vazios: voce define na tela.
-- 2) Turnos ganham descricao e passam a apontar para o contratante cadastrado.
-- 3) Trocar o codigo de um contratante atualiza turnos, grupos e unidades (ON UPDATE CASCADE).

BEGIN;

-- ── Colunas novas ───────────────────────────────────────────────────
ALTER TABLE public.cs_contratantes_fin ADD COLUMN IF NOT EXISTS contratante_pai text;
ALTER TABLE public.cs_turnos ADD COLUMN IF NOT EXISTS descricao text;

-- ── Contratantes (codigo e nome do cadastro do sistema; faturamento preservado) ──
INSERT INTO public.cs_contratantes_fin (contratante_cod, nome) VALUES
  ('1', 'MARCOPOLO S/A - ANA RECH'),
  ('4', 'GT3 CONSULTORIA E ASSESSORIA'),
  ('5', 'SEDE / MATRIZ'),
  ('9', 'MARCOPOLO SAO CRISTOVAO'),
  ('17', 'WEATHERFORD'),
  ('19', 'MADAL PALFINGER S/A'),
  ('21', 'SULBRAS UCS - MATRIZ'),
  ('22', 'SULBRAS USS SAPUCAIA'),
  ('23', 'SULBRAS USL UNIDADE SALTO'),
  ('24', 'SULBRAS UJN JOINVILE'),
  ('25', 'SULBRAS UPE PERNAMBUCO'),
  ('26', 'RSC RONI CHAVES'),
  ('27', 'MEINCOL TRANSPORTADORAS'),
  ('28', 'CONTRATANTE CONSULTA'),
  ('29', 'FCC - IND E COM LTDA'),
  ('30', 'SUMIG LTDA'),
  ('31', 'COOPERATIVA LANGUIRU LTDA SEDE'),
  ('32', 'AMBQUALITY ASSESSORIA LTDA'),
  ('33', 'LOPEZ & AGUZZOLI ENGENHARIA LT'),
  ('34', 'RJ RECREIO DA JUVENTUDE'),
  ('35', 'COMPANHIA MINUANO ALIMENTOS'),
  ('36', 'LANGUIRU FABRICA DE RACOES'),
  ('37', 'CD CENTRAL DISTRIB LANGUIRU'),
  ('38', 'VOLARE VEICULOS LTDA'),
  ('39', 'BRASLUX IND DE AUTO PECAS LTDA'),
  ('49', 'ASSOCIADOS LANGUIRU'),
  ('50', 'LANGUIRU - UNIDADE CACHOEIRINHA'),
  ('51', 'WSUL ESPUMAS IND E COM LTDA'),
  ('52', 'GPS'),
  ('53', 'GUTEN APETIT ALIMENT E SERV'),
  ('54', 'GLOW BRASIL LIMPEZA E SERV ESP'),
  ('55', 'VILLARE GASTRON EMPRESARIAL'),
  ('56', 'ALIMENTAR GASTRON EMPRESARIAL'),
  ('57', 'MEBRAFE INST E EQUIP FRIG LTDA'),
  ('58', 'PETTENATI S/A INDUSTRIA TEXTIL'),
  ('59', 'REFRISUL CURITIBA MONTAGENS'),
  ('60', 'GRUPO BRINOX'),
  ('61', 'PEDREIRA E CONCRETOS CAXIENSE'),
  ('62', 'MASER TRANSPORTES LTDA EPP'),
  ('64', 'SULBRAS MOLDES E PLASTICOS'),
  ('65', 'AGROARACA ALIMENTOS'),
  ('66', 'MOVEIS FLORENSE'),
  ('67', 'GRUPO IMEC'),
  ('68', 'FAMIGLIA VALDUGA'),
  ('69', 'JUNGHEINRICH LIFT TRUCK'),
  ('70', 'WOODBRIDGE - CAPIVARI'),
  ('71', 'WOODBRIDGE - SBC'),
  ('72', 'WOODBRIDGE - SBC ESCRITORIO'),
  ('73', 'WOODBRIDGE - CAÇAPAVA'),
  ('74', 'WOODBRIDGE - BETIM'),
  ('75', 'VOESTALPINE MEINCOL'),
  ('76', 'TRANSPORTADORAS MEINCOL'),
  ('77', 'TABONE IND E COM'),
  ('78', 'SINDMOVEIS'),
  ('79', 'BERTOLINI COLATINA'),
  ('80', 'BERTOLINI MATRIZ'),
  ('81', 'BSA BERTOLINI'),
  ('82', 'CSG CONCESSIONARIA SERRA GAUCH'),
  ('83', 'VINICOLA SALTON S/A'),
  ('84', 'EUROSTEC'),
  ('85', 'CIC BG'),
  ('86', 'PLS DO BRASIL LTDA'),
  ('87', 'LECHLER DO BRASIL'),
  ('88', 'DOCILE ALIMENTOS LTDA')
ON CONFLICT (contratante_cod) DO UPDATE SET nome = EXCLUDED.nome;

-- ── Ligacoes com integridade ────────────────────────────────────────
-- Unidade -> contratante principal (um nivel; nao pode apontar para si mesmo)
ALTER TABLE public.cs_contratantes_fin DROP CONSTRAINT IF EXISTS cs_contratantes_fin_pai_fkey;
ALTER TABLE public.cs_contratantes_fin
  ADD CONSTRAINT cs_contratantes_fin_pai_fkey FOREIGN KEY (contratante_pai)
  REFERENCES public.cs_contratantes_fin(contratante_cod) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE public.cs_contratantes_fin DROP CONSTRAINT IF EXISTS cs_contratantes_fin_pai_check;
ALTER TABLE public.cs_contratantes_fin
  ADD CONSTRAINT cs_contratantes_fin_pai_check CHECK (contratante_pai IS NULL OR contratante_pai <> contratante_cod);

-- Turno -> contratante (excluir contratante com turnos e bloqueado; trocar o codigo propaga)
ALTER TABLE public.cs_turnos DROP CONSTRAINT IF EXISTS cs_turnos_contratante_fkey;
ALTER TABLE public.cs_turnos
  ADD CONSTRAINT cs_turnos_contratante_fkey FOREIGN KEY (contratante_cod)
  REFERENCES public.cs_contratantes_fin(contratante_cod) ON UPDATE CASCADE ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS cs_turnos_contratante ON public.cs_turnos (contratante_cod);

-- Grupo de criterio -> contratante (excluir o contratante tira ele do grupo)
ALTER TABLE public.cs_grupo_contratantes DROP CONSTRAINT IF EXISTS cs_grupo_contratantes_contratante_fkey;
ALTER TABLE public.cs_grupo_contratantes
  ADD CONSTRAINT cs_grupo_contratantes_contratante_fkey FOREIGN KEY (contratante_cod)
  REFERENCES public.cs_contratantes_fin(contratante_cod) ON UPDATE CASCADE ON DELETE CASCADE;

-- ── Descricao dos turnos que constam no cadastro real (Melhoria do Relatorio de Eficiencia) ──
UPDATE public.cs_turnos t SET descricao = v.descricao
  FROM (VALUES
    ('1',  'MARCOPOLO - PRIMEIRO TURNO'),
    ('2',  'MARCOPOLO - SEGUNDO TURNO'),
    ('3',  'MARCOPOLO - TERCEIRO TURNO'),
    ('17', 'SÃO CRISTOVÃO - PRIMEIRO TURNO'),
    ('18', 'SÃO CRISTOVÃO - SEGUNDO TURNO'),
    ('19', 'SÃO CRISTOVÃO - TERCEIRO TURNO'),
    ('34', 'MADAL PALFINGER - 7:30 AS 17:30'),
    ('35', 'SULBRAS ADM 7:20 AS 17:10')
  ) AS v(turno_cod, descricao)
 WHERE t.turno_cod = v.turno_cod AND t.descricao IS NULL;

COMMIT;

-- Conferencia (esperado: 64 contratantes | 40 turnos | 8 com descricao | 0 unidades vinculadas)
SELECT (SELECT count(*) FROM public.cs_contratantes_fin) AS contratantes,
       (SELECT count(*) FROM public.cs_turnos) AS turnos,
       (SELECT count(*) FROM public.cs_turnos WHERE descricao IS NOT NULL) AS turnos_com_descricao,
       (SELECT count(*) FROM public.cs_contratantes_fin WHERE contratante_pai IS NOT NULL) AS unidades_vinculadas;
