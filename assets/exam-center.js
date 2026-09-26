(() => {
'use strict';
const C=window.AcademyCore,$=id=>document.getElementById(id),$$=(s,r=document)=>[...r.querySelectorAll(s)];
let profile,user,data={customSubjects:{},quizzes:{},lessons:{}},filter='all';

function historyItems(){
 const raw=profile.quizHistory||{};
 return Object.entries(raw).map(([id,v])=>({id,...v})).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
}
function scoreClass(v){return v>=80?'good':v>=60?'mid':'low'}
function attemptsFor(sourceId){return historyItems().filter(x=>x.sourceId===sourceId)}
function bestAttempt(sourceId){
 const rows=attemptsFor(sourceId);
 return rows.length?rows.reduce((best,x)=>Number(x.score||0)>Number(best.score||0)?x:best,rows[0]):null;
}
function lessonDone(id){return !!profile.learningProgress?.[id]?.completed}
function relevantLessons(subject){
 return Object.entries(data.lessons||{}).map(([id,v])=>({id,...v})).filter(l=>
   !l.isHidden&&l.subject===subject&&l.type===profile.educationType&&l.stage===profile.stage&&String(l.grade)===String(profile.grade)
 );
}
function quizUnlockInfo(q){
 const lessons=relevantLessons(q.subject),unit=Number(q.unit||0);
 if(q.lessonId){const related=lessons.find(lesson=>lesson.id===q.lessonId);return {unlocked:!!related&&lessonDone(q.lessonId),complete:related&&lessonDone(q.lessonId)?1:0,total:1,reason:'أكمل الدرس المرتبط لفتح الاختبار'};}
 const required=unit===0?lessons:lessons.filter(l=>Number(l.unit||1)===unit);
 const complete=required.filter(l=>lessonDone(l.id)).length;
 const unlocked=!required.length||complete===required.length;
 return {
   unlocked,
   complete,
   total:required.length,
   reason:unit===0?'أكمل جميع دروس المادة لفتح الاختبار الشامل':'أكمل دروس الوحدة لفتح الاختبار'
 };
}
function retakeHref(item){
 const q=data.quizzes?.[item.sourceId];
 if(q){
   const ctx={type:q.type||profile.educationType,stage:q.stage||profile.stage,grade:q.grade||profile.grade,subject:q.subject||item.subject||''};
   return C.quizUrl(ctx,item.sourceId);
 }
 const l=data.lessons?.[item.sourceId];
 if(l){
   const ctx={type:l.type||profile.educationType,stage:l.stage||profile.stage,grade:l.grade||profile.grade,subject:l.subject||item.subject||''};
   return C.lessonUrl(ctx,item.sourceId);
 }
 return '';
}
function historyTitle(x){
 if(x.title&&x.title!=='اختبار')return x.title;
 return data.quizzes?.[x.sourceId]?.name||data.lessons?.[x.sourceId]?.title||'محاولة اختبار';
}
function historySubject(x){
 const subject=x.subject||data.quizzes?.[x.sourceId]?.subject||data.lessons?.[x.sourceId]?.subject||'';
 return C.subjectName(data,subject,profile.stage,String(profile.grade),profile.educationType);
}
function renderHistory(){
 const h=historyItems();
 $('completedExamCount').textContent=h.length;
 const avg=h.length?Math.round(h.reduce((a,x)=>a+Number(x.score||0),0)/h.length):0;
 $('averageExamScore').textContent=avg+'%';

 $('examHistoryMini').innerHTML=h.length?h.slice(0,5).map(x=>
   '<div class="exam-history-item"><div><strong>'+C.esc(historyTitle(x))+'</strong><span>'+new Date(x.createdAt||Date.now()).toLocaleDateString('ar-EG')+'</span></div><strong class="score-pill '+scoreClass(Number(x.score||0))+'">'+Number(x.score||0)+'%</strong></div>'
 ).join(''):'<div class="exam-mini-empty"><span>📝</span><p>لسه مفيش محاولات.</p></div>';

 $('examHistoryFull').innerHTML=h.length?'<div class="exam-history-grid">'+h.map(x=>{
   const href=retakeHref(x),sub=historySubject(x),score=Number(x.score||0);
   return '<article class="exam-history-card">'+
     '<div class="exam-history-card-head"><span class="exam-icon history"><i class="fa-solid fa-chart-simple"></i></span><strong class="score-pill '+scoreClass(score)+'">'+score+'%</strong></div>'+
     '<h3>'+C.esc(historyTitle(x))+'</h3>'+
     '<p>'+C.esc(sub)+' • '+new Date(x.createdAt||Date.now()).toLocaleString('ar-EG')+'</p>'+
     '<div class="exam-history-meta"><span><i class="fa-solid fa-check"></i> '+Number(x.correct||0)+' صحيحة</span><span><i class="fa-solid fa-list"></i> '+Number(x.total||0)+' سؤال</span></div>'+
     (href?'<a class="btn btn-soft btn-block" href="'+href+'"><i class="fa-solid fa-rotate-right"></i> إعادة المحاولة</a>':'')+
   '</article>';
 }).join('')+'</div>':'<div class="feature-empty"><span>📝</span><h3>لا يوجد سجل نتائج بعد</h3><p>أكمل أول اختبار وسيظهر هنا.</p></div>';
}
function quizzes(){
 return Object.entries(data.quizzes||{}).map(([id,v])=>({id,...v})).filter(q=>
   !q.isHidden&&q.type===profile.educationType&&q.stage===profile.stage&&String(q.grade)===String(profile.grade)
 );
}
function renderSubjects(){
 const subs=C.subjectsFor(data,profile.stage,String(profile.grade),profile.educationType);
 $('examSubjectFilter').innerHTML='<option value="">كل المواد</option>'+subs.map(s=>'<option value="'+C.esc(s.id)+'">'+C.esc(s.name)+'</option>').join('');
}
function render(){
 renderHistory();
 $('examStreak').textContent=profile.stats?.streak||0;
 const all=quizzes(),available=all.filter(q=>quizUnlockInfo(q).unlocked);
 $('availableExamCount').textContent=available.length;

 if(filter==='history'){
   $('examList').classList.add('hidden');$('examHistoryFull').classList.remove('hidden');
   $('examResultCount').textContent=historyItems().length+' محاولة';
   $('examListHint').textContent='راجع نتائجك وأعد الاختبارات التي تحتاج تحسينًا.';
   return;
 }
 $('examHistoryFull').classList.add('hidden');$('examList').classList.remove('hidden');

 const subject=$('examSubjectFilter').value,search=($('examSearchInput')?.value||'').trim().toLowerCase();
 const list=all.filter(q=>{
   const sub=C.subjectName(data,q.subject,q.stage,String(q.grade),q.type);
   const matchesSubject=!subject||q.subject===subject;
   const matchesType=filter==='all'||(filter==='unit'&&Number(q.unit||0)>0)||(filter==='comprehensive'&&Number(q.unit||0)===0);
   const matchesSearch=!search||(q.name||'اختبار').toLowerCase().includes(search)||sub.toLowerCase().includes(search);
   return matchesSubject&&matchesType&&matchesSearch;
 });
 $('examResultCount').textContent=list.length+' اختبار';
 $('examListHint').textContent=list.length?'اختر اختبارًا مناسبًا وابدأ عندما تكون جاهزًا.':'غيّر الفلاتر أو ابحث باسم مادة أخرى.';

 $('examList').innerHTML=list.length?list.map(q=>{
   const ctx={type:q.type,stage:q.stage,grade:q.grade,subject:q.subject};
   const sub=C.subjectName(data,q.subject,q.stage,String(q.grade),q.type);
   const unlock=quizUnlockInfo(q),best=bestAttempt(q.id),unit=Number(q.unit||0),questions=q.questions?.length||0;
   const kind=unit===0?'اختبار شامل':'اختبار الوحدة '+unit;
   const status=unlock.unlocked?(best?'تمت المحاولة':'جاهز الآن'):'مغلق';
   return '<article class="exam-card '+(unlock.unlocked?'available':'locked')+'">'+
     '<div class="exam-card-main"><span class="exam-icon '+(unlock.unlocked?'':'locked')+'"><i class="fa-solid '+(unlock.unlocked?'fa-file-circle-question':'fa-lock')+'"></i></span>'+
     '<div class="exam-card-copy"><div class="exam-card-title-row"><h3>'+C.esc(q.name||'اختبار')+'</h3><span class="exam-status '+(unlock.unlocked?(best?'attempted':'ready'):'locked')+'">'+status+'</span></div>'+
     '<p>'+C.esc(sub)+' • '+kind+'</p>'+
     '<div class="exam-meta"><span><i class="fa-regular fa-circle-question"></i> '+questions+' سؤال</span>'+
     (unlock.total?'<span><i class="fa-solid fa-book-open"></i> '+unlock.complete+'/'+unlock.total+' دروس مكتملة</span>':'')+
     (best?'<span><i class="fa-solid fa-trophy"></i> أفضل نتيجة '+Number(best.score||0)+'%</span>':'')+
     '</div></div></div>'+
     '<div class="exam-card-action">'+
     (unlock.unlocked
       ?'<a class="btn btn-primary" href="'+C.quizUrl(ctx,q.id)+'">'+(best?'إعادة الاختبار':'ابدأ الاختبار')+' <i class="fa-solid fa-arrow-left"></i></a>'
       :'<button class="btn btn-soft locked-exam-btn" data-locked-exam="'+q.id+'" data-lock-reason="'+C.esc(unlock.reason)+'"><i class="fa-solid fa-lock"></i> مغلق</button>')+
     '</div></article>';
 }).join(''):'<div class="feature-empty"><span>📭</span><h3>لا توجد اختبارات مطابقة</h3><p>جرّب مادة أخرى أو غيّر عبارة البحث.</p></div>';

 $$('[data-locked-exam]').forEach(btn=>btn.onclick=()=>C.toast(btn.dataset.lockReason||'أكمل الدروس المطلوبة أولًا.','error'));
}
$$('[data-exam-filter]').forEach(b=>b.onclick=()=>{
 filter=b.dataset.examFilter;
 $$('[data-exam-filter]').forEach(x=>{const active=x===b;x.classList.toggle('active',active);x.setAttribute('aria-selected',active?'true':'false')});
 render();
});
$('examSubjectFilter').onchange=render;
$('examSearchInput')?.addEventListener('input',render);

(async()=>{
 window.AcademyUI?.showPageLoading('جاري تجهيز اختباراتك...');
 try{
   ({user,profile}=await C.requireStudent());
   $('pageAvatar').textContent=C.initials(profile.name||user.displayName||'طالب');
   $('examHeroText').textContent=C.gradeLabel(profile.stage,profile.grade)+' • '+C.typeLabel(profile.educationType)+' — اختبارات مناسبة لمرحلتك.';
   const [s,q,l]=await Promise.all([
     C.db.ref('customSubjects').once('value'),
     C.db.ref('quizzes').orderByChild('stage').equalTo(profile.stage).once('value'),
     C.db.ref('lessons').orderByChild('stage').equalTo(profile.stage).once('value')
   ]);
   data={customSubjects:s.val()||{},quizzes:q.val()||{},lessons:l.val()||{}};
   renderSubjects();render();
 }catch(err){
   console.error(err);
   C.toast('تعذر تحميل مركز الاختبارات الآن.','error');
   $('examList').innerHTML='<div class="feature-empty"><span>⚠️</span><h3>تعذر تحميل الاختبارات</h3><p>تحقق من الاتصال وحاول تحديث الصفحة.</p></div>';
 }finally{
   window.AcademyUI?.hidePageLoading();
 }
})();
})();
