(() => {
'use strict';

const firebaseConfig = window.ACADEMY_FIREBASE_CONFIG || JSON.parse(localStorage.getItem('academyFirebaseConfig') || 'null');
if(!firebaseConfig){location.replace('./index.html');return}
firebase.initializeApp(firebaseConfig);
const auth=firebase.auth(),db=firebase.database();
const $=id=>document.getElementById(id), $$=(s,r=document)=>[...r.querySelectorAll(s)];
let user=null,teacher=null,data={},submissions={};

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
function render(){
 const name=teacher.name||user.displayName||user.email.split('@')[0]||'أستاذنا';
 $('teacherTopName').textContent='أهلًا '+name+' 👋';$('teacherWelcomeName').textContent=name;
 const assignments=normalizeAssignments(),subs=Object.entries(submissions||{}).map(([id,v])=>({id,...v})).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
 const approved=subs.filter(s=>s.status==='approved'),pending=subs.filter(s=>(s.status||'pending')==='pending');
 $('teacherApprovedCount').textContent=approved.length;$('teacherPendingCount').textContent=pending.length;
 $('teacherSubjectCount').textContent=new Set(assignments.map(a=>a.subject).filter(Boolean)).size||teacher.subjectCount||0;
 $('teacherGradeCount').textContent=new Set(assignments.map(a=>(a.stage||'')+'-'+(a.grade||'')).filter(x=>x!=='-')).size||teacher.gradeCount||0;

 $('teacherAssignments').innerHTML=assignments.length?assignments.map(a=>'<article class="teacher-assignment"><span>📘</span><div><strong>'+(a.subjectName||a.subject||'مادة مسندة')+'</strong><small>'+(a.type==='azhar'?'أزهر':'تعليم عام')+' • '+(stageName[a.stage]||a.stage||'كل المراحل')+' • '+(a.grade?'صف '+a.grade:'كل الصفوف')+'</small></div></article>').join(''):'<p class="profile-muted">لم تحدد الإدارة موادًا بعينها بعد.</p>';
 renderSubmissionList('teacherRecentSubmissions',subs.slice(0,5));renderSubmissionList('teacherApprovedList',approved);
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
$('teacherMenuBtn').onclick=()=>$('teacherSide').classList.toggle('open');
$('teacherLogout').onclick=async()=>{await auth.signOut();location.replace('./index.html')};

auth.onAuthStateChanged(async u=>{
 if(!u){showNoAccess('سجّل الدخول أولًا من المنصة، وبعدها افتح بوابة المدرس.');return}
 user=u;
 try{
   const [t,subjectsSnap,s]=await Promise.all([
     db.ref('teacherProfiles/'+u.uid).once('value'),
     db.ref('customSubjects').once('value'),
     db.ref('teacherSubmissions/'+u.uid).once('value')
   ]);
   teacher=t.val();data={customSubjects:subjectsSnap.val()||{}};submissions=s.val()||{};
   if(!teacher){showNoAccess('الحساب الحالي ليس له ملف مدرس. الإدارة لازم تضيفه كمدرس أولًا.');return}
   if(teacher.isActive===false||teacher.status==='blocked'){showNoAccess('حساب المدرس غير مفعل حاليًا. تواصل مع الإدارة.');return}
   $('teacherAccess').classList.add('hidden');$('teacherPortal').classList.remove('hidden');updateGrades();render();
 }catch(err){console.error(err);showNoAccess('تعذر تحميل صلاحيات المدرس الآن.')}
});
})();