(() => {
'use strict';
const C=window.AcademyCore,$=id=>document.getElementById(id),$$=(s,r=document)=>[...r.querySelectorAll(s)];
let user,profile,data={simulations:{},quizzes:{}},current=null,timer=null,endAt=0,index=0,answers=[];

const map={ar:'arabic',ma:'math',sc:'science',en:'english'};
const labels={ar:'عربي',ma:'رياضيات',sc:'علوم',en:'إنجليزي'};

function history(){
 return Object.entries(profile.simulationHistory||{}).map(([id,v])=>({id,...v})).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
}
function sims(){
 return Object.entries(data.simulations||{}).map(([id,v])=>({id,...v})).filter(s=>!s.isHidden&&s.type===profile.educationType&&s.stage===profile.stage&&String(s.grade)===String(profile.grade)).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
}
function renderStats(){
 const hs=history();$('simAvailable').textContent=sims().length;$('simAttempts').textContent=hs.length;$('simBest').textContent=(hs.length?Math.max(...hs.map(x=>Number(x.score||0))):0)+'%';$('simEarnedXp').textContent=hs.reduce((a,x)=>a+Number(x.xp||0),0);
}
function render(){
 const list=sims();$('simGrid').innerHTML=list.length?list.map(s=>{
   const counts=s.counts||{},total=Object.values(counts).reduce((a,n)=>a+Number(n||0),0);
   return '<article class="sim-card"><span class="feature-card-icon amber"><i class="fa-solid fa-stopwatch"></i></span><h3>'+C.esc(s.name||'محاكي')+'</h3><p>'+Number(s.time||60)+' دقيقة • '+total+' سؤال</p><div class="sim-counts">'+Object.entries(map).map(([k])=>'<span><strong>'+Number(counts[k]||0)+'</strong>'+labels[k]+'</span>').join('')+'</div><button class="btn btn-primary btn-block" data-start-sim="'+s.id+'">ابدأ المحاكاة</button></article>';
 }).join(''):'<div class="feature-empty"><span>⏱️</span><h3>لا توجد محاكيات متاحة لصفك الآن</h3><p>عندما تضيف الإدارة محاكيًا مناسبًا لمرحلتك سيظهر هنا.</p></div>';
 $$('[data-start-sim]').forEach(b=>b.onclick=()=>start(b.dataset.startSim));
}
function pools(){
 const q=Object.values(data.quizzes||{}).filter(x=>!x.isHidden&&x.type===profile.educationType&&x.stage===profile.stage&&String(x.grade)===String(profile.grade));
 const out={};Object.values(map).forEach(sub=>out[sub]=[]);
 q.forEach(quiz=>{if(!out[quiz.subject])return;(quiz.questions||[]).forEach(x=>{if(x?.text&&Array.isArray(x.opts)&&x.opts.length>=2)out[quiz.subject].push({...x,subject:quiz.subject})})});
 return out;
}
function shuffle(a){const x=[...a];for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]]}return x}
function buildQuestions(sim){
 const p=pools(),result=[];
 Object.entries(map).forEach(([key,subject])=>{const want=Number(sim.counts?.[key]||0);result.push(...shuffle(p[subject]||[]).slice(0,want))});
 return shuffle(result);
}
async function start(id){
 const sim=sims().find(x=>x.id===id);if(!sim)return;
 const questions=buildQuestions(sim);const requested=Object.values(sim.counts||{}).reduce((a,n)=>a+Number(n||0),0);
 if(!questions.length)return C.toast('لا توجد أسئلة كافية لهذا المحاكي بعد.','error');
 if(questions.length<requested){const ok=await window.AcademyUI.confirm({title:'عدد الأسئلة أقل من المطلوب',message:'المحاكي سيبدأ بالأسئلة المتاحة حاليًا بدل العدد الكامل المحدد.',tone:'warning',acceptText:'ابدأ بالمتاح'});if(!ok)return;}
 current={sim,questions};answers=new Array(questions.length).fill(null);index=0;endAt=Date.now()+Number(sim.time||60)*60000;
 $('simRunnerTitle').textContent=sim.name||'المحاكي';$('simulationRunner').classList.remove('hidden');document.body.style.overflow='hidden';$('simResult').classList.add('hidden');$('simQuestionArea').classList.remove('hidden');$('simRunnerNav').classList.remove('hidden');
 tick();timer=setInterval(tick,1000);renderQuestion();
}
function tick(){
 const left=Math.max(0,endAt-Date.now()),min=Math.floor(left/60000),sec=Math.floor((left%60000)/1000);$('simTimer').textContent=String(min).padStart(2,'0')+':'+String(sec).padStart(2,'0');
 if(left<=0){clearInterval(timer);finish(true)}
}
function renderQuestion(){
 const q=current.questions[index],letters=['أ','ب','ج','د','هـ'];$('simQuestionArea').innerHTML='<article class="sim-question"><span class="section-kicker">'+labels[Object.keys(map).find(k=>map[k]===q.subject)]+' • السؤال '+(index+1)+' من '+current.questions.length+'</span><h3>'+C.esc(q.text)+'</h3><div class="sim-options">'+q.opts.map((o,i)=>'<button class="sim-option '+(answers[index]===i?'selected':'')+'" data-sim-answer="'+i+'">'+(letters[i]||i+1)+'. '+C.esc(o)+'</button>').join('')+'</div></article>';
 $$('[data-sim-answer]').forEach(b=>b.onclick=()=>{answers[index]=Number(b.dataset.simAnswer);renderQuestion()});
 $('simPrev').disabled=index===0;$('simNext').textContent=index===current.questions.length-1?'إنهاء الامتحان':'التالي';
}
$('simPrev').onclick=()=>{if(index>0){index--;renderQuestion()}};
$('simNext').onclick=async()=>{if(index===current.questions.length-1){const ok=await window.AcademyUI.confirm({title:'إنهاء المحاكاة؟',message:'سيتم إنهاء المحاكاة الآن وحساب نتيجتك بناءً على الإجابات الحالية.',tone:'warning',acceptText:'إنهاء وإظهار النتيجة'});if(ok)finish(false)}else{index++;renderQuestion()}};
$('quitSimulation').onclick=async()=>{const ok=await window.AcademyUI.confirm({title:'الخروج من المحاكاة؟',message:'لن يتم حفظ المحاولة غير المكتملة إذا خرجت الآن.',tone:'danger',acceptText:'خروج بدون حفظ'});if(ok)closeRunner()};
function closeRunner(){clearInterval(timer);$('simulationRunner').classList.add('hidden');document.body.style.overflow='';current=null}

async function finish(auto){
 if(!current)return;clearInterval(timer);
 let correct=0;current.questions.forEach((q,i)=>{if(Number(answers[i])===Number(q.correctAnswer))correct++});
 const score=Math.round(correct/current.questions.length*100),xp=score>=80?100:score>=60?60:30,answered=answers.filter(x=>x!==null).length;
 const rec={simulationId:current.sim.id,name:current.sim.name||'محاكي',score,correct,total:current.questions.length,answered,xp,createdAt:Date.now(),autoFinished:!!auto};
 const ref=C.db.ref('studentProfilesV3/'+user.uid+'/simulationHistory').push();await ref.set(rec);
 await C.db.ref('studentProfilesV3/'+user.uid+'/stats').transaction(s=>{s=s||{};s.completedSimulations=(s.completedSimulations||0)+1;s.totalXP=(s.totalXP||0)+xp;s.level=Math.floor((s.totalXP||0)/1000)+1;return s});
 await C.addLeaderboardXP(user.uid,profile.name||user.displayName||'طالب',xp,0);
 profile.simulationHistory=profile.simulationHistory||{};profile.simulationHistory[ref.key]=rec;
 $('simQuestionArea').classList.add('hidden');$('simRunnerNav').classList.add('hidden');$('simResult').classList.remove('hidden');$('simResult').innerHTML='<div class="big-score">'+score+'%</div><h2>'+(score>=80?'ممتاز جدًا 🌟':score>=60?'أداء جيد 👏':'راجع المواد وحاول مرة أخرى')+'</h2><p>إجابات صحيحة: '+correct+' من '+current.questions.length+' • أجبت عن '+answered+' سؤال • +'+xp+' XP</p><button class="btn btn-primary" id="closeResult">العودة للمحاكيات</button>';
 $('closeResult').onclick=()=>{closeRunner();renderStats();render()};
}

(async()=>{
 ({user,profile}=await C.requireStudent());$('pageAvatar').textContent=C.initials(profile.name||user.displayName||'طالب');
 const [s,q]=await Promise.all([C.db.ref('simulations').once('value'),C.db.ref('quizzes').once('value')]);data={simulations:s.val()||{},quizzes:q.val()||{}};renderStats();render();
})();
})();