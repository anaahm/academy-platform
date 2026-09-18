(() => {
'use strict';
const C=window.AcademyCore,$=id=>document.getElementById(id);
let user,profile,data={customSubjects:{}};

function quizHistory(){return Object.values(profile.quizHistory||{}).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))}
function simHistory(){return Object.values(profile.simulationHistory||{}).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))}
function scoreClass(v){return v>=80?'good':v>=60?'mid':'low'}
function render(){
 const stats=profile.stats||{},qh=quizHistory(),sh=simHistory();
 $('progressLessons').textContent=stats.completedLessons||0;
 $('progressAverage').textContent=(qh.length?Math.round(qh.reduce((a,x)=>a+Number(x.score||0),0)/qh.length):0)+'%';
 $('progressMinutes').textContent=stats.studyMinutes||0;$('progressStreak').textContent=stats.streak||0;

 const subjects=C.subjectsFor(data,profile.stage,String(profile.grade),profile.educationType),sp=profile.subjectProgress||{};
 $('subjectProgressList').innerHTML=subjects.length?subjects.map(s=>{
   const p=Math.max(0,Math.min(100,Number(sp[s.id]||0)));
   return '<div class="subject-progress-row"><strong>'+C.esc(s.emoji+' '+s.name)+'</strong><div class="progress"><span style="width:'+p+'%"></span></div><span>'+p+'%</span></div>';
 }).join(''):'<p style="font-size:10px;color:#64748b">لا توجد مواد.</p>';

 const days=[];for(let i=6;i>=0;i--){const d=new Date(Date.now()-i*86400000),key=d.toISOString().slice(0,10);days.push({key,label:d.toLocaleDateString('ar-EG',{weekday:'short'}),minutes:Number(profile.activityDaily?.[key]?.minutes||0)})}
 const max=Math.max(1,...days.map(d=>d.minutes));
 $('activityBars').innerHTML=days.map(d=>'<div class="activity-bar" style="height:'+Math.max(8,Math.round(d.minutes/max*150))+'px"><span>'+d.minutes+'</span><strong>'+C.esc(d.label)+'</strong></div>').join('');

 $('progressQuizHistory').innerHTML=qh.length?qh.slice(0,6).map(x=>'<div class="exam-history-item"><span>'+new Date(x.createdAt||Date.now()).toLocaleDateString('ar-EG')+'</span><strong class="score-pill '+scoreClass(Number(x.score||0))+'">'+Number(x.score||0)+'%</strong></div>').join(''):'<p style="font-size:9px;color:#94a3b8">لا توجد نتائج اختبارات بعد.</p>';
 $('progressSimulationHistory').innerHTML=sh.length?sh.slice(0,6).map(x=>'<div class="exam-history-item"><span>'+C.esc(x.name||'محاكي')+'</span><strong class="score-pill '+scoreClass(Number(x.score||0))+'">'+Number(x.score||0)+'%</strong></div>').join(''):'<p style="font-size:9px;color:#94a3b8">لا توجد نتائج محاكيات بعد.</p>';
}
(async()=>{
 ({user,profile}=await C.requireStudent());$('pageAvatar').textContent=C.initials(profile.name||user.displayName||'طالب');
 const s=await C.db.ref('customSubjects').once('value');data.customSubjects=s.val()||{};render();
})();
})();