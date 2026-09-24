(() => {
'use strict';

const firebaseConfig = window.ACADEMY_FIREBASE_CONFIG || JSON.parse(localStorage.getItem('academyFirebaseConfig') || 'null');
if(!firebaseConfig){location.replace('./index.html');return}
if(!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth=firebase.auth(),db=firebase.database();
const $=id=>document.getElementById(id), $$=(s,r=document)=>[...r.querySelectorAll(s)];
let user=null,teacher=null,data={},submissions={},analytics={},homeworkAssignments={},assignmentSubmissions={},activeGrade=null,gradeModalTrigger=null;

const defaults={
 primary:[{id:'arabic',name:'اللغة العربية'},{id:'math',name:'الرياضيات'},{id:'science',name:'العلوم'},{id:'english',name:'اللغة الإنجليزية'},{id:'social',name:'الدراسات الاجتماعية'},{id:'religion',name:'التربية الدينية'}],
 prep:[{id:'arabic',name:'اللغة العربية'},{id:'math',name:'الرياضيات'},{id:'science',name:'العلوم'},{id:'english',name:'اللغة الإنجليزية'},{id:'social',name:'الدراسات الاجتماعية'},{id:'computer',name:'الحاسب الآلي'}],
 sec:[{id:'arabic',name:'اللغة العربية'},{id:'english',name:'اللغة الإنجليزية'},{id:'math',name:'الرياضيات'},{id:'physics',name:'الفيزياء'},{id:'chemistry',name:'الكيمياء'},{id:'biology',name:'الأحياء'},{id:'history',name:'التاريخ'},{id:'geography',name:'الجغرافيا'}]
};
const stageName={primary:'ابتدائي',prep:'إعدادي',sec:'ثانوي'};

function safeUrl(u=''){
 try{const x=new URL(u);return ['http:','https:'].includes(x.protocol)?x.href:'#'}catch{return'#'}
}
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
 if(!assignments.length) return [];
 const allowed=assignments.filter(a=>(!a.type||a.type===type)&&(!a.stage||a.stage===stage)&&(!a.grade||String(a.grade)===String(grade))).map(a=>a.subject).filter(Boolean);
 return allowed.length?list.filter(s=>allowed.includes(s.id)):[];
}
function assignmentAllowed(type,stage,grade,subject){
 const assignments=normalizeAssignments();
 return assignments.some(a=>
   (!a.type||a.type===type)&&
   (!a.stage||a.stage===stage)&&
   (!a.grade||String(a.grade)===String(grade))&&
   (!a.subject||a.subject===subject)
 );
}
function updateSubmitAvailability(){
 const contentOk=!!$('teacherSubject')?.value;
 if($('teacherSubmitBtn'))$('teacherSubmitBtn').disabled=!contentOk;
 const assignmentOk=!!$('assignmentSubject')?.value;
 if($('teacherAssignmentSubmitBtn'))$('teacherAssignmentSubmitBtn').disabled=!assignmentOk;
}
function updateGrades(){
 const stage=$('teacherStage').value,max=stage==='primary'?6:3;
 $('teacherGrade').innerHTML=Array.from({length:max},(_,i)=>i+1).map(g=>'<option value="'+g+'">الصف '+g+'</option>').join('');
 updateSubjects();
}
function updateSubjects(){
 const list=getSubjects($('teacherStage').value,$('teacherGrade').value,$('teacherEducationType').value);
 $('teacherSubject').innerHTML=list.length
   ?list.map(s=>'<option value="'+escapeHtml(s.id)+'">'+escapeHtml(s.name)+'</option>').join('')
   :'<option value="">لا توجد مادة مسندة لهذا الصف</option>';
 updateSubmitAvailability();
}
function initTeacherCollapse(){
 const shell=$('teacherPortal'),btn=$('teacherCollapseBtn');if(!shell||!btn)return;
 const apply=()=>{const collapsed=innerWidth>900&&localStorage.getItem('academyTeacherCollapsed')==='1';shell.classList.toggle('teacher-collapsed',collapsed)};
 apply();
 btn.onclick=()=>{if(innerWidth<=900)return;const next=!shell.classList.contains('teacher-collapsed');shell.classList.toggle('teacher-collapsed',next);localStorage.setItem('academyTeacherCollapsed',next?'1':'0')};
 $$('[data-teacher-tab]').forEach(el=>{if(!el.title)el.title=el.textContent.trim().replace(/\s+/g,' ')});
 window.addEventListener('resize',apply,{passive:true});
}
function switchTab(tab,updateUrl=true){
 const allowed=['home','content','submit','assignments','students','analytics'];
 if(!allowed.includes(tab))tab='home';
 const labels={
   home:['الرئيسية','ملخص عملك التعليمي اليوم'],
   content:['محتواي','الدروس والفيديوهات المنشورة باسمك'],
   submit:['إضافة محتوى','أرسل درسًا جديدًا لمراجعة الإدارة'],
   assignments:['الواجبات','إنشاء الواجبات ومتابعة تسليمات الطلاب'],
   students:['تفاعل الطلاب','إحصائيات مجمعة لأداء محتواك'],
   analytics:['الإحصائيات','تحليل المشاهدات والإكمال ونتائج التدريبات']
 };
 if($('teacherTopRole'))$('teacherTopRole').textContent=labels[tab]?.[1]||'بوابة إدارة المحتوى التعليمي';
 $('.teacher-nav [data-teacher-tab]').forEach(b=>{
   const active=b.dataset.teacherTab===tab;
   b.classList.toggle('active',active);b.setAttribute('aria-selected',active?'true':'false');b.tabIndex=active?0:-1;
 });
 $$('.teacher-tab').forEach(s=>s.classList.add('hidden'));
 $('teacher-tab-'+tab)?.classList.remove('hidden');
 if(updateUrl){
   const url=new URL(location.href);
   if(tab==='home')url.searchParams.delete('tab');else url.searchParams.set('tab',tab);
   history.replaceState({},'',url);
 }
 if(innerWidth<900){$('teacherSide').classList.remove('open');$('teacherOverlay')?.classList.add('hidden')}
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
 $('assignmentSubject').innerHTML=list.length
   ?list.map(s=>'<option value="'+escapeHtml(s.id)+'">'+escapeHtml(s.name)+'</option>').join('')
   :'<option value="">لا توجد مادة مسندة لهذا الصف</option>';
 updateSubmitAvailability();
}
function ownHomework(){
 return Object.entries(homeworkAssignments||{}).map(([id,v])=>({id,...(v||{})})).filter(a=>a.teacherId===user?.uid).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
}
function renderTeacherAssignments(){
 const own=ownHomework(),list=$('teacherAssignmentsList');
 if(list)list.innerHTML=own.length?own.map(a=>{
   const rows=Object.values(assignmentSubmissions[a.id]||{}),count=rows.length,graded=rows.filter(s=>s?.status==='graded').length,newCount=Math.max(0,count-graded);
   const dueAt=Number(a.dueAt||0),isPast=!!dueAt&&Date.now()>dueAt,due=dueAt?new Date(dueAt).toLocaleString('ar-EG'):'بدون موعد';
   return '<article class="teacher-homework-card '+(isPast?'closed':'active')+'">'+
     '<div class="teacher-homework-main"><span class="teacher-homework-icon"><i class="fa-solid fa-clipboard-check"></i></span><div><div class="teacher-homework-title-row"><strong>'+escapeHtml(a.title||'واجب')+'</strong><span class="status-pill '+(isPast?'rejected':'approved')+'">'+(isPast?'انتهى الموعد':'نشط')+'</span></div>'+
     '<small>'+(stageName[a.stage]||a.stage||'')+' • صف '+(a.grade||'')+' • '+escapeHtml(a.subjectName||a.subject||'')+'</small>'+
     '<small><i class="fa-regular fa-calendar"></i> '+escapeHtml(due)+'</small></div></div>'+
     '<div class="teacher-homework-metrics"><span><b>'+count+'</b><small>تسليم</small></span><span class="'+(newCount?'has-new':'')+'"><b>'+newCount+'</b><small>جديد</small></span><span><b>'+graded+'</b><small>مصحح</small></span></div>'+
     '<button class="admin-action-btn danger" data-delete-assignment="'+a.id+'" title="حذف الواجب" aria-label="حذف '+escapeHtml(a.title||'الواجب')+'"><i class="fa-solid fa-trash"></i></button>'+
   '</article>';
 }).join(''):'<div class="portal-empty-state"><span>📝</span><h3>لسه مفيش واجبات</h3><p>أنشئ أول واجب من النموذج.</p></div>';

 $$('[data-delete-assignment]').forEach(b=>b.onclick=async()=>{
   if(!(await window.AcademyUI.confirm({title:'حذف الواجب؟',message:'سيتم حذف الواجب وكل تسليمات الطلاب المرتبطة به نهائيًا.',tone:'danger',acceptText:'حذف الواجب'})))return;
   const id=b.dataset.deleteAssignment;b.disabled=true;
   try{
     await db.ref('assignmentSubmissions/'+id).remove();
     await db.ref('assignments/'+id).remove();
     delete assignmentSubmissions[id];delete homeworkAssignments[id];renderTeacherAssignments();toast('تم حذف الواجب');
   }catch(err){console.error(err);b.disabled=false;toast('تعذر حذف الواجب الآن.','error')}
 });

 const rows=[];
 own.forEach(a=>Object.entries(assignmentSubmissions[a.id]||{}).forEach(([uid,s])=>rows.push({assignment:a,uid,...(s||{})})));
 rows.sort((a,b)=>{
   const ag=a.status==='graded'?1:0,bg=b.status==='graded'?1:0;
   return ag-bg||(b.submittedAt||0)-(a.submittedAt||0);
 });
 const box=$('teacherAssignmentSubmissions');
 if(box)box.innerHTML=rows.length?rows.map(r=>{
   const graded=r.status==='graded',late=r.late===true||(!r.late&&r.assignment.dueAt&&Number(r.submittedAt||0)>Number(r.assignment.dueAt));
   const submitted=r.submittedAt?new Date(r.submittedAt).toLocaleString('ar-EG'):'بدون وقت';
   return '<div class="teacher-analytics-row assignment-review-row '+(graded?'graded':'new-submission')+'">'+
     '<div><div class="teacher-student-title"><strong>'+escapeHtml(r.studentName||'طالب')+'</strong>'+(late?'<span class="status-pill rejected">متأخر</span>':'')+'</div><small>'+escapeHtml(r.assignment.title||'واجب')+'</small><small>'+escapeHtml(submitted)+'</small></div>'+
     '<span><b>'+(graded?Number(r.score||0)+' / '+Number(r.maxScore||r.assignment.maxScore||100):'—')+'</b><small>الدرجة</small></span>'+
     '<span><b>'+(graded?'مصحح':'جديد')+'</b><small>الحالة</small></span>'+
     '<button class="btn '+(graded?'btn-soft':'btn-primary')+'" data-grade-assignment="'+r.assignment.id+'|'+r.uid+'">'+(graded?'تعديل التصحيح':'تصحيح الآن')+'</button>'+
   '</div>';
 }).join(''):'<div class="portal-empty-state"><span>📥</span><h3>لا توجد تسليمات بعد</h3><p>تسليمات الطلاب هتظهر هنا، والجديد سيظهر أولًا.</p></div>';
 $$('[data-grade-assignment]').forEach(b=>b.onclick=()=>openGradeSubmission(b.dataset.gradeAssignment,b));
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
 if(!assignmentAllowed(payload.type,payload.stage,payload.grade,payload.subject))return toast('لا يمكنك نشر واجب لمادة غير مسندة إلى حسابك.','error');
 if(payload.dueAt<=Date.now())return toast('اختر موعد تسليم في المستقبل.','error');
 if(!Number.isFinite(payload.maxScore)||payload.maxScore<1||payload.maxScore>1000)return toast('الدرجة النهائية يجب أن تكون بين 1 و1000.','error');
 const btn=$('teacherAssignmentSubmitBtn');
 window.AcademyUI?.setButtonLoading(btn,true,'نشر');
 try{
   const ref=db.ref('assignments').push();await ref.set(payload);homeworkAssignments[ref.key]=payload;
   e.target.reset();updateAssignmentGrades();renderTeacherAssignments();toast('تم نشر الواجب للطلاب ✅');
 }catch(err){console.error(err);toast('تعذر نشر الواجب. حاول مرة أخرى.','error')}
 finally{window.AcademyUI?.setButtonLoading(btn,false);updateSubmitAvailability()}
}
function openGradeSubmission(key,trigger=null){
 const [assignmentId,uid]=key.split('|'),a=homeworkAssignments[assignmentId],s=assignmentSubmissions[assignmentId]?.[uid];if(!a||!s)return;
 gradeModalTrigger=trigger;activeGrade={assignmentId,uid};$('gradeModalTitle').textContent=(s.studentName||'طالب')+' • '+(a.title||'واجب');
 $('gradeSubmissionPreview').innerHTML='<div><small>إجابة الطالب</small><p>'+escapeHtml(s.answer||'لا توجد إجابة نصية')+'</p>'+(s.link?'<a href="'+escapeHtml(safeUrl(s.link))+'" target="_blank" rel="noopener">فتح الرابط المرفق <i class="fa-solid fa-arrow-up-right-from-square"></i></a>':'')+'</div>';
 const maxScore=Number(a.maxScore||100);$('gradeScore').max=maxScore;$('gradeScoreLabel').textContent='الدرجة من '+maxScore;
 $('gradeScore').value=s.status==='graded'?Number(s.score||0):'';$('gradeFeedback').value=s.feedback||'';
 $('teacherGradeModal').classList.remove('hidden');$('teacherGradeModal').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';
 setTimeout(()=>$('gradeScore')?.focus(),30);
}
function closeGradeModal(){
 activeGrade=null;$('teacherGradeModal')?.classList.add('hidden');$('teacherGradeModal')?.setAttribute('aria-hidden','true');document.body.style.overflow='';
 const target=gradeModalTrigger;gradeModalTrigger=null;setTimeout(()=>target?.focus(),30);
}
async function saveGrade(e){
 e.preventDefault();if(!activeGrade)return;
 const a=homeworkAssignments[activeGrade.assignmentId]||{},maxScore=Number(a.maxScore||100),raw=$('gradeScore').value;
 if(raw==='')return toast('أدخل درجة الطالب.','error');
 const score=Number(raw);
 if(!Number.isFinite(score)||score<0||score>maxScore)return toast('الدرجة يجب أن تكون بين 0 و'+maxScore+'.','error');
 const percent=Math.round(score/maxScore*100),feedback=$('gradeFeedback').value.trim(),btn=e.submitter||e.target.querySelector('button[type="submit"]');
 window.AcademyUI?.setButtonLoading(btn,true,'حفظ');
 try{
   const patch={status:'graded',score,maxScore,percent,feedback,gradedAt:Date.now(),gradedBy:user.uid};
   await db.ref('assignmentSubmissions/'+activeGrade.assignmentId+'/'+activeGrade.uid).update(patch);
   assignmentSubmissions[activeGrade.assignmentId]=assignmentSubmissions[activeGrade.assignmentId]||{};
   assignmentSubmissions[activeGrade.assignmentId][activeGrade.uid]={...(assignmentSubmissions[activeGrade.assignmentId][activeGrade.uid]||{}),...patch};
   closeGradeModal();renderTeacherAssignments();toast('تم حفظ التصحيح وإرساله للطالب ✅');
 }catch(err){console.error(err);toast('تعذر حفظ التصحيح الآن.','error')}
 finally{window.AcademyUI?.setButtonLoading(btn,false)}
}

function render(){
 const name=teacher.name||user.displayName||user.email.split('@')[0]||'أستاذنا';
 $('teacherTopName').textContent='أهلًا '+name+' 👋';$('teacherWelcomeName').textContent=name;
 const assignments=normalizeAssignments(),subs=Object.entries(submissions||{}).map(([id,v])=>({id,...v})).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
 const approved=subs.filter(s=>s.status==='approved'),pending=subs.filter(s=>(s.status||'pending')==='pending'),lessons=ownLessons();
 $('teacherApprovedCount').textContent=lessons.length||approved.length;$('teacherPendingCount').textContent=pending.length;
 $('teacherSubjectCount').textContent=new Set(assignments.map(a=>a.subject).filter(Boolean)).size||teacher.subjectCount||0;
 $('teacherGradeCount').textContent=new Set(assignments.map(a=>(a.stage||'')+'-'+(a.grade||'')).filter(x=>x!=='-')).size||teacher.gradeCount||0;

 $('teacherAssignments').innerHTML=assignments.length?assignments.map(a=>'<article class="teacher-assignment"><span>📘</span><div><strong>'+escapeHtml(a.subjectName||a.subject||'مادة مسندة')+'</strong><small>'+(a.type==='azhar'?'أزهر':'تعليم عام')+' • '+escapeHtml(stageName[a.stage]||a.stage||'كل المراحل')+' • '+(a.grade?'صف '+escapeHtml(a.grade):'كل الصفوف')+'</small></div><i class="fa-solid fa-circle-check teacher-assigned-check"></i></article>').join(''):'<div class="portal-empty-state compact"><span>🔒</span><h3>لا توجد مواد مسندة بعد</h3><p>لن تتمكن من إرسال محتوى أو واجبات حتى تسند الإدارة مادة لحسابك.</p></div>';
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
 if(!assignmentAllowed(payload.type,payload.stage,payload.grade,payload.subject))return toast('هذه المادة غير مسندة إلى حسابك.','error');
 try{
   const video=new URL(payload.videoUrl);
   if(!['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(video.hostname))return toast('أدخل رابط YouTube صحيحًا.','error');
 }catch{return toast('رابط الفيديو غير صحيح.','error')}
 window.AcademyUI?.setButtonLoading(btn,true,'إرسال');
 try{
   const ref=db.ref('teacherSubmissions/'+user.uid).push();await ref.set(payload);submissions[ref.key]=payload;
   $('teacherSubmissionForm').reset();updateGrades();render();switchTab('home');toast('تم إرسال المحتوى للإدارة للمراجعة ✅');
 }catch(err){console.error(err);toast('تعذر الإرسال. راجع الاتصال أو حاول لاحقًا.','error')}
 finally{window.AcademyUI?.setButtonLoading(btn,false);updateSubmitAvailability()}
}
function showNoAccess(message){
 window.AcademyUI?.hidePageLoading();
 $('teacherPortal').classList.add('hidden');$('teacherAccess').classList.remove('hidden');$('teacherAccessText').textContent=message;
}
const teacherNavTabs=$$('.teacher-nav [data-teacher-tab]');
teacherNavTabs.forEach((b,i)=>b.onkeydown=e=>{
 if(!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return;
 e.preventDefault();
 let next=i;
 if(e.key==='ArrowRight')next=(i-1+teacherNavTabs.length)%teacherNavTabs.length;
 if(e.key==='ArrowLeft')next=(i+1)%teacherNavTabs.length;
 if(e.key==='Home')next=0;
 if(e.key==='End')next=teacherNavTabs.length-1;
 teacherNavTabs[next].focus();switchTab(teacherNavTabs[next].dataset.teacherTab);
});
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
initTeacherCollapse();
$('teacherMenuBtn').onclick=()=>{$('teacherSide').classList.add('open');$('teacherOverlay')?.classList.remove('hidden')};
$('teacherOverlay')?.addEventListener('click',()=>{$('teacherSide').classList.remove('open');$('teacherOverlay').classList.add('hidden')});
$('teacherLogout').onclick=async()=>{
 const ok=await window.AcademyUI.confirm({title:'تسجيل الخروج؟',message:'سيتم إغلاق جلسة المدرس الحالية ويمكنك العودة في أي وقت.',tone:'warning',acceptText:'تسجيل الخروج'});
 if(!ok)return;
 try{await auth.signOut();location.replace('./index.html')}catch(err){console.error(err);toast('تعذر تسجيل الخروج الآن.','error')}
};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('teacherGradeModal')?.classList.contains('hidden'))closeGradeModal()});

auth.onAuthStateChanged(async u=>{
 if(!u){showNoAccess('سجّل الدخول أولًا من المنصة، وبعدها افتح بوابة المدرس.');return}
 user=u;
 window.AcademyUI?.showPageLoading('جاري تحميل بوابة المدرس وصلاحياتك...');
 try{
   const t=await db.ref('teacherProfiles/'+u.uid).once('value');
   teacher=t.val();
   if(!teacher){showNoAccess('الحساب الحالي ليس له ملف مدرس. الإدارة لازم تضيفه كمدرس أولًا.');return}
   if(teacher.isActive===false||teacher.status==='blocked'){showNoAccess('حساب المدرس غير مفعل حاليًا. تواصل مع الإدارة.');return}

   const [subjectsSnap,submissionSnap,directLessonsSnap,homeworkSnap]=await Promise.all([
     db.ref('customSubjects').once('value'),
     db.ref('teacherSubmissions/'+u.uid).once('value'),
     db.ref('lessons').orderByChild('teacherId').equalTo(u.uid).once('value'),
     db.ref('assignments').orderByChild('teacherId').equalTo(u.uid).once('value')
   ]);
   submissions=submissionSnap.val()||{};
   const lessons=directLessonsSnap.val()||{};

   const legacyLessonIds=[...new Set(Object.values(submissions).map(s=>s?.lessonId).filter(Boolean).filter(id=>!lessons[id]))];
   if(legacyLessonIds.length){
     const legacySnaps=await Promise.all(legacyLessonIds.map(id=>db.ref('lessons/'+id).once('value')));
     legacyLessonIds.forEach((id,i)=>{if(legacySnaps[i].exists())lessons[id]=legacySnaps[i].val()});
   }
   data={customSubjects:subjectsSnap.val()||{},lessons};
   homeworkAssignments=homeworkSnap.val()||{};

   const lessonIds=Object.keys(lessons),ownIds=Object.keys(homeworkAssignments);
   const [metricSnaps,submissionSnaps]=await Promise.all([
     Promise.all(lessonIds.map(id=>db.ref('contentAnalytics/'+id).once('value'))),
     Promise.all(ownIds.map(id=>db.ref('assignmentSubmissions/'+id).once('value')))
   ]);
   analytics={};lessonIds.forEach((id,i)=>analytics[id]=metricSnaps[i].val()||{});
   assignmentSubmissions={};ownIds.forEach((id,i)=>assignmentSubmissions[id]=submissionSnaps[i].val()||{});

   $('teacherAccess').classList.add('hidden');$('teacherPortal').classList.remove('hidden');
   updateGrades();updateAssignmentGrades();render();
   const requested=new URLSearchParams(location.search).get('tab')||'home';switchTab(requested,false);
 }catch(err){console.error(err);showNoAccess('تعذر تحميل صلاحيات المدرس الآن.')}
 finally{window.AcademyUI?.hidePageLoading()}
});
})();