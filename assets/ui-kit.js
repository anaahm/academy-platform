(() => {
'use strict';
function esc(v=''){return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function ensureRouteProgress(){
  let bar=document.querySelector('.ui-route-progress');
  if(!bar){bar=document.createElement('div');bar.className='ui-route-progress';document.body.appendChild(bar)}
  return bar;
}
function startRouteProgress(){
  const bar=ensureRouteProgress();bar.classList.add('show');bar.style.width='18%';
  requestAnimationFrame(()=>bar.style.width='72%');
}
function finishRouteProgress(){
  const bar=document.querySelector('.ui-route-progress');if(!bar)return;
  bar.style.width='100%';setTimeout(()=>{bar.classList.remove('show');bar.style.width='0'},180);
}
function confirmDialog(options={}){
  const opts=typeof options==='string'?{message:options}:options;
  const title=opts.title||'هل أنت متأكد؟',message=opts.message||'',tone=opts.tone||'danger';
  const acceptText=opts.acceptText||'تأكيد',cancelText=opts.cancelText||'إلغاء';
  const icon=opts.icon||({danger:'fa-triangle-exclamation',warning:'fa-circle-exclamation',success:'fa-circle-check'}[tone]||'fa-circle-question');
  return new Promise(resolve=>{
    const old=document.querySelector('.ui-confirm-backdrop');if(old)old.remove();
    const wrap=document.createElement('div');wrap.className='ui-confirm-backdrop';
    wrap.innerHTML='<div class="ui-confirm-card '+esc(tone)+'" role="dialog" aria-modal="true" aria-labelledby="uiConfirmTitle">'+
      '<div class="ui-confirm-icon"><i class="fa-solid '+esc(icon)+'"></i></div>'+
      '<h3 id="uiConfirmTitle">'+esc(title)+'</h3><p>'+esc(message)+'</p>'+
      '<div class="ui-confirm-actions"><button class="ui-confirm-cancel">'+esc(cancelText)+'</button><button class="ui-confirm-accept">'+esc(acceptText)+'</button></div></div>';
    document.body.appendChild(wrap);document.body.style.overflow='hidden';
    requestAnimationFrame(()=>wrap.classList.add('show'));
    const finish=value=>{wrap.classList.remove('show');document.body.style.overflow='';setTimeout(()=>wrap.remove(),180);resolve(value)};
    wrap.querySelector('.ui-confirm-cancel').onclick=()=>finish(false);
    wrap.querySelector('.ui-confirm-accept').onclick=()=>finish(true);
    wrap.onclick=e=>{if(e.target===wrap)finish(false)};
    const key=e=>{if(e.key==='Escape'){document.removeEventListener('keydown',key);finish(false)}};
    document.addEventListener('keydown',key,{once:true});
    setTimeout(()=>wrap.querySelector('.ui-confirm-accept')?.focus(),50);
  });
}
function showNetworkBanner(online){
  let banner=document.querySelector('.ui-network-banner');
  if(!banner){banner=document.createElement('div');banner.className='ui-network-banner';document.body.appendChild(banner)}
  banner.className='ui-network-banner '+(online?'online':'offline');
  banner.innerHTML=online?'<i class="fa-solid fa-wifi"></i><span>رجع الاتصال بالإنترنت</span>':'<i class="fa-solid fa-wifi-slash"></i><span>أنت غير متصل بالإنترنت. بعض البيانات قد لا تتحدث.</span>';
  requestAnimationFrame(()=>banner.classList.add('show'));
  clearTimeout(showNetworkBanner.t);
  showNetworkBanner.t=setTimeout(()=>banner.classList.remove('show'),online?2200:5200);
}
function emptyStateHtml(title='لا توجد بيانات',text='',icon='fa-inbox',actionHtml=''){
  return '<div class="ui-empty-state"><span class="ui-empty-icon"><i class="fa-solid '+esc(icon)+'"></i></span><h3>'+esc(title)+'</h3><p>'+esc(text)+'</p>'+actionHtml+'</div>';
}
function errorStateHtml(title='تعذر تحميل البيانات',text='حاول مرة أخرى بعد قليل.',actionHtml=''){
  return '<div class="ui-error-state"><span class="ui-error-icon"><i class="fa-solid fa-triangle-exclamation"></i></span><h3>'+esc(title)+'</h3><p>'+esc(text)+'</p>'+actionHtml+'</div>';
}
function showPageLoading(message='جاري تجهيز الصفحة...'){
  let wrap=document.querySelector('.ui-page-loader');
  if(!wrap){
    wrap=document.createElement('div');wrap.className='ui-page-loader';
    wrap.innerHTML='<div class="ui-page-loader-card"><span class="ui-page-loader-mark"><i class="fa-solid fa-book-open"></i></span><strong>الأكاديمية</strong><p class="ui-page-loader-text"></p><span class="ui-loader-line"><i></i></span></div>';
    document.body.appendChild(wrap);
  }
  wrap.querySelector('.ui-page-loader-text').textContent=message;
  requestAnimationFrame(()=>wrap.classList.add('show'));
}
function hidePageLoading(){
  const wrap=document.querySelector('.ui-page-loader');if(!wrap)return;
  wrap.classList.remove('show');setTimeout(()=>wrap.remove(),220);
}
function setButtonLoading(button,on,label='جاري التنفيذ...'){
  if(!button)return;
  if(on){
    if(!button.dataset.uiOriginalHtml)button.dataset.uiOriginalHtml=button.innerHTML;
    button.disabled=true;button.innerHTML='<span class="ui-loading-dots"><i></i><i></i><i></i></span> '+esc(label);
  }else{
    button.disabled=false;if(button.dataset.uiOriginalHtml){button.innerHTML=button.dataset.uiOriginalHtml;delete button.dataset.uiOriginalHtml}
  }
}
document.addEventListener('pointerdown',e=>{
  const btn=e.target.closest('.btn,button,.icon-btn');
  if(!btn||btn.disabled||btn.classList.contains('no-ripple'))return;
  btn.classList.add('ui-ripple-host');
  const r=btn.getBoundingClientRect(),size=Math.max(r.width,r.height)*.65,span=document.createElement('span');
  span.className='ui-ripple';span.style.width=span.style.height=size+'px';span.style.left=(e.clientX-r.left-size/2)+'px';span.style.top=(e.clientY-r.top-size/2)+'px';
  btn.appendChild(span);setTimeout(()=>span.remove(),520);
},{passive:true});
document.addEventListener('DOMContentLoaded',()=>{document.body?.classList.add('ui-page-enter');finishRouteProgress();if(!navigator.onLine)showNetworkBanner(false)});
window.addEventListener('offline',()=>showNetworkBanner(false));
window.addEventListener('online',()=>showNetworkBanner(true));
document.addEventListener('click',e=>{
  const a=e.target.closest('a[href]');if(!a)return;
  const href=a.getAttribute('href')||'';
  if(a.target==='_blank'||a.hasAttribute('download')||href.startsWith('#')||href.startsWith('javascript:')||href.startsWith('mailto:')||href.startsWith('tel:'))return;
  try{
    const url=new URL(href,location.href);
    if(url.origin===location.origin)startRouteProgress();
  }catch{}
},true);
window.addEventListener('pageshow',finishRouteProgress);
window.AcademyUI={confirm:confirmDialog,setButtonLoading,showPageLoading,hidePageLoading,emptyStateHtml,errorStateHtml,showNetworkBanner,esc,startRouteProgress,finishRouteProgress};
})();