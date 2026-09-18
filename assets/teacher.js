(() => {
'use strict';

const firebaseConfig = window.ACADEMY_FIREBASE_CONFIG || JSON.parse(localStorage.getItem('academyFirebaseConfig') || 'null');
if(!firebaseConfig){location.replace('./index.html');return}
if(!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth=firebase.auth(),db=firebase.database();
const $=id=>document.getElementById(id), $$=(s,r=document)=>[...r.querySelectorAll(s)];
let user=null,teacher=null,data={},submissions={},analytics={},homeworkAssignments={},assignmentSubmissions={},activeGrade=null;

const defaults={
 primary:[{id:'arabic',name:'اللغة العربية'},{id:'math',name:'الرياضيات'},{id:'science',name:'العلوم'},{id:'english',name:'اللغة الإنجليزية'},{id:'social',name:'الدراسات الاجتماعية'},{id:'religion',name:'التربية الدينية'}],
 prep:[{id:'arabic',name:'اللغة العربية'},{id:'math',name:'الرياضيات'},{id:'science',name:'العلوم'},{id:'english',name:'اللغة الإنجليزية'},{id:'social',name:'الدراسات الاجتماعية'},{id:'computer',name:'الحاسب الآلي'}],
 sec:[{id:'arabic',name:'اللغة العربية'},{id:'english',name:'اللغة الإنجليزية'},{id:'math',name:'الرياضيات'},{id:'physics',name:'الفيزياء'},{id:'chemistry',name:'الكيمياء'},{id:'biology',name:'الأحياء'},{id:'history',name:'التاريخ'},{id:'geography',name:'الجغرافيا'}]
};
const stageName={primary:'ابتدائي',prep:'إعدادي',sec:'ثانوي'};

function toast(msg,type='success'){
 const el=$('toast');el.textContent=msg;el.className='toast show '+type;
 clearTimeout(toast.t);toast.t=setTimeout(()=>el.className='toast',3000);
}
function normalizeAssignments(){
 if(Array.isArray(teacher.assignments)) return teacher.assignments.filter(Boolean);
 if(teacher.assignments && typeof teacher.assignments==='object') return Object.values(teacher.assignments).filter(Boolean);
 const arr=[];
 if(Array.isArray(teacher.subjects)){
   teacher.subjects.forEach(s=>arr.push(typeof s==='string'?{subject:s}:s));
 }
 return arr;
}
function getSubjects(stage,grade,type){
 const list=[...(defaults[stage]||[])], custom=data.customSubjects?.[stage]?.[grade];
 if(Array.isArray(custom))custom.forEach(s=>{
   if(!s?.id||!s?.name||(s.type&&s.type!==type))return;
   const i=list.findIndex(x=>x.id===s.id), item={id:s.id,name:s.name};
   if(i>=0)list[i]={...list[i],...item};else list.push(item);
 });
 const assignments=normalizeAssignments();
 if(!assignments.length) return list;
 const allowed=assignments.filter(a=>(!a.type||a.type===type)&&(!a.stage||a.stage===stage)&&(!a.grade||String(a.grade)===String(grade))).map(a=>a.subject).filter(Boolean);
 return allowed.length?list.filter(s=>allowed.includes(s.id)):list;
}
function updateGrades(){
 const stage=$('teacherStage').value,max=stage==='primary'?6:3;
 $('teacherGrade').innerHTML=Array.from({length:max},(_,i)=>i+1).map(g=>'<option value="'+g+'">الصف '+g+'</option>').join('');
 updateSubjects();
}
function updateSubjects(){
 const list=getSubjects($('teacherStage').value,$('teacherGrade').value,$('teacherEducationType').value);
 $('teacherSubject').innerHTML=list.map(s=>'<option value="'+s.id+'">'+s.name+'</option>').join('');
}
function switchTab(tab){
 $$('[data-teacher-tab]').forEach(b=>b.classList.toggle('active',b.dataset.teacherTab===tab));
 $$('.teacher-tab').forEach(s=>s.classList.add('hidden'));
 $('teacher-tab-'+tab).classList.remove('hidden');
 if(innerWidth<900)$('teacherSide').classList.remove('open');
}
function statusLabel(s){
 return s==='approved'?'معتمد':s==='rejected'?'مرفوض':'قيد المراجعة';
}
function renderSubmissionList(target,items){
 $(target).innerHTML=items.length?items.map(x=>'<article class="submission-item"><div><h4>'+escapeHtml(x.title||'محتوى بدون عنوان')+'</h4><p>'+(stageName[x.stage]||x.stage||'')+' • صف '+(x.grade||'')+' • '+(x.subjectName||x.subject||'')+'</p></div><span class="status-pill '+(x.status||'pending')+'">'+statusLabel(x.status)+'</span></article>').join(''):'<p class="profile-muted">لا يوجد محتوى هنا حتى الآن.</p>';
}
function escapeHtml(v=''){return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function ownLessons(){
 return Object.entries(data.lessons||{}).map(([id,v])=>({id,...(v||{})})).filter(l=>l.teacherId===user?.uid||Array.isArray(l.videos)&&l.videos.some(v=>v?.teacherId===user?.uid));
}
function metricFor(id){return analytics?.[id]||{}}
function renderTeacherAnalytics(){
 const lessons=ownLessons();
 const metrics=lessons.map(l=>({lesson:l,m:metricFor(l.id)}));
 const totalViews=metrics.reduce((a,x)=>a+Number(x.m.views||0),0);
 const totalCompletions=metrics.reduce((a,x)=>a+Number(x.m.completions||0),0);
 const quizAttempts=metrics.reduce((a,x)=>a+Number(x.m.quizAttempts||0),0);
 const scoreTotal=metrics.reduce((a,x)=>a+Number(x.m.quizScoreTotal||0),0);
 const completionRate=totalViews?Math.min(100,Math.round(totalCompletions/totalViews*100)):0;
 const averageQuiz=quizAttempts?Math.round(scoreTotal/quizAttempts):0;
 if($('teacherTotalViews'))$('teacherTotalViews').textContent=totalViews;
 if($('teacherTotalCompletions'))$('teacherTotalCompletions').textContent=totalCompletions;
 if($('teacherQuizAttempts'))$('teacherQuizAttempts').textContent=quizAttempts;
 if($('teacherCompletionRate'))$('teacherCompletionRate').textContent=completionRate+'%';

 const engagement=$('teacherEngagementList');
 if(engagement)engagement.innerHTML=metrics.length?metrics.map(x=>{
   const views=Number(x.m.views||0),done=Number(x.m.completions||0),rate=views?Math.min(100,Math.round(done/views*100)):0;
   return '<article class="teacher-engagement-item"><div><strong>'+escapeHtml(x.lesson.title||'درس')+'</strong><small>'+views+' مشاهدة • '+done+' إكمال</small></div><div class="teacher-mini-progress"><span style="width:'+rate+'%"></span></div><b>'+rate+'%</b></article>';
 }).join(''):'<div class="portal-empty-state"><span>📊</span><h3>لا يوجد محتوى منشور بعد</h3><p>بعد اعتماد أول درس ستبدأ التحليلات في الظهور.</p></div>';

 const top=[...metrics].sort((a,b)=>Number(b.m.views||0)-Number(a.m.views||0))[0];
 if($('teacherTopLesson'))$('teacherTopLesson').innerHTML=top?'<strong>'+escapeHtml(top.lesson.title||'درس')+'</strong><span>'+Number(top.m.views||0)+' مشاهدة</span>':'<strong>—</strong><span>لا توجد بيانات بعد</span>';
 if($('teacherAverageQuiz'))$('teacherAverageQuiz').innerHTML='<strong>'+averageQuiz+'%</strong><span>'+quizAttempts+' محاولة تدريب</span>';

 const list=$('teacherAnalyticsList');
 if(list)list.innerHTML=metrics.length?metrics.map(x=>{
   const views=Number(x.m.views||0),done=Number(x.m.completions||0),attempts=Number(x.m.quizAttempts||0),avg=Number(x.m.quizAverage||0);
   const rate=views?Math.min(100,Math.round(done/views*100)):0;
   return '<div class="teacher-analytics-row"><div><strong>'+escapeHtml(x.lesson.title||'درس')+'</strong><small>'+(stageName[x.lesson.stage]||x.lesson.stage||'')+' • صف '+(x.lesson.grade||'')+'</small></div><span><b>'+views+'</b><small>مشاهدة</small></span><span><b>'+rate+'%</b><small>إكمال</small></span><span><b>'+attempts+'</b><small>تدريب</small></span><span><b>'+avg+'%</b><small>متوسط</small></span></div>';
 }).join(''):'<div class="portal-empty-state"><span>📈</span><h3>لا توجد تحليلات بعد</h3><p>ستظهر الأرقام عندما يبدأ الطلاب في استخدام المحتوى.</p></div>';
}

function updateAssignmentGrades(){
 const stage=$('assignmentStage')?.value||'primary',max=stage==='primary'?6:3;
 if($('assignmentGrade'))$('assignmentGrade').innerHTML=Array.from({length:max},(_,i)=>'<option value="'+(i+1)+'">الصف '+(i+1)+'</option>').join('');
 updateAssignmentSubjects();
}
function updateAssignmentSubjects(){
 if(!$('assignmentSubject'))return;
 const list=getSubjects($('assignmentStage').value,$('assignmentGrade').value,$('assignmentEducationType').value);
 $('assignmentSubject').innerHTML=list.map(s=>'<option value="'+s.id+'">'+escapeHtml(s.name)+'</option>').join('');
}
function ownHomework(){
 return Object.entries(homeworkAssignments||{}).map(([id,v])=>({id,...(v||{})})).filter(a=>a.teacherId===user?.uid).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
}
function renderTeacherAssignments(){
 const own=ownHomework(),list=$('teacherAssignmentsList');
 if(list)list.innerHTML=own.length?own.map(a=>{
   const count=Object.keys(assignmentSubmissions[a.id]||{}).length;
   const due=a.dueAt?new Date(a.dueAt).toLocaleString('ar-EG'):'بدون موعد';
   return '<article class="teacher-engagement-item"><div><strong>'+escapeHtml(a.title||'واجب')+'</strong><small>'+(stageName[a.stage]||a.stage||'')+' • صف '+(a.grade||'')+' • '+escapeHtml(a.subjectName||a.subject||'')+' • '+count+' تسليم</small><small>آخر موعد: '+escapeHtml(due)+'</small></div><div class="admin-action-row"><button class="admin-action-btn danger" data-delete-assignment="'+a.id+'" title="حذف"><i class="fa-solid fa-trash"></i></button></div></article>';
 }).join(''):'<div class="portal-empty-state"><span>📝</span><h3>لسه مفيش واجبات</h3><p>أنشئ أول واجب من النموذج.</p></div>';
 $$('[data-delete-assignment]').forEach(b=>b.onclick=async()=>{if(!confirm('حذف الواجب وكل تسليماته؟'))return;await Promise.all([db.ref('assignments/'+b.dataset.deleteAssignment).remove(),db.ref('assignmentSubmissions/'+b.dataset.deleteAssignment).remove()]);toast('تم حذف الواجب')});

 const rows=[];
 own.forEach(a=>Object.entries(assignmentSubmissions[a.id]||{}).forEach(([uid,s])=>rows.push({assignment:a,uid,...(s||{})})));
 rows.sort((a,b)=>(b.submittedAt||0)-(a.submittedAt||0));
 const box=$('teacherAssignmentSubmissions');
 if(box)box.innerHTML=rows.length?rows.map(r=>{
   const graded=r.status==='graded';
   return '<div class="teacher-analytics-row assignment-review-row"><div><strong>'+escapeHtml(r.studentName||'طالب')+'</strong><small>'+escapeHtml(r.assignment.title||'واجب')+' • '+(r.submittedAt?new Date(r.submittedAt).toLocaleDateString('ar-EG'):'')+'</small></div><span><b>'+(graded?Number(r.score||0)+' / '+Number(r.maxScore||r.assignment.maxScore||100):'—')+'</b><small>الدرجة</small></span><span><b>'+(graded?'مصَحح':'جديد')+'</b><small>الحالة</small></span><button class="btn '+(graded?'btn-soft':'btn-primary')+'" data-grade-assignment="'+r.assignment.id+'|'+r.uid+'">'+(graded?'تعديل التصحيح':'تصحيح')+'</button></div>';
 }).join(''):'<div class="portal-empty-state"><span>📥</span><h3>لا توجد تسليمات بعد</h3><p>تسليمات الطلاب هتظهر هنا.</p></div>';
 $$('[data-grade-assignment]').forEach(b=>b.onclick=()=>openGradeSubmission(b.dataset.gradeAssignment));
}
async function submitTeacherAssignment(e){
 e.preventDefault();
 const subject=$('assignmentSubject').value,subjectName=$('assignmentSubject').selectedOptions[0]?.textContent||subject;
 const payload={
   title:$('assignmentTitle').value.trim(),instructions:$('assignmentInstructions').value.trim(),
   type:$('assignmentEducationType').value,stage:$('assignmentStage').value,grade:$('assignmentGrade').value,
   subject,subjectName,dueAt:$('assignmentDueAt').value?new Date($('assignmentDueAt').value).getTime():0,
   maxScore:Number($('assignmentMaxScore').value||100),teacherId:user.uid,teacherName:teacher.name||user.displayName||'المدرس',
   isHidden:false,createdAt:Date.now()
 };
 if(!payload.title||!payload.dueAt)return toast('أكمل عنوان الواجب وآخر موعد.','error');
 const btn=$('teacherAssignmentSubmitBtn');btn.disabled=true;
 try{const ref=db.ref('assignments').push();await ref.set(payload);homeworkAssignments[ref.key]=payload;e.target.reset();updateAssignmentGrades();renderTeacherAssignments();toast('تم نشر الواجب للطلاب ✅')}
 catch(err){console.error(err);toast('تعذر نشر الواجب.','error')}
 finally{btn.disabled=false}
}
function openGradeSubmission(key){
 const [assignmentId,uid]=key.split('|'),a=homeworkAssignments[assignmentId],s=assignmentSubmissions[assignmentId]?.[uid];if(!a||!s)return;
 activeGrade={assignmentId,uid};$('gradeModalTitle').textContent=(s.studentName||'طالب')+' • '+(a.title||'واجب');
 $('gradeSubmissionPreview').innerHTML='<div><small>إجابة الطالب</small><p>'+escapeHtml(s.answer||'لا توجد إجابة نصية')+'</p>'+(s.link?'<a href="'+escapeHtml(s.link)+'" target="_blank" rel="noopener">فتح الرابط المرفق <i class="fa-solid fa-arrow-up-right-from-square"></i></a>':'')+'</div>';
 const maxScore=Number(a.maxScore||100);$('gradeScore').max=maxScore;$('gradeScoreLabel').textContent='الدرجة من '+maxScore;
 $('gradeScore').value=s.status==='graded'?Number(s.score||0):'';$('gradeFeedback').value=s.feedback||'';
 $('teacherGradeModal').classList.remove('hidden');document.body.style.overflow='hidden';
}
function closeGradeModal(){activeGrade=null;$('teacherGradeModal')?.classList.add('hidden');document.body.style.overflow=''}
async function saveGrade(e){
 e.preventDefault();if(!activeGrade)return;
 const a=homeworkAssignments[activeGrade.assignmentId]||{},maxScore=Number(a.maxScore||100);
 const score=Math.max(0,Math.min(maxScore,Number($('gradeScore').value||0))),percent=Math.round(score/maxScore*100),feedback=$('gradeFeedback').value.trim();
 await db.ref('assignmentSubmissions/'+activeGrade.assignmentId+'/'+activeGrade.uid).update({status:'graded',score,maxScore,percent,feedback,gradedAt:Date.now(),gradedBy:user.uid});
 assignmentSubmissions[activeGrade.assignmentId]=assignmentSubmissions[activeGrade.assignmentId]||{};
 assignmentSubmissions[activeGrade.assignmentId][activeGrade.uid]={...(assignmentSubmissions[activeGrade.assignmentId][activeGrade.uid]||{}),status:'graded',score,maxScore,percent,feedback,gradedAt:Date.now(),gradedBy:user.uid};
 closeGradeModal();renderTeacherAssignments();toast('تم حفظ التصحيح وإرساله للطالب ✅');
}

function render(){
 const name=teacher.name||user.displayName||user.email.split('@')[0]||'أستاذنا';
 $('teacherTopName').textContent='أهلًا '+name+' 👋';$('teacherWelcomeName').textContent=name;
 const assignments=normalizeAssignments(),subs=Object.entries(submissions||{}).map(([id,v])=>({id,...v})).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
 const approved=subs.filter(s=>s.status==='approved'),pending=subs.filter(s=>(s.status||'pending')==='pending'),lessons=ownLessons();
 $('teacherApprovedCount').textContent=lessons.length||approved.length;$('teacherPendingCount').textContent=pending.length;
 $('teacherSubjectCount').textContent=new Set(assignments.map(a=>a.subject).filter(Boolean)).size||teacher.subjectCount||0;
 $('teacherGradeCount').textContent=new Set(assignments.map(a=>(a.stage||'')+'-'+(a.grade||'')).filter(x=>x!=='-')).size||teacher.gradeCount||0;

 $('teacherAssignments').innerHTML=assignments.length?assignments.map(a=>'<article class="teacher-assignment"><span>📘</span><div><strong>'+(a.subjectName||a.subject||'مادة مسندة')+'</strong><small>'+(a.type==='azhar'?'أزهر':'تعليم عام')+' • '+(stageName[a.stage]||a.stage||'كل المراحل')+' • '+(a.grade?'صف '+a.grade:'كل الصفوف')+'</small></div></article>').join(''):'<p class="profile-muted">لم تحدد الإدارة موادًا بعينها بعد.</p>';
 renderSubmissionList('teacherRecentSubmissions',subs.slice(0,5));
 if($('teacherApprovedList')){
   $('teacherApprovedList').innerHTML=lessons.length?lessons.map(l=>'<article class="submission-item"><div><h4>'+escapeHtml(l.title||'درس')+'</h4><p>'+(stageName[l.stage]||l.stage||'')+' • صف '+(l.grade||'')+' • '+(l.subject||'')+'</p></div><span class="status-pill approved">منشور</span></article>').join(''):'<p class="profile-muted">لا يوجد محتوى منشور حتى الآن.</p>';
 }
 renderTeacherAnalytics();
 renderTeacherAssignments();
}
async function submitContent(e){
 e.preventDefault();
 const btn=$('teacherSubmitBtn'),subjectId=$('teacherSubject').value,subjectName=$('teacherSubject').selectedOptions[0]?.textContent||subjectId;
 const payload={
   title:$('teacherLessonTitle').value.trim(),videoUrl:$('teacherVideoUrl').value.trim(),
   type:$('teacherEducationType').value,stage:$('teacherStage').value,grade:$('teacherGrade').value,
   subject:subjectId,subjectName,unit:Number($('teacherUnit').value||1),notes:$('teacherNotes').value.trim(),
   status:'pending',teacherId:user.uid,teacherName:teacher.name||user.displayName||'',createdAt:Date.now()
 };
 if(!payload.title||!payload.videoUrl)return toast('أكمل عنوان الدرس ورابط الفيديو.','error');
 btn.disabled=true;btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> جاري الإرسال...';
 try{
   const ref=db.ref('teacherSubmissions/'+user.uid).push();await ref.set(payload);submissions[ref.key]=payload;
   $('teacherSubmissionForm').reset();updateGrades();render();switchTab('home');toast('تم إرسال المحتوى للإدارة للمراجعة ✅');
 }catch(err){console.error(err);toast('تعذر الإرسال. راجع صلاحيات Firebase أو حاول لاحقًا.','error')}
 finally{btn.disabled=false;btn.innerHTML='<i class="fa-solid fa-paper-plane"></i> إرسال للمراجعة'}
}
function showNoAccess(message){
 $('teacherPortal').classList.add('hidden');$('teacherAccess').classList.remove('hidden');$('teacherAccessText').textContent=message;
}
$$('[data-teacher-tab]').forEach(b=>b.onclick=()=>switchTab(b.dataset.teacherTab));
$$('[data-open-teacher-submit]').forEach(b=>b.onclick=()=>switchTab('submit'));
$('teacherStage').addEventListener('change',updateGrades);$('teacherGrade').addEventListener('change',updateSubjects);$('teacherEducationType').addEventListener('change',updateSubjects);
$('teacherSubmissionForm').addEventListener('submit',submitContent);
$('teacherAssignmentForm')?.addEventListener('submit',submitTeacherAssignment);
$('assignmentStage')?.addEventListener('change',updateAssignmentGrades);
$('assignmentGrade')?.addEventListener('change',updateAssignmentSubjects);
$('assignmentEducationType')?.addEventListener('change',updateAssignmentSubjects);
$('teacherGradeForm')?.addEventListener('submit',saveGrade);
$('closeTeacherGradeModal')?.addEventListener('click',closeGradeModal);
$('teacherGradeModal')?.addEventListener('click',e=>{if(e.target===$('teacherGradeModal'))closeGradeModal()});
$('teacherMenuBtn').onclick=()=>$('teacherSide').classList.toggle('open');
$('teacherLogout').onclick=async()=>{await auth.signOut();location.replace('./index.html')};

auth.onAuthStateChanged(async u=>{
 if(!u){showNoAccess('سجّل الدخول أولًا من المنصة، وبعدها افتح بوابة المدرس.');return}
 user=u;
 try{
   const [t,subjectsSnap,s,lessonsSnap,analyticsSnap,homeworkSnap]=await Promise.all([
     db.ref('teacherProfiles/'+u.uid).once('value'),
     db.ref('customSubjects').once('value'),
     db.ref('teacherSubmissions/'+u.uid).once('value'),
     db.ref('lessons').once('value'),
     db.ref('contentAnalytics').once('value'),
     db.ref('assignments').once('value')
   ]);
   teacher=t.val();data={customSubjects:subjectsSnap.val()||{},lessons:lessonsSnap.val()||{}};submissions=s.val()||{};analytics=analyticsSnap.val()||{};homeworkAssignments=homeworkSnap.val()||{};
   if(!teacher){showNoAccess('الحساب الحالي ليس له ملف مدرس. الإدارة لازم تضيفه كمدرس أولًا.');return}
   if(teacher.isActive===false||teacher.status==='blocked'){showNoAccess('حساب المدرس غير مفعل حاليًا. تواصل مع الإدارة.');return}
   const ownIds=Object.entries(homeworkAssignments).filter(([,a])=>a?.teacherId===u.uid).map(([id])=>id);
   const snaps=await Promise.all(ownIds.map(id=>db.ref('assignmentSubmissions/'+id).once('value')));
   assignmentSubmissions={};ownIds.forEach((id,i)=>assignmentSubmissions[id]=snaps[i].val()||{});
   $('teacherAccess').classList.add('hidden');$('teacherPortal').classList.remove('hidden');updateGrades();updateAssignmentGrades();render();
 }catch(err){console.error(err);showNoAccess('تعذر تحميل صلاحيات المدرس الآن.')}
});
})();