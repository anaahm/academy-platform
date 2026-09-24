(() => {
'use strict';
const C=window.AcademyCore,N=window.AcademyNotifications,$=id=>document.getElementById(id),$$=(s,r=document)=>[...r.querySelectorAll(s)];
let user,profile,items=[],filter='all';

function relative(ts){
  const diff=Date.now()-Number(ts||0),abs=Math.abs(diff);
  if(abs<60000)return'الآن';
  if(abs<3600000)return Math.max(1,Math.round(abs/60000))+' دقيقة';
  if(abs<86400000)return Math.max(1,Math.round(abs/3600000))+' ساعة';
  if(abs<7*86400000)return Math.max(1,Math.round(abs/86400000))+' يوم';
  return new Date(ts).toLocaleDateString('ar-EG',{day:'numeric',month:'short'});
}
function labelForFilter(f){
  return{all:'كل الإشعارات',unread:'غير المقروء',academic:'الإشعارات الدراسية',schedule:'المواعيد',system:'إشعارات المنصة'}[f]||'الإشعارات';
}
function filtered(){
  if(filter==='all')return items;
  if(filter==='unread')return items.filter(x=>!x.read);
  return items.filter(x=>x.category===filter);
}
function renderStats(){
  const unread=items.filter(x=>!x.read).length,academic=items.filter(x=>x.category==='academic').length,schedule=items.filter(x=>x.category==='schedule').length,system=items.filter(x=>x.category==='system').length;
  $('notificationTotal').textContent=items.length;
  $('notificationUnread').textContent=unread;
  $('notificationAcademic').textContent=academic;
  $('notificationSchedule').textContent=schedule;
  $('filterCountAll').textContent=items.length;
  $('filterCountUnread').textContent=unread;
  $('filterCountAcademic').textContent=academic;
  $('filterCountSchedule').textContent=schedule;
  $('filterCountSystem').textContent=system;
}
function cardHtml(n){
  const open=n.href?'<button class="notification-open-btn" data-open-notification="'+C.esc(n.key)+'" data-href="'+C.esc(n.href)+'">فتح <i class="fa-solid fa-arrow-left"></i></button>':'';
  const fresh=n.read?'':'<span class="notification-new-dot">جديد</span>';
  const category=n.category==='academic'?'دراسي':n.category==='schedule'?'موعد':'المنصة';
  return '<article class="notification-center-item '+(n.read?'read':'unread')+' priority-'+C.esc(n.priority||'normal')+'" data-notification-key="'+C.esc(n.key)+'">'+
    '<span class="notification-center-icon tone-'+C.esc(n.tone||'blue')+'"><i class="fa-solid '+C.esc(n.icon||'fa-bell')+'"></i></span>'+
    '<div class="notification-center-copy">'+
      '<div class="notification-center-title-row"><h3>'+C.esc(n.title||'إشعار')+'</h3>'+fresh+'</div>'+
      '<p>'+C.esc(n.text||'')+'</p>'+
      '<div class="notification-center-meta"><span><i class="fa-regular fa-clock"></i> '+relative(n.createdAt)+'</span><span>'+category+'</span></div>'+
    '</div>'+
    '<div class="notification-center-actions">'+open+
      '<button class="notification-read-btn" data-toggle-read="'+C.esc(n.key)+'">'+(n.read?'جعله غير مقروء':'تعليم كمقروء')+'</button>'+
    '</div>'+
  '</article>';
}
function render(){
  renderStats();
  const list=filtered();
  $('notificationListTitle').textContent=labelForFilter(filter);
  $('notificationMeta').textContent=list.length+' إشعار';
  $('markAllNotifications').disabled=!items.some(x=>!x.read);
  $('notificationList').innerHTML=list.length?list.map(cardHtml).join(''):'<div class="feature-empty"><span>🔕</span><h3>مفيش إشعارات هنا</h3><p>لما يكون فيه تحديث مهم هيظهر في المركز تلقائيًا.</p></div>';
  $$('[data-toggle-read]').forEach(b=>b.onclick=()=>toggleRead(b.dataset.toggleRead,b));
  $$('[data-open-notification]').forEach(b=>b.onclick=()=>openNotification(b.dataset.openNotification,b.dataset.href,b));
}
async function reload(){
  const result=await N.loadNotifications(user);
  profile=result.profile;items=result.items;render();
}
async function toggleRead(key,btn){
  const item=items.find(x=>x.key===key);if(!item)return;
  btn.disabled=true;
  try{
    if(item.read)await N.markUnread(user.uid,key);else await N.markRead(user.uid,key);
    item.read=!item.read;render();
  }catch(err){
    console.error(err);btn.disabled=false;C.toast('تعذر تحديث حالة الإشعار الآن.','error');
  }
}
async function openNotification(key,href,btn){
  const item=items.find(x=>x.key===key);btn.disabled=true;
  try{
    if(item&&!item.read){await N.markRead(user.uid,key);item.read=true}
    const target=C.safeUrl(href||'./index.html')||'./index.html';
    location.href=target;
  }catch(err){
    console.error(err);btn.disabled=false;C.toast('تعذر فتح الإشعار الآن.','error');
  }
}
$('markAllNotifications').onclick=async()=>{
  const btn=$('markAllNotifications');
  window.AcademyUI?.setButtonLoading(btn,true,'تعليم');
  try{
    await N.markAllRead(user.uid,items);
    items.forEach(x=>x.read=true);render();C.toast('تم تعليم كل الإشعارات كمقروءة ✅');
  }catch(err){
    console.error(err);C.toast('تعذر تحديث كل الإشعارات الآن.','error');
  }finally{window.AcademyUI?.setButtonLoading(btn,false)}
};
$$('[data-notification-filter]').forEach(b=>b.onclick=()=>{
  filter=b.dataset.notificationFilter;
  $$('[data-notification-filter]').forEach(x=>{const active=x===b;x.classList.toggle('active',active);x.setAttribute('aria-selected',active?'true':'false')});
  render();
});

(async()=>{
  window.AcademyUI?.showPageLoading('جاري جمع إشعاراتك وتحديثاتك...');
  try{
    ({user,profile}=await C.requireStudent());
    $('pageAvatar').textContent=C.initials(profile.name||user.displayName||'طالب');
    await reload();
  }catch(err){
    console.error(err);C.toast('تعذر تحميل الإشعارات الآن.','error');
    $('notificationList').innerHTML=window.AcademyUI?.errorStateHtml('تعذر تحميل الإشعارات','تحقق من الاتصال ثم حاول مرة أخرى.','<button class="btn btn-primary" onclick="location.reload()">إعادة المحاولة</button>')||'';
  }finally{window.AcademyUI?.hidePageLoading()}
})();
})();