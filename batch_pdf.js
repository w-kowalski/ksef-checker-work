(()=>{
'use strict';
const batch={items:[],running:false,seq:0};
const q=s=>document.querySelector(s);
const h=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const fmtDate=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(String(s||'')))return s||'—';const [y,m,d]=s.split('-');return `${d}.${m}.${y}`};
const fmtMoney=(n,c='PLN')=>{if(n===null||n===undefined||n==='')return'—';try{return new Intl.NumberFormat('pl-PL',{style:'currency',currency:c||'PLN'}).format(Number(n))}catch{return `${Number(n).toFixed(2)} ${c}`}};
const dataUrl=file=>new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=()=>reject(r.error||new Error('Błąd odczytu pliku'));r.onload=()=>resolve(String(r.result||''));r.readAsDataURL(file)});
function count(item,type){return (item.checks||[]).filter(x=>x.type===type).length}
function accountingChecks(item){return (item.checks||[]).filter(x=>x.category!=='pdf')}
function countAccounting(item,type){return accountingChecks(item).filter(x=>x.type===type).length}
function safeInvoiceNumber(d){const v=String(d?.number||'').trim();if(!v)return'';const ev=String(d?.fieldEvidence?.number||'');const direct=/numer faktury|nr faktury|faktura|invoice/i.test(ev);const ok=window.pdfImport?.plausibleInvoiceNumber?.(v,{knownBanks:d?.banks||[],knownNips:[d?.seller?.nip,d?.buyer?.nip].filter(Boolean),directInvoiceLabel:direct});return ok?v:''}
function readNeedsReview(item){const d=item.data||{},fc=d.fieldConfidence||{};return !d.date||!d.seller?.nip||!d.buyer?.nip||d.gross==null||Number(fc.date||0)<55||Number(d.confidence||0)<60}
function statusOf(item){if(item.failed)return{key:'failed',label:'NIE ODCZYTANO',icon:'×'};const e=countAccounting(item,'error'),w=countAccounting(item,'warn');if(e)return{key:'error',label:e===1?'1 BŁĄD':`${e} BŁĘDY`,icon:'×'};if(w)return{key:'warn',label:w===1?'OSTRZEŻENIE':`${w} OSTRZEŻ.`,icon:'!'};if(readNeedsReview(item))return{key:'partial',label:'ODCZYT DO SPRAWDZ.',icon:'!'};if(item.unavailable)return{key:'partial',label:'CZĘŚCIOWO',icon:'!'};return{key:'ok',label:'OK',icon:'✓'}}
function auditPayloadFromDoc(doc){const inv=invoice(doc),old=state.inputType;state.inputType='pdf';try{return buildAuditPayload(inv)}finally{state.inputType=old}}
async function extractPdf(file){
 if(file.size>20*1024*1024)throw new Error('Plik jest większy niż 20 MB.');
 const u=await dataUrl(file),base64=u.slice(u.indexOf(',')+1);
 const res=await fetch('/api/pdf/extract',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:file.name,data:base64})});
 const j=await res.json().catch(()=>({}));if(!res.ok)throw new Error(j.error||`HTTP ${res.status}`);
 if(!j.hasText)throw new Error('PDF nie ma warstwy tekstowej (prawdopodobnie skan). OCR nie jest jeszcze dostępny.');
 const variants=[j.layoutText,j.text].filter((x,i,a)=>String(x||'').trim()&&a.indexOf(x)===i);
 const parsed=variants.map(window.pdfImport.parseText),d=window.pdfImport.mergeParses(parsed);
 d.pages=j.pages||0;d.engine=j.engine||'';d.fileSize=j.size||file.size;d.extractionVariants=parsed.length;d.previewId=j.previewId||'';d.previewUrl=j.previewUrl||'';
 return{data:d,rawText:String(j.layoutText||j.text||'').slice(0,30000)};
}
async function analyzeOne(file,index){
 const item={id:`batch-${Date.now()}-${index}-${Math.random().toString(36).slice(2,7)}`,index,file,fileName:file.name,state:'working',checks:[],unavailable:0,data:null,rawText:'',failed:false,error:''};
 batch.items.push(item);renderRows();
 try{
  const x=await extractPdf(file);item.data=x.data;item.rawText=x.rawText;
  const xml=window.pdfImport.syntheticXml(item.data),doc=new DOMParser().parseFromString(xml,'application/xml');
  if(doc.getElementsByTagName('parsererror').length)throw new Error('Nie udało się utworzyć modelu faktury z odczytanych danych.');
  const oldData=state.pdfData;state.pdfData=item.data;
  try{item.localChecks=window.pdfImport.ruleChecks(doc)||[]}finally{state.pdfData=oldData}
  item.checks=[...item.localChecks];renderRows();
  try{
   const payload=auditPayloadFromDoc(doc),r=await fetch('/api/audit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),j=await r.json().catch(()=>({}));
   if(!r.ok)throw new Error(j.error||`HTTP ${r.status}`);
   const oldPdf=state.pdfData,oldType=state.inputType;state.pdfData=item.data;state.inputType='pdf';try{item.externalChecks=window.pdfImport.adaptChecks?window.pdfImport.adaptChecks(j.checks||[]):(j.checks||[])}finally{state.pdfData=oldPdf;state.inputType=oldType}item.unavailable=Number(j.unavailable||0);item.auditDetails=j.details||null;item.checks=[...item.localChecks,...item.externalChecks];
   const pn=window.pdfImport?.plausiblePartyName||(()=>true);item.displaySeller=j.details?.seller?.mf?.name||(pn(item.data?.seller?.name)?item.data.seller.name:'')||item.data?.seller?.name||'';item.displayBuyer=j.details?.buyer?.mf?.name||(pn(item.data?.buyer?.name)?item.data.buyer.name:'')||item.data?.buyer?.name||'';
  }catch(e){item.unavailable=1;item.checks.push({type:'warn',category:'registry',title:'Weryfikacja rejestrowa niepełna',desc:`Nie udało się zakończyć kontroli online: ${e?.message||e}`,field:'MF / VIES / NBP',fix:'Spróbuj ponownie później albo otwórz fakturę w pełnym Checkerze.'});}
  item.state='done';
 }catch(e){item.state='failed';item.failed=true;item.error=e?.message||String(e)}
 renderRows();updateSummary();return item;
}
function detailChecks(item){
 const priority={error:0,warn:1,ok:2,info:3};return [...(item.checks||[])].sort((a,b)=>(priority[a.type]??9)-(priority[b.type]??9)).map(c=>`<div class="batch-check ${h(c.type||'info')}"><span class="batch-check-icon">${c.type==='error'?'×':c.type==='warn'?'!':c.type==='ok'?'✓':'i'}</span><div><b>${h(c.title||'Kontrola')}</b><p>${h(c.desc||'')}</p>${c.fix?`<small>${h(c.fix)}</small>`:''}</div></div>`).join('')||'<div class="batch-empty-detail">Brak szczegółowych kontroli.</div>';
}
function detailHtml(item){
 if(item.failed)return `<div class="batch-detail-error"><b>Nie udało się odczytać PDF</b><p>${h(item.error)}</p></div>`;
 const d=item.data||{},fc=d.fieldConfidence||{},seller=item.displaySeller||d.seller?.name||'—',buyer=item.displayBuyer||d.buyer?.name||'—';
 const safeNo=safeInvoiceNumber(d);const note=(d.notes||[]).length?`<div class="batch-read-note"><b>Jak odczytano PDF:</b> ${h((d.notes||[]).join(' '))}</div>`:'';const numberNote=!safeNo?'<div class="batch-read-note"><b>Numer faktury:</b> Nie znaleziono pewnego P_2 w warstwie tekstowej PDF. Rachunki bankowe, NIP-y, link QR i numery dokumentów magazynowych nie są traktowane jako numer faktury.</div>':'';
 return `<div class="batch-detail-grid"><div><span>Numer faktury</span><b>${h(safeNo||'—')}${d.fieldConfidence?.number?` <em>${h(d.fieldConfidence.number)}%</em>`:''}</b></div><div><span>Data wystawienia</span><b>${h(fmtDate(d.date))}${fc.date?` <em>${fc.date}%</em>`:''}</b></div><div><span>Sprzedawca</span><b>${h(seller)}</b><small>${d.seller?.nip?`NIP ${h(d.seller.nip)}`:'NIP nieodczytany'}</small></div><div><span>Nabywca</span><b>${h(buyer)}</b><small>${d.buyer?.nip?`NIP ${h(d.buyer.nip)}`:'NIP nieodczytany'}</small></div><div><span>Netto</span><b>${fmtMoney(d.net,d.currency)}</b></div><div><span>VAT</span><b>${fmtMoney(d.vat,d.currency)}</b></div><div><span>Brutto</span><b>${fmtMoney(d.gross,d.currency)}</b></div><div><span>Kompletność odczytu</span><b>${Number(d.confidence||0)}%</b></div></div>${note}${numberNote}<div class="batch-detail-actions"><button class="btn primary small" data-batch-open="${h(item.id)}">Otwórz pełną analizę tej faktury</button><span>${item.unavailable?'Część rejestrów była chwilowo niedostępna.':'Kontrole lokalne i rejestrowe zakończone.'}</span></div><div class="batch-checks">${detailChecks(item)}</div>`;
}
function rowHtml(item){
 const d=item.data||{},st=item.state==='working'?{key:'working',label:'ANALIZA…',icon:'…'}:statusOf(item),e=countAccounting(item,'error'),w=countAccounting(item,'warn');
 const title=safeInvoiceNumber(d)||'Numer faktury nieodczytany',seller=item.displaySeller||d.seller?.name||'—';
 return `<div class="batch-row-wrap" data-batch-id="${h(item.id)}"><button class="batch-row" data-batch-toggle="${h(item.id)}"><span class="batch-index">${item.index+1}</span><span class="batch-invoice"><b>${h(title)}</b><small>${h(item.fileName)}</small></span><span class="batch-seller">${h(seller)}</span><span>${h(fmtDate(d.date))}</span><span class="batch-gross">${d.gross!=null?fmtMoney(d.gross,d.currency):'—'}</span><span><i class="batch-status ${st.key}">${st.icon} ${h(st.label)}</i></span><span class="batch-counts"><b class="err">${e}</b> / <b class="wrn">${w}</b></span><span class="batch-chevron">⌄</span></button><div class="batch-detail hidden" data-batch-detail="${h(item.id)}">${detailHtml(item)}</div></div>`;
}
function matchesFilters(item){
 const search=String(q('#batchSearch')?.value||'').toLowerCase().trim(),sf=q('#batchStatusFilter')?.value||'',issue=q('#batchIssueFilter')?.value||'';const d=item.data||{},st=item.state==='working'?'working':statusOf(item).key;
 if(sf&&st!==sf&&!(sf==='warn'&&st==='partial'))return false;
 if(search&&![(safeInvoiceNumber(d)||''),item.fileName,item.displaySeller||d.seller?.name||'',d.seller?.nip||'',d.buyer?.nip||''].join(' ').toLowerCase().includes(search))return false;
 if(issue){const text=(item.checks||[]).map(c=>`${c.category||''} ${c.title||''} ${c.desc||''} ${c.field||''}`).join(' ').toLowerCase();const map={bank:/rachunek|biała lista|bank/,vat:/vat|p_15|netto|brutto|kwot|mpp|podatek/,date:/data|termin|p_1|p_6/,party:/kontrah|sprzedawc|nabywc|nip|vies|adres/,read:/pdf|odczyt|parser|warstwa tekstowa/};if(map[issue]&&!map[issue].test(text)&&!(issue==='read'&&readNeedsReview(item)))return false}
 return true
}
function renderRows(){const box=q('#batchRows');if(!box)return;const items=batch.items.filter(matchesFilters);box.innerHTML=items.length?items.map(rowHtml).join(''):(batch.items.length?'<div class="batch-empty">Brak faktur pasujących do filtrów.</div>':'<div class="batch-empty">Nie dodano jeszcze faktur PDF.</div>');bindRows();updateSummary()}
function bindRows(){
 document.querySelectorAll('[data-batch-toggle]').forEach(b=>b.onclick=()=>{const id=b.dataset.batchToggle,det=document.querySelector(`[data-batch-detail="${CSS.escape(id)}"]`);if(det){det.classList.toggle('hidden');b.closest('.batch-row-wrap')?.classList.toggle('expanded',!det.classList.contains('hidden'))}});
 document.querySelectorAll('[data-batch-open]').forEach(b=>b.onclick=e=>{e.stopPropagation();const item=batch.items.find(x=>x.id===b.dataset.batchOpen);if(!item||item.failed)return;window.pdfImport.loadAnalyzed(item.file,item.data,item.rawText);q('#batchPanel')?.classList.add('hidden');q('#uploadPanel')?.classList.add('hidden');q('#batchBackBtn')?.classList.remove('hidden');window.scrollTo({top:0,behavior:'smooth'})});
}
function updateSummary(){
 const done=batch.items.filter(x=>x.state==='done'||x.state==='failed').length,total=batch.items.length;
 const counts={ok:0,warn:0,error:0,failed:0,partial:0};for(const x of batch.items){if(x.state==='working')continue;counts[statusOf(x).key]=(counts[statusOf(x).key]||0)+1}
 q('#batchTotalCount').textContent=total;q('#batchOkCount').textContent=counts.ok||0;q('#batchWarnCount').textContent=(counts.warn||0)+(counts.partial||0);q('#batchErrorCount').textContent=counts.error||0;q('#batchFailedCount').textContent=counts.failed||0;
 const pct=total?Math.round(done/total*100):0;q('#batchProgressBar').style.width=`${pct}%`;
 if(batch.running){q('#batchProgressTitle').textContent=`Analizuję ${done+1} z ${total}`;q('#batchProgressText').textContent='Odczyt PDF → reguły lokalne → Biała Lista / VIES / NBP. Pliki są sprawdzane kolejno.'}
 else if(total){q('#batchProgressTitle').textContent=`Analiza zakończona: ${done}/${total}`;q('#batchProgressText').textContent=`OK: ${counts.ok||0} • ostrzeżenia/częściowo: ${(counts.warn||0)+(counts.partial||0)} • błędy: ${counts.error||0} • nieodczytane: ${counts.failed||0}`}
 else{q('#batchProgressTitle').textContent='Gotowe do analizy';q('#batchProgressText').textContent='Wybierz pliki PDF.'}
}
async function handleFiles(fileList){
 const files=[...(fileList||[])].filter(f=>f.type==='application/pdf'||/\.pdf$/i.test(f.name||''));if(!files.length){alert('W analizie zbiorczej wybierz pliki PDF.');return}if(location.protocol==='file:'){alert('Analiza wielu PDF wymaga lokalnego serwera. Uruchom START_CHECKER.bat.');return}
 if(batch.running){alert('Poprzedni pakiet jest jeszcze analizowany. Poczekaj na zakończenie.');return}
 if(files.length>30&&!confirm(`Wybrano ${files.length} PDF. Analiza rejestrów może potrwać kilka minut. Kontynuować?`))return;
 q('#results')?.classList.add('hidden');q('#uploadPanel')?.classList.add('hidden');q('#batchPanel')?.classList.remove('hidden');
 const start=batch.items.length;batch.running=true;batch.seq++;updateSummary();
 for(let i=0;i<files.length;i++){await analyzeOne(files[i],start+i);updateSummary()}
 batch.running=false;updateSummary();for(const inp of [q('#batchPdfInput'),q('#batchPdfMoreInput')])if(inp)inp.value='';
}
function clearBatch(){if(batch.running){alert('Poczekaj, aż bieżąca analiza się zakończy.');return}batch.items=[];renderRows();q('#batchPanel')?.classList.add('hidden');q('#uploadPanel')?.classList.remove('hidden');q('#batchBackBtn')?.classList.add('hidden');for(const inp of [q('#batchPdfInput'),q('#batchPdfMoreInput')])if(inp)inp.value=''}
function showBatch(){if(!batch.items.length)return;q('#results')?.classList.add('hidden');q('#uploadPanel')?.classList.add('hidden');q('#batchPanel')?.classList.remove('hidden');q('#batchBackBtn')?.classList.add('hidden');renderRows();window.scrollTo({top:0,behavior:'smooth'})}
function init(){q('#batchPdfInput')?.addEventListener('change',e=>handleFiles(e.target.files));q('#batchPdfMoreInput')?.addEventListener('change',e=>handleFiles(e.target.files));q('#batchClearBtn')?.addEventListener('click',clearBatch);q('#batchBackBtn')?.addEventListener('click',showBatch);q('#batchSearch')?.addEventListener('input',renderRows);q('#batchStatusFilter')?.addEventListener('change',renderRows);q('#batchIssueFilter')?.addEventListener('change',renderRows);renderRows()}
window.batchPdf={handleFiles,clear:clearBatch,get items(){return batch.items}};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
