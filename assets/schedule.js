(() => {
'use strict';
const C=window.AcademyCore,$=id=>document.getElementById(id),$$=(s,r=document)=>[...r.querySelectorAll(s)];
let user,profile,scheduleEvents={},liveSessions={},planner={},filter='all';
const DAY=86400000;

function startOfDay(d=new Date()){const x=new Date(d);x.setHours(0,0,0,0);return x}
function monday(){const d=startOfDay(),n=(d.getDay()+6)%7;d.setDate(d.getDate()-n);return d}
function weekEnd(){return new Date(monday().getTime()+7*DAY)}
function dateKey(d){return d.toISOString().slice(0,10)}
function matchesStudent(e){
 return e?.isActive!==false &&
   (!e.type||e.type===profile.educationType) &&
   (!e.stage||e.stage===profile.stage) &&
   (!e.grade||String(e.grade)===String(profile.grade));
}
function eventDateForDay(dayOfWeek,time='00:00'){
 const start=monday(),jsDay=Number(dayOfWeek),offset=(jsDay+6)%7,d=new Date(start.getTime()+offset*DAY);
 const [h,m]=String(time).split(':').map(Number);d.setHours(h||0,m||0,0,0);return d;
}
function allItems(){
 const start=monday(),end=weekEnd(),items=[];
 Object.entries(scheduleEvents||{}).forEach(([id,e])=>{
   if(!matchesStudent(e))return;
   const at=eventDateForDay(e.dayOfWeek,e.time||'00:00');
   items.push({id:'class-'+id,kind:'class',title:e.title||'حصة',subject:e.subjectName||e.subject||'',teacher:e.teacher||'',at:at.getTime(),duration:Number(e.duration||60),url:e.url||'',color:'blue'});
 });
 Object.entries(liveSessions||{}).forEach(([id,e])=>{
   const at=Number(e.scheduledTime||0);if(!at||at<start.getTime()||at>=end.getTime())return;
   items.push({id:'live-'+id,kind:'live',title:e.title||'جلسة مباشرة',subject:'بث مباشر',teacher:e.teacher||'',at,duration:Number(e.duration||60),url:'./live.html',color:'violet'});
 });
 Object.entries(planner||{}).forEach(([id,t])=>{
   if(!t?.date)return;const d=new Date(t.date+'T00:00:00');if(d<start||d>=end)return;
   d.setHours(18,0,0,0);
   items.push({id:'task-'+id,kind:'task',title:t.title||'مهمة مذاكرة',subject:t.subject||'',teacher:'',at:d.getTime(),duration:Number(t.duration||30),url:'./planner.html',done:!!t.done,color:'amber'});
 });
 return items.sort((a,b)=>a.at-b.at);
}
function filtered(items){return filter==='all'?items:items.filter(x=>x.kind===filter)}
function kindLabel(k){return k==='class'?'حصة':k==='live'?'بث مباشر':'مذاكرة'}
function kindIcon(k){return k==='class'?'fa-chalkboard-user':k==='live'?'fa-tower-broadcast':'fa-list-check'}
function render(){
 const items=allItems(),start=monday(),todayKey=dateKey(startOfDay()),filteredItems=filtered(items);
 $('scheduleTodayCount').textContent=items.filter(x=>dateKey(new Date(x.at))===todayKey).length;
 $('scheduleWeekCount').textContent=items.length;
 $('scheduleLiveCount').textContent=items.filter(x=>x.kind==='live').length;
 $('scheduleTaskCount').textContent=items.filter(x=>x.kind==='task'&&!x.done).length;
 $('scheduleWeekLabel').textContent=start.toLocaleDateString('ar-EG',{day:'numeric',month:'short'})+' — '+new Date(start.getTime()+6*DAY).toLocaleDateString('ar-EG',{day:'numeric',month:'short'});
 const days=[];
 for(let i=0;i<7;i++){
   const d=new Date(start.getTime()+i*DAY),key=dateKey(d),dayItems=filteredItems.filter(x=>dateKey(new Date(x.at))===key);
   days.push('<section class="schedule-day '+(key===todayKey?'today':'')+'"><header><span>'+d.toLocaleDateString('ar-EG',{weekday:'long'})+'</span><strong>'+d.toLocaleDateString('ar-EG',{day:'numeric',month:'short'})+'</strong></header><div class="schedule-day-items">'+(dayItems.length?dayItems.map(itemCard).join(''):'<div class="schedule-empty-day">لا توجد مواعيد</div>')+'</div></section>');
 }
 $('scheduleWeek').innerHTML=days.join('');
 const next=items.filter(x=>x.at>=Date.now()&&!x.done)[0];
 $('nextScheduleItem').innerHTML=next?'<span class="next-schedule-icon '+next.kind+'"><i class="fa-solid '+kindIcon(next.kind)+'"></i></span><strong>'+C.esc(next.title)+'</strong><p>'+new Date(next.at).toLocaleString('ar-EG',{weekday:'long',hour:'numeric',minute:'2-digit'})+'</p><small>'+kindLabel(next.kind)+(next.teacher?' • '+C.esc(next.teacher):'')+'</small>':'<div class="feature-empty compact"><span>🎉</span><h3>مفيش موعد قريب</h3><p>استغل الوقت في مراجعة بسيطة.</p></div>';
}
function itemCard(x){
 const time=new Date(x.at).toLocaleTimeString('ar-EG',{hour:'numeric',minute:'2-digit'});
 const href=x.kind==='class'?(x.url?C.safeUrl(x.url):''):x.url;
 const open=href?'<a class="schedule-open" href="'+href+'" '+(href.startsWith('http')?'target="_blank" rel="noopener"':'')+'><i class="fa-solid fa-arrow-up-left-from-square"></i></a>':'';
 return '<article class="schedule-item '+x.kind+' '+(x.done?'done':'')+'"><span class="schedule-kind-icon"><i class="fa-solid '+kindIcon(x.kind)+'"></i></span><div><span class="schedule-time">'+time+' • '+x.duration+' د</span><h4>'+C.esc(x.title)+'</h4><p>'+kindLabel(x.kind)+(x.teacher?' • '+C.esc(x.teacher):'')+'</p></div>'+open+'</article>';
}
$$('[data-schedule-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.scheduleFilter;$$('[data-schedule-filter]').forEach(x=>x.classList.toggle('active',x===b));render()});

(async()=>{
 ({user,profile}=await C.requireStudent());$('pageAvatar').textContent=C.initials(profile.name||user.displayName||'طالب');
 const [s,l,p]=await Promise.all([
   C.db.ref('scheduleEvents').once('value'),
   C.db.ref('liveSessions').once('value'),
   C.db.ref('studentProfilesV3/'+user.uid+'/studyPlanner').once('value')
 ]);
 scheduleEvents=s.val()||{};liveSessions=l.val()||{};planner=p.val()||{};render();
})();
})();