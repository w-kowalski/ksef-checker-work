const state={xml:'',doc:null,fileName:'',inputType:'xml',pdfData:null,pdfRawText:'',pdfObjectUrl:'',checks:[],localChecks:[],externalChecks:[],xsdCheck:null,xsdValidation:null,auditSeq:0,auditStatus:'idle',auditMessage:'',auditDetails:null,officialXsl:null,officialXslSource:'',libraryManifest:null,currentLibraryEntry:null,news:null,newsLoading:false};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const els=(node,name)=>node?[...node.getElementsByTagNameNS('*',name)]:[];
const el=(node,name)=>els(node,name)[0]||null;
const direct=(node,name)=>node?[...node.children].find(x=>x.localName===name)||null:null;
const dval=(node,name)=>direct(node,name)?.textContent?.trim()||'';
const val=(node,name)=>el(node,name)?.textContent?.trim()||'';
const num=v=>{const n=parseFloat(String(v??'').replace(/[\s\u00A0\u202F]/g,'').replace(',','.'));return Number.isFinite(n)?n:0};
const clean=s=>String(s??'').trim();
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const money=(n,c='PLN')=>{try{return new Intl.NumberFormat('pl-PL',{style:'currency',currency:c||'PLN'}).format(num(n))}catch{return `${num(n).toFixed(2)} ${c}`}};
const close=(a,b,t=.03)=>Math.abs(num(a)-num(b))<=t;
const isoDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||''));
const dateUTC=s=>isoDate(s)?new Date(`${s}T00:00:00Z`):null;
const daysBetween=(a,b)=>{const aa=dateUTC(a),bb=dateUTC(b);return aa&&bb?Math.round((bb-aa)/86400000):null};
const standardInvoiceDeadline=sale=>{const d=dateUTC(sale);if(!d)return'';return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,15)).toISOString().slice(0,10)};

const BASE_HEAD=`<Naglowek><KodFormularza kodSystemowy="FA (3)" wersjaSchemy="1-0E">FA</KodFormularza><WariantFormularza>3</WariantFormularza><DataWytworzeniaFa>2026-09-23T10:15:00Z</DataWytworzeniaFa><SystemInfo>KSeF Checker Pro DEMO</SystemInfo></Naglowek>`;
const SELLER=`<Podmiot1><DaneIdentyfikacyjne><NIP>7018107174</NIP><Nazwa>Biuro Alfa Sp. z o.o.</Nazwa></DaneIdentyfikacyjne><Adres><KodKraju>PL</KodKraju><AdresL1>ul. Księgowa 12</AdresL1><AdresL2>00-001 Warszawa</AdresL2></Adres></Podmiot1>`;
const BUYER_PL=`<Podmiot2><DaneIdentyfikacyjne><NIP>5250001003</NIP><Nazwa>Klient Testowy Sp. z o.o.</Nazwa></DaneIdentyfikacyjne><Adres><KodKraju>PL</KodKraju><AdresL1>ul. Przykładowa 8</AdresL1><AdresL2>01-100 Warszawa</AdresL2></Adres><JST>2</JST><GV>2</GV></Podmiot2>`;
const BUYER_EU=`<Podmiot2><DaneIdentyfikacyjne><KodUE>DE</KodUE><NrVatUE>123456789</NrVatUE><Nazwa>Demo GmbH</Nazwa></DaneIdentyfikacyjne><Adres><KodKraju>DE</KodKraju><AdresL1>Musterstrasse 5</AdresL1><AdresL2>10115 Berlin</AdresL2></Adres><JST>2</JST><GV>2</GV></Podmiot2>`;
const BUYER_US=`<Podmiot2><DaneIdentyfikacyjne><KodKraju>US</KodKraju><NrID>US-998877</NrID><Nazwa>Demo Inc.</Nazwa></DaneIdentyfikacyjne><Adres><KodKraju>US</KodKraju><AdresL1>100 Example Ave</AdresL1><AdresL2>New York, NY</AdresL2></Adres><JST>2</JST><GV>2</GV></Podmiot2>`;
const ADNOT=(p18='2',p18a='2',extra='')=>`<Adnotacje><P_16>2</P_16><P_17>2</P_17><P_18>${p18}</P_18><P_18A>${p18a}</P_18A><Zwolnienie><P_19N>1</P_19N></Zwolnienie><NoweSrodkiTransportu><P_22N>1</P_22N></NoweSrodkiTransportu><P_23>2</P_23><PMarzy><P_PMarzyN>1</P_PMarzyN></PMarzy>${extra}</Adnotacje>`;
const wrap=(buyer,fa)=>`<?xml version="1.0" encoding="UTF-8"?><Faktura xmlns="http://crd.gov.pl/wzor/2025/06/25/13775/">${BASE_HEAD}${SELLER}${buyer}<Fa>${fa}</Fa></Faktura>`;

const samples={
 basic:wrap(BUYER_PL,`<KodWaluty>PLN</KodWaluty><P_1>2026-09-23</P_1><P_1M>Warszawa</P_1M><P_2>FV/09/2026/001</P_2><P_6>2026-09-23</P_6><P_13_1>1500.00</P_13_1><P_14_1>345.00</P_14_1><P_15>1845.00</P_15>${ADNOT()}<RodzajFaktury>VAT</RodzajFaktury><FaWiersz><NrWierszaFa>1</NrWierszaFa><P_7>Obsługa księgowa</P_7><P_8A>usł.</P_8A><P_8B>1</P_8B><P_9A>1500</P_9A><P_11>1500</P_11><P_11A>1845</P_11A><P_11Vat>345</P_11Vat><P_12>23</P_12></FaWiersz><Platnosc><TerminPlatnosci><Termin>2026-10-07</Termin></TerminPlatnosci><FormaPlatnosci>6</FormaPlatnosci></Platnosc>`),
 rcGood:wrap(BUYER_EU,`<KodWaluty>EUR</KodWaluty><P_1>2026-09-23</P_1><P_2>EU/09/2026/01</P_2><P_6>2026-09-23</P_6><P_13_9>1000.00</P_13_9><P_15>1000.00</P_15>${ADNOT('1')}<RodzajFaktury>VAT</RodzajFaktury><FaWiersz><NrWierszaFa>1</NrWierszaFa><P_7>Usługa doradcza B2B</P_7><P_8A>usł.</P_8A><P_8B>1</P_8B><P_9A>1000</P_9A><P_11>1000</P_11><P_11A>1000</P_11A><P_11Vat>0</P_11Vat><P_12>np II</P_12></FaWiersz>`),
 rcBad:wrap(BUYER_EU,`<KodWaluty>EUR</KodWaluty><P_1>2026-09-23</P_1><P_2>EU/09/2026/02</P_2><P_6>2026-09-23</P_6><P_13_9>1000.00</P_13_9><P_15>1000.00</P_15>${ADNOT('2')}<RodzajFaktury>VAT</RodzajFaktury><FaWiersz><NrWierszaFa>1</NrWierszaFa><P_7>Usługa doradcza B2B</P_7><P_8A>usł.</P_8A><P_8B>1</P_8B><P_9A>1000</P_9A><P_11>1000</P_11><P_11A>1000</P_11A><P_11Vat>0</P_11Vat><P_12>np II</P_12></FaWiersz>`),
 correction:wrap(BUYER_PL,`<KodWaluty>PLN</KodWaluty><P_1>2026-09-23</P_1><P_2>KOR/09/2026/01</P_2><P_13_1>-100.00</P_13_1><P_14_1>-23.00</P_14_1><P_15>-123.00</P_15>${ADNOT()}<RodzajFaktury>KOR</RodzajFaktury><PrzyczynaKorekty>Zwrot części usługi</PrzyczynaKorekty><TypKorekty>2</TypKorekty><DaneFaKorygowanej><DataWystFaKorygowanej>2026-09-01</DataWystFaKorygowanej><NrFaKorygowanej>FV/09/2026/001</NrFaKorygowanej><NrKSeFN>1</NrKSeFN></DaneFaKorygowanej><FaWiersz><NrWierszaFa>1</NrWierszaFa><P_7>Korekta obsługi księgowej</P_7><P_11>-100</P_11><P_11A>-123</P_11A><P_11Vat>-23</P_11Vat><P_12>23</P_12></FaWiersz>`),
 correctionNoReason:wrap(BUYER_PL,`<KodWaluty>PLN</KodWaluty><P_1>2026-09-23</P_1><P_2>KOR/09/2026/02</P_2><P_13_1>-100.00</P_13_1><P_14_1>-23.00</P_14_1><P_15>-123.00</P_15>${ADNOT()}<RodzajFaktury>KOR</RodzajFaktury><DaneFaKorygowanej><DataWystFaKorygowanej>2026-09-01</DataWystFaKorygowanej><NrFaKorygowanej>FV/09/2026/001</NrFaKorygowanej><NrKSeFN>1</NrKSeFN></DaneFaKorygowanej><FaWiersz><NrWierszaFa>1</NrWierszaFa><P_7>Korekta obsługi księgowej</P_7><P_11>-100</P_11><P_11A>-123</P_11A><P_11Vat>-23</P_11Vat><P_12>23</P_12></FaWiersz>`),
 wdt:wrap(BUYER_EU,`<KodWaluty>EUR</KodWaluty><P_1>2026-09-23</P_1><P_2>WDT/09/2026/01</P_2><P_13_6_2>2500.00</P_13_6_2><P_15>2500.00</P_15>${ADNOT()}<RodzajFaktury>VAT</RodzajFaktury><FaWiersz><NrWierszaFa>1</NrWierszaFa><P_7>Towar — WDT</P_7><P_8A>szt.</P_8A><P_8B>5</P_8B><P_9A>500</P_9A><P_11>2500</P_11><P_11A>2500</P_11A><P_11Vat>0</P_11Vat><P_12>0 WDT</P_12></FaWiersz>`),
 export:wrap(BUYER_US,`<KodWaluty>USD</KodWaluty><P_1>2026-09-23</P_1><P_2>EX/09/2026/01</P_2><P_13_6_3>3000.00</P_13_6_3><P_15>3000.00</P_15>${ADNOT()}<RodzajFaktury>VAT</RodzajFaktury><FaWiersz><NrWierszaFa>1</NrWierszaFa><P_7>Towar eksportowy</P_7><P_8A>szt.</P_8A><P_8B>3</P_8B><P_9A>1000</P_9A><P_11>3000</P_11><P_11A>3000</P_11A><P_11Vat>0</P_11Vat><P_12>0 EX</P_12></FaWiersz>`),
 mppBad:wrap(BUYER_PL,`<KodWaluty>PLN</KodWaluty><P_1>2026-09-23</P_1><P_2>MPP/09/2026/01</P_2><P_13_1>20000.00</P_13_1><P_14_1>4600.00</P_14_1><P_15>24600.00</P_15>${ADNOT('2','2')}<RodzajFaktury>VAT</RodzajFaktury><FaWiersz><NrWierszaFa>1</NrWierszaFa><P_7>Towar demonstracyjny z załącznika 15</P_7><P_8A>szt.</P_8A><P_8B>1</P_8B><P_9A>20000</P_9A><P_11>20000</P_11><P_11A>24600</P_11A><P_11Vat>4600</P_11Vat><P_12>23</P_12><P_12_Zal_15>1</P_12_Zal_15></FaWiersz>`),
 exempt:wrap(BUYER_PL,`<KodWaluty>PLN</KodWaluty><P_1>2026-09-23</P_1><P_2>ZW/09/2026/01</P_2><P_13_7>900.00</P_13_7><P_15>900.00</P_15><Adnotacje><P_16>2</P_16><P_17>2</P_17><P_18>2</P_18><P_18A>2</P_18A><Zwolnienie><P_19>1</P_19><P_19A>art. 43 ust. 1 ustawy o VAT — przykład demonstracyjny</P_19A></Zwolnienie><NoweSrodkiTransportu><P_22N>1</P_22N></NoweSrodkiTransportu><P_23>2</P_23><PMarzy><P_PMarzyN>1</P_PMarzyN></PMarzy></Adnotacje><RodzajFaktury>VAT</RodzajFaktury><FaWiersz><NrWierszaFa>1</NrWierszaFa><P_7>Usługa zwolniona — demo</P_7><P_8A>usł.</P_8A><P_8B>1</P_8B><P_9A>900</P_9A><P_11>900</P_11><P_11A>900</P_11A><P_11Vat>0</P_11Vat><P_12>zw</P_12></FaWiersz>`),
 foreignCurrency:wrap(BUYER_PL,`<KodWaluty>EUR</KodWaluty><P_1>2026-09-23</P_1><P_2>EUR/09/2026/01</P_2><P_13_1>1000.00</P_13_1><P_14_1>230.00</P_14_1><P_15>1230.00</P_15>${ADNOT()}<RodzajFaktury>VAT</RodzajFaktury><FaWiersz><NrWierszaFa>1</NrWierszaFa><P_7>Usługa krajowa w EUR</P_7><P_8A>usł.</P_8A><P_8B>1</P_8B><P_9A>1000</P_9A><P_11>1000</P_11><P_11A>1230</P_11A><P_11Vat>230</P_11Vat><P_12>23</P_12></FaWiersz>`)
};

function renderCurrentTestBanner(){
 const box=$('#currentTestBanner');if(!box)return;
 const e=state.currentLibraryEntry;
 if(!e){box.classList.add('hidden');box.innerHTML='';return;}
 box.classList.remove('hidden');
 box.innerHTML=`<div><b>Biblioteka testowa:</b> ${esc(e.title)} <small>• ${esc(e.group)} • oczekiwane: ${esc(e.expected||'scenariusz')}</small></div><button class="btn small ghost" id="backToLibraryInline">Wróć do biblioteki</button>`;
 $('#backToLibraryInline')?.addEventListener('click',()=>showView('testLibrary'));
}
function parseXml(xml,fileName='faktura.xml',libraryEntry=null,sourceType='xml'){
 const doc=new DOMParser().parseFromString(xml,'application/xml');
 if(doc.getElementsByTagName('parsererror').length){alert(sourceType==='pdf'?'Nie udało się zbudować modelu danych z PDF.':'Nie udało się odczytać XML. Dokument nie jest poprawnym XML-em.');return;}
 if(sourceType!=='pdf'){if(state.pdfObjectUrl){try{URL.revokeObjectURL(state.pdfObjectUrl)}catch{}}state.pdfObjectUrl='';state.pdfData=null;state.pdfRawText='';}
 state.xml=xml;state.doc=doc;state.fileName=fileName;state.inputType=sourceType;state.currentLibraryEntry=libraryEntry;state.xsdCheck=null;state.xsdValidation=null;
 rerun();$('#uploadPanel').classList.add('hidden');$('#results').classList.remove('hidden');$('#printBtn').disabled=false;$('#reportBtn').disabled=false;$('#clearBtn').disabled=false;renderCurrentTestBanner();
}
function readFile(file){if(!file)return;const isPdf=file.type==='application/pdf'||/\.pdf$/i.test(file.name||'');if(isPdf){if(window.pdfImport?.handleFile)return window.pdfImport.handleFile(file);alert('Moduł PDF nie został załadowany. Odśwież stronę i spróbuj ponownie.');return;}const isXml=/\.xml$/i.test(file.name||'')||/xml/i.test(file.type||'');if(!isXml){alert('Obsługiwane formaty to PDF i XML.');return;}const r=new FileReader();r.onload=()=>parseXml(String(r.result||''),file.name,null,'xml');r.readAsText(file,'UTF-8')}
function party(doc,tag){const p=el(doc,tag);if(!p)return{};const i=direct(p,'DaneIdentyfikacyjne')||p,a=direct(p,'Adres');const unique=n=>[...new Set(els(p,n).map(x=>clean(x.textContent)).filter(Boolean))];return{name:dval(i,'Nazwa'),nip:dval(i,'NIP'),kodUE:dval(i,'KodUE'),vatUE:dval(i,'NrVatUE'),countryId:dval(i,'KodKraju'),nrId:dval(i,'NrID'),brakId:dval(i,'BrakID'),gln:dval(i,'GLN'),country:a?dval(a,'KodKraju'):'',a1:a?dval(a,'AdresL1'):'',a2:a?dval(a,'AdresL2'):'',emails:unique('Email'),phones:unique('Telefon')}}
function rows(doc){return els(doc,'FaWiersz').map(r=>({
 node:r,
 no:dval(r,'NrWierszaFa'),
 uuid:dval(r,'UU_ID'),
 name:dval(r,'P_7'),
 unit:dval(r,'P_8A'),
 qty:dval(r,'P_8B'),
 priceNet:dval(r,'P_9A'),
 priceGross:dval(r,'P_9B'),
 price:dval(r,'P_9A')||dval(r,'P_9B'),
 discount:dval(r,'P_10'),
 net:dval(r,'P_11'),
 gross:dval(r,'P_11A'),
 vat:dval(r,'P_11Vat'),
 rate:dval(r,'P_12'),
 rateOSS:dval(r,'P_12_XII'),
 annex15:dval(r,'P_12_Zal_15'),
 kurs:dval(r,'KursWaluty'),
 before:dval(r,'StanPrzed'),
 gtin:dval(r,'GTIN'),
 pkwiu:dval(r,'PKWiU'),
 cn:dval(r,'CN'),
 pkob:dval(r,'PKOB'),
 excise:dval(r,'P_11A_XII'),
 gtu:dval(r,'GTU'),
 procedure:dval(r,'Procedura'),
 deliveryDate:dval(r,'P_6A'),
 index:dval(r,'Indeks')
}))}
function invoice(doc){
 const fa=el(doc,'Fa'),pay=fa?direct(fa,'Platnosc'):null,term=pay?el(pay,'Termin'):null,bank=pay?el(pay,'RachunekBankowy'):null;
 const bankNodes=pay?[...pay.children].filter(x=>x.localName==='RachunekBankowy'):[];
 const banks=bankNodes.map(x=>({nr:dval(x,'NrRB'),swift:dval(x,'SWIFT'),name:dval(x,'NazwaBanku'),desc:dval(x,'OpisRachunku')}));
 const refs=fa?els(fa,'DaneFaKorygowanej').map(x=>({
  date:dval(x,'DataWystFaKorygowanej'),number:dval(x,'NrFaKorygowanej'),ksef:dval(x,'NrKSeFFaKorygowanej'),noKsef:dval(x,'NrKSeFN')
 })):[];
 return{
  fa,
  currency:fa?dval(fa,'KodWaluty'):'',date:fa?dval(fa,'P_1'):'',place:fa?dval(fa,'P_1M'):'',number:fa?dval(fa,'P_2'):'',saleDate:fa?dval(fa,'P_6'):'',
  total:fa?dval(fa,'P_15'):'',type:fa?dval(fa,'RodzajFaktury'):'',reason:fa?dval(fa,'PrzyczynaKorekty'):'',correctionType:fa?dval(fa,'TypKorekty'):'',
  correctedNumber:fa?dval(fa,'NrFaKorygowany'):'',p15zk:fa?dval(fa,'P_15ZK'):'',kursWalutyZK:fa?dval(fa,'KursWalutyZK'):'',correctionRefs:refs,
  p16:val(fa,'P_16'),p17:val(fa,'P_17'),p18:val(fa,'P_18'),p18a:val(fa,'P_18A'),p19:val(fa,'P_19'),p19n:val(fa,'P_19N'),p22:val(fa,'P_22'),p22n:val(fa,'P_22N'),p23:val(fa,'P_23'),pmargin:val(fa,'P_PMarzy'),
  p19a:val(fa,'P_19A'),p19b:val(fa,'P_19B'),p19c:val(fa,'P_19C'),
  paymentDate:term?term.textContent.trim():'',paymentForm:pay?dval(pay,'FormaPlatnosci'):'',paymentOther:pay?dval(pay,'PlatnoscInna'):'',paymentDescription:pay?dval(pay,'OpisPlatnosci'):'',
  paid:pay?dval(pay,'Zaplacono'):'',paidDate:pay?dval(pay,'DataZaplaty'):'',partialPaid:pay?dval(pay,'ZnacznikZaplatyCzesciowej'):'',bankNo:bank?dval(bank,'NrRB'):'',banks,
  seller:party(doc,'Podmiot1'),buyer:party(doc,'Podmiot2'),rows:rows(doc),systemInfo:val(doc,'SystemInfo')
 }
}
function detect(inv){const rates=inv.rows.map(r=>r.rate);return{correction:/^KOR/.test(inv.type)||els(inv.fa,'DaneFaKorygowanej').length>0,advance:inv.type==='ZAL'||inv.type==='KOR_ZAL',settlement:inv.type==='ROZ'||inv.type==='KOR_ROZ',reverse:inv.p18==='1'||rates.some(x=>['oo','np I','np II'].includes(x)),wdt:rates.includes('0 WDT'),export:rates.includes('0 EX'),exempt:rates.includes('zw')||inv.p19==='1',margin:inv.pmargin==='1',mpp:inv.p18a==='1'||inv.rows.some(r=>r.annex15==='1'),foreign:inv.currency&&inv.currency!=='PLN',selfBilling:inv.p17==='1',cash:inv.p16==='1',triangular:inv.p23==='1',newTransport:inv.p22==='1'}}
function nipOk(n){if(!/^\d{10}$/.test(n))return false;const w=[6,5,7,2,3,4,5,6,7],d=[...n].map(Number),c=d.slice(0,9).reduce((s,x,i)=>s+x*w[i],0)%11;return c!==10&&c===d[9]}
function add(arr,type,category,title,desc,field='',fix=''){arr.push({type,category,title,desc,field,fix})}
function ruleChecks(doc){
 const C=[],inv=invoice(doc),det=detect(inv),fa=inv.fa,root=doc.documentElement;
 add(C,root?.localName==='Faktura'?'ok':'error','structure','Element główny Faktura',root?.localName==='Faktura'?'Dokument ma prawidłowy element główny.':'Oczekiwano elementu Faktura.','Faktura');
 const kod=val(doc,'KodFormularza'),wariant=val(doc,'WariantFormularza'); add(C,/FA\s*\(3\)/i.test(kod)&&wariant==='3'?'ok':'error','structure','Struktura FA(3)',`KodFormularza: ${kod||'brak'}, WariantFormularza: ${wariant||'brak'}.`,'Naglowek/KodFormularza','Od 1.02.2026 faktury ustrukturyzowane korzystają z FA(3).');
 ['Naglowek','Podmiot1','Podmiot2','Fa'].forEach(x=>add(C,el(doc,x)?'ok':'error','structure',`Sekcja ${x}`,el(doc,x)?'Sekcja obecna.':'Brak wymaganej głównej sekcji.',x));
 add(C,inv.number?'ok':'error','structure','Numer faktury P_2',inv.number?`Numer: ${inv.number}`:'Brak numeru faktury.','Fa/P_2');
 add(C,/^\d{4}-\d{2}-\d{2}$/.test(inv.date)?'ok':'error','structure','Data wystawienia P_1',inv.date?`Data: ${inv.date}`:'Brak prawidłowej daty YYYY-MM-DD.','Fa/P_1');
 add(C,/^[A-Z]{3}$/.test(inv.currency)?'ok':'error','structure','Kod waluty',inv.currency?`Waluta: ${inv.currency}`:'Brak trzyznakowego kodu waluty.','Fa/KodWaluty');
 // terminy wystawienia — automatyczna kontrola zasad ogólnych art. 106i
 if(!det.correction&&isoDate(inv.date)&&isoDate(inv.saleDate)){
  const deadline=standardInvoiceDeadline(inv.saleDate),delta=daysBetween(inv.saleDate,inv.date);
  if(inv.date<=deadline)add(C,'ok','deadline','Termin wystawienia — zasada ogólna',`Data wystawienia ${inv.date}; standardowy termin wynikający z art. 106i ust. 1: do ${deadline}.`,'Fa/P_1 + Fa/P_6','Dla czynności z terminami szczególnymi (m.in. niektóre usługi, media, najem) stosuje się odrębne terminy.');
  else add(C,'warn','deadline','Możliwe wystawienie po terminie',`Data wystawienia ${inv.date} jest późniejsza niż standardowy termin ${deadline} liczony od P_6=${inv.saleDate}.`,'Fa/P_1 + Fa/P_6','Sprawdź, czy transakcja nie podlega szczególnemu terminowi z art. 106i ust. 3–9 lub przepisom wykonawczym.');
  if(delta!==null&&delta < -60)add(C,'warn','deadline','Możliwe zbyt wczesne wystawienie',`Fakturę wystawiono ${Math.abs(delta)} dni przed datą P_6. Zasada ogólna nie pozwala wystawić jej wcześniej niż 60 dni przed dostawą/usługą.`,'Fa/P_1 + Fa/P_6','Sprawdź wyjątki z art. 106i ust. 8–9 oraz czy P_6 prawidłowo odzwierciedla zdarzenie.');
 }else if(det.correction){
  add(C,'info','deadline','Termin wystawienia korekty','Dla faktury korygującej nie stosuję mechanicznie standardowego testu „15. dzień następnego miesiąca”.','Fa/RodzajFaktury','Checker ocenia terminy korekt odrębnie dopiero po ustaleniu zdarzenia powodującego korektę.');
 }else if(!inv.saleDate){
  add(C,'info','deadline','Termin wystawienia — brak P_6','Nie można automatycznie policzyć standardowego terminu, ponieważ XML nie zawiera P_6.','Fa/P_6','Brak P_6 nie zawsze oznacza błąd; termin zależy od rodzaju transakcji i danych dokumentu.');
 }
 if(inv.seller.nip)add(C,nipOk(inv.seller.nip)?'ok':'error','id','NIP sprzedawcy',nipOk(inv.seller.nip)?'Suma kontrolna NIP jest poprawna.':'NIP nie przechodzi kontroli sumy kontrolnej.','Podmiot1/DaneIdentyfikacyjne/NIP');
 const b=inv.buyer,idPaths=[!!b.nip,!!(b.kodUE&&b.vatUE),!!(b.countryId&&b.nrId),b.brakId==='1'].filter(Boolean).length;add(C,idPaths===1?'ok':idPaths===0?'warn':'error','id','Sposób identyfikacji nabywcy',idPaths===1?'Wykryto jeden spójny sposób identyfikacji.':idPaths===0?'Nie wykryto pełnego identyfikatora nabywcy.':'Wykryto więcej niż jeden konkurencyjny sposób identyfikacji nabywcy.','Podmiot2/DaneIdentyfikacyjne');
 if(b.nip)add(C,nipOk(b.nip)?'ok':'error','id','NIP nabywcy',nipOk(b.nip)?'Suma kontrolna NIP jest poprawna.':'NIP nabywcy jest nieprawidłowy.','Podmiot2/.../NIP');
 add(C,inv.rows.length?'ok':'error','structure','Pozycje faktury',inv.rows.length?`Liczba pozycji: ${inv.rows.length}.`:'Nie znaleziono elementów FaWiersz.','Fa/FaWiersz');
 inv.rows.forEach((r,i)=>{if(r.qty&&r.price&&r.net){const expected=num(r.qty)*num(r.price);add(C,close(expected,r.net,.05)?'ok':'warn','math',`Pozycja ${r.no||i+1}: ilość × cena`,close(expected,r.net,.05)?'Wartość netto jest zgodna z ilością i ceną.':`Ilość × cena = ${expected.toFixed(2)}, P_11 = ${num(r.net).toFixed(2)}.`,'FaWiersz/P_11','Sprawdź rabaty, jednostkę lub wartość netto.');} if(['23','22','8','7','5','4','3'].includes(r.rate)&&r.net&&r.vat){const rate=num(r.rate),expected=num(r.net)*rate/100;add(C,close(expected,r.vat,.07)?'ok':'warn','math',`Pozycja ${r.no||i+1}: VAT ${r.rate}%`,close(expected,r.vat,.07)?'Kwota VAT jest matematycznie spójna.':`Z netto wynika około ${expected.toFixed(2)}, a P_11Vat wynosi ${num(r.vat).toFixed(2)}.`,'FaWiersz/P_11Vat');}});
 const sumGross=inv.rows.reduce((s,r)=>s+num(r.gross||r.net)+(!r.gross?num(r.vat):0),0);if(inv.total)add(C,close(sumGross,inv.total,.1)?'ok':'error','math','Kontrola P_15',close(sumGross,inv.total,.1)?`Suma pozycji = ${num(inv.total).toFixed(2)}.`:`Suma pozycji ≈ ${sumGross.toFixed(2)}, a P_15 = ${num(inv.total).toFixed(2)}.`,'Fa/P_15','Sprawdź podsumowanie lub kwoty w wierszach.');
 const groups=[['23','P_13_1','P_14_1'],['22','P_13_1','P_14_1'],['8','P_13_2','P_14_2'],['7','P_13_2','P_14_2'],['5','P_13_3','P_14_3']];groups.forEach(([rate,p13,p14])=>{const rr=inv.rows.filter(r=>r.rate===rate);if(!rr.length)return;const n=rr.reduce((s,r)=>s+num(r.net),0),v=rr.reduce((s,r)=>s+num(r.vat),0);add(C,close(n,dval(fa,p13),.1)&&close(v,dval(fa,p14),.1)?'ok':'error','math',`Podsumowanie stawki ${rate}%`,`Wiersze: netto ${n.toFixed(2)}, VAT ${v.toFixed(2)}; ${p13}: ${dval(fa,p13)||'brak'}, ${p14}: ${dval(fa,p14)||'brak'}.`,`${p13}/${p14}`)});
 // reverse charge / poza terytorium
 const rcRows=inv.rows.filter(r=>['oo','np I','np II'].includes(r.rate));const rcExpected=rcRows.length>0;
 if(rcExpected)add(C,inv.p18==='1'?'ok':'error','tax','Adnotacja „odwrotne obciążenie”',inv.p18==='1'?'P_18=1 — adnotacja jest ustawiona.':`Wykryty kontekst wskazuje, że nabywca rozlicza podatek, ale P_18=${inv.p18||'brak'}.`,'Fa/Adnotacje/P_18','Ustal stan faktyczny. Jeżeli nabywca jest zobowiązany do rozliczenia podatku, ustaw P_18=1.');
 if(inv.p18==='1'&&!rcExpected)add(C,'info','tax','P_18=1 bez oczywistego sygnału w wierszach','Samo P_18 może być prawidłowe, ale XML nie daje checkerowi wystarczającego kontekstu, by to potwierdzić.','Fa/Adnotacje/P_18','Zweryfikuj miejsce opodatkowania i status nabywcy.');
 const np2=inv.rows.filter(r=>r.rate==='np II');if(np2.length){add(C,dval(fa,'P_13_9')?'ok':'error','tax','Usługi art. 100 ust. 1 pkt 4 — P_13_9',dval(fa,'P_13_9')?'Wartość P_13_9 jest obecna.':'Wiersze mają P_12=np II, ale brak P_13_9.','Fa/P_13_9');add(C,b.kodUE&&b.vatUE?'ok':'warn','id','Nabywca UE dla „np II”',b.kodUE&&b.vatUE?`VAT UE: ${b.kodUE}${b.vatUE}`:'Brak pary KodUE + NrVatUE nabywcy.','Podmiot2/DaneIdentyfikacyjne');}
 const np1=inv.rows.filter(r=>r.rate==='np I');if(np1.length)add(C,dval(fa,'P_13_8')?'ok':'error','tax','Sprzedaż poza terytorium — P_13_8',dval(fa,'P_13_8')?'Wartość P_13_8 jest obecna.':'Wiersze mają P_12=np I, ale brak P_13_8.','Fa/P_13_8');
 const oo=inv.rows.filter(r=>r.rate==='oo');if(oo.length)add(C,dval(fa,'P_13_10')?'ok':'error','tax','Krajowe odwrotne obciążenie — P_13_10',dval(fa,'P_13_10')?'P_13_10 jest obecne.':'Wiersz ma P_12=oo, ale brak P_13_10.','Fa/P_13_10');
 // WDT / export
 const wdt=det.wdt;if(wdt){add(C,dval(fa,'P_13_6_2')?'ok':'error','tax','WDT — podsumowanie P_13_6_2',dval(fa,'P_13_6_2')?'P_13_6_2 jest obecne.':'Brak P_13_6_2 przy WDT.','Fa/P_13_6_2');add(C,b.kodUE&&b.vatUE?'ok':'error','id','WDT — VAT UE nabywcy',b.kodUE&&b.vatUE?`Nabywca: ${b.kodUE}${b.vatUE}`:'Brak KodUE/NrVatUE nabywcy.','Podmiot2/DaneIdentyfikacyjne');}
 const exp=det.export;if(exp){add(C,dval(fa,'P_13_6_3')?'ok':'error','tax','Eksport — podsumowanie P_13_6_3',dval(fa,'P_13_6_3')?'P_13_6_3 jest obecne.':'Brak P_13_6_3 przy eksporcie.','Fa/P_13_6_3');add(C,(b.countryId&&b.nrId)||b.country?'ok':'warn','id','Eksport — identyfikacja zagranicznego nabywcy','Sprawdzenie danych kraju/identyfikatora kontrahenta.', 'Podmiot2/DaneIdentyfikacyjne');}
 // MPP
 const annex=inv.rows.some(r=>r.annex15==='1');const mppThreshold=inv.currency==='PLN'&&num(inv.total)>15000;if(annex&&mppThreshold)add(C,inv.p18a==='1'?'ok':'error','tax','Mechanizm podzielonej płatności',inv.p18a==='1'?'P_18A=1 przy pozycji z załącznika 15 i kwocie > 15 000 PLN.':`Wykryto zał. 15 i P_15=${num(inv.total).toFixed(2)} PLN, ale P_18A=${inv.p18a||'brak'}.`,'Fa/Adnotacje/P_18A','Jeśli spełnione są ustawowe warunki MPP, faktura powinna zawierać adnotację i P_18A=1.');if(annex&&inv.currency!=='PLN')add(C,'warn','tax','MPP w walucie obcej — próg wymaga przeliczenia','Wykryto pozycję z załącznika 15, ale faktura jest w walucie obcej. Checker nie ma kursu właściwego do automatycznego rozstrzygnięcia progu 15 000 zł.','P_12_Zal_15/P_18A','Zweryfikuj równowartość 15 000 zł zgodnie z właściwymi zasadami przeliczenia.');
 // zwolnienie
 const zw=det.exempt;if(zw){const basis=val(fa,'P_19A')||val(fa,'P_19B')||val(fa,'P_19C');add(C,inv.p19==='1'?'ok':'error','tax','Adnotacja o zwolnieniu',inv.p19==='1'?'P_19=1.':'Wykryto sprzedaż ze stawką „zw”, ale P_19 nie ma wartości 1.','Fa/Adnotacje/Zwolnienie/P_19');add(C,basis?'ok':'error','tax','Podstawa zwolnienia',basis?`Wskazano podstawę: ${basis}`:'Brak P_19A/P_19B/P_19C.','Fa/Adnotacje/Zwolnienie','Wskaż przepis, dyrektywę albo inną podstawę zwolnienia.');if(inv.p19n==='1')add(C,'error','tax','Sprzeczne oznaczenie P_19N','P_19N=1 oznacza brak sprzedaży zwolnionej, a dokument zawiera sprzedaż „zw”.','Fa/Adnotacje/Zwolnienie/P_19N');}
 // corrections
 const corr=det.correction;if(corr){const refs=els(fa,'DaneFaKorygowanej');add(C,refs.length?'ok':'error','correction','Dane faktury korygowanej',refs.length?`Liczba referencji: ${refs.length}.`:'Brak elementu DaneFaKorygowanej.','Fa/DaneFaKorygowanej');refs.forEach((r,i)=>{add(C,dval(r,'DataWystFaKorygowanej')&&dval(r,'NrFaKorygowanej')?'ok':'error','correction',`Referencja korekty ${i+1}`,`Data: ${dval(r,'DataWystFaKorygowanej')||'brak'}, numer: ${dval(r,'NrFaKorygowanej')||'brak'}.`,'DaneFaKorygowanej');const inK=dval(r,'NrKSeF')==='1',out=dval(r,'NrKSeFN')==='1',nr=dval(r,'NrKSeFFaKorygowanej');add(C,(inK&&nr&&!out)||(out&&!inK&&!nr)?'ok':'error','correction',`KSeF faktury korygowanej ${i+1}`,(inK&&nr)?'Wskazano fakturę pierwotną z KSeF.':out?'Wskazano fakturę pierwotną spoza KSeF.':'Niespójne znaczniki NrKSeF / NrKSeFN.','DaneFaKorygowanej/NrKSeF*');});add(C,inv.reason?'ok':'warn','correction','Przyczyna korekty',inv.reason?`Przyczyna: ${inv.reason}`:'Pole PrzyczynaKorekty jest puste. W FA(3) jest opcjonalne, więc to nie jest formalny błąd struktury, ale opis bywa praktycznie bardzo przydatny.','Fa/PrzyczynaKorekty','Rozważ podanie przyczyny, szczególnie dla czytelności księgowej i audytowej.');add(C,inv.correctionType?'ok':'info','correction','TypKorekty',inv.correctionType?`TypKorekty=${inv.correctionType}.`:'TypKorekty jest polem opcjonalnym i nie został podany.','Fa/TypKorekty');}
 // advance / settlement
 const adv=det.advance;if(adv)add(C,els(fa,'Zamowienie').length?'ok':'warn','tax','Faktura zaliczkowa — Zamowienie',els(fa,'Zamowienie').length?'Element Zamowienie jest obecny.':'Nie znaleziono elementu Zamowienie; sprawdź kompletność danych właściwych dla zaliczki.','Fa/Zamowienie');
 const sett=det.settlement;if(sett){const zz=els(fa,'FakturaZaliczkowa');add(C,zz.length?'ok':'error','tax','Faktura rozliczająca — referencje do zaliczek',zz.length?`Liczba referencji: ${zz.length}.`:'Brak elementu FakturaZaliczkowa.','Fa/FakturaZaliczkowa');}
 // margin
 const margin=det.margin;if(margin){const subtype=['P_PMarzy_2','P_PMarzy_3_1','P_PMarzy_3_2','P_PMarzy_3_3'].some(x=>val(fa,x)==='1');add(C,inv.pmargin==='1'?'ok':'error','tax','Procedura marży — znacznik',inv.pmargin==='1'?'P_PMarzy=1.':'Kontekst wskazuje VAT marża, ale brak P_PMarzy=1.','Fa/Adnotacje/PMarzy/P_PMarzy');add(C,subtype?'ok':'error','tax','Procedura marży — rodzaj',subtype?'Wskazano podtyp procedury marży.':'Brak jednego z pól P_PMarzy_2 / 3_1 / 3_2 / 3_3.','Fa/Adnotacje/PMarzy');}
 // foreign currency domestic VAT
 const domesticVat=inv.rows.some(r=>['23','22','8','7','5','4','3'].includes(r.rate));if(inv.currency!=='PLN'&&domesticVat){const needed=[];if(inv.rows.some(r=>['23','22'].includes(r.rate)))needed.push('P_14_1W');if(inv.rows.some(r=>['8','7'].includes(r.rate)))needed.push('P_14_2W');if(inv.rows.some(r=>r.rate==='5'))needed.push('P_14_3W');const missing=needed.filter(x=>!dval(fa,x));add(C,missing.length?'error':'ok','tax','VAT w PLN przy fakturze walutowej',missing.length?`Brakuje: ${missing.join(', ')}.`:'Wykryto wymagane kwoty podatku przeliczone na PLN.',needed.join(', '),'Przy krajowym VAT w walucie obcej sprawdź pola P_14_*W.');}
 // annotations / special
 if(inv.p17==='1')add(C,'info','tax','Samofakturowanie','P_17=1 — faktura oznaczona jako samofakturowanie.','Fa/Adnotacje/P_17');if(inv.p16==='1')add(C,'info','tax','Metoda kasowa','P_16=1 — faktura oznaczona jako metoda kasowa.','Fa/Adnotacje/P_16');if(inv.p23==='1')add(C,'info','tax','Procedura uproszczona trójstronna','P_23=1 — sprawdź warunki transakcji trójstronnej i dane VAT UE.','Fa/Adnotacje/P_23');if(inv.p22==='1')add(C,els(fa,'NowySrodekTransportu').length?'ok':'error','tax','Nowy środek transportu',els(fa,'NowySrodekTransportu').length?'Sekcja NowySrodekTransportu jest obecna.':'P_22=1, ale brak danych NowySrodekTransportu.','Fa/Adnotacje/NoweSrodkiTransportu');
 return C;
}
function buildAuditPayload(inv){
 const det=detect(inv),fa=inv.fa;
 const domesticVat=inv.rows.some(r=>['23','22','8','7','5','4','3'].includes(r.rate));
 const vatGroups=[
  ['23/22%','P_14_1','P_14_1W'],['8/7%','P_14_2','P_14_2W'],['5%','P_14_3','P_14_3W'],['4/3%','P_14_4','P_14_4W']
 ].map(([label,foreignField,plnField])=>({label,foreignField,plnField,foreignVat:dval(fa,foreignField),plnVat:dval(fa,plnField)})).filter(x=>x.foreignVat||x.plnVat);
 return{
  sourceType:state.inputType||'xml',invoiceDate:inv.date,saleDate:inv.saleDate,paymentDate:inv.paymentDate,paidDate:inv.paidDate,currency:inv.currency,type:inv.type,total:inv.total,
  domesticVat,flags:{wdt:det.wdt,reverse:det.reverse,export:det.export,correction:det.correction,advance:det.advance},
  seller:inv.seller,buyer:inv.buyer,banks:inv.banks.map(x=>x.nr).filter(Boolean),vatGroups
 };
}
function setAuditStatus(kind,msg){
 state.auditStatus=kind;state.auditMessage=msg||'';
 const box=$('#liveAuditStatus'),txt=$('#liveAuditText');if(!box||!txt)return;
 box.className=`live-audit-status ${kind}`;txt.textContent=msg||'';
}
function onlineUnavailableCheck(desc){return{type:'warn',category:'registry',title:'Weryfikacja online niedostępna',desc,field:'MF / VIES / NBP',fix:window.KSEF_WORK_MODE?'W trybie WORK spróbuj ponownie lub użyj oficjalnego serwisu ręcznie.':'Opublikuj wersję WORK ONLINE na Netlify albo ustaw adres API serverless.'}}
async function fetchXsdValidation(seq){
 if(location.protocol==='file:')return{validation:{available:false,ok:null,errors:[{message:'Walidacja XSD wymaga warstwy online/serverless.'}],engine:'offline'},check:{type:'warn',category:'xsd',title:'Walidacja XSD niedostępna',desc:'Uruchom projekt przez START_CHECKER.bat, aby sprawdzić dokument względem oficjalnego schematu FA(3).',field:'FA(3) XSD',fix:'Uruchom warstwę online/serverless i ponownie wczytaj XML.'}};
 try{
  const r=await fetch('/api/xsd/validate',{method:'POST',headers:{'Content-Type':'application/xml; charset=utf-8'},body:state.xml,cache:'no-store'}),j=await r.json();if(!r.ok)throw new Error(j.error||`HTTP ${r.status}`);if(seq!==state.auditSeq)return null;
  if(!j.available)return{validation:j,check:{type:'warn',category:'xsd',title:'Nie udało się uruchomić pełnej walidacji XSD',desc:'Oficjalny schemat FA(3) nie jest jeszcze zapisany lokalnie albo silnik walidacji jest niedostępny.',field:'FA(3) XSD',fix:'Sprawdź połączenie z internetem i w zakładce Testy / QA zsynchronizuj schemat FA(3).'}};
  if(j.ok)return{validation:j,check:{type:'ok',category:'xsd',title:'XML zgodny z XSD FA(3)',desc:`Dokument przeszedł techniczną walidację XSD (${j.engine||'XSD'}).`,field:'FA(3) XSD',fix:''}};
  const first=(j.errors||[])[0],extra=(j.errors||[]).length>1?` (+${j.errors.length-1} kolejnych)`:'';
  return{validation:j,check:{type:'error',category:'xsd',title:'XML niezgodny z XSD FA(3)',desc:`${first?.line?`Linia ${first.line}: `:''}${first?.message||'Schemat zgłosił błąd.'}${extra}`,field:'FA(3) XSD',fix:'Popraw strukturę XML zgodnie z oficjalnym schematem FA(3) przed wysyłką do KSeF.'}};
 }catch(e){return{validation:{available:false,ok:null,errors:[{message:e?.message||String(e)}],engine:'error'},check:{type:'warn',category:'xsd',title:'Walidator XSD chwilowo niedostępny',desc:e?.message||String(e),field:'FA(3) XSD',fix:'Sprawdź warstwę online/serverless oraz dostępność oficjalnego schematu FA(3).'}}}
}
function renderXsdStatus(){
 const strip=$('#xsdStatusStrip'),txt=$('#xsdStatusText');if(!strip||!txt)return;const dot=strip.querySelector('.xsd-dot');if(state.inputType==='pdf'){if(dot){dot.className='xsd-dot neutral';dot.textContent='—'}txt.textContent='Nie dotyczy — PDF nie jest strukturą XML FA(3). Kontrolujemy treść faktury, ale nie można wykonać walidacji XSD/KSeF.';return;}const v=state.xsdValidation;
 let cls='neutral',label='Oczekuje na walidację.';
 if(v?.available&&v.ok){cls='ok';label=`Zgodny z XSD FA(3) • ${v.engine||'silnik XSD'}`}
 else if(v?.available&&v.ok===false){cls='error';label=`Niezgodny z XSD FA(3) • ${(v.errors||[]).length} problemów`}
 else if(v){cls='warn';label='Pełna walidacja XSD niedostępna — zobacz Testy / QA.'}
 if(dot){dot.className=`xsd-dot ${cls}`;dot.textContent=cls==='ok'?'✓':cls==='error'?'×':cls==='warn'?'!':'•'}txt.textContent=label;
}
async function rerun(){
 if(!state.doc)return;
 const seq=++state.auditSeq;
 state.localChecks=state.inputType==='pdf'&&window.pdfImport?.ruleChecks?window.pdfImport.ruleChecks(state.doc):ruleChecks(state.doc);state.externalChecks=[];state.auditDetails=null;state.xsdCheck=null;state.xsdValidation=null;state.checks=[...state.localChecks];
 renderAll();renderXsdStatus();
 if(state.inputType==='pdf'){
  if(location.protocol==='file:'){state.externalChecks=[onlineUnavailableCheck('Analiza PDF i kontrole rejestrowe wymagają warstwy online/serverless. Opublikuj aplikację na Netlify.')];state.checks=[...state.localChecks,...state.externalChecks];setAuditStatus('offline','PDF jest analizowany przez warstwę online/serverless Node. Opublikuj aplikację na Netlify.');renderAll();renderXsdStatus();saveControlHistory();return;}
  setAuditStatus('loading','Sprawdzam dane odczytane z PDF w Białej Liście MF, VIES i NBP…');
  try{const res=await fetch('/api/audit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(buildAuditPayload(invoice(state.doc)))}),data=await res.json().catch(()=>({}));if(seq!==state.auditSeq)return;if(!res.ok)throw new Error(data.error||`HTTP ${res.status}`);state.externalChecks=Array.isArray(data.checks)?(window.pdfImport?.adaptChecks?window.pdfImport.adaptChecks(data.checks):data.checks):[];state.auditDetails=data.details||null;const unavailable=Number(data.unavailable||0);setAuditStatus(unavailable?'partial':'done',unavailable?`Weryfikacja PDF zakończona częściowo — ${unavailable} źródło/źródła niedostępne.`:'Weryfikacja danych z PDF zakończona. Wyniki rejestrowe dodano do Checkera.');}
  catch(e){state.externalChecks=[onlineUnavailableCheck(`Nie udało się wykonać weryfikacji danych z PDF: ${e?.message||e}`)];setAuditStatus('offline','Nie udało się uruchomić weryfikacji online.');}
  state.checks=[...state.localChecks,...state.externalChecks];renderAll();renderXsdStatus();saveControlHistory();return;
 }
 if(location.protocol==='file:'){
  state.externalChecks=[onlineUnavailableCheck('Strona została otwarta jako plik lokalny. Kontrole rejestrowe wymagają warstwy online/serverless do bezpiecznego połączenia z oficjalnymi usługami.')];
  const xv=await fetchXsdValidation(seq);if(xv){state.xsdValidation=xv.validation;state.xsdCheck=xv.check}
  state.checks=[...state.localChecks,...state.externalChecks,...(state.xsdCheck?[state.xsdCheck]:[])];setAuditStatus('offline','Kontrole MF, VIES i NBP nie działają w trybie file://. Opublikuj aplikację na Netlify.');renderAll();renderXsdStatus();saveControlHistory();return;
 }
 setAuditStatus('loading','Sprawdzam Białą Listę MF, VIES/VAT UE, rachunek bankowy, kurs NBP i techniczną zgodność XSD FA(3)…');
 const auditPromise=(async()=>{const res=await fetch('/api/audit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(buildAuditPayload(invoice(state.doc)))});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||`HTTP ${res.status}`);return data})();
 const xsdPromise=fetchXsdValidation(seq);
 const [auditResult,xsdResult]=await Promise.allSettled([auditPromise,xsdPromise]);if(seq!==state.auditSeq)return;
 if(auditResult.status==='fulfilled'){
  const data=auditResult.value;state.externalChecks=Array.isArray(data.checks)?data.checks:[];state.auditDetails=data.details||null;const unavailable=Number(data.unavailable||0);setAuditStatus(unavailable?'partial':'done',unavailable?`Weryfikacja zakończona częściowo — ${unavailable} źródło/źródła chwilowo niedostępne.`:'Weryfikacja rejestrowa zakończona. Wyniki dodano do Checkera Pro.');
 }else{
  const e=auditResult.reason;state.externalChecks=[onlineUnavailableCheck(`Nie udało się połączyć z modułem weryfikacji online: ${e?.message||e}`)];setAuditStatus('offline','Nie udało się uruchomić weryfikacji online. Sprawdź publikację Netlify Functions albo ustawiony adres API.');
 }
 if(xsdResult.status==='fulfilled'&&xsdResult.value){state.xsdValidation=xsdResult.value.validation;state.xsdCheck=xsdResult.value.check}else{state.xsdValidation={available:false,ok:null,errors:[{message:'Nie udało się wykonać walidacji XSD.'}]};state.xsdCheck={type:'warn',category:'xsd',title:'Walidacja XSD niedostępna',desc:'Nie udało się uruchomić silnika XSD.',field:'FA(3) XSD',fix:'Sprawdź zakładkę Testy / QA.'}}
 state.checks=[...state.localChecks,...state.externalChecks,...(state.xsdCheck?[state.xsdCheck]:[])];renderAll();renderXsdStatus();saveControlHistory();
}

function profiles(inv){const d=detect(inv),out=[];const map=[['correction','Korekta'],['advance','Zaliczka'],['settlement','Rozliczająca'],['reverse','Reverse charge'],['wdt','WDT'],['export','Eksport'],['exempt','Zwolnienie'],['margin','VAT marża'],['mpp','MPP / zał. 15'],['foreign','Waluta obca'],['selfBilling','Samofakturowanie'],['cash','Metoda kasowa'],['triangular','Trójstronna'],['newTransport','Nowy środek transportu']];map.forEach(([k,n])=>{if(d[k])out.push(n)});return out.length?out:['Standardowa'];}
function renderAll(){
 const inv=invoice(state.doc),counts={error:0,warn:0,info:0,ok:0};
 state.checks.forEach(x=>counts[x.type]++);
 $('#errCount').textContent=counts.error;$('#warnCount').textContent=counts.warn;$('#checkCount').textContent=state.checks.length;
 const icon=$('#statusIcon'),issues=state.checks.filter(x=>x.type==='error'||x.type==='warn');
 icon.className='status-icon '+(counts.error?'error':counts.warn?'warn':'ok');icon.textContent=counts.error||counts.warn?'!':'✓';
 $('#statusTitle').textContent=counts.error?`Wykryto ${counts.error} ${counts.error===1?'błąd':'błędy'}`:counts.warn?`Nie wykryto błędów — ${counts.warn} ${counts.warn===1?'ostrzeżenie':'ostrzeżenia'}`:'Nie wykryto błędów';
 $('#statusSubtitle').textContent=`${state.fileName} • ${state.inputType==='pdf'?'PDF':'XML FA(3)'} • ${inv.rows.length} pozycji/podsumowań • wykonano ${state.checks.length} kontroli`;
 $('#profileStrip').innerHTML=`<span class="profile-badge neutral">Wykryto automatycznie:</span>`+profiles(inv).map(x=>`<span class="profile-badge">${esc(x)}</span>`).join('');
 const highlights=buildHighlights(state.checks,inv); state.highlights=highlights;
 renderContractors(inv);renderChecks();if(state.inputType==='pdf'){window.pdfImport?.renderReview?.();window.pdfImport?.renderPreview?.()}else{window.pdfImport?.hideReview?.();renderOfficialInvoicePreview(state.xml)}
}
function checkHtml(c){return `<div class="check-item ${c.type}" data-category="${c.category}"><div class="check-dot">${c.type==='ok'?'✓':c.type==='error'?'!':c.type==='warn'?'!':'i'}</div><div><div class="check-title">${esc(c.title)}</div><div class="check-desc">${esc(c.desc)}</div>${c.fix?`<div class="check-fix"><b>Co sprawdzić:</b> ${esc(c.fix)}</div>`:''}</div><div class="check-meta"><span class="category-pill">${esc(c.category)}</span>${c.field?`<span class="field-pill">${esc(c.field)}</span>`:''}</div></div>`}
function statusIcon(type){return type==='ok'?'✓':type==='error'?'×':type==='warn'?'!':'•'}
function partyIdValue(p){if(p.nip)return `NIP ${p.nip}`;if(p.kodUE&&p.vatUE)return `VAT UE ${p.kodUE}${p.vatUE}`;if(p.countryId&&p.nrId)return `${p.countryId} ${p.nrId}`;if(p.brakId==='1')return 'Brak identyfikatora';return '—'}
function localPartyIdStatus(p){if(p.nip)return nipOk(p.nip)?{type:'ok',note:'Poprawna suma kontrolna NIP.'}:{type:'error',note:'NIP nie przechodzi kontroli sumy kontrolnej.'};if(p.kodUE&&p.vatUE)return{type:'info',note:`Identyfikator VAT UE odczytany z ${state.inputType==='pdf'?'PDF':'XML'}.`};if(p.countryId&&p.nrId)return{type:'info',note:`Zagraniczny identyfikator odczytany z ${state.inputType==='pdf'?'PDF':'XML'}.`};if(p.brakId==='1')return{type:'info',note:`Dokument wskazuje brak identyfikatora.`};return{type:'warn',note:'Brak pełnego identyfikatora kontrahenta.'}}
function partyAddress(p){return [p.a1,p.a2,p.country?countryName(p.country):''].filter(Boolean).join(', ')}
function statusFromComparison(base,cmp){if(cmp&&cmp.status)return{type:cmp.status,note:cmp.message||base.note,registry:cmp.registryValue||''};return base}
function mfVatStatus(detail,domesticVat){const mf=detail?.mf;if(!mf)return{type:'info',value:'Oczekuje na weryfikację',note:'Status zostanie uzupełniony z Białej Listy MF.'};if(mf.unavailable)return{type:'info',value:'Rejestr chwilowo niedostępny',note:mf.error||'Nie udało się pobrać danych z Białej Listy MF.'};if(!mf.found)return{type:domesticVat?'warn':'info',value:'Nie znaleziono w wykazie',note:'Rejestr MF nie zwrócił podmiotu dla tego NIP na dzień weryfikacji.'};const active=String(mf.statusVat||'').toLowerCase()==='czynny';return{type:active?'ok':domesticVat?'warn':'info',value:mf.statusVat||'Brak statusu',note:`Biała Lista MF • ${mf.registryDate||state.auditDetails?.registryDate||''}`}}
function viesStatus(detail){const v=detail?.vies;if(!v)return{type:'info',value:'Brak wyniku / nie dotyczy',note:`VIES jest sprawdzany, gdy z ${state.inputType==='pdf'?'PDF':'XML'} można zbudować numer VAT UE.`};if(v.unavailable)return{type:'info',value:'VIES chwilowo niedostępny',note:v.error||'Nie udało się wykonać kontroli VIES.'};return{type:v.valid?'ok':'warn',value:v.valid?'Aktywny VAT UE':'Nieaktywny VAT UE',note:[v.name&&v.name!=='---'?v.name:'',v.requestDate?`stan na ${v.requestDate}`:''].filter(Boolean).join(' • ')}}
function fieldHtml(label,value,status,opts={}){const t=status?.type||'neutral',note=status?.note||'',reg=status?.registry||'';return `<div class="party-field"><div class="party-status ${esc(t)}">${statusIcon(t)}</div><div class="party-field-label">${esc(label)}</div><div class="party-field-value">${opts.rawHtml?value:esc(value||'—')}${reg?`<div class="registry-compare ${esc(t)}"><b>Rejestr:</b> ${esc(reg)}</div>`:''}</div>${note?`<div class="party-field-note ${esc(t)}">${esc(note)}</div>`:''}</div>`}
function contactHtml(p){const parts=[];if(p.emails?.length)parts.push(`e-mail: ${p.emails.join(', ')}`);if(p.phones?.length)parts.push(`tel.: ${p.phones.join(', ')}`);return parts.join(' • ')||'—'}
function bankStatus(inv,side){if(side!=='seller')return{type:'neutral',note:'Rachunek płatności z dokumentu jest prezentowany przy sprzedawcy.'};if(!inv.banks.length)return{type:'info',note:`W ${state.inputType==='pdf'?'PDF':'XML'} nie wskazano rachunku bankowego.`};const details=state.auditDetails?.bankAccounts||[];if(details.some(x=>x.assigned===false))return{type:'warn',note:'Co najmniej jeden rachunek nie został potwierdzony jako przypisany do NIP sprzedawcy na Białej Liście.'};if(details.length&&details.every(x=>x.assigned===true))return{type:'ok',note:'Rachunek/racunki potwierdzone na Białej Liście MF.'};return{type:'info',note:`Rachunek odczytany z ${state.inputType==='pdf'?'PDF':'XML'}; trwa lub nie wykonano weryfikacji Białej Listy.`}}
function renderPartyCard(inv,side){const p=side==='seller'?inv.seller:inv.buyer,detail=state.auditDetails?.[side]||{},label=side==='seller'?'Sprzedawca':'Nabywca',klass=side==='seller'?'seller':'buyer';if(!p||!Object.keys(p).length)return `<article class="contractor-card ${klass}"><div class="contractor-card-head"><div class="contractor-role">${label}</div><h3 class="contractor-name">Brak danych</h3></div><div class="no-party-data">Nie udało się odczytać danych kontrahenta z dokumentu.</div></article>`;
 const src=state.inputType==='pdf'?'PDF':'XML';const nameBase={type:p.name?'ok':'error',note:p.name?`Nazwa odczytana z ${src}.`:`Brak nazwy kontrahenta w ${src}.`};const nameSt=statusFromComparison(nameBase,detail.comparisons?.name);
 const idSt=statusFromComparison(localPartyIdStatus(p),detail.comparisons?.id);
 const addr=partyAddress(p);let addrBase={type:addr?'ok':'warn',note:addr?`Adres odczytany z ${src}.`:`Brak adresu kontrahenta w ${src}.`};if(p.country==='PL'&&p.a2&&!/\b\d{2}-\d{3}\b/.test(p.a2))addrBase={type:'warn',note:'W polskim adresie nie wykryto kodu pocztowego w formacie 00-000.'};const addrSt=statusFromComparison(addrBase,detail.comparisons?.address);
 const vat=mfVatStatus(detail,inv.rows.some(r=>['23','22','8','7','5','4','3'].includes(r.rate)));const vies=viesStatus(detail);
 const bankValue=side==='seller'?(inv.banks.length?`<div class="party-bank-list">${inv.banks.map(b=>`<div class="party-bank-item">${esc(b.nr||'—')}</div>${b.name?`<span class="muted-line">${esc(b.name)}</span>`:''}`).join('')}</div>`:'—'):'—';
 const fields=[fieldHtml('Nazwa',p.name||'—',nameSt),fieldHtml('NIP / identyfikator',partyIdValue(p),idSt),fieldHtml('Status VAT',vat.value,vat),fieldHtml('VIES / VAT UE',vies.value,vies),fieldHtml('Adres',addr||'—',addrSt),fieldHtml('Kontakt',contactHtml(p),{type:(p.emails?.length||p.phones?.length)?'ok':'info',note:(p.emails?.length||p.phones?.length)?`Dane kontaktowe odczytane z ${src}.`:`Brak danych kontaktowych w ${src}.`}),fieldHtml('Rachunek bankowy',bankValue,bankStatus(inv,side),{rawHtml:true})];
 return `<article class="contractor-card ${klass}"><div class="contractor-card-head"><div class="contractor-role">${label}</div><h3 class="contractor-name">${esc(p.name||'Brak nazwy')}</h3><div class="contractor-subline"><span class="contractor-source-pill">${state.inputType==='pdf'?'Dane odczytane z PDF':'Dane z XML FA(3)'}</span>${detail.mf?.found?'<span class="contractor-source-pill">Biała Lista MF</span>':''}${detail.vies?'<span class="contractor-source-pill">VIES</span>':''}</div></div><div class="party-fields">${fields.join('')}</div><div class="contractor-card-foot">Czerwony × oznacza wykrytą niezgodność. Żółte ! oznacza przypadek wymagający sprawdzenia, gdy rejestr nie pozwala jednoznacznie stwierdzić błędu.</div></article>`}
function renderContractors(inv){const box=$('#contractorComparison');if(!box)return;box.innerHTML=renderPartyCard(inv,'seller')+renderPartyCard(inv,'buyer')}

function renderChecks(){
 const isPartyCheck=c=>{const f=c.field||'',t=c.title||'';return f.includes('Podmiot1')||f.includes('Podmiot2')||/Biała Lista MF|VIES \/ VAT UE|Rachunek bankowy|^Nazwa —|^Adres —/.test(t)};
 const documentChecks=state.checks.filter(c=>!isPartyCheck(c));
 const issues=documentChecks.filter(c=>c.type==='error'||c.type==='warn');
 const background=documentChecks.filter(c=>c.type==='ok'||c.type==='info');
 const errors=issues.filter(c=>c.type==='error').length,warns=issues.filter(c=>c.type==='warn').length;
 if(!issues.length){
  $('#primaryCheckResult').innerHTML=`<div class="result-message success"><div class="result-message-icon">✓</div><div><h3>Nie wykryto błędów</h3><p>Automatyczne kontrole zakończyły się bez błędów i ostrzeżeń wymagających uwagi.</p></div></div>`;
 }else{
  const label=[errors?`${errors} ${errors===1?'błąd':'błędy'}`:'',warns?`${warns} ${warns===1?'ostrzeżenie':'ostrzeżenia'}`:''].filter(Boolean).join(' i ');
  $('#primaryCheckResult').innerHTML=`<div class="issues-head"><h3>Wymagają uwagi</h3><p>Wykryto ${label}. Poniżej pokazujemy tylko pozycje problemowe.</p></div><div class="check-list issue-list">${issues.map(checkHtml).join('')}</div>`;
 }
 const detail=$('#fullCheckDetails'),summary=$('#fullCheckSummary');
 summary.textContent=issues.length?`Pokaż pozostałe poprawne kontrole (${background.length})`:`Pokaż pełne sprawdzenie (${documentChecks.length} kontroli dokumentu)`;
 $('#checkList').innerHTML=(issues.length?background:documentChecks).map(checkHtml).join('')||'<div class="muted">Brak dodatkowych kontroli do wyświetlenia.</div>';
 detail.open=false;
}
const OFFICIAL_FA3_XSL_URL='https://crd.gov.pl/wzor/2025/06/25/13775/styl.xsl';
const FA3_XSL_MIRROR_URL='https://raw.githubusercontent.com/asoio/ksef-xslt/refs/heads/main/kseffaktura_fa(3).xsl';
async function loadOfficialFa3Xsl(){
 if(state.officialXsl)return state.officialXsl;
 const sources=[
  {url:OFFICIAL_FA3_XSL_URL,label:'CRWDE • wzór 13775 • styl.xsl'},
  {url:FA3_XSL_MIRROR_URL,label:'Kopia transformacji FA(3) • źródło awaryjne'}
 ];
 let lastErr=null;
 for(const s of sources){
  try{
   const res=await fetch(s.url,{cache:'no-store',mode:'cors'});
   if(!res.ok)throw new Error(`HTTP ${res.status}`);
   const txt=await res.text();
   if(!txt.includes('http://crd.gov.pl/wzor/2025/06/25/13775/')||!txt.includes('<xsl:stylesheet'))throw new Error('Nieprawidłowa transformata FA(3)');
   const xslDoc=new DOMParser().parseFromString(txt,'application/xml');
   if(xslDoc.getElementsByTagName('parsererror').length)throw new Error('Nie udało się sparsować XSL');
   state.officialXsl=xslDoc;state.officialXslSource=s.label;return xslDoc;
  }catch(e){lastErr=e}
 }
 throw lastErr||new Error('Nie można pobrać transformacji FA(3)');
}
function officialPreviewMessage(kind,text){
 const box=$('#officialPreviewNotice');if(!box)return;
 box.className=`official-preview-notice ${kind}`;box.textContent=text;
}
async function renderOfficialInvoicePreview(xml){
 const frame=$('#officialPreviewFrame'),badge=$('#officialPreviewBadge');if(!frame)return;
 window.pdfCanvasPreview?.reset?.();frame.classList.remove('hidden');document.getElementById('pdfZoomControls')?.classList.add('hidden');
 frame.setAttribute('sandbox','allow-same-origin');frame.src='about:blank';frame.srcdoc='';const title=$('#previewTitle'),desc=$('#previewDescription');if(title)title.textContent='Podgląd faktury FA(3)';if(desc)desc.textContent='Widok generowany z transformacji wizualizacyjnej przypisanej do wzoru FA(3) nr 13775 w CRWDE. Checker nie modyfikuje układu dokumentu.';
 const token=xml;state._previewToken=token;
 if(!('XSLTProcessor' in window)){
  if(badge)badge.textContent='Transformacja XSLT niedostępna w tej przeglądarce';
  officialPreviewMessage('error','Ta wersja przeglądarki nie obsługuje już XSLT. W wersji produkcyjnej podgląd powinien być generowany po stronie serwera z tej samej transformacji FA(3), bez używania własnego renderera.');
  return;
 }
 if(badge)badge.textContent='Pobieranie oficjalnej transformacji FA(3)…';
 officialPreviewMessage('loading','Generuję podgląd na podstawie transformacji FA(3).');
 try{
  const xsl=await loadOfficialFa3Xsl(); if(state._previewToken!==token)return;
  const xmlDoc=new DOMParser().parseFromString(xml,'application/xml');
  if(xmlDoc.getElementsByTagName('parsererror').length)throw new Error('Niepoprawny XML');
  const proc=new XSLTProcessor();proc.importStylesheet(xsl);
  const out=proc.transformToDocument(xmlDoc);
  let html='';
  if(out&&out.documentElement){
   html='<!DOCTYPE html>\n'+new XMLSerializer().serializeToString(out.documentElement);
  }
  if(!html||html.length<200)throw new Error('Transformacja nie zwróciła poprawnego dokumentu HTML');
  frame.srcdoc=html;
  if(badge)badge.textContent=state.officialXslSource;
  const notice=$('#officialPreviewNotice');if(notice)notice.classList.add('hidden');
 }catch(e){
  if(badge)badge.textContent='Nie udało się wygenerować podglądu urzędowego';
  officialPreviewMessage('error',`Nie pokazuję zastępczej, własnej wizualizacji, ponieważ mogłaby różnić się od transformacji FA(3). Szczegóły: ${e?.message||e}`);
 }
}

function mergeIssue(map,key,type,msg){
 if(!key)return; const severity=type==='error'?2:type==='warn'?1:0;
 if(!map[key]||severity>map[key].severity) map[key]={type,severity,messages:[msg]};
 else if(map[key].messages.indexOf(msg)===-1) map[key].messages.push(msg);
}
function buildHighlights(checks,inv){
 const map={};
 checks.filter(c=>c.type==='error'||c.type==='warn').forEach(c=>{
  const f=c.field||''; const t=c.title||'';
  if(f.includes('Podmiot1')) mergeIssue(map,'seller',c.type,t);
  if(f.includes('Podmiot2')) mergeIssue(map,'buyer',c.type,t);
  if(f.includes('Fa/P_2')) mergeIssue(map,'invoiceNumber',c.type,t);
  if(f.includes('Fa/P_1')) mergeIssue(map,'issueDate',c.type,t);
  if(f.includes('Fa/KodWaluty')) mergeIssue(map,'currency',c.type,t);
  if(f.includes('Fa/FaWiersz')) mergeIssue(map,'positionsSection',c.type,t);
  if(f.includes('Fa/P_15')) mergeIssue(map,'total',c.type,t);
  if(f.includes('P_13_')||f.includes('P_14_')) mergeIssue(map,'taxSummary',c.type,t);
  if(f.includes('P_18')||f.includes('P_19')||f.includes('PMarzy')||f.includes('P_16')||f.includes('P_17')||f.includes('P_23')||f.includes('P_22')) mergeIssue(map,'annotations',c.type,t);
  if(f.includes('DaneFaKorygowanej')||f.includes('PrzyczynaKorekty')||f.includes('TypKorekty')) mergeIssue(map,'correction',c.type,t);
  if(f.includes('Platnosc')||f.includes('RachunekBankowy')) mergeIssue(map,'payment',c.type,t);
  const rowMatch=t.match(/^Pozycja\s+([^:]+):/);
  if(rowMatch){ mergeIssue(map,'positionsSection',c.type,t); mergeIssue(map,`row-${rowMatch[1]}`,c.type,t); }
  const rateMatch=t.match(/^Podsumowanie stawki\s+(.+)$/);
  if(rateMatch){ const rateKey='tax-rate-'+rateMatch[1].replace(/[^a-zA-Z0-9]+/g,'-'); mergeIssue(map,'taxSummary',c.type,t); mergeIssue(map,rateKey,c.type,t); }
  if(/WDT — podsumowanie|Eksport — podsumowanie/.test(t)) mergeIssue(map,'taxSummary',c.type,t);
 });
 return map;
}
function issueInfo(issues,key){return issues&&issues[key]?issues[key]:null}
function issueCls(issues,key){const it=issueInfo(issues,key);return it?` issue-highlight issue-${it.type}`:''}
function issueTitleAttr(issues,key){const it=issueInfo(issues,key);return it?` title="${esc(it.messages.join(' • '))}"`:''}
function issueNote(issues,key){const it=issueInfo(issues,key);return it?`<div class="ksef-inline-issue ${it.type}" title="${esc(it.messages.join(' • '))}">⚠ ${esc(it.messages[0])}</div>`:''}

function annotationLabels(inv){const a=[];if(inv.p18==='1')a.push('odwrotne obciążenie');if(inv.p18a==='1')a.push('mechanizm podzielonej płatności');if(inv.p17==='1')a.push('samofakturowanie');if(inv.p16==='1')a.push('metoda kasowa');if(inv.p19==='1')a.push('zwolnienie z VAT');if(inv.pmargin==='1')a.push('VAT marża');return a}
function idText(p){if(p.nip)return `NIP: ${p.nip}`;if(p.kodUE&&p.vatUE)return `VAT UE: ${p.kodUE}${p.vatUE}`;if(p.countryId&&p.nrId)return `${p.countryId}: ${p.nrId}`;if(p.brakId==='1')return 'Brak identyfikatora podatkowego';return '—'}
function fmtKsef(v,min=2,max=2){
 const n=num(v);return new Intl.NumberFormat('pl-PL',{minimumFractionDigits:min,maximumFractionDigits:max}).format(n)
}
function fmtKsefFlex(v){if(v===''||v==null)return '';return new Intl.NumberFormat('pl-PL',{minimumFractionDigits:0,maximumFractionDigits:8}).format(num(v))}
function countryName(code){if(!code)return '';try{return new Intl.DisplayNames(['pl'],{type:'region'}).of(code)||code}catch{return code}}
function invoiceTypeLabel(inv){
 const map={VAT:'Faktura podstawowa',ZAL:'Faktura zaliczkowa',ROZ:'Faktura rozliczeniowa',UPR:'Faktura uproszczona',KOR_ZAL:'Faktura korygująca zaliczkową',KOR_ROZ:'Faktura korygująca rozliczeniową'};
 if(inv.type==='KOR')return el(inv.fa,'OkresFaKorygowanej')?'Faktura korygująca zbiorcza (rabat)':'Faktura korygująca';
 return map[inv.type]||inv.type||'Faktura'
}
function correctionTypeLabel(v){return ({'1':'Korekta skutkująca w dacie ujęcia faktury pierwotnej','2':'Korekta skutkująca w dacie wystawienia faktury korygującej','3':'Korekta skutkująca w dacie innej, w tym różne daty'})[v]||v}
function rateLabel(v){
 const m={'0 KR':'0% - krajowe','0 WDT':'0% - WDT','0 EX':'0% - eksport','np I':'np na podstawie art. 28b ustawy','np II':'np na podstawie art. 100 ust. 1 pkt 4 ustawy','oo':'odwrotne obciążenie','zw':'zwolnione'};
 if(m[v])return m[v]; if(/^[-+]?\d+(?:[.,]\d+)?$/.test(v||''))return `${String(v).replace('.',',')}%`;return v||'—'
}
function paymentFormLabel(v){return ({'1':'Gotówka','2':'Karta','3':'Bon','4':'Czek','5':'Kredyt','6':'Przelew','7':'Płatność mobilna'})[v]||v||'—'}
function ksefLine(name,value,key='',issues=null){if(value===''||value==null)return '';return `<div class="ksef-data-row${key?issueCls(issues,key):''}"${key?issueTitleAttr(issues,key):''}><span class="ksef-data-name">${esc(name)}:</span> <span class="ksef-data-value">${esc(value)}</span>${key?issueNote(issues,key):''}</div>`}
function partyKsef(p){
 const id=p.nip?`NIP: ${p.nip}`:(p.kodUE&&p.vatUE?`VAT UE: ${p.kodUE}${p.vatUE}`:(p.countryId&&p.nrId?`${p.countryId}: ${p.nrId}`:(p.brakId==='1'?'Brak identyfikatora podatkowego':'')));
 return `${id?`<div class="ksef-party-id">${esc(id)}</div>`:''}${ksefLine('Nazwa',p.name||'—')}<div class="ksef-address-title">Adres</div>${p.a1?`<div class="ksef-address">${esc(p.a1)}</div>`:''}${p.a2?`<div class="ksef-address">${esc(p.a2)}</div>`:''}${p.country?`<div class="ksef-address">${esc(countryName(p.country))}</div>`:''}`
}
function ksefColumn(label,key,align='left',render=null){return{label,key,align,render}}
function visiblePositionColumns(inv){
 const rs=inv.rows, any=k=>rs.some(r=>String(r[k]??'').trim()!=='');
 const cols=[ksefColumn('Lp.','no','center',(r,i)=>r.no||i+1),ksefColumn('Nazwa towaru lub usługi','name')];
 if(any('priceNet'))cols.push(ksefColumn('Cena jedn. netto','priceNet','right',r=>fmtKsef(r.priceNet)));
 if(any('priceGross'))cols.push(ksefColumn('Cena jedn. brutto','priceGross','right',r=>fmtKsef(r.priceGross)));
 if(any('qty'))cols.push(ksefColumn('Ilość','qty','right',r=>fmtKsefFlex(r.qty)));
 if(any('unit'))cols.push(ksefColumn('Miara','unit'));
 if(any('discount'))cols.push(ksefColumn('Rabat','discount','right',r=>fmtKsef(r.discount)));
 if(any('rate'))cols.push(ksefColumn('Stawka podatku','rate','center',r=>rateLabel(r.rate)));
 if(any('rateOSS'))cols.push(ksefColumn('Stawka podatku OSS','rateOSS','center',r=>rateLabel(r.rateOSS)));
 if(any('annex15'))cols.push(ksefColumn('Znacznik dla towaru lub usługi z zał. nr 15 do ustawy','annex15','center',r=>r.annex15==='1'?'1':'2'));
 if(any('net'))cols.push(ksefColumn('Wartość sprzedaży netto','net','right',r=>fmtKsef(r.net)));
 if(any('gross'))cols.push(ksefColumn('Wartość sprzedaży brutto','gross','right',r=>fmtKsef(r.gross)));
 if(any('vat'))cols.push(ksefColumn('Wartość sprzedaży VAT','vat','right',r=>fmtKsef(r.vat)));
 if(any('kurs'))cols.push(ksefColumn('Kurs waluty','kurs','right',r=>fmtKsefFlex(r.kurs)));
 if(any('before'))cols.push(ksefColumn('Stan przed','before','center',r=>r.before));
 return cols
}
function renderPositionExtras(inv){
 const keys=[['GTIN','gtin'],['PKWiU','pkwiu'],['CN','cn'],['PKOB','pkob'],['GTU','gtu'],['Oznaczenia dotyczące procedur','procedure'],['Data dostawy / wykonania','deliveryDate'],['Indeks','index']];
 const active=keys.filter(([,k])=>inv.rows.some(r=>String(r[k]||'').trim())); if(!active.length)return '';
 return `<div class="ksef-subtable-title">Dodatkowe dane pozycji</div><table class="ksef-table ksef-table-extra"><thead><tr><th>Lp.</th>${active.map(([n])=>`<th>${esc(n)}</th>`).join('')}</tr></thead><tbody>${inv.rows.map((r,i)=>`<tr><td class="center">${esc(r.no||i+1)}</td>${active.map(([,k])=>`<td>${esc(r[k]||'')}</td>`).join('')}</tr>`).join('')}</tbody></table>`
}
function renderCorrection(inv,issues={}){
 if(!/^KOR/.test(inv.type))return '';
 const meta=[];
 if(inv.correctedNumber)meta.push(ksefLine('Poprawny numer faktury korygowanej',inv.correctedNumber));
 if(inv.reason)meta.push(ksefLine('Przyczyna korekty dla faktur korygujących',inv.reason));
 if(inv.correctionType)meta.push(ksefLine('Typ skutku korekty',correctionTypeLabel(inv.correctionType)));
 if(inv.p15zk)meta.push(ksefLine('Kwota zapłaty przed korektą',`${fmtKsef(inv.p15zk)} ${inv.currency}`));
 if(inv.kursWalutyZK)meta.push(ksefLine('Kurs waluty przed korektą',fmtKsefFlex(inv.kursWalutyZK)));
 const refs=inv.correctionRefs.map((r,i)=>`<div class="ksef-ref-block">${inv.correctionRefs.length>1?`<div class="ksef-ref-no">Faktura ${i+1}</div>`:''}${ksefLine('Data wystawienia faktury, której dotyczy faktura korygująca',r.date)}${ksefLine('Numer faktury korygowanej',r.number)}${r.ksef?ksefLine('Numer KSeF faktury korygowanej',r.ksef):''}${r.noKsef==='1'?ksefLine('Faktura korygowana nie posiada numeru KSeF','Tak'):''}</div>`).join('');
 if(!meta.length&&!refs)return '';
 return `<div class="ksef-rule"></div><section class="ksef-section ksef-clear${issueCls(issues,'correction')}"${issueTitleAttr(issues,'correction')}><h3>Dane faktury korygowanej</h3>${issueNote(issues,'correction')}${meta.join('')}${refs}</section>`
}
function renderTaxSummary(inv,issues={}){
 const map=[
  ['P_13_1','P_14_1','23% lub 22%'],['P_13_2','P_14_2','8% lub 7%'],['P_13_3','P_14_3','5%'],
  ['P_13_4','P_14_4','4% lub 3%'],['P_13_5','P_14_5','0%'],['P_13_6_1','P_14_6_1','0% — krajowe'],
  ['P_13_6_2','','0% — WDT'],['P_13_6_3','','0% — eksport'],['P_13_7','','zw'],
  ['P_13_8','','oo'],['P_13_9','','np II'],['P_13_10','','np I']
 ];
 const rows=map.map(([n,v,r])=>({net:dval(inv.fa,n),vat:v?dval(inv.fa,v):'',rate:r})).filter(x=>x.net||x.vat); if(!rows.length)return '';
 return `<div class="ksef-rule"></div><section class="ksef-section${issueCls(issues,'taxSummary')}"${issueTitleAttr(issues,'taxSummary')}><h3>Podsumowanie stawek podatku</h3>${issueNote(issues,'taxSummary')}<table class="ksef-table ksef-tax-table"><thead><tr><th class="center ksef-lp-col">Lp.</th><th>Stawka podatku</th><th class="right">Kwota netto</th><th class="right">Kwota podatku</th><th class="right">Kwota brutto</th></tr></thead><tbody>${rows.map((x,i)=>{const gross=num(x.net)+num(x.vat); const key='tax-rate-'+String(x.rate).replace(/[^a-zA-Z0-9]+/g,'-'); return `<tr class="${issueCls(issues,key).trim()}"${issueTitleAttr(issues,key)}><td class="center">${i+1}</td><td>${esc(x.rate)}</td><td class="right">${fmtKsef(x.net)}</td><td class="right">${x.vat?fmtKsef(x.vat):'—'}</td><td class="right">${fmtKsef(gross)}</td></tr>`}).join('')}</tbody></table></section>`
}
function renderAnnotations(inv,issues={}){
 const a=[];
 if(inv.p16==='1')a.push('Metoda kasowa');
 if(inv.p17==='1')a.push('Samofakturowanie');
 if(inv.p18==='1')a.push('Odwrotne obciążenie');
 if(inv.p18a==='1')a.push('Mechanizm podzielonej płatności');
 if(inv.p19==='1')a.push(`Zwolnienie z VAT${inv.p19a?`: ${inv.p19a}`:inv.p19b?`: ${inv.p19b}`:inv.p19c?`: ${inv.p19c}`:''}`);
 if(inv.pmargin==='1')a.push('Procedura marży');
 if(!a.length)return '';
 return `<div class="ksef-rule"></div><section class="ksef-section${issueCls(issues,'annotations')}"${issueTitleAttr(issues,'annotations')}><h3>Adnotacje</h3>${issueNote(issues,'annotations')}${a.map(x=>`<div class="ksef-data-value ksef-annotation-line">${esc(x)}</div>`).join('')}</section>`
}
function renderPayment(inv,issues={}){
 if(!inv.paymentDate&&!inv.paymentForm&&!inv.paymentDescription&&!inv.paid&&!inv.paidDate&&!inv.partialPaid&&!inv.banks.length)return '';
 const paymentStatus=inv.paid==='1'?'zapłacono':inv.partialPaid==='1'?'zapłata częściowa':'brak zapłaty';
 const method=inv.paymentForm?paymentFormLabel(inv.paymentForm):(inv.paymentOther==='1'?(inv.paymentDescription||'inna'):'');
 const due=inv.paymentDate?`<table class="ksef-mini-table"><thead><tr><th>Termin płatności</th></tr></thead><tbody><tr><td>${esc(inv.paymentDate)}</td></tr></tbody></table>`:'';
 const banks=inv.banks.length?`<div class="ksef-rule"></div><section class="ksef-section"><h3>Numer rachunku bankowego</h3><table class="ksef-table ksef-bank-table"><tbody>${inv.banks.map(b=>`<tr><td>${esc(b.nr||'—')}</td>${b.swift?`<td>${esc(b.swift)}</td>`:''}${b.name?`<td>${esc(b.name)}</td>`:''}${b.desc?`<td>${esc(b.desc)}</td>`:''}</tr>`).join('')}</tbody></table></section>`:'';
 return `<div class="ksef-rule"></div><section class="ksef-section${issueCls(issues,'payment')}"${issueTitleAttr(issues,'payment')}><h3>Płatność</h3>${issueNote(issues,'payment')}<div class="ksef-payment-grid"><div>${ksefLine('Informacja o płatności',paymentStatus)}${inv.paidDate?ksefLine('Data zapłaty',inv.paidDate):''}${method?ksefLine('Forma płatności',method):''}${inv.paymentDescription&&inv.paymentOther!=='1'?ksefLine('Opis płatności',inv.paymentDescription):''}</div><div>${due}</div></div></section>${banks}`
}
function renderInvoice(inv,issues={}){
 const cols=visiblePositionColumns(inv);
 const priceMode=inv.rows.some(r=>r.priceNet)?'netto':inv.rows.some(r=>r.priceGross)?'brutto':'';
 const totalLabel=/^(ROZ|KOR_ROZ)$/.test(inv.type)?'Kwota pozostała do zapłaty':'Kwota należności ogółem';
 $('#invoiceCanvas').innerHTML=`
 <div class="ksef-main-header ksef-clear"><div class="ksef-brandline">Krajowy System <span>e</span>-Faktur</div><div class="ksef-header-info"><div class="ksef-header-label">Numer faktury</div><div class="ksef-header-number${issueCls(issues,'invoiceNumber')}"${issueTitleAttr(issues,'invoiceNumber')}>${esc(inv.number||'—')}</div>${issueNote(issues,'invoiceNumber')}<div class="ksef-header-type">${esc(invoiceTypeLabel(inv))}</div></div></div>
 ${renderCorrection(inv,issues)}
 <div class="ksef-rule"></div>
 <section class="ksef-section ksef-two-cols ksef-parties"><div class="ksef-pane${issueCls(issues,'seller')}"${issueTitleAttr(issues,'seller')}><h3>Sprzedawca</h3>${issueNote(issues,'seller')}${partyKsef(inv.seller)}</div><div class="ksef-pane${issueCls(issues,'buyer')}"${issueTitleAttr(issues,'buyer')}><h3>Nabywca</h3>${issueNote(issues,'buyer')}${partyKsef(inv.buyer)}</div></section>
 <div class="ksef-rule"></div>
 <section class="ksef-section"><h3>Szczegóły</h3><div class="ksef-two-cols"><div>${ksefLine('Data wystawienia, z zastrzeżeniem art. 106na ust. 1 ustawy',inv.date||'—','issueDate',issues)}${inv.place?ksefLine('Miejsce wystawienia',inv.place):''}${ksefLine('Kod waluty',inv.currency||'—','currency',issues)}</div><div>${inv.saleDate?ksefLine('Data dokonania lub zakończenia dostawy towarów lub wykonania usługi',inv.saleDate):''}${ksefLine('Numer faktury',inv.number||'—','invoiceNumber',issues)}</div></div></section>
 <div class="ksef-rule"></div>
 <section class="ksef-section ksef-positions${issueCls(issues,'positionsSection')}"${issueTitleAttr(issues,'positionsSection')}><h3>Pozycje</h3>${issueNote(issues,'positionsSection')}${priceMode?`<div class="ksef-position-intro">Faktura wystawiona w cenach ${priceMode} w walucie ${esc(inv.currency||'PLN')}</div>`:''}<div class="ksef-table-scroll"><table class="ksef-table"><thead><tr>${cols.map(c=>`<th class="${c.align==='right'?'right':c.align==='center'?'center':''}">${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${inv.rows.map((r,i)=>{const rowKey='row-'+String(r.no||i+1);return `<tr class="${issueCls(issues,rowKey).trim()}"${issueTitleAttr(issues,rowKey)}>${cols.map(c=>`<td class="${c.align==='right'?'right':c.align==='center'?'center':''}">${esc(c.render?c.render(r,i):(r[c.key]||''))}</td>`).join('')}</tr>`}).join('')}</tbody></table></div>${renderPositionExtras(inv)}<div class="ksef-total${issueCls(issues,'total')}"${issueTitleAttr(issues,'total')}><span>${esc(totalLabel)}:</span> <strong>${fmtKsef(inv.total||0)} ${esc(inv.currency||'PLN')}</strong>${issueNote(issues,'total')}</div></section>
 ${renderTaxSummary(inv,issues)}${renderAnnotations(inv,issues)}${renderPayment(inv,issues)}
 `
}
function renderFields(inv){const f=[['Rodzaj faktury','Fa/RodzajFaktury',inv.type],['Numer','Fa/P_2',inv.number],['Data','Fa/P_1',inv.date],['Waluta','Fa/KodWaluty',inv.currency],['Razem','Fa/P_15',inv.total],['Reverse charge','Fa/Adnotacje/P_18',inv.p18],['MPP','Fa/Adnotacje/P_18A',inv.p18a],['Metoda kasowa','Fa/Adnotacje/P_16',inv.p16],['Samofakturowanie','Fa/Adnotacje/P_17',inv.p17],['Przyczyna korekty','Fa/PrzyczynaKorekty',inv.reason],['Typ korekty','Fa/TypKorekty',inv.correctionType],['Sprzedawca','Podmiot1/DaneIdentyfikacyjne',`${inv.seller.name||''} ${idText(inv.seller)}`],['Nabywca','Podmiot2/DaneIdentyfikacyjne',`${inv.buyer.name||''} ${idText(inv.buyer)}`]];$('#fieldRows').innerHTML=f.map(x=>`<tr><td><b>${esc(x[0])}</b></td><td>${esc(x[1])}</td><td>${esc(x[2]||'—')}</td></tr>`).join('')}
function prettyXml(xml){const x=xml.replace(/(>)(<)(\/*)/g,'$1\n$2$3');let pad=0,out=[];x.split('\n').forEach(l=>{if(/^<\//.test(l.trim()))pad=Math.max(0,pad-1);out.push('  '.repeat(pad)+l.trim());if(/^<[^!?/][^>]*>$/.test(l.trim())&&!/<\/[^>]+>$/.test(l.trim())&&!/\/>$/.test(l.trim()))pad++});return out.join('\n')}
function showView(name){
 $$('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.view===name));
 $$('.view').forEach(x=>x.classList.remove('visible'));
 $('#'+name+'View')?.classList.add('visible');
 if(name==='testLibrary')ensureTestLibrary();
 if(name==='taxNews')ensureTaxNews(false);
 if(name==='history')renderHistory();
 if(name==='dashboard')window.officeHub?.renderDashboard?.();
 if(name==='clients')window.officeHub?.renderClient?.();
 if(name==='legal')window.officeHub?.renderLegal?.();
}
function libraryKindClass(e){return e.kind==='reference'?'reference':e.group==='Testy negatywne'?'negative':''}
function libraryKindLabel(e){return e.kind==='reference'?'REFERENCJA':e.group==='Testy negatywne'?'TEST NEGATYWNY':'XML'}
async function ensureTestLibrary(){
 if(state.libraryManifest){renderTestLibrary();return state.libraryManifest;}
 const grid=$('#testLibraryGrid');if(grid)grid.innerHTML='<div class="library-empty">Wczytuję lokalną bibliotekę testową…</div>';
 try{
  const res=await fetch('test-library/manifest.json',{cache:'no-store'});if(!res.ok)throw new Error(`HTTP ${res.status}`);
  state.libraryManifest=await res.json();
  const count=$('#libraryXmlCount');if(count)count.textContent=state.libraryManifest.xmlCount||0;
  const select=$('#libraryGroupFilter');
  if(select){const groups=[...new Set((state.libraryManifest.entries||[]).map(x=>x.group))];select.innerHTML='<option value="">Wszystkie grupy</option>'+groups.map(g=>`<option value="${esc(g)}">${esc(g)}</option>`).join('');}
  renderTestLibrary();return state.libraryManifest;
 }catch(e){if(grid)grid.innerHTML=`<div class="library-empty"><b>Nie udało się wczytać biblioteki.</b><br>${esc(e?.message||e)}<br><small>Uruchom projekt przez START_CHECKER.bat, a nie przez bezpośrednie otwarcie index.html.</small></div>`;}
}
function renderTestLibrary(){
 const m=state.libraryManifest,grid=$('#testLibraryGrid');if(!m||!grid)return;
 const q=clean($('#librarySearch')?.value).toLowerCase(),group=$('#libraryGroupFilter')?.value||'';
 const filtered=(m.entries||[]).filter(e=>{
  if(group&&e.group!==group)return false;
  if(!q)return true;
  return [e.title,e.description,e.file,e.group,...(e.tags||[])].join(' ').toLowerCase().includes(q);
 });
 if(!filtered.length){grid.innerHTML='<div class="library-empty">Brak faktur pasujących do filtra.</div>';return;}
 const order=['Wbudowane 1.3','Scenariusze projektu','Testy negatywne','Realne referencje'];
 const groups=[...new Set(filtered.map(x=>x.group))].sort((a,b)=>order.indexOf(a)-order.indexOf(b));
 grid.innerHTML=groups.map(g=>{
  const xs=filtered.filter(x=>x.group===g);
  return `<section class="library-group"><div class="library-group-head"><h2>${esc(g)}</h2><span>${xs.length} ${xs.length===1?'pozycja':'pozycji'}</span></div><div class="library-card-grid">${xs.map(e=>`<article class="test-card"><div class="test-card-top"><span class="test-kind ${libraryKindClass(e)}">${libraryKindLabel(e)}</span><span class="test-expected">${esc(e.expected||'')}</span></div><h3>${esc(e.title)}</h3><p>${esc(e.description||'')}</p><div class="test-tags">${(e.tags||[]).map(t=>`<span class="test-tag">${esc(t)}</span>`).join('')}</div><div class="test-file" title="${esc(e.file)}">${esc(e.file)}</div><button class="btn ${e.kind==='xml'?'primary':'ghost'} test-open" data-library-id="${esc(e.id)}">${e.kind==='xml'?'Otwórz i sprawdź':'Pokaż lokalne dane'}</button></article>`).join('')}</div></section>`;
 }).join('');
 $$('[data-library-id]').forEach(b=>b.addEventListener('click',()=>openLibraryEntry(b.dataset.libraryId)));
}
async function openLibraryEntry(id){
 const e=state.libraryManifest?.entries?.find(x=>x.id===id);if(!e)return;
 try{
  const res=await fetch(e.file,{cache:'no-store'});if(!res.ok)throw new Error(`HTTP ${res.status}`);const txt=await res.text();
  if(e.kind==='xml'){
   parseXml(txt,e.file.split('/').pop(),e);showView('workspace');window.scrollTo({top:0,behavior:'smooth'});
  }else{
   $('#referenceDialogTitle').textContent=e.title;$('#referenceDialogText').textContent=txt;
   const d=$('#referenceDialog');if(d?.showModal)d.showModal();else alert(txt);
  }
 }catch(err){alert(`Nie udało się otworzyć lokalnego pliku testowego: ${err?.message||err}`)}
}

// v1.6 — Gazeta księgowego
function newsDateValue(s){const d=new Date(String(s||''));return Number.isNaN(d.getTime())?0:d.getTime()}
function newsDateLabel(s){if(!s)return '—';const d=new Date(`${String(s).slice(0,10)}T12:00:00`);if(Number.isNaN(d.getTime()))return esc(s);return new Intl.DateTimeFormat('pl-PL',{day:'2-digit',month:'2-digit',year:'numeric'}).format(d)}
function daysFromToday(s){const t=new Date();t.setHours(0,0,0,0);const d=new Date(`${String(s||'').slice(0,10)}T00:00:00`);return Number.isNaN(d.getTime())?999:Math.floor((t-d)/86400000)}
function newsAgeLabel(s){const n=daysFromToday(s);if(n===0)return 'Dzisiaj';if(n===1)return 'Wczoraj';if(n>1&&n<7)return `${n} dni temu`;return newsDateLabel(s)}
function newsSourceClass(a){return a.official?'official':''}

function newsTopicTile(a){
 const topic=String(a?.topic||'Podatki i prawo');
 if(a?.sourceId==='zus'||topic==='ZUS')return{key:'zus',label:'ZUS'};
 if(topic==='VAT / KSeF')return{key:'vat',label:'VAT / KSeF'};
 if(topic==='PIT / CIT')return{key:'pit',label:'PIT / CIT'};
 if(topic==='Rachunkowość')return{key:'accounting',label:'RACHUNKOWOŚĆ'};
 if(topic==='Kadry i płace')return{key:'payroll',label:'KADRY I PŁACE'};
 if(topic==='Pozostałe podatki')return{key:'other-tax',label:'INNE PODATKI'};
 return{key:'law',label:'PODATKI / PRAWO'};
}
function setNewsLoading(loading){state.newsLoading=loading;const b=$('#newsRefreshBtn');if(b){b.disabled=loading;b.textContent=loading?'Odświeżam…':'Odśwież wiadomości'}}
async function ensureTaxNews(force=false){
 if(state.newsLoading)return;
 if(state.news&&!force){renderTaxNews();return state.news}
 setNewsLoading(true);const list=$('#taxNewsList');if(list)list.innerHTML='<div class="news-loading"><b>Pobieram najnowsze informacje…</b><span>Sprawdzam Prawo.pl, Ministerstwo Finansów, podatki.gov.pl, ZUS, INFOR, Poradnik Przedsiębiorcy, GOFIN i PIT.pl.</span></div>';
 try{
  const res=await fetch(`/api/news${force?'?refresh=1':''}`,{cache:'no-store'});const data=await res.json();if(!res.ok)throw new Error(data?.error||`HTTP ${res.status}`);state.news=data;populateNewsFilters();renderTaxNews();return data;
 }catch(e){if(list)list.innerHTML=`<div class="news-error"><b>Nie udało się pobrać przeglądu.</b><span>${esc(e?.message||e)}</span><small>Sprawdź połączenie z internetem i uruchom aplikację przez START_CHECKER.bat.</small></div>`}
 finally{setNewsLoading(false)}
}
function populateNewsFilters(){const a=state.news?.articles||[];const topics=[...new Set(a.map(x=>x.topic).filter(Boolean))].sort();const sources=[...new Set(a.map(x=>x.source).filter(Boolean))].sort();const t=$('#newsTopicFilter'),s=$('#newsSourceFilter');if(t){const cur=t.value;t.innerHTML='<option value="">Wszystkie tematy</option>'+topics.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');if(topics.includes(cur))t.value=cur}if(s){const cur=s.value;s.innerHTML='<option value="">Wszystkie źródła</option>'+sources.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');if(sources.includes(cur))s.value=cur}}
function renderNewsStatuses(){const box=$('#newsSourcesStatus');if(!box)return;const rows=state.news?.sources||[];box.innerHTML=rows.map(x=>`<div class="news-source-status ${x.ok?'ok':'warn'}"><span>${x.ok?'✓':'!'}</span><b>${esc(x.name)}</b><small>${x.ok?`${x.count||0} materiałów`:`${esc(x.error||'źródło chwilowo niedostępne')}`}</small></div>`).join('')||'<span class="muted">Brak danych o źródłach.</span>'}
function renderTaxNews(){
 const data=state.news,list=$('#taxNewsList');if(!data||!list)return;
 const q=clean($('#newsSearch')?.value).toLowerCase(),topic=$('#newsTopicFilter')?.value||'',source=$('#newsSourceFilter')?.value||'',age=$('#newsAgeFilter')?.value||'',officialOnly=!!$('#newsOfficialOnly')?.checked,seen=seenNewsSet();
 let a=[...(data.articles||[])].sort((x,y)=>newsDateValue(y.date)-newsDateValue(x.date));
 a=a.filter(x=>(!topic||x.topic===topic)&&(!source||x.source===source)&&(!officialOnly||x.official)&&(!age||daysFromToday(x.date)<=Number(age))&&(!q||[x.title,x.summary,x.source,x.topic].join(' ').toLowerCase().includes(q)));
 const all=data.articles||[],today=all.filter(x=>daysFromToday(x.date)===0).length,week=all.filter(x=>daysFromToday(x.date)>=0&&daysFromToday(x.date)<=6).length;
 $('#newsTodayCount').textContent=today;$('#newsWeekCount').textContent=week;$('#newsTotalCount').textContent=all.length;
 const ft=$('#newsFreshnessTitle'),fx=$('#newsFreshnessText');if(ft)ft.textContent=data.fallback?'Pakiet startowy + dostępne źródła':'Przegląd zaktualizowany';if(fx){const dt=data.updatedAt?new Date(data.updatedAt):null;const stamp=dt&&!Number.isNaN(dt.getTime())?new Intl.DateTimeFormat('pl-PL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(dt):'—';fx.textContent=`Ostatnia aktualizacja: ${stamp}. ${data.freshSources||0}/${(data.sources||[]).length||0} źródeł odpowiedziało podczas ostatniego pobrania.`}
 renderNewsChanged();
 if(!a.length){list.innerHTML='<div class="news-empty">Brak artykułów pasujących do wybranych filtrów.</div>';renderNewsStatuses();return}
 list.innerHTML=a.map(x=>{const tile=newsTopicTile(x),change=newsChangeStatus(x),isRead=!!x.url&&seen.has(x.url),isNew=!!x.url&&!isRead,readKey=encodeURIComponent(x.url||'');return `<article class="tax-news-row ${isNew?'is-new':'is-read'}"><div class="news-date"><b>${esc(newsAgeLabel(x.date))}</b><span>${esc(newsDateLabel(x.date))}</span>${isNew?'<span class="news-new-dot">NOWE</span>':'<span class="news-read-dot">PRZECZYTANE</span>'}</div><div class="news-story"><div class="news-topic-tile topic-${esc(tile.key)}"><span>${esc(tile.label)}</span></div><div class="news-story-main"><div class="news-badges"><span class="news-change-status change-${esc(change.key)}" title="Automatyczna klasyfikacja na podstawie tytułu i opisu materiału">${esc(change.label)}</span>${x.planned?'<span class="news-planned">PLANOWANE ZMIANY</span>':''}${x.official?'<span class="news-official">ŹRÓDŁO URZĘDOWE</span>':''}</div><a class="news-title" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.title)}</a><p>${esc(x.summary||'Otwórz materiał źródłowy, aby przeczytać szczegóły.')}</p></div></div><div class="news-source ${newsSourceClass(x)}"><b>${esc(x.source)}</b><a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">Czytaj artykuł →</a><button type="button" class="news-read-toggle ${isRead?'active':''}" data-news-url="${readKey}" aria-pressed="${isRead?'true':'false'}">${isRead?'✓ Przeczytane':'✓ Oznacz jako przeczytane'}</button></div></article>`}).join('');renderNewsStatuses();
}

// --- Historia kontroli i raport ---
const HISTORY_KEY='ksef-checker-pro-history-v2';
const NEWS_SEEN_KEY='ksef-checker-news-seen-v2';
function localGet(key,fallback){try{const v=localStorage.getItem(key);return v?JSON.parse(v):fallback}catch{return fallback}}
function localSet(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}}
function controlStatusFromCounts(errors,warns){return errors?'error':warns?'warn':'ok'}
function saveControlHistory(){
 if(!state.doc)return;const inv=invoice(state.doc),errors=state.checks.filter(x=>x.type==='error').length,warns=state.checks.filter(x=>x.type==='warn').length;
 const entry={id:`${Date.now()}-${Math.random().toString(16).slice(2,8)}`,at:new Date().toISOString(),fileName:state.fileName,sourceType:state.inputType||'xml',invoiceNumber:inv.number||'',invoiceDate:inv.date||'',seller:inv.seller?.name||'',sellerNip:inv.seller?.nip||'',buyer:inv.buyer?.name||'',buyerNip:inv.buyer?.nip||'',currency:inv.currency||'',total:inv.total||'',errors,warns,checks:state.checks.length,status:controlStatusFromCounts(errors,warns),xsd:state.xsdValidation?.available?(state.xsdValidation.ok?'ok':'error'):'unavailable',profiles:profiles(inv),test:!!state.currentLibraryEntry,issues:state.checks.filter(x=>x.type==='error'||x.type==='warn').slice(0,20).map(x=>({type:x.type,title:x.title,desc:x.desc,field:x.field||''}))};
 let items=localGet(HISTORY_KEY,[]);const prev=items[0];if(prev&&prev.fileName===entry.fileName&&prev.invoiceNumber===entry.invoiceNumber&&Date.now()-Date.parse(prev.at)<120000)items.shift();items.unshift(entry);items=items.slice(0,100);localSet(HISTORY_KEY,items);if($('#historyView')?.classList.contains('visible'))renderHistory();
}
function renderHistory(){
 const box=$('#historyList');if(!box)return;let items=localGet(HISTORY_KEY,[]);const q=clean($('#historySearch')?.value).toLowerCase(),f=$('#historyStatusFilter')?.value||'';items=items.filter(x=>(!f||x.status===f)&&(!q||[x.invoiceNumber,x.fileName,x.seller,x.sellerNip,x.buyer,x.buyerNip].join(' ').toLowerCase().includes(q)));
 if(!items.length){box.innerHTML='<div class="history-empty">Brak zapisanych kontroli pasujących do filtrów.</div>';return}
 box.innerHTML=items.map(x=>`<article class="history-card ${x.status}"><div class="history-status">${x.status==='ok'?'✓':x.status==='error'?'×':'!'}</div><div class="history-main"><div class="history-head"><b>${esc(x.invoiceNumber||x.fileName||'Faktura')}</b><span>${new Intl.DateTimeFormat('pl-PL',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(x.at))}</span></div><div class="history-parties"><span>${esc(x.seller||'—')}${x.sellerNip?` · NIP ${esc(x.sellerNip)}`:''}</span><span>→</span><span>${esc(x.buyer||'—')}${x.buyerNip?` · NIP ${esc(x.buyerNip)}`:''}</span></div><div class="history-pills"><span>${x.errors} błędów</span><span>${x.warns} ostrzeżeń</span><span>${x.checks} kontroli</span><span>${x.sourceType==='pdf'?'PDF':'XML'}</span><span>XSD: ${x.sourceType==='pdf'?'N/D':x.xsd==='ok'?'OK':x.xsd==='error'?'BŁĄD':'brak'}</span>${x.test?'<span>TEST</span>':''}</div>${x.issues?.length?`<details><summary>Wykryte problemy (${x.issues.length})</summary><ul>${x.issues.map(i=>`<li class="${i.type}"><b>${esc(i.title)}</b> — ${esc(i.desc)}</li>`).join('')}</ul></details>`:''}</div></article>`).join('');
}
function clearHistory(){if(!confirm('Usunąć lokalną historię kontroli z tej przeglądarki?'))return;try{localStorage.removeItem(HISTORY_KEY)}catch{}renderHistory()}
function reportHtml(){
 if(!state.doc)return'';const inv=invoice(state.doc),errors=state.checks.filter(x=>x.type==='error').length,warns=state.checks.filter(x=>x.type==='warn').length,now=new Date();
 const rows=state.checks.map(c=>`<tr><td class="${c.type}">${c.type==='ok'?'✓':c.type==='error'?'×':c.type==='warn'?'!':'i'}</td><td><b>${esc(c.title)}</b><br><span>${esc(c.desc)}</span></td><td>${esc(c.field||'—')}</td></tr>`).join('');
 const party=(label,p)=>`<div class="party"><h3>${label}</h3><b>${esc(p?.name||'—')}</b><p>${p?.nip?`NIP ${esc(p.nip)}`:esc(partyIdValue(p||{}))}</p><p>${esc(partyAddress(p||{})||'—')}</p></div>`;
 return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>Raport kontroli ${esc(inv.number||state.fileName)}</title><style>body{font:13px Arial,sans-serif;color:#182230;margin:32px}.head{display:flex;justify-content:space-between;border-bottom:3px solid #2563eb;padding-bottom:16px}.head h1{margin:0}.muted{color:#667085}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:20px 0}.box,.party{border:1px solid #dce2ea;border-radius:10px;padding:12px}.box b{font-size:22px}.parties{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:18px 0}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #e5e7eb;padding:8px;text-align:left;vertical-align:top}td.ok{color:#16804a;font-weight:bold}td.error{color:#c52828;font-weight:bold}td.warn{color:#ad6b00;font-weight:bold}.foot{margin-top:22px;font-size:10px;color:#667085}.xsd{padding:10px;border-radius:8px;background:#f5f7fb;margin:12px 0}@media print{button{display:none}body{margin:14mm}}</style></head><body><div class="head"><div><h1>Raport kontroli faktury — Checker Pro</h1><div class="muted">${state.inputType==='pdf'?'PDF — kontrola treści':'XML FA(3) — kontrola KSeF'} • wygenerowano ${now.toLocaleString('pl-PL')}</div></div><div><b>${esc(inv.number||state.fileName)}</b><br>${esc(inv.date||'')}</div></div><div class="summary"><div class="box"><span>Błędy</span><br><b>${errors}</b></div><div class="box"><span>Ostrzeżenia</span><br><b>${warns}</b></div><div class="box"><span>Kontrole</span><br><b>${state.checks.length}</b></div><div class="box"><span>XSD</span><br><b>${state.inputType==='pdf'?'N/D':state.xsdValidation?.available?(state.xsdValidation.ok?'OK':'BŁĄD'):'N/D'}</b></div></div><div class="parties">${party('Sprzedawca',inv.seller)}${party('Nabywca',inv.buyer)}</div><div class="xsd"><b>Walidacja techniczna:</b> ${state.inputType==='pdf'?'PDF nie podlega walidacji XSD FA(3); kontrolowana jest treść dokumentu i dane rejestrowe.':state.xsdValidation?.available?(state.xsdValidation.ok?'Dokument zgodny z XSD FA(3).':`Dokument niezgodny z XSD FA(3); błędów: ${(state.xsdValidation.errors||[]).length}.`):'Pełna walidacja XSD nie była dostępna podczas kontroli.'}</div><h2>Wyniki kontroli</h2><table><thead><tr><th>Status</th><th>Kontrola</th><th>Pole</th></tr></thead><tbody>${rows}</tbody></table><div class="foot">Raport jest wynikiem automatycznej kontroli i nie zastępuje oceny stanu faktycznego ani porady podatkowej. Źródła zewnętrzne: Biała Lista MF, VIES, NBP oraz oficjalna struktura FA(3), zależnie od zakresu faktury.</div><script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`;
}
function exportControlReport(){const h=reportHtml();if(!h)return;const w=window.open('','_blank');if(!w){alert('Przeglądarka zablokowała okno raportu. Zezwól na wyskakujące okna dla tej strony.');return}w.document.open();w.document.write(h);w.document.close()}

// --- Gazeta: co się zmieniło ---
function newsChangeStatus(a){const t=`${a?.title||''} ${a?.summary||''}`.toLowerCase();if(/weszł[ao] w życie|obowiązuje od|od dziś|zaczyna obowiązywać/.test(t))return{key:'active',label:'OBOWIĄZUJE / WDROŻENIE'};if(/uchwal|podpisan|opublikowan.*dziennik|rozporządzenie ministra|ustawa z dnia/.test(t)&&!a?.planned)return{key:'adopted',label:'UCHWALONE / OPUBLIKOWANE'};if(a?.planned||/projekt|konsultac|propozyc|planowan/.test(t))return{key:'planned',label:'PROJEKT / PLANOWANE'};return{key:'info',label:'INFORMACJA'};}
function seenNewsSet(){return new Set(localGet(NEWS_SEEN_KEY,[]))}
function saveSeenNewsSet(set){localSet(NEWS_SEEN_KEY,[...set].slice(-500))}
function setNewsItemRead(url,read=true){if(!url)return;const seen=seenNewsSet();if(read)seen.add(url);else seen.delete(url);saveSeenNewsSet(seen);renderTaxNews()}
function toggleNewsItemRead(url){if(!url)return;const seen=seenNewsSet();setNewsItemRead(url,!seen.has(url))}
function markNewsRead(){const seen=seenNewsSet();(state.news?.articles||[]).map(x=>x.url).filter(Boolean).forEach(url=>seen.add(url));saveSeenNewsSet(seen);renderTaxNews()}
function renderNewsChanged(){const box=$('#newsChangedBox');if(!box||!state.news)return;const seen=seenNewsSet(),fresh=(state.news.articles||[]).filter(x=>x.url&&!seen.has(x.url));if(!fresh.length){box.classList.add('hidden');box.innerHTML='';return}const by={};fresh.forEach(x=>{const k=newsTopicTile(x).label;by[k]=(by[k]||0)+1});box.classList.remove('hidden');box.innerHTML=`<div><span class="eyebrow">Od ostatniego oznaczenia jako przeczytane</span><b>${fresh.length} nowych informacji</b></div><div class="news-change-counts">${Object.entries(by).map(([k,v])=>`<span>${esc(k)} <b>${v}</b></span>`).join('')}</div>`;}

function clearAll(){if(state.pdfObjectUrl){try{URL.revokeObjectURL(state.pdfObjectUrl)}catch{}}state.xml='';state.doc=null;state.fileName='';state.inputType='xml';state.pdfData=null;state.pdfRawText='';state.pdfObjectUrl='';state.checks=[];state.localChecks=[];state.externalChecks=[];state.xsdCheck=null;state.xsdValidation=null;state.auditDetails=null;state.currentLibraryEntry=null;state.auditSeq++;setAuditStatus('idle','Uruchomi się automatycznie po wczytaniu faktury.');$('#uploadPanel').classList.remove('hidden');$('#results').classList.add('hidden');$('#fileInput').value='';$('#printBtn').disabled=true;$('#reportBtn').disabled=true;$('#clearBtn').disabled=true;$('#batchBackBtn')?.classList.add('hidden');renderCurrentTestBanner();renderXsdStatus();const f=$('#officialPreviewFrame');if(f){f.classList.remove('hidden');f.src='about:blank';f.srcdoc='';delete f.dataset.pdfSrc;}window.pdfCanvasPreview?.reset?.();window.pdfImport?.hideReview?.();const b=$('#officialPreviewBadge');if(b)b.textContent='Ładowanie transformacji…';}
const coverage=[
 ['PDF — treść faktury','auto',['numer i daty faktury','sprzedawca/nabywca + NIP','rachunek bankowy','kwoty i podsumowania VAT','oryginalny podgląd PDF','edycja rozpoznanych danych']],
 ['Struktura FA(3)','auto',['Nagłówek i wariant FA(3)','główne sekcje','daty, waluta, P_1/P_2','pozycje FaWiersz']],
 ['Identyfikacja stron','auto',['NIP + suma kontrolna','VAT UE KodUE/NrVatUE','identyfikator państwa trzeciego','BrakID i konflikt ścieżek ID']],
 ['Matematyka','auto',['ilość × cena vs P_11','VAT w wierszu','P_15 vs suma pozycji','P_13/P_14 dla głównych stawek']],
 ['Reverse charge','auto',['P_18','P_12 = oo / np I / np II','P_13_8 / P_13_9 / P_13_10','VAT UE dla np II']],
 ['WDT i eksport','auto',['0 WDT + P_13_6_2','0 EX + P_13_6_3','identyfikacja nabywcy']],
 ['Korekty','auto',['KOR/KOR_ZAL/KOR_ROZ','DaneFaKorygowanej','NrKSeF/NrKSeFN','PrzyczynaKorekty i TypKorekty']],
 ['MPP / załącznik 15','auto',['P_12_Zal_15','P_18A','próg 15 000 PLN','waluta obca wymaga dodatkowego kursu']],
 ['Sprzedaż zwolniona','auto',['P_12=zw','P_19/P_19N','P_19A/B/C']],
 ['Waluta obca','auto',['krajowy VAT','P_14_*W','ostrzeżenia o przeliczeniu']],
 ['Biała Lista MF','online',['status VAT sprzedawcy i nabywcy','sprawdzenie na datę faktury','klucz zapytania MF']],
 ['VIES / VAT UE','online',['sprzedawca i nabywca','KodUE + NrVatUE / polski NIP','ważność numeru w VIES']],
 ['Rachunek bankowy','online',['NrRB z FA(3)','para NIP sprzedawcy + rachunek','weryfikacja w Wykazie podatników VAT']],
 ['Terminy wystawienia','auto',['15. dzień następnego miesiąca — zasada ogólna','limit 60 dni przed zdarzeniem','ostrzeżenie przy możliwym terminie szczególnym']],
 ['Kurs NBP','online',['średni kurs NBP z ostatniego dnia roboczego','porównanie P_14_* z P_14_*W','wskazanie daty i tabeli NBP']],
 ['Zaliczki i rozliczenia','auto',['ZAL / ROZ','Zamowienie','FakturaZaliczkowa','referencje do KSeF']],
 ['VAT marża','auto',['P_PMarzy','podtyp procedury marży','sprzeczności adnotacji']],
 ['Pozostałe adnotacje','auto',['metoda kasowa','samofakturowanie','transakcja trójstronna','nowy środek transportu']],
 ['Pełna walidacja XSD','auto',['oficjalny schemat XSD FA(3)','kolejność i typy elementów','ograniczenia min/maxOccurs','lokalny cache schematu po pierwszym pobraniu']],
 ['Ocena materialna transakcji','future',['czy usługa faktycznie podlega reverse charge','czy towar należy do zał. 15','miejsce świadczenia','pełny stan faktyczny poza danymi XML']]
];
function renderCoverage(){$('#coverageGrid').innerHTML=coverage.map(([n,s,items])=>`<article class="coverage-card"><span class="status-tag ${s}">${s==='auto'?'AUTO':s==='online'?'ONLINE':s==='future'?'POZA SAMYM DOKUMENTEM':'AUTO'}</span><h3>${esc(n)}</h3><ul>${items.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></article>`).join('')}
$('#fileInput').addEventListener('change',e=>readFile(e.target.files[0]));const dz=$('#dropZone');['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('drag')}));['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('drag')}));dz.addEventListener('drop',e=>{const files=[...(e.dataTransfer.files||[])];if(files.length>1&&files.every(f=>f.type==='application/pdf'||/\.pdf$/i.test(f.name||''))&&window.batchPdf?.handleFiles){window.batchPdf.handleFiles(files);return}readFile(files[0])});$$('.sample-btn[data-sample]').forEach(b=>b.addEventListener('click',()=>parseXml(samples[b.dataset.sample],`sample_${b.dataset.sample}.xml`,null,'xml')));$('#clearBtn').addEventListener('click',clearAll);$('#reportBtn')?.addEventListener('click',exportControlReport);$('#printBtn').addEventListener('click',()=>{document.querySelector('[data-tab="preview"]').click();if(state.inputType==='pdf'){const u=window.pdfImport?.pdfPreviewUrl?.()||state.pdfObjectUrl;if(u){window.open(u,'_blank','noopener');return}}const f=$('#officialPreviewFrame');setTimeout(()=>{try{f?.contentWindow?.print()}catch{window.print()}},100)});$$('.tab').forEach(b=>b.addEventListener('click',()=>{$$('.tab').forEach(x=>x.classList.remove('active'));$$('.tab-panel').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('#tab-'+b.dataset.tab).classList.add('active');if(b.dataset.tab==='preview'&&state.inputType==='pdf')setTimeout(()=>window.pdfImport?.renderPreview?.(true),30)}));$$('.nav-item').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
$('#openLibraryBtn')?.addEventListener('click',()=>showView('testLibrary'));$('#openLibraryFromUpload')?.addEventListener('click',()=>showView('testLibrary'));$('#librarySearch')?.addEventListener('input',renderTestLibrary);$('#libraryGroupFilter')?.addEventListener('change',renderTestLibrary);$('#referenceDialogClose')?.addEventListener('click',()=>$('#referenceDialog')?.close());
$('#newsRefreshBtn')?.addEventListener('click',()=>ensureTaxNews(true));$('#newsMarkReadBtn')?.addEventListener('click',markNewsRead);$('#taxNewsList')?.addEventListener('click',e=>{const b=e.target.closest?.('.news-read-toggle');if(!b)return;try{toggleNewsItemRead(decodeURIComponent(b.dataset.newsUrl||''))}catch{}});$('#newsSearch')?.addEventListener('input',renderTaxNews);$('#newsTopicFilter')?.addEventListener('change',renderTaxNews);$('#newsSourceFilter')?.addEventListener('change',renderTaxNews);$('#newsAgeFilter')?.addEventListener('change',renderTaxNews);$('#newsOfficialOnly')?.addEventListener('change',renderTaxNews);$('#historySearch')?.addEventListener('input',renderHistory);$('#historyStatusFilter')?.addEventListener('change',renderHistory);$('#historyClearBtn')?.addEventListener('click',clearHistory);
renderCoverage();ensureTestLibrary();setTimeout(()=>ensureTaxNews(false),350);
const __params=new URLSearchParams(location.search);if(__params.get('demo')&&samples[__params.get('demo')]){parseXml(samples[__params.get('demo')],`sample_${__params.get('demo')}.xml`,null);if(__params.get('tab')==='preview')document.querySelector('[data-tab="preview"]')?.click();}
