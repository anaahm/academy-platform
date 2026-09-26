(function proTeacher(){
'use strict';
if(!window.firebase)return;
const app=firebase.apps.find(a=>a.name==='teacher-portal')||firebase.apps[0],auth=app.auth(),db=app.database();
const $=id=>document.getElementById(id),esc=(v='')=>String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let user=null,teacher=null,bank={},matrix={},lessons={},questionStats={},attendance={};
function toast(msg,type='success'){const el=$('toast');if(!el)return;el.textContent=msg;el.className='toast show '+type;clearTimeout(toast.t);toast.t=setTimeout(()=>el.className='toast',3000)}
function assignments(){
 const raw=teacher?.assignments||teacher?.subjects||[];const arr=Array.isArray(raw)?raw:Object.values(raw||{});
 return arr.map(x=>typeof x==='string'?{subject:x}:x).filter(Boolean);
}
function scopeLabel(a){return (a.type==='azhar'?'أزهر':'عام')+' • '+(a.stage||'')+' • صف '+(a.grade||'كل')+' • '+(a.subject||'')}
function addNavAndTab(){
 const nav=document.querySelector('.teacher-nav'),page=document.querySelector('.teacher-page');if(!nav||!page||$('teacher-tab-pro-suite'))return;
 const btn=document.createElement('button');btn.id='teacherProTabBtn';btn.className='pro-admin-nav-btn';btn.type='button';btn.innerHTML='<i class="fa-solid fa-brain"></i> بنك الأسئلة والتحليلات';nav.insertBefore(btn,nav.querySelector('[data-teacher-tab="profile"]'));
 const sec=document.createElement('section');sec.className='teacher-tab hidden';sec.id='teacher-tab-pro-suite';sec.setAttribute('role','tabpanel');
 sec.innerHTML='<section class="pro-panel"><div class="pro-panel-head"><div><span class="section-kicker">بنك أسئلة مركزي</span><h2>أضف سؤالًا احترافيًا</h2><p>كل سؤال يمر على الإدارة قبل دخوله البنك المعتمد.</p></div><span class="pro-badge pending">مراجعة الإدارة</span></div>'+
 '<form id="proQuestionForm" class="pro-form"><label><span>النطاق المسند</span><select id="proQuestionScope"></select></label><label><span>الصعوبة</span><select id="proQuestionDifficulty"><option value="1">أساسي</option><option value="2" selected>متوسط</option><option value="3">متقدم</option></select></label><label><span>المهارة</span><input id="proQuestionSkill" required maxlength="100" placeholder="مثال: المبتدأ والخبر"></label><label><span>نوع السؤال</span><select id="proQuestionType"><option value="mcq">اختيار من متعدد</option><option value="true_false">صح وخطأ</option></select></label><label class="full"><span>نص السؤال</span><textarea id="proQuestionText" required maxlength="700"></textarea></label>'+
 '<label><span>الخيار 1</span><input class="pro-q-opt" required></label><label><span>الخيار 2</span><input class="pro-q-opt" required></label><label><span>الخيار 3</span><input class="pro-q-opt"></label><label><span>الخيار 4</span><input class="pro-q-opt"></label><label><span>الإجابة الصحيحة</span><select id="proQuestionCorrect"><option value="0">الخيار 1</option><option value="1">الخيار 2</option><option value="2">الخيار 3</option><option value="3">الخيار 4</option></select></label><label><span>شرح الإجابة</span><input id="proQuestionExplanation" maxlength="500" placeholder="لماذا هذه هي الإجابة الصحيحة؟"></label><div class="full"><button class="pro-btn" type="submit"><i class="fa-solid fa-paper-plane"></i> إرسال السؤال للمراجعة</button></div></form></section>'+
 '<section class="pro-two-col"><article class="pro-panel"><div class="pro-panel-head"><div><h2>أسئلتي في البنك</h2><p>المعتمد، المرفوض، وما زال قيد المراجعة.</p></div></div><div class="pro-list" id="proTeacherBankList"></div></article>'+
 '<article class="pro-panel"><div class="pro-panel-head"><div><h2>إنشاء اختبار تلقائي</h2><p>اختر النطاق وعدد الأسئلة، وسننشئ اختبارًا متوازنًا من البنك المعتمد ويرسل للإدارة.</p></div></div><form id="proAutoQuizForm" class="pro-form"><label class="full"><span>النطاق</span><select id="proAutoScope"></select></label><label class="full"><span>الدرس المرتبط</span><select id="proAutoLesson"></select></label><label><span>اسم الاختبار</span><input id="proAutoTitle" required maxlength="120"></label><label><span>عدد الأسئلة</span><input id="proAutoCount" type="number" min="5" max="50" value="10"></label><div class="full"><button class="pro-btn" type="submit"><i class="fa-solid fa-wand-magic-sparkles"></i> توليد وإرسال للمراجعة</button></div></form></article></section>'+
 '<section class="pro-panel"><div class="pro-panel-head"><div><span class="section-kicker">خريطة حرارية</span><h2>إتقان الطلاب في موادك</h2><p>أخضر = إتقان قوي، أصفر = متوسط، أحمر = يحتاج تدخلًا. تظهر فقط الصفوف والمواد المسندة لك.</p></div></div><div class="pro-heatmap" id="proTeacherHeatmap"></div></section>'+
 '<div class="pro-two-col"><section class="pro-panel"><div class="pro-panel-head"><div><h2>أداء بنك الأسئلة</h2><p>أكثر الأسئلة صعوبة ونسبة الإجابة الصحيحة عليها بعد النشر.</p></div></div><div class="pro-list" id="proTeacherQuestionAnalytics"></div></section><section class="pro-panel"><div class="pro-panel-head"><div><h2>حضور الحصص المباشرة</h2><p>آخر مرات دخول الطلاب ومدة المشاركة المسجلة.</p></div></div><div class="pro-list" id="proTeacherAttendance"></div></section></div>';
 page.insertBefore(sec,page.querySelector('#teacher-tab-profile'));
 btn.onclick=()=>{document.querySelectorAll('.teacher-tab').forEach(x=>x.classList.add('hidden'));sec.classList.remove('hidden');document.querySelectorAll('.teacher-nav button').forEach(x=>x.classList.remove('active'));btn.classList.add('active');const role=$('teacherTopRole');if(role)role.textContent='بنك الأسئلة والتحليلات المتقدمة';renderAll()};
 document.querySelectorAll('.teacher-nav [data-teacher-tab]').forEach(x=>x.addEventListener('click',()=>btn.classList.remove('active')));
 $('proQuestionForm').addEventListener('submit',submitQuestion);$('proAutoQuizForm').addEventListener('submit',generateQuiz);$('proQuestionScope').addEventListener('change',syncAutoLesson);$('proAutoScope').addEventListener('change',syncAutoLesson);
 injectTargetingFields();
}
function populateScopes(){
 const scopes=assignments();const opts=scopes.length?scopes.map((a,i)=>'<option value="'+i+'">'+esc(scopeLabel(a))+'</option>').join(''):'<option value="">لا توجد صلاحيات مسندة</option>';
 $('proQuestionScope').innerHTML=opts;$('proAutoScope').innerHTML=opts;syncAutoLesson();
}
function selectedScope(id){const i=Number($(id)?.value);return assignments()[i]||null}
function syncAutoLesson(){
 const a=selectedScope('proAutoScope');if(!$('proAutoLesson'))return;const list=Object.entries(lessons||{}).map(([id,l])=>({id,...(l||{})})).filter(l=>!l.isHidden&&(!a?.type||l.type===a.type)&&(!a?.stage||l.stage===a.stage)&&(!a?.grade||String(l.grade)===String(a.grade))&&(!a?.subject||l.subject===a.subject));
 $('proAutoLesson').innerHTML=list.length?list.map(l=>'<option value="'+l.id+'">'+esc(l.title||'درس')+'</option>').join(''):'<option value="">لا يوجد درس معتمد في هذا النطاق</option>';
}
async function audit(action,targetId,meta={}){
 try{const ref=db.ref('auditLog').push();await ref.set({actorId:user.uid,actorRole:'teacher',actorName:teacher?.name||'مدرس',action,targetId,meta,createdAt:Date.now()})}catch{}
}
async function submitQuestion(e){
 e.preventDefault();const a=selectedScope('proQuestionScope');if(!a)return toast('لا يوجد نطاق مسند.','error');
 const opts=[...document.querySelectorAll('.pro-q-opt')].map(x=>x.value.trim());while(opts.length&&!opts.at(-1))opts.pop();const correct=Number($('proQuestionCorrect').value);
 if(opts.length<2||correct>=opts.length)return toast('أكمل الخيارات وحدد إجابة صحيحة موجودة.','error');
 const payload={text:$('proQuestionText').value.trim(),opts,correctAnswer:correct,explanation:$('proQuestionExplanation').value.trim(),difficulty:Number($('proQuestionDifficulty').value),skill:$('proQuestionSkill').value.trim(),questionType:$('proQuestionType').value,type:a.type||'public',stage:a.stage||'',grade:String(a.grade||''),subject:a.subject||'',teacherId:user.uid,teacherName:teacher?.name||'',status:'pending',createdAt:Date.now()};
 try{const ref=db.ref('questionBank').push();await ref.set(payload);await audit('question_submitted',ref.key,{subject:payload.subject});bank[ref.key]=payload;e.target.reset();populateScopes();renderBank();toast('تم إرسال السؤال للإدارة للمراجعة ✅')}catch(err){console.error(err);toast('تعذر إرسال السؤال.','error')}
}
function renderBank(){
 const own=Object.entries(bank||{}).map(([id,q])=>({id,...q})).filter(q=>q.teacherId===user?.uid).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
 $('proTeacherBankList').innerHTML=own.length?own.map(q=>'<div class="pro-list-item"><div><h4>'+esc(q.text||'سؤال')+'</h4><p>'+esc(q.subject||'')+' • '+esc(q.skill||'')+' • صعوبة '+Number(q.difficulty||2)+'</p></div><span class="pro-badge '+(q.status||'pending')+'">'+(q.status==='approved'?'معتمد':q.status==='rejected'?'مرفوض':'قيد المراجعة')+'</span></div>').join(''):'<div class="pro-empty">لم ترسل أسئلة للبنك بعد.</div>';
}
async function generateQuiz(e){
 e.preventDefault();const a=selectedScope('proAutoScope'),lessonId=$('proAutoLesson').value,title=$('proAutoTitle').value.trim(),count=Math.max(5,Math.min(50,Number($('proAutoCount').value||10)));if(!a||!lessonId||!title)return toast('أكمل النطاق والدرس والعنوان.','error');
 let pool=Object.entries(bank||{}).map(([id,q])=>({id,...q})).filter(q=>q.status==='approved'&&(!a.type||q.type===a.type)&&(!a.stage||q.stage===a.stage)&&(!a.grade||String(q.grade)===String(a.grade))&&q.subject===a.subject);
 pool=pool.sort(()=>Math.random()-.5);const buckets=[1,2,3].map(d=>pool.filter(q=>Number(q.difficulty||2)===d)),picked=[];
 while(picked.length<count&&buckets.some(b=>b.length)){for(const b of buckets){if(b.length&&picked.length<count)picked.push(b.shift())}}
 if(picked.length<Math.min(5,count))return toast('البنك المعتمد لا يحتوي أسئلة كافية لهذا النطاق بعد.','error');
 const lesson=lessons[lessonId]||{},questions=picked.map(q=>({text:q.text,opts:q.opts,correctAnswer:Number(q.correctAnswer),explanation:q.explanation||'',difficulty:Number(q.difficulty||2),skill:q.skill||'',questionBankId:q.id}));
 const payload={submissionKind:'quiz',title,lessonId,type:a.type||lesson.type||'public',stage:a.stage||lesson.stage||'',grade:String(a.grade||lesson.grade||''),subject:a.subject||lesson.subject||'',subjectName:a.subject||lesson.subject||'',unit:Number(lesson.unit||1),questions,status:'pending',teacherId:user.uid,teacherName:teacher?.name||'',source:'questionBank',createdAt:Date.now()};
 try{const ref=db.ref('teacherSubmissions/'+user.uid).push();await ref.set(payload);await audit('auto_quiz_submitted',ref.key,{count:questions.length,subject:payload.subject});toast('تم إنشاء اختبار من '+questions.length+' سؤال وإرساله للإدارة ✅');e.target.reset();populateScopes()}catch(err){console.error(err);toast('تعذر إنشاء الاختبار.','error')}
}
function allowedMatrix(row){
 return assignments().some(a=>(!a.type||a.type===row.educationType)&&(!a.stage||a.stage===row.stage)&&(!a.grade||String(a.grade)===String(row.grade))&&(!a.subject||row.subjects?.[a.subject]));
}
function renderHeatmap(){
 const rows=Object.values(matrix||{}).filter(allowedMatrix),subjects=[...new Set(assignments().map(a=>a.subject).filter(Boolean))];
 if(!rows.length||!subjects.length){$('proTeacherHeatmap').innerHTML='<div class="pro-empty">ستظهر الخريطة عندما تتوفر بيانات إتقان لطلاب موادك.</div>';return}
 const cell=(v)=>{const n=Number(v||0),cls=n>=80?'hm-high':n>=60?'hm-mid':n>0?'hm-low':'hm-none';return'<td class="'+cls+'">'+(n?n+'%':'—')+'</td>'};
 $('proTeacherHeatmap').innerHTML='<table><thead><tr><th>الطالب</th>'+subjects.map(s=>'<th>'+esc(s)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr><th>'+esc(r.name||'طالب')+'<br><small>صف '+esc(r.grade||'')+'</small></th>'+subjects.map(s=>cell(r.subjects?.[s]?.mastery)).join('')+'</tr>').join('')+'</tbody></table>';
}
function renderQuestionAnalytics(){
 const ownApproved=Object.entries(bank||{}).map(([id,q])=>({id,...q})).filter(q=>q.teacherId===user?.uid&&q.status==='approved'),items=[];
 ownApproved.forEach(q=>{const stat=questionStats?.[q.id]||{},attempts=Number(stat.attempts||0),correct=Number(stat.correct||0),pct=attempts?Math.round(correct/attempts*100):null,options=stat.optionCounts||{};items.push({...q,attempts,pct,options})});
 items.sort((a,b)=>(a.pct??101)-(b.pct??101));
 $('proTeacherQuestionAnalytics').innerHTML=items.length?items.slice(0,12).map(q=>{
  const mostWrong=Object.entries(q.options||{}).filter(([i])=>Number(i)!==Number(q.correctAnswer)).sort((a,b)=>Number(b[1])-Number(a[1]))[0];
  return '<div class="pro-list-item"><div><h4>'+esc(q.text)+'</h4><p>'+q.attempts+' محاولة • '+esc(q.skill||'')+(mostWrong?' • أكثر خطأ: '+esc(q.opts?.[Number(mostWrong[0])]||''):'')+'</p></div><span class="pro-badge '+(q.pct!=null&&q.pct<50?'rejected':'approved')+'">'+(q.pct==null?'لا بيانات':q.pct+'% صحيحة')+'</span></div>';
 }).join(''):'<div class="pro-empty">ستظهر تحليلات الأسئلة بعد استخدام الأسئلة المعتمدة في اختبارات الطلاب.</div>';
}
function renderAttendance(){
 const rows=[];
 Object.entries(attendance||{}).forEach(([sessionId,students])=>Object.entries(students||{}).forEach(([uid,a])=>rows.push({sessionId,uid,...(a||{})})));
 rows.sort((a,b)=>Number(b.lastSeenAt||0)-Number(a.lastSeenAt||0));
 const box=$('proTeacherAttendance');if(!box)return;
 box.innerHTML=rows.length?rows.slice(0,20).map(a=>'<div class="pro-list-item"><div><h4>'+esc(a.studentName||'طالب')+'</h4><p>'+esc(a.sessionTitle||'حصة مباشرة')+' • '+new Date(Number(a.lastSeenAt||Date.now())).toLocaleString('ar-EG')+'</p></div><span class="pro-badge approved">'+Number(a.totalMinutes||0)+' دقيقة • '+Number(a.visits||0)+' دخول</span></div>').join(''):'<div class="pro-empty">لا توجد سجلات حضور حتى الآن.</div>';
}

function injectTargetingFields(){
 const quiz=$('teacherQuizForm'),assign=$('teacherAssignmentForm');
 if(quiz&&!$('teacherQuizTargetMode')){const wrap=document.createElement('div');wrap.className='full pro-form';wrap.innerHTML='<label><span>الجمهور</span><select id="teacherQuizTargetMode"><option value="class">كل الصف المحدد</option><option value="students">طلاب محددون</option></select></label><label><span>معرّفات الطلاب — عند الاختيار فقط</span><input id="teacherQuizTargetStudents" placeholder="UID1, UID2"></label>';quiz.querySelector('#teacherQuizTitle')?.closest('label')?.insertAdjacentElement('afterend',wrap)}
 if(assign&&!$('assignmentTargetMode')){const grid=assign.querySelector('.teacher-form-grid');if(grid){const wrap=document.createElement('div');wrap.className='full pro-form';wrap.innerHTML='<label><span>الجمهور</span><select id="assignmentTargetMode"><option value="class">كل الصف المحدد</option><option value="students">طلاب محددون</option></select></label><label><span>معرّفات الطلاب — عند الاختيار فقط</span><input id="assignmentTargetStudents" placeholder="UID1, UID2"></label>';grid.appendChild(wrap)}}
}
function renderAll(){populateScopes();renderBank();renderHeatmap();renderQuestionAnalytics();renderAttendance()}
auth.onAuthStateChanged(async u=>{
 if(!u)return;user=u;
 try{
  const [t,b,m,l,qs,at]=await Promise.all([db.ref('teacherProfiles/'+u.uid).once('value'),db.ref('questionBank').once('value'),db.ref('learningMatrix').once('value'),db.ref('lessons').once('value'),db.ref('questionAnalytics').once('value'),db.ref('attendance').once('value')]);teacher=t.val();if(!teacher||teacher.isActive!==true)return;bank=b.val()||{};matrix=m.val()||{};lessons=l.val()||{};questionStats=qs.val()||{};attendance=at.val()||{};addNavAndTab();renderAll();
  db.ref('questionBank').on('value',s=>{bank=s.val()||{};if($('proTeacherBankList')){renderBank();renderQuestionAnalytics()}});
  db.ref('learningMatrix').on('value',s=>{matrix=s.val()||{};if($('proTeacherHeatmap'))renderHeatmap()});
  db.ref('questionAnalytics').on('value',s=>{questionStats=s.val()||{};if($('proTeacherQuestionAnalytics'))renderQuestionAnalytics()});
  db.ref('attendance').on('value',s=>{attendance=s.val()||{};if($('proTeacherAttendance'))renderAttendance()});
 }catch(err){console.warn('Professional teacher suite unavailable',err)}
});
})();