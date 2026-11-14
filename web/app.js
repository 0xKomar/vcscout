const form = document.querySelector('#search'), input = document.querySelector('#name'), button = document.querySelector('#submit');
const results = document.querySelector('#results'), empty = document.querySelector('#empty'), feedback = document.querySelector('#feedback');
const matchesSection = document.querySelector('#matches'), matchList = document.querySelector('#match-list');
let mode = 'idea', currentIdea = '', activeCompany = '', requestNumber = 0, panelNumber = 0, companyRequest = 0;
const clean = value => value == null ? '' : Array.isArray(value) ? value.join(', ') : String(value);
function element(tag, className, text) { const e = document.createElement(tag); if (className) e.className = className; if (text) e.textContent = text; return e; }
function safeLink(url, text) { try { const parsed = new URL(url); if (!['http:', 'https:'].includes(parsed.protocol)) return null; const a = element('a', 'source', text || `${parsed.hostname.replace(/^www\./, '')} ↗`); a.href = parsed.href; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; } catch { return null; } }
async function api(path, data) { const response = await fetch(path, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)}); const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Nie udało się pobrać danych.'); return body; }
function setMode(value) { mode = value; document.querySelector('#founder-fields').hidden = value !== 'idea'; document.querySelector('#idea-mode').classList.toggle('active', value === 'idea'); document.querySelector('#name-mode').classList.toggle('active', value === 'name'); input.value = ''; input.placeholder = value === 'idea' ? 'Np. buduję narzędzie AI, które automatyzuje weryfikację klientów i compliance dla europejskich fintechów B2B…' : 'Np. Lovable, Attio lub Metaview'; document.querySelector('#input-label').textContent = value === 'idea' ? 'OPIS TWOJEGO STARTUPU' : 'NAZWA STARTUPU'; document.querySelector('#input-hint').textContent = value === 'idea' ? 'Opisz produkt, odbiorców i rynek — im konkretniej, tym lepiej.' : 'Wpisz nazwę firmy, której rundy chcesz zobaczyć.'; }
document.querySelector('#idea-mode').onclick = () => setMode('idea'); document.querySelector('#name-mode').onclick = () => setMode('name');
function showMessage(text) { feedback.hidden = false; feedback.textContent = text; }
function renderMatches(matches, token) {
  matchesSection.hidden = false; matchList.replaceChildren();
  if (!matches.length) { matchList.append(element('div', 'no-results', 'Nie znaleźliśmy podobnych startupów. Doprecyzuj produkt i jego odbiorców.')); return; }
  matches.forEach((match, index) => {
    const card = element('article', 'match-card');
    const choose = element('button', 'match-select' + (index === 0 ? ' selected' : ''));
    choose.type = 'button'; choose.append(element('span', 'match-icon', '✳'), element('strong', 'match-name', match.company), element('span', 'match-arrow', '↗'));
    card.append(choose); if (match.description) card.append(element('p', 'match-description', match.description));
    if (match.similarity_reason) card.append(element('div', 'match-reason', match.similarity_reason));
    const source = safeLink(match.source_url, 'Źródło ↗'); if (source) card.append(source);
    choose.addEventListener('click', () => { document.querySelectorAll('.match-select').forEach(item => item.classList.remove('selected')); choose.classList.add('selected'); loadCompany(match.company, token, clean(match.description).slice(0,1000)); });
    matchList.append(card);
  });
  startPathDiscovery(matches, token);
}
function emptyPanel() { const panel = document.querySelector('#fund-panel'); panel.replaceChildren(); const head = element('div','panel-head'); head.append(element('span','','SZCZEGÓŁY FUNDUSZU'),element('span','','✳')); const placeholder=element('div','panel-placeholder'); placeholder.append(element('div','','↖'),element('strong','','Wybierz fundusz'),element('p','','Kliknij inwestora na grafie, aby zobaczyć powiązane osoby i źródła.')); panel.append(head,placeholder); }
function render(data) {
  activeCompany = data.company; empty.hidden = true; results.hidden = false; emptyPanel(); panelNumber++;
  document.querySelector('#company').textContent = data.company;
  const rounds = data.rounds.filter(r => r.announcement_date && r.round_type);
  document.querySelector('#result-meta').textContent = `${rounds.length} rund ${data.cached ? '· zapisane wyniki z 14 listopada 2026' : '· wynik z Cala'}`;
  const timeline = document.querySelector('#timeline'); timeline.replaceChildren(); document.querySelector('#no-results').hidden = rounds.length > 0;
  if (rounds.length) {
    if (currentIdea) {
      const ideaNode = element('div', 'graph-origin idea-node');
      ideaNode.append(element('div', 'origin-icon', '✳'), element('div', 'field-label', 'TWÓJ POMYSŁ'), element('span', 'idea-node-copy', currentIdea));
      const similarity = element('div', 'similarity-edge'); similarity.append(element('span', '', 'PODOBNY'), element('strong', '', '→'));
      timeline.append(ideaNode, similarity);
    }
    const origin = element('div', 'graph-origin'); origin.append(element('div', 'origin-icon', '✳'), element('div', 'field-label', currentIdea ? 'PODOBNY STARTUP' : 'STARTUP'), element('strong', 'origin-name', data.company), element('span', 'origin-caption', 'Historia finansowania')); timeline.append(origin);
  }
  rounds.forEach((round, index) => {
    const row = element('article', 'graph-stage'), arrow = element('div', 'graph-arrow', '→'); arrow.setAttribute('aria-hidden','true');
    const roundNode = element('div', 'graph-round'); roundNode.append(element('span','graph-number',String(index+1).padStart(2,'0')),element('span','round-type',clean(round.round_type)),element('span','round-date',clean(round.announcement_date)));
    const branch = element('div','graph-branch'); branch.setAttribute('aria-hidden','true'); const card = element('div','graph-investors'); card.append(element('div','field-label','INWESTOR PROWADZĄCY'));
    const leads = clean(round.lead_investors).split(/\s*[,;]\s*/).filter(Boolean);
    if (!leads.length) card.append(element('div','graph-investor muted','Brak danych'));
    leads.forEach(name => { const fund = element('button','graph-investor fund-button'); fund.type='button'; fund.append(element('span','investor-icon','↗'),element('span','',name),element('span','fund-choose','Wybierz →')); fund.addEventListener('click', () => { document.querySelectorAll('.fund-button').forEach(node=>node.classList.remove('chosen')); fund.classList.add('chosen'); selectFund(name, round, data.company); }); card.append(fund); });
    const other = clean(round.investors); if (other) { const detail=element('details','graph-details'); detail.append(element('summary','','Wszyscy uczestnicy'),element('p','',other)); card.append(detail); }
    const urls = clean(round.source_urls).match(/https?:\/\/[^\s,;]+/g)||[]; if (urls.length) { const foot=element('div','graph-sources'); urls.forEach(url=>{const a=safeLink(url); if(a) foot.append(a);}); card.append(foot); }
    row.append(arrow,roundNode,branch,card); timeline.append(row);
  });
}
async function selectFund(fund, round, company, panelId = 'fund-panel') {
  const id = ++panelNumber, panel=document.getElementById(panelId); panel.replaceChildren();
  const head=element('div','panel-head'); head.append(element('span','','SZCZEGÓŁY FUNDUSZU'),element('span','','✳ DANE CALA')); panel.append(head);
  const fundTitle=element('div','fund-title'); fundTitle.append(element('span','fund-logo',fund.slice(0,2).toUpperCase()),element('div','',fund)); panel.append(fundTitle);
  panel.append(element('p','fund-explanation',`Fundusz wymieniony jako prowadzący ${clean(round.round_type)} firmy ${company}. To historyczna runda, nie potwierdzenie przyszłej inwestycji.`));
  const section=element('div','people-section'); section.append(element('div','field-label','OSOBY POWIĄZANE Z INWESTYCJĄ')); const people=element('div','people-list'); people.append(element('div','partner-loading','Szukam osób w Cala…')); section.append(people); panel.append(section);
  const urls=clean(round.source_urls).match(/https?:\/\/[^\s,;]+/g)||[]; const links=element('div','panel-links'); for(const url of urls){ const a=safeLink(url); if(a) links.append(a); } if(links.childNodes.length) panel.append(links);
  try { const data=await api('/api/partners',{company,fund}); if(id!==panelNumber)return; people.replaceChildren(); if(!data.partners.length){people.append(element('p','partner-empty','Nie znaleziono osoby ze źródłem.')); return;}
    for(const person of data.partners){ const personButton=element('button','person-button'); personButton.type='button'; const initials=element('span','person-avatar',person.name.split(/\s+/).slice(0,2).map(part=>part[0]).join('')); const body=element('span','person-body'); body.append(element('strong','',person.name),element('span','',person.role||'Osoba powiązana z inwestycją')); personButton.append(initials,body,element('span','person-chevron','↗')); personButton.addEventListener('click',()=>{ document.querySelectorAll('.person-button').forEach(node=>node.classList.remove('selected')); personButton.classList.add('selected'); showPerson(panel,person,fund,company,data.origin); }); people.append(personButton); }
    if(data.origin==='cala')people.append(element('p','partner-disclaimer','Dane Cala — sprawdź źródło oraz aktualną rolę przed kontaktem.'));
  } catch(error){ if(id===panelNumber){people.replaceChildren(element('p','partner-empty',error.message)); const retry=element('button','partner-retry','Spróbuj ponownie'); retry.type='button'; retry.onclick=()=>selectFund(fund,round,company); people.append(retry);}}
}
function showPerson(panel, person, fund, company, origin) {
  panel.querySelector('.person-detail')?.remove(); const detail=element('div','person-detail'); detail.append(element('div','field-label','KONTEKST I ŹRÓDŁO'),element('p','person-context',person.connection||'Osoba powiązana z inwestycją.'));
  const source=safeLink(person.source_url,'Sprawdź źródło ↗'); if(source)detail.append(source);
  if(currentIdea){detail.append(element('div','field-label draft-label','SZKIC WIADOMOŚCI')); const draft=element('textarea','draft'); draft.setAttribute('aria-label','Szkic wiadomości'); draft.value=`Cześć ${person.name.split(' ')[0]},\n\nBuduję projekt: ${currentIdea}\n\nZainteresowała mnie inwestycja ${fund} w ${company}. Chętnie opowiem więcej o tym, co buduję, i dowiem się, czy ten obszar pasuje do Waszych zainteresowań.\n\nCzy znajdziesz czas na krótką rozmowę?\n\nPozdrawiam`; detail.append(draft); const copy=element('button','copy-draft','Kopiuj szkic'); copy.type='button'; copy.onclick=async()=>{try{await navigator.clipboard.writeText(draft.value);copy.textContent='Skopiowano ✓';}catch{draft.focus();draft.select();copy.textContent='Zaznaczono — skopiuj tekst';}}; detail.append(copy); }
  panel.append(detail);
}
async function loadCompany(name, token, context='') { const sequence=++companyRequest; showMessage(`Szukam rund dla ${name}… Nowe zapytanie może potrwać około minuty.`); results.hidden=true; try { const data=await api('/api/search',{name, context}); if(token!==requestNumber || sequence!==companyRequest)return; render(data); feedback.hidden=true; } catch(error){if(token===requestNumber && sequence===companyRequest)showMessage(error.message);} }
async function submitSearch(value) { const token=++requestNumber; button.disabled=true; button.textContent='Szukam…'; matchesSection.hidden=true; results.hidden=true; document.querySelector('#paths').hidden=true; empty.hidden=true; currentIdea=mode==='idea'?value:'';
  try { if(mode==='name'){await loadCompany(value,token);} else { if(value.length<15)throw new Error('Opisz pomysł w co najmniej 15 znakach.'); showMessage('Szukam podobnych startupów w Cala. To może potrwać około minuty…'); const region=document.querySelector('#startup-region').value.trim(); const data=await api('/api/similar',{idea:region ? `${value} Rynek: ${region}` : value}); if(token!==requestNumber)return; feedback.hidden=true; renderMatches(data.matches||[],token); } } catch(error){if(token===requestNumber)showMessage(error.message);} finally {if(token===requestNumber){button.disabled=false;button.innerHTML='Generuj ścieżki <span>↗</span>';}}
}
form.addEventListener('submit',event=>{event.preventDefault();const value=input.value.trim();if(value)submitSearch(value);});
document.querySelectorAll('[data-idea]').forEach(item=>item.addEventListener('click',()=>{setMode('idea');input.value=item.dataset.idea;submitSearch(input.value);}));
document.querySelectorAll('[data-example]').forEach(item=>item.addEventListener('click',()=>{setMode('name');input.value=item.dataset.example;submitSearch(input.value);}));
