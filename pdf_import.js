(()=>{
'use strict';
const moneyNumber=s=>{
 const t=String(s||'').replace(/\u00a0/g,' ').trim();
 const m=t.match(/-?(?:\d{1,3}(?:,\d{3})+\.\d{1,2}|\d{1,3}(?:[\s.'’]\d{3})+[,.]\d{1,2}|\d+[,.]\d{1,2}|\d+)/);if(!m)return null;
 let x=m[0].replace(/[\s'’]/g,'');
 if(x.includes(',')&&x.includes('.')){const dec=x.lastIndexOf(',')>x.lastIndexOf('.')?',':'.',th=dec===','?'.':',';x=x.split(th).join('').replace(dec,'.')}
 else if(x.includes(',')){const k=x.lastIndexOf(',');x=x.length-k-1<=2?x.replace(/\./g,'').replace(',','.'):x.replace(/,/g,'')}
 else if(x.includes('.')){const k=x.lastIndexOf('.');if(x.length-k-1!==2)x=x.replace(/\./g,'')}
 const n=Number(x);return Number.isFinite(n)?n:null;
};
const xmlEsc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[m]));
const n2=n=>Number.isFinite(Number(n))?Number(n).toFixed(2):'';
const linesOf=text=>String(text||'').replace(/\r/g,'\n').split(/\n+/).map(x=>x.replace(/[\t]+/g,'   ').replace(/\u00a0/g,' ').trim()).filter(Boolean);
const normalized=s=>String(s||'').toLowerCase().replace(/[ł]/g,'l').replace(/[đ]/g,'d').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const urlishLine=s=>/(?:https?:\/\/|www\.|(?:^|\/)pl\/invoice\/|ksef\.mf\.gov\.pl|\bweb\/verify\b|\bverify\?nip=)/i.test(String(s||''));
function verificationMeta(text){
 const src=String(text||'');let m;
 // Link weryfikacyjny KSeF bywa wyciągany z PDF bez domeny, np. pl/invoice/NIP/DD-MM-RRRR/hash.
 m=src.match(/(?:^|[^a-z])(?:https?:\/\/[^\s]*?\/)?pl\/invoice\/(\d{10})\/(\d{2})-(\d{2})-(20\d{2})\/([A-Za-z0-9_~+\/=-]{8,})/i);
 if(m){const date=validIsoParts(m[4],m[3],m[2]);if(date)return{sellerNip:m[1],issueDate:date,source:'qr-path'}}
 // Obsługa wariantu linku verify?nip=...&date=YYYY-MM-DD&hash=...
 m=src.match(/verify\?[^\s#]*?nip=(\d{10})[^\s#]*?date=(20\d{2}-\d{2}-\d{2})[^\s#]*?(?:hash|invoiceHash)=/i);
 if(m&&iso(m[2]))return{sellerNip:m[1],issueDate:iso(m[2]),source:'qr-query'};
 return{sellerNip:'',issueDate:'',source:''};
}
const PL_MONTHS={stycznia:1,styczen:1,lutego:2,luty:2,marca:3,marzec:3,kwietnia:4,kwiecien:4,maja:5,maj:5,czerwca:6,czerwiec:6,lipca:7,lipiec:7,sierpnia:8,sierpien:8,wrzesnia:9,wrzesien:9,pazdziernika:10,pazdziernik:10,listopada:11,listopad:11,grudnia:12,grudzien:12};
function validIsoParts(y,m,d){y=Number(y);m=Number(m);d=Number(d);if(y<2000||y>2100||m<1||m>12||d<1||d>31)return'';const dt=new Date(Date.UTC(y,m-1,d));return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d?`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`:''}
function dateTokens(line){
 const src=String(line||''),out=[];let m;
 const re1=/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/g;while((m=re1.exec(src))){const value=validIsoParts(m[1],m[2],m[3]);if(value)out.push({value,start:m.index,end:re1.lastIndex,raw:m[0]})}
 const re2=/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/g;while((m=re2.exec(src))){const value=validIsoParts(m[3],m[2],m[1]);if(value)out.push({value,start:m.index,end:re2.lastIndex,raw:m[0]})}
 const norm=normalized(src),months=Object.keys(PL_MONTHS).join('|'),re3=new RegExp(`\\b(\\d{1,2})\\s+(${months})\\s+(20\\d{2})\\b`,'gi');while((m=re3.exec(norm))){const value=validIsoParts(m[3],PL_MONTHS[m[2].toLowerCase()],m[1]);if(value)out.push({value,start:m.index,end:re3.lastIndex,raw:m[0]})}
 return out.sort((a,b)=>a.start-b.start);
}
const iso=s=>dateTokens(String(s||''))[0]?.value||'';
function positions(haystack,needles){const s=normalized(haystack),out=[];for(const n of needles){let at=0;while((at=s.indexOf(n,at))>=0){out.push(at);at+=Math.max(1,n.length)}}return out}
function labelSpans(haystack,needles){const s=normalized(haystack),out=[];for(const n of needles){let at=0;while((at=s.indexOf(n,at))>=0){out.push({start:at,end:at+n.length,label:n});at+=Math.max(1,n.length)}}return out}function spanDistance(tok,sp){if(tok.start>=sp.end)return tok.start-sp.end;if(tok.end<=sp.start)return sp.start-tok.end;return 0}
const DATE_CFG={
 issue:{pos:['data wystawienia faktury','data wystawienia','data wyst.','wystawiono dnia','wystawiona dnia','wystawiona w dniu','wystawiono w dniu','wystawiona w','wystawiono w','wystawion','issue date','invoice date','date of issue','issued on'],neg:['data sprzedazy','data dostawy','data wykonania','termin platnosci','due date','sale date','delivery date','data zaplaty','data zamowienia','data ksef','data odbioru']},
 sale:{pos:['data sprzedazy','data dostawy','data wykonania','data zakonczenia dostawy','sale date','delivery date','service date'],neg:['data wystawienia','wystawion','issue date','invoice date','termin platnosci','due date']},
 payment:{pos:['termin platnosci','data platnosci','platne do','payment due','due date','payment date'],neg:['data wystawienia','wystawion','issue date','invoice date','data sprzedazy','sale date']}
};
function bestDate(lines,type){
 const cfg=DATE_CFG[type],cands=[];
 for(let i=0;i<lines.length;i++)for(const d of dateTokens(lines[i])){
  let score=0,evidence=[],anchored=false;
  const ps=labelSpans(lines[i],cfg.pos),ns=labelSpans(lines[i],cfg.neg),pd=ps.length?Math.min(...ps.map(x=>spanDistance(d,x))):Infinity,nd=ns.length?Math.min(...ns.map(x=>spanDistance(d,x))):Infinity;
  if(pd<Infinity||nd<Infinity){
   if(pd<=nd){score+=Math.max(105,185-pd*.6);anchored=true;evidence.push(lines[i]);if(nd<Infinity&&nd<45)score-=Math.max(0,35-nd*.45)}
   else score-=Math.max(90,170-nd*.55);
  }
  for(let j=Math.max(0,i-4);j<=Math.min(lines.length-1,i+4);j++){
   if(j===i)continue;const delta=i-j,pp=positions(lines[j],cfg.pos),np=positions(lines[j],cfg.neg);
   if(pp.length){const add=delta>0?Math.max(26,122-Math.abs(delta)*22):Math.max(18,88-Math.abs(delta)*18);score+=add;evidence.push(lines[j])}
   if(np.length&&!anchored){const sub=delta>0?Math.max(20,62-Math.abs(delta)*18):Math.max(15,45-Math.abs(delta)*14);score-=sub}
  }
  if(type==='issue'&&i<30)score+=8;if(type==='payment'&&i>Math.floor(lines.length*.25))score+=5;
  cands.push({...d,line:i,score,evidence:evidence[0]||lines[i]});
 }
 if(!cands.length)return{value:'',confidence:0,evidence:'',ambiguous:false};
 cands.sort((a,b)=>b.score-a.score||a.line-b.line);let top=cands[0],second=cands.find(x=>x.value!==top.value);let conf=Math.max(0,Math.min(100,Math.round((top.score-30)/1.15)));
 if(top.score<35){
  const unique=[...new Set(cands.slice(0,20).map(x=>x.value))];
  if(type==='issue'){
   const header=cands.filter(x=>x.line<Math.min(lines.length,45)&&!DATE_CFG.sale.pos.some(k=>normalized(lines[x.line]||'').includes(k))&&!DATE_CFG.payment.pos.some(k=>normalized(lines[x.line]||'').includes(k)));
   const hu=[...new Set(header.map(x=>x.value))];
   if(hu.length===1){top=header[0];conf=48;top.evidence=lines[top.line]||top.evidence}
   else if(unique.length===1){top=cands[0];conf=42}
   else return{value:'',confidence:0,evidence:'',ambiguous:unique.length>1};
  }else return{value:'',confidence:0,evidence:'',ambiguous:unique.length>1};
 }
 const ambiguous=!!second&&second.score>=top.score-22;if(ambiguous)conf=Math.max(35,conf-15);
 return{value:top.value,confidence:conf,evidence:top.evidence,ambiguous};
}
function moneyTokens(line){
 const src=String(line||''),dateSpans=dateTokens(src),out=[];
 const re=/-?(?:\d{1,3}(?:[ .\u00a0'’]\d{3})+[,.]\d{2}|\d{1,3}(?:,\d{3})+\.\d{2}|\d+[,.]\d{2})(?!\d)/g;let m;
 while((m=re.exec(src))){const start=m.index,end=re.lastIndex;if(dateSpans.some(d=>start<d.end&&end>d.start))continue;if(/^\s*%/.test(src.slice(end,end+3)))continue;const value=moneyNumber(m[0]);if(Number.isFinite(value)&&Math.abs(value)<1e12)out.push({value,start,end,raw:m[0]})}
 return out;
}
function allAmounts(line){return moneyTokens(line).map(x=>x.value)}
function findNips(text){const out=[];for(const m of String(text||'').matchAll(/(?:\bNIP(?:\s*UE)?\b\s*[:#-]?\s*)?(?:PL\s*)?((?:\d[\s.-]*){10})(?!\d)/gi)){const n=m[1].replace(/\D/g,'');if(n.length===10&&!out.includes(n))out.push(n)}return out}
function bankAccounts(text){const out=[];for(const m of String(text||'').matchAll(/(?:\bPL\s*)?((?:\d[\s-]*){26})(?!\d)/gi)){const n=m[1].replace(/\D/g,'');if(n.length===26&&!out.includes(n))out.push(n)}return out}
function partySegment(lines,kind){
 const role=kind==='seller'?/(?:^|\b)(sprzedawca|wystawca|dostawca|seller)(?:\b|\s*:)/i:/(?:^|\b)(nabywca|kupujacy|kupujący|odbiorca|buyer)(?:\b|\s*:)/i;
 const other=kind==='seller'?/(?:^|\b)(nabywca|kupujacy|kupujący|odbiorca|buyer)(?:\b|\s*:)/i:/(?:^|\b)(sprzedawca|wystawca|dostawca|seller)(?:\b|\s*:)/i;
 const idx=lines.findIndex(x=>role.test(normalized(x)));if(idx<0)return[];let end=Math.min(lines.length,idx+18);for(let i=idx+1;i<end;i++){if(other.test(normalized(lines[i]))){end=i;break}}return lines.slice(idx,end)
}
const PARTY_STOP='(?:adres|nip(?:\s*ue)?|regon|krs|telefon|tel\\.?|e-?mail|konto|rachunek|iban|bank|numer\\s+faktury|nr\\s+faktury|data\\s+wystawienia|data\\s+sprzedazy|termin\\s+platnosci|sprzedawca|nabywca|wystawca|odbiorca|buyer|seller)';
function cleanPartyValue(v){return String(v||'').replace(/\s+/g,' ').replace(/^[\s:;,-]+|[\s:;,-]+$/g,'').trim()}
function labeledValue(text,label){
 const src=String(text||'').replace(/\r/g,'\n');
 // Najpierw trzymamy się pojedynczej linii, aby „Nazwa:” nie połknęła pól Adres/NIP z tego samego wiersza.
 const re1=new RegExp(`${label}\\s*[:#-]?\\s*([^\\n]{1,180}?)(?=\\s+${PARTY_STOP}\\s*[:#-]?|$)`,'i');
 let m=src.match(re1);if(m)return cleanPartyValue(m[1]);
 // Dopiero potem wariant wielowierszowy.
 const re2=new RegExp(`(?:^|[\\n])${label}\\s*[:#-]?\\s*([\\s\\S]{1,180}?)(?=[\\n]+${PARTY_STOP}\\s*[:#-]?|$)`,'i');
 m=src.match(re2);return m?cleanPartyValue(m[1]):'';
}
function plausiblePartyName(v){const n=normalized(v);if(!n||n.length<3||n.length>140)return false;if(/^(nazwa|adres|numer faktury|nr faktury|data|data wystawienia|data sprzedazy|termin platnosci|faktura|invoice|nip|regon|krs|rachunek|konto|bank|netto|brutto|vat|razem|kwota|do zaplaty)\b/.test(n))return false;if(/\b(numer faktury|data wystawienia|termin platnosci|razem netto|razem brutto|kwota vat|do zaplaty)\b/.test(n)||urlishLine(v)||/pl\/invoice\//i.test(v))return false;if(typeof plausibleInvoiceNumber==='function'&&plausibleInvoiceNumber(v))return false;if(/^\d[\d\s.,/-]*$/.test(v))return false;return /[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(v)}
function trimAddress(v){return cleanPartyValue(String(v||'').replace(/\b(?:NIP|REGON|KRS|Telefon|Tel\.?|E-?mail|Numer\s+faktury|Data\s+wystawienia)\b[\s\S]*$/i,''))}
function partyFromSegment(seg,fallbackNip=''){
 const txt=seg.join('\n'),nips=findNips(txt),nip=fallbackNip||nips[0]||'';
 let name=labeledValue(txt,'(?:nazwa(?:\\s+firmy)?|firma)');
 let address=trimAddress(labeledValue(txt,'adres(?:\\s+siedziby)?'));
 const email=(txt.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)||[])[0]||'';
 const phoneLine=seg.find(x=>/\b(tel\.?|telefon|phone)\b/i.test(normalized(x)))||'';const phone=(phoneLine.match(/(?:\+?48[\s-]*)?(?:\d[\s-]*){9}(?!\d)/)||[])[0]||'';
 const role=/^(sprzedawca|wystawca|dostawca|seller|nabywca|kupujacy|kupujący|odbiorca|buyer)\s*[:\-]?\s*/i;
 if(!name){
  const candidates=[];for(const raw of seg){const line=cleanPartyValue(String(raw||'').replace(role,''));if(!line)continue;const nm=labeledValue(line,'(?:nazwa(?:\\s+firmy)?|firma)');if(nm)candidates.push(nm);else candidates.push(line)}
  name=candidates.find(plausiblePartyName)||'';
 }
 if(!plausiblePartyName(name))name='';
 if(!address){const a=seg.filter(x=>/\b\d{2}-\d{3}\b/.test(x)||/\b(ul\.?|al\.?|aleja|plac|pl\.?|os\.?|rynek)\b/i.test(x)).map(trimAddress).filter(Boolean);address=a.slice(0,2).join(', ')}
 const postalMatch=address.match(/\b\d{2}-\d{3}\b[^,;]*/);let a1=address,a2='';if(postalMatch){const idx=address.indexOf(postalMatch[0]);a1=cleanPartyValue(address.slice(0,idx));a2=cleanPartyValue(address.slice(idx))}
 else{const postal=seg.find(x=>/\b\d{2}-\d{3}\b/.test(x))||'';const street=seg.find(x=>/\b(ul\.?|al\.?|aleja|plac|pl\.?|os\.?|rynek)\b/i.test(x))||'';if(!a1)a1=trimAddress(street);a2=trimAddress(postal&&postal!==street?postal:'')}
 return{name,nip,country:'PL',a1,a2,email,phone,_confidence:(nip?45:0)+(name?35:0)+(a1||a2?20:0)};
}
function nipRegex(nip){return new RegExp(nip.split('').map(x=>`${x}[\\s.\\-]*`).join(''),'i')}
function partyAroundNip(lines,nip){
 if(!nip)return partyFromSegment([],nip);const idx=lines.findIndex(x=>nipRegex(nip).test(x));if(idx<0)return partyFromSegment([],nip);
 const nipLines=[];for(let i=0;i<lines.length;i++)if(findNips(lines[i]).length)nipLines.push(i);const prev=[...nipLines].filter(i=>i<idx).pop(),next=nipLines.find(i=>i>idx);let start=Math.max(0,idx-5),end=Math.min(lines.length,idx+6);if(prev!==undefined&&idx-prev<=6)start=Math.max(start,prev+1);if(next!==undefined&&next-idx<=6)end=Math.min(end,next);const tight=lines.slice(start,end);
 const windows=[tight,lines.slice(Math.max(start,idx-2),Math.min(end,idx+4))];const parties=windows.map(x=>partyFromSegment(x,nip)).sort((a,b)=>(b._confidence||0)-(a._confidence||0));return parties[0]||partyFromSegment([],nip)
}
function invoiceTokenMeta(v){
 v=cleanPartyValue(v).replace(/[;,]+$/,'');const n=normalized(v),compact=v.replace(/[\s.-]/g,''),digitsOnly=v.replace(/\D/g,'');
 const iban=/^PL\d{26}$/i.test(compact)||/^\d{26}$/.test(compact);
 const longNumeric=/^\d{16,}$/.test(compact);
 const nipLike=/^\d{10}$/.test(compact),regonLike=/^(?:\d{9}|\d{14})$/.test(compact);
 const ksef=/^\d{10}-20\d{6}-[A-Z0-9]{12}-[A-Z0-9]{2}$/i.test(v);
 const auxiliary=/^(?:WZ|PZ|RW|PW|MM|LT|ZK|ZAM|ORD)(?:[-/.]?\d)/i.test(v);
 let quality=0;if(/[A-Z]/i.test(v)&&/\d/.test(v))quality+=18;if(/[\/]/.test(v))quality+=18;if(/20\d{2}/.test(v))quality+=8;if(v.length>=4&&v.length<=32)quality+=8;if(/^\d+$/.test(v))quality-=18;if(auxiliary)quality-=45;
 return{v,n,compact,digitsOnly,iban,longNumeric,nipLike,regonLike,ksef,auxiliary,quality};
}
function plausibleInvoiceNumber(v,opts={}){
 const m=invoiceTokenMeta(v);v=m.v;const n=m.n;
 if(v.length<2||v.length>80||!/[0-9]/.test(v))return false;
 if(urlishLine(v)||/pl\/invoice\//i.test(v)||/[?&](?:nip|date|hash)=/i.test(v))return false;
 if(m.ksef||m.iban||m.longNumeric||m.nipLike||m.regonLike)return false;
 if((opts.knownBanks||[]).some(x=>String(x).replace(/\D/g,'')===m.digitsOnly))return false;
 if((opts.knownNips||[]).some(x=>String(x).replace(/\D/g,'')===m.digitsOnly))return false;
 if(/^(wystawion|wystawiona|wystawiono|sprzedawca|nabywca|numer|faktura|invoice|data|vat|brutto|netto|nip|adres|ksef|rachunek|konto|iban|regon|krs)/.test(n))return false;
 if(/^20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(v)||/^\d{1,2}[-/.]\d{1,2}[-/.]20\d{2}$/.test(v))return false;
 const collapsed=v.replace(/[._\/-]/g,'');if(collapsed.length>32&&/^[A-Z0-9]+$/i.test(collapsed))return false;
 if(!/^[A-Z0-9][A-Z0-9._\/-]*$/i.test(v))return false;
 // Typowe dokumenty magazynowe nie są przyjmowane jako numer faktury z luźnego fallbacku.
 if(m.auxiliary&&!opts.directInvoiceLabel)return false;
 return true;
}
function invoiceNumber(lines,known={}){
 const cleanLines=lines.filter(x=>!urlishLine(x));const candidates=[];
 const labels=[/(?:nr|numer)\s*(?:faktury|f-?ry|dokumentu)?\s*[:#-]?/i,/(?:faktura(?:\s+vat)?|invoice)\s*(?:nr|no\.?|numer)\s*[:#-]?/i];
 const forbiddenContext=/\b(?:rachunek|konto|iban|bank|nip|regon|krs|swift|bic)\b/i;
 const add=(v,score,line,evidence,directInvoiceLabel=false)=>{v=cleanPartyValue(v).replace(/[;,]+$/,'');if(!plausibleInvoiceNumber(v,{knownBanks:known.banks||[],knownNips:known.nips||[],directInvoiceLabel}))return;const meta=invoiceTokenMeta(v);if(forbiddenContext.test(normalized(evidence||''))&&!directInvoiceLabel)return;candidates.push({v,score:score+meta.quality,line,evidence,directInvoiceLabel})};
 for(let i=0;i<cleanLines.length;i++){
  const line=cleanLines[i];
  for(const re of labels){const m=line.match(re);if(!m)continue;const tail=cleanPartyValue(line.slice((m.index||0)+m[0].length));
   // Najbardziej wiarygodny wariant: numer jest na tej samej linii dokładnie po etykiecie.
   if(tail){for(const tok of tail.split(/\s{2,}|\s+(?=(?:data|sprzedawca|nabywca|nip|adres|ksef|rachunek|konto|iban|bank)\b)/i)){const c=cleanPartyValue(tok.split(/\s+/)[0]);add(c,230-(m.index||0)*.1,i,line,true)}}
   // Jeśli etykieta stoi sama, sprawdzamy maksymalnie dwie następne linie. Nie skaczemy już o 5 wierszy.
   if(!tail){for(let j=i+1;j<=Math.min(cleanLines.length-1,i+2);j++){
     const next=cleanLines[j];if(urlishLine(next)||forbiddenContext.test(normalized(next)))continue;
     const parts=next.split(/\s{2,}/).map(cleanPartyValue).filter(Boolean);
     for(const part of parts.slice(0,2)){const c=part.split(/\s+/)[0];add(c,190-(j-i)*28,j,`${line} | ${next}`,false)}
   }}
  }
 }
 // Fallback tylko w linii jawnie mówiącej o fakturze. Dokumenty WZ/PZ itp. są tu odrzucane.
 for(let i=0;i<Math.min(cleanLines.length,70);i++){
  const l=cleanLines[i];if(!/\bfaktura\b|\binvoice\b/i.test(normalized(l))||forbiddenContext.test(normalized(l)))continue;
  for(const m of l.matchAll(/\b([A-Z]{0,10}[A-Z0-9]*[\/-][A-Z0-9._\/-]*\d[A-Z0-9._\/-]*)\b/gi))add(m[1],105,i,l,false);
 }
 if(!candidates.length)return{value:'',confidence:0,evidence:'',score:0};
 candidates.sort((a,b)=>b.score-a.score||a.line-b.line||a.v.length-b.v.length);const top=candidates[0],second=candidates.find(x=>x.v!==top.v);let confidence=Math.max(45,Math.min(100,Math.round((top.score-65)/1.55)));if(second&&second.score>=top.score-20)confidence=Math.max(45,confidence-18);
 return{value:top.v,confidence,evidence:top.evidence||'',score:top.score};
}
const AMOUNT_CFG={
 net:{labels:['razem netto','suma netto','wartosc netto','netto razem','net amount','subtotal','podstawa opodatkowania'],weak:['netto']},
 vat:{labels:['razem vat','suma vat','kwota vat','podatek vat','vat amount','tax amount'],weak:['vat','podatek']},
 gross:{labels:['do zaplaty','kwota do zaplaty','naleznosc ogolem','razem brutto','suma brutto','wartosc brutto','brutto razem','total due','amount due','grand total'],weak:['brutto','razem']}
};
function amountLabelCandidates(lines,field){
 const cfg=AMOUNT_CFG[field],out=[];
 for(let i=0;i<lines.length;i++){
  const toks=moneyTokens(lines[i]);if(!toks.length)continue;const n=normalized(lines[i]),strong=labelSpans(lines[i],cfg.labels),weak=labelSpans(lines[i],cfg.weak);
  for(const t of toks){let score=0,why='';if(strong.length){const dist=Math.min(...strong.map(x=>spanDistance(t,x)));score+=Math.max(90,175-dist*.6);why=lines[i]}else if(weak.length){const dist=Math.min(...weak.map(x=>spanDistance(t,x)));score+=Math.max(35,95-dist*.4);why=lines[i]}
   for(let j=Math.max(0,i-2);j<=Math.min(lines.length-1,i+1);j++){if(j===i)continue;const nn=normalized(lines[j]),hasStrong=cfg.labels.some(x=>nn.includes(x)),hasWeak=cfg.weak.some(x=>nn.includes(x));if(hasStrong)score+=j<i?105-28*(i-j-1):58;if(hasWeak)score+=j<i?48:25}
   if(/nip|regon|rachunek|konto|iban/.test(n))score-=85;if(/cena jednostkowa|ilosc|ilość/.test(n)&&field==='gross')score-=25;
   if(score>10)out.push({value:t.value,score,line:i,evidence:why||lines[i]});
  }
 }
 return out;
}
function summaryHeaderCandidates(lines){
 const out={net:[],vat:[],gross:[]};
 for(let i=0;i<lines.length;i++){
  const h=normalized(lines[i]),keys=[['net','netto'],['vat','vat'],['gross','brutto']].filter(([,w])=>h.includes(w));if(keys.length<2)continue;
  const ordered=keys.sort((a,b)=>h.indexOf(a[1])-h.indexOf(b[1])).map(x=>x[0]);
  for(let j=i;j<=Math.min(lines.length-1,i+2);j++){
   const ts=moneyTokens(lines[j]);if(ts.length<ordered.length)continue;let vals=ts;
   if(ts.length>ordered.length)vals=ts.slice(-ordered.length);
   ordered.forEach((k,idx)=>out[k].push({value:vals[idx].value,score:j===i?150:175-(j-i)*20,line:j,evidence:`${lines[i]} | ${lines[j]}`}));break;
  }
 }
 return out;
}
function closeMoney(a,b,tol=.03){a=Number(a);b=Number(b);return Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=Math.max(tol,Math.max(Math.abs(a),Math.abs(b))*.001)}
function vatGroups(lines){
 const out=[];
 for(const l of lines){const rm=l.match(/(?:stawka\s*)?(23|22|8|7|5|4|3|0)\s*%/i);if(!rm)continue;const a=moneyTokens(l).map(x=>x.value);if(a.length<2)continue;const rate=rm[1];let net,vat,gross;
  if(a.length>=3){[net,vat,gross]=a.slice(-3)}else{[net,vat]=a.slice(-2);gross=net+vat}
  if(net<0||gross<0||vat<0)continue;const expectedVat=net*Number(rate)/100;if(rate!=='0'&&!closeMoney(expectedVat,vat,Math.max(.08,Math.abs(vat)*.015)))continue;if(!closeMoney(net+vat,gross,Math.max(.08,Math.abs(gross)*.0015)))continue;
  const key=`${rate}:${net.toFixed(2)}:${vat.toFixed(2)}:${gross.toFixed(2)}`;if(!out.some(x=>x.key===key))out.push({key,rate,net,vat,gross})
 }
 return out.map(({key,...x})=>x).slice(0,30);
}
function uniqAmountCandidates(arr){const m=new Map();for(const x of arr){const k=Number(x.value).toFixed(2),prev=m.get(k);if(!prev||x.score>prev.score)m.set(k,x)}return[...m.values()].sort((a,b)=>b.score-a.score).slice(0,10)}
function resolveAmounts(lines,groups){
 const header=summaryHeaderCandidates(lines),c={net:amountLabelCandidates(lines,'net'),vat:amountLabelCandidates(lines,'vat'),gross:amountLabelCandidates(lines,'gross')};
 for(const k of ['net','vat','gross'])c[k].push(...header[k]);
 if(groups.length){const sums={net:groups.reduce((s,x)=>s+x.net,0),vat:groups.reduce((s,x)=>s+x.vat,0),gross:groups.reduce((s,x)=>s+x.gross,0)};for(const k of ['net','vat','gross'])c[k].push({value:sums[k],score:185,line:-1,evidence:'Suma matematycznie spójnych grup VAT'})}
 for(const k of ['net','vat','gross'])c[k]=uniqAmountCandidates(c[k]);
 let best=null;for(const n of c.net)for(const v of c.vat)for(const g of c.gross){let score=n.score+v.score+g.score;const err=Math.abs(g.value-(n.value+v.value)),rel=err/Math.max(1,Math.abs(g.value));if(err<=.03||rel<=.00025)score+=210;else if(rel<=.002)score+=150;else if(rel<=.01)score+=55;else score-=Math.min(220,rel*600);if(g.value<n.value||g.value<v.value)score-=120;if(n.value<0||v.value<0||g.value<0)score-=40;if(!best||score>best.score)best={n,v,g,score,rel}}
 let net=null,vat=null,gross=null,meta={net:0,vat:0,gross:0,evidence:{}};
 if(best){net=best.n.value;vat=best.v.value;gross=best.g.value;meta.net=Math.min(100,Math.round(best.n.score*.55));meta.vat=Math.min(100,Math.round(best.v.score*.55));meta.gross=Math.min(100,Math.round(best.g.score*.55));if(best.rel<=.002){meta.net=Math.max(meta.net,88);meta.vat=Math.max(meta.vat,88);meta.gross=Math.max(meta.gross,92)}meta.evidence={net:best.n.evidence,vat:best.v.evidence,gross:best.g.evidence}}
 else{
  const top=k=>c[k][0]||null,n=top('net'),v=top('vat'),g=top('gross');net=n?.value??null;vat=v?.value??null;gross=g?.value??null;if(gross==null&&net!=null&&vat!=null)gross=net+vat;if(net==null&&gross!=null&&vat!=null)net=gross-vat;if(vat==null&&gross!=null&&net!=null)vat=gross-net;meta.net=n?Math.min(82,Math.round(n.score*.5)):net!=null?55:0;meta.vat=v?Math.min(82,Math.round(v.score*.5)):vat!=null?55:0;meta.gross=g?Math.min(86,Math.round(g.score*.5)):gross!=null?55:0;meta.evidence={net:n?.evidence||'',vat:v?.evidence||'',gross:g?.evidence||''}
 }
 return{net,vat,gross,meta,candidates:c};
}
function detectCurrency(text){const upper=String(text||'').toUpperCase(),curr=['PLN','EUR','USD','GBP','CHF','CZK','SEK','NOK','DKK'];const counts=curr.map(c=>[c,(upper.match(new RegExp(`\\b${c}\\b`,'g'))||[]).length]).sort((a,b)=>b[1]-a[1]);if(counts[0][1])return counts[0][0];if(/\bZŁ\b|\bPLN\b/i.test(text))return'PLN';return'PLN'}
function partyQuality(p){return(p?.nip?40:0)+(p?.name?30:0)+(p?.a1||p?.a2?15:0)+(p?.email?5:0)+(p?.phone?5:0)}
function parseText(text){
 const lines=linesOf(text),verify=verificationMeta(text),contentLines=lines.filter(x=>!urlishLine(x)),contentText=contentLines.join('\n'),nips=findNips(contentText),sellerSeg=partySegment(contentLines,'seller'),buyerSeg=partySegment(contentLines,'buyer');
 const sellerNip=verify.sellerNip||nips[0]||'',buyerNip=nips.find(x=>x!==sellerNip)||'';
 const seller=sellerSeg.length?partyFromSegment(sellerSeg,sellerNip):partyAroundNip(contentLines,sellerNip);
 const buyer=buyerSeg.length?partyFromSegment(buyerSeg,buyerNip):partyAroundNip(contentLines,buyerNip);
 const banks=bankAccounts(contentText),numberInfo=invoiceNumber(contentLines,{banks,nips}),number=numberInfo.value,issue=bestDate(contentLines,'issue'),sale=bestDate(contentLines,'sale'),payment=bestDate(contentLines,'payment');
 if(verify.issueDate&&(!issue.value||issue.confidence<80||issue.value!==verify.issueDate)){issue.value=verify.issueDate;issue.confidence=98;issue.evidence='Link weryfikacyjny KSeF (QR): data wystawienia P_1';issue.ambiguous=false;issue.fromVerification=true}
 const groups=vatGroups(contentLines),resolved=resolveAmounts(contentLines,groups);let {net,vat,gross}=resolved;let rate='';if(groups.length===1)rate=groups[0].rate;else if(net&&vat!=null){const r=vat/net*100,known=[23,22,8,7,5,4,3,0],best=[...known].sort((a,b)=>Math.abs(a-r)-Math.abs(b-r))[0];if(Math.abs(best-r)<1.2)rate=String(best)}
 const currency=detectCurrency(contentText),t=normalized(contentText),mpp=/mechanizm\s+podzielonej\s+platnosci|split\s+payment/.test(t),reverse=/odwrotne\s+obciazenie|reverse\s+charge/.test(t),wdt=/\bwdt\b|wewnatrzwspolnotow/.test(t),exportSale=/\beksport\b|export\s+of\s+goods/.test(t),exempt=/zwolnion.*vat|stawka\s+zw\b/.test(t);
 const fc={number:numberInfo.confidence,date:issue.confidence,saleDate:sale.confidence,paymentDate:payment.confidence,net:resolved.meta.net,vat:resolved.meta.vat,gross:resolved.meta.gross};
 const core=(number?10*numberInfo.confidence/100:0)+(issue.value?10*issue.confidence/100:0)+(seller.nip?15:0)+(buyer.nip?15:0)+(seller.name?8:0)+(buyer.name?8:0)+(gross!=null?12*fc.gross/100:0)+(net!=null?7*fc.net/100:0)+(vat!=null?7*fc.vat/100:0)+(currency?4:0)+(banks.length?4:0);const confidence=Math.max(0,Math.min(100,Math.round(core)));
 const notes=[],warnings=[];
 if(!sellerSeg.length||!buyerSeg.length)notes.push('Brak jednoznacznych nagłówków Sprzedawca/Nabywca — strony ustalono na podstawie NIP i kontekstu.');
 if(!groups.length)notes.push('Nie znaleziono jednoznacznej tabeli stawek VAT — kwoty ustalono z podsumowania i zależności matematycznych.');
 if(issue.fromVerification)notes.push('Datę wystawienia potwierdzono na podstawie linku weryfikacyjnego KSeF zakodowanego w QR.');else if(issue.ambiguous&&issue.value)notes.push('W dokumencie jest kilka dat; datę wystawienia wybrano na podstawie etykiety i położenia.');
 if(!issue.value)warnings.push('Nie udało się wiarygodnie ustalić daty wystawienia.');else if(fc.date<55)warnings.push('Data wystawienia ma niską pewność odczytu — zweryfikuj ją w podglądzie PDF.');
 if(!number)warnings.push('Nie udało się wiarygodnie ustalić numeru faktury.');else if(fc.number<65)warnings.push('Numer faktury ma niską pewność odczytu — zweryfikuj go w podglądzie PDF.');
 if(!seller.nip||!buyer.nip)warnings.push('Nie udało się wiarygodnie ustalić NIP obu stron.');
 if(net==null||vat==null||gross==null)warnings.push('Nie udało się odczytać pełnego zestawu netto/VAT/brutto.');else if((fc.net&&fc.net<55)||(fc.vat&&fc.vat<55)||(fc.gross&&fc.gross<55))warnings.push('Co najmniej jedna z kwot netto/VAT/brutto ma niską pewność odczytu.');
 return{number,date:issue.value,saleDate:sale.value,paymentDate:payment.value,currency,seller,buyer,banks,net,vat,gross,rate,vatGroups:groups,mpp,reverse,wdt,export:exportSale,exempt,confidence,fieldConfidence:fc,fieldEvidence:{number:numberInfo.evidence,date:issue.evidence,saleDate:sale.evidence,paymentDate:payment.evidence,...resolved.meta.evidence},warnings,notes,verification:verify,linesCount:contentLines.length};
}
function mergeParses(parses){
 const arr=(parses||[]).filter(Boolean);if(!arr.length)return parseText('');let base=[...arr].sort((a,b)=>b.confidence-a.confidence)[0];base={...base,seller:{...base.seller},buyer:{...base.buyer},fieldConfidence:{...(base.fieldConfidence||{})},fieldEvidence:{...(base.fieldEvidence||{})}};
 const pickField=key=>[...arr].sort((a,b)=>(b.fieldConfidence?.[key]||0)-(a.fieldConfidence?.[key]||0))[0];
 for(const key of ['date','saleDate','paymentDate']){const p=pickField(key);if(p?.[key]&&(p.fieldConfidence?.[key]||0)>(base.fieldConfidence?.[key]||0)){base[key]=p[key];base.fieldConfidence[key]=p.fieldConfidence[key];base.fieldEvidence[key]=p.fieldEvidence?.[key]||''}}
 const numberSource=[...arr].sort((a,b)=>(b.fieldConfidence?.number||0)-(a.fieldConfidence?.number||0))[0];if(numberSource?.number&&(numberSource.fieldConfidence?.number||0)>=(base.fieldConfidence?.number||0)){base.number=numberSource.number;base.fieldConfidence.number=numberSource.fieldConfidence?.number||0;base.fieldEvidence.number=numberSource.fieldEvidence?.number||''}
 const amountSource=[...arr].sort((a,b)=>((b.fieldConfidence?.net||0)+(b.fieldConfidence?.vat||0)+(b.fieldConfidence?.gross||0))-((a.fieldConfidence?.net||0)+(a.fieldConfidence?.vat||0)+(a.fieldConfidence?.gross||0)))[0];if(amountSource){for(const k of ['net','vat','gross','rate','vatGroups'])base[k]=amountSource[k];for(const k of ['net','vat','gross']){base.fieldConfidence[k]=amountSource.fieldConfidence?.[k]||0;base.fieldEvidence[k]=amountSource.fieldEvidence?.[k]||''}}
 const sellerBest=[...arr].sort((a,b)=>partyQuality(b.seller)-partyQuality(a.seller))[0],buyerBest=[...arr].sort((a,b)=>partyQuality(b.buyer)-partyQuality(a.buyer))[0];if(sellerBest)base.seller=sellerBest.seller;if(buyerBest)base.buyer=buyerBest.buyer;
 base.banks=[...new Set(arr.flatMap(x=>x.banks||[]))];base.warnings=[...new Set(arr.flatMap(x=>x.warnings||[]))];base.notes=[...new Set(arr.flatMap(x=>x.notes||[]))];base.confidence=Math.max(...arr.map(x=>x.confidence||0),Math.round(((base.fieldConfidence.date||0)+(base.fieldConfidence.net||0)+(base.fieldConfidence.vat||0)+(base.fieldConfidence.gross||0))/4*.35+(base.confidence||0)*.65));base.extractionVariants=arr.length;return base;
}
function syntheticXml(d){
 const party=(tag,p)=>`<${tag}><DaneIdentyfikacyjne>${p?.nip?`<NIP>${xmlEsc(p.nip)}</NIP>`:''}<Nazwa>${xmlEsc(p?.name||'')}</Nazwa></DaneIdentyfikacyjne><Adres><KodKraju>${xmlEsc(p?.country||'PL')}</KodKraju><AdresL1>${xmlEsc(p?.a1||'')}</AdresL1><AdresL2>${xmlEsc(p?.a2||'')}</AdresL2></Adres>${p?.email?`<DaneKontaktowe><Email>${xmlEsc(p.email)}</Email>${p?.phone?`<Telefon>${xmlEsc(p.phone)}</Telefon>`:''}</DaneKontaktowe>`:''}</${tag}>`;
 let groups=(d.vatGroups||[]).slice();if(!groups.length&&(d.net!=null||d.gross!=null)){const n=Number(d.net||0),v=Number(d.vat||0),g=Number(d.gross??(n+v));groups=[{rate:d.rate||'',net:n,vat:v,gross:g}]}
 const rows=groups.map((x,i)=>`<FaWiersz><NrWierszaFa>${i+1}</NrWierszaFa><P_7>${xmlEsc(groups.length>1?`Podsumowanie VAT ${x.rate}%`:'Pozycja/podsumowanie odczytane z PDF')}</P_7><P_8A>poz.</P_8A><P_8B>1</P_8B><P_9A>${n2(x.net)}</P_9A><P_11>${n2(x.net)}</P_11><P_11A>${n2(x.gross)}</P_11A><P_11Vat>${n2(x.vat)}</P_11Vat><P_12>${xmlEsc(d.wdt?'0 WDT':d.export?'0 EX':d.exempt?'zw':x.rate||d.rate||'')}</P_12></FaWiersz>`).join('');
 const pay=(d.paymentDate||d.banks?.length)?`<Platnosc>${d.paymentDate?`<TerminPlatnosci><Termin>${xmlEsc(d.paymentDate)}</Termin></TerminPlatnosci>`:''}${(d.banks||[]).map(n=>`<RachunekBankowy><NrRB>${xmlEsc(n)}</NrRB></RachunekBankowy>`).join('')}</Platnosc>`:'';
 return `<?xml version="1.0" encoding="UTF-8"?><Faktura><Naglowek><SystemInfo>PDF_IMPORT</SystemInfo></Naglowek>${party('Podmiot1',d.seller)}${party('Podmiot2',d.buyer)}<Fa><KodWaluty>${xmlEsc(d.currency||'PLN')}</KodWaluty><P_1>${xmlEsc(d.date||'')}</P_1><P_2>${xmlEsc(d.number||'')}</P_2>${d.saleDate?`<P_6>${xmlEsc(d.saleDate)}</P_6>`:''}${d.gross!=null?`<P_15>${n2(d.gross)}</P_15>`:''}<Adnotacje><P_18>${d.reverse?'1':'2'}</P_18><P_18A>${d.mpp?'1':'2'}</P_18A></Adnotacje><RodzajFaktury>VAT</RodzajFaktury>${rows}${pay}</Fa></Faktura>`;
}
function addCheck(C,type,category,title,desc,field='',fix=''){C.push({type,category,title,desc,field,fix})}
function ruleChecksPdf(doc){
 const C=[],inv=invoice(doc),d=state.pdfData||{},src='PDF';
 addCheck(C,'info','pdf','Tryb PDF — kontrola treści','Dokument nie jest strukturą FA(3). Checker weryfikuje dane odczytane z PDF, matematykę, kontrahentów i rejestry, ale nie może potwierdzić XSD ani pól KSeF.','PDF','Dla pełnej kontroli KSeF użyj oryginalnego XML FA(3).');
 const c=Number(d.confidence||0);addCheck(C,c>=80?'ok':c>=55?'warn':'warn','pdf','Pewność odczytu PDF',`Wskaźnik kompletności odczytu: ${c}%. ${c>=80?'Najważniejsze pola zostały znalezione.':'Zweryfikuj pola w sekcji „Dane rozpoznane z faktury”.'}`,'PDF / ekstrakcja');
 addCheck(C,inv.number?'ok':'warn',inv.number?'structure':'pdf','Numer faktury',inv.number?`Odczytano: ${inv.number}.`:'Nie udało się jednoznacznie odczytać numeru faktury z warstwy tekstowej PDF.','PDF / numer faktury','Otwórz szczegóły i porównaj z wizualizacją; link QR ani numer KSeF nie są numerem P_2.');
 addCheck(C,isoDate(inv.date)?'ok':'warn',isoDate(inv.date)?'structure':'pdf','Data wystawienia',isoDate(inv.date)?`Odczytano: ${inv.date}${d.verification?.issueDate===inv.date?' (potwierdzono linkiem QR KSeF)':''}.`:'Nie udało się odczytać daty wystawienia.','PDF / data wystawienia');
 addCheck(C,/^[A-Z]{3}$/.test(inv.currency)?'ok':'warn','structure','Waluta',inv.currency?`Odczytano: ${inv.currency}.`:'Nie udało się ustalić waluty.','PDF / waluta');
 for(const [label,p] of [['sprzedawcy',inv.seller],['nabywcy',inv.buyer]]){addCheck(C,p.name?'ok':'warn',p.name?'id':'pdf',`Nazwa ${label}`,p.name?`Odczytano: ${p.name}.`:`Nie udało się odczytać nazwy ${label}.`,`PDF / ${label}`);if(p.nip)addCheck(C,nipOk(p.nip)?'ok':'error','id',`NIP ${label}`,nipOk(p.nip)?`NIP ${p.nip} ma poprawną sumę kontrolną.`:`NIP ${p.nip} nie przechodzi sumy kontrolnej.`,`PDF / NIP ${label}`);else addCheck(C,'warn','pdf',`NIP ${label}`,`Nie udało się odczytać NIP ${label}.`,`PDF / NIP ${label}`)}
 if(inv.rows.length)addCheck(C,'ok','math','Dane kwotowe / stawki VAT',`Utworzono ${inv.rows.length} grup/pozycji na podstawie tabeli lub podsumowania VAT w PDF.`,'PDF / kwoty');else addCheck(C,'warn','pdf','Dane kwotowe / stawki VAT','Nie udało się utworzyć pozycji ani grup VAT z PDF.','PDF / kwoty');
 inv.rows.forEach((r,i)=>{if(/^\d+(?:[.,]\d+)?$/.test(r.rate||'')&&r.net&&r.vat){const expected=num(r.net)*num(r.rate)/100;addCheck(C,close(expected,r.vat,.1)?'ok':'warn','math',`VAT ${r.rate}% — grupa ${i+1}`,close(expected,r.vat,.1)?'Kwota VAT jest matematycznie spójna.':`Z netto wynika około ${expected.toFixed(2)}, odczytano VAT ${num(r.vat).toFixed(2)}.`,'PDF / podsumowanie VAT')}});
 const sumGross=inv.rows.reduce((s,r)=>s+num(r.gross||r.net)+(!r.gross?num(r.vat):0),0);if(inv.total&&inv.rows.length)addCheck(C,close(sumGross,inv.total,.15)?'ok':'warn','math','Suma brutto',close(sumGross,inv.total,.15)?`Suma odczytanych grup = ${num(inv.total).toFixed(2)} ${inv.currency}.`:`Suma grup ≈ ${sumGross.toFixed(2)}, kwota końcowa ${num(inv.total).toFixed(2)}.`,'PDF / brutto');
 if(inv.banks.length)inv.banks.forEach(b=>addCheck(C,/^\d{26}$/.test(String(b.nr||'').replace(/\D/g,''))?'ok':'warn','payment','Format rachunku bankowego',`Odczytano rachunek: ${b.nr}.`,'PDF / rachunek'));else addCheck(C,'info','payment','Rachunek bankowy','Nie znaleziono rachunku bankowego w odczytanym tekście PDF.','PDF / rachunek');
 if(isoDate(inv.date)&&isoDate(inv.saleDate)){const dl=standardInvoiceDeadline(inv.saleDate);addCheck(C,inv.date<=dl?'ok':'warn','deadline','Termin wystawienia — zasada ogólna',`Data wystawienia ${inv.date}; standardowy termin do ${dl}.`,'PDF / daty','Przy terminach szczególnych wymagana jest odrębna analiza.');}
 if(num(inv.total)>15000&&!d.mpp)addCheck(C,'info','tax','MPP — faktura powyżej 15 000 zł','Kwota przekracza 15 000 zł, ale sam PDF nie pozwala wiarygodnie ustalić, czy pozycje należą do załącznika nr 15. Brak napisu MPP nie jest automatycznie klasyfikowany jako błąd.','PDF / MPP','Sprawdź rodzaj towaru/usługi i obowiązek MPP.');
 if(d.mpp)addCheck(C,'ok','tax','Adnotacja MPP w PDF','W treści dokumentu znaleziono „mechanizm podzielonej płatności” / split payment.','PDF / MPP');
 if((d.warnings||[]).length)addCheck(C,'warn','pdf','Odczyt PDF wymaga weryfikacji',(d.warnings||[]).join(' '),'PDF / ekstrakcja','Sprawdź wskazane pola w podglądzie i w razie potrzeby użyj edycji odczytu.');
 if((d.notes||[]).length)addCheck(C,'info','pdf','Sposób odczytu PDF',(d.notes||[]).join(' '),'PDF / ekstrakcja');
 return C;
}
function fieldConf(d,k){const c=Number(d.fieldConfidence?.[k]||0);return c?`<small class="pdf-field-confidence ${c>=80?'ok':c>=60?'warn':'low'}">${c}%</small>`:''}function summaryHtml(d){const f=(v,empty='—')=>v!==null&&v!==undefined&&String(v)!==''?esc(String(v)):empty;return `<div><span>Numer</span><b>${f(d.number)}</b></div><div><span>Data wystawienia ${fieldConf(d,'date')}</span><b>${f(d.date)}</b></div><div><span>Sprzedawca</span><b>${f(d.seller?.name)}${d.seller?.nip?` · NIP ${esc(d.seller.nip)}`:''}</b></div><div><span>Nabywca</span><b>${f(d.buyer?.name)}${d.buyer?.nip?` · NIP ${esc(d.buyer.nip)}`:''}</b></div><div><span>Netto ${fieldConf(d,'net')} / VAT ${fieldConf(d,'vat')} / brutto ${fieldConf(d,'gross')}</span><b>${d.net!=null?money(d.net,d.currency):'—'} / ${d.vat!=null?money(d.vat,d.currency):'—'} / ${d.gross!=null?money(d.gross,d.currency):'—'}</b></div><div><span>Rachunek</span><b>${f(d.banks?.[0])}</b></div>`}
function fillEdit(d){const m={pdfEditNumber:d.number||'',pdfEditDate:d.date||'',pdfEditSaleDate:d.saleDate||'',pdfEditCurrency:d.currency||'PLN',pdfEditSellerName:d.seller?.name||'',pdfEditSellerNip:d.seller?.nip||'',pdfEditBuyerName:d.buyer?.name||'',pdfEditBuyerNip:d.buyer?.nip||'',pdfEditNet:d.net??'',pdfEditVat:d.vat??'',pdfEditGross:d.gross??'',pdfEditRate:d.rate||d.vatGroups?.[0]?.rate||'',pdfEditBank:d.banks?.[0]||'',pdfEditPaymentDate:d.paymentDate||''};Object.entries(m).forEach(([id,v])=>{const e=document.getElementById(id);if(e)e.value=v})}
function renderReview(){const box=document.getElementById('pdfReviewCard');if(!box||state.inputType!=='pdf'||!state.pdfData)return;const d=state.pdfData;box.classList.remove('hidden');document.getElementById('pdfReviewSummary').innerHTML=summaryHtml(d);const badge=document.getElementById('pdfConfidenceBadge'),c=Number(d.confidence||0);badge.className=`pdf-confidence ${c>=80?'high':c>=55?'medium':'low'}`;badge.textContent=`Kompletność ${c}%`;document.getElementById('pdfRawText').textContent=(state.pdfRawText||'').slice(0,30000);fillEdit(d);const ey=document.getElementById('contractorDataSourceEyebrow');if(ey)ey.textContent='Dane stron odczytane z PDF + weryfikacja rejestrowa'}
function hideReview(){document.getElementById('pdfReviewCard')?.classList.add('hidden');const ey=document.getElementById('contractorDataSourceEyebrow');if(ey)ey.textContent='Dane stron z XML + weryfikacja rejestrowa'}
function pdfPreviewUrl(){const u=String(state.pdfData?.previewUrl||'').trim();if(u)return u;const id=String(state.pdfData?.previewId||'').trim();if(id)return `/api/pdf/view/${encodeURIComponent(id)}`;return state.pdfObjectUrl||''}
function renderPreview(force=false){const frame=document.getElementById('officialPreviewFrame'),badge=document.getElementById('officialPreviewBadge'),title=document.getElementById('previewTitle'),desc=document.getElementById('previewDescription'),notice=document.getElementById('officialPreviewNotice'),open=document.getElementById('pdfPreviewOpenBtn'),reload=document.getElementById('pdfPreviewReloadBtn');if(!frame||state.inputType!=='pdf')return;const base=pdfPreviewUrl();frame.classList.add('hidden');if(title)title.textContent='Oryginalny PDF';if(desc)desc.textContent='Podgląd jest renderowany lokalnie bezpośrednio z oryginalnego pliku PDF przesłanego do Checkera.';if(badge)badge.textContent='ORYGINALNY PDF · PDF.js LOCAL';if(open){open.classList.toggle('hidden',!base);open.onclick=()=>{if(base)window.open(base,'_blank','noopener')}}if(reload){reload.classList.toggle('hidden',!base);reload.onclick=()=>renderPreview(true)}if(!base){window.pdfCanvasPreview?.reset?.();if(notice){notice.classList.remove('hidden');notice.innerHTML='<b>Podgląd PDF jest chwilowo niedostępny.</b><span>Spróbuj ponownie otworzyć dokument albo użyj przycisku „Otwórz PDF”.</span>'}return}if(notice)notice.classList.add('hidden');window.pdfCanvasPreview?.render?.(base,{force})}

async function handleFile(file){
 if(location.protocol==='file:'){alert('Analiza PDF wymaga lokalnego serwera. Uruchom projekt przez START_CHECKER.bat.');return}
 if(file.size>20*1024*1024){alert('PDF jest większy niż 20 MB.');return}
 const dz=document.getElementById('dropZone');dz?.classList.add('pdf-loading');const old=dz?.querySelector('.file-hint')?.textContent;if(dz?.querySelector('.file-hint'))dz.querySelector('.file-hint').textContent='Odczytuję tekst z PDF na lokalnym serwerze…';
 try{const dataUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=()=>reject(r.error);r.onload=()=>resolve(String(r.result||''));r.readAsDataURL(file)}),base64=dataUrl.slice(dataUrl.indexOf(',')+1);const res=await fetch('/api/pdf/extract',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:file.name,data:base64})}),j=await res.json().catch(()=>({}));if(!res.ok)throw new Error(j.error||`HTTP ${res.status}`);if(!j.hasText){throw new Error('Ten PDF wygląda na skan lub obraz bez warstwy tekstowej. Wersja 2.2 nie wykonuje jeszcze OCR. Użyj PDF wygenerowanego cyfrowo albo XML FA(3).')}
  const variants=[j.layoutText,j.text].filter((x,i,a)=>String(x||'').trim()&&a.indexOf(x)===i),parsed=variants.map(parseText);const d=mergeParses(parsed);d.pages=j.pages||0;d.engine=j.engine||'';d.fileSize=j.size||file.size;d.extractionVariants=parsed.length;d.previewId=j.previewId||'';d.previewUrl=j.previewUrl||'';state.pdfData=d;state.pdfRawText=j.layoutText||j.text;if(state.pdfObjectUrl){try{URL.revokeObjectURL(state.pdfObjectUrl)}catch{}}state.pdfObjectUrl=URL.createObjectURL(file);parseXml(syntheticXml(d),file.name,null,'pdf');
 }catch(e){alert(`Nie udało się przeanalizować PDF:\n${e?.message||e}`)}finally{dz?.classList.remove('pdf-loading');if(dz?.querySelector('.file-hint')&&old)dz.querySelector('.file-hint').textContent=old}
}
function partyAddressStrong(p){const a=[p?.a1,p?.a2].filter(Boolean).join(' ');return /\b\d{2}-\d{3}\b/.test(a)||/\b(ul\.?|al\.?|aleja|plac|pl\.?|os\.?|rynek)\b/i.test(a)}
function adaptChecks(checks){return (checks||[]).map(c=>{let desc=String(c.desc||'').replace(/\bXML\b/g,'PDF').replace(/Z PDF nie można zbudować/g,'Z PDF nie udało się zbudować'),fix=String(c.fix||'').replace(/\bXML\b/g,'PDF');let field=String(c.field||''),type=c.type;const title=String(c.title||'').toLowerCase();if(/^Fa\//.test(field))field='PDF / '+field.split('/').slice(-1)[0];else if(/^Podmiot[12]/.test(field))field='PDF / dane kontrahenta';if(state.inputType==='pdf'&&state.pdfData){const side=/nabywca/.test(title)?'buyer':'seller',p=state.pdfData?.[side]||{};if(title.startsWith('nazwa —')){if(!plausiblePartyName(p.name)){type='info';desc='Nazwa odczytana z PDF nie jest wystarczająco pewna do automatycznego porównania z rejestrem. Dane rejestrowe pokażemy jako punkt odniesienia.'}else if(type==='error'){type='warn';desc='Nazwa odczytana z PDF różni się od Białej Listy. Przy PDF traktujemy to jako ostrzeżenie do porównania, nie twardy błąd dokumentu.'}}if(title.startsWith('adres —')){if(!partyAddressStrong(p)){type='info';desc='Adres z PDF nie został odczytany wystarczająco pewnie, dlatego różnica względem rejestru nie jest liczona jako ostrzeżenie faktury.'}else if(type==='error'){type='warn';desc='Adres odczytany z PDF jest bardzo podobny, ale nieidentyczny z rejestrem. Przy imporcie PDF wymaga to ręcznego porównania.'}}}return{...c,type,desc,fix,field}})}
function loadAnalyzed(file,d,rawText=''){if(!file||!d)return;if(state.pdfObjectUrl){try{URL.revokeObjectURL(state.pdfObjectUrl)}catch{}}state.pdfData={...d,seller:{...(d.seller||{})},buyer:{...(d.buyer||{})},banks:[...(d.banks||[])],vatGroups:[...(d.vatGroups||[])]};state.pdfRawText=String(rawText||'');state.pdfObjectUrl=URL.createObjectURL(file);parseXml(syntheticXml(state.pdfData),file.name,null,'pdf')}
function applyEdits(){if(state.inputType!=='pdf'||!state.pdfData)return;const d=state.pdfData,gv=id=>document.getElementById(id)?.value?.trim()||'';d.number=gv('pdfEditNumber');d.date=gv('pdfEditDate');d.saleDate=gv('pdfEditSaleDate');d.currency=(gv('pdfEditCurrency')||'PLN').toUpperCase();d.seller={...(d.seller||{}),name:gv('pdfEditSellerName'),nip:gv('pdfEditSellerNip').replace(/\D/g,'')};d.buyer={...(d.buyer||{}),name:gv('pdfEditBuyerName'),nip:gv('pdfEditBuyerNip').replace(/\D/g,'')};d.net=moneyNumber(gv('pdfEditNet'));d.vat=moneyNumber(gv('pdfEditVat'));d.gross=moneyNumber(gv('pdfEditGross'));d.rate=gv('pdfEditRate');d.banks=gv('pdfEditBank')?[gv('pdfEditBank').replace(/\D/g,'')]:[];d.paymentDate=gv('pdfEditPaymentDate');d.vatGroups=d.rate&&d.net!=null?[{rate:d.rate,net:Number(d.net||0),vat:Number(d.vat||0),gross:Number(d.gross??(Number(d.net||0)+Number(d.vat||0)))}]:d.vatGroups;d.confidence=Math.max(Number(d.confidence||0),85);parseXml(syntheticXml(d),state.fileName,null,'pdf');document.getElementById('pdfEditDetails').open=false}
function init(){document.getElementById('pdfApplyEdits')?.addEventListener('click',applyEdits);document.getElementById('pdfSampleBtn')?.addEventListener('click',async()=>{try{const r=await fetch('samples/17_pdf_test_invoice.pdf',{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);const b=await r.blob(),f=new File([b],'17_pdf_test_invoice.pdf',{type:'application/pdf'});await handleFile(f)}catch(e){alert(`Nie udało się otworzyć przykładowego PDF: ${e?.message||e}`)}})}
window.pdfImport={handleFile,loadAnalyzed,parseText,mergeParses,syntheticXml,ruleChecks:ruleChecksPdf,renderReview,hideReview,renderPreview,pdfPreviewUrl,applyEdits,adaptChecks,plausiblePartyName,verificationMeta,plausibleInvoiceNumber};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
