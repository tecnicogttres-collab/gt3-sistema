'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  type Questionario, type Convite, type Pergunta, type TipoPergunta, type Publico, type StatusQn,
  type StatusExib, type PainelConfig,
  TYPE_NAME, TYPE_DESC, STATUS_QN_NAME, STATUS_EXIB_LABEL, statusExib, linkConvite, primeiroNome, valoresResposta,
} from './types'

// ─── Tokens (mesma paleta do HTML de referência) ─────────────────────────────

const ORD_COLOR = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#104281']
const CAT_COLOR = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']
const ST_COLOR: Record<StatusExib, string> = { respondido: '#0ca30c', enviado: '#fab219', nao_enviado: '#898781' }

const fmtData = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('pt-BR') : ''

/** Linha da lista "Incluir do Cadastro de Contratantes" (vem de /api/questionarios/[id]/cadastro). */
type LinhaCadastro = { contratanteId: string; empresa: string; email: string; origem: string; nome: string; jaIncluido: boolean }

const CSS = `
.qnm{--bg:#F4F6FA;--surface:#fff;--surface-2:#EBF0F9;--chart-surface:#fcfcfb;--primary:#2A4F96;--primary-dark:#1B3A73;--primary-soft:#E2E9F6;
  --text:#1C2530;--text-secondary:#52514e;--text-muted:#6F7A8C;--border:#DCE3EE;--gridline:#e1e0d9;--danger:#C53030;
  --st-good:#0ca30c;--st-warning:#fab219;--st-pending:#898781;--st-good-text:#0b7a0b;--st-warning-text:#8a5d0a;
  --shadow:0 1px 2px rgba(27,58,115,0.06),0 8px 24px -12px rgba(27,58,115,0.18);
  max-width:1180px;margin:0 auto;display:flex;flex-direction:column;gap:18px;color:var(--text);font-size:14px}
.qnm *{box-sizing:border-box}
.qnm button{font-family:inherit}
.qnm .eyebrow{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--primary)}
.qnm h1{font-weight:800;font-size:26px;margin:4px 0 4px;letter-spacing:-.5px}
.qnm .sub{color:var(--text-secondary);font-size:13.5px;max-width:70ch;margin:0;line-height:1.5}
.qnm .tabs{display:flex;gap:4px;background:var(--surface-2);padding:4px;border-radius:12px;width:fit-content;max-width:100%;flex-wrap:wrap}
.qnm .tab{font-weight:600;font-size:13px;padding:9px 15px;border-radius:9px;border:none;background:transparent;color:var(--text-muted);cursor:pointer}
.qnm .tab.on{background:var(--surface);color:var(--primary);box-shadow:var(--shadow)}
.qnm .view{display:flex;flex-direction:column;gap:18px}
.qnm .card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px 20px;box-shadow:var(--shadow)}
.qnm .card h2{font-size:15px;font-weight:700;margin:0 0 2px}
.qnm .cap{font-size:12.5px;color:var(--text-muted);margin:0 0 14px;line-height:1.45}
.qnm .btn{font-weight:700;font-size:13px;padding:9px 16px;border-radius:9px;border:1px solid var(--primary);cursor:pointer;background:var(--primary);color:#fff}
.qnm .btn:hover{background:var(--primary-dark);border-color:var(--primary-dark)}
.qnm .btn.ghost{background:transparent;color:var(--primary);border-color:var(--border)}
.qnm .btn.ghost:hover{background:var(--surface-2);border-color:var(--primary)}
.qnm .btn.danger{background:transparent;color:var(--danger);border-color:#F3C4C4}
.qnm .btn.danger:hover{background:#FFF5F5;border-color:var(--danger)}
.qnm .btn.small{font-size:12px;padding:6px 11px}
.qnm .btn:disabled{opacity:.45;cursor:not-allowed}
.qnm .link-btn{background:none;border:none;color:var(--primary);font-weight:700;font-size:13px;cursor:pointer;padding:4px 0}
.qnm .link-btn:hover{text-decoration:underline}
.qnm .field-label{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)}
.qnm input[type=text],.qnm textarea,.qnm select{font-family:inherit;font-size:13.5px;padding:8px 10px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);outline:none}
.qnm select{font-weight:600;background:var(--surface-2);cursor:pointer}
.qnm input[type=text]:focus,.qnm textarea:focus,.qnm select:focus{border-color:var(--primary)}
.qnm textarea{resize:vertical;width:100%;min-height:58px;line-height:1.4}
.qnm .pill-tag{display:inline-flex;align-items:center;font-size:11px;font-weight:700;padding:3px 9px;border-radius:100px;background:var(--surface-2);color:var(--text-secondary);white-space:nowrap}
.qnm .status-tag{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;padding:3px 9px;border-radius:100px;white-space:nowrap}
.qnm .status-tag::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}
.qnm .status-tag.ativo{background:rgba(12,163,12,.15);color:var(--st-good-text)}
.qnm .status-tag.rascunho{background:var(--surface-2);color:var(--text-muted)}
.qnm .status-tag.encerrado{background:rgba(250,178,25,.2);color:var(--st-warning-text)}
.qnm .hub-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:14px}
.qnm .qn-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px;box-shadow:var(--shadow);display:flex;flex-direction:column;gap:12px;min-width:0;overflow:hidden}
.qnm .qn-card h3{font-size:16px;font-weight:800;margin:0;line-height:1.25;min-width:0;overflow-wrap:anywhere}
.qnm .qn-card .pill-tag{max-width:100%;white-space:normal;overflow-wrap:anywhere}
.qnm .qn-numbers{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;border-top:1px solid var(--border);padding-top:12px}
.qnm .qn-numbers div{display:flex;flex-direction:column}
.qnm .qn-numbers b{font-size:18px;font-weight:800;font-variant-numeric:tabular-nums}
.qnm .qn-numbers span{font-size:11px;color:var(--text-muted)}
.qnm .qn-progress{height:6px;border-radius:100px;background:var(--surface-2);overflow:hidden}
.qnm .qn-progress i{display:block;height:100%;background:var(--st-good);border-radius:100px}
.qnm .qn-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:auto}
.qnm .qn-actions .btn{flex:1 1 auto;min-width:0;white-space:nowrap;padding-left:10px;padding-right:10px}
.qnm .qn-new{border:1.5px dashed var(--border);background:transparent;box-shadow:none;justify-content:center;min-height:200px}
.qnm .qn-new-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:none;border:none;cursor:pointer;color:var(--primary);font-weight:700;font-size:14px;min-height:160px;border-radius:10px;width:100%}
.qnm .qn-new-btn:hover{background:var(--surface-2)}
.qnm .plus-circle{width:42px;height:42px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:24px;line-height:1;flex:none}
.qnm .row{display:flex;flex-direction:column;gap:5px}
.qnm .editor-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:14px;align-items:start}
@media (max-width:860px){.qnm .editor-grid{grid-template-columns:1fr}}
.qnm .qlist{display:flex;flex-direction:column;gap:10px}
.qnm .qitem{border:1px solid var(--border);border-radius:12px;background:var(--surface);overflow:hidden}
.qnm .qitem-head{display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--surface-2);border-bottom:1px solid var(--border);flex-wrap:wrap}
.qnm .qnum{font-size:12px;font-weight:700;color:var(--primary);font-variant-numeric:tabular-nums}
.qnm .qtype{font-size:11.5px;font-weight:700;color:var(--text-secondary)}
.qnm .qitem-tools{margin-left:auto;display:flex;gap:4px;align-items:center}
.qnm .icon-btn{height:28px;min-width:28px;padding:0 8px;border-radius:7px;border:1px solid var(--border);background:var(--surface);color:var(--text-secondary);cursor:pointer;font-size:12px;font-weight:600}
.qnm .icon-btn:hover{border-color:var(--primary);color:var(--primary)}
.qnm .icon-btn:disabled{opacity:.35;cursor:not-allowed}
.qnm .icon-btn.danger:hover{border-color:var(--danger);color:var(--danger)}
.qnm .icon-btn.confirm{background:var(--danger);border-color:var(--danger);color:#fff}
.qnm .qitem-body{display:grid;grid-template-columns:120px 1fr;gap:8px 12px;padding:12px 14px}
@media (max-width:520px){.qnm .qitem-body{grid-template-columns:1fr;gap:3px 0}}
.qnm .qitem-body .k{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);padding-top:3px}
.qnm .qitem-body .v{font-size:14px;font-weight:600;line-height:1.4}
.qnm .answers-inline{display:flex;flex-wrap:wrap;gap:5px}
.qnm .answers-inline span{font-size:12px;font-weight:600;padding:3px 9px;border-radius:6px;background:var(--surface-2);border:1px solid var(--border);color:var(--text-secondary)}
.qnm .answers-inline .scale-desc{background:var(--primary-soft);border:none;padding:3px 8px;color:var(--primary);font-weight:600}
.qnm .add-q{display:flex;align-items:center;gap:12px;width:100%;padding:14px;border:1.5px dashed var(--border);border-radius:12px;background:transparent;cursor:pointer;color:var(--primary);font-weight:700;font-size:14px}
.qnm .add-q:hover{background:var(--surface-2);border-color:var(--primary)}
.qnm .add-q .plus-circle{width:32px;height:32px;font-size:20px}
.qnm .composer{border:1.5px solid var(--primary);border-radius:14px;background:var(--surface);overflow:hidden;box-shadow:var(--shadow)}
.qnm .composer-head{padding:12px 16px;background:var(--primary);color:#fff;font-weight:700;font-size:14px}
.qnm .composer-sec{padding:16px;display:flex;flex-direction:column;gap:10px}
.qnm .composer-sec + .composer-sec{border-top:1px solid var(--border)}
.qnm .sec-title{display:flex;align-items:baseline;gap:8px}
.qnm .sec-title .n{font-size:11px;font-weight:700;color:#fff;background:var(--primary);border-radius:50%;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;flex:none}
.qnm .sec-title h4{margin:0;font-size:14px;font-weight:800}
.qnm .sec-title small{font-size:12px;color:var(--text-muted)}
.qnm .type-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
@media (max-width:520px){.qnm .type-cards{grid-template-columns:1fr}}
.qnm .type-card{display:flex;flex-direction:column;gap:6px;align-items:flex-start;text-align:left;padding:12px;border-radius:10px;border:1.5px solid var(--border);background:var(--surface);cursor:pointer;color:var(--text)}
.qnm .type-card:hover{border-color:var(--primary)}
.qnm .type-card.on{border-color:var(--primary);background:var(--primary-soft)}
.qnm .type-card b{font-size:13px}
.qnm .type-card span{font-size:11.5px;color:var(--text-muted);line-height:1.35}
.qnm .scale-row{display:flex;gap:6px}
.qnm .scale-row span{flex:1;text-align:center;font-weight:700;font-size:13px;padding:8px 0;border-radius:7px;background:var(--surface-2);border:1px solid var(--border);color:var(--text-secondary)}
.qnm .scale-labels{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.qnm .scale-labels input{width:100%}
.qnm .opt-row{display:flex;align-items:center;gap:8px}
.qnm .opt-row .dot{width:14px;height:14px;border-radius:50%;border:2px solid var(--border);flex:none}
.qnm .opt-row input{flex:1;min-width:0}
.qnm .text-answer-demo{border:1px dashed var(--border);border-radius:8px;padding:12px;font-size:12.5px;color:var(--text-muted);background:var(--surface-2)}
.qnm .composer-foot{display:flex;align-items:center;gap:10px;justify-content:flex-end;padding:12px 16px;background:var(--surface-2);border-top:1px solid var(--border);flex-wrap:wrap}
.qnm .composer-error{margin-right:auto;font-size:12.5px;font-weight:600;color:var(--danger)}
.qnm .preview-shell{border:1px solid var(--border);border-radius:14px;overflow:hidden;background:var(--surface)}
.qnm .preview-top{background:var(--primary);color:#fff;padding:14px 16px}
.qnm .preview-top small{display:block;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;opacity:.8;margin-bottom:3px;font-weight:600}
.qnm .preview-top b{font-size:14.5px}
.qnm .preview-body{padding:16px;display:flex;flex-direction:column;gap:16px}
.qnm .pv-q{display:flex;flex-direction:column;gap:7px}
.qnm .pv-q.draft{border:1.5px dashed var(--primary);border-radius:10px;padding:10px}
.qnm .pv-label{font-size:13px;font-weight:600}
.qnm .pv-scale{display:flex;gap:5px}
.qnm .pv-scale span{flex:1;text-align:center;font-size:12px;font-weight:700;padding:7px 0;border-radius:6px;border:1px solid var(--border);background:var(--surface-2);color:var(--text-muted)}
.qnm .pv-ends{display:flex;justify-content:space-between;gap:8px;font-size:11px;font-weight:600;color:var(--primary)}
.qnm .pv-ends span{background:var(--primary-soft);border-radius:5px;padding:2px 7px}
.qnm .pv-ends span:last-child{margin-left:auto;text-align:right}
.qnm .pv-cond{font-size:11px;font-weight:600;color:var(--st-warning-text);background:rgba(250,178,25,.15);border-radius:6px;padding:3px 8px;align-self:flex-start}
.qnm .pv-choice.multi span::before{border-radius:3px}
.qnm .pv-regra{align-self:flex-start;font-size:10.5px;font-weight:700;border-radius:100px;padding:2px 9px;background:var(--primary-soft);color:var(--primary)}
.qnm .pv-regra.opc{background:var(--surface-2);color:var(--text-muted)}
.qnm .qcond{font-size:11px;font-weight:700;color:var(--st-warning-text);background:rgba(250,178,25,.18);border-radius:100px;padding:2px 9px}
.qnm .seg{display:inline-flex;border:1px solid var(--border);border-radius:9px;overflow:hidden;align-self:flex-start}
.qnm .seg button{border:none;background:var(--surface);padding:7px 13px;font-size:12.5px;font-weight:600;color:var(--text-secondary);cursor:pointer}
.qnm .seg button + button{border-left:1px solid var(--border)}
.qnm .seg button.on{background:var(--primary);color:#fff}
.qnm .pv-choice{display:flex;flex-direction:column;gap:6px}
.qnm .pv-choice span{display:flex;align-items:center;gap:8px;border:1px solid var(--border);border-radius:7px;padding:7px 10px;font-size:12.5px;background:var(--surface-2);color:var(--text-secondary)}
.qnm .pv-choice span::before{content:"";width:11px;height:11px;border-radius:50%;border:1.5px solid var(--text-muted);flex:none}
.qnm .pv-text{border:1px solid var(--border);border-radius:7px;padding:8px 10px;font-size:12px;color:var(--text-muted);background:var(--surface-2);min-height:44px}
.qnm .qn-select-bar{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.qnm .qn-select-bar select{font-size:15px;font-weight:800;padding:9px 12px;min-width:min(100%,320px)}
.qnm .filterbar{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px 16px;box-shadow:var(--shadow);display:flex;flex-wrap:wrap;gap:12px 18px;align-items:flex-end}
.qnm .f-group{display:flex;flex-direction:column;gap:6px}
.qnm .chipset{display:flex;gap:6px;flex-wrap:wrap}
.qnm .chip{font-size:12.5px;font-weight:600;padding:6px 12px;border-radius:100px;border:1px solid var(--border);background:var(--surface-2);color:var(--text-secondary);cursor:pointer;white-space:nowrap}
.qnm .chip:hover{border-color:var(--primary)}
.qnm .chip.on{background:var(--primary);border-color:var(--primary);color:#fff}
.qnm .f-search{flex:1 1 200px;min-width:160px}
.qnm .f-search input{width:100%;background:var(--surface-2)}
.qnm .f-hint{font-size:11.5px;color:var(--text-muted);margin:0}
.qnm .active-strip{display:flex;flex-wrap:wrap;gap:7px;align-items:center;font-size:12px;color:var(--text-muted)}
.qnm .pill{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;padding:4px 6px 4px 10px;border-radius:100px;background:var(--surface-2);color:var(--text);border:1px solid var(--border)}
.qnm .pill button{border:none;background:none;cursor:pointer;color:var(--text-muted);font-size:14px;line-height:1;padding:2px}
.qnm .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}
.qnm .stat{position:relative;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px 16px 13px;box-shadow:var(--shadow);overflow:hidden;display:flex;flex-direction:column;gap:2px}
.qnm .stat::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--primary)}
.qnm .stat.good::before{background:var(--st-good)}
.qnm .stat.warning::before{background:var(--st-warning)}
.qnm .stat .l{font-size:12px;font-weight:600;color:var(--text-secondary)}
.qnm .stat .n{font-weight:700;font-size:28px;line-height:1.15;letter-spacing:-.5px;color:var(--text)}
.qnm .stat .n.good{color:var(--st-good-text)}
.qnm .stat .n.warning{color:var(--st-warning-text)}
.qnm .stat .s{font-size:11.5px;color:var(--text-muted)}
.qnm .stat-meter{height:6px;border-radius:100px;background:rgba(12,163,12,.14);overflow:hidden;margin:5px 0 3px}
.qnm .stat-meter i{display:block;height:100%;border-radius:100px;background:var(--st-good);transition:width .5s cubic-bezier(.2,.8,.2,1)}
.qnm .grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media (max-width:760px){.qnm .grid2{grid-template-columns:1fr}}
.qnm .chart-card{display:flex;flex-direction:column}
.qnm .chart-card .chart-surface{flex:1;display:flex;flex-direction:column;justify-content:center}
.qnm .chart-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:2px}
.qnm .chart-head h2{margin:0;flex:1 1 200px;line-height:1.35}
.qnm .chart-meta{display:flex;gap:6px;flex-wrap:wrap}
.qnm .kpi-pill{font-size:11.5px;color:var(--text-muted);background:var(--surface-2);border-radius:100px;padding:3px 10px;white-space:nowrap}
.qnm .kpi-pill b{color:var(--text);font-variant-numeric:tabular-nums}
.qnm .seg-sm button{padding:5px 10px;font-size:11.5px}
.qnm .chart-surface{background:var(--chart-surface);border:1px solid #EEF1F6;border-radius:12px;padding:14px 14px 10px}
.qnm .legend{display:flex;gap:14px;flex-wrap:wrap;margin-top:12px;font-size:12px;color:var(--text-secondary)}
.qnm .legend-item{display:flex;align-items:center;gap:6px}
.qnm .legend-swatch{width:10px;height:10px;border-radius:3px;flex:none}
/* Dica ao passar o mouse (data-tip) */
.qnm [data-tip]{position:relative}
.qnm [data-tip]:hover::after,.qnm [data-tip]:focus-visible::after{content:attr(data-tip);position:absolute;left:50%;bottom:calc(100% + 6px);transform:translateX(-50%);background:#1A2340;color:#fff;font-size:11.5px;font-weight:600;padding:5px 9px;border-radius:7px;white-space:nowrap;pointer-events:none;z-index:20;box-shadow:0 6px 16px rgba(15,25,45,.25)}
/* Colunas (perguntas de nota 1–5) */
.qnm .colchart{position:relative;display:flex;gap:6px;flex:1;min-height:190px;max-height:300px;padding-top:4px}
.qnm .colgrid{position:absolute;left:0;right:0;top:44px;bottom:26px;display:flex;flex-direction:column;justify-content:space-between;pointer-events:none}
.qnm .colgrid i{display:block;height:1px;background:var(--gridline)}
.qnm .colgrid i:last-child{background:#c9c8c0}
.qnm .col{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:8px;background:none;border:none;padding:0;cursor:pointer;border-radius:8px}
.qnm .col:hover{background:rgba(42,79,150,.05)}
.qnm .col-plot{flex:1;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:5px;padding-top:18px}
.qnm .col-val{font-size:12px;font-weight:700;color:var(--text);font-variant-numeric:tabular-nums}
.qnm .col-bar{display:block;width:min(56%,40px);min-height:3px;border-radius:6px 6px 0 0;transition:height .5s cubic-bezier(.2,.8,.2,1),opacity .15s ease}
.qnm .col-label{font-size:12px;font-weight:700;color:var(--text-secondary);height:18px}
.qnm .col.dim .col-bar,.qnm .hbar.dim .hbar-fill{opacity:.28}
.qnm .col.sel .col-label{color:var(--primary)}
.qnm .col.sel .col-bar{box-shadow:0 0 0 2px var(--chart-surface),0 0 0 4px var(--primary)}
/* Barras horizontais (múltipla escolha) */
.qnm .hbars{display:flex;flex-direction:column;gap:4px}
.qnm .hbar{display:flex;flex-direction:column;gap:6px;width:100%;background:none;border:none;padding:7px 8px;border-radius:9px;cursor:pointer;text-align:left;font:inherit;color:inherit}
.qnm .hbar:hover{background:rgba(42,79,150,.05)}
.qnm .hbar.sel{background:var(--primary-soft)}
.qnm .hbar-top{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.qnm .hbar-label{display:flex;align-items:center;gap:7px;font-size:12.8px;font-weight:600;color:var(--text);min-width:0;overflow-wrap:anywhere}
.qnm .hbar-label i{width:9px;height:9px;border-radius:3px;flex:none}
.qnm .hbar-val{font-size:12px;color:var(--text-muted);white-space:nowrap;font-variant-numeric:tabular-nums}
.qnm .hbar-val b{color:var(--text)}
.qnm .hbar-track{display:block;height:10px;border-radius:100px;background:#EDF0F5;overflow:hidden}
.qnm .hbar-fill{display:block;height:100%;min-width:3px;border-radius:100px;transition:width .5s cubic-bezier(.2,.8,.2,1),opacity .15s ease}
.qnm .empty-note{font-size:12.5px;color:var(--text-muted);padding:28px 4px;text-align:center;width:100%;align-self:center}
/* Status por empresa */
.qnm .stacklist{display:flex;flex-direction:column;gap:13px}
.qnm .stackrow{display:flex;flex-direction:column;gap:6px}
.qnm .stackrow-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.qnm .stackrow-head button{font-size:13px;font-weight:700;color:var(--text);background:none;border:none;cursor:pointer;padding:1px 0;border-radius:5px;text-align:left}
.qnm .stackrow-head button:hover{color:var(--primary)}
.qnm .stackrow-head button.on{color:var(--primary);text-decoration:underline;text-underline-offset:3px}
.qnm .stackrow-head .tot{font-size:11.5px;color:var(--text-muted);font-variant-numeric:tabular-nums;white-space:nowrap}
.qnm .stackrow-head .tot b{color:var(--text)}
.qnm .stackbar{display:flex;height:10px;border-radius:100px;gap:2px;background:var(--chart-surface)}
.qnm .stackseg{height:100%;cursor:pointer;transition:opacity .15s ease,width .5s cubic-bezier(.2,.8,.2,1);min-width:4px;border:none;padding:0}
.qnm .stackseg:first-child{border-radius:100px 0 0 100px}
.qnm .stackseg:last-child{border-radius:0 100px 100px 0}
.qnm .stackseg:only-child{border-radius:100px}
.qnm .stackseg:hover{opacity:.82}
.qnm .stackseg.dim{opacity:.28}
/* Filtro de várias opções (Empresa) */
.qnm .msel{position:relative;min-width:220px}
.qnm .msel-btn{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;font-size:13.5px;font-weight:600;padding:8px 10px;border-radius:8px;border:1px solid var(--border);background:var(--surface-2);color:var(--text);cursor:pointer;text-align:left}
.qnm .msel-btn:hover,.qnm .msel-btn[aria-expanded=true]{border-color:var(--primary)}
.qnm .msel-btn.on{background:var(--primary-soft);border-color:var(--primary);color:var(--primary)}
.qnm .msel-btn:disabled{opacity:.55;cursor:default}
.qnm .msel-txt{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:260px}
.qnm .msel-caret{font-size:11px;color:var(--text-muted)}
.qnm .msel-pop{position:absolute;top:calc(100% + 6px);left:0;z-index:50;width:min(340px,calc(100vw - 32px));background:var(--surface);border:1px solid var(--border);border-radius:12px;box-shadow:0 14px 40px rgba(15,25,45,.18);padding:10px;display:flex;flex-direction:column;gap:8px}
.qnm .msel-pop input[type=text]{width:100%;background:var(--surface-2)}
.qnm .msel-tools{display:flex;justify-content:space-between;gap:8px}
.qnm .msel-tools button{background:none;border:none;color:var(--primary);font-weight:700;font-size:12px;cursor:pointer;padding:2px 0}
.qnm .msel-tools button:disabled{color:var(--text-muted);opacity:.6;cursor:default}
.qnm .msel-list{max-height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:1px;margin:0 -4px}
.qnm .msel-opt{display:flex;align-items:center;gap:9px;padding:7px 8px;border-radius:7px;font-size:13px;cursor:pointer}
.qnm .msel-opt:hover{background:var(--surface-2)}
.qnm .msel-opt.on{font-weight:700;color:var(--primary)}
.qnm .msel-vazio{font-size:12.5px;color:var(--text-muted);margin:8px}
.qnm .msel-foot{font-size:11.5px;color:var(--text-muted);border-top:1px solid var(--border);padding-top:7px}
.qnm .tbl-wrap{overflow-x:auto;border:1px solid var(--border);border-radius:10px;margin-top:4px}
.qnm table{width:100%;border-collapse:collapse;font-size:12.8px}
.qnm th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);font-weight:700;padding:9px 11px;background:var(--surface-2);white-space:nowrap;max-width:220px;overflow:hidden;text-overflow:ellipsis}
.qnm td{padding:9px 11px;border-top:1px solid var(--border);vertical-align:top}
.qnm .name-cell{font-weight:600;white-space:nowrap}
.qnm .comment-cell{min-width:220px;max-width:300px;color:var(--text-secondary)}
.qnm .badge{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;padding:3px 8px;border-radius:100px;white-space:nowrap}
.qnm .badge::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}
.qnm .badge.respondido{background:rgba(12,163,12,.15);color:var(--st-good-text)}
.qnm .badge.enviado{background:rgba(250,178,25,.2);color:var(--st-warning-text)}
.qnm .badge.nao_enviado{background:var(--surface-2);color:var(--text-muted)}
.qnm .envio-sub{display:block;font-size:11px;color:var(--text-muted);margin-top:3px;white-space:nowrap}
.qnm .warn-sub{display:block;font-size:11.5px;color:var(--danger);font-weight:600}
.qnm .chk{width:16px;height:16px;cursor:pointer;accent-color:var(--primary);margin:0}
.qnm .chk:disabled{cursor:not-allowed;opacity:.4}
.qnm .bulk-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 12px;border:1px solid var(--primary);background:var(--primary-soft);border-radius:10px;margin-bottom:10px;font-size:13px;font-weight:600}
.qnm .bulk-bar .sp{margin-right:auto}
.qnm .modal-bg{position:fixed;inset:0;background:rgba(15,25,45,.45);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px}
.qnm .modal{background:var(--surface);border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.25);width:min(980px,100%);max-height:calc(100vh - 32px);display:flex;flex-direction:column;overflow:hidden}
.qnm .modal-head{padding:16px 20px;border-bottom:1px solid var(--border)}
.qnm .modal-head h2{margin:0 0 2px;font-size:16px;font-weight:800}
.qnm .modal-tools{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:10px 20px;border-bottom:1px solid var(--border);background:var(--surface-2)}
.qnm .modal-tools input[type=text]{flex:1 1 220px;min-width:0}
.qnm .modal-body{overflow:auto;padding:4px 20px 14px}
.qnm .modal-foot{display:flex;gap:10px;align-items:center;justify-content:flex-end;padding:12px 20px;border-top:1px solid var(--border);background:var(--surface-2);flex-wrap:wrap}
.qnm .imp-emp{margin-top:14px}
.qnm .imp-emp h3{font-size:13px;font-weight:800;margin:0 0 6px}
.qnm .imp-row{display:grid;grid-template-columns:20px minmax(0,1.3fr) minmax(0,1fr) minmax(0,1fr);gap:10px;align-items:center;padding:6px 0;border-top:1px dashed var(--border);font-size:12.8px}
.qnm .imp-row.off{color:var(--text-muted)}
.qnm .imp-row input[type=text]{width:100%;padding:5px 8px;font-size:12.5px}
.qnm .imp-email{overflow-wrap:anywhere;font-weight:600}
.qnm .imp-origem{font-size:11px;color:var(--text-muted);overflow-wrap:anywhere}
@media (max-width:640px){.qnm .imp-row{grid-template-columns:20px 1fr}.qnm .imp-row > :nth-child(n+3){grid-column:2}}
.qnm .dash{color:var(--text-muted)}
.qnm .empty-row td{text-align:center;color:var(--text-muted);padding:26px 10px;font-size:13px}
.qnm .tbl-foot{font-size:12px;color:var(--text-muted);margin-top:8px}
.qnm .toggle-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 2px;border-top:1px solid var(--border)}
.qnm .toggle-row:first-child{border-top:none}
.qnm .toggle-row .lbl{font-size:13.5px;font-weight:600}
.qnm .toggle-row .lbl small{display:block;font-weight:400;color:var(--text-muted);font-size:11.5px;margin-top:1px}
.qnm .toggle-row-actions{display:flex;align-items:center;gap:10px}
.qnm .switch{position:relative;width:38px;height:22px;flex:none;display:inline-block}
.qnm .switch input{position:absolute;opacity:0;width:100%;height:100%;margin:0;cursor:pointer;z-index:1}
.qnm .switch .track{position:absolute;inset:0;background:var(--border);border-radius:100px;transition:background .15s ease}
.qnm .switch .thumb{position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.3);transition:transform .15s ease}
.qnm .switch input:checked + .track{background:var(--primary)}
.qnm .switch input:checked + .track .thumb{transform:translateX(16px)}
.qnm .steps{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
@media (max-width:700px){.qnm .steps{grid-template-columns:1fr}}
.qnm .step{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:13px 15px;display:flex;gap:11px;align-items:flex-start}
.qnm .step-num{font-weight:700;font-size:12px;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--primary);color:#fff;flex:none}
.qnm .step h3{font-size:13.5px;margin:0 0 2px;font-weight:700}
.qnm .step p{font-size:12px;color:var(--text-muted);margin:0;line-height:1.4}
.qnm .card-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap}
.qnm .card-head .actions{display:flex;gap:8px;flex-wrap:wrap}
.qnm .email-sub{display:block;font-size:11.5px;color:var(--text-muted);font-weight:400}
.qnm .token-btn{font-family:ui-monospace,monospace;font-size:11.5px;color:var(--primary);background:var(--surface-2);border:1px solid var(--border);border-radius:7px;padding:5px 9px;cursor:pointer;white-space:nowrap}
.qnm .token-btn:hover{border-color:var(--primary)}
.qnm .add-row-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;align-items:end;padding:14px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);margin-bottom:12px}
.qnm .add-row-form input,.qnm .add-row-form select{width:100%;background:var(--surface)}
.qnm .add-row-form .form-actions{display:flex;gap:8px;grid-column:1/-1;justify-content:flex-end;align-items:center}
.qnm .form-error{font-size:12.5px;font-weight:600;color:var(--danger);margin-right:auto}
.qnm .info-note{font-size:12.5px;color:var(--text-muted);background:var(--surface-2);border:1px dashed var(--border);border-radius:10px;padding:11px 13px;line-height:1.5}
.qnm .info-note b{color:var(--text)}
`

// ─── Helpers ─────────────────────────────────────────────────────────────────

type Tab = 'hub' | 'convites' | 'painel' | 'config'
type Draft = {
  id: string | null; type: TipoPergunta; label: string; min: string; max: string; options: string[]
  multiplas: boolean
  /** Pergunta condicional — id da pergunta-gatilho ('' = sempre aparece) e respostas que a liberam. */
  condPergunta: string; condValores: (string | number)[]
}

const blankDraft = (): Draft => ({ id: null, type: 'escala', label: '', min: 'Muito insatisfeito', max: 'Muito satisfeito', options: ['', ''], multiplas: false, condPergunta: '', condValores: [] })

/** Respostas que podem servir de gatilho de uma pergunta condicional. */
const valoresGatilho = (q: Pergunta): (string | number)[] => q.type === 'escala' ? [1, 2, 3, 4, 5] : q.type === 'multipla' ? (q.options ?? []) : []
const fmtResposta = (v: Convite['respostas'][string] | undefined) => valoresResposta(v).join(', ')
const novoIdPergunta = () => `q${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

function cfgFor(qn: Questionario): PainelConfig {
  const raw = qn.painel_config ?? {}
  const statTiles = { total: true, taxa: true, respondido: true, pendente: true, ...(raw.statTiles ?? {}) }
  const ids = qn.perguntas.filter(q => q.type !== 'texto').map(q => q.id).concat(['empresaStack', 'table'])
  const order = (raw.order ?? []).filter(id => ids.includes(id))
  ids.forEach(id => { if (!order.includes(id)) order.push(id) })
  const visible: Record<string, boolean> = {}
  ids.forEach(id => { visible[id] = raw.visible?.[id] !== false })
  return { statTiles, order, visible }
}

function toggle<T>(set: Set<T>, v: T): Set<T> {
  const n = new Set(set)
  if (n.has(v)) n.delete(v); else n.add(v)
  return n
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="track"><span className="thumb" /></span>
    </label>
  )
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Filtro de várias opções num menu suspenso com busca e caixas de marcar (escala para dezenas de empresas). */
function MultiFiltro({ opcoes, sel, onChange, todosLabel, plural }: {
  opcoes: string[]; sel: Set<string>; onChange: (s: Set<string>) => void; todosLabel: string; plural: string
}) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAberto(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false) }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc) }
  }, [aberto])

  const termo = semAcento(busca.trim())
  const visiveis = termo ? opcoes.filter(o => semAcento(o).includes(termo)) : opcoes
  const resumo = !sel.size ? todosLabel : sel.size === 1 ? [...sel][0] : `${sel.size} ${plural} selecionadas`
  const marcarVisiveis = () => { const n = new Set(sel); visiveis.forEach(o => n.add(o)); onChange(n) }

  return (
    <div className="msel" ref={ref}>
      <button type="button" className={`msel-btn${sel.size ? ' on' : ''}`} aria-haspopup="listbox" aria-expanded={aberto}
        disabled={!opcoes.length} onClick={() => { setAberto(a => !a); setBusca('') }}>
        <span className="msel-txt">{opcoes.length ? resumo : `Sem ${plural} ainda`}</span>
        <span className="msel-caret" aria-hidden>▾</span>
      </button>
      {aberto && (
        <div className="msel-pop">
          <input type="text" autoFocus value={busca} onChange={e => setBusca(e.target.value)} placeholder={`Buscar entre ${opcoes.length} ${plural}…`} />
          <div className="msel-tools">
            <button type="button" onClick={marcarVisiveis} disabled={!visiveis.length}>{termo ? `Marcar as ${visiveis.length} encontradas` : 'Marcar todas'}</button>
            <button type="button" onClick={() => onChange(new Set())} disabled={!sel.size}>Limpar</button>
          </div>
          <div className="msel-list" role="listbox" aria-multiselectable>
            {!visiveis.length && <p className="msel-vazio">Nada encontrado para “{busca}”.</p>}
            {visiveis.map(o => (
              <label key={o} className={`msel-opt${sel.has(o) ? ' on' : ''}`}>
                <input type="checkbox" className="chk" checked={sel.has(o)} onChange={() => onChange(toggle(sel, o))} />
                <span>{o}</span>
              </label>
            ))}
          </div>
          <div className="msel-foot">{sel.size ? `${sel.size} de ${opcoes.length} marcada${sel.size === 1 ? '' : 's'}` : `Nenhuma marcada = todas as ${plural}`}</div>
        </div>
      )}
    </div>
  )
}

function AnswersSummary({ q }: { q: Pergunta }) {
  if (q.type === 'escala') {
    return (
      <div className="answers-inline">
        {[1, 2, 3, 4, 5].map(n => <span key={n}>{n}</span>)}
        <span className="scale-desc">1 = {q.min || '—'} · 5 = {q.max || '—'}</span>
      </div>
    )
  }
  if (q.type === 'multipla') {
    return (
      <div className="answers-inline">
        {(q.options ?? []).map(o => <span key={o}>{o}</span>)}
        <span className="scale-desc">{q.multiplas ? 'Várias respostas' : 'Uma resposta'}</span>
      </div>
    )
  }
  return <div className="answers-inline"><span className="scale-desc">Texto livre, escrito pelo respondente</span></div>
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function QuestionariosClient() {
  const [qns, setQns] = useState<Questionario[]>([])
  const [convites, setConvites] = useState<Convite[]>([])
  const [contratantesBase, setContratantesBase] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const [tab, setTab] = useState<Tab>('hub')
  const [selQnId, setSelQnId] = useState<string>('')

  // Hub / editor
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [draftErr, setDraftErr] = useState('')
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [newTitulo, setNewTitulo] = useState('')
  const [newPublico, setNewPublico] = useState<Publico>('Contratante')
  const [tituloDraft, setTituloDraft] = useState('')

  // Convites
  const [addOpen, setAddOpen] = useState(false)
  const [na, setNa] = useState({ nome: '', email: '', empresa: '', tipo: 'Contratante' as Publico, vinculo: '' })
  const [naErr, setNaErr] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Exportar / marcar envio / incluir destinatários: só admin e gestor (o servidor valida de novo)
  const [podeGerir, setPodeGerir] = useState(false)
  const [selConv, setSelConv] = useState<Set<string>>(new Set())
  const [fEnvio, setFEnvio] = useState<'todos' | StatusExib>('todos')

  // Incluir do Cadastro de Contratantes
  const [impOpen, setImpOpen] = useState(false)
  const [impLoading, setImpLoading] = useState(false)
  const [impErr, setImpErr] = useState('')
  const [impLinhas, setImpLinhas] = useState<LinhaCadastro[]>([])
  const [impSemEmail, setImpSemEmail] = useState<{ contratanteId: string; empresa: string }[]>([])
  const [impSel, setImpSel] = useState<Set<string>>(new Set())
  const [impNomes, setImpNomes] = useState<Record<string, string>>({})
  const [impBusca, setImpBusca] = useState('')

  // Painel — filtros
  const [fContratante, setFContratante] = useState('all')
  const [fStatus, setFStatus] = useState<Set<StatusExib>>(new Set())
  const [fEmpresa, setFEmpresa] = useState<Set<string>>(new Set())
  const [stackOrdem, setStackOrdem] = useState<'nome' | 'menor' | 'maior'>('nome')
  const [stackTodas, setStackTodas] = useState(false)
  const [fSearch, setFSearch] = useState('')
  const [fQ, setFQ] = useState<Record<string, Set<string | number>>>({})

  // ── Load ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/questionarios').then(async r => r.ok ? r.json() : Promise.reject((await r.json().catch(() => ({}))).error ?? 'Erro ao carregar')),
      fetch('/api/terceiras/contratantes').then(r => r.ok ? r.json() : []).catch(() => []),
      fetch('/api/me').then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([d, cts, me]: [{ questionarios: Questionario[]; convites: Convite[] }, { nome: string }[], { papel?: string } | null]) => {
      if (cancelled) return
      setQns(d.questionarios)
      setConvites(d.convites)
      setContratantesBase((cts ?? []).map(c => c.nome))
      setPodeGerir(me?.papel === 'gestor' || me?.papel === 'admin')
    }).catch(e => {
      if (!cancelled) setLoadErr(String(e))
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])

  // Questionário selecionado em Convites/Painel/Personalizar (cai no primeiro se sumir)
  const selQn = qns.find(q => q.id === selQnId) ?? qns[0]
  const editing = editingId ? qns.find(q => q.id === editingId) ?? null : null

  const convitesDe = (qnId: string) => convites.filter(c => c.questionario_id === qnId)

  const contratantesList = useMemo(() => {
    const set = new Set(contratantesBase)
    convites.forEach(c => { if (c.tipo === 'Contratante') set.add(c.empresa); if (c.vinculo) set.add(c.vinculo) })
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [contratantesBase, convites])

  // ── Mutations ──────────────────────────────────────────────────────────────

  async function patchQn(id: string, patch: Partial<Questionario>) {
    setQns(prev => prev.map(q => q.id === id ? { ...q, ...patch } : q))
    const res = await fetch(`/api/questionarios/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    })
    if (!res.ok) { setToast('Erro ao salvar'); return }
    const updated: Questionario = await res.json()
    setQns(prev => prev.map(q => q.id === id ? updated : q))
  }

  function selectQn(id: string) {
    setSelQnId(id)
    setFContratante('all'); setFStatus(new Set()); setFEmpresa(new Set()); setFSearch(''); setFQ({})
    setAddOpen(false); setSelConv(new Set()); setFEnvio('todos')
  }

  function irPara(t: Tab, qnId?: string) {
    if (qnId) selectQn(qnId)
    setTab(t)
  }

  async function criarQn() {
    const titulo = newTitulo.trim()
    if (!titulo) return
    setBusy(true)
    try {
      const res = await fetch('/api/questionarios', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titulo, publico: newPublico }),
      })
      if (!res.ok) { setToast((await res.json().catch(() => ({}))).error ?? 'Erro ao criar'); return }
      const qn: Questionario = await res.json()
      setQns(prev => [qn, ...prev])
      setNewOpen(false); setNewTitulo('')
      abrirEditor(qn, true)
    } finally { setBusy(false) }
  }

  async function excluirQn(qn: Questionario) {
    const n = convitesDe(qn.id).length
    if (!confirm(`Excluir o questionário "${qn.titulo}"?${n ? `\n\nOs ${n} convite(s) e respostas dele também serão excluídos.` : ''}`)) return
    const res = await fetch(`/api/questionarios/${qn.id}`, { method: 'DELETE' })
    if (!res.ok) { setToast('Erro ao excluir'); return }
    setQns(prev => prev.filter(q => q.id !== qn.id))
    setConvites(prev => prev.filter(c => c.questionario_id !== qn.id))
    setEditingId(null); setDraft(null)
    setToast('Questionário excluído')
  }

  function abrirEditor(qn: Questionario, comDraft = false) {
    setEditingId(qn.id)
    setTituloDraft(qn.titulo)
    setDraft(comDraft ? blankDraft() : null)
    setDraftErr(''); setConfirmDel(null)
  }

  function salvarPergunta() {
    if (!editing || !draft) return
    const label = draft.label.trim()
    if (!label) { setDraftErr('Escreva o texto da pergunta.'); return }
    const q: Pergunta = { id: draft.id ?? novoIdPergunta(), type: draft.type, label }
    if (draft.type === 'escala') { q.min = draft.min.trim(); q.max = draft.max.trim() }
    if (draft.type === 'multipla') {
      const opts = draft.options.map(o => o.trim()).filter(Boolean)
      if (opts.length < 2) { setDraftErr('Defina pelo menos duas respostas possíveis.'); return }
      if (new Set(opts).size !== opts.length) { setDraftErr('As respostas possíveis precisam ser diferentes entre si.'); return }
      q.options = opts
      if (draft.multiplas) q.multiplas = true
    }
    if (draft.condPergunta) {
      const gatilho = editing.perguntas.find(x => x.id === draft.condPergunta)
      const valores = gatilho ? draft.condValores.filter(v => valoresGatilho(gatilho).includes(v)) : []
      if (!valores.length) { setDraftErr('Escolha ao menos uma resposta que faz esta pergunta aparecer.'); return }
      q.condicao = { perguntaId: draft.condPergunta, valores }
    }
    const perguntas = draft.id
      ? editing.perguntas.map(x => x.id === draft.id ? q : x)
      : [...editing.perguntas, q]
    void patchQn(editing.id, { perguntas })
    setDraft(null); setDraftErr('')
  }

  function moverPergunta(i: number, dir: -1 | 1) {
    if (!editing) return
    const p = [...editing.perguntas]
    const j = i + dir
    ;[p[i], p[j]] = [p[j], p[i]]
    // A condicional precisa vir depois da pergunta que a libera.
    const quebra = p.some((q, k) => q.condicao && p.findIndex(x => x.id === q.condicao!.perguntaId) > k)
    if (quebra) { alert('Uma pergunta condicional precisa ficar abaixo da pergunta que a faz aparecer.'); return }
    void patchQn(editing.id, { perguntas: p })
  }

  function removerPergunta(q: Pergunta) {
    if (!editing) return
    if (confirmDel !== q.id) { setConfirmDel(q.id); return }
    const dependentes = editing.perguntas.filter(x => x.condicao?.perguntaId === q.id)
    if (dependentes.length && !confirm(`${dependentes.length} pergunta(s) só aparecem conforme a resposta desta. Ao remover, elas passam a aparecer sempre. Continuar?`)) { setConfirmDel(null); return }
    void patchQn(editing.id, {
      perguntas: editing.perguntas.filter(x => x.id !== q.id).map(x => {
        if (x.condicao?.perguntaId !== q.id) return x
        const resto = { ...x }
        delete resto.condicao
        return resto
      }),
    })
    setConfirmDel(null)
  }

  async function addDestinatario() {
    if (!selQn) return
    setNaErr('')
    if (!na.nome.trim() || !na.empresa.trim()) { setNaErr('Preencha nome e empresa.'); return }
    if (na.email.trim() && !na.email.includes('@')) { setNaErr('O e-mail parece incompleto.'); return }
    setBusy(true)
    try {
      const res = await fetch(`/api/questionarios/${selQn.id}/convites`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...na, vinculo: na.tipo === 'Prestador' ? (na.vinculo || contratantesList[0] || '') : '' }),
      })
      if (!res.ok) { setNaErr((await res.json().catch(() => ({}))).error ?? 'Erro ao adicionar'); return }
      const c: Convite = await res.json()
      setConvites(prev => [...prev, c])
      setAddOpen(false)
      setToast('Destinatário adicionado')
    } finally { setBusy(false) }
  }

  async function removerDestinatario(c: Convite) {
    if (!confirm(`Remover ${c.nome} (${c.empresa}) dos destinatários?${c.status === 'respondido' ? '\n\nA resposta dele também será excluída.' : ''}`)) return
    const res = await fetch(`/api/questionarios/convites/${c.id}`, { method: 'DELETE' })
    if (!res.ok) { setToast('Erro ao remover'); return }
    setConvites(prev => prev.filter(x => x.id !== c.id))
  }

  async function gerarLinks() {
    if (!selQn) return
    setBusy(true)
    try {
      const res = await fetch(`/api/questionarios/${selQn.id}/gerar-links`, { method: 'POST' })
      if (!res.ok) { setToast((await res.json().catch(() => ({}))).error ?? 'Erro ao gerar links'); return }
      const lista: Convite[] = await res.json()
      setConvites(prev => [...prev.filter(c => c.questionario_id !== selQn.id), ...lista])
      setToast('Links gerados')
    } finally { setBusy(false) }
  }

  // Sempre o endereço de produção (NEXT_PUBLIC_SITE_URL), nunca o do navegador — o link exportado
  // para a mala direta não pode sair com localhost.
  const linkDe = linkConvite

  /** Troca os convites deste questionário pela lista que a API devolveu. */
  function aplicarConvites(qnId: string, lista: Convite[]) {
    setConvites(prev => [...prev.filter(c => c.questionario_id !== qnId), ...lista])
  }

  async function registrarEnvio(acao: 'marcar' | 'desfazer' | 'lembrete', ids: string[]): Promise<boolean> {
    if (!selQn || !ids.length) return false
    const res = await fetch(`/api/questionarios/${selQn.id}/envio`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao, ids }),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setToast(d.error ?? 'Erro ao registrar'); return false }
    aplicarConvites(selQn.id, d.convites ?? [])
    setSelConv(new Set())
    const verbo = acao === 'marcar' ? 'marcado(s) como enviado(s)' : acao === 'desfazer' ? 'voltaram para Não enviado' : 'com lembrete registrado'
    setToast(`${d.alterados} ${verbo}${d.ignorados ? ` · ${d.ignorados} ignorado(s)` : ''}`)
    return true
  }

  /** Planilha da mala direta: aba 1 com Nome | PrimeiroNome | Empresa | Email | Link (exatamente
   *  esses cabeçalhos — são os campos de mesclagem do Word) e aba "Sem e-mail" para corrigir o cadastro. */
  async function baixarPlanilha(nomeArquivo: string, linhas: { nome: string; empresa: string; email: string; token: string }[], semEmail: { nome: string; empresa: string }[]) {
    const { Workbook } = await import('exceljs')
    const wb = new Workbook()
    const ws = wb.addWorksheet('Mala direta')
    ws.columns = [
      { header: 'Nome', key: 'nome', width: 30 },
      { header: 'PrimeiroNome', key: 'primeiro', width: 16 },
      { header: 'Empresa', key: 'empresa', width: 34 },
      { header: 'Email', key: 'email', width: 36 },
      { header: 'Link', key: 'link', width: 100 },
    ]
    linhas.forEach(l => ws.addRow({ nome: l.nome, primeiro: primeiroNome(l.nome), empresa: l.empresa, email: l.email, link: linkDe(l.token) }))
    ws.getRow(1).font = { bold: true }
    const ws2 = wb.addWorksheet('Sem e-mail')
    ws2.columns = [{ header: 'Nome', key: 'nome', width: 30 }, { header: 'Empresa', key: 'empresa', width: 40 }]
    semEmail.forEach(l => ws2.addRow(l))
    ws2.getRow(1).font = { bold: true }
    const buf = await wb.xlsx.writeBuffer()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
    a.download = nomeArquivo
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  async function exportarMalaDireta(tipo: 'convites' | 'lembretes') {
    if (!selQn) return
    setBusy(true)
    try {
      const res = await fetch(`/api/questionarios/${selQn.id}/exportar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setToast(d.error ?? 'Erro ao exportar'); return }
      aplicarConvites(selQn.id, d.convites ?? [])
      const linhas = (d.linhas ?? []) as { id: string; nome: string; empresa: string; email: string; token: string }[]
      const semEmail = (d.semEmail ?? []) as { nome: string; empresa: string }[]
      if (!linhas.length && !semEmail.length) {
        setToast(tipo === 'convites' ? 'Nenhum destinatário "Não enviado" para exportar' : 'Ninguém aguardando resposta para lembrar')
        return
      }
      const slug = selQn.titulo.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '')
      const hoje = new Date().toISOString().slice(0, 10)
      await baixarPlanilha(`${tipo === 'convites' ? 'Convites' : 'Lembretes'}_${slug}_${hoje}.xlsx`, linhas, semEmail)
      if (!linhas.length) { setToast(`Só a aba "Sem e-mail" (${semEmail.length}) — ninguém com e-mail para enviar`); return }
      const pergunta = tipo === 'convites'
        ? `Marcar estes ${linhas.length} destinatários como enviados manualmente?`
        : `Registrar lembrete enviado para estes ${linhas.length} destinatários?`
      if (confirm(pergunta)) await registrarEnvio(tipo === 'convites' ? 'marcar' : 'lembrete', linhas.map(l => l.id))
      else setToast('Arquivo baixado — nada foi marcado')
    } finally { setBusy(false) }
  }

  async function abrirImportacao() {
    if (!selQn) return
    setImpOpen(true); setImpLoading(true); setImpErr(''); setImpBusca(''); setImpSel(new Set())
    try {
      const res = await fetch(`/api/questionarios/${selQn.id}/cadastro`)
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setImpErr(d.error ?? 'Erro ao ler o cadastro'); return }
      const linhas = (d.linhas ?? []) as LinhaCadastro[]
      setImpLinhas(linhas)
      setImpSemEmail(d.semEmail ?? [])
      setImpNomes(Object.fromEntries(linhas.map(l => [l.contratanteId + '|' + l.email, l.nome])))
    } finally { setImpLoading(false) }
  }

  async function confirmarImportacao() {
    if (!selQn || !impSel.size) return
    setBusy(true)
    try {
      const itens = impLinhas
        .filter(l => impSel.has(l.contratanteId + '|' + l.email))
        .map(l => ({ empresa: l.empresa, email: l.email, nome: impNomes[l.contratanteId + '|' + l.email] ?? '' }))
      const res = await fetch(`/api/questionarios/${selQn.id}/cadastro`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itens }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setImpErr(d.error ?? 'Erro ao incluir'); return }
      aplicarConvites(selQn.id, d.convites ?? [])
      setImpOpen(false)
      setToast(`${d.incluidos} incluído(s)${d.duplicados ? ` · ${d.duplicados} já era(m) destinatário(s)` : ''}`)
    } finally { setBusy(false) }
  }

  async function copiarLink(c: Convite) {
    if (!c.token) return
    try {
      await navigator.clipboard.writeText(linkDe(c.token))
      setCopiedId(c.id)
      setTimeout(() => setCopiedId(id => id === c.id ? null : id), 1300)
    } catch {
      prompt('Copie o link:', linkDe(c.token))
    }
  }

  function salvarCfg(qn: Questionario, cfg: PainelConfig) {
    void patchQn(qn.id, { painel_config: cfg })
  }

  // ── Render: estados globais ────────────────────────────────────────────────

  const header = (
    <div>
      <div className="eyebrow">GT3 Consultoria</div>
      <h1>Questionários e respostas</h1>
      <p className="sub">Monte os questionários de contratantes e prestadores, envie um link único para cada responsável e acompanhe as respostas, já vinculadas ao cadastro, no painel.</p>
    </div>
  )

  if (loading) return <div className="qnm"><style>{CSS}</style>{header}<div className="card">Carregando…</div></div>
  if (loadErr) {
    return (
      <div className="qnm"><style>{CSS}</style>{header}
        <div className="card" style={{ color: 'var(--danger)' }}>
          Erro ao carregar: <b>{loadErr}</b>
          <p className="cap" style={{ marginTop: 8 }}>Confira se a migração <code>sql/questionarios.sql</code> foi executada no Supabase.</p>
        </div>
      </div>
    )
  }

  const tabs = (
    <div className="tabs" role="tablist">
      {([['hub', 'Questionários'], ['convites', 'Convites'], ['painel', 'Painel de respostas'], ['config', 'Personalizar painel']] as [Tab, string][]).map(([k, l]) => (
        <button key={k} role="tab" aria-selected={tab === k} className={`tab${tab === k ? ' on' : ''}`} onClick={() => { setTab(k); if (k === 'hub') { setEditingId(null); setDraft(null) } }}>{l}</button>
      ))}
    </div>
  )

  const qnSelect = (label: string) => (
    <div className="qn-select-bar">
      <span className="field-label">{label}</span>
      <select value={selQn?.id ?? ''} onChange={e => selectQn(e.target.value)}>
        {qns.map(q => <option key={q.id} value={q.id}>{q.titulo}</option>)}
      </select>
      {selQn && (
        <span style={{ display: 'flex', gap: 6 }}>
          <span className={`status-tag ${selQn.status}`}>{STATUS_QN_NAME[selQn.status]}</span>
          <span className="pill-tag">Público: {selQn.publico}</span>
        </span>
      )}
    </div>
  )

  const semQn = (
    <div className="card">
      <h2>Nenhum questionário ainda</h2>
      <p className="cap" style={{ margin: 0 }}>Crie o primeiro na aba <button className="link-btn" onClick={() => setTab('hub')}>Questionários</button>.</p>
    </div>
  )

  // ── HUB ────────────────────────────────────────────────────────────────────

  function renderHub() {
    return (
      <div className="hub-grid">
        {qns.map(qn => {
          const rows = convitesDe(qn.id)
          const resp = rows.filter(d => d.status === 'respondido').length
          const pct = rows.length ? Math.round(resp / rows.length * 100) : 0
          return (
            <div key={qn.id} className="qn-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <h3>{qn.titulo}</h3>
                <span className={`status-tag ${qn.status}`}>{STATUS_QN_NAME[qn.status]}</span>
              </div>
              <div><span className="pill-tag">Público: {qn.publico}</span></div>
              <div className="qn-numbers">
                <div><b>{qn.perguntas.length}</b><span>pergunta{qn.perguntas.length === 1 ? '' : 's'}</span></div>
                <div><b>{rows.length}</b><span>convites</span></div>
                <div><b>{resp}</b><span>respostas</span></div>
              </div>
              <div className="qn-progress" title={`${pct}% de resposta`}><i style={{ width: `${pct}%` }} /></div>
              <div className="qn-actions">
                <button className="btn" onClick={() => abrirEditor(qn)}>Abrir</button>
                <button className="btn ghost" onClick={() => irPara('convites', qn.id)}>Convites</button>
                <button className="btn ghost" onClick={() => irPara('painel', qn.id)}>Respostas</button>
                <button className="btn danger" title="Excluir questionário" aria-label={`Excluir questionário ${qn.titulo}`}
                  onClick={() => void excluirQn(qn)}>Excluir</button>
              </div>
            </div>
          )
        })}
        <div className="qn-card qn-new">
          {!newOpen ? (
            <button className="qn-new-btn" onClick={() => setNewOpen(true)}><span className="plus-circle">+</span>Novo questionário</button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h3 style={{ fontSize: 15 }}>Novo questionário</h3>
              <div className="row">
                <span className="field-label">Nome</span>
                <input type="text" autoFocus value={newTitulo} onChange={e => setNewTitulo(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') void criarQn() }} placeholder="Ex: Questionário Contratantes 2027" />
              </div>
              <div className="row">
                <span className="field-label">Público</span>
                <select value={newPublico} onChange={e => setNewPublico(e.target.value as Publico)}>
                  <option>Contratante</option><option>Prestador</option>
                </select>
              </div>
              <div className="qn-actions">
                <button className="btn ghost" onClick={() => { setNewOpen(false); setNewTitulo('') }}>Cancelar</button>
                <button className="btn" disabled={busy || !newTitulo.trim()} onClick={() => void criarQn()}>Criar e abrir</button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── EDITOR ─────────────────────────────────────────────────────────────────

  function renderComposer(d: Draft, index: number, anteriores: Pergunta[]) {
    const upd = (p: Partial<Draft>) => setDraft({ ...d, ...p })
    const gatilhos = anteriores.filter(q => q.type !== 'texto')
    const gatilho = gatilhos.find(q => q.id === d.condPergunta)
    return (
      <div className="composer" key="composer">
        <div className="composer-head">{d.id ? `Editando pergunta #${index + 1}` : `Nova pergunta #${index + 1}`}</div>
        <div className="composer-sec">
          <div className="sec-title"><span className="n">1</span><h4>Tipo de pergunta</h4></div>
          <div className="type-cards">
            {(['escala', 'multipla', 'texto'] as TipoPergunta[]).map(t => (
              <button key={t} className={`type-card${d.type === t ? ' on' : ''}`} aria-pressed={d.type === t}
                onClick={() => upd({ type: t, options: t === 'multipla' && d.options.length < 2 ? ['', ''] : d.options })}>
                <b>{TYPE_NAME[t]}</b><span>{TYPE_DESC[t]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="composer-sec">
          <div className="sec-title"><span className="n">2</span><h4>Pergunta</h4><small>o que o respondente vai ler</small></div>
          <textarea rows={2} autoFocus value={d.label} onChange={e => upd({ label: e.target.value })} placeholder="Ex: Como você avalia o atendimento da GT3?" />
        </div>
        <div className="composer-sec">
          <div className="sec-title">
            <span className="n">3</span><h4>Respostas possíveis</h4>
            <small>{d.type === 'escala' ? 'escala fixa de 1 a 5' : d.type === 'multipla' ? 'as opções que o respondente pode escolher' : ''}</small>
          </div>
          {d.type === 'escala' && (
            <>
              <div className="scale-row">{[1, 2, 3, 4, 5].map(n => <span key={n}>{n}</span>)}</div>
              <div className="scale-labels">
                <div className="row"><span className="field-label">O que significa 1</span><input type="text" value={d.min} onChange={e => upd({ min: e.target.value })} /></div>
                <div className="row"><span className="field-label">O que significa 5</span><input type="text" value={d.max} onChange={e => upd({ max: e.target.value })} /></div>
              </div>
            </>
          )}
          {d.type === 'multipla' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {d.options.map((o, i) => (
                  <div key={i} className="opt-row">
                    <span className="dot" />
                    <input type="text" value={o} placeholder={`Resposta ${i + 1}`}
                      onChange={e => upd({ options: d.options.map((x, j) => j === i ? e.target.value : x) })} />
                    <button className="icon-btn danger" aria-label="Remover resposta" disabled={d.options.length <= 2}
                      onClick={() => upd({ options: d.options.filter((_, j) => j !== i) })}>✕</button>
                  </div>
                ))}
              </div>
              <button className="btn ghost small" style={{ alignSelf: 'flex-start' }} onClick={() => upd({ options: [...d.options, ''] })}>+ Adicionar resposta</button>
              <div className="row" style={{ marginTop: 4 }}>
                <span className="field-label">Quantas respostas o respondente marca</span>
                <div className="seg">
                  <button className={!d.multiplas ? 'on' : ''} onClick={() => upd({ multiplas: false })}>Apenas uma (obrigatória)</button>
                  <button className={d.multiplas ? 'on' : ''} onClick={() => upd({ multiplas: true })}>Múltiplas (ao menos uma)</button>
                </div>
              </div>
            </>
          )}
          {d.type === 'texto' && <div className="text-answer-demo">O respondente terá um campo livre para escrever. Não há respostas pré-definidas.</div>}
        </div>
        <div className="composer-sec">
          <div className="sec-title"><span className="n">4</span><h4>Quando aparece</h4><small>opcional — pergunta que só entra depois de outra resposta</small></div>
          {!gatilhos.length ? (
            <div className="text-answer-demo">Sempre aparece. Para condicionar, crie antes (acima desta) uma pergunta de nota ou de múltipla escolha.</div>
          ) : (
            <>
              <select value={d.condPergunta} onChange={e => upd({ condPergunta: e.target.value, condValores: [] })} style={{ maxWidth: '100%' }}>
                <option value="">Sempre aparece</option>
                {gatilhos.map(q => <option key={q.id} value={q.id}>Só se a #{anteriores.indexOf(q) + 1} ({q.label.slice(0, 60)}{q.label.length > 60 ? '…' : ''}) for respondida com…</option>)}
              </select>
              {gatilho && (
                <div className="chipset">
                  {valoresGatilho(gatilho).map(v => (
                    <button key={String(v)} className={`chip${d.condValores.includes(v) ? ' on' : ''}`}
                      onClick={() => upd({ condValores: d.condValores.includes(v) ? d.condValores.filter(x => x !== v) : [...d.condValores, v] })}>
                      {gatilho.type === 'escala' ? `Nota ${v}` : v}
                    </button>
                  ))}
                </div>
              )}
              {gatilho && <p className="f-hint">Marque uma ou mais respostas. Se nenhuma delas for escolhida, esta pergunta fica oculta e não é exigida.</p>}
            </>
          )}
        </div>
        <div className="composer-foot">
          <span className="composer-error">{draftErr}</span>
          <button className="btn ghost" onClick={() => { setDraft(null); setDraftErr('') }}>Cancelar</button>
          <button className="btn" onClick={salvarPergunta}>Salvar pergunta</button>
        </div>
      </div>
    )
  }

  function renderPreview(qn: Questionario) {
    let items: (Pergunta & { _draft?: boolean })[] = qn.perguntas
    if (draft) {
      const dq = {
        id: draft.id ?? '__novo', type: draft.type, label: draft.label, min: draft.min, max: draft.max, options: draft.options, multiplas: draft.multiplas, _draft: true,
        condicao: draft.condPergunta ? { perguntaId: draft.condPergunta, valores: draft.condValores } : undefined,
      }
      items = draft.id ? items.map(q => q.id === draft.id ? dq : q) : [...items, dq]
    }
    return (
      <div className="preview-shell">
        <div className="preview-top"><small>GT3 Consultoria</small><b>{tituloDraft || 'Sem nome'}</b></div>
        <div className="preview-body">
          {!items.length && <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }}>Adicione a primeira pergunta para ver a prévia.</p>}
          {items.map((q, i) => (
            <div key={q.id} className={`pv-q${q._draft ? ' draft' : ''}`}>
              {q.condicao && (
                <span className="pv-cond">
                  ↳ Aparece só se a #{items.findIndex(x => x.id === q.condicao!.perguntaId) + 1} for {q.condicao.valores.length ? q.condicao.valores.join(' / ') : '…'}
                </span>
              )}
              <div className="pv-label">{i + 1}. {q.label || <i style={{ fontStyle: 'normal', color: 'var(--text-muted)', fontWeight: 500 }}>Texto da pergunta…</i>}</div>
              <span className={`pv-regra${q.type === 'texto' ? ' opc' : ''}`}>
                {q.type === 'escala' ? '● Escolha uma nota · obrigatória'
                  : q.type === 'texto' ? 'Resposta opcional'
                  : q.multiplas ? '☑ Pode marcar mais de uma opção · ao menos uma obrigatória'
                  : '● Escolha apenas uma opção · obrigatória'}
              </span>
              {q.type === 'escala' && (
                <>
                  <div className="pv-scale">{[1, 2, 3, 4, 5].map(n => <span key={n}>{n}</span>)}</div>
                  <div className="pv-ends">{q.min && <span>1 = {q.min}</span>}{q.max && <span>5 = {q.max}</span>}</div>
                </>
              )}
              {q.type === 'multipla' && (() => {
                const opts = (q.options ?? []).filter(o => o.trim())
                return <div className={`pv-choice${q.multiplas ? ' multi' : ''}`}>{(opts.length ? opts : ['Resposta 1', 'Resposta 2']).map((o, j) => <span key={j}>{o}</span>)}</div>
              })()}
              {q.type === 'texto' && <div className="pv-text">Escreva sua resposta…</div>}
            </div>
          ))}
        </div>
      </div>
    )
  }

  function renderEditor(qn: Questionario) {
    const nConv = convitesDe(qn.id).length
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div><button className="link-btn" onClick={() => { setEditingId(null); setDraft(null) }}>← Todos os questionários</button></div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="row">
            <span className="field-label">Nome do questionário</span>
            <input type="text" value={tituloDraft} style={{ fontSize: 20, fontWeight: 800, width: '100%' }}
              onChange={e => setTituloDraft(e.target.value)}
              onBlur={() => { const t = tituloDraft.trim(); if (t && t !== qn.titulo) void patchQn(qn.id, { titulo: t }); else setTituloDraft(qn.titulo) }}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="row">
              <span className="field-label">Público</span>
              <select value={qn.publico} onChange={e => void patchQn(qn.id, { publico: e.target.value as Publico })}>
                <option>Contratante</option><option>Prestador</option>
              </select>
            </div>
            <div className="row">
              <span className="field-label">Situação</span>
              <select value={qn.status} onChange={e => void patchQn(qn.id, { status: e.target.value as StatusQn })}>
                {(['rascunho', 'ativo', 'encerrado'] as StatusQn[]).map(s => <option key={s} value={s}>{STATUS_QN_NAME[s]}</option>)}
              </select>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn ghost small" onClick={() => irPara('convites', qn.id)}>Convites</button>
              <button className="btn ghost small" onClick={() => irPara('painel', qn.id)}>Ver respostas</button>
              <button className="btn danger small" onClick={() => void excluirQn(qn)}>Excluir questionário</button>
            </div>
          </div>
          {nConv > 0 && qn.status === 'ativo' && (
            <p className="f-hint">Este questionário já tem {nConv} convite(s). Alterar ou remover perguntas afeta quem ainda não respondeu; respostas já registradas continuam guardadas.</p>
          )}
        </div>
        <div className="editor-grid">
          <div className="card">
            <h2>Perguntas</h2>
            <p className="cap">Cada pergunta tem duas partes: o texto da <b>pergunta</b> e as <b>respostas possíveis</b>. Use o <b>+</b> para criar uma nova.</p>
            <div className="qlist">
              {!qn.perguntas.length && !draft && <p className="cap" style={{ margin: 0 }}>Este questionário ainda não tem perguntas.</p>}
              {qn.perguntas.map((q, i) => {
                if (draft && draft.id === q.id) return renderComposer(draft, i, qn.perguntas.slice(0, i))
                const confirming = confirmDel === q.id
                return (
                  <div key={q.id} className="qitem">
                    <div className="qitem-head">
                      <span className="qnum">#{i + 1}</span>
                      <span className="qtype">{TYPE_NAME[q.type]}</span>
                      {q.condicao && (
                        <span className="qcond" title="Só aparece conforme a resposta de outra pergunta">
                          ↳ se #{qn.perguntas.findIndex(x => x.id === q.condicao!.perguntaId) + 1} = {q.condicao.valores.join(' / ')}
                        </span>
                      )}
                      <div className="qitem-tools">
                        <button className="icon-btn" aria-label="Mover para cima" disabled={i === 0} onClick={() => moverPergunta(i, -1)}>▲</button>
                        <button className="icon-btn" aria-label="Mover para baixo" disabled={i === qn.perguntas.length - 1} onClick={() => moverPergunta(i, 1)}>▼</button>
                        <button className="icon-btn" onClick={() => {
                          setDraft({
                            id: q.id, type: q.type, label: q.label,
                            min: q.min ?? 'Muito insatisfeito', max: q.max ?? 'Muito satisfeito',
                            options: q.options && q.options.length >= 2 ? [...q.options] : [...(q.options ?? []), '', ''].slice(0, 2),
                            multiplas: !!q.multiplas,
                            condPergunta: q.condicao?.perguntaId ?? '', condValores: [...(q.condicao?.valores ?? [])],
                          })
                          setDraftErr(''); setConfirmDel(null)
                        }}>Editar</button>
                        <button className={`icon-btn danger${confirming ? ' confirm' : ''}`} onClick={() => removerPergunta(q)}>
                          {confirming ? 'Confirmar remoção' : 'Remover'}
                        </button>
                      </div>
                    </div>
                    <div className="qitem-body">
                      <div className="k">Pergunta</div><div className="v">{q.label}</div>
                      <div className="k">Respostas possíveis</div><div><AnswersSummary q={q} /></div>
                    </div>
                  </div>
                )
              })}
              {draft && !draft.id && renderComposer(draft, qn.perguntas.length, qn.perguntas)}
              {!draft && (
                <button className="add-q" onClick={() => { setDraft(blankDraft()); setDraftErr(''); setConfirmDel(null) }}>
                  <span className="plus-circle">+</span>Nova pergunta
                </button>
              )}
            </div>
          </div>
          <div className="card" style={{ position: 'sticky', top: 16 }}>
            <h2>Como o respondente verá</h2>
            <p className="cap">Pré-visualização atualizada enquanto você edita.</p>
            {renderPreview(qn)}
          </div>
        </div>
      </div>
    )
  }

  // ── CONVITES ───────────────────────────────────────────────────────────────

  function renderConvites(qn: Questionario) {
    const rows = convitesDe(qn.id)
    const c: Record<StatusExib, number> = { nao_enviado: 0, enviado: 0, respondido: 0 }
    rows.forEach(d => { c[statusExib(d)]++ })
    const semLink = rows.filter(d => d.status === 'pendente').length
    // % de resposta sobre quem recebeu: respondidos ÷ (enviados manualmente + respondidos)
    const base = c.enviado + c.respondido
    const pctResp = base ? Math.round(c.respondido / base * 100) : 0
    const visiveis = fEnvio === 'todos' ? rows : rows.filter(d => statusExib(d) === fEnvio)
    const selecionaveis = visiveis.filter(d => d.status !== 'respondido')
    const todosSel = selecionaveis.length > 0 && selecionaveis.every(d => selConv.has(d.id))
    const selIds = [...selConv].filter(id => rows.some(d => d.id === id))
    const selNaoEnv = rows.filter(d => selConv.has(d.id) && statusExib(d) === 'nao_enviado').map(d => d.id)
    const selEnv = rows.filter(d => selConv.has(d.id) && statusExib(d) === 'enviado').map(d => d.id)
    const hint = qn.status === 'rascunho'
      ? 'Este questionário está em rascunho. Mude a situação para Ativo (no editor) para exportar e gerar os links.'
      : qn.status === 'encerrado'
        ? 'Este questionário está encerrado e não aceita novas respostas.'
        : 'O sistema não envia e-mails nem sabe se o e-mail chegou ou foi lido: "Enviado manualmente" é só o registro que você confirma depois da mala direta. "Respondido" vem do próprio link.'
    const filtros: ['todos' | StatusExib, string, number][] = [
      ['todos', 'Todos', rows.length], ['nao_enviado', 'Não enviado', c.nao_enviado], ['enviado', 'Enviado manualmente', c.enviado], ['respondido', 'Respondido', c.respondido],
    ]
    return (
      <>
        {qnSelect('Questionário')}
        <div className="steps">
          <div className="step"><div className="step-num">1</div><div><h3>Destinatários</h3><p>Inclua do Cadastro de Contratantes (um convite por e-mail) ou adicione um a um.</p></div></div>
          <div className="step"><div className="step-num">2</div><div><h3>Mala direta</h3><p>Exporte a planilha, faça a mala direta no Word/Outlook e confirme a marcação de enviados.</p></div></div>
          <div className="step"><div className="step-num">3</div><div><h3>Acompanhar</h3><p>O status vira Respondido assim que o formulário é enviado pelo link. Para quem não respondeu, exporte os lembretes.</p></div></div>
        </div>
        <div className="stats">
          <div className="stat"><div className="n">{rows.length}</div><div className="l">Total de destinatários</div></div>
          <div className="stat"><div className="n">{c.nao_enviado}</div><div className="l">Não enviados</div></div>
          <div className="stat"><div className="n warning">{c.enviado}</div><div className="l">Enviados manualmente (aguardando resposta)</div></div>
          <div className="stat"><div className="n good">{c.respondido}</div><div className="l">Respondidos</div></div>
          <div className="stat"><div className="n good">{pctResp}%</div><div className="l">De resposta sobre os enviados</div></div>
        </div>
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Destinatários do questionário</h2>
              <p className="cap" style={{ margin: 0 }}>{rows.length} destinatário{rows.length === 1 ? '' : 's'}{semLink ? ` · ${semLink} ainda sem link` : ''}</p>
            </div>
            <div className="actions">
              {podeGerir && <button className="btn ghost" disabled={busy} onClick={() => void abrirImportacao()}>Incluir do Cadastro de Contratantes</button>}
              {podeGerir && (
                <button className="btn ghost" onClick={() => {
                  setAddOpen(o => !o); setNaErr('')
                  setNa({ nome: '', email: '', empresa: '', tipo: qn.publico, vinculo: contratantesList[0] ?? '' })
                }}>+ Adicionar destinatário</button>
              )}
              <button className="btn ghost" disabled={busy || qn.status !== 'ativo' || !semLink} onClick={() => void gerarLinks()}>
                {semLink ? `Gerar links (${semLink})` : 'Gerar links'}
              </button>
              {podeGerir && <button className="btn" disabled={busy} onClick={() => void exportarMalaDireta('convites')}>Exportar convites (mala direta)</button>}
              {podeGerir && <button className="btn" disabled={busy} onClick={() => void exportarMalaDireta('lembretes')}>Exportar lembretes (mala direta)</button>}
            </div>
          </div>
          {addOpen && podeGerir && (
            <div className="add-row-form">
              <div className="row"><span className="field-label">Nome do responsável</span><input type="text" autoFocus value={na.nome} onChange={e => setNa({ ...na, nome: e.target.value })} placeholder="Ex: Mariana Alves" /></div>
              <div className="row"><span className="field-label">E-mail</span><input type="text" value={na.email} onChange={e => setNa({ ...na, email: e.target.value })} placeholder="nome@empresa.com.br" /></div>
              <div className="row"><span className="field-label">Empresa</span><input type="text" value={na.empresa} onChange={e => setNa({ ...na, empresa: e.target.value })} placeholder={na.tipo === 'Prestador' ? 'Ex: Segflex Terceirizada' : 'Ex: Marcopolo S.A.'} /></div>
              <div className="row">
                <span className="field-label">Tipo</span>
                <select value={na.tipo} onChange={e => setNa({ ...na, tipo: e.target.value as Publico })}><option>Contratante</option><option>Prestador</option></select>
              </div>
              {na.tipo === 'Prestador' && (
                <div className="row">
                  <span className="field-label">Contratante vinculado</span>
                  <select value={na.vinculo} onChange={e => setNa({ ...na, vinculo: e.target.value })}>
                    {contratantesList.map(ct => <option key={ct}>{ct}</option>)}
                  </select>
                </div>
              )}
              <div className="form-actions">
                <span className="form-error">{naErr}</span>
                <button className="btn ghost" onClick={() => setAddOpen(false)}>Cancelar</button>
                <button className="btn" disabled={busy} onClick={() => void addDestinatario()}>Adicionar</button>
              </div>
            </div>
          )}
          <div className="chipset" style={{ marginBottom: 10 }}>
            {filtros.map(([k, l, n]) => (
              <button key={k} className={`chip${fEnvio === k ? ' on' : ''}`} onClick={() => { setFEnvio(k); setSelConv(new Set()) }}>{l} ({n})</button>
            ))}
          </div>
          {podeGerir && selIds.length > 0 && (
            <div className="bulk-bar">
              <span className="sp">{selIds.length} selecionado{selIds.length === 1 ? '' : 's'}</span>
              <button className="btn small" disabled={busy || !selNaoEnv.length} onClick={() => void registrarEnvio('marcar', selNaoEnv)}>
                Marcar como enviado manualmente{selNaoEnv.length ? ` (${selNaoEnv.length})` : ''}
              </button>
              <button className="btn ghost small" disabled={busy || !selEnv.length} onClick={() => {
                if (confirm(`Desfazer a marcação de ${selEnv.length} destinatário(s)? Eles voltam para "Não enviado" e a contagem de lembretes zera.`)) void registrarEnvio('desfazer', selEnv)
              }}>Desfazer marcação{selEnv.length ? ` (${selEnv.length})` : ''}</button>
              <button className="btn ghost small" onClick={() => setSelConv(new Set())}>Limpar seleção</button>
            </div>
          )}
          <div className="tbl-wrap">
            <table>
              <thead><tr>
                {podeGerir && (
                  <th style={{ width: 28 }}>
                    <input type="checkbox" className="chk" aria-label="Selecionar todos os visíveis" disabled={!selecionaveis.length} checked={todosSel}
                      onChange={() => setSelConv(todosSel ? new Set() : new Set(selecionaveis.map(d => d.id)))} />
                  </th>
                )}
                <th>Responsável</th><th>Empresa</th><th>Status</th><th>Link do convite</th><th />
              </tr></thead>
              <tbody>
                {!visiveis.length && <tr className="empty-row"><td colSpan={podeGerir ? 6 : 5}>{rows.length ? 'Nenhum destinatário com esse status.' : 'Nenhum destinatário ainda. Use "Incluir do Cadastro de Contratantes" ou "+ Adicionar destinatário".'}</td></tr>}
                {visiveis.map(d => {
                  const st = statusExib(d)
                  return (
                    <tr key={d.id}>
                      {podeGerir && (
                        <td>
                          <input type="checkbox" className="chk" aria-label={`Selecionar ${d.nome || d.email}`} disabled={st === 'respondido'}
                            title={st === 'respondido' ? 'Já respondeu — o envio não pode ser alterado' : undefined}
                            checked={selConv.has(d.id)} onChange={() => setSelConv(s => toggle(s, d.id))} />
                        </td>
                      )}
                      <td className="name-cell">
                        {d.nome || <span className="dash">(sem nome)</span>}
                        {d.email ? <span className="email-sub">{d.email}</span> : <span className="warn-sub">sem e-mail</span>}
                      </td>
                      <td>{d.empresa}{d.tipo === 'Prestador' && d.vinculo ? <span className="email-sub">Contratante: {d.vinculo}</span> : null}</td>
                      <td>
                        <span className={`badge ${st}`}>{STATUS_EXIB_LABEL[st]}</span>
                        {st === 'enviado' && (
                          <>
                            <span className="envio-sub">em {fmtData(d.enviado_em)}</span>
                            {d.lembretes_enviados > 0 && <span className="envio-sub">lembretes: {d.lembretes_enviados}</span>}
                          </>
                        )}
                        {st === 'respondido' && d.respondido_em && <span className="envio-sub">em {fmtData(d.respondido_em)}</span>}
                      </td>
                      <td>
                        {d.token
                          ? <button className="token-btn" title="Copiar link" onClick={() => void copiarLink(d)}>{copiedId === d.id ? 'Copiado ✓' : `/${d.token.slice(0, 10)}…`}</button>
                          : <span className="dash">—</span>}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {podeGerir && st === 'nao_enviado' && (
                          <button className="btn ghost small" disabled={busy} onClick={() => void registrarEnvio('marcar', [d.id])}>Marcar enviado</button>
                        )}
                        {podeGerir && st === 'enviado' && (
                          <button className="btn ghost small" disabled={busy} onClick={() => {
                            if (confirm(`Desfazer a marcação de ${d.nome || d.email}? Volta para "Não enviado".`)) void registrarEnvio('desfazer', [d.id])
                          }}>Desfazer marcação</button>
                        )}
                        {d.token && <a className="btn ghost small" style={{ textDecoration: 'none', display: 'inline-block', marginLeft: 6 }} href={linkDe(d.token)} target="_blank" rel="noreferrer">Abrir link</a>}
                        <button className="icon-btn danger" style={{ marginLeft: 6 }} title="Remover destinatário" onClick={() => void removerDestinatario(d)}>✕</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="f-hint" style={{ marginTop: 10 }}>{hint}</p>
        </div>
        {impOpen && renderImportacao()}
      </>
    )
  }

  function renderImportacao() {
    const chave = (l: LinhaCadastro) => l.contratanteId + '|' + l.email
    const q = impBusca.trim().toLowerCase()
    const filtradas = impLinhas.filter(l => !q || `${l.empresa} ${l.email} ${l.origem} ${impNomes[chave(l)] ?? ''}`.toLowerCase().includes(q))
    const livres = filtradas.filter(l => !l.jaIncluido)
    const todasSel = livres.length > 0 && livres.every(l => impSel.has(chave(l)))
    const empresas = [...new Set(filtradas.map(l => l.empresa))]
    return (
      <div className="modal-bg" role="dialog" aria-modal="true" aria-label="Incluir do Cadastro de Contratantes" onClick={e => { if (e.target === e.currentTarget && !busy) setImpOpen(false) }}>
        <div className="modal">
          <div className="modal-head">
            <h2>Incluir do Cadastro de Contratantes</h2>
            <p className="cap" style={{ margin: 0 }}>
              Cada e-mail encontrado no cadastro vira um convite. O cadastro não diz de quem é cada e-mail: confira o Nome (ele vira o PrimeiroNome da mala direta; vazio = saudação genérica). Só lê o cadastro, não altera nada nele.
            </p>
          </div>
          <div className="modal-tools">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <input type="checkbox" className="chk" disabled={!livres.length} checked={todasSel}
                onChange={() => setImpSel(s => {
                  const n = new Set(s)
                  livres.forEach(l => { if (todasSel) n.delete(chave(l)); else n.add(chave(l)) })
                  return n
                })} />
              Selecionar todas{q ? ' (da busca)' : ''}
            </label>
            <input type="text" value={impBusca} onChange={e => setImpBusca(e.target.value)} placeholder="Buscar empresa, e-mail ou campo..." />
          </div>
          <div className="modal-body">
            {impLoading && <p className="cap" style={{ marginTop: 14 }}>Lendo o cadastro…</p>}
            {impErr && <p className="form-error" style={{ marginTop: 14 }}>{impErr}</p>}
            {!impLoading && !impErr && !filtradas.length && <p className="cap" style={{ marginTop: 14 }}>Nenhum e-mail encontrado{q ? ' para essa busca' : ''}.</p>}
            {empresas.map(emp => (
              <div className="imp-emp" key={emp}>
                <h3>{emp}</h3>
                {filtradas.filter(l => l.empresa === emp).map(l => {
                  const k = chave(l)
                  return (
                    <div className={`imp-row${l.jaIncluido ? ' off' : ''}`} key={k}>
                      <input type="checkbox" className="chk" disabled={l.jaIncluido} checked={!l.jaIncluido && impSel.has(k)}
                        aria-label={`Incluir ${l.email}`} onChange={() => setImpSel(s => toggle(s, k))} />
                      <div className="imp-email">{l.email}{l.jaIncluido && <span className="email-sub">já é destinatário</span>}</div>
                      <div className="imp-origem">campo: {l.origem}</div>
                      <input type="text" value={impNomes[k] ?? ''} disabled={l.jaIncluido} placeholder="Nome (opcional)"
                        aria-label={`Nome para ${l.email}`} onChange={e => setImpNomes(n => ({ ...n, [k]: e.target.value }))} />
                    </div>
                  )
                })}
              </div>
            ))}
            {!impLoading && impSemEmail.length > 0 && !q && (
              <div className="imp-emp">
                <h3 style={{ color: 'var(--danger)' }}>Sem e-mail no cadastro ({impSemEmail.length}) — não serão incluídas</h3>
                <p className="cap" style={{ margin: 0 }}>{impSemEmail.map(s => s.empresa).join(' · ')}</p>
              </div>
            )}
          </div>
          <div className="modal-foot">
            <span className="cap" style={{ margin: '0 auto 0 0' }}>{impSel.size} selecionado{impSel.size === 1 ? '' : 's'}</span>
            <button className="btn ghost" disabled={busy} onClick={() => setImpOpen(false)}>Cancelar</button>
            <button className="btn" disabled={busy || !impSel.size} onClick={() => void confirmarImportacao()}>Incluir {impSel.size || ''} selecionado{impSel.size === 1 ? '' : 's'}</button>
          </div>
        </div>
      </div>
    )
  }

  // ── PAINEL ─────────────────────────────────────────────────────────────────

  function renderPainel(qn: Questionario) {
    const todosRows = convitesDe(qn.id)
    const cfg = cfgFor(qn)
    const search = fSearch.trim().toLowerCase()

    const broad = todosRows.filter(d => {
      if (fContratante !== 'all') {
        const m = (d.tipo === 'Contratante' && d.empresa === fContratante) || (d.tipo === 'Prestador' && d.vinculo === fContratante)
        if (!m) return false
      }
      if (fEmpresa.size && !fEmpresa.has(d.empresa)) return false
      if (fStatus.size && !fStatus.has(statusExib(d))) return false
      if (search && !`${d.nome} ${d.empresa}`.toLowerCase().includes(search)) return false
      return true
    })
    const withQuestions = (list: Convite[], excludeId: string | null) => list.filter(d => {
      for (const qid of Object.keys(fQ)) {
        if (qid === excludeId) continue
        const s = fQ[qid]
        if (s.size && !valoresResposta(d.respostas[qid]).some(v => s.has(v))) return false
      }
      return true
    })
    const full = withQuestions(broad, null)
    const empresas = [...new Set(todosRows.map(d => d.empresa))].sort((a, b) => a.localeCompare(b, 'pt-BR'))

    // Filtros ativos (pills)
    const pills: { label: string; rm: () => void }[] = []
    if (fContratante !== 'all') pills.push({ label: `Contratante: ${fContratante}`, rm: () => setFContratante('all') })
    // Muitas empresas marcadas viram uma pílula só (senão a faixa de filtros toma a tela)
    if (fEmpresa.size > 3) pills.push({ label: `Empresas: ${fEmpresa.size} selecionadas`, rm: () => setFEmpresa(new Set()) })
    else fEmpresa.forEach(v => pills.push({ label: `Empresa: ${v}`, rm: () => setFEmpresa(s => toggle(s, v)) }))
    fStatus.forEach(v => pills.push({ label: `Status: ${STATUS_EXIB_LABEL[v]}`, rm: () => setFStatus(s => toggle(s, v)) }))
    Object.keys(fQ).forEach(qid => {
      const q = qn.perguntas.find(x => x.id === qid)
      fQ[qid].forEach(v => pills.push({ label: `${q?.label ?? qid} → ${v}`, rm: () => setFQ(f => ({ ...f, [qid]: toggle(f[qid], v) })) }))
    })

    // Stats
    const resp = full.filter(d => d.status === 'respondido').length
    const taxa = full.length ? Math.round(resp / full.length * 100) : 0
    const nEmp = new Set(full.map(d => d.empresa)).size
    const stats: { n: string | number; l: string; c: string; sub: string; meter?: number }[] = []
    if (cfg.statTiles.total) stats.push({ n: full.length, l: 'Convites no recorte', c: '', sub: `${nEmp} empresa${nEmp === 1 ? '' : 's'}` })
    if (cfg.statTiles.taxa) stats.push({ n: `${taxa}%`, l: 'Taxa de resposta', c: 'good', sub: `${resp} de ${full.length}`, meter: taxa })
    if (cfg.statTiles.respondido) stats.push({ n: resp, l: 'Respondido', c: 'good', sub: 'questionários concluídos' })
    if (cfg.statTiles.pendente) stats.push({ n: full.length - resp, l: 'Ainda sem resposta', c: 'warning', sub: `${full.filter(d => statusExib(d) === 'nao_enviado').length} ainda não enviados` })

    const chart = (q: Pergunta) => {
      const domain: (string | number)[] = q.type === 'escala' ? [1, 2, 3, 4, 5] : (q.options ?? [])
      const colors = q.type === 'escala' ? ORD_COLOR : CAT_COLOR
      const base = withQuestions(broad, q.id).filter(d => d.status === 'respondido' && d.respostas[q.id] != null)
      const counts = domain.map(v => base.filter(d => valoresResposta(d.respostas[q.id]).includes(v)).length)
      const max = Math.max(1, ...counts)
      const sel = fQ[q.id] ?? new Set()
      const totalAns = counts.reduce((a, b) => a + b, 0)
      // Base das porcentagens = quem respondeu a pergunta (na múltipla com várias respostas a soma passa de 100%)
      const pct = (n: number) => base.length ? Math.round(n / base.length * 100) : 0
      const media = q.type === 'escala' && totalAns ? counts.reduce((a, n, i) => a + n * (i + 1), 0) / totalAns : null
      const clicar = (v: string | number) => setFQ(f => ({ ...f, [q.id]: toggle(f[q.id] ?? new Set(), v) }))
      const dica = (v: string | number, n: number) => `${v}: ${n} resposta${n === 1 ? '' : 's'} (${pct(n)}%)`
      const vazio = !totalAns && !sel.size
      return (
        <div className="card chart-card" key={q.id}>
          <div className="chart-head">
            <h2>{q.label}</h2>
            <div className="chart-meta">
              {media != null && <span className="kpi-pill"><b>{media.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}</b> média</span>}
              <span className="kpi-pill"><b>{base.length}</b> resposta{base.length === 1 ? '' : 's'}</span>
            </div>
          </div>
          <p className="cap">{q.type === 'escala' ? `1 = ${q.min || '—'} · 5 = ${q.max || '—'}. ` : q.multiplas ? 'Várias respostas por pessoa. ' : ''}Clique numa barra para isolar essa resposta.</p>
          <div className="chart-surface">
            {vazio ? (
              <div className="empty-note">Ainda sem respostas para esta pergunta no recorte atual.</div>
            ) : q.type === 'escala' ? (
              <div className="colchart">
                <div className="colgrid" aria-hidden><i /><i /><i /><i /></div>
                {domain.map((v, i) => {
                  const on = sel.has(v)
                  return (
                    <button key={String(v)} className={`col${on ? ' sel' : ''}${sel.size && !on ? ' dim' : ''}`}
                      aria-pressed={on} aria-label={dica(v, counts[i])} data-tip={dica(v, counts[i])} onClick={() => clicar(v)}>
                      <span className="col-plot">
                        <span className="col-val">{counts[i]}</span>
                        <span className="col-bar" style={{ height: `calc((100% - 22px) * ${counts[i] / max})`, background: colors[i % colors.length] }} />
                      </span>
                      <span className="col-label">{v}</span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="hbars">
                {domain.map((v, i) => {
                  const on = sel.has(v)
                  return (
                    <button key={String(v)} className={`hbar${on ? ' sel' : ''}${sel.size && !on ? ' dim' : ''}`}
                      aria-pressed={on} aria-label={dica(v, counts[i])} data-tip={dica(v, counts[i])} onClick={() => clicar(v)}>
                      <span className="hbar-top">
                        <span className="hbar-label"><i style={{ background: colors[i % colors.length] }} />{v}</span>
                        <span className="hbar-val"><b>{counts[i]}</b> · {pct(counts[i])}%</span>
                      </span>
                      <span className="hbar-track"><span className="hbar-fill" style={{ width: `${counts[i] / max * 100}%`, background: colors[i % colors.length] }} /></span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )
    }

    const empresaStack = () => {
      const LIMITE = 8
      const porEmp = [...new Set(full.map(d => d.empresa))].map(emp => {
        const rows = full.filter(d => d.empresa === emp)
        const c: Record<StatusExib, number> = { respondido: 0, enviado: 0, nao_enviado: 0 }
        rows.forEach(d => { c[statusExib(d)]++ })
        return { emp, rows, c, taxa: c.respondido / rows.length }
      }).sort((a, b) =>
        stackOrdem === 'menor' ? a.taxa - b.taxa || a.emp.localeCompare(b.emp, 'pt-BR')
        : stackOrdem === 'maior' ? b.taxa - a.taxa || a.emp.localeCompare(b.emp, 'pt-BR')
        : a.emp.localeCompare(b.emp, 'pt-BR'))
      const exibidas = stackTodas ? porEmp : porEmp.slice(0, LIMITE)
      return (
        <div className="card" key="empresaStack">
          <div className="chart-head">
            <h2>Status por empresa</h2>
            {porEmp.length > 1 && (
              <div className="seg seg-sm" role="group" aria-label="Ordenar empresas">
                {([['nome', 'A–Z'], ['menor', 'Menor resposta'], ['maior', 'Maior resposta']] as const).map(([k, l]) => (
                  <button key={k} className={stackOrdem === k ? 'on' : ''} onClick={() => setStackOrdem(k)}>{l}</button>
                ))}
              </div>
            )}
          </div>
          <p className="cap">Clique no nome da empresa para filtrar por ela, ou num segmento para filtrar por status.</p>
          <div className="stacklist">
            {!porEmp.length && <p className="empty-note" style={{ textAlign: 'left', padding: '4px 0' }}>Nenhuma empresa no recorte atual.</p>}
            {exibidas.map(({ emp, rows, c, taxa }) => {
              return (
                <div className="stackrow" key={emp}>
                  <div className="stackrow-head">
                    <button className={fEmpresa.has(emp) ? 'on' : ''} onClick={() => setFEmpresa(s => toggle(s, emp))}>{emp}</button>
                    <span className="tot"><b>{Math.round(taxa * 100)}%</b> · {c.respondido}/{rows.length} responderam</span>
                  </div>
                  <div className="stackbar">
                    {(['respondido', 'enviado', 'nao_enviado'] as StatusExib[]).map(st => !c[st] ? null : (
                      <button
                        key={st}
                        className={`stackseg${fStatus.size && !fStatus.has(st) ? ' dim' : ''}`}
                        style={{ width: `${c[st] / rows.length * 100}%`, background: ST_COLOR[st] }}
                        data-tip={`${STATUS_EXIB_LABEL[st]}: ${c[st]} de ${rows.length}`}
                        aria-label={`${emp}, ${STATUS_EXIB_LABEL[st]}: ${c[st]}`}
                        onClick={() => setFStatus(s => toggle(s, st))}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          {porEmp.length > LIMITE && (
            <button className="link-btn" style={{ marginTop: 10 }} onClick={() => setStackTodas(v => !v)}>
              {stackTodas ? 'Mostrar menos' : `Mostrar todas as ${porEmp.length} empresas`}
            </button>
          )}
          <div className="legend">
            {(['respondido', 'enviado', 'nao_enviado'] as StatusExib[]).map(st => (
              <div className="legend-item" key={st}><span className="legend-swatch" style={{ background: ST_COLOR[st] }} />{STATUS_EXIB_LABEL[st]}</div>
            ))}
          </div>
        </div>
      )
    }

    const table = () => {
      const closed = qn.perguntas.filter(q => q.type !== 'texto')
      const open = qn.perguntas.filter(q => q.type === 'texto')
      const heads = ['Nome', 'Empresa', 'Contratante', 'Status', ...closed.map(q => q.label), ...open.map(q => q.label)]
      return (
        <div className="card" key="table">
          <h2>Respondentes no recorte atual</h2>
          <p className="cap">Sincronizada com todos os filtros acima, com cada resposta por pergunta.</p>
          <div className="tbl-wrap">
            <table>
              <thead><tr>{heads.map((h, i) => <th key={i} title={h}>{h}</th>)}</tr></thead>
              <tbody>
                {!full.length && <tr className="empty-row"><td colSpan={heads.length}>Nenhum respondente corresponde aos filtros atuais.</td></tr>}
                {full.map(d => (
                  <tr key={d.id}>
                    <td className="name-cell">{d.nome}</td>
                    <td>{d.empresa}</td>
                    <td>{d.tipo === 'Contratante' ? d.empresa : (d.vinculo || '—')}</td>
                    <td><span className={`badge ${statusExib(d)}`}>{STATUS_EXIB_LABEL[statusExib(d)]}</span></td>
                    {closed.map(q => <td key={q.id}>{fmtResposta(d.respostas[q.id]) || <span className="dash">—</span>}</td>)}
                    {open.map(q => <td key={q.id} className="comment-cell">{d.respostas[q.id] ? String(d.respostas[q.id]) : <span className="dash">—</span>}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tbl-foot">{full.length} de {todosRows.length} convites exibidos.</p>
        </div>
      )
    }

    // Monta os blocos na ordem configurada — gráficos seguidos entram em grade de 2 colunas
    const blocos: React.ReactNode[] = []
    let pendentes: React.ReactNode[] = []
    const flush = () => { if (pendentes.length) { blocos.push(<div className="grid2" key={`g${blocos.length}`}>{pendentes}</div>); pendentes = [] } }
    cfg.order.forEach(id => {
      if (!cfg.visible[id]) return
      const q = qn.perguntas.find(x => x.id === id && x.type !== 'texto')
      if (q) { pendentes.push(chart(q)); return }
      flush()
      if (id === 'empresaStack') blocos.push(empresaStack())
      if (id === 'table') blocos.push(table())
    })
    flush()

    return (
      <>
        {qnSelect('Questionário')}
        <div className="filterbar">
          <div className="f-group">
            <span className="field-label">Contratante vinculado</span>
            <select value={fContratante} onChange={e => setFContratante(e.target.value)}>
              <option value="all">Todos os contratantes</option>
              {contratantesList.map(ct => <option key={ct} value={ct}>{ct}</option>)}
            </select>
          </div>
          <div className="f-group">
            <span className="field-label">Status do convite</span>
            <div className="chipset">
              {(['respondido', 'enviado', 'nao_enviado'] as StatusExib[]).map(st => (
                <button key={st} className={`chip${fStatus.has(st) ? ' on' : ''}`} onClick={() => setFStatus(s => toggle(s, st))}>
                  {STATUS_EXIB_LABEL[st]}
                </button>
              ))}
            </div>
          </div>
          <div className="f-group">
            <span className="field-label">Empresa</span>
            <MultiFiltro opcoes={empresas} sel={fEmpresa} onChange={setFEmpresa} todosLabel="Todas as empresas" plural="empresas" />
          </div>
          <div className="f-group f-search">
            <span className="field-label">Buscar respondente</span>
            <input type="text" value={fSearch} onChange={e => setFSearch(e.target.value)} placeholder="Nome ou empresa..." />
          </div>
          <button className="btn ghost small" onClick={() => selectQn(qn.id)}>Limpar filtros</button>
        </div>
        <p className="f-hint">Filtrar por contratante também traz os prestadores vinculados a ele. Clique numa barra dos gráficos para isolar uma resposta específica.</p>
        {pills.length > 0 && (
          <div className="active-strip">
            <span>Filtros ativos:</span>
            {pills.map((p, i) => <span className="pill" key={i}>{p.label}<button aria-label="Remover filtro" onClick={p.rm}>×</button></span>)}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!todosRows.length && (
            <div className="card">
              <h2>Nenhum convite enviado ainda</h2>
              <p className="cap" style={{ margin: 0 }}>Este questionário ainda não tem destinatários. Quando os convites forem enviados, as respostas aparecem aqui.</p>
            </div>
          )}
          {stats.length > 0 && (
            <div className="stats">
              {stats.map(s => (
                <div className={`stat ${s.c}`} key={s.l}>
                  <div className="l">{s.l}</div>
                  <div className={`n ${s.c}`}>{s.n}</div>
                  {s.meter != null && <div className="stat-meter" aria-hidden><i style={{ width: `${s.meter}%` }} /></div>}
                  <div className="s">{s.sub}</div>
                </div>
              ))}
            </div>
          )}
          {blocos}
        </div>
      </>
    )
  }

  // ── CONFIG ─────────────────────────────────────────────────────────────────

  function renderConfig(qn: Questionario) {
    const cfg = cfgFor(qn)
    const tiles: [keyof PainelConfig['statTiles'], string][] = [['total', 'Convites no recorte'], ['taxa', 'Taxa de resposta'], ['respondido', 'Respondido'], ['pendente', 'Ainda sem resposta']]
    return (
      <>
        {qnSelect('Personalizando o painel de')}
        <div className="card">
          <h2>Cartões de resumo</h2>
          <p className="cap">Escolha quais números aparecem no topo do painel.</p>
          <div>
            {tiles.map(([k, l]) => (
              <div className="toggle-row" key={k}>
                <span className="lbl">{l}</span>
                <div className="toggle-row-actions">
                  <Switch checked={cfg.statTiles[k]} onChange={v => salvarCfg(qn, { ...cfg, statTiles: { ...cfg.statTiles, [k]: v } })} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h2>Gráficos e listas</h2>
          <p className="cap">Ative, desative e reordene os blocos. A ordem aqui é a ordem exibida no painel. Cada pergunta de nota ou múltipla escolha vira um gráfico.</p>
          <div>
            {cfg.order.map((id, i) => {
              const q = qn.perguntas.find(x => x.id === id)
              const name = q ? q.label : id === 'empresaStack' ? 'Status por empresa' : 'Tabela de respondentes'
              const sub = q ? `Gráfico · ${TYPE_NAME[q.type]}` : 'Bloco fixo'
              const mover = (dir: -1 | 1) => {
                const order = [...cfg.order]
                ;[order[i], order[i + dir]] = [order[i + dir], order[i]]
                salvarCfg(qn, { ...cfg, order })
              }
              return (
                <div className="toggle-row" key={id}>
                  <span className="lbl">{name}<small>{sub}</small></span>
                  <div className="toggle-row-actions">
                    <div style={{ display: 'flex', gap: 3 }}>
                      <button className="icon-btn" aria-label="Mover para cima" disabled={i === 0} onClick={() => mover(-1)}>▲</button>
                      <button className="icon-btn" aria-label="Mover para baixo" disabled={i === cfg.order.length - 1} onClick={() => mover(1)}>▼</button>
                    </div>
                    <Switch checked={cfg.visible[id]} onChange={v => salvarCfg(qn, { ...cfg, visible: { ...cfg.visible, [id]: v } })} />
                  </div>
                </div>
              )
            })}
          </div>
          <button className="btn ghost small" style={{ marginTop: 14 }} onClick={() => void patchQn(qn.id, { painel_config: {} })}>Restaurar padrão</button>
        </div>
      </>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="qnm">
      <style>{CSS}</style>
      {header}
      {tabs}
      <section className="view">
        {tab === 'hub' && (editing ? renderEditor(editing) : renderHub())}
        {tab === 'convites' && (selQn ? renderConvites(selQn) : semQn)}
        {tab === 'painel' && (selQn ? renderPainel(selQn) : semQn)}
        {tab === 'config' && (selQn ? renderConfig(selQn) : semQn)}
      </section>
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#1A2340', color: '#fff', padding: '10px 18px', borderRadius: 8, fontSize: 13, zIndex: 400, boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
