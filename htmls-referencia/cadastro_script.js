
(function(){
  // SEED_DATA omitted
  const SEGMENTS = ['Bertolini','Marcopolo','FCC','Auto/Componentes','Alimentos/Bebidas','Indústria Geral','Outros'];
  const SEGMENT_COLORS = {
    'Bertolini':'#D1AE6E',
    'Marcopolo':'#40C8B4',
    'FCC':'#C8A0E6',
    'Auto/Componentes':'#8C6EDC',
    'Alimentos/Bebidas':'#96D25A',
    'Indústria Geral':'#E8C896',
    'Outros':'#E15A5A'
  };
  const ALL_KEY = '__ALL__';

  let companies = SEED_DATA.map(c => Object.assign({}, c));
  let activeSegment = ALL_KEY;
  let currentId = null;
  let searchTerm = '';

  const segmentsEl = document.getElementById('cadSegments');
  const cardsEl = document.getElementById('cadCards');
  const pinnedLabel = document.getElementById('cadPinnedLabel');
  const emptyEl = document.getElementById('cadEmpty');
  const detailEl = document.getElementById('cadDetail');
  const fieldsEl = document.getElementById('cadFields');
  const toast = document.getElementById('cadToast');
  const crumb = document.getElementById('cadCrumb');

  function escapeHtml(s){
    return String(s==null?'':s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function getFirst(c, regex){
    const f = c.fields.find(x => x.type==='text' && regex.test(x.label));
    return f ? f.value : '';
  }
  function getContactName(c){ return (getFirst(c, /CONTATO/i) || '').split('\n')[0].trim(); }
  function getEmailFirst(c){
    const v = getFirst(c, /E[- ]?MAIL/i) || '';
    const parts = v.split(/[\n;]/).map(s=>s.trim()).filter(Boolean);
    return parts[0] || '';
  }
  function getAuthTag(c){
    const v = getFirst(c, /AUTORIZA/i);
    if (!v) return null;
    return /^sim/i.test(v.trim()) ? {label:'Autorizado', cls:''} : {label:'Verificar', cls:'warn'};
  }

  function countBySegment(filter){
    const term = (filter||'').trim().toLowerCase();
    const counts = {};
    counts[ALL_KEY] = 0;
    SEGMENTS.forEach(s => counts[s] = 0);
    companies.forEach(c => {
      if (term && !companyMatches(c, term)) return;
      counts[ALL_KEY]++;
      if (counts[c.segment] != null) counts[c.segment]++;
      else counts[c.segment] = (counts[c.segment]||0) + 1;
    });
    return counts;
  }

  function companyMatches(c, term){
    if (!term) return true;
    const blob = [
      c.name, c.segment,
      ...c.fields.map(f => {
        if (f.type==='text') return (f.label||'') + ' ' + (f.value||'');
        return (f.label||'') + ' ' + (f.headers||[]).join(' ') + ' ' + (f.rows||[]).map(r => r.join(' ')).join(' ');
      })
    ].join(' ').toLowerCase();
    return blob.indexOf(term) !== -1;
  }

  function renderSegments(){
    const counts = countBySegment(searchTerm);
    const segs = [ALL_KEY].concat(SEGMENTS.filter(s => (counts[s]||0) > 0 || companies.some(c => c.segment===s)));
    let html = '';
    segs.forEach(s => {
      const lbl = s===ALL_KEY ? 'Todas' : s;
      const cnt = counts[s]||0;
      const dot = s===ALL_KEY ? '#D1AE6E' : (SEGMENT_COLORS[s] || '#8C6EDC');
      html += `<button class="cad-seg ${activeSegment===s?'active':''}" onclick="setSegment('${s}')">
        <span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${dot}"></span>
        ${escapeHtml(lbl)} <span class="cad-seg-count">${cnt}</span>
      </button>`;
    });
    segmentsEl.innerHTML = html;
  }

  function renderCards(){
    const term = searchTerm.trim().toLowerCase();
    const list = companies
      .filter(c => activeSegment===ALL_KEY ? true : c.segment===activeSegment)
      .filter(c => companyMatches(c, term))
      .sort((a,b) => a.name.localeCompare(b.name,'pt-BR'));

    pinnedLabel.textContent = (activeSegment===ALL_KEY ? 'Todas as contratantes' : 'Segmento: ' + activeSegment) + ' · ' + list.length + (list.length===1?' contratante':' contratantes');

    if (!list.length){
      cardsEl.innerHTML = '<div class="cad-empty">Nenhuma contratante neste filtro. Tente outro segmento ou termo de busca.</div>';
      return;
    }
    let html = '';
    list.forEach(c => {
      const ct = getContactName(c);
      const em = getEmailFirst(c);
      const auth = getAuthTag(c);
      const dot = SEGMENT_COLORS[c.segment] || '#8C6EDC';
      html += `<div class="cad-card ${currentId===c.id?'active':''}" onclick="openCompany('${c.id}')">
        <div class="cad-card-name" title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</div>
        <div class="cad-card-sub" title="${escapeHtml(ct||em||c.segment)}">${escapeHtml(ct || em || c.segment)}</div>
        <div class="cad-card-meta">
          <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${dot}"></span>
          ${auth ? `<span class="cad-tag ${auth.cls}">${auth.label}</span>` : ''}
        </div>
      </div>`;
    });
    cardsEl.innerHTML = html;
  }

  window.setSegment = function(s){
    activeSegment = s;
    renderSegments();
    renderCards();
  };

  window.filterAll = function(q){
    searchTerm = q || '';
    renderSegments();
    renderCards();
  };

  window.openCompany = function(id){
    currentId = id;
    const c = companies.find(x => x.id===id);
    if (!c) return;
    emptyEl.style.display = 'none';
    detailEl.style.display = 'block';
    const dot = SEGMENT_COLORS[c.segment] || '#8C6EDC';
    document.getElementById('cadDetailTitle').innerHTML = escapeHtml(c.name) + 
      ` <span class="cad-tag" style="background:${dot}33;color:#fff;border-color:${dot}66">${escapeHtml(c.segment)}</span>`;
    const txtCount = c.fields.filter(f=>f.type==='text').length;
    const tblCount = c.fields.filter(f=>f.type==='table').length;
    document.getElementById('cadDetailSub').textContent =
      `Ficha editável · ${txtCount} campos${tblCount?' · '+tblCount+' tabela(s)':''} · atualizada em ${c.updated}`;
    crumb.innerHTML = `Cadastro contratantes · <b>${escapeHtml(c.name)}</b>`;
    renderFields(c);
    renderCards(); // re-renderiza para destacar card ativo
  };

  function renderFields(c){
    fieldsEl.innerHTML = '';
    if (!c.fields.length){
      fieldsEl.innerHTML = '<div class="cad-empty" style="border:1px dashed rgba(140,110,220,0.25);border-radius:10px">Nenhum campo. Use os botões abaixo para adicionar.</div>';
      return;
    }
    c.fields.forEach((f, idx) => {
      const row = document.createElement('div');
      row.className = 'cad-field' + (f.type==='table' ? ' cad-field-table' : '');
      if (f.type==='text'){
        row.innerHTML = `
          <div class="cad-field-label" contenteditable spellcheck="false" data-idx="${idx}" data-key="label">${escapeHtml(f.label)}</div>
          <div class="cad-field-value" data-idx="${idx}" data-key="value">${renderTextLines(f.value, idx)}</div>
          <div class="cad-field-actions">
            <button class="cad-icon-btn" onclick="editTextField(${idx})" title="Editar valor">✎</button>
            <button class="cad-icon-btn" onclick="moveField(${idx},-1)" title="Subir">▲</button>
            <button class="cad-icon-btn" onclick="moveField(${idx},1)" title="Descer">▼</button>
            <button class="cad-icon-btn danger" onclick="removeField(${idx})" title="Excluir">✕</button>
          </div>`;
      } else {
        row.innerHTML = `
          <div class="cad-field-label" contenteditable spellcheck="false" data-idx="${idx}" data-key="label">${escapeHtml(f.label)}</div>
          <div class="cad-field-value">${renderTable(f, idx)}</div>
          <div class="cad-field-actions">
            <button class="cad-icon-btn" onclick="addTableRow(${idx})" title="Nova linha">＋ linha</button>
            <button class="cad-icon-btn" onclick="addTableCol(${idx})" title="Nova coluna">＋ col</button>
            <button class="cad-icon-btn" onclick="moveField(${idx},-1)" title="Subir">▲</button>
            <button class="cad-icon-btn" onclick="moveField(${idx},1)" title="Descer">▼</button>
            <button class="cad-icon-btn danger" onclick="removeField(${idx})" title="Excluir">✕</button>
          </div>`;
      }
      fieldsEl.appendChild(row);
    });
    attachLabelEditors();
    attachTableEditors();
  }

  function renderTextLines(value, idx){
    const lines = String(value||'').split('\n');
    if (lines.length === 1 && lines[0]==='') return '<span class="cad-line" style="color:rgba(232,236,245,0.35);font-style:italic">— vazio — (clique no ✎ para editar)</span>';
    return lines.map((ln,li) => {
      const isMail = /[\w.+-]+@[\w-]+\.[\w.-]+/.test(ln);
      // Linhas com múltiplos e-mails separados por ; vamos quebrar
      if (isMail && /;/.test(ln)) {
        return ln.split(';').map(s => s.trim()).filter(Boolean).map(s =>
          `<span class="cad-line ${/[\w.+-]+@[\w-]+\.[\w.-]+/.test(s)?'is-email':''}" data-copy="${escapeHtml(s)}" onclick="copyLine(this)">${escapeHtml(s)}</span>`
        ).join('');
      }
      return `<span class="cad-line ${isMail?'is-email':''}" data-copy="${escapeHtml(ln)}" onclick="copyLine(this)">${escapeHtml(ln)||'&nbsp;'}</span>`;
    }).join('');
  }

  function renderTable(f, idx){
    let html = '<table class="cad-mini-table"><thead><tr>';
    f.headers.forEach((h,hi) => {
      html += `<th contenteditable spellcheck="false" data-fidx="${idx}" data-hi="${hi}">${escapeHtml(h)}</th>`;
    });
    html += '<th style="width:30px;text-align:center"></th></tr></thead><tbody>';
    f.rows.forEach((r,ri) => {
      html += '<tr>';
      r.forEach((cell,ci) => {
        html += `<td data-fidx="${idx}" data-ri="${ri}" data-ci="${ci}" onclick="handleCellClick(event)" ondblclick="handleCellDbl(event)">${escapeHtml(cell)}</td>`;
      });
      // garantir que tem o mesmo nº de colunas que headers
      for (let k=r.length; k<f.headers.length; k++){
        html += `<td data-fidx="${idx}" data-ri="${ri}" data-ci="${k}" onclick="handleCellClick(event)" ondblclick="handleCellDbl(event)"></td>`;
      }
      html += `<td onclick="removeTableRow(${idx},${ri})" style="cursor:pointer;text-align:center;color:rgba(225,90,90,0.6);width:30px" title="Excluir linha">✕</td>`;
      html += '</tr>';
    });
    html += '</tbody></table>';
    return html;
  }

  function attachLabelEditors(){
    fieldsEl.querySelectorAll('[data-key="label"]').forEach(el => {
      el.addEventListener('blur', () => {
        const c = companies.find(x => x.id===currentId);
        c.fields[+el.dataset.idx].label = el.textContent.trim() || 'CAMPO';
      });
      el.addEventListener('keydown', e => { if (e.key==='Enter'){ e.preventDefault(); el.blur(); } });
    });
  }
  function attachTableEditors(){
    fieldsEl.querySelectorAll('th[data-fidx]').forEach(el => {
      el.addEventListener('blur', () => {
        const c = companies.find(x => x.id===currentId);
        c.fields[+el.dataset.fidx].headers[+el.dataset.hi] = el.textContent.trim();
      });
      el.addEventListener('keydown', e => { if (e.key==='Enter'){ e.preventDefault(); el.blur(); } });
    });
  }

  // Click numa linha de texto = copia
  window.copyLine = function(el){
    const txt = el.dataset.copy || el.textContent;
    if (!txt || txt.trim()==='') return;
    copyText(txt, el);
  };

  // Click numa célula da tabela = copia
  window.handleCellClick = function(e){
    const el = e.currentTarget;
    if (el.isContentEditable) return;
    const txt = (el.textContent||'').trim();
    if (txt) copyText(txt, el);
  };

  // Duplo-click numa célula = ativa edição
  window.handleCellDbl = function(e){
    const el = e.currentTarget;
    el.setAttribute('contenteditable','true');
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges(); sel.addRange(range);
    const onBlur = () => {
      const c = companies.find(x => x.id===currentId);
      c.fields[+el.dataset.fidx].rows[+el.dataset.ri][+el.dataset.ci] = el.textContent.trim();
      el.removeAttribute('contenteditable');
      el.removeEventListener('blur', onBlur);
    };
    el.addEventListener('blur', onBlur);
    el.addEventListener('keydown', e2 => { if (e2.key==='Enter' && !e2.shiftKey){ e2.preventDefault(); el.blur(); } });
  };

  // Editar campo de texto inteiro
  window.editTextField = function(idx){
    const c = companies.find(x => x.id===currentId);
    const cur = c.fields[idx].value || '';
    const novo = prompt('Editar valor do campo "'+c.fields[idx].label+'":\n\n(Use \\n para quebra de linha — ou cole texto multilinha diretamente)', cur);
    if (novo === null) return;
    c.fields[idx].value = novo.replace(/\\n/g,'\n');
    renderFields(c);
  };

  function copyText(text, el){
    const fn = navigator.clipboard && navigator.clipboard.writeText
      ? navigator.clipboard.writeText(text)
      : new Promise(res => {
          const ta = document.createElement('textarea');
          ta.value = text; ta.style.position='absolute'; ta.style.left='-9999px';
          document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); } catch(e){}
          document.body.removeChild(ta); res();
        });
    Promise.resolve(fn).then(() => {
      el.classList.add('copied');
      toast.textContent = 'Copiado: ' + (text.length > 50 ? text.slice(0,50)+'…' : text);
      toast.classList.add('show');
      setTimeout(() => { el.classList.remove('copied'); toast.classList.remove('show'); }, 1400);
    });
  }

  window.addField = function(type){
    const c = companies.find(x => x.id===currentId);
    if (!c) return;
    if (type==='text'){
      c.fields.push({type:'text', label:'NOVO CAMPO', value:''});
    } else {
      c.fields.push({type:'table', label:'NOVA TABELA', headers:['Coluna 1','Coluna 2','Coluna 3'], rows:[['','',''],['','','']]});
    }
    openCompany(c.id);
  };

  window.removeField = function(idx){
    const c = companies.find(x => x.id===currentId);
    if (!confirm('Excluir o campo "'+c.fields[idx].label+'"?')) return;
    c.fields.splice(idx,1);
    openCompany(c.id);
  };

  window.moveField = function(idx, dir){
    const c = companies.find(x => x.id===currentId);
    const ni = idx + dir;
    if (ni < 0 || ni >= c.fields.length) return;
    const tmp = c.fields[idx]; c.fields[idx] = c.fields[ni]; c.fields[ni] = tmp;
    renderFields(c);
  };

  window.addTableRow = function(idx){
    const c = companies.find(x => x.id===currentId);
    const f = c.fields[idx];
    f.rows.push(new Array(f.headers.length).fill(''));
    renderFields(c);
  };
  window.addTableCol = function(idx){
    const c = companies.find(x => x.id===currentId);
    const f = c.fields[idx];
    f.headers.push('Nova col');
    f.rows.forEach(r => r.push(''));
    renderFields(c);
  };
  window.removeTableRow = function(idx, ri){
    const c = companies.find(x => x.id===currentId);
    if (!confirm('Excluir esta linha da tabela?')) return;
    c.fields[idx].rows.splice(ri,1);
    renderFields(c);
  };

  // Modal nova contratante
  let modalMode = 'create'; // ou 'segment'
  window.openNewModal = function(){
    modalMode = 'create';
    document.getElementById('cadModalTitle').textContent = 'Nova contratante';
    document.getElementById('cadModalConfirm').textContent = 'Criar';
    document.getElementById('cadModalName').value = '';
    document.getElementById('cadModalName').style.display = '';
    document.getElementById('cadModalName').previousElementSibling.style.display = '';
    populateSegmentSelect();
    document.getElementById('cadModalBg').classList.add('show');
    setTimeout(() => document.getElementById('cadModalName').focus(), 50);
  };
  window.changeSegment = function(){
    const c = companies.find(x => x.id===currentId);
    if (!c) return;
    modalMode = 'segment';
    document.getElementById('cadModalTitle').textContent = 'Mover de segmento — '+c.name;
    document.getElementById('cadModalConfirm').textContent = 'Mover';
    document.getElementById('cadModalName').style.display = 'none';
    document.getElementById('cadModalName').previousElementSibling.style.display = 'none';
    populateSegmentSelect(c.segment);
    document.getElementById('cadModalBg').classList.add('show');
  };
  function populateSegmentSelect(selected){
    const sel = document.getElementById('cadModalSegment');
    sel.innerHTML = SEGMENTS.map(s => `<option value="${s}" ${s===selected?'selected':''}>${s}</option>`).join('');
  }
  window.closeModal = function(){ document.getElementById('cadModalBg').classList.remove('show'); };
  window.confirmModal = function(){
    if (modalMode==='create'){
      const name = document.getElementById('cadModalName').value.trim();
      if (!name) { alert('Informe um nome para a contratante.'); return; }
      const seg = document.getElementById('cadModalSegment').value;
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g,'-') + '-' + Date.now().toString(36).slice(-4);
      const today = new Date().toLocaleDateString('pt-BR');
      companies.unshift({
        id, name, segment: seg, updated: today,
        fields:[
          {type:'text', label:'AUTORIZAÇÃO P/CADASTRO', value:''},
          {type:'text', label:'CONTATO UNIDADES', value:''},
          {type:'text', label:'TELEFONE', value:''},
          {type:'text', label:'E-MAIL', value:''},
          {type:'text', label:'GT0180', value:''},
          {type:'text', label:'INTEGRAÇÃO', value:''},
          {type:'text', label:'INFORMAÇÕES ADICIONAIS', value:''},
          {type:'text', label:'GT0120', value:''}
        ]
      });
      closeModal();
      activeSegment = seg;
      renderSegments();
      openCompany(id);
    } else {
      const c = companies.find(x => x.id===currentId);
      c.segment = document.getElementById('cadModalSegment').value;
      closeModal();
      renderSegments();
      openCompany(c.id);
    }
  };

  window.renameCompany = function(){
    const c = companies.find(x => x.id===currentId);
    const novo = prompt('Renomear contratante:', c.name);
    if (novo && novo.trim()){
      c.name = novo.trim();
      openCompany(c.id);
    }
  };

  window.deleteCompany = function(){
    const c = companies.find(x => x.id===currentId);
    if (!confirm('Excluir definitivamente a contratante "'+c.name+'"?\nEsta ação não pode ser desfeita.')) return;
    companies = companies.filter(x => x.id !== currentId);
    currentId = null;
    detailEl.style.display = 'none';
    emptyEl.style.display = 'flex';
    crumb.textContent = 'Cadastro contratantes';
    renderSegments();
    renderCards();
  };

  window.toggleSidebar = function(){
    const sb = document.getElementById('gt3Sidebar');
    sb.classList.toggle('collapsed');
    sb.querySelector('.gt3-toggle').textContent = sb.classList.contains('collapsed') ? '›' : '‹';
  };

  // Init
  renderSegments();
  renderCards();
})();
