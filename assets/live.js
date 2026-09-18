(() => {
'use strict';
const C=window.AcademyCore,$=id=>document.getElementById(id),$$=(s,r=document)=>[...r.querySelectorAll(s)];
let user,profile,sessions=[],filter='live';

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
function statusLabel(s){return s==='live'?'🔴 مباشر':s==='upcoming'?'📅 قادم':'✅ منتهي'}
function renderStats(){
 const live=sessions.filter(s=>s.status==='live').length,up=sessions.filter(s=>s.status==='upcoming').length,en=sessions.filter(s=>s.status==='ended').length;
 $('liveNowCount').textContent=live;$('upcomingCount').textContent=up;$('endedCount').textContent=en;
 const next=sessions.filter(s=>s.status==='upcoming'&&s.scheduledTime).sort((a,b)=>a.scheduledTime-b.scheduledTime)[0];
 $('nextSessionText').textContent=next?new Date(next.scheduledTime).toLocaleDateString('ar-EG',{day:'numeric',month:'short'}):'—';
}
function render(){
 const q=$('liveSearch').value.trim().toLowerCase();
 const list=sessions.filter(s=>(filter==='all'||s.status===filter)&&(!q||(s.title||'').toLowerCase().includes(q)||(s.teacher||'').toLowerCase().includes(q))).sort((a,b)=>{
  if(a.status==='live'&&b.status!=='live')return-1;if(b.status==='live'&&a.status!=='live')return 1;
  return Number(a.scheduledTime||0)-Number(b.scheduledTime||0);
 });
 $('liveGrid').innerHTML=list.length?list.map(s=>'<article class="live-card"><div class="live-cover"><span>🎥</span><span class="live-status '+C.esc(s.status||'upcoming')+'">'+statusLabel(s.status)+'</span></div><div class="live-card-body"><h3>'+C.esc(s.title||'جلسة مباشرة')+'</h3><p>👨‍🏫 '+C.esc(s.teacher||'غير محدد')+' • ⏱️ '+Number(s.duration||60)+' دقيقة</p><p>🗓️ '+(s.scheduledTime?new Date(s.scheduledTime).toLocaleString('ar-EG'):'الموعد غير محدد')+'</p><div class="live-actions"><button class="btn btn-primary" data-open-session="'+s.id+'">'+(s.status==='live'?'شاهد الآن':'عرض التفاصيل')+'</button></div></div></article>').join(''):'<div class="feature-empty"><span>📡</span><h3>لا توجد جلسات في هذا القسم</h3><p>عندما تضيف الإدارة جلسة جديدة ستظهر هنا تلقائيًا.</p></div>';
 $$('[data-open-session]').forEach(b=>b.onclick=()=>openSession(b.dataset.openSession));
}
function openSession(id){
 const s=sessions.find(x=>x.id===id);if(!s)return;
 $('liveViewerTitle').textContent=s.title||'الجلسة';
 const src=embed(s.youtubeLiveUrl||'');
 $('liveVideo').innerHTML=src?'<iframe src="'+C.esc(src)+'" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>':'<div style="height:100%;display:grid;place-items:center;color:#94a3b8"><div style="text-align:center"><div style="font-size:50px">📡</div><strong>لا يوجد بث YouTube مضاف</strong></div></div>';
 const acts=[];
 if(s.zoomLink)acts.push('<a class="btn btn-primary" href="'+C.safeUrl(s.zoomLink)+'" target="_blank" rel="noopener"><i class="fa-solid fa-video"></i> الانضمام عبر Zoom</a>');
 if(s.youtubeLiveUrl)acts.push('<a class="btn btn-soft" href="'+C.safeUrl(s.youtubeLiveUrl)+'" target="_blank" rel="noopener"><i class="fa-brands fa-youtube"></i> فتح على YouTube</a>');
 $('liveViewerActions').innerHTML=acts.join('')||'<span style="font-size:10px;color:#64748b">لا توجد روابط جلسة متاحة حاليًا.</span>';
 $('liveViewer').classList.remove('hidden');document.body.style.overflow='hidden';
}
$('closeLiveViewer').onclick=()=>{$('liveViewer').classList.add('hidden');document.body.style.overflow=''};
$('liveViewer').onclick=e=>{if(e.target===$('liveViewer'))$('closeLiveViewer').click()};
$$('[data-live-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.liveFilter;$$('[data-live-filter]').forEach(x=>x.classList.toggle('active',x===b));render()});
$('liveSearch').oninput=render;

(async()=>{
 ({user,profile}=await C.requireStudent());$('pageAvatar').textContent=C.initials(profile.name||user.displayName||'طالب');
 const s=await C.db.ref('liveSessions').once('value');sessions=Object.entries(s.val()||{}).map(([id,v])=>({id,...(v||{})}));
 renderStats();render();
})();
})();