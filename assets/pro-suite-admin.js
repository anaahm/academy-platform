(function proAdminSafe(){
'use strict';
if(!window.firebase)return;
const app=firebase.apps[0],auth=app.auth(),db=app.database(),$=id=>document.getElementById(id),esc=(v='')=>String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let user=null,bank={},audit={},matrix={},ratings={};
function toast(msg,type='success'){const el=$('toast');if(!el)return;el.textContent=msg;el.className='toast show '+type;clearTimeout(toast.t);toast.t=setTimeout(()=>el.className='toast',3200)}
async function log(action,targetId,meta={}){
 try{await db.ref('auditLog').push().set({actorId:user.uid,actorRole:'admin',actorName:user.email||'admin',action,targetId,meta,createdAt:Date.now()})}catch{}
}
function addUI(){
 const nav=document.querySelector('.admin-nav'),page=document.querySelector('.admin-page');if(!nav||!page||$('admin-tab-pro-suite'))return;
 const before=nav.querySelector('[data-admin-tab="settings"]'),btn=document.createElement('button');btn.id='adminProTabBtn';btn.type='button';btn.className='pro-admin-nav-btn';btn.innerHTML='<i class="fa-solid fa-brain"></i> النظام الذكي <span id="proQuestionPendingBadge" class="nav-badge hidden">0</span>';before?nav.insertBefore(btn,before):nav.appendChild(btn);
 const sec=document.createElement('section');sec.className='admin-tab';sec.id='admin-tab-pro-suite';sec.style.display='none';
 sec.innerHTML='<div class="admin-section-head"><div><span class="section-kicker">مركز التحكم المتقدم</span><h2>بنك الأسئلة والتحليلات وسجل النظام</h2><p>مراجعة أسئلة المعلمين وقراءة مؤشرات الإتقان والفهم.</p></div></div>'+
 '<section class="pro-kpi-grid" id="proAdminKpis"></section>'+
 '<article class="pro-panel"><div class="pro-panel-head"><div><h2>أسئلة بانتظار المراجعة</h2><p>لن تدخل الاختبارات التكيفية أو التوليد التلقائي قبل الموافقة.</p></div></div><div class="pro-list" id="proAdminQuestions"></div></article>'+
 '<div class="pro-two-col"><article class="pro-panel"><div class="pro-panel-head"><div><h2>ملخص الإتقان</h2><p>قراءة سريعة لحالة الطلاب عبر المواد.</p></div></div><div id="proAdminMastery"></div></article><article class="pro-panel"><div class="pro-panel-head"><div><h2>فهم الطلاب للدروس</h2><p>تجميع تقييمات: فهمت / إلى حد ما / أحتاج مراجعة.</p></div></div><div class="pro-list" id="proAdminRatings"></div></article></div>'+
 '<article class="pro-panel"><div class="pro-panel-head"><div><h2>سجل التعديلات</h2><p>من فعل ماذا ومتى داخل الأدوات الاحترافية.</p></div></div><div class="pro-list" id="proAuditList"></div></article>';
 page.appendChild(sec);
 btn.onclick=()=>{document.querySelectorAll('.admin-tab').forEach(x=>{x.classList.remove('active');x.style.display='none'});sec.classList.add('active');sec.style.display='block';document.querySelectorAll('.admin-nav button').forEach(x=>x.classList.remove('active'));btn.classList.add('active');renderAll()};
 document.querySelectorAll('.admin-nav [data-admin-tab]').forEach(x=>x.addEventListener('click',()=>{btn.classList.remove('active');sec.style.display='none'}));
}
function renderKpis(){
 const qs=Object.values(bank||{}),pending=qs.filter(q=>q?.status==='pending').length,approved=qs.filter(q=>q?.status==='approved').length,students=Object.keys(matrix||{}).length;
 $('proAdminKpis').innerHTML='<article class="pro-kpi"><strong>'+qs.length+'</strong><span>سؤال في البنك</span></article><article class="pro-kpi"><strong>'+pending+'</strong><span>بانتظار المراجعة</span></article><article class="pro-kpi"><strong>'+approved+'</strong><span>سؤال معتمد</span></article><article class="pro-kpi"><strong>'+students+'</strong><span>طلاب لهم بيانات إتقان</span></article>';
 const badge=$('proQuestionPendingBadge');if(badge){badge.textContent=pending;badge.classList.toggle('hidden',!pending)}
}
function renderQuestions(){
 const arr=Object.entries(bank||{}).map(([id,q])=>({id,...(q||{})})).filter(q=>q.status==='pending').sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
 $('proAdminQuestions').innerHTML=arr.length?arr.map(q=>'<div class="pro-list-item" style="align-items:flex-start"><div><h4>'+esc(q.text||'سؤال')+'</h4><p>'+esc(q.teacherName||'معلم')+' • '+esc(q.subject||'')+' • '+esc(q.skill||'')+' • صعوبة '+Number(q.difficulty||2)+'</p><small style="color:#64748b">الإجابة: '+esc(q.opts?.[q.correctAnswer]||'—')+(q.explanation?' • '+esc(q.explanation):'')+'</small></div><div class="pro-toolbar"><button class="pro-btn success" data-approve-question="'+q.id+'">اعتماد</button><button class="pro-btn danger" data-reject-question="'+q.id+'">رفض</button></div></div>').join(''):'<div class="pro-empty">لا توجد أسئلة معلقة الآن ✅</div>';
 document.querySelectorAll('[data-approve-question]').forEach(b=>b.onclick=()=>reviewQuestion(b.dataset.approveQuestion,true));document.querySelectorAll('[data-reject-question]').forEach(b=>b.onclick=()=>reviewQuestion(b.dataset.rejectQuestion,false));
}
async function reviewQuestion(id,approved){
 const q=bank[id];if(!q)return;
 try{await db.ref('questionBank/'+id).update({status:approved?'approved':'rejected',reviewedAt:Date.now(),reviewedBy:user.uid});await log(approved?'question_approved':'question_rejected',id,{teacherId:q.teacherId||'',subject:q.subject||''});toast(approved?'تم اعتماد السؤال ✅':'تم رفض السؤال')}catch(err){console.error(err);toast('تعذر تحديث السؤال.','error')}
}
function renderMastery(){
 const rows=Object.values(matrix||{}),vals=[];rows.forEach(r=>Object.entries(r.subjects||{}).forEach(([s,x])=>vals.push({s,mastery:Number(x.mastery||0),errors:Number(x.errors||0)})));
 const map={};vals.forEach(x=>{map[x.s]=map[x.s]||{total:0,count:0,errors:0};map[x.s].total+=x.mastery;map[x.s].count++;map[x.s].errors+=x.errors});
 const arr=Object.entries(map).map(([s,x])=>({s,avg:x.count?Math.round(x.total/x.count):0,errors:x.errors,count:x.count})).sort((a,b)=>a.avg-b.avg);
 $('proAdminMastery').innerHTML=arr.length?'<div class="pro-list">'+arr.map(x=>'<div class="pro-list-item"><div><h4>'+esc(x.s)+'</h4><p>'+x.count+' طالب • '+x.errors+' خطأ معلق</p></div><span class="pro-mastery-pill '+(x.avg>=80?'mastered':x.avg>=60?'learning':'review')+'">'+x.avg+'%</span></div>').join('')+'</div>':'<div class="pro-empty">لا توجد بيانات إتقان بعد.</div>';
}
function renderRatings(){
 const sums={understood:0,partial:0,not_understood:0};Object.values(ratings||{}).forEach(byStudent=>Object.values(byStudent||{}).forEach(r=>{if(sums[r?.value]!=null)sums[r.value]++}));
 const total=sums.understood+sums.partial+sums.not_understood;
 $('proAdminRatings').innerHTML=total?'<div class="pro-list-item"><div><h4>فهمت</h4><p>تقييمات إيجابية</p></div><span class="pro-badge approved">'+sums.understood+'</span></div><div class="pro-list-item"><div><h4>إلى حد ما</h4><p>تحتاج تثبيتًا</p></div><span class="pro-badge pending">'+sums.partial+'</span></div><div class="pro-list-item"><div><h4>أحتاج مراجعة</h4><p>أولوية علاجية</p></div><span class="pro-badge rejected">'+sums.not_understood+'</span></div>':'<div class="pro-empty">لا توجد تقييمات فهم حتى الآن.</div>';
}
function renderAudit(){
 const arr=Object.entries(audit||{}).map(([id,x])=>({id,...x})).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)),labels={question_submitted:'إرسال سؤال',question_approved:'اعتماد سؤال',question_rejected:'رفض سؤال',auto_quiz_submitted:'إنشاء اختبار تلقائي',certificate_registered:'تسجيل شهادة'};
 $('proAuditList').innerHTML=arr.length?arr.slice(0,40).map(x=>'<div class="pro-list-item"><div><h4>'+esc(labels[x.action]||x.action||'تعديل')+'</h4><p>'+esc(x.actorName||x.actorId||'')+' • '+new Date(x.createdAt||0).toLocaleString('ar-EG')+'</p></div><span class="pro-badge">'+esc(x.actorRole||'system')+'</span></div>').join(''):'<div class="pro-empty">لا توجد عمليات مسجلة بعد.</div>';
}
function renderAll(){renderKpis();renderQuestions();renderMastery();renderRatings();renderAudit()}
auth.onAuthStateChanged(async u=>{if(!u)return;user=u;try{const [b,a,m,lr]=await Promise.all([db.ref('questionBank').once('value'),db.ref('auditLog').limitToLast(100).once('value'),db.ref('learningMatrix').once('value'),db.ref('lessonRatings').once('value')]);bank=b.val()||{};audit=a.val()||{};matrix=m.val()||{};ratings=lr.val()||{};addUI();renderAll();db.ref('questionBank').on('value',s=>{bank=s.val()||{};if($('proAdminQuestions')){renderKpis();renderQuestions()}});db.ref('auditLog').limitToLast(100).on('value',s=>{audit=s.val()||{};if($('proAuditList'))renderAudit()})}catch(err){console.warn('Pro admin suite unavailable',err)}});
})();