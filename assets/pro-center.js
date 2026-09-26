(()=>{'use strict';
const $=id=>document.getElementById(id),P=window.AcademyPro,C=window.AcademyCore;
let ctx={subject:''},pool=[],sequence=[],history=[],skillStats={},targetCount=10,current=null;
function flatMastery(o){const a=[];(function w(x){Object.values(x||{}).forEach(v=>v&&typeof v==='object'&&'lessonId'in v?a.push(v):w(v))})(o);return a}
function row(label,val,max){const p=max?Math.min(100,Math.round(val/max*100)):0;return '<div class="pro-item"><div class="pro-space"><strong>'+label+'</strong><span>'+val+' / '+max+'</span></div><div class="pro-progress"><span style="width:'+p+'%"></span></div></div>'}
function optionsOf(q){return q.options||q.opts||[]}
function correctIndex(q,opts){const raw=q.correctAnswer??q.correct;if(Number.isInteger(Number(raw))&&Number(raw)>=0&&Number(raw)<opts.length)return Number(raw);return opts.findIndex(x=>String(x)===String(raw))}
function pickAdaptive(){
 const used=new Set(sequence.map(q=>q.id)),remaining=pool.filter(q=>!used.has(q.id));if(!remaining.length)return null;
 const d=P.adaptiveDifficulty(history);
 return remaining.sort((a,b)=>Math.abs(Number(a.difficulty||2)-d)-Math.abs(Number(b.difficulty||2)-d))[0];
}
async function load(){
 const {user,profile}=await C.requireStudent();
 ctx={type:profile.educationType||'public',stage:profile.stage||'prep',grade:String(profile.grade||1),subject:profile.lastSubject||profile.lastSubjectId||'arabic'};
 await P.touchStreak();
 const snap=await P.snapshot(user.uid);
 $('level').textContent=snap.xp.level||1;$('xp').textContent=(snap.xp.total||0)+' XP';$('streak').textContent=(snap.streak.count||0)+' 🔥';$('bestStreak').textContent='أفضل سلسلة: '+(snap.streak.best||0);$('due').textContent=snap.due||0;
 const ach=Object.values(snap.achievements||{}).sort((a,b)=>(b.earnedAt||0)-(a.earnedAt||0));
 $('achievementList').innerHTML=ach.length?ach.map(x=>'<div class="pro-item"><div class="pro-space"><div><strong>'+C.esc((x.icon||'🏆')+' '+(x.title||'إنجاز'))+'</strong><div class="pro-muted">'+C.esc(x.description||'')+'</div></div><span class="pro-badge ok">مفتوحة</span></div></div>').join(''):'<div class="pro-empty">أكمل أول درس أو حافظ على سلسلة تعلم لفتح أول شارة.</div>';
 const rec=await P.recommendNext(ctx,user.uid);$('nextTitle').textContent=rec?.title||'أكمل رحلتك التعليمية';$('nextReason').textContent=rec?.reason||'اختر مادة وابدأ درسًا جديدًا';$('nextAction').onclick=()=>location.href=rec?.lessonId?'./lesson.html?id='+encodeURIComponent(rec.lessonId):'./explore.html';
 const ms=(await P.db.ref(P.paths.mastery+'/'+user.uid).once('value')).val()||{},m=flatMastery(ms),counts={mastered:0,learning:0,review:0};m.forEach(x=>counts[x.status]=(counts[x.status]||0)+1);
 $('masterySummary').innerHTML=['متقن','قيد التعلم','يحتاج مراجعة'].map((n,i)=>'<div class="pro-item"><div class="pro-space"><strong>'+n+'</strong><span class="pro-badge '+(i===0?'ok':i===2?'bad':'warn')+'">'+[counts.mastered,counts.learning,counts.review][i]+'</span></div></div>').join('')||'<div class="pro-empty">ابدأ أول درس ليظهر مستوى الإتقان.</div>';
 const due=await P.dueReviews(user.uid,12);$('reviewList').innerHTML=due.length?due.map(q=>'<div class="pro-item"><strong>'+C.esc(q.questionText||'سؤال مراجعة')+'</strong><div class="pro-muted">'+C.esc(q.subject||'')+' • موعد المراجعة الآن</div></div>').join(''):'<div class="pro-empty">لا توجد مراجعات مستحقة الآن 🎉</div>';
 const goals=snap.goals||{},latest=Object.values(goals).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0))[0]||{};$('goalLessons').value=latest.lessons||'';$('goalQuizzes').value=latest.quizzes||'';$('goalMinutes').value=latest.minutes||'';const pr=latest.progress||{};
 $('goalProgress').innerHTML=(latest.lessons?row('الدروس',pr.lessons||0,latest.lessons):'')+(latest.quizzes?row('الاختبارات',pr.quizzes||0,latest.quizzes):'')+(latest.minutes?row('دقائق المذاكرة',pr.minutes||0,latest.minutes):'');
 $('saveGoals').onclick=async()=>{await P.setWeeklyGoals({lessons:+$('goalLessons').value||3,quizzes:+$('goalQuizzes').value||2,minutes:+$('goalMinutes').value||60});alert('تم حفظ أهدافك الأسبوعية');load()};
 $('parentCodeBtn').onclick=async()=>{$('parentCode').textContent=await P.createParentInvite(user.uid)};
 $('startDiagnostic').onclick=startDiag;
}
async function startDiag(){
 const subject=$('diagSubject').value.trim()||ctx.subject;targetCount=+$('diagCount').value||10;
 pool=await P.generateExam({subject},Math.max(40,targetCount*4));sequence=[];history=[];skillStats={};current=null;
 if(!pool.length){$('diagnosticArea').innerHTML='<div class="pro-empty">لا توجد أسئلة معتمدة كافية لهذه المادة في بنك الأسئلة.</div>';return}
 nextAdaptive();
}
function nextAdaptive(){
 if(sequence.length>=targetCount)return finishDiag();
 current=pickAdaptive();if(!current)return finishDiag();sequence.push(current);renderCurrent();
}
function renderCurrent(){
 const q=current,opts=optionsOf(q),i=sequence.length,difficulty=Number(q.difficulty||2),labels={1:'سهل',2:'متوسط',3:'صعب'};
 $('diagnosticArea').innerHTML='<div class="pro-item"><div class="pro-space"><span class="pro-badge">سؤال '+i+' من '+targetCount+'</span><span class="pro-badge '+(difficulty===3?'bad':difficulty===1?'ok':'warn')+'">'+(labels[difficulty]||'متوسط')+'</span></div><h3>'+C.esc(q.question||q.text||'')+'</h3><div class="pro-list">'+opts.map((o,j)=>'<button class="pro-btn" data-a="'+j+'">'+C.esc(o)+'</button>').join('')+'</div><div class="pro-muted" id="adaptiveHint">الصعوبة تتغير تلقائيًا حسب أدائك.</div></div>';
 $('diagnosticArea').querySelectorAll('[data-a]').forEach(b=>b.onclick=async()=>{const a=+b.dataset.a,ci=correctIndex(q,opts),correct=a===ci;history.push(correct);const skill=q.skill||q.lessonId||'عام';skillStats[skill]=skillStats[skill]||{correct:0,total:0,lessonId:q.lessonId||''};skillStats[skill].total++;if(correct)skillStats[skill].correct++;$('diagnosticArea').querySelectorAll('[data-a]').forEach(x=>x.disabled=true);$('adaptiveHint').textContent=correct?'إجابة صحيحة ✅ — السؤال التالي قد يكون أصعب.':'إجابة غير صحيحة ❌ — السؤال التالي سيتكيف مع مستواك.';P.submitAnswer(q,correct,opts[a],{subject:$('diagSubject').value.trim()||ctx.subject,lessonId:q.lessonId||''}).catch(()=>{});setTimeout(nextAdaptive,450)});
}
async function finishDiag(){
 if(!history.length)return;
 const score=Math.round(history.filter(Boolean).length/history.length*100),skills=Object.entries(skillStats).map(([name,v])=>({name,lessonId:v.lessonId,score:Math.round(v.correct/v.total*100),total:v.total}));
 await P.saveDiagnostic($('diagSubject').value.trim()||ctx.subject,{score,skills});
 const weak=skills.filter(x=>x.score<60).sort((a,b)=>a.score-b.score);
 $('diagnosticArea').innerHTML='<div class="pro-item"><div class="pro-kpi">'+score+'%</div><strong>نتيجة تحديد المستوى التكيفي</strong><div class="pro-muted">'+(score>=80?'مستواك قوي، ورفع النظام صعوبة الأسئلة مع تقدمك.':score>=60?'مستواك متوسط، وحدد النظام نقاطًا تحتاج تثبيتًا.':'نقترح البدء بالمراجعة الأساسية ثم إعادة الاختبار.')+'</div>'+(weak.length?'<div class="pro-list" style="margin-top:10px">'+weak.slice(0,4).map(x=>'<div class="pro-item"><strong>'+C.esc(x.name)+'</strong><span class="pro-badge bad">'+x.score+'%</span></div>').join('')+'</div>':'')+'</div>';
 await P.awardXP(10,'adaptive_diagnostic_complete',{score});
}
load().catch(e=>{console.error(e);$('nextTitle').textContent='تعذر تحميل المركز'});
})();