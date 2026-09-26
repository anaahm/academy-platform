(function smartReport(){
'use strict';
if(!window.firebase)return;
const app=firebase.apps[0],auth=app.auth(),db=app.database(),$=id=>document.getElementById(id),esc=(v='')=>String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function statusLabel(s){return s==='mastered'?'متقن':s==='learning'?'قيد التعلم':s==='review'?'يحتاج مراجعة':'لم يبدأ'}
function statusClass(s){return s==='mastered'?'mastered':s==='learning'?'learning':s==='review'?'review':'new'}
auth.onAuthStateChanged(async user=>{
 if(!user){location.replace('./index.html');return}
 try{
  const [p,l]=await Promise.all([db.ref('studentProfilesV3/'+user.uid).once('value'),db.ref('lessons').once('value')]),profile=p.val()||{},lessons=l.val()||{},mastery=profile.mastery||{};
  const bySubject={};Object.values(mastery).forEach(m=>{const s=m.subject||'غير مصنف';bySubject[s]=bySubject[s]||{total:0,count:0,errors:0,mastered:0};bySubject[s].total+=Number(m.score||0);bySubject[s].count++;bySubject[s].errors+=Number(m.mistakes||0);bySubject[s].mastered+=m.status==='mastered'?1:0});
  const subjects=Object.entries(bySubject).map(([name,x])=>({name,avg:x.count?Math.round(x.total/x.count):0,...x})).sort((a,b)=>b.avg-a.avg),best=subjects[0],weak=[...subjects].sort((a,b)=>a.avg-b.avg)[0];
  const due=Object.values(profile.reviewQueue||{}).filter(x=>Number(x.nextReviewAt||0)<=Date.now()).length,history=Object.values(profile.quizHistory||{}),avg=history.length?Math.round(history.reduce((n,x)=>n+Number(x.score||0),0)/history.length):0;
  const diag=Object.values(profile.diagnostics||{}).sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0))[0],skills=Object.entries(profile.skillRemediation||{}).filter(([,x])=>x?.active!==false).sort((a,b)=>Number(a[1].score||0)-Number(b[1].score||0));
  $('smartReportKpis').innerHTML='<article class="pro-kpi"><strong>'+avg+'%</strong><span>متوسط اختباراتك</span></article><article class="pro-kpi"><strong>'+Object.values(mastery).filter(x=>x.status==='mastered').length+'</strong><span>دروس متقنة</span></article><article class="pro-kpi"><strong>'+due+'</strong><span>مراجعات مستحقة</span></article><article class="pro-kpi"><strong>'+(diag?Number(diag.score||0)+'%':'—')+'</strong><span>آخر تحديد مستوى</span></article>';
  $('smartReportSubjects').innerHTML=subjects.length?subjects.map(x=>'<div class="pro-list-item"><div><h4>'+esc(x.name)+'</h4><p>'+x.mastered+' درس متقن • '+x.errors+' خطأ معلق</p></div><span class="pro-mastery-pill '+(x.avg>=85?'mastered':x.avg>=60?'learning':'review')+'">'+x.avg+'%</span></div>').join(''):'<div class="pro-empty">ابدأ الدروس والاختبارات ليظهر تحليل المواد.</div>';
  let recommendation={title:'ابدأ بخطوتك التالية',text:'اختر مادة وابدأ أول درس.',href:'./index.html'};
  if(due)recommendation={title:'راجع أخطاءك أولًا',text:'لديك '+due+' سؤالًا مستحقًا للمراجعة الآن.',href:'./review-center.html'};
  else if(weak&&weak.avg<60)recommendation={title:'ركز على '+weak.name,text:'متوسط الإتقان الحالي '+weak.avg+'%، وهذه المادة تحتاج تثبيتًا قبل التوسع.',href:'./index.html'};
  else if(!diag)recommendation={title:'اعرف مستواك بدقة',text:'لم تسجل اختبار تحديد مستوى حتى الآن.',href:'./smart-assessment.html'};
  $('smartReportRecommendation').innerHTML='<div class="pro-suite-card"><span class="pro-icon"><i class="fa-solid fa-route"></i></span><h3>'+esc(recommendation.title)+'</h3><p>'+esc(recommendation.text)+'</p><a href="'+recommendation.href+'">ابدأ الآن</a></div>';
  $('smartReportSkills').innerHTML=skills.length?skills.slice(0,8).map(([name,x])=>'<div class="pro-list-item"><div><h4>'+esc(name)+'</h4><p>'+esc(x.subject||'')+'</p></div><span class="pro-badge pending">'+Number(x.score||0)+'%</span></div>').join(''):'<div class="pro-empty">لا توجد مهارات علاجية نشطة حاليًا.</div>';
  const items=Object.values(mastery).map(m=>({...(lessons[m.lessonId]||{}),...m})).sort((a,b)=>Number(a.unit||0)-Number(b.unit||0)||Number(a.score||0)-Number(b.score||0));
  $('smartReportLessons').innerHTML=items.length?items.map(x=>'<div class="pro-list-item"><div><h4>'+esc(x.title||'درس')+'</h4><p>'+esc(x.subject||'')+' • '+Number(x.quizScore||0)+'% في التدريب • '+Number(x.mistakes||0)+' أخطاء</p></div><span class="pro-mastery-pill '+statusClass(x.status)+'">'+statusLabel(x.status)+' • '+Number(x.score||0)+'%</span></div>').join(''):'<div class="pro-empty">لا توجد بيانات إتقان بعد.</div>';
  if($('smartReportBest'))$('smartReportBest').textContent=best?best.name+' ('+best.avg+'%)':'—';
 }catch(err){console.error(err);document.body.insertAdjacentHTML('beforeend','<div class="pro-empty">تعذر تحميل التقرير الذكي الآن.</div>')}
});
})();