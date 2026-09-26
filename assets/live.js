(() => {
'use strict';
const C=window.AcademyCore,$=id=>document.getElementById(id),$$=(s,r=document)=>[...r.querySelectorAll(s)];
let user,profile,sessions=[],filter='live',viewerTrigger=null,activeSessionId=null,attendanceStartedAt=0;
async function startAttendance(session){
 if(!user||!session?.id)return;activeSessionId=session.id;attendanceStartedAt=Date.now();
 try{
  const ref=C.db.ref('attendance/'+session.id+'/'+user.uid),snap=await ref.once('value'),prev=snap.val()||{};
  await ref.update({studentName:profile?.name||user.displayName||'طالب',sessionTitle:session.title||'جلسة',type:profile?.educationType||'',stage:profile?.stage||'',grade:String(profile?.grade||''),firstJoinedAt:Number(prev.firstJoinedAt||attendanceStartedAt),lastJoinedAt:attendanceStartedAt,lastSeenAt:attendanceStartedAt,visits:Number(prev.visits||0)+1,totalMinutes:Number(prev.totalMinutes||0)});
 }catch(err){console.warn('Attendance start deferred',err)}
}
async function finishAttendance(){
 if(!user||!activeSessionId||!attendanceStartedAt)return;
 const id=activeSessionId,started=attendanceStartedAt;activeSessionId=null;attendanceStartedAt=0;
 try{
  const ref=C.db.ref('attendance/'+id+'/'+user.uid),snap=await ref.once('value'),prev=snap.val()||{},minutes=Math.max(1,Math.round((Date.now()-started)/60000));
  await ref.update({lastSeenAt:Date.now(),lastLeftAt:Date.now(),totalMinutes:Number(prev.totalMinutes||0)+minutes});
 }catch(err){console.warn('Attendance finish deferred',err)}
}

function embed(url=''){return window.AcademyUtils.youtubeEmbed(url)}
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
 if(zoom&&zoom!=='#')acts.push('<a class="btn btn-primary" href="'+C.esc(zoom)+'" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-video"></i> الانضمام عبر Zoom</a>');
 if(yt&&yt!=='#')acts.push('<a class="btn btn-soft" href="'+C.esc(yt)+'" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-youtube"></i> فتح على YouTube</a>');
 $('liveViewerActions').innerHTML=acts.join('')||'<span class="live-no-actions">لا توجد روابط جلسة متاحة حاليًا.</span>';
 $('liveViewer').classList.remove('hidden');$('liveViewer').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';
 startAttendance(s);
 setTimeout(()=>$('liveViewer').querySelector('.live-viewer-panel')?.focus(),30);
}
function closeViewer(){
 finishAttendance();
 $('liveVideo').replaceChildren();
 $('liveViewer').classList.add('hidden');$('liveViewer').setAttribute('aria-hidden','true');document.body.style.overflow='';
 const target=viewerTrigger;viewerTrigger=null;setTimeout(()=>target?.focus(),30);
}
$('closeLiveViewer').onclick=closeViewer;
$('liveViewer').onclick=e=>{if(e.target===$('liveViewer'))closeViewer()};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('liveViewer').classList.contains('hidden'))closeViewer()});
window.addEventListener('beforeunload',()=>{finishAttendance()});
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
