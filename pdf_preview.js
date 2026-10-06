(()=>{
'use strict';
let doc=null,currentUrl='',zoom=1,baseScale=1,seq=0,loadingTask=null,resizeTimer=null;
const $=id=>document.getElementById(id);
function lib(){
  const x=window.pdfjsLib||window.PDFJS;
  if(!x)throw new Error('Nie załadowano silnika PDF.js. W trybie WORK sprawdź, czy sieć firmowa nie blokuje CDN.');
  // pdf-parse 1.1.x zawiera starszy PDF.js (1.10.x). W tej wersji worker
  // nie jest potrzebny do lokalnego podglądu; wyłączamy go, aby uniknąć
  // problemów z osobnym ładowaniem skryptu w Chrome/Edge.
  try{if('disableWorker' in x)x.disableWorker=true}catch{}
  return x;
}
function show(on=true){$('pdfCanvasViewer')?.classList.toggle('hidden',!on);$('pdfZoomControls')?.classList.toggle('hidden',!on);$('officialPreviewFrame')?.classList.toggle('hidden',on)}
function status(text,kind=''){const e=$('pdfCanvasStatus');if(!e)return;e.className=`pdf-canvas-status ${kind}`;e.textContent=text;e.classList.remove('hidden')}
function setZoomLabel(){const e=$('pdfZoomLabel');if(e)e.textContent=`${Math.round(zoom*100)}%`}
function viewportFor(page,scale){
  // PDF.js 1.10 używa getViewport(scale), nowe wersje getViewport({scale}).
  // Poprzednia wersja Checkera przekazywała obiekt do starego API, co dawało
  // viewport z NaN/zerowym canvasem: liczba stron była widoczna, ale kartka była pusta.
  let vp=null;
  try{vp=page.getViewport(scale)}catch{}
  if(!vp||!Number.isFinite(Number(vp.width))||!Number.isFinite(Number(vp.height))||vp.width<10||vp.height<10){
    try{vp=page.getViewport({scale})}catch{}
  }
  if(!vp||!Number.isFinite(Number(vp.width))||!Number.isFinite(Number(vp.height))||vp.width<10||vp.height<10){
    throw new Error(`Nieprawidłowy rozmiar strony PDF (scale=${scale}).`);
  }
  return vp;
}
async function awaitRender(task){
  if(!task)return;
  if(task.promise&&typeof task.promise.then==='function')return task.promise;
  if(typeof task.then==='function')return task;
}
async function renderPages(token){
  if(!doc||token!==seq)return;
  const pages=$('pdfCanvasPages'),viewer=$('pdfCanvasViewer');if(!pages||!viewer)return;
  pages.innerHTML='';setZoomLabel();status(`Renderuję ${doc.numPages} str. PDF…`,'loading');
  for(let n=1;n<=doc.numPages;n++){
    if(token!==seq)return;
    const page=await doc.getPage(n);if(token!==seq)return;
    const scale=baseScale*zoom;
    const vp=viewportFor(page,scale);
    const ratio=Math.max(1,Math.min(2,window.devicePixelRatio||1));
    const cssW=Math.max(1,Math.round(vp.width));
    const cssH=Math.max(1,Math.round(vp.height));
    const pixelW=Math.max(1,Math.round(cssW*ratio));
    const pixelH=Math.max(1,Math.round(cssH*ratio));
    const wrap=document.createElement('section');wrap.className='pdf-page-wrap';
    const label=document.createElement('div');label.className='pdf-page-label';label.textContent=`Strona ${n} z ${doc.numPages}`;
    const canvas=document.createElement('canvas');canvas.className='pdf-page-canvas';
    canvas.width=pixelW;canvas.height=pixelH;canvas.style.width=`${cssW}px`;canvas.style.height=`${cssH}px`;
    wrap.append(label,canvas);pages.appendChild(wrap);
    const ctx=canvas.getContext('2d',{alpha:false});
    if(!ctx)throw new Error('Przeglądarka nie udostępniła kontekstu Canvas 2D.');
    ctx.save();ctx.fillStyle='#fff';ctx.fillRect(0,0,pixelW,pixelH);ctx.restore();
    const renderContext={canvasContext:ctx,viewport:vp};
    if(ratio!==1)renderContext.transform=[ratio,0,0,ratio,0,0];
    const task=page.render(renderContext);
    await awaitRender(task);
    // Szybka kontrola techniczna: canvas musi mieć rzeczywisty rozmiar.
    if(canvas.width<10||canvas.height<10)throw new Error(`Strona ${n}: pusty canvas ${canvas.width}×${canvas.height}.`);
  }
  if(token===seq)status(`Oryginalny PDF · ${doc.numPages} ${doc.numPages===1?'strona':'strony'}`,'ok');
}
async function computeBaseScale(){
  if(!doc)return 1;
  const p=await doc.getPage(1),vp=viewportFor(p,1),viewer=$('pdfCanvasViewer');
  const width=Math.max(320,(viewer?.clientWidth||1000)-42);
  return Math.max(.45,Math.min(1.8,width/vp.width));
}
async function loadDocument(pdfjs,url){
  const task=pdfjs.getDocument(url);
  loadingTask=task;
  if(task?.promise&&typeof task.promise.then==='function')return task.promise;
  if(typeof task?.then==='function')return task;
  throw new Error('Nieobsługiwany interfejs getDocument PDF.js.');
}
async function render(url,{force=false}={}){
  show(true);const token=++seq;
  try{
    const pdfjs=lib();
    if(force||url!==currentUrl||!doc){
      status('Ładuję oryginalny PDF…','loading');
      try{await loadingTask?.destroy?.()}catch{};try{await doc?.destroy?.()}catch{};
      doc=await loadDocument(pdfjs,url);if(token!==seq)return;
      currentUrl=url;zoom=1;baseScale=await computeBaseScale();
    }
    await renderPages(token);
  }catch(e){
    if(token!==seq)return;
    console.error('PDF preview error',e);
    status(`Nie udało się narysować PDF: ${e?.message||e}`,'error');
    const pages=$('pdfCanvasPages');
    if(pages)pages.innerHTML='<div class="pdf-render-error"><b>Podgląd wewnętrzny nie zadziałał.</b><span>Użyj „Otwórz PDF ↗”. Oryginalny plik nie został zmieniony.</span></div>';
  }
}
function setZoom(v){zoom=Math.max(.55,Math.min(2.2,v));if(doc)renderPages(++seq)}
function reset(){seq++;currentUrl='';zoom=1;baseScale=1;try{loadingTask?.destroy?.()}catch{};try{doc?.destroy?.()}catch{};loadingTask=null;doc=null;const p=$('pdfCanvasPages');if(p)p.innerHTML='';show(false)}
function init(){setZoomLabel();$('pdfZoomOutBtn')?.addEventListener('click',()=>setZoom(zoom-.15));$('pdfZoomInBtn')?.addEventListener('click',()=>setZoom(zoom+.15));window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(async()=>{if(!doc||!currentUrl||$('pdfCanvasViewer')?.classList.contains('hidden'))return;try{baseScale=await computeBaseScale();renderPages(++seq)}catch(e){status(`Błąd skalowania PDF: ${e?.message||e}`,'error')}},250)})}
window.pdfCanvasPreview={render,reset,hide:()=>show(false),show:()=>show(true)};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
