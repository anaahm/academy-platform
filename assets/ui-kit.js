(() => {
'use strict';
function esc(v=''){return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
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
document.addEventListener('DOMContentLoaded',()=>document.body?.classList.add('ui-page-enter'));
window.AcademyUI={confirm:confirmDialog,setButtonLoading,esc};
})();