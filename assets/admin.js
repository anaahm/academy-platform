(() => {
'use strict';

const firebaseConfig=window.ACADEMY_FIREBASE_CONFIG;
if(!firebaseConfig) throw new Error('Firebase configuration is missing');
firebase.initializeApp(firebaseConfig);
const auth=firebase.auth(),db=firebase.database();
const $=id=>document.getElementById(id), $$=(s,r=document)=>[...r.querySelectorAll(s)];

let currentUser=null,root={},unsubscribe=null;
const editState={lesson:null,quiz:null,file:null,simulation:null,live:null};
const stageNames={primary:'ابتدائي',prep:'إعدادي',sec:'ثانوي'};
const defaultSubjects={
 primary:[{id:'arabic',name:'اللغة العربية',emoji:'📖'},{id:'math',name:'الرياضيات',emoji:'🧮'},{id:'science',name:'العلوم',emoji:'🔬'},{id:'english',name:'اللغة الإنجليزية',emoji:'🇬🇧'},{id:'social',name:'الدراسات الاجتماعية',emoji:'🌍'},{id:'religion',name:'التربية الدينية',emoji:'🕌'}],
 prep:[{id:'arabic',name:'اللغة العربية',emoji:'📖'},{id:'math',name:'الرياضيات',emoji:'🧮'},{id:'science',name:'العلوم',emoji:'🔬'},{id:'english',name:'اللغة الإنجليزية',emoji:'🇬🇧'},{id:'social',name:'الدراسات الاجتماعية',emoji:'🌍'},{id:'computer',name:'الحاسب الآلي',emoji:'💻'}],
 sec:[{id:'arabic',name:'اللغة العربية',emoji:'📖'},{id:'english',name:'اللغة الإنجليزية',emoji:'🇬🇧'},{id:'math',name:'الرياضيات',emoji:'🧮'},{id:'physics',name:'الفيزياء',emoji:'⚛️'},{id:'chemistry',name:'الكيمياء',emoji:'🧪'},{id:'biology',name:'الأحياء',emoji:'🧬'},{id:'history',name:'التاريخ',emoji:'🏛️'},{id:'geography',name:'الجغرافيا',emoji:'🌍'}]
};

const esc=(v='')=>String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const cleanUrl=(u='')=>{try{const x=new URL(u);return ['http:','https:'].includes(x.protocol)?x.href:'#'}catch{return'#'}};
const typeLabel=t=>t==='azhar'?'أزهر':'تعليم عام';
const gradeCount=s=>s==='primary'?6:3;
const gradeLabel=(s,g)=>'الصف '+g+' '+(stageNames[s]||'');

function toast(msg,type='success'){
 const el=$('toast'); if(!el)return;
 el.textContent=msg; el.className='toast show '+type;
 clearTimeout(toast.t); toast.t=setTimeout(()=>el.className='toast',3200);
}
function empty(title='لا توجد بيانات',text=''){
 return '<div class="empty-admin"><span>📭</span><h3>'+esc(title)+'</h3><p>'+esc(text)+'</p></div>';
}
function openModal(id){$(id)?.classList.remove('hidden');document.body.style.overflow='hidden'}
function closeModal(id){$(id)?.classList.add('hidden');document.body.style.overflow=''}
function values(obj){return Object.entries(obj||{}).map(([id,v])=>({id,...(v||{})}))}
function flattenSubmissions(){
 const out=[];Object.entries(root.teacherSubmissions||{}).forEach(([uid,items])=>Object.entries(items||{}).forEach(([id,v])=>out.push({uid,id,...(v||{})})));
 return out.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
}
function subjectsFor(stage,grade,type){
 const list=[...(defaultSubjects[stage]||[])];
 const custom=root.customSubjects?.[stage]?.[grade];
 const arr=Array.isArray(custom)?custom:Object.values(custom||{});
 arr.forEach(s=>{
   if(!s?.id||!s?.name||(s.type&&s.type!==type))return;
   const i=list.findIndex(x=>x.id===s.id),item={id:s.id,name:s.name,emoji:s.emoji||'📚',units:s.units||[]};
   if(i>=0)list[i]={...list[i],...item}; else list.push(item);
 });
 return list;
}
function customSubjectsFor(stage,grade,type){
 const custom=root.customSubjects?.[stage]?.[grade],arr=Array.isArray(custom)?custom:Object.values(custom||{});
 return arr.filter(s=>s?.id&&s?.name&&(!s.type||s.type===type));
}
function fillGrades(select,stage,keep){
 if(!select)return;const max=gradeCount(stage),current=keep||select.value||'1';
 select.innerHTML=Array.from({length:max},(_,i)=>'<option value="'+(i+1)+'">'+gradeLabel(stage,i+1)+'</option>').join('');
 if(Number(current)<=max)select.value=String(current);
}
function fillSubjects(select,stage,grade,type){
 if(!select)return;const list=subjectsFor(stage,String(grade),type);
 select.innerHTML=list.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+'</option>').join('');
}
function bindHierarchy(typeId,stageId,gradeId,subjectId){
 const type=$(typeId),stage=$(stageId),grade=$(gradeId),subject=$(subjectId);
 if(!stage||!grade)return;
 const refreshGrade=()=>{fillGrades(grade,stage.value);if(subject)fillSubjects(subject,stage.value,grade.value,type?.value||'public')};
 const refreshSubject=()=>{if(subject)fillSubjects(subject,stage.value,grade.value,type?.value||'public')};
 stage.onchange=refreshGrade;grade.onchange=refreshSubject;if(type)type.onchange=refreshSubject;refreshGrade();
}
function adminName(){
 return root.adminProfiles?.[currentUser?.uid]?.name||currentUser?.displayName||'مدير المنصة';
}

function setTab(tab){
 $$('.admin-tab').forEach(s=>s.classList.toggle('active',s.id==='admin-tab-'+tab));
 $$('[data-admin-tab]').forEach(b=>b.classList.toggle('active',b.dataset.adminTab===tab));
 const meta={
  overview:['لوحة المعلومات','صباح الخير 👋'],curriculum:['هيكل المنهج','المواد والوحدات'],lessons:['المحتوى','إدارة الدروس'],quizzes:['التقييم','إدارة الاختبارات'],simulations:['التدريب','إدارة المحاكيات'],files:['المكتبة','الملفات والمراجع'],live:['الجلسات','البث المباشر'],teachers:['فريق التدريس','المدرسون والمراجعات'],students:['المتعلمون','إدارة الطلاب'],community:['الإشراف','المجتمع والبلاغات'],announcements:['التواصل','الإعلانات'],settings:['المنصة','الإعدادات']
 }[tab]||['الإدارة','لوحة الإدارة'];
 $('adminSectionKicker').textContent=meta[0];$('adminSectionTitle').textContent=meta[1];
 $('adminSidebar').classList.remove('open');$('adminOverlay').classList.add('hidden');
 renderTab(tab);
}
function renderAll(){
 $('adminName').textContent=adminName();$('adminEmailMini').textContent=currentUser?.email||'';$('adminAvatar').textContent=(adminName()[0]||'م').toUpperCase();
 renderOverview();renderCurriculum();renderLessons();renderQuizzes();renderSimulations();renderFiles();renderLiveSessions();renderTeachers();renderStudents();renderCommunityAdmin();loadAnnouncement();loadSettings();updatePendingBadge();updateCommunityBadge();
}
function renderTab(tab){
 ({overview:renderOverview,curriculum:renderCurriculum,lessons:renderLessons,quizzes:renderQuizzes,simulations:renderSimulations,files:renderFiles,live:renderLiveSessions,teachers:renderTeachers,students:renderStudents,community:renderCommunityAdmin,announcements:loadAnnouncement,settings:loadSettings}[tab]||(()=>{}))();
}

/* Overview */
function renderOverview(){
 const lessons=values(root.lessons),quizzes=values(root.quizzes),students=values(root.studentProfilesV3),teachers=values(root.teacherProfiles),pending=flattenSubmissions().filter(x=>(x.status||'pending')==='pending');
 const stats=[['fa-user-graduate',students.length,'طالب'],['fa-chalkboard-user',teachers.length,'مدرس'],['fa-circle-play',lessons.length,'درس'],['fa-file-circle-question',quizzes.length,'اختبار'],['fa-clock',pending.length,'مراجعة معلقة']];
 $('overviewStats').innerHTML=stats.map(s=>'<article><span><i class="fa-solid '+s[0]+'"></i></span><div><strong>'+s[1]+'</strong><small>'+s[2]+'</small></div></article>').join('');
 const latest=lessons.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,6);
 $('latestContentList').innerHTML=latest.length?latest.map(l=>'<div class="admin-list-item"><div><strong>'+esc(l.title||'درس')+'</strong><small>'+esc(typeLabel(l.type))+' • '+esc(stageNames[l.stage]||l.stage)+' • '+esc(l.subject||'')+'</small></div><span class="status-pill info">درس</span></div>').join(''):empty('لا يوجد محتوى بعد','أضف أول درس من قسم الدروس.');
 $('overviewPendingList').innerHTML=pending.length?pending.slice(0,5).map(s=>'<div class="admin-list-item"><div><strong>'+esc(s.title||'محتوى')+'</strong><small>'+esc(s.teacherName||'مدرس')+'</small></div><span class="status-pill pending">مراجعة</span></div>').join(''):empty('لا توجد مراجعات معلقة','كل محتوى المدرسين تمت مراجعته.');
}

/* Curriculum */
function renderCurriculum(){
 fillGrades($('curriculumGrade'),$('curriculumStage').value);
 const type=$('curriculumType').value,stage=$('curriculumStage').value,grade=$('curriculumGrade').value;
 const list=subjectsFor(stage,grade,type);
 $('curriculumAdminGrid').innerHTML=list.length?list.map(s=>{
   const custom=customSubjectsFor(stage,grade,type).find(x=>x.id===s.id),units=custom?.units||s.units||[];
   return '<article class="admin-subject-card"><span class="section-kicker">'+esc(typeLabel(type))+' • '+esc(gradeLabel(stage,grade))+'</span><h3>'+esc(s.emoji||'📚')+' '+esc(s.name)+'</h3><p>رمز المادة: '+esc(s.id)+'</p><div class="admin-unit-tags">'+(units.length?units.map((u,i)=>'<span>'+(i+1)+'. '+esc(u.name||u)+'</span>').join(''):'<span>بدون وحدات مخصصة</span>')+'</div>'+(custom?'<button class="admin-action-btn danger" data-delete-subject="'+esc(s.id)+'" title="حذف المادة" style="margin-top:12px"><i class="fa-solid fa-trash"></i></button>':'')+'</article>';
 }).join(''):empty();
 $$('[data-delete-subject]').forEach(b=>b.onclick=()=>deleteSubject(b.dataset.deleteSubject));
}
async function deleteSubject(id){
 if(!confirm('حذف المادة المخصصة؟'))return;
 const stage=$('curriculumStage').value,grade=$('curriculumGrade').value,arr=customSubjectsFor(stage,grade,$('curriculumType').value),next=arr.filter(x=>x.id!==id);
 await db.ref('customSubjects/'+stage+'/'+grade).set(next);toast('تم حذف المادة');
}
async function saveSubject(e){
 e.preventDefault();
 const stage=$('subjectStage').value,grade=$('subjectGrade').value,type=$('subjectType').value;
 const current=root.customSubjects?.[stage]?.[grade],arr=Array.isArray(current)?[...current]:Object.values(current||{});
 const id=$('subjectId').value.trim(),name=$('subjectName').value.trim();if(!id||!name)return;
 if(arr.some(x=>x?.id===id&&(!x.type||x.type===type)))return toast('رمز المادة موجود بالفعل.','error');
 const units=$('subjectUnits').value.split('\n').map(x=>x.trim()).filter(Boolean).map(name=>({name}));
 arr.push({id,name,type,emoji:$('subjectEmoji').value.trim()||'📚',units});
 await db.ref('customSubjects/'+stage+'/'+grade).set(arr);closeModal('subjectModal');e.target.reset();toast('تمت إضافة المادة');
}

function renderLessonVideosEditor(videos){
 const list=Array.isArray(videos)&&videos.length?videos:[{name:'',url:''}];
 const wrap=$('lessonVideosEditor');if(!wrap)return;
 wrap.innerHTML=list.map((v,i)=>'<div class="admin-video-row"><input class="lesson-video-name" value="'+esc(v?.name||'')+'" placeholder="اسم المدرس"><input class="lesson-video-url" type="url" dir="ltr" value="'+esc(v?.url||'')+'" placeholder="رابط YouTube"><button type="button" class="admin-action-btn danger" data-remove-video-row="'+i+'" title="حذف الفيديو"><i class="fa-solid fa-xmark"></i></button></div>').join('');
 $('[data-remove-video-row]',wrap).forEach(b=>b.onclick=()=>{
   const rows=[...wrap.querySelectorAll('.admin-video-row')];
   if(rows.length<=1){rows[0].querySelector('.lesson-video-name').value='';rows[0].querySelector('.lesson-video-url').value='';return}
   b.closest('.admin-video-row').remove();
 });
}
function addLessonVideoRow(){
 const wrap=$('lessonVideosEditor');if(!wrap)return;
 const row=document.createElement('div');row.className='admin-video-row';
 row.innerHTML='<input class="lesson-video-name" placeholder="اسم المدرس"><input class="lesson-video-url" type="url" dir="ltr" placeholder="رابط YouTube"><button type="button" class="admin-action-btn danger" title="حذف الفيديو"><i class="fa-solid fa-xmark"></i></button>';
 row.querySelector('button').onclick=()=>{if(wrap.querySelectorAll('.admin-video-row').length>1)row.remove();else{row.querySelector('.lesson-video-name').value='';row.querySelector('.lesson-video-url').value=''}};
 wrap.appendChild(row);
}
function collectLessonVideos(){
 return [...document.querySelectorAll('#lessonVideosEditor .admin-video-row')].map(row=>({name:row.querySelector('.lesson-video-name')?.value.trim()||'المدرس',url:row.querySelector('.lesson-video-url')?.value.trim()||''})).filter(v=>v.url);
}
function resetLessonEditor(){
 editState.lesson=null;$('lessonForm').reset();fillGrades($('newLessonGrade'),$('newLessonStage').value);fillSubjects($('newLessonSubject'),$('newLessonStage').value,$('newLessonGrade').value,$('newLessonType').value);renderLessonVideosEditor([{name:'',url:''}]);if($('lessonModalTitle'))$('lessonModalTitle').textContent='إضافة درس جديد';
}

/* Lessons */
function filteredLessons(){
 const q=($('lessonSearch')?.value||'').trim().toLowerCase(),stage=$('lessonFilterStage')?.value||'',type=$('lessonFilterType')?.value||'';
 return values(root.lessons).filter(l=>(!q||(l.title||'').toLowerCase().includes(q))&&(!stage||l.stage===stage)&&(!type||l.type===type)).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
}
function renderLessons(){
 const arr=filteredLessons();
 $('lessonsAdminList').innerHTML=arr.length?'<table class="admin-table"><thead><tr><th>الدرس</th><th>المسار</th><th>المرحلة</th><th>المادة</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>'+arr.map(l=>'<tr><td><strong>'+esc(l.title||'درس')+'</strong><br><small>'+(l.videos?.length||0)+' فيديو</small></td><td>'+esc(typeLabel(l.type))+'</td><td>'+esc(gradeLabel(l.stage,l.grade))+'</td><td>'+esc(l.subject||'-')+'</td><td><span class="status-pill '+(l.isHidden?'rejected':'approved')+'">'+(l.isHidden?'مخفي':'منشور')+'</span></td><td><div class="admin-action-row"><button class="admin-action-btn" data-edit-lesson="'+l.id+'" title="تعديل"><i class="fa-solid fa-pen"></i></button><button class="admin-action-btn" data-toggle-lesson="'+l.id+'" title="إظهار/إخفاء"><i class="fa-solid fa-eye"></i></button><button class="admin-action-btn danger" data-delete-lesson="'+l.id+'" title="حذف"><i class="fa-solid fa-trash"></i></button></div></td></tr>').join('')+'</tbody></table>':empty('لا توجد دروس','أضف أول درس جديد.');
 $('[data-edit-lesson]').forEach(b=>b.onclick=()=>editLesson(b.dataset.editLesson));
 $('[data-toggle-lesson]').forEach(b=>b.onclick=()=>{const l=root.lessons?.[b.dataset.toggleLesson];db.ref('lessons/'+b.dataset.toggleLesson+'/isHidden').set(!l?.isHidden)});
 $$('[data-delete-lesson]').forEach(b=>b.onclick=()=>{if(confirm('حذف الدرس نهائيًا؟'))db.ref('lessons/'+b.dataset.deleteLesson).remove()});
}
async function editLesson(id){
 const l=root.lessons?.[id];if(!l)return;
 editState.lesson=id;
 $('newLessonType').value=l.type||'public';$('newLessonStage').value=l.stage||'primary';fillGrades($('newLessonGrade'),$('newLessonStage').value,l.grade||'1');$('newLessonGrade').value=String(l.grade||'1');fillSubjects($('newLessonSubject'),l.stage||'primary',String(l.grade||'1'),l.type||'public');$('newLessonSubject').value=l.subject||'';
 $('newLessonUnit').value=Number(l.unit||1);$('newLessonTitle').value=l.title||'';$('newLessonContent').value=l.content||'';$('newLessonHidden').checked=!!l.isHidden;renderLessonVideosEditor(l.videos||[]);
 if($('lessonModalTitle'))$('lessonModalTitle').textContent='تعديل الدرس';openModal('lessonModal');
}
async function saveLesson(e){
 e.preventDefault();
 const videos=collectLessonVideos(),existing=editState.lesson?root.lessons?.[editState.lesson]:null;
 const payload={type:$('newLessonType').value,stage:$('newLessonStage').value,grade:$('newLessonGrade').value,subject:$('newLessonSubject').value,unit:Number($('newLessonUnit').value||1),title:$('newLessonTitle').value.trim(),content:$('newLessonContent').value.trim(),videos,questions:existing?.questions||[],isLocked:existing?.isLocked||false,isHidden:$('newLessonHidden').checked};
 if(editState.lesson){payload.updatedAt=Date.now();await db.ref('lessons/'+editState.lesson).update(payload);toast('تم تحديث الدرس')}
 else{payload.createdAt=Date.now();await db.ref('lessons').push(payload);toast('تم نشر الدرس')}
 closeModal('lessonModal');resetLessonEditor();
}

/* Quizzes */
function renderQuizzes(){
 const arr=values(root.quizzes).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
 $('quizzesAdminList').innerHTML=arr.length?'<table class="admin-table"><thead><tr><th>الاختبار</th><th>المرحلة</th><th>المادة</th><th>الوحدة</th><th>الأسئلة</th><th>إجراء</th></tr></thead><tbody>'+arr.map(q=>'<tr><td><strong>'+esc(q.name||'اختبار')+'</strong></td><td>'+esc(gradeLabel(q.stage,q.grade))+'</td><td>'+esc(q.subject||'-')+'</td><td>'+(Number(q.unit||0)===0?'شامل':esc(q.unit||'-'))+'</td><td>'+(q.questions?.length||0)+'</td><td><div class="admin-action-row"><button class="admin-action-btn" data-edit-quiz="'+q.id+'" title="تعديل"><i class="fa-solid fa-pen"></i></button><button class="admin-action-btn danger" data-delete-quiz="'+q.id+'"><i class="fa-solid fa-trash"></i></button></div></td></tr>').join('')+'</tbody></table>':empty('لا توجد اختبارات','أنشئ أول اختبار.');
 $('[data-edit-quiz]').forEach(b=>b.onclick=()=>editQuiz(b.dataset.editQuiz));
 $('[data-delete-quiz]').forEach(b=>b.onclick=()=>{if(confirm('حذف الاختبار؟'))db.ref('quizzes/'+b.dataset.deleteQuiz).remove()});
}
function resetQuizEditor(){editState.quiz=null;$('quizForm').reset();fillGrades($('newQuizGrade'),$('newQuizStage').value);fillSubjects($('newQuizSubject'),$('newQuizStage').value,$('newQuizGrade').value,$('newQuizType').value);if($('quizModalTitle'))$('quizModalTitle').textContent='إنشاء اختبار'}
function editQuiz(id){
 const q=root.quizzes?.[id];if(!q)return;editState.quiz=id;
 $('newQuizType').value=q.type||'public';$('newQuizStage').value=q.stage||'primary';fillGrades($('newQuizGrade'),q.stage||'primary',q.grade||'1');$('newQuizGrade').value=String(q.grade||'1');fillSubjects($('newQuizSubject'),q.stage||'primary',String(q.grade||'1'),q.type||'public');$('newQuizSubject').value=q.subject||'';$('newQuizUnit').value=Number(q.unit||0);$('newQuizName').value=q.name||'';$('newQuizQuestions').value=JSON.stringify(q.questions||[],null,2);if($('quizModalTitle'))$('quizModalTitle').textContent='تعديل الاختبار';openModal('quizModal');
}
async function saveQuiz(e){
 e.preventDefault();let questions=[];
 try{questions=JSON.parse($('newQuizQuestions').value.trim()||'[]');if(!Array.isArray(questions))throw new Error()}catch{return toast('صيغة JSON للأسئلة غير صحيحة.','error')}
 questions=questions.filter(q=>q?.text&&Array.isArray(q.opts)&&q.opts.length>=2&&Number.isInteger(Number(q.correctAnswer)));
 const payload={type:$('newQuizType').value,stage:$('newQuizStage').value,grade:$('newQuizGrade').value,subject:$('newQuizSubject').value,unit:Number($('newQuizUnit').value||0),name:$('newQuizName').value.trim(),questions,isHidden:editState.quiz?!!root.quizzes?.[editState.quiz]?.isHidden:false};
 if(editState.quiz){payload.updatedAt=Date.now();await db.ref('quizzes/'+editState.quiz).update(payload);toast('تم تحديث الاختبار')}else{payload.createdAt=Date.now();await db.ref('quizzes').push(payload);toast('تم حفظ الاختبار')}
 closeModal('quizModal');resetQuizEditor();
}

/* Simulations */
function renderSimulations(){
 const arr=values(root.simulations).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
 $('simulationsAdminGrid').innerHTML=arr.length?arr.map(s=>{
   const total=Object.values(s.counts||{}).reduce((a,n)=>a+Number(n||0),0);
   return '<article class="admin-subject-card"><span class="section-kicker">'+esc(typeLabel(s.type))+' • '+esc(gradeLabel(s.stage,s.grade))+'</span><h3>⏱️ '+esc(s.name||'محاكي')+'</h3><p>'+Number(s.time||60)+' دقيقة • '+total+' سؤال</p><div class="admin-unit-tags"><span>عربي '+Number(s.counts?.ar||0)+'</span><span>رياضيات '+Number(s.counts?.ma||0)+'</span><span>علوم '+Number(s.counts?.sc||0)+'</span><span>إنجليزي '+Number(s.counts?.en||0)+'</span></div><div class="admin-action-row" style="margin-top:12px"><button class="admin-action-btn" data-edit-sim="'+s.id+'" title="تعديل"><i class="fa-solid fa-pen"></i></button><button class="admin-action-btn '+(s.isHidden?'success':'')+'" data-toggle-sim="'+s.id+'" title="إظهار/إخفاء"><i class="fa-solid fa-eye"></i></button><button class="admin-action-btn danger" data-delete-sim="'+s.id+'" title="حذف"><i class="fa-solid fa-trash"></i></button></div></article>';
 }).join(''):empty('لا توجد محاكيات','أنشئ أول محاكي لطلابك.');
 $('[data-toggle-sim]').forEach(b=>b.onclick=()=>db.ref('simulations/'+b.dataset.toggleSim+'/isHidden').set(!root.simulations?.[b.dataset.toggleSim]?.isHidden));
 $('[data-delete-sim]').forEach(b=>b.onclick=()=>{if(confirm('حذف المحاكي؟'))db.ref('simulations/'+b.dataset.deleteSim).remove()});
}
function resetSimulationEditor(){editState.simulation=null;$('simulationForm').reset();$('simTime').value=60;['simAr','simMa','simSc','simEn'].forEach(id=>$(id).value=5);fillGrades($('simGrade'),$('simStage').value);if($('simulationModalTitle'))$('simulationModalTitle').textContent='إنشاء محاكي جديد'}
function editSimulation(id){
 const s=root.simulations?.[id];if(!s)return;editState.simulation=id;
 $('simName').value=s.name||'';$('simType').value=s.type||'public';$('simStage').value=s.stage||'primary';fillGrades($('simGrade'),s.stage||'primary',s.grade||'1');$('simGrade').value=String(s.grade||'1');$('simTime').value=Number(s.time||60);$('simAr').value=Number(s.counts?.ar||0);$('simMa').value=Number(s.counts?.ma||0);$('simSc').value=Number(s.counts?.sc||0);$('simEn').value=Number(s.counts?.en||0);$('simHidden').checked=!!s.isHidden;if($('simulationModalTitle'))$('simulationModalTitle').textContent='تعديل المحاكي';openModal('simulationModal');
}
async function saveSimulation(e){
 e.preventDefault();
 const counts={ar:Number($('simAr').value||0),ma:Number($('simMa').value||0),sc:Number($('simSc').value||0),en:Number($('simEn').value||0)};
 if(Object.values(counts).reduce((a,n)=>a+n,0)<=0)return toast('حدد سؤالًا واحدًا على الأقل.','error');
 const payload={name:$('simName').value.trim(),type:$('simType').value,stage:$('simStage').value,grade:$('simGrade').value,time:Number($('simTime').value||60),counts,isLocked:false,isHidden:$('simHidden').checked};
 if(editState.simulation){payload.updatedAt=Date.now();await db.ref('simulations/'+editState.simulation).update(payload);toast('تم تحديث المحاكي')}else{payload.createdAt=Date.now();await db.ref('simulations').push(payload);toast('تم حفظ المحاكي')}
 closeModal('simulationModal');resetSimulationEditor();
}

/* Files */
function renderFiles(){
 const arr=values(root.files).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
 $('filesAdminGrid').innerHTML=arr.length?arr.map(f=>'<article class="admin-file-card"><i class="fa-solid fa-file-pdf"></i><div><strong>'+esc(f.title||'ملف')+'</strong><small>'+esc(gradeLabel(f.stage,f.grade))+' • '+esc(f.subject||'')+'</small></div><div class="admin-action-row"><button class="admin-action-btn" data-edit-file="'+f.id+'" title="تعديل"><i class="fa-solid fa-pen"></i></button><a class="admin-action-btn success" href="'+cleanUrl(f.url)+'" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i></a><button class="admin-action-btn danger" data-delete-file="'+f.id+'"><i class="fa-solid fa-trash"></i></button></div></article>').join(''):empty('لا توجد ملفات','أضف ملفات أو مذكرات للمادة.');
 $('[data-edit-file]').forEach(b=>b.onclick=()=>editFile(b.dataset.editFile));
 $('[data-delete-file]').forEach(b=>b.onclick=()=>{if(confirm('حذف الملف من المنصة؟'))db.ref('files/'+b.dataset.deleteFile).remove()});
}
function resetFileEditor(){editState.file=null;$('fileForm').reset();fillGrades($('newFileGrade'),$('newFileStage').value);fillSubjects($('newFileSubject'),$('newFileStage').value,$('newFileGrade').value,$('newFileType').value);if($('fileModalTitle'))$('fileModalTitle').textContent='إضافة ملف'}
function editFile(id){
 const f=root.files?.[id];if(!f)return;editState.file=id;
 $('newFileTitle').value=f.title||'';$('newFileUrl').value=f.url||'';$('newFileType').value=f.type||'public';$('newFileStage').value=f.stage||'primary';fillGrades($('newFileGrade'),f.stage||'primary',f.grade||'1');$('newFileGrade').value=String(f.grade||'1');fillSubjects($('newFileSubject'),f.stage||'primary',String(f.grade||'1'),f.type||'public');$('newFileSubject').value=f.subject||'';if($('fileModalTitle'))$('fileModalTitle').textContent='تعديل الملف';openModal('fileModal');
}
async function saveFile(e){
 e.preventDefault();
 const payload={title:$('newFileTitle').value.trim(),url:$('newFileUrl').value.trim(),type:$('newFileType').value,stage:$('newFileStage').value,grade:$('newFileGrade').value,subject:$('newFileSubject').value};
 if(editState.file){payload.updatedAt=Date.now();await db.ref('files/'+editState.file).update(payload);toast('تم تحديث الملف')}else{payload.createdAt=Date.now();await db.ref('files').push(payload);toast('تمت إضافة الملف')}
 closeModal('fileModal');resetFileEditor();
}

/* Live Sessions */
function renderLiveSessions(){
 const arr=values(root.liveSessions).sort((a,b)=>(b.scheduledTime||0)-(a.scheduledTime||0));
 $('liveAdminGrid').innerHTML=arr.length?arr.map(s=>{
   const cls=s.status==='live'?'rejected':s.status==='upcoming'?'info':'approved';
   const label=s.status==='live'?'مباشر':s.status==='upcoming'?'قادم':'منتهي';
   return '<article class="admin-subject-card"><span class="status-pill '+cls+'">'+label+'</span><h3 style="margin-top:10px">📡 '+esc(s.title||'جلسة')+'</h3><p>👨‍🏫 '+esc(s.teacher||'غير محدد')+' • ⏱️ '+Number(s.duration||60)+' دقيقة</p><p>'+(s.scheduledTime?new Date(s.scheduledTime).toLocaleString('ar-EG'):'موعد غير محدد')+'</p><div class="admin-action-row" style="margin-top:12px"><button class="admin-action-btn" data-edit-live="'+s.id+'" title="تعديل"><i class="fa-solid fa-pen"></i></button><a class="admin-action-btn success" href="'+cleanUrl(s.youtubeLiveUrl||s.zoomLink||'#')+'" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i></a><button class="admin-action-btn danger" data-delete-live="'+s.id+'"><i class="fa-solid fa-trash"></i></button></div></article>';
 }).join(''):empty('لا توجد جلسات','أضف أول بث مباشر أو جلسة قادمة.');
 $('[data-delete-live]').forEach(b=>b.onclick=()=>{if(confirm('حذف الجلسة؟'))db.ref('liveSessions/'+b.dataset.deleteLive).remove()});
}
function toLocalDateTimeInput(ts){if(!ts)return'';const d=new Date(Number(ts));return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}
function resetLiveEditor(){editState.live=null;$('liveForm').reset();$('liveDuration').value=60;$('liveStatus').value='upcoming';if($('liveModalTitle'))$('liveModalTitle').textContent='إضافة جلسة بث'}
function editLiveSession(id){
 const s=root.liveSessions?.[id];if(!s)return;editState.live=id;
 $('liveTitle').value=s.title||'';$('liveTeacher').value=s.teacher||'';$('liveStatus').value=s.status||'upcoming';$('liveTime').value=toLocalDateTimeInput(s.scheduledTime);$('liveDuration').value=Number(s.duration||60);$('liveYoutube').value=s.youtubeLiveUrl||'';$('liveZoom').value=s.zoomLink||'';if($('liveModalTitle'))$('liveModalTitle').textContent='تعديل جلسة البث';openModal('liveModal');
}
async function saveLiveSession(e){
 e.preventDefault();
 const payload={title:$('liveTitle').value.trim(),teacher:$('liveTeacher').value.trim()||'غير محدد',status:$('liveStatus').value,scheduledTime:$('liveTime').value?new Date($('liveTime').value).getTime():Date.now(),duration:Number($('liveDuration').value||60),youtubeLiveUrl:$('liveYoutube').value.trim(),zoomLink:$('liveZoom').value.trim()};
 if(editState.live){payload.updatedAt=Date.now();await db.ref('liveSessions/'+editState.live).update(payload);toast('تم تحديث الجلسة')}else{payload.createdAt=Date.now();await db.ref('liveSessions').push(payload);toast('تم حفظ الجلسة')}
 closeModal('liveModal');resetLiveEditor();
}

/* Community */
function communityReportCount(){
 return Object.values(root.community?.forums||{}).reduce((n,p)=>n+Object.keys(p?.reports||{}).length,0);
}
function updateCommunityBadge(){
 const n=communityReportCount(),b=$('communityReportBadge');if(!b)return;b.textContent=n;b.classList.toggle('hidden',!n);
}
function renderCommunityAdmin(){
 const posts=Object.entries(root.community?.forums||{}).map(([id,v])=>({id,...(v||{})})).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
 const groups=Object.entries(root.community?.studyGroups||{}).map(([id,v])=>({id,...(v||{})})).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
 $('communityPostsAdminList').innerHTML=posts.length?posts.map(p=>{
   const reports=Object.keys(p.reports||{}).length,likes=Object.keys(p.likesBy||{}).length;
   return '<div class="admin-list-item"><div><strong>'+esc(p.title||'منشور')+'</strong><small>'+esc(p.author||'طالب')+' • ❤️ '+likes+' • 🚩 '+reports+'</small><p style="font-size:9px;color:#64748b;margin:5px 0 0">'+esc((p.content||'').slice(0,140))+'</p></div><div class="admin-action-row">'+(reports?'<button class="admin-action-btn success" data-clear-reports="'+p.id+'" title="تصفير البلاغات"><i class="fa-solid fa-check"></i></button>':'')+'<button class="admin-action-btn danger" data-delete-post="'+p.id+'" title="حذف المنشور"><i class="fa-solid fa-trash"></i></button></div></div>';
 }).join(''):empty('لا توجد منشورات','المجتمع هادئ حتى الآن.');
 $('communityGroupsAdminList').innerHTML=groups.length?groups.map(g=>'<div class="admin-list-item"><div><strong>'+esc(g.name||'مجموعة')+'</strong><small>'+Object.keys(g.members||{}).length+' عضو • '+esc(g.subjectName||'كل المواد')+'</small></div><button class="admin-action-btn danger" data-delete-group="'+g.id+'"><i class="fa-solid fa-trash"></i></button></div>').join(''):empty('لا توجد مجموعات','أنشئ مجموعة دراسة من النموذج أعلاه.');
 $('[data-delete-post]').forEach(b=>b.onclick=()=>{if(confirm('حذف المنشور من المجتمع؟'))db.ref('community/forums/'+b.dataset.deletePost).remove()});
 $('[data-clear-reports]').forEach(b=>b.onclick=()=>db.ref('community/forums/'+b.dataset.clearReports+'/reports').remove());
 $('[data-delete-group]').forEach(b=>b.onclick=()=>{if(confirm('حذف مجموعة الدراسة؟'))db.ref('community/studyGroups/'+b.dataset.deleteGroup).remove()});
 updateCommunityBadge();
}
async function saveStudyGroup(e){
 e.preventDefault();const name=$('studyGroupName').value.trim();if(!name)return;
 const payload={name,stage:$('studyGroupStage').value||'',subjectName:$('studyGroupSubject').value.trim(),members:{},createdBy:'admin',createdAt:Date.now()};
 await db.ref('community/studyGroups').push(payload);e.target.reset();toast('تم إنشاء مجموعة الدراسة');
}

/* Teachers */
function assignmentsOf(t){return Array.isArray(t?.assignments)?t.assignments:Object.values(t?.assignments||{})}
function renderTeachers(){
 const teachers=values(root.teacherProfiles),students=values(root.studentProfilesV3),subs=flattenSubmissions(),pending=subs.filter(s=>(s.status||'pending')==='pending');
 $('pendingCountText').textContent=pending.length+' قيد المراجعة';
 $('teachersAdminList').innerHTML=teachers.length?teachers.map(t=>'<div class="admin-list-item"><div><strong>'+esc(t.name||t.email||'مدرس')+'</strong><small>'+assignmentsOf(t).length+' صلاحية • '+(t.isActive===false?'موقوف':'نشط')+'</small></div><div class="admin-action-row"><button class="admin-action-btn '+(t.isActive===false?'success':'')+'" data-toggle-teacher="'+t.id+'"><i class="fa-solid '+(t.isActive===false?'fa-play':'fa-pause')+'"></i></button><button class="admin-action-btn danger" data-remove-teacher="'+t.id+'"><i class="fa-solid fa-user-minus"></i></button></div></div>').join(''):empty('لا يوجد مدرسون','حوّل حسابًا من القائمة المجاورة إلى مدرس.');
 const teacherIds=new Set(teachers.map(t=>t.id)),candidates=students.filter(s=>!teacherIds.has(s.id));
 $('teacherCandidates').innerHTML=candidates.length?candidates.map(s=>'<div class="admin-list-item"><div><strong>'+esc(s.name||s.email||'طالب')+'</strong><small>'+esc(s.email||'')+'</small></div><button class="admin-action-btn success" data-promote="'+s.id+'"><i class="fa-solid fa-plus"></i></button></div>').join(''):empty('لا توجد حسابات للترقية','كل الحسابات الحالية لها حالة مدرس أو لا توجد حسابات.');
 $('assignTeacher').innerHTML=teachers.map(t=>'<option value="'+esc(t.id)+'">'+esc(t.name||t.email||t.id)+'</option>').join('');
 refreshAssignmentSubjects();
 $('teacherSubmissionsList').innerHTML=subs.length?subs.map(s=>'<div class="admin-list-item"><div><strong>'+esc(s.title||'محتوى')+'</strong><small>'+esc(s.teacherName||root.teacherProfiles?.[s.uid]?.name||'مدرس')+' • '+esc(typeLabel(s.type))+' • '+esc(gradeLabel(s.stage,s.grade))+' • '+esc(s.subjectName||s.subject||'')+'</small>'+(s.videoUrl?'<a href="'+cleanUrl(s.videoUrl)+'" target="_blank" rel="noopener" style="font-size:9px;color:#2563eb">فتح الفيديو</a>':'')+'</div><div class="admin-action-row">'+((s.status||'pending')==='pending'?'<button class="admin-action-btn success" data-approve="'+s.uid+'|'+s.id+'" title="اعتماد"><i class="fa-solid fa-check"></i></button><button class="admin-action-btn danger" data-reject="'+s.uid+'|'+s.id+'" title="رفض"><i class="fa-solid fa-xmark"></i></button>':'<span class="status-pill '+(s.status==='approved'?'approved':'rejected')+'">'+(s.status==='approved'?'معتمد':'مرفوض')+'</span>')+'</div></div>').join(''):empty('لا توجد طلبات محتوى','عندما يرسل مدرس درسًا سيظهر هنا.');
 $$('[data-toggle-teacher]').forEach(b=>b.onclick=()=>db.ref('teacherProfiles/'+b.dataset.toggleTeacher+'/isActive').set(root.teacherProfiles?.[b.dataset.toggleTeacher]?.isActive===false));
 $$('[data-remove-teacher]').forEach(b=>b.onclick=()=>{if(confirm('إزالة صفة المدرس من الحساب؟'))db.ref('teacherProfiles/'+b.dataset.removeTeacher).remove()});
 $$('[data-promote]').forEach(b=>b.onclick=async()=>{const s=root.studentProfilesV3?.[b.dataset.promote]||{};await db.ref('teacherProfiles/'+b.dataset.promote).set({name:s.name||'',email:s.email||'',isActive:true,createdAt:Date.now(),assignments:[]});toast('تم تحويل الحساب إلى مدرس')});
 $$('[data-approve]').forEach(b=>b.onclick=()=>approveSubmission(b.dataset.approve));
 $$('[data-reject]').forEach(b=>b.onclick=async()=>{const [uid,id]=b.dataset.reject.split('|');await db.ref('teacherSubmissions/'+uid+'/'+id).update({status:'rejected',reviewedAt:Date.now()});toast('تم رفض المحتوى')});
}
function refreshAssignmentSubjects(){
 fillGrades($('assignGrade'),$('assignStage').value);fillSubjects($('assignSubject'),$('assignStage').value,$('assignGrade').value,$('assignType').value);
}
async function addAssignment(){
 const uid=$('assignTeacher').value;if(!uid)return toast('لا يوجد مدرس محدد.','error');
 const payload={type:$('assignType').value,stage:$('assignStage').value,grade:$('assignGrade').value,subject:$('assignSubject').value,subjectName:$('assignSubject').selectedOptions[0]?.textContent||'',createdAt:Date.now()};
 await db.ref('teacherProfiles/'+uid+'/assignments').push(payload);toast('تم إسناد المادة للمدرس');
}
async function approveSubmission(key){
 const [uid,id]=key.split('|'),s=root.teacherSubmissions?.[uid]?.[id];if(!s)return;
 const ref=db.ref('lessons').push();
 await ref.set({title:s.title||'درس',content:'',type:s.type||'public',stage:s.stage||'prep',grade:String(s.grade||1),subject:s.subject||'',unit:Number(s.unit||1),videos:s.videoUrl?[{name:s.teacherName||root.teacherProfiles?.[uid]?.name||'المدرس',url:s.videoUrl,teacherId:uid}]:[],questions:[],isLocked:false,isHidden:false,teacherId:uid,teacherSubmissionId:id,createdAt:Date.now()});
 await db.ref('teacherSubmissions/'+uid+'/'+id).update({status:'approved',lessonId:ref.key,reviewedAt:Date.now()});toast('تم اعتماد المحتوى ونشره');
}

/* Students */
function renderStudents(){
 const q=($('studentSearch')?.value||'').trim().toLowerCase();
 const arr=values(root.studentProfilesV3).filter(s=>!q||(s.name||'').toLowerCase().includes(q)||(s.email||'').toLowerCase().includes(q)).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
 $('studentsAdminList').innerHTML=arr.length?'<table class="admin-table"><thead><tr><th>الطالب</th><th>المرحلة</th><th>XP</th><th>الدروس</th><th>الاختبارات</th><th>آخر نشاط</th></tr></thead><tbody>'+arr.map(s=>'<tr><td><strong>'+esc(s.name||'طالب')+'</strong><br><small>'+esc(s.email||'')+'</small></td><td>'+esc(typeLabel(s.educationType))+' • '+esc(gradeLabel(s.stage,s.grade))+'</td><td>'+Number(s.stats?.totalXP||0)+'</td><td>'+Number(s.stats?.completedLessons||0)+'</td><td>'+Number(s.stats?.completedQuizzes||0)+'</td><td>'+((s.lastActiveAt||s.activity?.lastSeenAt)?new Date(s.lastActiveAt||s.activity.lastSeenAt).toLocaleDateString('ar-EG'):'-')+'</td></tr>').join('')+'</tbody></table>':empty('لا يوجد طلاب مطابقون','ستظهر حسابات الطلاب الجديدة هنا.');
}

/* Announcement + settings */
function loadAnnouncement(){
 const a=root.announcements||{};$('announcementText').value=a.text||'';$('announcementActive').checked=!!a.isActive;
 if(a.expiry)$('announcementDays').value=Math.max(1,Math.ceil((a.expiry-Date.now())/86400000));
}
async function saveAnnouncement(e){e.preventDefault();const days=Math.max(1,Number($('announcementDays').value||3));await db.ref('announcements').set({text:$('announcementText').value.trim(),isActive:$('announcementActive').checked,expiry:Date.now()+days*86400000,updatedAt:Date.now()});toast('تم حفظ الإعلان')}
function loadSettings(){const s=root.settings||{};$('settingSiteName').value=s.siteName||'الأكاديمية';$('settingWhatsapp').value=s.whatsapp||'';$('settingLogo').value=s.siteLogo||'';$('settingAbout').value=s.aboutText||''}
async function saveSettings(e){e.preventDefault();await db.ref('settings').update({siteName:$('settingSiteName').value.trim(),whatsapp:$('settingWhatsapp').value.trim(),siteLogo:$('settingLogo').value.trim(),aboutText:$('settingAbout').value.trim(),updatedAt:Date.now()});toast('تم حفظ الإعدادات')}

/* Pending + auth */
function updatePendingBadge(){
 const n=flattenSubmissions().filter(s=>(s.status||'pending')==='pending').length;$('pendingBadge').textContent=n;$('pendingBadge').classList.toggle('hidden',!n);
}
async function verifyAdmin(user){
 const snap=await db.ref('adminProfiles/'+user.uid).once('value');return snap.val()?.isAdmin===true;
}
async function startDataListener(){
 if(unsubscribe)unsubscribe();
 const handler=s=>{root=s.val()||{};renderAll()};
 db.ref('/').on('value',handler);unsubscribe=()=>db.ref('/').off('value',handler);
}

/* events */
$$('[data-admin-tab]').forEach(b=>b.onclick=()=>setTab(b.dataset.adminTab));
$$('[data-jump-tab]').forEach(b=>b.onclick=()=>setTab(b.dataset.jumpTab));
$$('[data-close-admin-modal]').forEach(b=>b.onclick=()=>closeModal(b.dataset.closeAdminModal));
$('openSubjectModal').onclick=()=>openModal('subjectModal');$('openLessonModal').onclick=()=>{resetLessonEditor();openModal('lessonModal')};$('openQuizModal').onclick=()=>{resetQuizEditor();openModal('quizModal')};$('openFileModal').onclick=()=>{resetFileEditor();openModal('fileModal')};$('openSimulationModal').onclick=()=>{resetSimulationEditor();openModal('simulationModal')};$('openLiveModal').onclick=()=>{resetLiveEditor();openModal('liveModal')};
$('addLessonVideoRow').onclick=addLessonVideoRow;
renderLessonVideosEditor([{name:'',url:''}]);
$('subjectForm').onsubmit=saveSubject;$('lessonForm').onsubmit=saveLesson;$('quizForm').onsubmit=saveQuiz;$('fileForm').onsubmit=saveFile;$('simulationForm').onsubmit=saveSimulation;$('liveForm').onsubmit=saveLiveSession;$('studyGroupForm').onsubmit=saveStudyGroup;$('announcementForm').onsubmit=saveAnnouncement;$('settingsForm').onsubmit=saveSettings;
$('lessonSearch').oninput=renderLessons;$('lessonFilterStage').onchange=renderLessons;$('lessonFilterType').onchange=renderLessons;$('studentSearch').oninput=renderStudents;
$('curriculumType').onchange=renderCurriculum;$('curriculumStage').onchange=()=>{fillGrades($('curriculumGrade'),$('curriculumStage').value);renderCurriculum()};$('curriculumGrade').onchange=renderCurriculum;
$('assignType').onchange=refreshAssignmentSubjects;$('assignStage').onchange=refreshAssignmentSubjects;$('assignGrade').onchange=refreshAssignmentSubjects;$('addAssignmentBtn').onclick=addAssignment;
$('adminMenuBtn').onclick=()=>{$('adminSidebar').classList.add('open');$('adminOverlay').classList.remove('hidden')};$('adminOverlay').onclick=()=>{$('adminSidebar').classList.remove('open');$('adminOverlay').classList.add('hidden')};
$('adminRefreshBtn').onclick=async()=>{const s=await db.ref('/').once('value');root=s.val()||{};renderAll();toast('تم تحديث البيانات')};
$('adminLogout').onclick=()=>auth.signOut();
$('adminGlobalSearch').oninput=e=>{const q=e.target.value.trim();$('lessonSearch').value=q;$('studentSearch').value=q;if(q){setTab('lessons');renderLessons()}};
$('adminLoginForm').onsubmit=async e=>{
 e.preventDefault();const btn=$('adminLoginBtn');btn.disabled=true;btn.textContent='جاري التحقق...';
 try{await auth.signInWithEmailAndPassword($('adminEmail').value.trim(),$('adminPassword').value)}catch(err){toast('البريد أو كلمة المرور غير صحيحة.','error')}finally{btn.disabled=false;btn.textContent='دخول لوحة الإدارة'}
};
$('adminResetPassword').onclick=async()=>{const email=$('adminEmail').value.trim();if(!email)return toast('اكتب البريد أولًا.','error');try{await auth.sendPasswordResetEmail(email);toast('تم إرسال رابط إعادة تعيين كلمة المرور.')}catch{toast('تعذر إرسال الرابط.','error')}};

bindHierarchy('subjectType','subjectStage','subjectGrade',null);
bindHierarchy('newLessonType','newLessonStage','newLessonGrade','newLessonSubject');
bindHierarchy('newQuizType','newQuizStage','newQuizGrade','newQuizSubject');
bindHierarchy('newFileType','newFileStage','newFileGrade','newFileSubject');
bindHierarchy('simType','simStage','simGrade',null);
fillGrades($('curriculumGrade'),$('curriculumStage').value);
refreshAssignmentSubjects();

auth.onAuthStateChanged(async user=>{
 currentUser=user;
 if(!user){if(unsubscribe){unsubscribe();unsubscribe=null}$('adminApp').classList.add('hidden');$('adminLogin').classList.remove('hidden');return}
 try{
   const ok=await verifyAdmin(user);
   if(!ok){toast('هذا الحساب ليس له صلاحية مدير.','error');await auth.signOut();return}
   $('adminLogin').classList.add('hidden');$('adminApp').classList.remove('hidden');await startDataListener();
 }catch(err){console.error(err);toast('تعذر التحقق من صلاحية الإدارة.','error');await auth.signOut()}
});
})();