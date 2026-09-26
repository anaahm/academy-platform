(function smartAssessment(){
'use strict';
if(!window.firebase)return;
const app=firebase.apps[0],auth=app.auth(),db=app.database(),$=id=>document.getElementById(id);
const esc=(v='')=>String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let user=null,profile={},bank=[],subjects=[],session=null;
function toast(msg,type='success'){const el=$('toast');if(!el)return;el.textContent=msg;el.className='toast show '+type;clearTimeout(toast.t);toast.t=setTimeout(()=>el.className='toast',2800)}
function normalizeQuestion(q,meta={}){
 try{
  const text=String(q?.text||q?.question||'').trim(),opts=(q?.opts||q?.options||[]).map(String),correct=Number(q?.correctAnswer);
  if(!text||opts.length<2||!Number.isInteger(correct)||correct<0||correct>=opts.length)return null;
  return {...meta,...q,text,opts,correctAnswer:correct,difficulty:Math.min(3,Math.max(1,Number(q?.difficulty||2))),skill:String(q?.skill||meta.skill||'مهارة عامة'),explanation:String(q?.explanation||q?.hint||'')};
 }catch{return null}
}
async function loadBank(){
 const [qSnap,lSnap,quizSnap]=await Promise.all([db.ref('questionBank').once('value'),db.ref('lessons').once('value'),db.ref('quizzes').once('value')]);
 const direct=Object.entries(qSnap.val()||{}).map(([id,q])=>normalizeQuestion(q,{id,source:'bank'})).filter(Boolean).filter(q=>q.status==='approved'&&(!q.type||q.type===profile.educationType)&&(!q.stage||q.stage===profile.stage)&&(!q.grade||String(q.grade)===String(profile.grade)));
 const fallback=[];
 Object.entries(lSnap.val()||{}).forEach(([lessonId,l])=>{
  if(!l||l.isHidden||l.type!==profile.educationType||l.stage!==profile.stage||String(l.grade)!==String(profile.grade))return;
  (l.questions||[]).forEach((q,i)=>{const item=normalizeQuestion(q,{id:'lesson_'+lessonId+'_'+i,source:'lesson',sourceId:lessonId,subject:l.subject||'',skill:q?.skill||l.title||'درس'});if(item)fallback.push(item)});
 });
 Object.entries(quizSnap.val()||{}).forEach(([quizId,qz])=>{
  if(!qz||qz.isHidden||qz.type!==profile.educationType||qz.stage!==profile.stage||String(qz.grade)!==String(profile.grade))return;
  (qz.questions||[]).forEach((q,i)=>{const item=normalizeQuestion(q,{id:'quiz_'+quizId+'_'+i,source:'quiz',sourceId:quizId,subject:qz.subject||'',skill:q?.skill||qz.name||'اختبار'});if(item)fallback.push(item)});
 });
 const seen=new Set();bank=[...direct,...fallback].filter(q=>{const k=(q.subject||'')+'|'+q.text;if(seen.has(k))return false;seen.add(k);return true});
 subjects=[...new Set(bank.map(q=>q.subject).filter(Boolean))].sort();
 $('assessmentSubject').innerHTML=subjects.length?subjects.map(s=>'<option value="'+esc(s)+'">'+esc(s)+'</option>').join(''):'<option value="">لا توجد أسئلة متاحة بعد</option>';
 $('assessmentBankInfo').textContent=bank.length+' سؤال متاح';
 $('startAssessment').disabled=!bank.length;
}
function pickQuestions(subject,mode){
 const pool=bank.filter(q=>!subject||q.subject===subject),count=mode==='placement'?15:12;
 const shuffled=[...pool].sort(()=>Math.random()-.5);
 if(mode==='placement'){
  const buckets=[1,2,3].map(d=>shuffled.filter(q=>q.difficulty===d)),out=[];
  while(out.length<count&&buckets.some(x=>x.length)){for(const b of buckets){if(b.length&&out.length<count)out.push(b.shift())}}
  return out;
 }
 return shuffled.slice(0,Math.min(Math.max(count*3,count),shuffled.length));
}
function start(){
 const subject=$('assessmentSubject').value,mode=$('assessmentMode').value,pool=pickQuestions(subject,mode);
 if(!pool.length)return toast('لا توجد أسئلة كافية لهذه المادة.','error');
 session={subject,mode,pool,used:new Set(),answers:[],index:0,target:Math.min(mode==='placement'?15:12,pool.length),difficulty:2,current:null};
 $('assessmentSetup').classList.add('pro-section-hidden');$('assessmentResult').classList.add('pro-section-hidden');$('assessmentEngine').classList.remove('pro-section-hidden');nextQuestion(true);
}
function chooseQuestion(){
 const available=session.pool.filter(q=>!session.used.has(q.id));
 if(!available.length)return null;
 if(session.mode==='placement')return available[0];
 const exact=available.filter(q=>q.difficulty===session.difficulty);
 return (exact.length?exact:available.sort((a,b)=>Math.abs(a.difficulty-session.difficulty)-Math.abs(b.difficulty-session.difficulty)))[0];
}
function diffLabel(d){return d===1?'أساسي':d===3?'متقدم':'متوسط'}
function nextQuestion(initial=false){
 if(!initial&&session.answers.length>=session.target)return finish();
 const q=chooseQuestion();if(!q)return finish();session.current=q;session.used.add(q.id);session.index=session.answers.length;
 $('assessmentProgressText').textContent='السؤال '+(session.index+1)+' من '+session.target;$('assessmentProgressBar').style.width=Math.round(session.index/session.target*100)+'%';$('difficultyBadge').textContent=diffLabel(q.difficulty);$('assessmentQuestion').textContent=q.text;
 $('assessmentFeedback').innerHTML='';$('assessmentNext').disabled=true;
 $('assessmentOptions').innerHTML=q.opts.map((o,i)=>'<button type="button" class="pro-option" data-answer="'+i+'"><strong>'+String.fromCharCode(1571+i)+'</strong> '+esc(o)+'</button>').join('');
 [...$('assessmentOptions').querySelectorAll('[data-answer]')].forEach(b=>b.onclick=()=>answer(Number(b.dataset.answer)));
}
function answer(chosen){
 if(!session?.current||session.current._answered)return;const q=session.current,correct=chosen===q.correctAnswer;q._answered=true;
 session.answers.push({questionId:q.id,text:q.text,subject:q.subject||'',skill:q.skill||'مهارة عامة',difficulty:q.difficulty,chosen,correctAnswer:q.correctAnswer,correct});
 [...$('assessmentOptions').querySelectorAll('[data-answer]')].forEach(b=>{const i=Number(b.dataset.answer);b.disabled=true;b.classList.toggle('correct',i===q.correctAnswer);b.classList.toggle('wrong',i===chosen&&!correct)});
 $('assessmentFeedback').innerHTML='<div class="pro-feedback '+(correct?'good':'bad')+'">'+(correct?'إجابة صحيحة 👏':'إجابة غير صحيحة. الصحيحة: '+esc(q.opts[q.correctAnswer]))+(q.explanation?'<br><small>'+esc(q.explanation)+'</small>':'')+'</div>';
 if(session.mode==='adaptive')session.difficulty=Math.max(1,Math.min(3,session.difficulty+(correct?1:-1)));
 $('assessmentNext').disabled=false;
}
async function finish(){
 $('assessmentEngine').classList.add('pro-section-hidden');$('assessmentResult').classList.remove('pro-section-hidden');
 const answers=session.answers,total=answers.length,correct=answers.filter(x=>x.correct).length,pct=total?Math.round(correct/total*100):0,skillMap={};
 answers.forEach(a=>{skillMap[a.skill]=skillMap[a.skill]||{correct:0,total:0};skillMap[a.skill].total++;skillMap[a.skill].correct+=a.correct?1:0});
 const skills=Object.entries(skillMap).map(([name,x])=>({name,percent:Math.round(x.correct/x.total*100),...x})).sort((a,b)=>b.percent-a.percent),strong=skills.filter(x=>x.percent>=70),weak=skills.filter(x=>x.percent<70);
 $('assessmentScore').textContent=pct+'%';$('assessmentResultTitle').textContent=pct>=80?'مستوى قوي جدًا 🌟':pct>=60?'مستوى جيد ويحتاج تثبيتًا':'نبدأ بخطة علاجية منظمة';
 $('assessmentResultText').textContent='أجبت عن '+correct+' من '+total+' إجابة صحيحة، وتم حفظ التحليل في ملفك.';
 $('assessmentKpis').innerHTML='<article class="pro-kpi"><strong>'+pct+'%</strong><span>النتيجة</span></article><article class="pro-kpi"><strong>'+strong.length+'</strong><span>مهارات قوية</span></article><article class="pro-kpi"><strong>'+weak.length+'</strong><span>تحتاج مراجعة</span></article><article class="pro-kpi"><strong>'+Math.max(...answers.map(x=>x.difficulty),1)+'</strong><span>أعلى صعوبة وصلت لها</span></article>';
 const row=x=>'<div class="pro-list-item"><div><h4>'+esc(x.name)+'</h4><p>'+x.correct+' صحيحة من '+x.total+'</p></div><span class="pro-badge '+(x.percent>=70?'approved':'pending')+'">'+x.percent+'%</span></div>';
 $('strongSkills').innerHTML=strong.length?strong.map(row).join(''):'<div class="pro-empty">لا توجد مهارة تجاوزت 70% في هذه المحاولة.</div>';$('weakSkills').innerHTML=weak.length?weak.map(row).join(''):'<div class="pro-empty">رائع، لا توجد مهارات ضعيفة في هذه المحاولة.</div>';
 if(user){
  try{
   const ref=db.ref('studentProfilesV3/'+user.uid+'/diagnostics').push();
   await ref.set({mode:session.mode,subject:session.subject,score:pct,correct,total,skills:Object.fromEntries(skills.map(x=>[x.name,x])),answers:answers.map(({text,...x})=>x),createdAt:Date.now()});
   const remediation={};weak.forEach(x=>remediation[x.name]={subject:session.subject,score:x.percent,active:true,source:'assessment',updatedAt:Date.now()});
   await db.ref('studentProfilesV3/'+user.uid+'/skillRemediation').update(remediation);
  }catch(err){console.warn(err)}
 }
}
$('startAssessment').onclick=start;$('assessmentNext').onclick=()=>nextQuestion(false);$('retryAssessment').onclick=()=>{$('assessmentResult').classList.add('pro-section-hidden');$('assessmentSetup').classList.remove('pro-section-hidden')};
auth.onAuthStateChanged(async u=>{if(!u){location.replace('./index.html');return}user=u;try{const p=await db.ref('studentProfilesV3/'+u.uid).once('value');profile=p.val()||{};await loadBank()}catch(err){console.error(err);toast('تعذر تحميل بنك الأسئلة.','error')}});
})();