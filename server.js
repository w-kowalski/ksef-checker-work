'use strict';
const http=require('http');
const fs=require('fs');
const path=require('path');
const {exec,execFile}=require('child_process');
const crypto=require('crypto');
const os=require('os');
const ROOT=__dirname;
const HOST='127.0.0.1';
const BASE_PORT=Number(process.env.PORT||8787);
const MAX_PORT_TRIES=20;
const cache=new Map();
// Temporary in-memory PDF store used only by the local preview on 127.0.0.1.
// This avoids browser blob: URL issues in embedded PDF viewers, especially after batch analysis.
const PDF_PREVIEW_STORE=new Map();
const PDF_PREVIEW_MAX_ITEMS=60;
const PDF_PREVIEW_MAX_BYTES=160*1024*1024;
let pdfPreviewBytes=0;
function evictPdfPreviews(){
 while(PDF_PREVIEW_STORE.size>PDF_PREVIEW_MAX_ITEMS||pdfPreviewBytes>PDF_PREVIEW_MAX_BYTES){
  const first=PDF_PREVIEW_STORE.keys().next().value;if(!first)break;
  const x=PDF_PREVIEW_STORE.get(first);pdfPreviewBytes-=x?.buf?.length||0;PDF_PREVIEW_STORE.delete(first);
 }
}
function storePdfPreview(buf,name){
 const id=crypto.randomBytes(16).toString('hex');
 PDF_PREVIEW_STORE.set(id,{buf,name:clean(name)||'faktura.pdf',at:Date.now()});pdfPreviewBytes+=buf.length;evictPdfPreviews();return id;
}
function servePdfPreview(req,res,id){
 const x=PDF_PREVIEW_STORE.get(id);if(!x)return send(res,404,'PDF preview expired','text/plain; charset=utf-8');
 x.at=Date.now();const buf=x.buf,total=buf.length,range=req.headers.range;
 const baseHeaders={'Content-Type':'application/pdf','Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(x.name)}`,'Accept-Ranges':'bytes','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
 if(req.method==='HEAD'){res.writeHead(200,{...baseHeaders,'Content-Length':total});res.end();return}
 if(range){const m=String(range).match(/bytes=(\d*)-(\d*)/);if(m){let start=m[1]?Number(m[1]):0,end=m[2]?Number(m[2]):total-1;if(!m[1]&&m[2]){const n=Number(m[2]);start=Math.max(0,total-n);end=total-1}start=Math.max(0,start);end=Math.min(total-1,end);if(start<=end){res.writeHead(206,{...baseHeaders,'Content-Range':`bytes ${start}-${end}/${total}`,'Content-Length':end-start+1});res.end(buf.subarray(start,end+1));return}}}
 res.writeHead(200,{...baseHeaders,'Content-Length':total});res.end(buf);
}

const EU=new Set(['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','EL','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','XI']);
const MIME={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.mjs':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.pdf':'application/pdf'};
const clean=s=>String(s??'').trim();
const digits=s=>clean(s).replace(/\D/g,'');
const bankClean=s=>clean(s).toUpperCase().replace(/^PL/,'').replace(/[^0-9]/g,'');
const iso=s=>/^\d{4}-\d{2}-\d{2}$/.test(clean(s));
const round2=n=>Math.round((Number(n)+Number.EPSILON)*100)/100;
const add=(arr,type,category,title,desc,field='',fix='')=>arr.push({type,category,title,desc,field,fix});


// --- FA(3) XSD validation ---
const XSD_DIR=path.join(ROOT,'schemas','fa3');
const XSD_MAIN=path.join(XSD_DIR,'schemat_FA(3)_v1-0E.xsd');
const XSD_SOURCE_PAGE='https://ksef.podatki.gov.pl/informacje-ogolne-ksef-20/struktura-logiczna-fa-3/';
const XSD_FILES=[
 {name:'schemat_FA(3)_v1-0E.xsd',urls:['https://crd.gov.pl/wzor/2025/06/25/13775/schemat.xsd','https://raw.githubusercontent.com/CIRFMF/ksef-api/main/faktury/schemy/FA/schemat_FA%283%29_v1-0E.xsd']},
 {name:'StrukturyDanych_v10-0E.xsd',urls:['https://crd.gov.pl/xml/schematy/dziedzinowe/mf/2022/01/05/eD/DefinicjeTypy/StrukturyDanych_v10-0E.xsd','https://raw.githubusercontent.com/CIRFMF/ksef-api/main/faktury/schemy/FA/StrukturyDanych_v10-0E.xsd']},
 {name:'ElementarneTypyDanych_v10-0E.xsd',urls:['https://crd.gov.pl/xml/schematy/dziedzinowe/mf/2022/01/05/eD/DefinicjeTypy/ElementarneTypyDanych_v10-0E.xsd','https://raw.githubusercontent.com/CIRFMF/ksef-api/main/faktury/schemy/FA/ElementarneTypyDanych_v10-0E.xsd']},
 {name:'KodyKrajow_v10-0E.xsd',urls:['https://crd.gov.pl/xml/schematy/dziedzinowe/mf/2022/01/05/eD/DefinicjeTypy/KodyKrajow_v10-0E.xsd','https://raw.githubusercontent.com/CIRFMF/ksef-api/main/faktury/schemy/FA/KodyKrajow_v10-0E.xsd']}
];
let xsdLastAttempt=0,xsdLastResult=null;
function xsdLocalStatus(){
 const files=XSD_FILES.map(x=>{const f=path.join(XSD_DIR,x.name);let size=0;try{size=fs.statSync(f).size}catch{}return{name:x.name,exists:size>200,size}});
 return{available:files.every(x=>x.exists),files,main:XSD_MAIN,sourceUrl:XSD_SOURCE_PAGE};
}
function localizeSchemaLocations(text){
 return String(text||'').replace(/schemaLocation=(['"])(?:https?:\/\/[^'"]*\/)?([^\/'"]+\.xsd)\1/gi,(m,q,name)=>`schemaLocation=${q}${name}${q}`);
}
async function ensureFa3Schemas(force=false){
 fs.mkdirSync(XSD_DIR,{recursive:true});
 const local=xsdLocalStatus();if(!force&&local.available)return{...local,downloaded:false};
 if(!force&&xsdLastResult&&Date.now()-xsdLastAttempt<5*60*1000)return xsdLastResult;
 xsdLastAttempt=Date.now();const errors=[];
 await Promise.all(XSD_FILES.map(async item=>{
  const f=path.join(XSD_DIR,item.name);let good=false;if(!force){try{good=fs.statSync(f).size>200}catch{}}if(good)return;
  for(const url of item.urls){try{const r=await fetchTimed(url,{headers:{Accept:'application/xml,text/xml,*/*'}},6000);if(!r.ok||!/<(?:xsd|xs):schema\b/i.test(r.text))throw new Error(`HTTP ${r.status}`);fs.writeFileSync(f,localizeSchemaLocations(r.text),'utf8');good=true;break}catch(e){errors.push(`${item.name}: ${url} — ${e?.message||e}`)}}
 }));
 const status=xsdLocalStatus();xsdLastResult={...status,downloaded:status.available,errors:status.available?[]:errors.slice(-8)};return xsdLastResult;
}

function execFileP(file,args,opts={}){return new Promise((resolve,reject)=>execFile(file,args,{...opts,maxBuffer:4*1024*1024},(err,stdout,stderr)=>err?reject(Object.assign(err,{stdout,stderr})):resolve({stdout,stderr})))}
function jsonFromProcess(stdout){const t=String(stdout||'').trim();const lines=t.split(/\r?\n/).filter(Boolean);for(let i=lines.length-1;i>=0;i--){try{return JSON.parse(lines[i])}catch{}}throw new Error('Walidator nie zwrócił poprawnego JSON.');}
async function validateFa3Xml(xml){
 if(!xml||typeof xml!=='string')throw new Error('Brak XML do walidacji.');
 if(Buffer.byteLength(xml,'utf8')>10_000_000)throw new Error('XML jest większy niż 10 MB — walidacja w prototypie została przerwana.');
 const schema=await ensureFa3Schemas(false);if(!schema.available)return{available:false,ok:null,errors:schema.errors||[],engine:'unavailable',sourceUrl:XSD_SOURCE_PAGE,schemaCached:false};
 const tmp=path.join(os.tmpdir(),`checker-fa3-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.xml`);fs.writeFileSync(tmp,xml,'utf8');
 try{
  let out;
  if(process.platform==='win32'){
   const ps=path.join(ROOT,'validate_xsd.ps1');out=await execFileP('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',ps,'-XmlPath',tmp,'-XsdPath',XSD_MAIN],{cwd:ROOT});
  }else{
   const py=`import json,sys\nfrom lxml import etree\ntry:\n s=etree.parse(sys.argv[2]); schema=etree.XMLSchema(s); doc=etree.parse(sys.argv[1]); ok=schema.validate(doc); errs=[{'line':e.line,'message':e.message} for e in schema.error_log][:50]; print(json.dumps({'ok':ok,'errors':errs,'engine':'lxml'},ensure_ascii=False))\nexcept Exception as e:\n print(json.dumps({'ok':False,'errors':[{'line':0,'message':str(e)}],'engine':'lxml'},ensure_ascii=False))`;
   out=await execFileP('python3',['-c',py,tmp,XSD_MAIN],{cwd:ROOT});
  }
  const result=jsonFromProcess(out.stdout);return{available:true,ok:!!result.ok,errors:Array.isArray(result.errors)?result.errors:[],engine:result.engine||'XSD',sourceUrl:XSD_SOURCE_PAGE,schemaCached:true};
 }catch(e){return{available:false,ok:null,errors:[{line:0,message:e?.stderr||e?.message||String(e)}],engine:'error',sourceUrl:XSD_SOURCE_PAGE,schemaCached:true};}
 finally{try{fs.unlinkSync(tmp)}catch{}}
}

async function fetchTimed(url,options={},timeout=10000){
 const key=options.method==='POST'?null:`GET:${url}`;
 if(key){const hit=cache.get(key);if(hit&&Date.now()-hit.at<15*60*1000)return hit.value;}
 const ac=new AbortController();const t=setTimeout(()=>ac.abort(),timeout);
 try{
  const res=await fetch(url,{...options,signal:ac.signal,headers:{'User-Agent':'KSeF-Checker-Pro/2.5.1',...(options.headers||{})}});
  const text=await res.text();
  const value={status:res.status,ok:res.ok,text,headers:res.headers};
  if(key&&res.ok)cache.set(key,{at:Date.now(),value});
  return value;
 }finally{clearTimeout(t)}
}
async function getJson(url){
 const r=await fetchTimed(url,{headers:{Accept:'application/json'}});
 let data=null;try{data=JSON.parse(r.text)}catch{}
 if(!r.ok){const e=new Error(data?.message||data?.exception?.message||`HTTP ${r.status}`);e.status=r.status;throw e;}
 return data;
}
async function whiteListSearch(nip,date){
 if(!/^\d{10}$/.test(nip)||!iso(date))return null;
 const u=`https://wl-api.mf.gov.pl/api/search/nip/${encodeURIComponent(nip)}?date=${encodeURIComponent(date)}`;
 const j=await getJson(u);const subj=j?.result?.subject||j?.result?.subjects?.[0]||null;
 return {subject:subj,requestId:j?.result?.requestId||'',requestDateTime:j?.result?.requestDateTime||''};
}
async function whiteListBank(nip,account,date){
 account=bankClean(account);if(!/^\d{10}$/.test(nip)||!/^\d{26}$/.test(account)||!iso(date))return null;
 const u=`https://wl-api.mf.gov.pl/api/check/nip/${encodeURIComponent(nip)}/bank-account/${encodeURIComponent(account)}?date=${encodeURIComponent(date)}`;
 const j=await getJson(u);return {assigned:clean(j?.result?.accountAssigned),requestId:j?.result?.requestId||'',requestDateTime:j?.result?.requestDateTime||''};
}
function xmlTag(xml,tag){const m=xml.match(new RegExp(`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`,'i'));return m?m[1].replace(/<[^>]+>/g,'').trim():''}
async function viesCheck(code,vat){
 code=clean(code).toUpperCase();if(code==='GR')code='EL';vat=clean(vat).replace(/[\s.\-]/g,'').replace(new RegExp(`^${code}`,'i'),'');
 if(!EU.has(code)||!vat)return null;
 const body=`<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:ec.europa.eu:taxud:vies:services:checkVat:types"><soapenv:Header/><soapenv:Body><urn:checkVat><urn:countryCode>${code}</urn:countryCode><urn:vatNumber>${vat}</urn:vatNumber></urn:checkVat></soapenv:Body></soapenv:Envelope>`;
 const r=await fetchTimed('https://ec.europa.eu/taxation_customs/vies/services/checkVatService',{method:'POST',headers:{'Content-Type':'text/xml; charset=utf-8','SOAPAction':'""'},body},12000);
 if(!r.ok)throw new Error(`VIES HTTP ${r.status}`);
 const fault=xmlTag(r.text,'faultstring');if(fault)throw new Error(`VIES: ${fault}`);
 const v=xmlTag(r.text,'valid');if(!v)throw new Error('VIES zwrócił odpowiedź bez pola valid');
 return {countryCode:code,vatNumber:vat,valid:v.toLowerCase()==='true',name:xmlTag(r.text,'name'),address:xmlTag(r.text,'address'),requestDate:xmlTag(r.text,'requestDate')};
}
function vatIdFor(p){
 const kod=clean(p?.kodUE).toUpperCase(),nr=clean(p?.vatUE);if(kod&&nr)return{code:kod,vat:nr};
 const nip=digits(p?.nip);const country=clean(p?.country||p?.countryId).toUpperCase();if(nip.length===10&&(!country||country==='PL'))return{code:'PL',vat:nip};
 return null;
}
function dateShift(s,n){const d=new Date(`${s}T00:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
async function nbpRate(currency,referenceDate){
 currency=clean(currency).toUpperCase();if(currency==='PLN'||!/^[A-Z]{3}$/.test(currency)||!iso(referenceDate))return null;
 const end=dateShift(referenceDate,-1),start=dateShift(referenceDate,-14);
 for(const table of ['a','b']){
  const u=`https://api.nbp.pl/api/exchangerates/rates/${table}/${currency.toLowerCase()}/${start}/${end}/?format=json`;
  try{const j=await getJson(u);const rates=Array.isArray(j?.rates)?j.rates:[];if(rates.length){const x=rates[rates.length-1];return{currency,table:table.toUpperCase(),date:x.effectiveDate,mid:Number(x.mid),no:x.no||'',manualUrl:table==='a'?'https://nbp.pl/statystyka-i-sprawozdawczosc/kursy/archiwum-kursow-srednich-tabela-a/':'https://nbp.pl/statystyka-i-sprawozdawczosc/kursy/archiwum-kursow-srednich-tabela-b/'};}}catch(e){if(e.status!==404)throw e;}
 }
 throw new Error(`NBP nie zwrócił średniego kursu ${currency} przed ${referenceDate}`);
}
const DAY_MS=86400000;
const ZUS_TAX_INTEREST_URL='https://www.zus.pl/en/baza-wiedzy/skladki-wskazniki-odsetki/odsetki/wysokosc-stawek-odsetek-podatkowych-za-zwloke-od-nieterminowo-regulowanych-skladek-na-ubezpieczenia-spoleczne';
const TAX_INTEREST_ELI_CURRENT='https://eli.gov.pl/eli/MP/2026/269/ogl';
const TAX_RATE_FALLBACK=[
 {from:'2022-02-09',rate:8.5},{from:'2022-03-09',rate:10},{from:'2022-04-07',rate:12},{from:'2022-05-06',rate:13.5},{from:'2022-06-09',rate:15},{from:'2022-07-08',rate:16},{from:'2022-09-08',rate:16.5},{from:'2023-09-07',rate:15},{from:'2023-10-05',rate:14.5},{from:'2025-05-08',rate:13.5},{from:'2025-07-03',rate:13},{from:'2025-09-04',rate:12.5},{from:'2025-10-09',rate:12},{from:'2025-11-06',rate:11.5},{from:'2025-12-04',rate:11},{from:'2026-03-05',rate:10.5}
];
const PL_MONTHS={stycznia:1,lutego:2,marca:3,kwietnia:4,maja:5,czerwca:6,lipca:7,sierpnia:8,września:9,wrzesnia:9,października:10,pazdziernika:10,listopada:11,grudnia:12};
const TRADE_RATE_PERIODS=[
 {from:'2025-07-01',to:'2025-12-31',standard:15.25,medical:13.25,sourceName:'M.P. 2025 poz. 602',sourceUrl:'https://eli.gov.pl/eli/MP/2025/602/ogl',apiUrl:'https://api.sejm.gov.pl/eli/acts/MP/2025/602/text.html'},
 {from:'2026-01-01',to:'2026-06-30',standard:14,medical:12,sourceName:'M.P. 2025 poz. 1257',sourceUrl:'https://eli.gov.pl/eli/MP/2025/1257/ogl',apiUrl:'https://api.sejm.gov.pl/eli/acts/MP/2025/1257/text.html'},
 {from:'2026-07-01',to:'2026-12-31',standard:13.75,medical:11.75,sourceName:'M.P. 2026 poz. 642',sourceUrl:'https://eli.gov.pl/eli/MP/2026/642/ogl',apiUrl:'https://api.sejm.gov.pl/eli/acts/MP/2026/642/text.html'}
];
function htmlPlain(x){return String(x||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim()}
function plDateIso(day,month,year){const m=PL_MONTHS[String(month||'').toLowerCase()];return m?`${year}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`:''}
let taxHistoryCache=null,tradeRatesCache=null;
async function taxRateHistory(){
 if(taxHistoryCache&&Date.now()-taxHistoryCache.at<30*60*1000)return taxHistoryCache.value;
 let value=null;try{const r=await fetchTimed(ZUS_TAX_INTEREST_URL,{headers:{Accept:'text/html'}},4000);if(!r.ok)throw new Error(`HTTP ${r.status}`);const t=htmlPlain(r.text),arr=[];for(const m of t.matchAll(/od\s+(\d{1,2})\s+(stycznia|lutego|marca|kwietnia|maja|czerwca|lipca|sierpnia|września|wrzesnia|października|pazdziernika|listopada|grudnia)\s+(20\d{2})\s*r?\.?[\s\S]{0,90}?(\d{1,2}(?:[,.]\d{1,2})?)\s*%/gi)){const from=plDateIso(m[1],m[2],m[3]),rate=Number(m[4].replace(',','.'));if(from&&rate>0)arr.push({from,rate})}const uniq=[...new Map(arr.map(x=>[x.from,x])).values()].sort((a,b)=>a.from.localeCompare(b.from));if(uniq.length>=8)value={history:uniq,live:true};}catch{}
 if(!value)value={history:TAX_RATE_FALLBACK,live:false};taxHistoryCache={at:Date.now(),value};return value;
}
async function tradeRatePeriods(){
 if(tradeRatesCache&&Date.now()-tradeRatesCache.at<30*60*1000)return tradeRatesCache.value;
 const checked=await Promise.all(TRADE_RATE_PERIODS.map(async base=>{let p={...base},ok=true;try{const r=await fetchTimed(base.apiUrl,{headers:{Accept:'text/html'}},4000);if(!r.ok)throw new Error(`HTTP ${r.status}`);const nums=[...htmlPlain(r.text).matchAll(/(\d{1,2}(?:[,.]\d{1,2})?)\s*%/g)].map(m=>Number(m[1].replace(',','.'))).filter(n=>n>=5&&n<=30);const uniq=[...new Set(nums)];if(uniq.length>=2){p.medical=Math.min(...uniq);p.standard=Math.max(...uniq)}else throw new Error('brak stawek w treści');}catch{ok=false}return{p,ok}}));const value={periods:checked.map(x=>x.p),live:checked.every(x=>x.ok)};tradeRatesCache={at:Date.now(),value};return value;
}
function isoDay(s){return new Date(`${s}T00:00:00Z`)}
function isoFromDate(d){return d.toISOString().slice(0,10)}
function addIsoDays(s,n){const d=isoDay(s);d.setUTCDate(d.getUTCDate()+n);return isoFromDate(d)}
function daysInclusive(a,b){return Math.floor((isoDay(b)-isoDay(a))/DAY_MS)+1}
function periodSegments(start,end,points,getRate){
 const cuts=[start,...points.map(x=>x.from).filter(x=>x>start&&x<=end)].sort();const out=[];for(let i=0;i<cuts.length;i++){const from=cuts[i],to=i+1<cuts.length?addIsoDays(cuts[i+1],-1):end;if(to<from)continue;const meta=getRate(from);if(!meta)throw new Error(`Brak oficjalnej stawki dla okresu obejmującego ${from}.`);out.push({from,to,days:daysInclusive(from,to),...meta});}return out;
}
async function calculateInterest(type,amount,due,paid){
 amount=Number(amount);if(!Number.isFinite(amount)||amount<=0||!iso(due)||!iso(paid))throw new Error('Nieprawidłowa kwota lub data.');if(paid<=due)return{type,days:0,interest:0,total:round2(amount),segments:[],liveVerified:true,note:'Data zapłaty nie jest późniejsza niż termin płatności.'};const start=addIsoDays(due,1),end=paid;let segs=[],live=true,isTax=String(type).startsWith('tax');
 if(isTax){const h=await taxRateHistory();live=h.live;const factor=type==='taxReduced'?.5:type==='taxIncreased'?1.5:1;segs=periodSegments(start,end,h.history,d=>{const x=[...h.history].reverse().find(z=>z.from<=d);return x?{rate:round2(x.rate*factor),sourceName:h.live?'ZUS — tabela odsetek podatkowych':'ZUS — historia stawek (tabela awaryjna)',sourceUrl:ZUS_TAX_INTEREST_URL}:null});}
 else{const medical=type==='tradeMedical',loaded=await tradeRatePeriods(),periods=loaded.periods;live=loaded.live;const points=periods.map(x=>({from:x.from}));segs=periodSegments(start,end,points,d=>{const x=periods.find(z=>z.from<=d&&z.to>=d);return x?{rate:medical?x.medical:x.standard,sourceName:x.sourceName,sourceUrl:x.sourceUrl}:null})}
 let raw=0;for(const x of segs){x.interestRaw=amount*x.rate/100*x.days/365;x.interest=round2(x.interestRaw);raw+=x.interestRaw}const interest=isTax?Math.round(raw):round2(raw);return{type,days:daysInclusive(start,end),interest,total:round2(amount+interest),segments:segs.map(({interestRaw,...x})=>x),liveVerified:live,note:isTax?'Dla zaległości podatkowych wynik końcowy jest roboczo zaokrąglony do pełnych złotych. Aplikacja automatycznie dzieli okres przy zmianie stawki.':'Dla transakcji handlowych aplikacja automatycznie dzieli okres na półrocza, jeśli zmienia się stawka opublikowana w Monitorze Polskim.'};
}

function normText(s){return clean(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(spolka z ograniczona odpowiedzialnoscia|sp z oo|sp\. z o\.o\.|ulica|ul\.|aleja|al\.)\b/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()}
function levenshtein(a,b){a=String(a||'');b=String(b||'');const m=a.length,n=b.length;if(!m)return n;if(!n)return m;let prev=Array.from({length:n+1},(_,i)=>i),cur=new Array(n+1);for(let i=1;i<=m;i++){cur[0]=i;for(let j=1;j<=n;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));[prev,cur]=[cur,prev]}return prev[n]}
function similarity(a,b){a=normText(a);b=normText(b);if(!a||!b)return 0;if(a===b)return 1;return 1-levenshtein(a,b)/Math.max(a.length,b.length)}
function bestRegistryAddress(subject){return [clean(subject?.residenceAddress),clean(subject?.workingAddress)].filter(Boolean)}
function compareName(xml,subject){const reg=clean(subject?.name);if(!xml||!reg)return null;const score=similarity(xml,reg);if(score>=.985)return{status:'ok',message:'Nazwa zgodna z danymi z Białej Listy MF.',registryValue:reg,score};if(score>=.78)return{status:'error',message:'Możliwa literówka lub różnica w nazwie względem Białej Listy MF.',registryValue:reg,score};return{status:'warn',message:'Nazwa w XML różni się od nazwy zwróconej przez Białą Listę MF. Może to być inna dopuszczalna forma nazwy — sprawdź dokument.',registryValue:reg,score}}
function compareAddress(p,subject){const xml=[p.a1,p.a2].filter(Boolean).join(', '),cands=bestRegistryAddress(subject);if(!xml||!cands.length)return null;const ranked=cands.map(x=>({value:x,score:similarity(xml,x)})).sort((a,b)=>b.score-a.score),best=ranked[0];if(best.score>=.985)return{status:'ok',message:'Adres zgodny z adresem zwróconym przez Białą Listę MF.',registryValue:best.value,score:best.score};if(best.score>=.72)return{status:'error',message:'Adres jest bardzo podobny do danych rejestrowych, ale nie jest identyczny — możliwa literówka lub brakujący fragment.',registryValue:best.value,score:best.score};return{status:'warn',message:'Adres w XML istotnie różni się od adresu rejestrowego. Nie musi to oznaczać błędu (np. inne miejsce działalności), ale wymaga sprawdzenia.',registryValue:best.value,score:best.score}}

async function toolboxContractor(nip,date,country='',vat=''){
 nip=digits(nip);if(!/^\d{10}$/.test(nip)||!iso(date))throw new Error('Nieprawidłowy NIP lub data.');
 const r=await whiteListSearch(nip,date),s=r?.subject||null;
 const mf=s?{found:true,name:clean(s.name),statusVat:clean(s.statusVat),residenceAddress:clean(s.residenceAddress),workingAddress:clean(s.workingAddress),accountNumbers:Array.isArray(s.accountNumbers)?s.accountNumbers:[],krs:clean(s.krs),regon:clean(s.regon),registrationLegalDate:clean(s.registrationLegalDate),hasVirtualAccounts:!!s.hasVirtualAccounts}:{found:false,accountNumbers:[]};
 let vies=null,viesError='';if(clean(country)&&clean(vat)){try{vies=await viesCheck(country,vat)}catch(e){viesError=e?.message||String(e)}}
 return{mf,vies,viesError,requestId:r?.requestId||'',requestDateTime:r?.requestDateTime||'',date};
}
async function toolboxBank(nip,account,date){
 nip=digits(nip);account=bankClean(account);if(!/^\d{10}$/.test(nip)||!/^\d{26}$/.test(account)||!iso(date))throw new Error('Nieprawidłowy NIP, rachunek lub data.');
 const r=await whiteListBank(nip,account,date);return{assigned:clean(r?.assigned).toUpperCase()==='TAK',requestId:r?.requestId||'',requestDateTime:r?.requestDateTime||'',nip,account,date};
}
function mfDetail(res,date){const s=res?.subject;if(!s)return{found:false,registryDate:date||'',requestId:res?.requestId||''};return{found:true,registryDate:date||'',requestId:res?.requestId||'',name:clean(s.name),statusVat:clean(s.statusVat),residenceAddress:clean(s.residenceAddress),workingAddress:clean(s.workingAddress),accountNumbers:Array.isArray(s.accountNumbers)?s.accountNumbers:[]}}
function mfCheckToResult(label,party,res,domesticVat,checks){
 if(!res?.subject){add(checks,domesticVat?'warn':'info','registry',`Biała Lista MF — ${label}`,`Nie znaleziono podmiotu dla NIP ${party.nip} w wykazie na wskazany dzień.`,`NIP ${party.nip}`,'Zweryfikuj NIP i datę sprawdzenia w Wykazie podatników VAT.');return;}
 const st=clean(res.subject.statusVat),active=st.toLowerCase()==='czynny';
 add(checks,active?'ok':domesticVat?'warn':'info','registry',`Biała Lista MF — ${label}`,`NIP ${party.nip}: status VAT „${st||'brak'}”.${res.requestId?` Id zapytania MF: ${res.requestId}.`:''}`,`NIP ${party.nip}`,active?'':'Przy fakturze z krajowym VAT status inny niż „Czynny” wymaga wyjaśnienia; sam wynik nie przesądza jeszcze o ważności dokumentu.');
}
function viesToResult(label,id,res,important,checks){
 if(!res)return;
 add(checks,res.valid?'ok':important?'warn':'info','registry',`VIES / VAT UE — ${label}`,`${res.countryCode}${res.vatNumber}: ${res.valid?'numer aktywny w VIES':'numer nieaktywny w VIES'}.${res.name&&res.name!=='---'?` Nazwa: ${res.name}.`:''}${res.requestDate?` Data odpowiedzi: ${res.requestDate}.`:''}`,`${res.countryCode}${res.vatNumber}`,res.valid?'':'Brak aktywnego VAT UE jest szczególnie istotny dla transakcji wewnątrzunijnych; przy transakcji krajowej może być całkowicie normalny.');
}
async function audit(payload){
 const checks=[];let unavailable=0;
 const details={seller:{},buyer:{},bankAccounts:[],registryDate:''};
 const date=iso(payload.invoiceDate)?payload.invoiceDate:new Date().toISOString().slice(0,10);
 const seller={...(payload.seller||{}),nip:digits(payload.seller?.nip)},buyer={...(payload.buyer||{}),nip:digits(payload.buyer?.nip)};
 const domesticVat=!!payload.domesticVat,importantVies=!!(payload.flags?.wdt||payload.flags?.reverse);details.registryDate=date;
 const tasks=[];
 for(const [key,label,p] of [['seller','sprzedawca',seller],['buyer','nabywca',buyer]]){
  if(/^\d{10}$/.test(p.nip))tasks.push((async()=>{try{const r=await whiteListSearch(p.nip,date);details[key].mf=mfDetail(r,date);mfCheckToResult(label,p,r,domesticVat,checks);if(r?.subject){details[key].comparisons=details[key].comparisons||{};details[key].comparisons.name=compareName(p.name,r.subject);details[key].comparisons.address=compareAddress(p,r.subject);if(details[key].comparisons.name?.status==='error')add(checks,'error','registry',`Nazwa — ${label}`,details[key].comparisons.name.message,label==='sprzedawca'?'Podmiot1/DaneIdentyfikacyjne/Nazwa':'Podmiot2/DaneIdentyfikacyjne/Nazwa',`W XML: ${p.name||'brak'}; rejestr: ${details[key].comparisons.name.registryValue}`);if(details[key].comparisons.address?.status==='error')add(checks,'error','registry',`Adres — ${label}`,details[key].comparisons.address.message,label==='sprzedawca'?'Podmiot1/Adres':'Podmiot2/Adres',`W XML: ${[p.a1,p.a2].filter(Boolean).join(', ')}; rejestr: ${details[key].comparisons.address.registryValue}`);else if(details[key].comparisons.address?.status==='warn')add(checks,'warn','registry',`Adres — ${label}`,details[key].comparisons.address.message,label==='sprzedawca'?'Podmiot1/Adres':'Podmiot2/Adres',`Porównaj z rejestrem: ${details[key].comparisons.address.registryValue}`);}}catch(e){unavailable++;details[key].mf={unavailable:true,error:e.message,registryDate:date};add(checks,'info','registry',`Biała Lista MF — ${label}`,`Nie udało się pobrać statusu: ${e.message}.`,`NIP ${p.nip}`,'Spróbuj ponownie; niedostępność rejestru nie jest błędem faktury.')}})());
  else add(checks,'info','registry',`Biała Lista MF — ${label}`,'Brak poprawnego polskiego NIP w XML — kontrola Wykazu podatników VAT nie ma zastosowania albo nie może zostać wykonana.',label==='sprzedawca'?'Podmiot1/DaneIdentyfikacyjne':'Podmiot2/DaneIdentyfikacyjne');
  const id=vatIdFor(p);if(id)tasks.push((async()=>{try{const vr=await viesCheck(id.code,id.vat);details[key].vies=vr;viesToResult(label,id,vr,importantVies,checks)}catch(e){unavailable++;details[key].vies={unavailable:true,error:e.message};add(checks,'info','registry',`VIES / VAT UE — ${label}`,`Weryfikacja VIES chwilowo niedostępna: ${e.message}.`,`${id.code}${id.vat}`,'Spróbuj ponownie; awaria VIES nie powinna być klasyfikowana jako błąd dokumentu.')}})());
  else add(checks,'info','registry',`VIES / VAT UE — ${label}`,'Z XML nie można zbudować numeru VAT UE tej strony — kontrola VIES pominięta.',label==='sprzedawca'?'Podmiot1/DaneIdentyfikacyjne':'Podmiot2/DaneIdentyfikacyjne');
 }
 const accountDate=iso(payload.paidDate)?payload.paidDate:date;
 if(Array.isArray(payload.banks)&&payload.banks.length&&/^\d{10}$/.test(seller.nip)){
  for(const raw of payload.banks){tasks.push((async()=>{const acc=bankClean(raw);if(!/^\d{26}$/.test(acc)){add(checks,'warn','registry','Rachunek bankowy — format',`Rachunek „${raw}” po normalizacji nie ma 26 cyfr.`,raw,'Sprawdź NrRB w XML.');return;}try{const r=await whiteListBank(seller.nip,acc,accountDate);const yes=clean(r?.assigned).toUpperCase()==='TAK';details.bankAccounts.push({account:acc,assigned:yes,date:accountDate,requestId:r?.requestId||''});add(checks,yes?'ok':'warn','registry','Rachunek bankowy na Białej Liście',`${acc}: ${yes?'rachunek przypisany do NIP sprzedawcy':'rachunek NIE został potwierdzony jako przypisany do NIP sprzedawcy'} na dzień ${accountDate}.${r?.requestId?` Id zapytania MF: ${r.requestId}.`:''}`,`Fa/Platnosc/RachunekBankowy/NrRB`,yes?'':'Przy płatności wymagającej weryfikacji sprawdź rachunek ponownie na właściwy dzień płatności; wynik na dzień faktury nie zastępuje weryfikacji na dzień zlecenia przelewu.');}catch(e){unavailable++;add(checks,'info','registry','Rachunek bankowy na Białej Liście',`Nie udało się zweryfikować rachunku: ${e.message}.`,'Fa/Platnosc/RachunekBankowy/NrRB','Spróbuj ponownie przed płatnością.')}})());}
 }else if(Array.isArray(payload.banks)&&payload.banks.length&&!seller.nip){add(checks,'info','registry','Rachunek bankowy na Białej Liście','XML zawiera rachunek, ale brak polskiego NIP sprzedawcy — nie można użyć pary NIP + rachunek w API MF.','Fa/Platnosc/RachunekBankowy/NrRB');}
 else add(checks,'info','registry','Rachunek bankowy na Białej Liście','W XML nie znaleziono NrRB, więc nie ma rachunku do automatycznej weryfikacji.','Fa/Platnosc/RachunekBankowy/NrRB');
 await Promise.all(tasks);

 // Kurs NBP: benchmark art. 31a, z ostrożnym wnioskiem — XML nie ujawnia każdej dopuszczalnej metody przeliczenia.
 const currency=clean(payload.currency).toUpperCase();
 if(currency&&currency!=='PLN'){
  if(payload.flags?.correction){add(checks,'info','fx','Kurs waluty — faktura korygująca','Dla korekty nie porównuję automatycznie P_14_*W z bieżącą regułą art. 31a, ponieważ właściwy kurs może zależeć od rodzaju i przyczyny korekty.','Fa/KodWaluty','Zweryfikuj zasady właściwe dla korekty i faktury pierwotnej.');}
  else if(domesticVat){
   let referenceDate='';let basis='';
   if(iso(payload.invoiceDate)&&iso(payload.saleDate)&&payload.invoiceDate<payload.saleDate){referenceDate=payload.invoiceDate;basis='faktura wystawiona przed P_6 — benchmark z dnia poprzedzającego wystawienie';}
   else if(iso(payload.saleDate)){referenceDate=payload.saleDate;basis='benchmark z dnia poprzedzającego P_6 (przy założeniu, że P_6 odpowiada dacie obowiązku podatkowego)';}
   else if(iso(payload.invoiceDate)){referenceDate=payload.invoiceDate;basis='brak P_6 — pomocniczy benchmark względem daty wystawienia';}
   if(referenceDate){try{const r=await nbpRate(currency,referenceDate);add(checks,'ok','fx','Kurs NBP — kurs referencyjny',`${currency}: średni kurs NBP ${r.mid.toFixed(4)} z ${r.date}, tabela ${r.table}${r.no?` ${r.no}`:''}; ${basis}.`,'Fa/KodWaluty','To benchmark według podstawowej ścieżki art. 31a; podatnik może w określonych warunkach stosować inną dopuszczalną metodę (np. EBC lub zasady podatku dochodowego).');
     const groups=Array.isArray(payload.vatGroups)?payload.vatGroups:[];let compared=0;
     for(const g of groups){const foreign=Number(String(g.foreignVat||'').replace(',','.')),pln=Number(String(g.plnVat||'').replace(',','.'));if(!(foreign&&Number.isFinite(pln)))continue;compared++;const expected=round2(foreign*r.mid),diff=round2(pln-expected),ok=Math.abs(diff)<=0.02;add(checks,ok?'ok':'warn','fx',`Kurs NBP — ${g.label}`,`VAT w walucie: ${foreign.toFixed(2)} ${currency}; P_14_*W: ${pln.toFixed(2)} PLN; wg kursu ${r.mid.toFixed(4)} ≈ ${expected.toFixed(2)} PLN; różnica ${diff.toFixed(2)} PLN.`,`${g.foreignField} / ${g.plnField}`,ok?'':'Rozbieżność wymaga sprawdzenia. Nie oznaczam jej automatycznie jako błąd, bo XML nie przesądza o dacie obowiązku podatkowego ani o wybranej prawnie metodzie przeliczenia.');}
     if(!compared)add(checks,'info','fx','Kurs NBP — brak danych do porównania','Pobrano kurs NBP, ale w XML brak kompletnej pary kwota VAT w walucie + P_14_*W pozwalającej odtworzyć zastosowane przeliczenie.','Fa/P_14_* / P_14_*W');
    }catch(e){unavailable++;add(checks,'info','fx','Kurs NBP',`Nie udało się pobrać kursu NBP: ${e.message}.`,'Fa/KodWaluty','Spróbuj ponownie lub sprawdź tabelę NBP ręcznie.');}
   }else add(checks,'info','fx','Kurs NBP — brak daty odniesienia','Faktura jest walutowa i zawiera krajowy VAT, ale z XML nie udało się ustalić daty do benchmarku NBP.','Fa/P_1 / P_6');
  }else add(checks,'info','fx','Kurs NBP — brak krajowego VAT',`Faktura jest w ${currency}, ale nie wykryto krajowego VAT w standardowych stawkach. Nie wykonano porównania P_14_*W.`,'Fa/KodWaluty');
 }
 return{checks,unavailable,details,checkedAt:new Date().toISOString(),registryDate:date};
}


// v1.6 — agregator "Gazeta księgowego"
const NEWS_CACHE_FILE=path.join(ROOT,'data','news-cache.json');
const NEWS_SEED_FILE=path.join(ROOT,'news_seed.json');
const NEWS_CACHE_MS=30*60*1000;
const NEWS_SOURCES=[
 {id:'mf',name:'Ministerstwo Finansów',url:'https://www.gov.pl/web/finanse/wiadomosci',official:true,hints:['/web/finanse/']},
 {id:'podatki-gov',name:'podatki.gov.pl',url:'https://podatki.gov.pl/aktualnosci',official:true,hints:['/aktualnosci']},
 {id:'zus',name:'ZUS',url:'https://www.zus.pl/o-zus/aktualnosci',official:true,hints:['/o-zus/aktualnosci','/firmy/','/baza-wiedzy/']},
 {id:'prawo',name:'Prawo.pl',url:'https://www.prawo.pl/podatki/',official:false,hints:['/podatki/']},
 {id:'infor',name:'INFOR Księgowość',url:'https://ksiegowosc.infor.pl/',official:false,hints:['/podatki/','/ksiegowosc/','/rachunkowosc/']},
 {id:'poradnik',name:'Poradnik Przedsiębiorcy',url:'https://poradnikprzedsiebiorcy.pl/podatki',official:false,hints:['/-']},
 {id:'gofin',name:'GOFIN',url:'https://news.gofin.pl/',official:false,hints:['gofin.pl/']},
 {id:'pit',name:'PIT.pl',url:'https://www.pit.pl/aktualnosci/',official:false,hints:['/aktualnosci/']}
];
const NEWS_UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0 Safari/537.36 KSeF-Checker-Pro/2.5.1';
let newsMemory=null;
function hdecode(s){return String(s||'').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n))).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCharCode(parseInt(n,16)))}
function htext(s){return hdecode(String(s||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim())}
function short(s,n=330){s=htext(s);return s.length>n?s.slice(0,n).replace(/\s+\S*$/,'')+'…':s}
function attr(tag,name){const a=[...String(tag||'').matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g)];const x=a.find(m=>m[1].toLowerCase()===name.toLowerCase());return x?hdecode(x[3]):''}
function meta(html,key){for(const m of String(html||'').matchAll(/<meta\b[^>]*>/gi)){const tag=m[0],k=attr(tag,'property')||attr(tag,'name')||attr(tag,'itemprop');if(String(k).toLowerCase()===key.toLowerCase())return attr(tag,'content')}return''}
function isoNewsDate(v){v=clean(v);if(!v)return'';let m=v.match(/(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/);if(m)return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;m=v.match(/(\d{1,2})[.\-/](\d{1,2})[.\-/](20\d{2})/);if(m)return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;const d=new Date(v);return Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10)}
function absUrl(raw,base){try{return new URL(hdecode(raw),base).href}catch{return''}}
function jsonLdObjects(html){const out=[];for(const m of String(html||'').matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{const x=JSON.parse(hdecode(m[1]));const walk=v=>{if(!v)return;if(Array.isArray(v))return v.forEach(walk);if(typeof v==='object'){const t=v['@type'];if((Array.isArray(t)?t:[t]).some(z=>/^(NewsArticle|Article|BlogPosting)$/i.test(String(z||''))))out.push(v);Object.values(v).forEach(walk)}};walk(x)}catch{}}return out}
function ldUrl(x,base){const u=typeof x?.url==='string'?x.url:typeof x?.mainEntityOfPage==='string'?x.mainEntityOfPage:x?.mainEntityOfPage?.['@id']||x?.['@id']||'';return absUrl(u,base)}
function topicOf(a){const t=`${a.title||''} ${a.summary||''}`.toLowerCase();if(/ksef|faktur|vat|jpk|split payment|mpp/.test(t))return'VAT / KSeF';if(/\bpit\b|\bcit\b|ryczałt|dochodo|fundacj.*rodzinn|ip box|danin/.test(t))return'PIT / CIT';if(/rachunk|sprawozd|bilans|księg|esrs|audyt/.test(t))return'Rachunkowość';if(/zus|e-zus|pue zus|składk|ubezpieczen.*społecz/.test(t))return'ZUS';if(/kadrow|wynagrod|prawo pracy|pracown|urlop|zasiłk/.test(t))return'Kadry i płace';if(/akcyz|cło|ordynac|pcc|spadk|darowizn|podatek od nieruchomości/.test(t))return'Pozostałe podatki';return'Podatki i prawo'}
function isPlanned(a){return /projekt|planowan|propozyc|konsultac|od 2027|od 2028|rząd (przyjął|zaakceptował)|ma się zmienić|zmiany w .* od/i.test(`${a.title||''} ${a.summary||''}`)}
function relevantText(t){return /(podat|vat|pit|cit|ksef|jpk|rachunk|księg|zus|składk|faktur|akcyz|cło|sprawozd|ryczałt|ordynac|darowizn|nieruchomo|esrs|audyt)/i.test(t)}
function sourceUrlOk(url,source){try{const u=new URL(url),b=new URL(source.url);if(!(u.hostname===b.hostname||u.hostname.endsWith('.'+b.hostname.replace(/^www\./,''))||b.hostname.endsWith('.'+u.hostname.replace(/^www\./,''))))return false;if(u.href===source.url||u.pathname==='/'||/\.(jpg|png|pdf|zip)$/i.test(u.pathname))return false;return source.hints.some(h=>u.href.includes(h))}catch{return false}}
function extractCandidates(html,source){const out=[];for(const x of jsonLdObjects(html)){const title=clean(x.headline||x.name),url=ldUrl(x,source.url);if(title.length>20&&url&&sourceUrlOk(url,source))out.push({title,summary:short(x.description||''),url,date:isoNewsDate(x.datePublished||x.dateModified||''),image:absUrl(x.image?.url||x.image||x.thumbnailUrl||'',source.url)})}
 const re=/<a\b[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;let m;while((m=re.exec(html))){const title=htext(m[3]),url=absUrl(m[2],source.url);if(title.length<28||title.length>240||!sourceUrlOk(url,source)||!relevantText(title+' '+url))continue;const ctx=htext(html.slice(Math.max(0,m.index-260),Math.min(html.length,re.lastIndex+520)));let date='';const dm=ctx.match(/(20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[.\-/]\d{1,2}[.\-/]20\d{2})/);if(dm)date=isoNewsDate(dm[1]);let summary=ctx.replace(title,' ').replace(/\s+/g,' ').trim();if(summary.length>40)summary=short(summary,280);else summary='';out.push({title,summary,url,date,image:''})}
 const seen=new Set();return out.filter(x=>{const k=x.url.replace(/[?#].*$/,'');if(seen.has(k))return false;seen.add(k);return true}).slice(0,12)}
function parseArticlePage(html,url){const ld=jsonLdObjects(html)[0]||{};const title=clean(meta(html,'og:title')||ld.headline||ld.name||'');const summary=short(meta(html,'og:description')||meta(html,'description')||ld.description||'',360);const date=isoNewsDate(meta(html,'article:published_time')||ld.datePublished||ld.dateModified||'');const image=absUrl(meta(html,'og:image')||meta(html,'twitter:image')||ld.image?.url||ld.image||'',url);return{title,summary,date,url,image}}
async function fetchNewsHtml(url,timeout=9000){const r=await fetchTimed(url,{headers:{Accept:'text/html,application/xhtml+xml','User-Agent':NEWS_UA,'Accept-Language':'pl-PL,pl;q=0.9,en;q=0.5'}},timeout);if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.text.slice(0,4_000_000)}
async function harvestSource(source){const html=await fetchNewsHtml(source.url);let c=extractCandidates(html,source).slice(0,6);const enriched=await Promise.all(c.slice(0,5).map(async x=>{try{const h=await fetchNewsHtml(x.url,7000),d=parseArticlePage(h,x.url);return{...x,title:d.title||x.title,summary:d.summary||x.summary,date:d.date||x.date,image:d.image||x.image||''}}catch{return x}}));c=enriched.map(x=>({...x,source:source.name,sourceId:source.id,official:source.official,topic:source.id==='zus'?'ZUS':topicOf(x),planned:isPlanned(x)})).filter(x=>x.title&&x.url&&(source.id==='zus'?/(zus|składk|ubezpiec|przedsiębior|umow|dzieł|zasił|emerytur|rent|płatnik|świadczen)/i.test(`${x.title} ${x.summary}`):relevantText(`${x.title} ${x.summary}`)));return c.slice(0,5)}
function readJsonFile(file,fallback=null){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return fallback}}
function writeJsonFile(file,data){try{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8')}catch{}}
function newsTime(a){const n=Date.parse(a.date||'');return Number.isFinite(n)?n:0}
function dedupeNews(list){const seenUrl=new Set(),seenTitle=new Set(),out=[];for(const a of list.sort((x,y)=>newsTime(y)-newsTime(x))){const u=String(a.url||'').replace(/[?#].*$/,''),t=normText(a.title);if(!u||!t||seenUrl.has(u)||seenTitle.has(t))continue;seenUrl.add(u);seenTitle.add(t);out.push(a)}return out}
async function getNews(force=false){const now=Date.now();if(!force&&newsMemory&&now-newsMemory._at<NEWS_CACHE_MS)return newsMemory.data;const disk=readJsonFile(NEWS_CACHE_FILE);if(!force&&disk?.updatedAt&&now-Date.parse(disk.updatedAt)<NEWS_CACHE_MS){newsMemory={_at:now,data:disk};return disk}
 const settled=await Promise.all(NEWS_SOURCES.map(async source=>{try{const articles=await harvestSource(source);return{source,ok:true,articles}}catch(e){return{source,ok:false,error:e?.message||String(e),articles:[]}}}));
 let fresh=[];const statuses=[];for(const r of settled){fresh.push(...r.articles);statuses.push({id:r.source.id,name:r.source.name,ok:r.ok&&r.articles.length>0,count:r.articles.length,error:r.ok&&!r.articles.length?'Nie znaleziono nowych artykułów na stronie źródłowej.':r.error||''})}
 const seed=readJsonFile(NEWS_SEED_FILE,{articles:[]});fresh=dedupeNews(fresh);let fallback=false;if(fresh.length<8){fresh=dedupeNews([...fresh,...(seed.articles||[])]);fallback=true}
 const data={version:'2.5.1',updatedAt:new Date().toISOString(),articles:fresh.slice(0,40),sources:statuses,freshSources:statuses.filter(x=>x.ok).length,fallback};newsMemory={_at:now,data};writeJsonFile(NEWS_CACHE_FILE,data);return data}


let PDF_PARSE_FN=null,PDF_PARSE_VERSION='';
function pdfParser(){
 if(PDF_PARSE_FN)return PDF_PARSE_FN;
 try{
  const mod=require('pdf-parse');
  PDF_PARSE_VERSION=(()=>{try{return require('pdf-parse/package.json').version||''}catch{return''}})();
  if(typeof mod==='function'||typeof mod?.default==='function'){const fn=typeof mod==='function'?mod:mod.default;PDF_PARSE_FN=(buf,opts={})=>fn(buf,opts);return PDF_PARSE_FN;}
  if(typeof mod?.PDFParse==='function'){PDF_PARSE_FN=async (buf,opts={})=>{const parser=new mod.PDFParse({data:new Uint8Array(buf)});try{const textResult=await parser.getText();let infoResult=null;try{infoResult=await parser.getInfo()}catch{}return{text:textResult?.text||'',numpages:Number(textResult?.total||infoResult?.total||0),info:infoResult?.infoData||infoResult?.info||{}}}finally{try{await parser.destroy()}catch{}}};return PDF_PARSE_FN;}
  throw new Error('Nieobsługiwany interfejs modułu pdf-parse');
 }catch(e){const err=new Error('Lokalny parser PDF nie jest zainstalowany albo nie może zostać uruchomiony. Uruchom ponownie START_CHECKER.bat, aby wykonać npm install.');err.code='PDF_PARSER_MISSING';err.cause=e;throw err}
}
async function readJsonLarge(req,maxBytes=28*1024*1024){
 return new Promise((resolve,reject)=>{let size=0,chunks=[];req.on('data',c=>{size+=c.length;if(size>maxBytes){reject(new Error('PDF jest zbyt duży. Maksymalny rozmiar w tej wersji to około 20 MB.'));req.destroy();return}chunks.push(c)});req.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}'))}catch{reject(new Error('Nieprawidłowy JSON'))}});req.on('error',reject)});
}
async function pdfLayoutPage(pageData){
 const tc=await pageData.getTextContent({normalizeWhitespace:false,disableCombineTextItems:false});
 const items=(tc?.items||[]).filter(x=>String(x?.str||'').trim()).map(x=>({
  str:String(x.str||'').replace(/\s+/g,' ').trim(),
  x:Number(x.transform?.[4]||0),y:Number(x.transform?.[5]||0),w:Number(x.width||0),h:Number(x.height||0)
 }));
 const rows=[];const tol=2.5;
 for(const it of items.sort((a,b)=>b.y-a.y||a.x-b.x)){
  let row=rows.find(r=>Math.abs(r.y-it.y)<=tol);
  if(!row){row={y:it.y,items:[]};rows.push(row)}
  row.items.push(it);
 }
 rows.sort((a,b)=>b.y-a.y);
 const lines=[];
 for(const row of rows){
  const xs=row.items.sort((a,b)=>a.x-b.x);let line='',lastEnd=null;
  for(const it of xs){
   if(lastEnd!==null){const gap=it.x-lastEnd;if(gap>55)line+='     ';else if(gap>18)line+='   ';else if(gap>5)line+=' ';}
   line+=it.str;lastEnd=it.x+Math.max(it.w,it.str.length*4);
  }
  if(line.trim())lines.push(line.trimEnd());
 }
 return lines.join('\n');
}
async function extractPdfText(payload){
 const raw=clean(payload?.data),name=clean(payload?.name)||'faktura.pdf';
 if(!raw)throw new Error('Brak danych PDF.');
 let buf;try{buf=Buffer.from(raw,'base64')}catch{throw new Error('Nie udało się odczytać danych PDF.')} 
 if(buf.length<5||buf.slice(0,5).toString()!=='%PDF-')throw new Error('Plik nie wygląda jak poprawny PDF.');
 if(buf.length>20*1024*1024)throw new Error('PDF jest większy niż 20 MB.');
 let text='',layoutText='',pages=0,info={},engine='';
 try{
  const parse=pdfParser();
  const out=await parse(buf);text=String(out?.text||'').replace(/\u0000/g,'').trim();pages=Number(out?.numpages||0);info=out?.info||{};engine=`pdf-parse${PDF_PARSE_VERSION?' '+PDF_PARSE_VERSION:''}`;
  try{const lo=await parse(buf,{pagerender:pdfLayoutPage});layoutText=String(lo?.text||'').replace(/\u0000/g,'').trim();if(!pages)pages=Number(lo?.numpages||0)}catch{}
 }
 catch(e){if(e?.code!=='PDF_PARSER_MISSING')throw e;const tmp=path.join(os.tmpdir(),`ksef-checker-${process.pid}-${Date.now()}.pdf`);try{fs.writeFileSync(tmp,buf);layoutText=await new Promise((resolve,reject)=>execFile('pdftotext',['-layout',tmp,'-'],{maxBuffer:8*1024*1024},(err,stdout,stderr)=>err?reject(new Error(stderr||err.message)):resolve(String(stdout||''))));text=layoutText;engine='pdftotext (fallback)'}catch(fallbackErr){throw e}finally{try{fs.unlinkSync(tmp)}catch{}}}
 text=String(text||'').replace(/\u0000/g,'').trim();layoutText=String(layoutText||'').replace(/\u0000/g,'').trim();
 const bestText=layoutText.replace(/\s/g,'').length>=30?layoutText:text;
 const previewId=storePdfPreview(buf,name);
 return {name,size:buf.length,pages,text,layoutText,info,hasText:bestText.replace(/\s/g,'').length>=30,engine,previewId,previewUrl:`/api/pdf/view/${previewId}`};
}


const LEGAL_SOURCE_CHECKS=[
 {id:'fa3',name:'KSeF / FA(3)',url:'https://ksef.podatki.gov.pl/informacje-ogolne-ksef-20/struktura-logiczna-fa-3/'},
 {id:'scale',name:'podatki.gov.pl / skala',url:'https://www.podatki.gov.pl/podatki-firmowe/pit/stawki-i-limity'},
 {id:'linear',name:'podatki.gov.pl / liniowy',url:'https://www.podatki.gov.pl/podatki-firmowe/pit/informacje-podstawowe/co-jest-opodatkowane/opodatkowanie-podatkiem-liniowym'},
 {id:'health',name:'ZUS / zdrowotna',url:'https://www.zus.pl/pl/firmy/przedsiebiorco-przeczytaj-wazne/kalkulator-skladki-zdrowotnej'},
 {id:'assetHealth',name:'ZUS / sprzedaż ŚT',url:'https://www.zus.pl/en/-/od-1-maja-2026-r.-obowi%C4%85zuj%C4%85-nowe-wzory-formularzy-zus-dra-i-zus-rca'},
 {id:'mpp',name:'podatki.gov.pl / MPP',url:'https://www.podatki.gov.pl/podatki-firmowe/vat/poradniki-i-informatory/mechanizm-podzielonej-platnosci-mpp'},
 {id:'nbp',name:'NBP API',url:'https://api.nbp.pl/'}
];
async function legalSourceStatus(){
 const rows=await Promise.all(LEGAL_SOURCE_CHECKS.map(async x=>{
  try{const r=await fetchTimed(x.url,{headers:{Accept:'text/html,application/json'}},6500);return{id:x.id,name:x.name,url:x.url,ok:r.ok,status:r.status};}
  catch(e){return{id:x.id,name:x.name,url:x.url,ok:false,status:0,error:e?.message||String(e)};}
 }));
 return{checkedAt:new Date().toISOString(),sources:rows};
}

function send(res,status,body,type='application/json; charset=utf-8'){res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(body)}
async function readJson(req){return new Promise((resolve,reject)=>{let s='';req.on('data',c=>{s+=c;if(s.length>1_000_000){reject(new Error('Payload too large'));req.destroy();}});req.on('end',()=>{try{resolve(JSON.parse(s||'{}'))}catch{reject(new Error('Nieprawidłowy JSON'))}});req.on('error',reject)})}
async function readText(req,max=10_000_000){return new Promise((resolve,reject)=>{const chunks=[];let n=0;req.on('data',c=>{n+=c.length;if(n>max){reject(new Error('Payload too large'));req.destroy();return}chunks.push(c)});req.on('end',()=>resolve(Buffer.concat(chunks).toString('utf8')));req.on('error',reject)})}
function qaServerStatus(){const needed=['index.html','app.js','pdf_import.js','pdf_preview.js','batch_pdf.js','toolbox.js','tax_simulator.js','TAX_SIMULATOR_SOURCES.txt','health_calc.js','HEALTH_CALC_SOURCES.txt','office_hub.js','number_format.js','samples/17_pdf_test_invoice.pdf','package.json','styles.css','server.js','test-library/manifest.json','news_seed.json','validate_xsd.ps1'];const files=needed.map(name=>{const f=path.join(ROOT,name);let ok=false,size=0;try{const st=fs.statSync(f);ok=st.isFile();size=st.size}catch{}return{name,ok,size}});let pdfParserInstalled=false;try{require.resolve('pdf-parse');pdfParserInstalled=true}catch{}let excelInstalled=false;try{require.resolve('exceljs');excelInstalled=true}catch{}const pdfRendererPath=path.join(ROOT,'node_modules','pdf-parse','lib','pdf.js','v1.10.100','build','pdf.js');let pdfRendererInstalled=false;try{pdfRendererInstalled=fs.statSync(pdfRendererPath).size>1000}catch{}return{version:'2.5.1',platform:process.platform,node:process.version,files,xsd:xsdLocalStatus(),pdfParserInstalled,pdfRendererInstalled,excelInstalled,time:new Date().toISOString()}}
function serveStatic(req,res){
 const u=new URL(req.url,`http://${req.headers.host||HOST}`);let rel=decodeURIComponent(u.pathname);if(rel==='/')rel='/index.html';
 const f=path.resolve(ROOT,'.'+rel);if(!f.startsWith(path.resolve(ROOT)+path.sep))return send(res,403,'Forbidden','text/plain; charset=utf-8');
 fs.stat(f,(err,st)=>{if(err||!st.isFile())return send(res,404,'Not found','text/plain; charset=utf-8');res.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});fs.createReadStream(f).pipe(res);});
}
const server=http.createServer(async(req,res)=>{
 try{
  const route=new URL(req.url,`http://${req.headers.host||HOST}`);
  if((req.method==='GET'||req.method==='HEAD')&&route.pathname.startsWith('/api/pdf/view/')){const id=route.pathname.slice('/api/pdf/view/'.length);return servePdfPreview(req,res,id);}
  if(req.method==='GET'&&route.pathname==='/api/toolbox/contractor'){const q=route.searchParams;return send(res,200,JSON.stringify(await toolboxContractor(q.get('nip')||'',q.get('date')||'',q.get('country')||'',q.get('vat')||'')));}
  if(req.method==='GET'&&route.pathname==='/api/toolbox/bank'){const q=route.searchParams;return send(res,200,JSON.stringify(await toolboxBank(q.get('nip')||'',q.get('account')||'',q.get('date')||'')));}
  if(req.method==='GET'&&route.pathname==='/api/toolbox/vies'){const q=route.searchParams,r=await viesCheck(q.get('country')||'',q.get('vat')||'');if(!r)throw new Error('Nieprawidłowy kod kraju lub numer VAT.');return send(res,200,JSON.stringify(r));}
  if(req.method==='GET'&&route.pathname==='/api/toolbox/nbp'){const q=route.searchParams,r=await nbpRate(q.get('currency')||'',q.get('date')||'');if(!r)throw new Error('Nieprawidłowa waluta lub data.');return send(res,200,JSON.stringify(r));}
  if(req.method==='GET'&&route.pathname==='/api/toolbox/interest'){const q=route.searchParams;return send(res,200,JSON.stringify(await calculateInterest(q.get('type')||'',q.get('amount')||'',q.get('due')||'',q.get('paid')||'')));}
  if(req.method==='POST'&&route.pathname==='/api/pdf/extract'){const payload=await readJsonLarge(req);return send(res,200,JSON.stringify(await extractPdfText(payload)));}
  if(req.method==='GET'&&route.pathname==='/api/news')return send(res,200,JSON.stringify(await getNews(route.searchParams.get('refresh')==='1')));
  if(req.method==='GET'&&route.pathname==='/api/xsd/status')return send(res,200,JSON.stringify(xsdLocalStatus()));
  if(req.method==='POST'&&route.pathname==='/api/xsd/sync')return send(res,200,JSON.stringify(await ensureFa3Schemas(true)));
  if(req.method==='POST'&&route.pathname==='/api/xsd/validate'){const xml=await readText(req);return send(res,200,JSON.stringify(await validateFa3Xml(xml)));}
  if(req.method==='GET'&&route.pathname==='/api/legal/status')return send(res,200,JSON.stringify(await legalSourceStatus()));
  if(req.method==='GET'&&route.pathname==='/api/qa/server')return send(res,200,JSON.stringify(qaServerStatus()));
  if(req.method==='POST'&&route.pathname==='/api/audit'){const payload=await readJson(req);return send(res,200,JSON.stringify(await audit(payload)));}
  if(req.method==='GET'&&route.pathname==='/api/health'){let pdfParserInstalled=false;try{require.resolve('pdf-parse');pdfParserInstalled=true}catch{}let pdfRendererInstalled=false;try{pdfRendererInstalled=fs.statSync(path.join(ROOT,'node_modules','pdf-parse','lib','pdf.js','v1.10.100','build','pdf.js')).size>1000}catch{}return send(res,200,JSON.stringify({ok:true,version:'2.5.1',pdfParserInstalled,pdfRendererInstalled}));}
  if(req.method==='GET'||req.method==='HEAD')return serveStatic(req,res);
  send(res,405,JSON.stringify({error:'Method not allowed'}));
 }catch(e){send(res,500,JSON.stringify({error:e?.message||String(e)}));}
});
function openBrowser(url){
 if(process.env.NO_BROWSER==='1')return;
 const cmd=process.platform==='win32'?`start "" "${url}"`:process.platform==='darwin'?`open "${url}"`:`xdg-open "${url}"`;
 exec(cmd,()=>{});
}
function listenOnFreePort(port,attempt=0){
 const onError=(err)=>{
  server.removeListener('listening',onListening);
  if(err&&err.code==='EADDRINUSE'&&attempt<MAX_PORT_TRIES){
   const next=port+1;
   console.log(`Port ${port} jest zajety. Probuje ${next}...`);
   setTimeout(()=>listenOnFreePort(next,attempt+1),50);
   return;
  }
  console.error(err);
  process.exitCode=1;
 };
 const onListening=()=>{
  server.removeListener('error',onError);
  const url=`http://${HOST}:${port}/`;
  console.log(`KSeF Checker Pro 2.5.1: ${url}`);
  console.log('Zamknij to okno, aby zatrzymac lokalny serwer.');
  openBrowser(url);
 };
 server.once('error',onError);
 server.once('listening',onListening);
 server.listen(port,HOST);
}
listenOnFreePort(BASE_PORT);
