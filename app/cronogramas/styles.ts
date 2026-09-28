// CSS do módulo (portado do HTML de referência gt3-cronograma-implantacao), escopado em .crm
// para não vazar para o resto do sistema. A sidebar do HTML não entra — o AppShell já tem a sua.

export const CSS = `
.crm{--pri:#2A4F96;--pri-d:#1B3468;--pri-dd:#132649;--gold:#D1AE6E;--gold-l:#F5ECDC;
  --bg:#F4F6FA;--card:#FFFFFF;--line:#E4E8F0;--line-2:#F0F2F7;--tint:#F8FAFD;
  --ink:#1A2233;--ink-2:#4A5568;--ink-3:#8C98AD;
  --ok:#2E8B57;--ok-bg:#E3F4EA;--run:#2A4F96;--run-bg:#E4ECFA;
  --wait:#A87617;--wait-bg:#FBF0D9;--pend:#6B778C;--pend-bg:#EEF1F5;
  --late:#C0392B;--late-bg:#FBE7E4;--lock:#8C98AD;
  --sans:inherit;--mono:"IBM Plex Mono",ui-monospace,Consolas,monospace;
  --lw:410px;--rh:42px;
  font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-family:inherit;color:var(--ink);
  display:flex;flex-direction:column;height:100%;min-height:520px;min-width:0}
.crm *{box-sizing:border-box}
.crm button,.crm input,.crm select,.crm textarea{font:inherit;color:inherit}
.crm button{cursor:pointer}
.crm :focus-visible{outline:2px solid var(--gold);outline-offset:2px}
.crm .num{font-family:var(--mono);font-variant-numeric:tabular-nums}
.crm svg{flex:none}
.crm [hidden]{display:none!important}

.crm .top{display:flex;flex-wrap:wrap;align-items:center;gap:12px 16px;padding:0 0 14px}
.crm .top .ttl{flex:1;min-width:220px}
.crm .crumb{font-size:12px;color:var(--ink-3)}
.crm .crumb b{color:var(--ink-2);font-weight:500}
.crm .top h1{margin:1px 0 0;font-size:20px;font-weight:600;text-wrap:balance}
.crm .actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.crm .btn{display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 13px;border-radius:8px;border:1px solid var(--line);background:var(--card);font-size:13px;font-weight:500;color:var(--ink-2);white-space:nowrap}
.crm .btn:hover{border-color:#C5CEDD;color:var(--ink)}
.crm .btn:disabled{opacity:.5;cursor:not-allowed}
.crm .btn svg{width:16px;height:16px}
.crm .btn.ic{width:36px;padding:0;justify-content:center}
.crm .btn.pri{background:var(--pri);border-color:var(--pri);color:#fff}
.crm .btn.pri:hover{background:var(--pri-d)}
.crm .btn.gold{background:var(--gold);border-color:var(--gold);color:var(--pri-dd)}
.crm .btn.gold:hover{background:#C49D57}
.crm .btn.on{border-color:var(--pri);color:var(--pri);box-shadow:0 0 0 1px var(--pri)}
.crm .btn .badge{min-width:18px;height:18px;border-radius:9px;background:var(--late);color:#fff;font-size:10.5px;font-weight:600;display:grid;place-items:center;padding:0 5px;font-family:var(--mono)}
.crm .sel{height:36px;border:1px solid var(--line);border-radius:8px;background:var(--card);padding:0 30px 0 12px;font-weight:600;color:var(--pri)}
.crm .savest{font-size:11.5px;color:var(--ink-3);min-width:64px;text-align:right}
.crm .savest.err{color:var(--late);font-weight:600}
.crm .ring{width:22px;height:22px}
.crm .ring circle{fill:none;stroke-width:3.5}
.crm .lbl{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-3);font-weight:500}

.crm .board{flex:1;min-height:0;background:var(--card);border:1px solid var(--line);border-radius:12px;display:flex;flex-direction:column;overflow:hidden}
.crm .tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 12px;border-bottom:1px solid var(--line)}
.crm .seg{display:inline-flex;background:var(--bg);border-radius:8px;padding:3px;height:34px}
.crm .seg button{border:0;background:none;padding:0 12px;font-size:12.5px;color:var(--ink-2);border-radius:6px}
.crm .seg button.on{background:#fff;color:var(--pri);font-weight:600;box-shadow:0 1px 2px rgba(19,38,73,.12)}
.crm .search{display:flex;align-items:center;gap:6px;background:var(--bg);border-radius:8px;height:34px;padding:0 10px;width:210px}
.crm .search:focus-within{background:#fff;box-shadow:inset 0 0 0 1px var(--pri)}
.crm .search input{border:0;outline:0;flex:1;min-width:0;background:transparent;font-size:13px}
.crm .search svg{width:14px;height:14px;color:var(--ink-3)}
.crm .fpill{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 6px 0 10px;border-radius:99px;background:var(--run-bg);color:var(--pri);font-size:12px;font-weight:500;margin-right:6px}
.crm .fpill button{border:0;background:none;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;color:inherit;padding:0}
.crm .fpill button:hover{background:rgba(42,79,150,.12)}
.crm .tools .sp{flex:1}
.crm .tools .btn{height:34px}
.crm .tools .btn.ic{width:34px}

/* linha do tempo */
.crm .tl{flex:1;min-height:0;overflow:auto;position:relative}
.crm .tl-in{position:relative}
.crm .row{display:flex;height:var(--rh)}
.crm .lc{position:sticky;left:0;z-index:4;width:var(--lw);flex:none;background:var(--card);border-right:1px solid var(--line);display:flex;align-items:center;gap:8px;padding-right:10px}
.crm .tc{position:relative;flex:none;height:100%;z-index:1}
.crm .row.grp{border-top:1px solid var(--line-2)}
.crm .row.grp .lc{background:var(--card)}
.crm .hd{height:60px;position:sticky;top:0;z-index:6;background:#fff;border-bottom:1px solid var(--line)}
.crm .hd .lc{background:#fff;padding-left:16px}
/* Meses: cabeçalho branco com uma linha de divisa limpa; o mês atual só muda a cor do texto. */
.crm .hd .m{position:absolute;top:0;height:30px;padding:0 12px;display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:var(--ink);background:#fff;border-left:1px solid #C5CEDD;border-bottom:1px solid var(--line);white-space:nowrap;overflow:hidden}
.crm .hd .m.now{color:var(--pri)}
.crm .hd .m small{font-weight:400;color:var(--ink-3);font-size:11.5px}
.crm .hd .w{position:absolute;bottom:7px;font-size:10.5px;color:#9AA5B8;font-family:var(--mono);transform:translateX(-50%);line-height:1}
.crm .hd .w.mon{color:var(--ink-2);font-weight:500;font-size:11px}
.crm .hd .w.mon::before{content:"";position:absolute;left:50%;top:-8px;width:1px;height:5px;background:#C5CEDD}
.crm .hd .w.tod{background:var(--gold);color:var(--pri-dd);font-weight:700;border-radius:99px;padding:3px 5px;bottom:4px;z-index:3}
.crm .hd .w.tod::before{display:none}

.crm .ov{position:absolute;top:0;bottom:0;pointer-events:none;z-index:0}
.crm .ov .we{position:absolute;top:0;bottom:0;background:rgba(140,152,173,.045)}
.crm .ov .vl{position:absolute;top:0;bottom:0;width:1px;background:var(--line-2)}
.crm .ov .ml{position:absolute;top:0;bottom:0;width:1px;background:#C5CEDD}
.crm .ov .today{position:absolute;top:0;bottom:0;width:2px;background:var(--gold);z-index:3}

.crm .lc .cv{width:18px;height:18px;border:0;background:none;display:grid;place-items:center;color:var(--ink-3);border-radius:4px;padding:0}
.crm .lc .cv:hover{background:var(--line-2);color:var(--ink)}
.crm .lc .cv svg{width:12px;height:12px;transition:transform .15s}
.crm .lc .cv.closed svg{transform:rotate(-90deg)}
.crm .lc .cvs{width:18px;flex:none}
.crm .lc .id{font-family:var(--mono);font-size:11.5px;color:var(--ink-3);flex:none;min-width:26px}
.crm .row.grp .lc .id{color:var(--pri)}
.crm .lc .tt{flex:1;min-width:0;border:0;background:none;padding:0;text-align:left;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ink-2)}
.crm .row.d0 .lc .tt{font-size:14px;font-weight:600;color:var(--pri-dd)}
.crm .row.d0 .lc .id{font-size:12.5px;font-weight:600;color:var(--pri)}
.crm .row.d0{height:46px}
.crm .row.d0 .gb{top:12px}.crm .row.d0 .gg{top:19px}
.crm .row.grp:not(.d0) .lc .tt{font-weight:600;color:var(--ink)}
.crm .row.grp.fold .lc{background:#F7F8FA}
.crm .row.grp.fold .lc .tt{font-weight:700}
.crm .lc .kc{flex:none;font:600 10.5px var(--mono);color:var(--pri);background:var(--run-bg);border-radius:99px;padding:1px 7px}
.crm .row.dr:hover .lc{background:#FBF5EA;box-shadow:inset 3px 0 0 var(--gold)}
.crm .row.dr:hover .lc .tt{color:#6E5222}
.crm .row.dr:hover .lc .act{opacity:1}
.crm .row.dr:hover .gb{box-shadow:0 0 0 2px #fff,0 0 0 4px #D1AE6E}
.crm .row.dr:hover .gb.is-late{box-shadow:0 0 0 2px var(--late),0 0 0 4px rgba(192,57,43,.25)}
.crm .row.dr:hover .gg{box-shadow:0 0 0 2px #fff,0 0 0 3.5px #D1AE6E}
.crm .lc .tt:hover{color:var(--pri)}
.crm .lc .tt-ed{flex:1;min-width:0;height:28px;border:1px solid var(--pri);border-radius:6px;padding:0 7px;font-size:13px;outline:0;background:#fff}
.crm .sd{width:22px;height:22px;border:0;background:none;border-radius:50%;display:grid;place-items:center;padding:0;flex:none}
.crm .sd i{width:10px;height:10px;border-radius:50%;display:block}
.crm button.sd:hover{background:var(--line-2)}
.crm .sd svg{width:13px;height:13px;color:var(--lock)}
.crm .sd.is-late i{box-shadow:0 0 0 2px #fff,0 0 0 3.5px var(--late)}
.crm .sd .d-concluido{background:var(--ok)}.crm .sd .d-andamento{background:var(--run)}.crm .sd .d-aguardando{background:var(--gold)}.crm .sd .d-pendente{background:#C3CAD6}
.crm .lc .pc{font-family:var(--mono);font-size:11px;color:var(--ink-3);flex:none}
.crm .lc .act{width:26px;height:26px;border:0;border-radius:6px;background:none;display:grid;place-items:center;color:var(--ink-3);flex:none;padding:0;opacity:0}
.crm .lc .act svg{width:15px;height:15px}
.crm .row:hover .lc .act,.crm .lc .act:focus-visible{opacity:1}
.crm .lc .act:hover{background:var(--run-bg);color:var(--pri)}

.crm .gb{position:absolute;top:10px;height:22px;border-radius:6px;border:0;padding:0;display:block;cursor:grab;touch-action:none;user-select:none}
.crm .gb:active{cursor:grabbing}
.crm .gb .h{position:absolute;top:0;bottom:0;width:8px;cursor:ew-resize}
.crm .gb .h.l{left:0}.crm .gb .h.r{right:0}
.crm .gb .h::after{content:"";position:absolute;top:5px;bottom:5px;width:2px;border-radius:2px;background:rgba(255,255,255,.75);opacity:0;transition:opacity .1s}
.crm .gb .h.l::after{left:3px}.crm .gb .h.r::after{right:3px}
.crm .gb:hover .h::after{opacity:1}
.crm .gb .in{position:absolute;left:9px;top:0;bottom:0;display:flex;align-items:center;font-size:10.5px;font-weight:600;color:#fff;white-space:nowrap;pointer-events:none}
.crm .gb.out .in{left:calc(100% + 6px);color:var(--ink-2);font-weight:500}
.crm .gb .in small,.crm .gg .in small{font-weight:400;opacity:.8;margin-left:5px}
.crm .gb.out .in small{opacity:1;color:var(--ink-3)}
.crm .gb.is-late{box-shadow:0 0 0 2px var(--late)}
.crm .gb.drag{box-shadow:0 4px 14px rgba(19,38,73,.28);z-index:3}
.crm .gtip{position:absolute;top:-24px;left:0;background:var(--pri-dd);color:#fff;font:500 11px var(--mono);padding:2px 7px;border-radius:4px;white-space:nowrap;pointer-events:none}
.crm .b-concluido{background:var(--ok)} .crm .b-andamento{background:var(--run)} .crm .b-aguardando{background:var(--gold)} .crm .b-aguardando .in{color:var(--pri-dd)}
.crm .b-pendente{background:#B4BDCC} .crm .b-bloqueado{background:repeating-linear-gradient(135deg,#CDD3DE 0 6px,#E0E4EB 6px 12px)} .crm .b-bloqueado .in{color:var(--ink-2)}
.crm .gg{position:absolute;top:17px;height:8px;border-radius:4px;background:#D6DDEA;border:0;padding:0;cursor:pointer;overflow:visible}
.crm .gg .fill{position:absolute;left:0;top:0;bottom:0;background:var(--pri-d);border-radius:4px}
.crm .gg .in{position:absolute;left:calc(100% + 8px);top:-5px;font-size:10.5px;color:var(--ink-2);white-space:nowrap;font-weight:600}
.crm .gd{position:absolute;top:10px;height:22px;padding:0 10px;border:1px dashed #B8C3D6;border-radius:6px;background:#fff;color:var(--ink-3);font-size:11px;font-weight:500;white-space:nowrap;opacity:.7}
.crm .row.d0 .gd{top:12px}
.crm .gd:hover,.crm .row.dr:hover .gd{opacity:1;border-color:var(--pri);color:var(--pri)}
.crm .empty-state{padding:40px;text-align:center;color:var(--ink-3)}
.crm .legend{display:flex;flex-wrap:wrap;gap:4px 14px;padding:8px 14px;border-top:1px solid var(--line);font-size:11.5px;color:var(--ink-3);align-items:center}
.crm .legend i{display:inline-block;width:12px;height:7px;border-radius:2px;margin-right:5px;vertical-align:middle}

/* chips */
.crm .chip{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 9px;border-radius:99px;font-size:12px;font-weight:500;border:0;white-space:nowrap}
.crm .chip .dot{width:7px;height:7px;border-radius:50%}
.crm .st-concluido{background:var(--ok-bg);color:var(--ok)} .crm .st-concluido .dot{background:var(--ok)}
.crm .st-andamento{background:var(--run-bg);color:var(--run)} .crm .st-andamento .dot{background:var(--run)}
.crm .st-aguardando{background:var(--wait-bg);color:var(--wait)} .crm .st-aguardando .dot{background:var(--wait)}
.crm .st-pendente{background:var(--pend-bg);color:var(--pend)} .crm .st-pendente .dot{background:#A7B1C2}
.crm .st-bloqueado{background:#fff;color:var(--lock);box-shadow:inset 0 0 0 1px var(--line)} .crm .st-bloqueado .dot{background:transparent;border:1.5px solid var(--lock)}
.crm .late{display:inline-flex;align-items:center;height:18px;padding:0 6px;border-radius:4px;background:var(--late-bg);color:var(--late);font-size:10.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase}
.crm .resp{display:inline-flex;gap:4px;flex-wrap:wrap}
.crm .resp span{font-size:10.5px;font-weight:600;letter-spacing:.05em;padding:2px 6px;border-radius:4px;background:var(--gold-l);color:#80622A}
.crm .resp span.gt3{background:var(--run-bg);color:var(--pri)}
.crm .dep{font-size:11.5px;color:var(--lock);display:inline-flex;gap:4px;align-items:center}
.crm .dep svg{width:12px;height:12px}

/* painel de status */
.crm .sp-panel{position:fixed;z-index:251;top:72px;right:24px;width:min(820px,calc(100vw - 32px));max-height:calc(100vh - 96px);background:#fff;border:1px solid var(--line);border-radius:14px;box-shadow:0 20px 50px rgba(19,38,73,.2);display:flex;flex-direction:column;overflow:hidden}
.crm .sp-h{display:flex;align-items:center;gap:22px;padding:18px 20px;border-bottom:1px solid var(--line);flex-wrap:wrap}
.crm .sp-h .bigring{width:64px;height:64px;position:relative;flex:none}
.crm .sp-h .bigring svg{width:64px;height:64px}
.crm .sp-h .bigring circle{fill:none;stroke-width:6}
.crm .sp-h .bigring b{position:absolute;inset:0;display:grid;place-items:center;font:600 15px var(--mono);color:var(--pri)}
.crm .sp-h .info{flex:1;min-width:200px;display:flex;flex-direction:column;gap:4px}
.crm .sp-h .info strong{font-size:15px;font-weight:600}
.crm .meta{display:flex;gap:4px 16px;flex-wrap:wrap;font-size:12.5px;color:var(--ink-2)}
.crm .meta b{color:var(--ink);font-weight:600}
.crm .counts{display:flex;gap:6px;flex-wrap:wrap;padding:12px 20px;border-bottom:1px solid var(--line);background:var(--tint)}
.crm .count{border:0;border-radius:99px;padding:0 12px 0 8px;height:30px;display:inline-flex;align-items:center;gap:7px;background:#fff;box-shadow:inset 0 0 0 1px var(--line);font-size:12.5px;color:var(--ink-2)}
.crm .count strong{font-family:var(--mono);font-weight:600;color:var(--ink)}
.crm .count:hover{box-shadow:inset 0 0 0 1px #B9C3D4}
.crm .count .dot{width:8px;height:8px;border-radius:50%}
.crm .count.zero{opacity:.55}
.crm .sp-b{display:grid;grid-template-columns:250px 1fr;min-height:0;flex:1;overflow:hidden}
.crm .elist{border-right:1px solid var(--line);overflow:auto;padding:8px}
.crm .eitem{display:grid;grid-template-columns:22px 1fr;gap:2px 10px;width:100%;text-align:left;border:0;background:none;padding:9px 10px;border-radius:8px;align-items:start}
.crm .eitem:hover{background:var(--tint)}
.crm .eitem.pick{background:var(--run-bg)}
.crm .eitem .n{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font:600 11px var(--mono);border:2px solid var(--line);color:var(--ink-3);background:#fff}
.crm .eitem.s-concluido .n{background:var(--ok);border-color:var(--ok);color:#fff}
.crm .eitem.s-andamento .n,.crm .eitem.s-aguardando .n{border-color:var(--pri);color:var(--pri)}
.crm .eitem.cur .n{background:var(--pri);border-color:var(--pri);color:#fff}
.crm .eitem .t{font-size:13px;line-height:1.3;color:var(--ink)}
.crm .eitem .r{grid-column:2;font-size:11px;color:var(--ink-3);display:flex;align-items:center;gap:8px}
.crm .eitem .mb{flex:1;height:4px;border-radius:2px;background:var(--line);overflow:hidden;max-width:80px}
.crm .eitem .mb i{display:block;height:100%;background:var(--ok)}
.crm .snapwrap{overflow:auto;padding:16px;background:var(--bg);display:flex;flex-direction:column;gap:10px}
.crm .snapbar{display:flex;align-items:center;gap:8px}
.crm .snapbar .lbl{flex:1}

/* card da etapa (área do print) */
.crm .focus{background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden}
.crm .focus-h{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;padding:14px 16px;border-bottom:1px solid var(--line)}
.crm .focus-h .t{flex:1 1 100%}
.crm .focus-h .t .lbl{color:var(--wait)}
.crm .focus-h h2{margin:2px 0 0;font-size:16px;font-weight:600;text-wrap:balance}
.crm .focus-h .rng{font-size:12px;color:var(--ink-2)}
.crm .focus-b{padding:4px 16px 10px}
.crm .fitem{display:grid;grid-template-columns:40px 1fr auto;gap:4px 12px;padding:10px 0;border-bottom:1px dashed var(--line)}
.crm .fitem:last-child{border-bottom:0}
.crm .fitem .n{font-family:var(--mono);color:var(--ink-3);font-size:12px;padding-top:1px}
.crm .fitem .d b{font-weight:500;font-size:13px}
.crm .fitem .d p{margin:3px 0 0;font-size:12px;color:var(--ink-2)}
.crm .fitem .r{display:flex;flex-direction:column;align-items:flex-end;gap:4px;font-size:11.5px;color:var(--ink-2)}
.crm .focus-f{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:8px 16px;border-top:1px solid var(--line);font-size:10.5px;color:var(--ink-3);background:#FBFCFE}
.crm .snaphost{position:fixed;left:-10000px;top:0;width:1600px}
/* destaque do período (durante o arraste) */
.crm .ov .hl{position:absolute;top:0;bottom:0;background:rgba(209,174,110,.13);border-left:1.5px dashed #B8924F;border-right:1.5px dashed #B8924F;z-index:2}
.crm .hd .hmk{position:absolute;bottom:3px;background:#8A6A2E;color:#fff;font:600 10.5px var(--mono);padding:2px 6px;border-radius:4px;z-index:4;white-space:nowrap}
.crm .hd .hmk.a{transform:translateX(calc(-100% - 3px))}
.crm .hd .hmk.b{transform:translateX(3px)}
.crm .hd .hmk small{font-weight:400;opacity:.75;margin-left:4px}
/* relatório (print do cronograma) */
.crm .rep{width:1600px;background:#fff;color:#1A2233;font:12px/17px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.crm .rep-h{background:#132649;color:#fff;padding:18px 24px;display:flex;align-items:center;gap:24px;border-bottom:4px solid #D1AE6E}
.crm .rep-h .t{flex:1}
.crm .rep-h h1{margin:0;font-size:20px;font-weight:600;color:#fff}
.crm .rep-h .sub{color:#B9C6DE;font-size:12.5px;margin-top:2px}
.crm .rep-h .pct{text-align:right}
.crm .rep-h .pct b{display:block;font:600 28px var(--mono);color:#D1AE6E;line-height:1}
.crm .rep-h .pct span{font-size:11px;color:#B9C6DE}
.crm .rep-s{display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center;padding:12px 24px;border-bottom:1px solid #E4E8F0;background:#F8FAFD;font-size:12px;color:#4A5568}
.crm .rep-s b{color:#1A2233}
.crm .rep-s .c{display:inline-flex;align-items:center;gap:6px}
.crm .rep-s .c i{width:9px;height:9px;border-radius:50%}
.crm .rep-s .sp{flex:1}
.crm .rep table{width:100%;border-collapse:collapse;table-layout:fixed}
.crm .rep th{background:#2A4F96;color:#fff;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;font-weight:600;text-align:left;padding:8px 8px;vertical-align:bottom}
.crm .rep td{padding:7px 8px;border-bottom:1px solid #EDF0F6;vertical-align:middle;font-size:12px}
.crm .rep td.id{font-family:var(--mono);color:#8C98AD;font-size:11px;border-left:3px solid #E4EAF5}
/* hierarquia: etapa (nível 0) > subetapa com filhos (nível 1+) > item */
.crm .rep tr.g.d0 td{background:#DCE6F7;border-top:2px solid #2A4F96;border-bottom:1px solid #B8C9E8;font-size:13px;font-weight:700;color:#132649;padding-top:10px;padding-bottom:10px}
.crm .rep tr.g.d0 td.id{border-left:6px solid #2A4F96;color:#2A4F96;font-size:12.5px}
.crm .rep tr.g.d1 td,.crm .rep tr.g.d2 td{background:#F1F5FB;border-top:1px solid #C9D6EE;border-bottom:1px solid #DCE4F2;font-weight:600;color:#1B3468}
.crm .rep tr.g.d1 td.id,.crm .rep tr.g.d2 td.id{border-left:3px solid #7F9AD0;color:#2A4F96}
.crm .rep tr.l td{background:#fff}
.crm .rep tr.l td.id{color:#5E6B84}
.crm .rep .tw{color:#A9B4C8;margin-right:6px;font-family:var(--mono)}
.crm .rep .gt{line-height:18px}
.crm .rep .cnt{margin-top:3px;font-size:10.5px;line-height:14px;font-weight:600;letter-spacing:0;text-transform:none;color:#2A4F96}
.crm .rep td.dt{font-family:var(--mono);font-size:11px;white-space:nowrap}
.crm .rep td.ob{font-size:11px;color:#4A5568}
.crm .rep .gc{position:relative;height:18px}
.crm .rep .gc .ml{position:absolute;top:-8px;bottom:-8px;width:1px;background:#E4E8F0}
.crm .rep .gc .td{position:absolute;top:-8px;bottom:-8px;width:2px;background:#D1AE6E}
.crm .rep .gc .br{position:absolute;top:3px;height:12px;border-radius:3px}
.crm .rep .gc .br.gp{top:6px;height:6px;background:#D6DDEA}
.crm .rep .gc .br.gp i{position:absolute;left:0;top:0;bottom:0;background:#1B3468;border-radius:3px}
.crm .rep .gc .br.lt{box-shadow:0 0 0 1.5px #C0392B}
.crm .rep .gh{position:relative;height:14px}
.crm .rep .gh span{position:absolute;bottom:0;padding-left:4px;border-left:1px solid rgba(255,255,255,.35)}
.crm .rep .pill{display:inline-block;padding:2px 9px;border-radius:99px;font-size:11px;line-height:16px;font-weight:600;white-space:nowrap;vertical-align:middle}
.crm .rep .late{margin-left:4px}
.crm .rep-f{display:flex;flex-wrap:wrap;gap:6px 16px;justify-content:space-between;padding:10px 24px;font-size:11px;color:#8C98AD;border-top:1px solid #E4E8F0}
.crm .rep-f .lg{display:flex;gap:14px;flex-wrap:wrap}
.crm .rep-f .lg i{display:inline-block;width:12px;height:7px;border-radius:2px;margin-right:5px;vertical-align:middle}

/* menus */
.crm .menu{position:fixed;z-index:260;background:#fff;border:1px solid var(--line);border-radius:10px;box-shadow:0 12px 32px rgba(19,38,73,.16);padding:5px;display:flex;flex-direction:column;min-width:210px}
.crm .menu .mh{font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-3);padding:6px 9px 3px}
.crm .menu .mn{font-size:12px;color:var(--ink-3);padding:3px 9px 6px}
.crm .menu button{display:flex;align-items:center;gap:9px;border:0;background:none;padding:8px 9px;border-radius:6px;text-align:left;font-size:13px}
.crm .menu button:hover{background:var(--bg)}
.crm .menu button.on{font-weight:600}
.crm .menu button svg{width:15px;height:15px;color:var(--ink-3)}
.crm .menu kbd{margin-left:auto;font-family:var(--mono);font-size:10.5px;color:var(--ink-3)}
.crm .menu hr{border:0;border-top:1px solid var(--line-2);margin:4px 2px}
.crm .menu .danger{color:var(--late)}
.crm .menu .ck{margin-left:auto;color:var(--pri);font-weight:700}

/* drawer */
.crm .scrim{position:fixed;inset:0;background:rgba(19,38,73,.28);z-index:250}
.crm .scrim.clear{background:transparent}
.crm .drawer{position:fixed;top:0;right:0;bottom:0;width:min(460px,100%);background:#fff;z-index:251;display:flex;flex-direction:column;box-shadow:-10px 0 30px rgba(19,38,73,.14)}
.crm .drawer.modal{top:50%;right:auto;bottom:auto;left:50%;transform:translate(-50%,-50%);width:min(440px,calc(100vw - 32px));max-height:calc(100vh - 48px);border-radius:14px;box-shadow:0 20px 50px rgba(19,38,73,.28)}
.crm .drawer header{padding:16px 18px;border-bottom:1px solid var(--line);display:flex;gap:10px;align-items:flex-start}
.crm .drawer header h3{margin:0;font-size:16px;font-weight:600;flex:1}
.crm .drawer header .n{font-family:var(--mono);color:var(--pri);font-size:13px;margin-bottom:2px}
.crm .x{border:0;background:none;width:30px;height:30px;border-radius:6px;display:grid;place-items:center;color:var(--ink-3)}
.crm .x:hover{background:var(--bg)}
.crm .drawer .body{flex:1;overflow:auto;padding:16px 18px;display:flex;flex-direction:column;gap:14px}
.crm .f{display:flex;flex-direction:column;gap:5px}
.crm .f input[type=text],.crm .f input[type=date],.crm .f textarea{border:1px solid var(--line);border-radius:7px;padding:7px 9px;font-size:13px;width:100%;background:#fff}
.crm .f textarea{min-height:64px;resize:vertical}
.crm .ro{font-size:13px;color:var(--ink-2)}
.crm .row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.crm .pills{display:flex;flex-wrap:wrap;gap:6px}
.crm .pills button{border:1px solid var(--line);background:#fff;border-radius:99px;height:28px;padding:0 11px;font-size:12.5px;color:var(--ink-2)}
.crm .pills button.on{background:var(--pri);border-color:var(--pri);color:#fff}
.crm .pills.st button.on.st-concluido{background:var(--ok);border-color:var(--ok)}
.crm .pills.st button.on.st-aguardando{background:var(--gold);border-color:var(--gold);color:var(--pri-dd)}
.crm .pills.st button.on.st-pendente{background:var(--pend);border-color:var(--pend)}
.crm .splitbox{border:1px dashed var(--line);border-radius:8px;padding:10px 12px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;background:#FBFCFE}
.crm .splitbox span{font-size:12.5px;color:var(--ink-2);flex:1;min-width:160px}
.crm .splitbox .btn{height:30px;padding:0 10px;font-size:12.5px}
.crm .hist{display:flex;flex-direction:column;border-left:2px solid var(--line);margin-left:4px}
.crm .hist div{padding:0 0 12px 14px;position:relative;font-size:12.5px}
.crm .hist div::before{content:"";position:absolute;left:-6px;top:4px;width:10px;height:10px;border-radius:50%;background:#fff;border:2px solid var(--gold)}
.crm .hist small{display:block;color:var(--ink-3);font-size:11px;font-family:var(--mono)}
.crm .cmt{display:flex;gap:6px}
.crm .cmt input{flex:1;border:1px solid var(--line);border-radius:7px;padding:0 9px;height:32px;font-size:13px;background:#fff}
.crm .drawer footer{padding:12px 18px;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:8px}
.crm .btn.danger{color:var(--late)}
.crm .btn.danger.arm{background:var(--late);border-color:var(--late);color:#fff}
.crm .btn.sm{height:30px;padding:0 10px;font-size:12.5px}
.crm .btn.sm.ic{width:30px;padding:0}
.crm .sel.plain{width:100%;font-weight:500;color:var(--ink);padding:0 12px}
.crm .drawer.modal.wide{width:min(560px,calc(100vw - 32px))}
.crm .tag-modelo{display:inline-flex;align-items:center;vertical-align:middle;margin-left:10px;height:22px;padding:0 9px;border-radius:99px;background:var(--run-bg);color:var(--pri);font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase}
.crm .mbanner{margin:0 0 12px;padding:10px 14px;border:1px solid #C9D6EE;border-radius:10px;background:var(--tint);font-size:12.5px;color:var(--ink-2);line-height:1.5}
.crm .mbanner code{font-family:var(--mono);font-size:11.5px;background:#fff;border:1px solid var(--line);border-radius:4px;padding:0 4px}
.crm .mlist{display:flex;flex-direction:column;border:1px solid var(--line);border-radius:10px;overflow:hidden}
.crm .mrow{display:flex;align-items:center;gap:12px;padding:12px 14px;background:#fff}
.crm .mrow + .mrow{border-top:1px solid var(--line)}
.crm .mrow .mi{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.crm .mrow .mi b{font-size:14px;font-weight:600;color:var(--ink)}
.crm .mrow .mi span{font-size:12px;color:var(--ink-3)}
.crm .mrow .ma{display:flex;gap:6px;flex:none}
.crm .fhint{font-size:11.5px;color:var(--ink-3)}
.crm .ferr{font-size:12.5px;font-weight:600;color:var(--late)}

.crm .toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);background:var(--pri-dd);color:#fff;padding:10px 16px;border-radius:8px;font-size:13px;z-index:270;box-shadow:0 8px 24px rgba(0,0,0,.2);display:flex;gap:10px;align-items:center}
.crm .toast i{width:8px;height:8px;border-radius:50%;background:var(--gold)}

.crm .blank{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:var(--card);border:1px dashed var(--line);border-radius:12px;color:var(--ink-3);padding:40px;text-align:center}

@media (max-width:900px){.crm .sp-b{grid-template-columns:1fr;overflow:auto}.crm .elist{border-right:0;border-bottom:1px solid var(--line);overflow:visible}.crm .snapwrap{overflow:visible}}
@media (max-width:760px){.crm .search{width:100%;order:9}.crm .btn .hide-sm{display:none}.crm .sp-panel{top:16px;right:16px}.crm .fitem{grid-template-columns:34px 1fr}.crm .fitem .r{grid-column:2;align-items:flex-start;flex-direction:row;flex-wrap:wrap}.crm .lc .act{opacity:1}}
@media (prefers-reduced-motion:no-preference){.crm .drawer:not(.modal){animation:crm-sl .18s ease-out}.crm .sp-panel{animation:crm-fd .15s ease-out}@keyframes crm-sl{from{transform:translateX(24px);opacity:.6}}@keyframes crm-fd{from{transform:translateY(-6px);opacity:.5}}}
`
