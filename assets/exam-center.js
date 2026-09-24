(() => {
'use strict';
const C=window.AcademyCore,$=id=>document.getElementById(id),$$=(s,r=document)=>[...r.querySelectorAll(s)];
let profile,user,data={customSubjects:{},quizzes:{}},filter='all';

function historyItems(){
 const raw=profile.quizHistory||{};
 return Object.entries(raw).map(([id,v])=>({id,...v})).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
}
function scoreClass(v){return v>=80?'good':v>=60?'mid':'low'}
function renderHistory(){
 const h=historyItems();
 $('completedExamCount').textContent=h.length;
 const avg=h.length?Math.round(h.reduce((a,x)=>a+Number(x.score||0),0)/h.length):0;
 $('averageExamScore').textContent=avg+'%';
 $('examHistoryMini').innerHTML=h.length?h.slice(0,5).map(x=>'<div class="exam-history-item"><span>'+new Date(x.createdAt||Date.now()).toLocaleDateString('ar-EG')+'</span><strong class="score-pill '+scoreClass(Number(x.score||0))+'">'+Number(x.score||0)+'%</strong></div>').join(''):'<p style="font-size:9px;color:#94a3b8">لسه مفيش محاولات.</p>';
 $('examHistoryFull').innerHTML=h.length?'<div class="exam-list">'+h.map(x=>'<article class="exam-card"><span class="exam-icon"><i class="fa-solid fa-chart-simple"></i></span><div><h3>محاولة اختبار</h3><p>'+new Date(x.createdAt||Date.now()).toLocaleString('ar-EG')+'</p></div><strong class="score-pill '+scoreClass(Number(x.score||0))+'">'+Number(x.score||0)+'%</strong></article>').join('')+'</div>':'<div class="feature-empty"><span>📝</span><h3>لا يوجد سجل نتائج بعد</h3><p>أكمل أول اختبار وسيظهر هنا.</p></div>';
}
function quizzes(){
 return Object.entries(data.quizzes||{}).map(([id,v])=>({id,...v})).filter(q=>!q.isHidden&&q.type===profile.educationType&&q.stage===profile.stage&&String(q.grade)===String(profile.grade));
}
function renderSubjects(){
 const subs=C.subjectsFor(data,profile.stage,String(profile.grade),profile.educationType);
 $('examSubjectFilter').innerHTML='<option value="">كل المواد</option>'+subs.map(s=>'<option value="'+C.esc(s.id)+'">'+C.esc(s.name)+'</option>').join('');
}
function render(){
 renderHistory();
 $('examStreak').textContent=profile.stats?.streak||0;
 const all=quizzes();$('availableExamCount').textContent=all.length;
 if(filter==='history'){$('examList').classList.add('hidden');$('examHistoryFull').classList.remove('hidden');return}
 $('examHistoryFull').classList.add('hidden');$('examList').classList.remove('hidden');
 const subject=$('examSubjectFilter').value;
 const list=all.filter(q=>(!subject||q.subject===subject)&&(filter==='all'||(filter==='unit'&&Number(q.unit||0)>0)||(filter==='comprehensive'&&Number(q.unit||0)===0)));
 $('examList').innerHTML=list.length?list.map(q=>{
   const ctx={type:q.type,stage:q.stage,grade:q.grade,subject:q.subject};
   const sub=C.subjectName(data,q.subject,q.stage,String(q.grade),q.type);
   return '<article class="exam-card"><span class="exam-icon"><i class="fa-solid fa-file-circle-question"></i></span><div><h3>'+C.esc(q.name||'اختبار')+'</h3><p>'+C.esc(sub)+' • '+(Number(q.unit||0)===0?'اختبار شامل':'الوحدة '+q.unit)+' • '+(q.questions?.length||0)+' سؤال</p></div><a class="btn btn-primary" href="'+C.quizUrl(ctx,q.id)+'">ابدأ الاختبار</a></article>';
 }).join(''):'<div class="feature-empty"><span>📭</span><h3>لا توجد اختبارات في هذا القسم</h3><p>جرّب مادة أخرى أو ارجع لاحقًا.</p></div>';
}
$$('[data-exam-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.examFilter;$$('[data-exam-filter]').forEach(x=>x.classList.toggle('active',x===b));render()});
$('examSubjectFilter').onchange=render;

(async()=>{
 ({user,profile}=await C.requireStudent());
 $('pageAvatar').textContent=C.initials(profile.name||user.displayName||'طالب');
 $('examHeroText').textContent=C.gradeLabel(profile.stage,profile.grade)+' • '+C.typeLabel(profile.educationType)+' — اختبارات مناسبة لمرحلتك.';
 const [s,q]=await Promise.all([
   C.db.ref('customSubjects').once('value'),
   C.db.ref('quizzes').orderByChild('stage').equalTo(profile.stage).once('value')
 ]);
 data={customSubjects:s.val()||{},quizzes:q.val()||{}};renderSubjects();render();
})();
})();