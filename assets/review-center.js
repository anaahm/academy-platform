(function reviewCenter(){
'use strict';
if(!window.firebase)return;
const app=firebase.apps[0],auth=app.auth(),db=app.database(),$=id=>document.getElementById(id),DAY=86400000,intervals=[1,3,7,14,30];
const esc=(v='')=>String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let user=null,profile={},queue={},due=[],index=0,answered=false;
function toast(msg,type='success'){const el=$('toast');el.textContent=msg;el.className='toast show '+type;clearTimeout(toast.t);toast.t=setTimeout(()=>el.className='toast',2600)}
function fmt(ts){if(!ts)return'الآن';const d=new Date(ts);return d.toLocaleDateString('ar-EG',{day:'numeric',month:'short'})}
function recalc(){
 queue=profile.reviewQueue||{};const all=Object.values(queue),now=Date.now();due=all.filter(x=>Number(x.nextReviewAt||0)<=now).sort((a,b)=>Number(a.nextReviewAt||0)-Number(b.nextReviewAt||0));index=Math.min(index,Math.max(0,due.length-1));
 $('reviewDue').textContent=due.length;$('reviewTotal').textContent=all.length;$('reviewMastered').textContent=Object.values(profile.reviewMastered||{}).length;
 const future=all.filter(x=>Number(x.nextReviewAt||0)>now).sort((a,b)=>a.nextReviewAt-b.nextReviewAt)[0];$('reviewNext').textContent=due.length?'الآن':future?fmt(future.nextReviewAt):'—';renderList();renderCurrent();
}
function renderList(){
 const items=Object.values(queue).sort((a,b)=>Number(a.nextReviewAt||0)-Number(b.nextReviewAt||0));
 $('reviewQueueList').innerHTML=items.length?items.map(x=>{
  const dueNow=Number(x.nextReviewAt||0)<=Date.now(),step=Math.min(intervals.length,Number(x.intervalIndex||0)+1);
  return '<div class="pro-list-item"><div><h4>'+esc(x.text||'سؤال مراجعة')+'</h4><p>'+esc(x.subject||'')+(x.skill?' • '+esc(x.skill):'')+'</p></div><div style="text-align:left"><span class="pro-badge '+(dueNow?'pending':'approved')+'">'+(dueNow?'مستحق الآن':'المراجعة '+fmt(x.nextReviewAt))+'</span><p style="margin:6px 0 0;color:#64748b;font-size:11px">مرحلة التثبيت '+step+' / '+intervals.length+'</p></div></div>';
 }).join(''):'<div class="pro-empty">دفتر الأخطاء نظيف حاليًا 🎉</div>';
}
function renderCurrent(){
 answered=false;$('reviewNextBtn').disabled=true;
 if(!due.length){
  $('reviewCounter').textContent='0 / 0';$('reviewSessionTitle').textContent='لا توجد مراجعات مستحقة الآن';$('reviewSessionText').textContent='سنُعيد الأسئلة لك تلقائيًا عند موعدها القادم.';
  $('reviewQuestionArea').innerHTML='<div class="pro-empty"><strong>أحسنت 👏</strong><p>يمكنك متابعة دروسك أو إجراء اختبار تحديد مستوى جديد.</p><a class="pro-btn secondary" href="./smart-assessment.html">اختبار تحديد المستوى</a></div>';return;
 }
 if(index>=due.length){index=0}
 const q=due[index];$('reviewCounter').textContent=(index+1)+' / '+due.length;$('reviewSessionTitle').textContent='ثبّت الخطأ قبل أن تنساه';$('reviewSessionText').textContent='أجب بدون الرجوع للإجابة السابقة ثم سنحدد موعد المراجعة القادمة.';
 $('reviewQuestionArea').innerHTML='<article class="pro-question-card"><h3>'+esc(q.text||'اختر الإجابة الصحيحة')+'</h3><div id="reviewOptions">'+(q.opts||[]).map((o,i)=>'<button type="button" class="pro-option" data-review-answer="'+i+'">'+esc(o)+'</button>').join('')+'</div><div id="reviewFeedback"></div></article>';
 [...document.querySelectorAll('[data-review-answer]')].forEach(b=>b.onclick=()=>submitAnswer(q,Number(b.dataset.reviewAnswer)));
}
async function submitAnswer(q,chosen){
 if(answered)return;answered=true;const correct=chosen===Number(q.correctAnswer),buttons=[...document.querySelectorAll('[data-review-answer]')];
 buttons.forEach(b=>{const i=Number(b.dataset.reviewAnswer);b.disabled=true;b.classList.toggle('correct',i===Number(q.correctAnswer));b.classList.toggle('wrong',i===chosen&&!correct)});
 $('reviewFeedback').innerHTML='<div class="pro-feedback '+(correct?'good':'bad')+'">'+(correct?'إجابة صحيحة — ممتاز، سنباعد المراجعة أكثر.':'ليست صحيحة. الإجابة: '+esc(q.opts?.[q.correctAnswer]||'—'))+(q.explanation?'<br><small>'+esc(q.explanation)+'</small>':'')+'</div>';
 const current=Math.max(0,Number(q.intervalIndex||0)),nextIndex=correct?Math.min(intervals.length-1,current+1):0,streak=correct?Number(q.correctStreak||0)+1:0,now=Date.now(),updates={};
 if(correct&&streak>=3){
  updates['studentProfilesV3/'+user.uid+'/reviewQueue/'+q.key]=null;
  updates['studentProfilesV3/'+user.uid+'/reviewMastered/'+q.key]={text:q.text||'',subject:q.subject||'',skill:q.skill||'',masteredAt:now};
  updates['studentProfilesV3/'+user.uid+'/mistakeNotebook/'+q.sourceId+'/'+q.questionKey]=null;
  delete queue[q.key];profile.reviewMastered=profile.reviewMastered||{};profile.reviewMastered[q.key]={masteredAt:now};
  toast('تم تثبيت هذا الخطأ وإزالته من دفتر الأخطاء 🎉');
 }else{
  const updated={...q,intervalIndex:nextIndex,correctStreak:streak,lastReviewedAt:now,nextReviewAt:now+intervals[nextIndex]*DAY,updatedAt:now};
  updates['studentProfilesV3/'+user.uid+'/reviewQueue/'+q.key]=updated;queue[q.key]=updated;
 }
 try{await db.ref().update(updates);profile.reviewQueue=queue}catch(err){console.error(err);toast('تعذر حفظ المراجعة الآن.','error')}
 $('reviewNextBtn').disabled=false;
}
$('reviewNextBtn').onclick=async()=>{if(!answered)return;const snap=await db.ref('studentProfilesV3/'+user.uid).once('value');profile=snap.val()||profile;queue=profile.reviewQueue||{};due=Object.values(queue).filter(x=>Number(x.nextReviewAt||0)<=Date.now()).sort((a,b)=>a.nextReviewAt-b.nextReviewAt);if(index>=due.length)index=0;recalc()};
auth.onAuthStateChanged(async u=>{if(!u){location.replace('./index.html');return}user=u;try{const p=await db.ref('studentProfilesV3/'+u.uid).once('value');profile=p.val()||{};if(window.AcademyPro)await window.AcademyPro.syncDerived();const fresh=await db.ref('studentProfilesV3/'+u.uid).once('value');profile=fresh.val()||profile;recalc()}catch(err){console.error(err);toast('تعذر تحميل دفتر الأخطاء.','error')}});
})();