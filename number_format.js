(()=>{
'use strict';
const parse=v=>{const s=String(v??'').replace(/[\s\u00A0\u202F]/g,'').replace(',','.');const n=Number(s);return Number.isFinite(n)?n:null};
const fmt=v=>{const n=parse(v);if(n===null)return String(v??'');const raw=String(v??'');const dec=/[,.](\d+)/.exec(raw.replace(/[\s\u00A0\u202F]/g,''));const digits=dec?Math.min(4,dec[1].length):0;return new Intl.NumberFormat('pl-PL',{minimumFractionDigits:digits,maximumFractionDigits:Math.max(2,digits)}).format(n)};
function wire(input){if(input.dataset.nfReady)return;input.dataset.nfReady='1';if(input.type==='number')input.type='text';input.inputMode='decimal';if(input.value!=='')input.value=fmt(input.value);input.addEventListener('focus',()=>{const n=String(input.value).replace(/[\s\u00A0\u202F]/g,'');input.value=n});input.addEventListener('blur',()=>{if(input.value.trim()!=='')input.value=fmt(input.value)});}
function apply(root=document){root.querySelectorAll('input[data-money], #taxSimulatorView input[type="number"], #toolboxView input[type="number"]:not([id$="Year"])').forEach(wire)}
function refresh(root=document){root.querySelectorAll('input[data-nf-ready="1"]').forEach(i=>{if(i.value.trim()!=='')i.value=fmt(i.value)})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>apply());else apply();
window.numberFormatter={apply,refresh,parse,format:fmt};
})();
