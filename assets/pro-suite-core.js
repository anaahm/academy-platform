(function academyProCore(){
'use strict';
if(!window.firebase) return;
const app=firebase.apps[0]||firebase.initializeApp(window.ACADEMY_FIREBASE_CONFIG);
const auth=app.auth(),db=app.database(),$=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const DAY=86400000,reviewIntervals=[1,3,7,14,30];
const esc=(v='')=>String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let user=null,profile=null,lessons={},quizzes={},syncing=false;
function bestScores(history={}){
 const out={};Object.values(history||{}).forEach(x=>{if(x?.sourceId)out[x.sourceId]=Math.max(Number(out[x.sourceId]||0),Number(x.score||0))});return out;
}
function masteryForLesson(id,lesson,p,best){
 const completed=!!p?.progress?.lessons?.[id]?.completedAt,practiced=best[id]!==undefined,score=Number(best[id]||0),errors=Object.keys(p?.mistakeNotebook?.[id]||{}).length;
 let points=(completed?40:0)+(practiced?Math.round(Math.min(100,score)*.5):0)+(practiced&&errors===0?10:0);points=Math.min(100,points);
 let status='new';if(points>=85&&errors===0)status='mastered';else if(points>=60)status='learning';else if(completed||practiced||errors)status='review';
 return {lessonId:id,subject:lesson?.subject||'',unit:Number(lesson?.unit||0),score:points,status,quizScore:score,mistakes:errors,completed,practiced,updatedAt:Date.now()};
}
function deriveMastery(p){
 const best=bestScores(p?.quizHistory||{}),result={};
 Object.entries(lessons||{}).forEach(([id,l])=>{
  if(!l||l.isHidden)return;if(p?.educationType&&l.type&&l.type!==p.educationType)return;if(p?.stage&&l.stage&&l.stage!==p.stage)return;if(p?.grade&&l.grade!=null&&String(l.grade)!==String(p.grade))return;
  result[id]=masteryForLesson(id,l,p,best);
 });return result;
}
function ensureReviewQueue(p){
 const old={...(p?.reviewQueue||{})},notebook=p?.mistakeNotebook||{},seen=new Set();
 Object.entries(notebook).forEach(([sourceId,items])=>Object.entries(items||{}).forEach(([questionKey,m])=>{
  const key=sourceId+'__'+questionKey;seen.add(key);const prev=old[key]||{};
  old[key]={key,sourceId,questionKey,text:m?.text||'',opts:Array.isArray(m?.opts)?m.opts:[],correctAnswer:Number(m?.correctAnswer||0),chosen:Number.isFinite(Number(m?.chosen))?Number(m.chosen):null,explanation:m?.explanation||'',skill:m?.skill||'',subject:m?.subject||'',type:m?.type||p?.educationType||'',stage:m?.stage||p?.stage||'',grade:String(m?.grade||p?.grade||''),intervalIndex:Number(prev.intervalIndex||0),correctStreak:Number(prev.correctStreak||0),nextReviewAt:Number(prev.nextReviewAt||Date.now()),lastReviewedAt:Number(prev.lastReviewedAt||0),createdAt:Number(prev.createdAt||m?.updatedAt||Date.now()),updatedAt:Date.now()};
 }));
 Object.keys(old).forEach(k=>{if(!seen.has(k))delete old[k]});return old;
}
function subjectSummary(p,mastery){
 const map={};Object.values(mastery).forEach(m=>{const s=m.subject||'unknown';map[s]=map[s]||{lessons:0,mastered:0,totalMastery:0,errors:0};map[s].lessons++;map[s].mastered+=m.status==='mastered'?1:0;map[s].totalMastery+=Number(m.score||0);map[s].errors+=Number(m.mistakes||0)});
 Object.values(map).forEach(x=>{x.mastery=x.lessons?Math.round(x.totalMastery/x.lessons):0;delete x.totalMastery});return map;
}
function currentWeekStart(){const d=new Date(),day=(d.getDay()+6)%7;d.setHours(0,0,0,0);d.setDate(d.getDate()-day);return d.getTime()}
function weeklyComparison(p){
 const history=Object.values(p?.quizHistory||{}),start=currentWeekStart(),prev=start-7*DAY,thisWeek=history.filter(x=>Number(x.createdAt||0)>=start),prevWeek=history.filter(x=>Number(x.createdAt||0)>=prev&&Number(x.createdAt||0)<start),avg=a=>a.length?Math.round(a.reduce((s,x)=>s+Number(x.score||0),0)/a.length):0,now=avg(thisWeek),before=avg(prevWeek);
 return {current:now,previous:before,delta:now-before,count:thisWeek.length};
}
function makeAlerts(p,summaries){
 const alerts=[],now=Date.now(),last=Number(p?.lastActiveAt||0);if(last&&now-last>5*DAY)alerts.push({type:'inactive',text:'لم يحدث نشاط دراسي منذ أكثر من 5 أيام.'});
 const weak=Object.entries(summaries).filter(([,x])=>x.mastery<60).sort((a,b)=>a[1].mastery-b[1].mastery)[0];if(weak)alerts.push({type:'weak',subject:weak[0],text:'يوجد احتياج لمراجعة مادة ذات إتقان أقل من 60%.'});
 const due=Object.values(p?.reviewQueue||{}).filter(x=>Number(x.nextReviewAt||0)<=now).length;if(due)alerts.push({type:'review',text:'لدى الطالب '+due+' سؤالًا مستحقًا للمراجعة.'});return alerts.slice(0,5);
}
function randomCode(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let out='';for(let i=0;i<8;i++)out+=chars[Math.floor(Math.random()*chars.length)];return out}
async function ensureParentCode(){
 if(!user||!profile)return'';if(profile.parentCode)return profile.parentCode;
 for(let i=0;i<5;i++){const code=randomCode(),snap=await db.ref('parentSnapshots/'+code).once('value');if(!snap.exists()){await db.ref('studentProfilesV3/'+user.uid+'/parentCode').set(code);profile.parentCode=code;return code}}
 throw Error('تعذر إنشاء كود ولي الأمر الآن');
}
async function syncDerived(){
 if(!user||!profile||syncing)return;syncing=true;
 try{
  const mastery=deriveMastery(profile),reviewQueue=ensureReviewQueue(profile),summaries=subjectSummary(profile,mastery),comparison=weeklyComparison(profile);
  const patch={['studentProfilesV3/'+user.uid+'/mastery']:mastery,['studentProfilesV3/'+user.uid+'/reviewQueue']:reviewQueue,['learningMatrix/'+user.uid]:{name:profile.name||'طالب',educationType:profile.educationType||'public',stage:profile.stage||'',grade:String(profile.grade||''),subjects:summaries,weekly:comparison,updatedAt:Date.now()}};
  if(profile.parentCode)patch['parentSnapshots/'+profile.parentCode]={ownerUid:user.uid,studentName:profile.name||'طالب',educationType:profile.educationType||'public',stage:profile.stage||'',grade:String(profile.grade||''),stats:{completedLessons:Number(profile.stats?.completedLessons||0),completedQuizzes:Number(profile.stats?.completedQuizzes||0),totalXP:Number(profile.stats?.totalXP||0),level:Number(profile.stats?.level||1),streak:Number(profile.stats?.streak||profile.streak||0)},subjects:summaries,weekly:comparison,alerts:makeAlerts({...profile,reviewQueue},summaries),updatedAt:Date.now()};
  await db.ref().update(patch);profile.mastery=mastery;profile.reviewQueue=reviewQueue;window.dispatchEvent(new CustomEvent('academy:pro-synced',{detail:{mastery,reviewQueue,summaries,comparison}}));
 }catch(err){console.warn('Pro suite sync deferred',err)}finally{syncing=false}
}
function masteryLabel(status){return status==='mastered'?'متقن':status==='learning'?'قيد التعلم':status==='review'?'يحتاج مراجعة':'لم يبدأ'}
function smartNext(){
 const mastery=profile?.mastery||deriveMastery(profile||{}),arr=Object.values(mastery),due=Object.values(profile?.reviewQueue||{}).filter(x=>Number(x.nextReviewAt||0)<=Date.now());
 if(due.length)return{title:'مراجعة ذكية مستحقة',text:'لديك '+due.length+' سؤالًا من أخطائك جاهزًا للمراجعة.',href:'./review-center.html',icon:'fa-rotate'};
 const remedial=arr.filter(x=>x.status==='review').sort((a,b)=>a.score-b.score)[0];
 if(remedial){const l=lessons[remedial.lessonId]||{},q=new URLSearchParams({type:l.type||profile.educationType||'public',stage:l.stage||profile.stage||'',grade:String(l.grade||profile.grade||''),subject:l.subject||'',id:remedial.lessonId});return{title:'راجع: '+(l.title||'درس يحتاج مراجعة'),text:'إتقانك الحالي '+remedial.score+'%، ويفضل تثبيت هذا الدرس أولًا.',href:'./lesson.html?'+q,icon:'fa-book-open-reader'}}
 const next=arr.filter(x=>x.status!=='mastered').sort((a,b)=>a.unit-b.unit||a.score-b.score)[0];
 if(next){const l=lessons[next.lessonId]||{},q=new URLSearchParams({type:l.type||profile.educationType||'public',stage:l.stage||profile.stage||'',grade:String(l.grade||profile.grade||''),subject:l.subject||'',id:next.lessonId});return{title:l.title||'الدرس التالي',text:'هذه أنسب خطوة تالية في مسارك الحالي.',href:'./lesson.html?'+q,icon:'fa-route'}}
 return{title:'أحسنت! حافظ على الإتقان',text:'لا توجد مهام علاجية الآن. جرّب اختبار تحديد المستوى أو راجع موادك.',href:'./smart-assessment.html',icon:'fa-medal'};
}
function injectDashboard(){
 const anchor=$('.ref-stats-grid');if(!anchor||$('#proLearningHub'))return;
 const due=Object.values(profile?.reviewQueue||{}).filter(x=>Number(x.nextReviewAt||0)<=Date.now()).length,masteries=Object.values(profile?.mastery||deriveMastery(profile||{})),mastered=masteries.filter(x=>x.status==='mastered').length,next=smartNext(),section=document.createElement('section');
 section.id='proLearningHub';section.className='pro-panel';
 section.innerHTML='<div class="pro-panel-head"><div><span class="section-kicker">مركز التعلم الاحترافي</span><h2>مسارك الذكي اليوم</h2><p>الإتقان، المراجعة، تحديد المستوى، والتوصيات العلاجية في مكان واحد.</p></div><span class="pro-mastery-pill mastered">'+mastered+' درس متقن</span></div><div class="pro-suite-grid">'+
 '<article class="pro-suite-card"><span class="pro-icon"><i class="fa-solid '+next.icon+'"></i></span><h3>'+esc(next.title)+'</h3><p>'+esc(next.text)+'</p><a href="'+esc(next.href)+'">ابدأ الخطوة التالية</a></article>'+
 '<article class="pro-suite-card"><span class="pro-icon"><i class="fa-solid fa-brain"></i></span><h3>اختبار تحديد المستوى</h3><p>اختبار تكيفي يكتشف نقاط القوة والمهارات التي تحتاج دعمًا.</p><a href="./smart-assessment.html">ابدأ التقييم</a></article>'+
 '<article class="pro-suite-card"><span class="pro-icon"><i class="fa-solid fa-arrows-rotate"></i></span><h3>المراجعة المتباعدة</h3><p>'+(due?'لديك '+due+' سؤالًا مستحقًا الآن.':'لا توجد مراجعات عاجلة الآن.')+'</p><a href="./review-center.html">فتح مركز المراجعة</a></article>'+
 '<article class="pro-suite-card"><span class="pro-icon"><i class="fa-solid fa-people-roof"></i></span><h3>متابعة ولي الأمر</h3><p>أنشئ كود متابعة آمن يعرض ملخص التقدم والتنبيهات فقط.</p><a href="./parent.html?setup=1">إدارة المتابعة</a></article></div>';
 anchor.insertAdjacentElement('afterend',section);
}
function injectLessonMastery(){
 const heading=$('.lesson-heading');if(!heading||$('#proLessonMastery')||!profile)return;const id=new URLSearchParams(location.search).get('id');if(!id)return;const m=profile.mastery?.[id]||deriveMastery(profile)[id];if(!m)return;
 const box=document.createElement('div');box.id='proLessonMastery';box.className='pro-panel';box.innerHTML='<div class="pro-panel-head"><div><span class="section-kicker">حالة الإتقان</span><h3>'+masteryLabel(m.status)+' • '+m.score+'%</h3><p>يتغير مستوى الإتقان حسب إكمال الدرس ونتيجة التدريب والأخطاء المعلقة.</p></div><span class="pro-mastery-pill '+m.status+'">'+masteryLabel(m.status)+'</span></div><div class="pro-progress"><span style="width:'+m.score+'%"></span></div><div style="margin-top:16px"><strong>هل فهمت الدرس؟</strong><div class="pro-rating" id="proLessonRating" style="margin-top:9px"><button data-rating="understood">نعم، فهمت ✅</button><button data-rating="partial">إلى حد ما 🤔</button><button data-rating="not_understood">لا، أحتاج مراجعة 🔁</button></div></div>';
 heading.insertAdjacentElement('afterend',box);const saved=profile.lessonRatings?.[id]?.value;
 $$('[data-rating]',box).forEach(b=>{if(b.dataset.rating===saved)b.classList.add('active');b.onclick=async()=>{const value=b.dataset.rating;$$('[data-rating]',box).forEach(x=>x.classList.toggle('active',x===b));try{await db.ref('studentProfilesV3/'+user.uid+'/lessonRatings/'+id).set({value,updatedAt:Date.now()});profile.lessonRatings=profile.lessonRatings||{};profile.lessonRatings[id]={value,updatedAt:Date.now()};await db.ref('lessonRatings/'+id+'/'+user.uid).set({value,subject:lessons[id]?.subject||'',updatedAt:Date.now()});if(value==='not_understood')await db.ref('studentProfilesV3/'+user.uid+'/remedial/'+id).set({reason:'self_rating',createdAt:Date.now(),active:true})}catch(err){console.warn(err)}}});
}
async function boot(u){
 user=u;if(!u)return;
 try{const [p,l,q]=await Promise.all([db.ref('studentProfilesV3/'+u.uid).once('value'),db.ref('lessons').once('value'),db.ref('quizzes').once('value')]);profile=p.val()||{};lessons=l.val()||{};quizzes=q.val()||{};await syncDerived();if(document.getElementById('studentDashboard'))injectDashboard();if(document.documentElement.dataset.page==='lesson'||document.body.classList.contains('lesson-body'))injectLessonMastery()}catch(err){console.warn('Pro suite unavailable',err)}
}
window.AcademyPro={get user(){return user},get profile(){return profile},get lessons(){return lessons},deriveMastery:()=>deriveMastery(profile||{}),syncDerived,ensureParentCode,masteryLabel,reviewIntervals,smartNext};
window.addEventListener('academy:quiz-finished',async()=>{if(!user)return;const p=await db.ref('studentProfilesV3/'+user.uid).once('value');profile=p.val()||profile;await syncDerived()});
window.addEventListener('academy:lesson-completed',async()=>{if(!user)return;const p=await db.ref('studentProfilesV3/'+user.uid).once('value');profile=p.val()||profile;await syncDerived()});
auth.onAuthStateChanged(boot);
})();