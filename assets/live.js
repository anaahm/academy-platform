(() => {
'use strict';
const C=window.AcademyCore,$=id=>document.getElementById(id),$$=(s,r=document)=>[...r.querySelectorAll(s)];
let user,profile,sessions=[],filter='live',viewerTrigger=null;

function embed(url=''){
 try{
  const u=new URL(url);let id='';
  if(u.hostname.includes('youtu.be'))id=u.pathname.replace('/','').split('/')[0];
  else if(u.pathname.includes('/live/'))id=u.pathname.split('/live/')[1]?.split('/')[0];
  else if(u.pathname.includes('/embed/'))return url;
  else id=u.searchParams.get('v')||'';
  return id?'https://www.youtube.com/embed/'+encodeURIComponent(id)+'?rel=0':'';
 }catch{return''}
}
function matchesStudent(s){
 return s&&s.isHidden!==true&&
   (!s.type||s.type===profile.educationType)&&
   (!s.stage||s.stage===profile.stage)&&
   (!s.grade||String(s.grade)===String(profile.grade));
}
function statusOf(s){
 if(s.status==='live'||s.status==='ended'||s.status==='upcoming')return s.status;
 const at=Number(s.scheduledTime||0),duration=Number(s.duration||60)*60000;
 if(at&&Date.now()>=at&&Date.now()<at+duration)return'live';
 if(at&&Date.now()>=at+duration)return'ended';
 return'upcoming';
}
function eligible(){return sessions.filter(matchesStudent).map(s=>({...s,status:statusOf(s)}))}
function statusLabel(s){return s==='live'?'🔴 مباشر':s==='upcoming'?'📅 قادم':'✅ منتهي'}
function renderStats(){
 const list=eligible(),live=list.filter(s=>s.status==='live').length,up=list.filter(s=>s.status==='upcoming').length,en=list.filter(s=>s.status==='ended').length;
 $('liveNowCount').textContent=live;$('upcomingCount').textContent=up;$('endedCount').textContent=en;
 const next=list.filter(s=>s.status==='upcoming'&&s.scheduledTime).sort((a,b)=>a.scheduledTime-b.scheduledTime)[0];
 $('nextSessionText').textContent=next?new Date(next.scheduledTime).toLocaleDateString('ar-EG',{day:'numeric',month:'short'}):'—';
}
function render(){
 const q=$('liveSearch').value.trim().toLowerCase();
 const list=eligible().filter(s=>(filter==='all'||s.status===filter)&&(!q||((s.title||'')+' '+(s.teacher||'')).toLowerCase().includes(q))).sort((a,b)=>{
   if(a.status==='live'&&b.status!=='live')return-1;if(b.status==='live'&&a.status!=='live')return 1;
   return Number(a.scheduledTime||0)-Number(b.scheduledTime||0);
 });
 $('liveGrid').innerHTML=list.length?list.map(s=>
   '<article class="live-card '+s.status+'"><div class="live-cover"><span>🎥</span><span class="live-status '+C.esc(s.status)+'">'+statusLabel(s.status)+'</span></div>'+
   '<div class="live-card-body"><h3>'+C.esc(s.title||'جلسة مباشرة')+'</h3><p>👨‍🏫 '+C.esc(s.teacher||'غير محدد')+' • ⏱️ '+Number(s.duration||60)+' دقيقة</p>'+
   '<p>🗓️ '+(s.scheduledTime?new Date(s.scheduledTime).toLocaleString('ar-EG'):'الموعد غير محدد')+'</p>'+
   '<div class="live-actions"><button class="btn '+(s.status==='live'?'btn-primary':'btn-soft')+'" data-open-session="'+s.id+'">'+(s.status==='live'?'شاهد الآن':'عرض التفاصيل')+'</button></div></div></article>'
 ).join(''):'<div class="feature-empty"><span>📡</span><h3>لا توجد جلسات في هذا القسم</h3><p>عندما تضيف الإدارة جلسة مناسبة لك ستظهر هنا تلقائيًا.</p></div>';
 $$('[data-open-session]').forEach(b=>b.onclick=()=>openSession(b.dataset.openSession,b));
}
function openSession(id,trigger){
 const raw=sessions.find(x=>x.id===id);if(!raw)return;
 const s={...raw,status:statusOf(raw)};viewerTrigger=trigger||document.activeElement;
 $('liveViewerTitle').textContent=s.title||'الجلسة';
 const src=embed(s.youtubeLiveUrl||'');
 $('liveVideo').innerHTML=src
  ?'<iframe src="'+C.esc(src)+'" title="'+C.esc(s.title||'الجلسة المباشرة')+'" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>'
  :'<div class="live-video-empty"><div><span>📡</span><strong>لا يوجد بث YouTube مضاف</strong><p>استخدم رابط الجلسة الخارجي لو كان متاحًا.</p></div></div>';
 const acts=[],zoom=C.safeUrl(s.zoomLink||''),yt=C.safeUrl(s.youtubeLiveUrl||'');
 if(zoom)acts.push('<a class="btn btn-primary" href="'+zoom+'" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-video"></i> الانضمام عبر Zoom</a>');
 if(yt)acts.push('<a class="btn btn-soft" href="'+yt+'" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-youtube"></i> فتح على YouTube</a>');
 $('liveViewerActions').innerHTML=acts.join('')||'<span class="live-no-actions">لا توجد روابط جلسة متاحة حاليًا.</span>';
 $('liveViewer').classList.remove('hidden');$('liveViewer').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';
 setTimeout(()=>$('liveViewer').querySelector('.live-viewer-panel')?.focus(),30);
}
function closeViewer(){
 $('liveViewer').classList.add('hidden');$('liveViewer').setAttribute('aria-hidden','true');document.body.style.overflow='';
 const target=viewerTrigger;viewerTrigger=null;setTimeout(()=>target?.focus(),30);
}
$('closeLiveViewer').onclick=closeViewer;
$('liveViewer').onclick=e=>{if(e.target===$('liveViewer'))closeViewer()};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('liveViewer').classList.contains('hidden'))closeViewer()});
$$('[data-live-filter]').forEach(b=>b.onclick=()=>{
 filter=b.dataset.liveFilter;
 $$('[data-live-filter]').forEach(x=>{const active=x===b;x.classList.toggle('active',active);x.setAttribute('aria-selected',active?'true':'false')});
 render();
});
$('liveSearch').oninput=render;

(async()=>{
 window.AcademyUI?.showPageLoading('جاري تحميل الجلسات والبث...');
 try{
   ({user,profile}=await C.requireStudent());$('pageAvatar').textContent=C.initials(profile.name||user.displayName||'طالب');
   const ref=C.db.ref('liveSessions'),first=await ref.once('value');
   sessions=Object.entries(first.val()||{}).map(([id,v])=>({id,...(v||{})}));renderStats();render();
   ref.on('value',s=>{sessions=Object.entries(s.val()||{}).map(([id,v])=>({id,...(v||{})}));renderStats();render()},err=>{console.error(err);C.toast('تعذر مزامنة الجلسات الآن.','error')});
 }catch(err){
   console.error(err);C.toast('تعذر تحميل الجلسات الآن.','error');
   $('liveGrid').innerHTML=window.AcademyUI?.errorStateHtml('تعذر تحميل البث والجلسات','تحقق من الاتصال وحاول مرة أخرى.','<button class="btn btn-primary" onclick="location.reload()">إعادة المحاولة</button>')||'';
 }finally{window.AcademyUI?.hidePageLoading()}
})();
})();