(() => {
'use strict';
const C=window.AcademyCore,$=id=>document.getElementById(id);
let user,profile,data={customSubjects:{}};

function localDateKey(d=new Date()){
 const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
 return y+'-'+m+'-'+day;
}
function quizHistory(){return Object.values(profile.quizHistory||{}).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))}
function simHistory(){return Object.values(profile.simulationHistory||{}).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))}
function scoreClass(v){return v>=80?'good':v>=60?'mid':'low'}
function subjectHref(id){
 return './subject.html?'+new URLSearchParams({type:profile.educationType,stage:profile.stage,grade:String(profile.grade),subject:id});
}
function historyTitle(x,fallback){return x.title||x.name||fallback}
function render(){
 const stats=profile.stats||{},qh=quizHistory(),sh=simHistory();
 $('progressLessons').textContent=stats.completedLessons||0;
 $('progressAverage').textContent=(qh.length?Math.round(qh.reduce((a,x)=>a+Number(x.score||0),0)/qh.length):0)+'%';
 $('progressMinutes').textContent=stats.studyMinutes||0;
 $('progressStreak').textContent=stats.streak||0;

 const subjects=C.subjectsFor(data,profile.stage,String(profile.grade),profile.educationType);
 $('subjectProgressList').innerHTML=subjects.length?subjects.map(s=>{
   const p=Math.max(0,Math.min(100,C.subjectProgressValue(profile,s.id)));
   return '<a class="subject-progress-row" href="'+subjectHref(s.id)+'" aria-label="'+C.esc(s.name)+'، تقدم '+p+' بالمئة">'+
     '<strong>'+C.esc((s.emoji||'📚')+' '+s.name)+'</strong>'+
     '<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+p+'"><span style="width:'+p+'%"></span></div>'+
     '<span>'+p+'%</span><i class="fa-solid fa-arrow-left progress-row-arrow"></i></a>';
 }).join(''):'<div class="feature-empty compact"><span>📚</span><h3>لا توجد مواد بعد</h3><p>ستظهر مواد مرحلتك هنا تلقائيًا.</p></div>';

 const days=[];
 for(let i=6;i>=0;i--){
   const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-i);
   const key=localDateKey(d);
   days.push({key,label:d.toLocaleDateString('ar-EG',{weekday:'short'}),minutes:Number(profile.activityDaily?.[key]?.minutes||0)});
 }
 const max=Math.max(1,...days.map(d=>d.minutes));
 $('activityBars').innerHTML=days.map(d=>{
   const height=Math.max(8,Math.round(d.minutes/max*150));
   return '<div class="activity-bar" style="height:'+height+'px" title="'+d.minutes+' دقيقة"><span>'+d.minutes+'</span><strong>'+C.esc(d.label)+'</strong></div>';
 }).join('');

 $('progressQuizHistory').innerHTML=qh.length?qh.slice(0,6).map(x=>
   '<div class="exam-history-item"><div><strong>'+C.esc(historyTitle(x,'اختبار'))+'</strong><span>'+new Date(x.createdAt||Date.now()).toLocaleDateString('ar-EG')+'</span></div><strong class="score-pill '+scoreClass(Number(x.score||0))+'">'+Number(x.score||0)+'%</strong></div>'
 ).join(''):'<div class="feature-empty compact"><span>🎯</span><h3>لا توجد نتائج بعد</h3><p>أكمل أول اختبار وسيظهر هنا.</p></div>';

 $('progressSimulationHistory').innerHTML=sh.length?sh.slice(0,6).map(x=>
   '<div class="exam-history-item"><div><strong>'+C.esc(historyTitle(x,'محاكي'))+'</strong><span>'+new Date(x.createdAt||Date.now()).toLocaleDateString('ar-EG')+'</span></div><strong class="score-pill '+scoreClass(Number(x.score||0))+'">'+Number(x.score||0)+'%</strong></div>'
 ).join(''):'<div class="feature-empty compact"><span>🧪</span><h3>لا توجد محاكيات مكتملة</h3><p>جرّب أول محاكي وسيظهر مستواك هنا.</p></div>';
}

(async()=>{
 window.AcademyUI?.showPageLoading('جاري تحليل تقدمك...');
 try{
   ({user,profile}=await C.requireStudent());
   $('pageAvatar').textContent=C.initials(profile.name||user.displayName||'طالب');
   const s=await C.db.ref('customSubjects').once('value');
   data.customSubjects=s.val()||{};
   render();
 }catch(err){
   console.error(err);C.toast('تعذر تحميل التقدم الآن.','error');
   $('subjectProgressList').innerHTML=window.AcademyUI?.errorStateHtml('تعذر تحميل التقدم','تحقق من الاتصال ثم حاول مرة أخرى.','<button class="btn btn-primary" onclick="location.reload()">إعادة المحاولة</button>')||'';
 }finally{window.AcademyUI?.hidePageLoading()}
})();
})();