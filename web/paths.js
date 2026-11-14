let pathState = { examples: [], risks: [], completed: 0, total: 0, failed: 0, filter: 'all', riskState: 'loading', selected: '' };
const byId = id => document.getElementById(id);
const sourceUrls = value => clean(value).match(/https?:\/\/[^\s,;]+/g) || [];
const leadNames = value => clean(value).split(/\s*[,;]\s*/).map(s=>s.trim()).filter(s=>s&&!/^(unknown|not disclosed|undisclosed|not specified|n\/?a|null|brak danych|angel investors?|individual investors?)$/i.test(s));
function roundLevel(value) {
  const text = clean(value).toLowerCase().replace(/[-_]/g,' ');
  if (/pre\s*seed|\bseed\b/.test(text)) return 0;
  const match = text.match(/series\s*([a-z])/); return match ? match[1].charCodeAt(0) - 96 : null;
}
function dateParts(value) {
  const s=clean(value).toLowerCase(), year=s.match(/\b(19\d{2}|20\d{2})\b/); if(!year)return null;
  const iso=s.match(/\b(?:19\d{2}|20\d{2})-(\d{2})/); const names=['january','february','march','april','may','june','july','august','september','october','november','december'];
  const idx=names.findIndex(name=>s.includes(name)); const month=iso ? +iso[1] : idx>=0 ? idx+1 : null;
  return {year:+year[1],month};
}
function strictlyLater(first, second) { const a=dateParts(first),b=dateParts(second); return !!(a&&b&&(b.year>a.year||(b.year===a.year&&a.month&&b.month&&b.month>a.month))); }
function sourceRounds(example) { return (example.rounds||[]).filter(r=>r&&r.announcement_date&&r.round_type&&leadNames(r.lead_investors).length&&sourceUrls(r.source_urls).length); }
function preparePaths() {
  const startLevel=byId('startup-stage').value==='series-a'?1:0, early=new Map(), later=new Map(), edges=new Map();
  for (const example of pathState.examples) {
    const rounds=sourceRounds(example), starts=rounds.filter(r=>roundLevel(r.round_type)===startLevel);
    for (const start of starts) {
      const next=rounds.filter(r=>roundLevel(r.round_type)>startLevel&&strictlyLater(start.announcement_date,r.announcement_date)).sort((a,b)=>{const x=dateParts(a.announcement_date),y=dateParts(b.announcement_date);return x.year-y.year||(x.month||0)-(y.month||0);})[0];
      for (const firstFund of leadNames(start.lead_investors)) {
        const firstKey=firstFund.toLocaleLowerCase(); if(!early.has(firstKey))early.set(firstKey,{name:firstFund,evidence:[]});
        const first=early.get(firstKey); if(!first.evidence.some(e=>e.company===example.company))first.evidence.push({company:example.company,round:start});
        if(!next)continue;
        for (const nextFund of leadNames(next.lead_investors)) {
          const nextKey=nextFund.toLocaleLowerCase(); if(firstKey===nextKey)continue;
          if(!later.has(nextKey))later.set(nextKey,{name:nextFund,evidence:[]}); const target=later.get(nextKey);
          if(!target.evidence.some(e=>e.company===example.company))target.evidence.push({company:example.company,round:next});
          const edgeKey=firstKey+'→'+nextKey; if(!edges.has(edgeKey))edges.set(edgeKey,{from:firstKey,fromName:firstFund,to:nextKey,toName:nextFund,evidence:[]});
          edges.get(edgeKey).evidence.push({company:example.company,early:start,later:next});
        }
      }
    }
  }
  return {early:[...early.values()].sort((a,b)=>b.evidence.length-a.evidence.length),later:[...later.values()].sort((a,b)=>b.evidence.length-a.evidence.length),edges:[...edges.values()]};
}
function makePathNode(fund, kind) {
  const node=element('button','path-fund-node '+kind); node.type='button'; node.dataset.fund=fund.name.toLocaleLowerCase(); node.dataset.kind=kind;
  if(pathState.selected===kind+':'+node.dataset.fund)node.classList.add('selected');
  const flagged=pathState.risks.some(r=>r.fund.toLocaleLowerCase()===node.dataset.fund);
  if(flagged)node.classList.add('flagged');
  const heading=element('span','path-fund-heading'); heading.append(element('strong','',fund.name),element('span',flagged?'path-risk-badge':'path-badge',flagged?'SPRAWDŹ KONFLIKT':kind==='early'?'WCZESNA RUNDA':'KOLEJNA RUNDA'));
  const examples=[...new Set(fund.evidence.map(e=>e.company))];
  node.append(heading,element('span','path-reason',`Inwestycja w: ${examples.join(', ')}`),element('span','path-node-action',`${examples.length} ${examples.length===1?'przykład':'przykłady'} · Zobacz szczegóły →`));
  node.addEventListener('click',()=>{pathState.selected=kind+':'+node.dataset.fund; document.querySelectorAll('.path-fund-node').forEach(n=>n.classList.remove('selected'));node.classList.add('selected'); const item=fund.evidence[0]; selectPathFund(fund,item,kind);});
  return node;
}
function setDiagramNodeList(id, items, kind, emptyText) { const target=byId(id); target.replaceChildren(); if(!items.length){target.append(element('div','path-empty',emptyText));return;}items.forEach(item=>target.append(makePathNode(item,kind))); }
function renderPathGraph() {
  const {early,later,edges}=preparePaths(); pathState.edges=edges;
  setDiagramNodeList('early-nodes',early,'early',pathState.completed<pathState.total?'Analizujemy kolejne spółki…':'Brak udokumentowanych rund na wybranym etapie.');
  setDiagramNodeList('later-nodes',later,'later',pathState.completed<pathState.total?'Analizujemy kolejne rundy…':'Brak potwierdzonych późniejszych inwestorów.');
  byId('count-all').textContent=early.length+later.length; byId('count-paths').textContent=edges.length; byId('count-risks').textContent=pathState.riskState==='loading'?'…':pathState.riskState==='error'?'—':pathState.risks.length;
  const left=byId('risk-nodes');left.replaceChildren();
  if(pathState.risks.length){for(const risk of pathState.risks){const node=element('button','path-risk-node');node.type='button';const top=element('span','path-fund-heading');top.append(element('strong','',risk.fund),element('span','path-risk-badge','MOŻLIWY KONFLIKT'));node.append(top,element('span','path-reason',`Powiązanie z ${risk.competitor}. Wymaga weryfikacji.`),element('span','path-node-action','Sprawdź źródło →'));node.onclick=()=>showRisk(risk);left.append(node);}}
  else left.append(element('div','path-empty risk-empty',pathState.riskState==='loading'?'Sprawdzamy możliwe konflikty…':pathState.riskState==='error'?'Nie udało się sprawdzić konfliktów. Nie oznacza to, że ich nie ma.':'Cala nie wskazała sygnału dla sprawdzonych funduszy. To nie jest ocena całego portfela.'));
  byId('paths-meta').textContent=`Przeanalizowano ${pathState.completed} z ${pathState.total} podobnych firm${pathState.failed?` · ${pathState.failed} bez danych o rundach`:''}. ${edges.length} powiązań między rundami.`;
  applyPathFilter(); requestAnimationFrame(drawPathLines);
}
function selectPathFund(fund, item, kind) {
  const panel=byId('path-fund-panel'); panel.replaceChildren(); const head=element('div','panel-head');head.append(element('span','','SZCZEGÓŁY FUNDUSZU'),element('span','','✳ DANE CALA'));panel.append(head);
  const title=element('div','fund-title');title.append(element('span','fund-logo',fund.name.slice(0,2).toUpperCase()),element('div','',fund.name));panel.append(title);
  panel.append(element('p','fund-explanation',`${kind==='early'?'Przykład inwestora z rundy na wybranym etapie':'Przykład inwestora z późniejszej rundy'} podobnej firmy. Sprawdź tezę fundusza i aktualną aktywność przed kontaktem.`));
  const evidence=element('div','path-evidence');evidence.append(element('div','field-label','PODSTAWA REKOMENDACJI'));
  for(const e of fund.evidence){const block=element('div','evidence-item');block.append(element('strong','',e.company),element('span','',`${clean(e.round.round_type)} · ${clean(e.round.announcement_date)}`));for(const url of sourceUrls(e.round.source_urls).slice(0,2)){const link=safeLink(url,'Źródło rundy ↗');if(link)block.append(link);}evidence.append(block);}panel.append(evidence);
  {
    const related=(pathState.edges||[]).filter(edge=>(kind==='early'?edge.from:edge.to)===fund.name.toLocaleLowerCase());
    if(related.length){const section=element('div','path-evidence');section.append(element('div','field-label','HISTORYCZNE ŚCIEŻKI MIĘDZY FUNDUSZAMI'));
      for(const edge of related){const proof=edge.evidence[0],block=element('div','evidence-item');block.append(element('strong','',`${edge.fromName} → ${edge.toName}`),element('span','',`${proof.company}: ${clean(proof.early.round_type)} (${clean(proof.early.announcement_date)}) → ${clean(proof.later.round_type)} (${clean(proof.later.announcement_date)})`));
        const first=safeLink(sourceUrls(proof.early.source_urls)[0], 'Źródło wcześniejszej rundy ↗'),last=safeLink(sourceUrls(proof.later.source_urls)[0], 'Źródło kolejnej rundy ↗');if(first)block.append(first);if(last)block.append(last);section.append(block);}panel.append(section);
    }
  }
  const section=element('div','people-section');section.append(element('div','field-label','OSOBY POWIĄZANE Z INWESTYCJĄ'));const people=element('div','people-list');people.append(element('p','partner-loading','Szukam osób w Cala…'));section.append(people);panel.append(section);const id=++panelNumber;
  api('/api/partners',{fund:fund.name,company:item.company}).then(data=>{if(id!==panelNumber)return;people.replaceChildren();if(!data.partners.length){people.append(element('p','partner-empty','Nie znaleziono osoby ze źródłem.'));return;}for(const person of data.partners){const personButton=element('button','person-button');personButton.type='button';const initials=element('span','person-avatar',person.name.split(/\s+/).slice(0,2).map(part=>part[0]).join(''));const body=element('span','person-body');body.append(element('strong','',person.name),element('span','',person.role||'Osoba powiązana z inwestycją'));personButton.append(initials,body,element('span','person-chevron','↗'));personButton.onclick=()=>{people.querySelectorAll('.person-button').forEach(n=>n.classList.remove('selected'));personButton.classList.add('selected');showPerson(panel,person,fund.name,item.company,data.origin);};people.append(personButton);}if(data.origin==='cala')people.append(element('p','partner-disclaimer','Dane Cala — sprawdź źródło i aktualną rolę.'));}).catch(error=>{if(id!==panelNumber)return;people.replaceChildren(element('p','partner-empty',error.message));});
}
function showRisk(risk) { panelNumber++;const panel=byId('path-fund-panel');panel.replaceChildren();const head=element('div','panel-head');head.append(element('span','','DO WERYFIKACJI'),element('span','','MOŻLIWY KONFLIKT'));panel.append(head);const title=element('div','fund-title');title.append(element('span','fund-logo',risk.fund.slice(0,2).toUpperCase()),element('div','',risk.fund));panel.append(title,element('p','fund-explanation',risk.reason),element('p','fund-explanation',`Cala wskazuje powiązanie z ${risk.competitor}. Sprawdź źródło i politykę konfliktów funduszu przed podjęciem decyzji.`));const a=safeLink(risk.source_url,'Sprawdź źródło ↗');if(a){const links=element('div','panel-links');links.append(a);panel.append(links);} }
function applyPathFilter(){const canvas=document.querySelector('.paths-diagram');canvas.classList.toggle('only-risks',pathState.filter==='risks');canvas.classList.toggle('only-paths',pathState.filter==='paths');document.querySelectorAll('.path-filter').forEach(button=>button.classList.toggle('active',button.dataset.filter===pathState.filter));requestAnimationFrame(drawPathLines);}
document.querySelectorAll('.path-filter').forEach(button=>button.addEventListener('click',()=>{pathState.filter=button.dataset.filter;applyPathFilter();}));
function drawPathLines() {
  const diagram=document.querySelector('.paths-diagram'),svg=diagram.querySelector('svg'),root=diagram.getBoundingClientRect();if(!root.width)return;svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${root.width} ${root.height}`);
  const pos=(node,side)=>{const r=node.getBoundingClientRect();return {x:(side==='left'?r.left:r.right)-root.left,y:r.top+r.height/2-root.top};};
  function link(a,b,risk=false){if(!a||!b||!a.getClientRects().length||!b.getClientRects().length)return;const p=pos(a,'right'),q=pos(b,'left'),curve=document.createElementNS('http://www.w3.org/2000/svg','path'),mid=(p.x+q.x)/2;curve.setAttribute('d',`M ${p.x} ${p.y} C ${mid} ${p.y}, ${mid} ${q.y}, ${q.x} ${q.y}`);curve.setAttribute('class',risk?'risk-line':'positive-line');svg.append(curve);}
  const founder=diagram.querySelector('.founder-node'); if(pathState.filter!=='risks'){diagram.querySelectorAll('.path-fund-node.early').forEach(n=>link(founder,n)); for(const edge of pathState.edges||[]){const first=[...diagram.querySelectorAll('.path-fund-node.early')].find(n=>n.dataset.fund===edge.from),last=[...diagram.querySelectorAll('.path-fund-node.later')].find(n=>n.dataset.fund===edge.to);link(first,last);}} if(pathState.filter!=='paths')diagram.querySelectorAll('.path-risk-node').forEach(n=>link(n,founder,true));
}
new ResizeObserver(()=>requestAnimationFrame(drawPathLines)).observe(document.querySelector('.paths-diagram')); window.addEventListener('resize',drawPathLines);
async function startPathDiscovery(matches, token) {
  if(token!==requestNumber)return; pathState={examples:[],risks:[],completed:0,total:Math.min(matches.length,4),failed:0,filter:'all',riskState:'loading',selected:'',edges:[]};
  byId('paths').hidden=false;document.body.classList.add('paths-ready');byId('founder-title').textContent=byId('startup-name').value.trim()||'Twój pomysł';byId('founder-summary').textContent=currentIdea;byId('founder-stage').textContent=byId('startup-stage').selectedOptions[0].textContent+(byId('startup-region').value.trim()?` · ${byId('startup-region').value.trim()}`:'')+(byId('startup-target').value.trim()?` · Cel: ${byId('startup-target').value.trim()}`:'');renderPathGraph();
  const list=matches.slice(0,4);let next=0;
  async function worker(){while(next<list.length){const match=list[next++];try{const data=await api('/api/search',{name:match.company,context:clean(match.description).slice(0,1000)});if(token!==requestNumber)return; if(data.rounds&&data.rounds.length)pathState.examples.push(data);else pathState.failed++;}catch{if(token!==requestNumber)return;pathState.failed++;}pathState.completed++;renderPathGraph();}}
  await Promise.all(Array.from({length:Math.min(2,list.length)},()=>worker()));if(token!==requestNumber)return;
  const funds=preparePaths().early.slice(0,6).map(item=>item.name);
  if(!funds.length){pathState.riskState='empty';renderPathGraph();return;}
  try { const region=byId('startup-region').value.trim(),data=await api('/api/risks',{idea:region?`${currentIdea} Rynek: ${region}`:currentIdea,funds});if(token!==requestNumber)return;pathState.risks=data.risks||[];pathState.riskState='done';}catch{if(token!==requestNumber)return;pathState.riskState='error';}renderPathGraph();
}
