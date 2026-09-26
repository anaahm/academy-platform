(()=>{'use strict';
const P=window.AcademyPro,$=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function assignmentsOf(t){return Array.isArray(t?.assignments)?t.assignments:Object.values(t?.assignments||{})}
function inScope(lesson,scope){
 if(!scope)return false;const s=typeof scope==='string'?{subject:scope}:scope;
 return (!s.type||s.type===lesson.type)&&(!s.stage||s.stage===lesson.stage)&&(!s.grade||String(s.grade)===String(lesson.grade))&&(!s.subject||s.subject===lesson.subject);
}
async function load(){
 const role=await P.roleOf(),uid=P.auth.currentUser?.uid;
 if(!['teacher','assistant_teacher','subject_supervisor','admin'].includes(role)){location.href='./index.html';return}
 const [statsSnap,bankSnap,analyticsSnap,lessonSnap,ratingSnap,teacherSnap]=await Promise.all([
  P.db.ref(P.paths.questionStats).once('value'),
  P.db.ref(P.paths.bank).once('value'),
  P.db.ref('contentAnalytics').once('value'),
  P.db.ref('lessons').once('value'),
  P.db.ref(P.paths.ratings).once('value'),
  uid?P.db.ref('teacherProfiles/'+uid).once('value'):Promise.resolve({val:()=>({})})
 ]);
 const stats=statsSnap.val()||{},bank=bankSnap.val()||{},contentAnalytics=analyticsSnap.val()||{},allLessons=lessonSnap.val()||{},ratings=ratingSnap.val()||{},teacher=teacherSnap.val?.()||{};
 let lessons={};
 if(role==='admin')lessons=allLessons;
 else if(role==='subject_supervisor'){
  const scopes=assignmentsOf(teacher);
  Object.entries(allLessons).forEach(([id,l])=>{if(scopes.some(s=>inScope(l,s)))lessons[id]=l});
 }else{
  Object.entries(allLessons).forEach(([id,l])=>{if(l?.teacherId===uid)lessons[id]=l});
 }
 const lessonIds=new Set(Object.keys(lessons));
 const rows=Object.entries(stats).map(([id,v])=>({id,...v,q:bank[id]})).filter(x=>
  role==='admin'||x.q?.authorUid===uid||x.q?.teacherId===uid||lessonIds.has(x.q?.lessonId)
 ).sort((a,b)=>(b.difficultyIndex||0)-(a.difficultyIndex||0));
 $('stats').innerHTML=rows.length?rows.slice(0,60).map(x=>
  '<div class="pro-item"><div class="pro-space"><div><strong>'+esc((x.q&&(x.q.question||x.q.text))||x.id)+'</strong><div class="pro-muted">'+esc((x.q&&x.q.subject)||'')+' • '+(x.attempts||0)+' محاولة</div></div><span class="pro-badge '+((x.difficultyIndex||0)>=60?'bad':(x.difficultyIndex||0)>=35?'warn':'ok')+'">'+(x.difficultyIndex||0)+'% أخطأوا</span></div></div>'
 ).join(''):'<div class="pro-empty">لا توجد بيانات محاولات بعد.</div>';
 const heat=Object.keys(lessons).map(id=>{const v=contentAnalytics[id]||{};return{id,title:lessons[id]?.title||'درس',subject:lessons[id]?.subject||'',attempts:Number(v.quizAttempts||0),average:Number(v.quizAverage||0),completions:Number(v.completions||0),views:Number(v.views||0)}}).filter(x=>x.attempts||x.completions||x.views).sort((a,b)=>(a.average||0)-(b.average||0));
 $('heatmap').innerHTML=heat.length?'<div class="pro-heatmap">'+heat.map(x=>
  '<div class="pro-heat-cell '+((x.average||0)>=80?'hot-good':(x.average||0)>=60?'hot-mid':'hot-low')+'" title="'+esc(x.title)+'"><strong>'+esc(x.title)+'</strong><span>'+(x.average||0)+'%</span><small>'+(x.attempts||0)+' محاولة • '+x.views+' مشاهدة</small></div>'
 ).join('')+'</div>':'<div class="pro-empty">تظهر الخريطة بعد بدء الطلاب في حل تدريبات الدروس.</div>';
 const rated=Object.keys(lessons).map(id=>{const vals=Object.values(ratings[id]||{}).map(x=>Number(x.value||0)).filter(Boolean);return{id,title:lessons[id]?.title||'درس',vals,avg:vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0}}).filter(x=>x.vals.length).sort((a,b)=>a.avg-b.avg);
 $('ratings').innerHTML=rated.length?rated.map(x=>{const yes=x.vals.filter(v=>v===3).length,partial=x.vals.filter(v=>v===2).length,no=x.vals.filter(v=>v===1).length;return '<div class="pro-item"><div class="pro-space"><strong>'+esc(x.title)+'</strong><span class="pro-badge '+(x.avg>=2.5?'ok':x.avg>=1.8?'warn':'bad')+'">'+Math.round(x.avg/3*100)+'% وضوح</span></div><div class="pro-muted">فهمت: '+yes+' • إلى حد ما: '+partial+' • يحتاج شرحًا: '+no+'</div></div>'}).join(''):'<div class="pro-empty">لا توجد تقييمات طلاب حتى الآن.</div>';
 const avg=heat.length?Math.round(heat.reduce((n,x)=>n+Number(x.average||0),0)/heat.length):0,attempts=heat.reduce((n,x)=>n+Number(x.attempts||0),0),needs=heat.filter(x=>Number(x.average||0)<60).length;
 $('teacherSummary').innerHTML='<div class="pro-item"><strong>'+avg+'%</strong><div class="pro-muted">متوسط أداء الدروس</div></div><div class="pro-item"><strong>'+attempts+'</strong><div class="pro-muted">محاولات مسجلة</div></div><div class="pro-item"><strong>'+needs+'</strong><div class="pro-muted">دروس تحتاج دعمًا</div></div><div class="pro-item"><strong>'+Object.keys(lessons).length+'</strong><div class="pro-muted">'+(role==='subject_supervisor'?'دروس ضمن نطاق الإشراف':'دروس ضمن نطاقك')+'</div></div>';
}
$('refresh').onclick=load;if($('refreshQuestions'))$('refreshQuestions').onclick=load;
$('importBtn').onclick=async()=>{try{const arr=JSON.parse($('bulk').value);if(!Array.isArray(arr))throw 0;const ids=await P.bulkAddQuestions(arr);alert('تم إرسال '+ids.length+' سؤال بنجاح');$('bulk').value='';load()}catch(e){console.error(e);alert('تأكد أن المحتوى JSON Array صحيح وأن حسابك يملك صلاحية بنك الأسئلة.')}};
P.auth.onAuthStateChanged(u=>u?load():location.href='./teacher.html');
})();