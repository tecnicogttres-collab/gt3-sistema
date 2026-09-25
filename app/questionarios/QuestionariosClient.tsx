'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  type Questionario, type Convite, type Pergunta, type TipoPergunta, type Publico, type StatusQn,
  type StatusConvite, type PainelConfig,
  TYPE_NAME, TYPE_DESC, STATUS_QN_NAME,
} from './types'

// ─── Tokens (mesma paleta do HTML de referência) ─────────────────────────────

const ORD_COLOR = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#104281']
const CAT_COLOR = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']
const ST_COLOR: Record<StatusConvite, string> = { respondido: '#0ca30c', enviado: '#fab219', pendente: '#898781' }
const STATUS_CONVITE_LABEL: Record<StatusConvite, string> = { pendente: 'Sem link', enviado: 'Enviado', respondido: 'Respondido' }

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
.qnm .hub-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
.qnm .qn-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px;box-shadow:var(--shadow);display:flex;flex-direction:column;gap:12px}
.qnm .qn-card h3{font-size:16px;font-weight:800;margin:0;line-height:1.25}
.qnm .qn-numbers{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;border-top:1px solid var(--border);padding-top:12px}
.qnm .qn-numbers div{display:flex;flex-direction:column}
.qnm .qn-numbers b{font-size:18px;font-weight:800;font-variant-numeric:tabular-nums}
.qnm .qn-numbers span{font-size:11px;color:var(--text-muted)}
.qnm .qn-progress{height:6px;border-radius:100px;background:var(--surface-2);overflow:hidden}
.qnm .qn-progress i{display:block;height:100%;background:var(--st-good);border-radius:100px}
.qnm .qn-actions{display:flex;gap:8px;margin-top:auto}
.qnm .qn-actions .btn{flex:1}
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
.qnm .answers-inline .scale-desc{background:none;border:none;padding:3px 0;color:var(--text-muted);font-weight:500}
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
.qnm .pv-ends{display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted)}
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
.qnm .stat{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 16px;box-shadow:var(--shadow)}
.qnm .stat .n{font-weight:800;font-size:26px;line-height:1.1}
.qnm .stat .l{font-size:12px;color:var(--text-muted);margin-top:3px}
.qnm .stat .n.good{color:var(--st-good-text)}
.qnm .stat .n.warning{color:var(--st-warning-text)}
.qnm .grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media (max-width:760px){.qnm .grid2{grid-template-columns:1fr}}
.qnm .chart-surface{background:var(--chart-surface);border-radius:10px;padding:12px 10px 6px}
.qnm .legend{display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;font-size:12px;color:var(--text-secondary)}
.qnm .legend-item{display:flex;align-items:center;gap:6px}
.qnm .legend-swatch{width:10px;height:10px;border-radius:2px;flex:none}
.qnm .barchart{display:flex;align-items:flex-end;gap:10px;height:160px;padding:0 4px}
.qnm .bar-col{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;justify-content:flex-end;min-width:0}
.qnm .bar-rect-wrap{width:100%;display:flex;justify-content:center;height:100%;align-items:flex-end}
.qnm .bar-rect{width:60%;min-width:18px;border-radius:4px 4px 0 0;cursor:pointer;transition:opacity .12s ease;outline:2px solid transparent;outline-offset:2px;border:none;padding:0}
.qnm .bar-rect:hover{opacity:.85}
.qnm .bar-rect.dim{opacity:.35}
.qnm .bar-rect.sel{outline-color:var(--primary)}
.qnm .bar-val{font-size:11.5px;font-weight:700;color:var(--text-secondary);font-variant-numeric:tabular-nums}
.qnm .bar-label{font-size:11px;color:var(--text);font-weight:700;text-align:center;line-height:1.25;max-width:90px;overflow-wrap:break-word;min-height:28px}
.qnm .empty-note{font-size:12.5px;color:var(--text-muted);padding:20px 4px;text-align:center;width:100%;align-self:center}
.qnm .stacklist{display:flex;flex-direction:column;gap:12px}
.qnm .stackrow{display:flex;flex-direction:column;gap:5px}
.qnm .stackrow-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.qnm .stackrow-head button{font-size:13px;font-weight:700;color:var(--text);background:none;border:none;cursor:pointer;padding:1px 4px;border-radius:5px;text-align:left}
.qnm .stackrow-head button:hover{color:var(--primary)}
.qnm .stackrow-head button.on{color:var(--primary);text-decoration:underline}
.qnm .stackrow-head .tot{font-size:11.5px;color:var(--text-muted);font-variant-numeric:tabular-nums}
.qnm .stackbar{display:flex;height:16px;border-radius:4px;overflow:hidden;gap:2px;background:var(--gridline)}
.qnm .stackseg{height:100%;cursor:pointer;transition:opacity .12s ease;min-width:2px;border:none;padding:0}
.qnm .stackseg:hover{opacity:.8}
.qnm .stackseg.dim{opacity:.3}
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
.qnm .badge.pendente{background:var(--surface-2);color:var(--text-muted)}
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
type Draft = { id: string | null; type: TipoPergunta; label: string; min: string; max: string; options: string[] }

const blankDraft = (): Draft => ({ id: null, type: 'escala', label: '', min: 'Muito insatisfeito', max: 'Muito satisfeito', options: ['', ''] })
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
    return <div className="answers-inline">{(q.options ?? []).map(o => <span key={o}>{o}</span>)}</div>
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

  // Painel — filtros
  const [fContratante, setFContratante] = useState('all')
  const [fStatus, setFStatus] = useState<Set<StatusConvite>>(new Set())
  const [fEmpresa, setFEmpresa] = useState<Set<string>>(new Set())
  const [fSearch, setFSearch] = useState('')
  const [fQ, setFQ] = useState<Record<string, Set<string | number>>>({})

  // ── Load ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/questionarios').then(async r => r.ok ? r.json() : Promise.reject((await r.json().catch(() => ({}))).error ?? 'Erro ao carregar')),
      fetch('/api/terceiras/contratantes').then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([d, cts]: [{ questionarios: Questionario[]; convites: Convite[] }, { nome: string }[]]) => {
      if (cancelled) return
      setQns(d.questionarios)
      setConvites(d.convites)
      setContratantesBase((cts ?? []).map(c => c.nome))
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
    setAddOpen(false)
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
    void patchQn(editing.id, { perguntas: p })
  }

  function removerPergunta(q: Pergunta) {
    if (!editing) return
    if (confirmDel !== q.id) { setConfirmDel(q.id); return }
    void patchQn(editing.id, { perguntas: editing.perguntas.filter(x => x.id !== q.id) })
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

  const linkDe = (token: string) => `${window.location.origin}/questionario/${token}`

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

  function renderComposer(d: Draft, index: number) {
    const upd = (p: Partial<Draft>) => setDraft({ ...d, ...p })
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
            </>
          )}
          {d.type === 'texto' && <div className="text-answer-demo">O respondente terá um campo livre para escrever. Não há respostas pré-definidas.</div>}
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
      const dq = { id: draft.id ?? '__novo', type: draft.type, label: draft.label, min: draft.min, max: draft.max, options: draft.options, _draft: true }
      items = draft.id ? items.map(q => q.id === draft.id ? dq : q) : [...items, dq]
    }
    return (
      <div className="preview-shell">
        <div className="preview-top"><small>GT3 Consultoria</small><b>{tituloDraft || 'Sem nome'}</b></div>
        <div className="preview-body">
          {!items.length && <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }}>Adicione a primeira pergunta para ver a prévia.</p>}
          {items.map((q, i) => (
            <div key={q.id} className={`pv-q${q._draft ? ' draft' : ''}`}>
              <div className="pv-label">{i + 1}. {q.label || <i style={{ fontStyle: 'normal', color: 'var(--text-muted)', fontWeight: 500 }}>Texto da pergunta…</i>}</div>
              {q.type === 'escala' && (
                <>
                  <div className="pv-scale">{[1, 2, 3, 4, 5].map(n => <span key={n}>{n}</span>)}</div>
                  <div className="pv-ends"><span>{q.min}</span><span>{q.max}</span></div>
                </>
              )}
              {q.type === 'multipla' && (() => {
                const opts = (q.options ?? []).filter(o => o.trim())
                return <div className="pv-choice">{(opts.length ? opts : ['Resposta 1', 'Resposta 2']).map((o, j) => <span key={j}>{o}</span>)}</div>
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
                if (draft && draft.id === q.id) return renderComposer(draft, i)
                const confirming = confirmDel === q.id
                return (
                  <div key={q.id} className="qitem">
                    <div className="qitem-head">
                      <span className="qnum">#{i + 1}</span>
                      <span className="qtype">{TYPE_NAME[q.type]}</span>
                      <div className="qitem-tools">
                        <button className="icon-btn" aria-label="Mover para cima" disabled={i === 0} onClick={() => moverPergunta(i, -1)}>▲</button>
                        <button className="icon-btn" aria-label="Mover para baixo" disabled={i === qn.perguntas.length - 1} onClick={() => moverPergunta(i, 1)}>▼</button>
                        <button className="icon-btn" onClick={() => {
                          setDraft({
                            id: q.id, type: q.type, label: q.label,
                            min: q.min ?? 'Muito insatisfeito', max: q.max ?? 'Muito satisfeito',
                            options: q.options && q.options.length >= 2 ? [...q.options] : [...(q.options ?? []), '', ''].slice(0, 2),
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
              {draft && !draft.id && renderComposer(draft, qn.perguntas.length)}
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
    const c = { pendente: 0, enviado: 0, respondido: 0 }
    rows.forEach(d => { c[d.status]++ })
    const hint = qn.status === 'rascunho'
      ? 'Este questionário está em rascunho. Mude a situação para Ativo (no editor) para gerar os links.'
      : qn.status === 'encerrado'
        ? 'Este questionário está encerrado e não aceita novas respostas.'
        : 'Use "Abrir link" para ver exatamente o que o destinatário recebe. O resultado aparece no Painel de respostas.'
    return (
      <>
        {qnSelect('Questionário')}
        <div className="steps">
          <div className="step"><div className="step-num">1</div><div><h3>Destinatários</h3><p>Responsáveis de cada contratante ou prestador. Por enquanto, adicionados manualmente.</p></div></div>
          <div className="step"><div className="step-num">2</div><div><h3>Gerar links</h3><p>Cada destinatário recebe um link único. É ele que vincula a resposta ao cadastro.</p></div></div>
          <div className="step"><div className="step-num">3</div><div><h3>Acompanhar</h3><p>O status muda para Respondido assim que o formulário é enviado.</p></div></div>
        </div>
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Destinatários do questionário</h2>
              <p className="cap" style={{ margin: 0 }}>
                {rows.length} destinatário{rows.length === 1 ? '' : 's'} · {c.respondido} respondido{c.respondido === 1 ? '' : 's'} · {c.enviado} aguardando resposta · {c.pendente} sem link
              </p>
            </div>
            <div className="actions">
              <button className="btn ghost" onClick={() => {
                setAddOpen(o => !o); setNaErr('')
                setNa({ nome: '', email: '', empresa: '', tipo: qn.publico, vinculo: contratantesList[0] ?? '' })
              }}>+ Adicionar destinatário</button>
              <button className="btn" disabled={busy || qn.status !== 'ativo' || !c.pendente} onClick={() => void gerarLinks()}>
                {c.pendente ? `Gerar links (${c.pendente})` : 'Gerar links'}
              </button>
            </div>
          </div>
          {addOpen && (
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
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Responsável</th><th>Empresa</th><th>Contratante</th><th>Status</th><th>Link do convite</th><th /></tr></thead>
              <tbody>
                {!rows.length && <tr className="empty-row"><td colSpan={6}>Nenhum destinatário ainda. Use &quot;+ Adicionar destinatário&quot;.</td></tr>}
                {rows.map(d => (
                  <tr key={d.id}>
                    <td className="name-cell">{d.nome}<span className="email-sub">{d.email}</span></td>
                    <td>{d.empresa}</td>
                    <td>{d.tipo === 'Contratante' ? d.empresa : (d.vinculo || '—')}</td>
                    <td><span className={`badge ${d.status}`}>{STATUS_CONVITE_LABEL[d.status]}</span></td>
                    <td>
                      {d.token
                        ? <button className="token-btn" title="Copiar link" onClick={() => void copiarLink(d)}>{copiedId === d.id ? 'Copiado ✓' : `/${d.token.slice(0, 10)}…`}</button>
                        : <span className="dash">—</span>}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {d.token && <a className="btn ghost small" style={{ textDecoration: 'none', display: 'inline-block' }} href={linkDe(d.token)} target="_blank" rel="noreferrer">Abrir link</a>}
                      <button className="icon-btn danger" style={{ marginLeft: 6 }} title="Remover destinatário" onClick={() => void removerDestinatario(d)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="f-hint" style={{ marginTop: 10 }}>{hint}</p>
        </div>
        <div className="info-note"><b>Importação da planilha do Portal GT3</b> fica para a etapa final. Quando entrar, ela substitui o cadastro manual acima: cada linha do Excel (nome, e-mail, empresa, CNPJ) vira um destinatário deste questionário.</div>
      </>
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
      if (fStatus.size && !fStatus.has(d.status)) return false
      if (search && !`${d.nome} ${d.empresa}`.toLowerCase().includes(search)) return false
      return true
    })
    const withQuestions = (list: Convite[], excludeId: string | null) => list.filter(d => {
      for (const qid of Object.keys(fQ)) {
        if (qid === excludeId) continue
        const s = fQ[qid]
        if (s.size && !s.has(d.respostas[qid])) return false
      }
      return true
    })
    const full = withQuestions(broad, null)
    const empresas = [...new Set(todosRows.map(d => d.empresa))].sort((a, b) => a.localeCompare(b, 'pt-BR'))

    // Filtros ativos (pills)
    const pills: { label: string; rm: () => void }[] = []
    if (fContratante !== 'all') pills.push({ label: `Contratante: ${fContratante}`, rm: () => setFContratante('all') })
    fEmpresa.forEach(v => pills.push({ label: `Empresa: ${v}`, rm: () => setFEmpresa(s => toggle(s, v)) }))
    fStatus.forEach(v => pills.push({ label: `Status: ${v}`, rm: () => setFStatus(s => toggle(s, v)) }))
    Object.keys(fQ).forEach(qid => {
      const q = qn.perguntas.find(x => x.id === qid)
      fQ[qid].forEach(v => pills.push({ label: `${q?.label ?? qid} → ${v}`, rm: () => setFQ(f => ({ ...f, [qid]: toggle(f[qid], v) })) }))
    })

    // Stats
    const resp = full.filter(d => d.status === 'respondido').length
    const stats: { n: string | number; l: string; c: string }[] = []
    if (cfg.statTiles.total) stats.push({ n: full.length, l: 'Convites no recorte', c: '' })
    if (cfg.statTiles.taxa) stats.push({ n: `${full.length ? Math.round(resp / full.length * 100) : 0}%`, l: 'Taxa de resposta', c: 'good' })
    if (cfg.statTiles.respondido) stats.push({ n: resp, l: 'Respondido', c: 'good' })
    if (cfg.statTiles.pendente) stats.push({ n: full.length - resp, l: 'Enviado + pendente', c: 'warning' })

    const chart = (q: Pergunta) => {
      const domain: (string | number)[] = q.type === 'escala' ? [1, 2, 3, 4, 5] : (q.options ?? [])
      const colors = q.type === 'escala' ? ORD_COLOR : CAT_COLOR
      const base = withQuestions(broad, q.id).filter(d => d.status === 'respondido' && d.respostas[q.id] != null)
      const counts = domain.map(v => base.filter(d => d.respostas[q.id] === v).length)
      const max = Math.max(1, ...counts)
      const sel = fQ[q.id] ?? new Set()
      const totalAns = counts.reduce((a, b) => a + b, 0)
      return (
        <div className="card" key={q.id}>
          <h2>{q.label}</h2>
          <p className="cap">{q.type === 'escala' ? `1 = ${q.min || ''} · 5 = ${q.max || ''}. ` : ''}Clique numa barra para isolar essa resposta.</p>
          <div className="chart-surface">
            <div className="barchart">
              {!totalAns && !sel.size ? (
                <div className="empty-note">Ainda sem respostas para esta pergunta no recorte atual.</div>
              ) : domain.map((v, i) => {
                const on = sel.has(v)
                const dim = sel.size > 0 && !on
                const h = Math.max(4, Math.round(counts[i] / max * 112))
                return (
                  <div className="bar-col" key={String(v)}>
                    <span className="bar-val">{counts[i]}</span>
                    <div className="bar-rect-wrap">
                      <button
                        className={`bar-rect${on ? ' sel' : ''}${dim ? ' dim' : ''}`}
                        aria-pressed={on}
                        aria-label={`${v}: ${counts[i]} respostas`}
                        title={`${v}: ${counts[i]} resposta${counts[i] === 1 ? '' : 's'}`}
                        style={{ height: h, background: colors[i % colors.length] }}
                        onClick={() => setFQ(f => ({ ...f, [q.id]: toggle(f[q.id] ?? new Set(), v) }))}
                      />
                    </div>
                    <span className="bar-label">{v}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )
    }

    const empresaStack = () => {
      const emps = [...new Set(full.map(d => d.empresa))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
      return (
        <div className="card" key="empresaStack">
          <h2>Status por empresa</h2>
          <p className="cap">Clique no nome da empresa para filtrar por ela, ou num segmento para filtrar por status.</p>
          <div className="stacklist">
            {!emps.length && <p className="empty-note" style={{ textAlign: 'left', padding: '4px 0' }}>Nenhuma empresa no recorte atual.</p>}
            {emps.map(emp => {
              const rows = full.filter(d => d.empresa === emp)
              const c = { respondido: 0, enviado: 0, pendente: 0 }
              rows.forEach(d => { c[d.status]++ })
              return (
                <div className="stackrow" key={emp}>
                  <div className="stackrow-head">
                    <button className={fEmpresa.has(emp) ? 'on' : ''} onClick={() => setFEmpresa(s => toggle(s, emp))}>{emp}</button>
                    <span className="tot">{c.respondido}/{rows.length} responderam</span>
                  </div>
                  <div className="stackbar">
                    {(['respondido', 'enviado', 'pendente'] as StatusConvite[]).map(st => !c[st] ? null : (
                      <button
                        key={st}
                        className={`stackseg${fStatus.size && !fStatus.has(st) ? ' dim' : ''}`}
                        style={{ width: `${c[st] / rows.length * 100}%`, background: ST_COLOR[st] }}
                        title={`${st}: ${c[st]}`}
                        aria-label={`${emp}, ${st}: ${c[st]}`}
                        onClick={() => setFStatus(s => toggle(s, st))}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="legend">
            {(['respondido', 'enviado', 'pendente'] as StatusConvite[]).map(st => (
              <div className="legend-item" key={st}><span className="legend-swatch" style={{ background: ST_COLOR[st] }} />{st.charAt(0).toUpperCase() + st.slice(1)}</div>
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
                    <td><span className={`badge ${d.status}`}>{d.status.charAt(0).toUpperCase() + d.status.slice(1)}</span></td>
                    {closed.map(q => <td key={q.id}>{d.respostas[q.id] != null ? String(d.respostas[q.id]) : <span className="dash">—</span>}</td>)}
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
              {(['respondido', 'enviado', 'pendente'] as StatusConvite[]).map(st => (
                <button key={st} className={`chip${fStatus.has(st) ? ' on' : ''}`} onClick={() => setFStatus(s => toggle(s, st))}>
                  {st.charAt(0).toUpperCase() + st.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="f-group">
            <span className="field-label">Empresa</span>
            <div className="chipset">
              {!empresas.length && <span className="f-hint">Sem empresas ainda</span>}
              {empresas.map(emp => (
                <button key={emp} className={`chip${fEmpresa.has(emp) ? ' on' : ''}`} onClick={() => setFEmpresa(s => toggle(s, emp))}>{emp}</button>
              ))}
            </div>
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
              {stats.map(s => <div className="stat" key={s.l}><div className={`n ${s.c}`}>{s.n}</div><div className="l">{s.l}</div></div>)}
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
    const tiles: [keyof PainelConfig['statTiles'], string][] = [['total', 'Convites no recorte'], ['taxa', 'Taxa de resposta'], ['respondido', 'Respondido'], ['pendente', 'Enviado + pendente']]
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
