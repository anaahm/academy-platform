(() => {
'use strict';

const firebaseConfig=window.ACADEMY_FIREBASE_CONFIG;
if(!firebaseConfig) throw new Error('Firebase configuration is missing');
if(!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth=firebase.auth(),db=firebase.database();
const $=id=>document.getElementById(id), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const askConfirm=opts=>window.AcademyUI?.confirm?window.AcademyUI.confirm(opts):(console.error('AcademyUI confirm unavailable'),Promise.resolve(false));

let currentUser=null,root={},unsubscribe=null,currentAdminTab='overview',adminModalTrigger=null;
const adminPathStops=new Map(),adminPathPromises=new Map();
const editState={subject:null,lesson:null,quiz:null,file:null,simulation:null,live:null,schedule:null,news:null};
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
function openModal(id){
 const modal=$(id);if(!modal)return;
 adminModalTrigger=document.activeElement instanceof HTMLElement?document.activeElement:null;
 modal.classList.remove('hidden');modal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';
 setTimeout(()=>modal.querySelector('.modal-panel')?.focus(),30);
}
function closeModal(id){
 const modal=$(id);if(!modal)return;
 modal.classList.add('hidden');modal.setAttribute('aria-hidden','true');document.body.style.overflow='';
 const target=adminModalTrigger;adminModalTrigger=null;setTimeout(()=>target?.focus(),30);
}
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
   const i=list.findIndex(x=>x.id===s.id),item={id:s.id,name:s.name,emoji:s.emoji||'📚',imageUrl:s.imageUrl||'',units:s.units||[]};
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

const ADMIN_CORE_PATHS=['adminProfiles','lessons','quizzes','studentProfilesV3','teacherProfiles','teacherSubmissions','community'];
const ADMIN_TAB_PATHS={
 overview:ADMIN_CORE_PATHS,
 curriculum:['customSubjects'],
 lessons:['lessons','customSubjects','teacherProfiles'],
 quizzes:['quizzes','customSubjects'],
 simulations:['simulations'],
 files:['files','customSubjects'],
 live:['liveSessions'],
 schedule:['scheduleEvents','customSubjects'],
 teachers:['teacherProfiles','teacherSubmissions','studentProfilesV3','customSubjects','settings'],
 students:['studentProfilesV3'],
 news:['posts'],
 community:['community'],
 notifications:[],
 announcements:['announcements'],
 settings:['settings']
};
const adminMeta={
 overview:['لوحة المعلومات','صباح الخير 👋'],
 curriculum:['هيكل المنهج','المواد والوحدات'],
 lessons:['المحتوى','إدارة الدروس'],
 quizzes:['التقييم','إدارة الاختبارات'],
 simulations:['التدريب','إدارة المحاكيات'],
 files:['المكتبة','الملفات والمراجع'],
 schedule:['المواعيد','جدول الحصص'],
 live:['الجلسات','البث المباشر'],
 teachers:['فريق التدريس','المدرسون والمراجعات'],
 students:['المتعلمون','إدارة الطلاب'],
 news:['التواصل','الأخبار والتحديثات'],
 community:['الإشراف','المجتمع والبلاغات'],
 notifications:['التواصل','الإشعارات الموجهة'],
 announcements:['التواصل','الإعلانات'],
 settings:['المنصة','الإعدادات']
};
function renderAdminIdentity(){
 $('adminName').textContent=adminName();
 $('adminEmailMini').textContent=currentUser?.email||'';
 $('adminAvatar').textContent=(adminName()[0]||'م').toUpperCase();
}
function renderTab(tab){
 ({overview:renderOverview,curriculum:renderCurriculum,lessons:renderLessons,quizzes:renderQuizzes,simulations:renderSimulations,files:renderFiles,live:renderLiveSessions,schedule:renderScheduleEvents,teachers:renderTeachers,students:renderStudents,news:renderNews,community:renderCommunityAdmin,announcements:loadAnnouncement,settings:loadSettings}[tab]||(()=>{}))();
}
function pathsForTab(tab){
 return [...new Set([...(ADMIN_TAB_PATHS[tab]||[]),...(tab==='overview'?ADMIN_CORE_PATHS:[])])];
}
function attachAdminPath(path){
 if(adminPathPromises.has(path))return adminPathPromises.get(path);
 const promise=new Promise(resolve=>{
   const ref=db.ref(path);let first=true;
   const handler=s=>{
     root[path]=s.val()||{};
     if(first){first=false;resolve(true);return}
     if(path==='adminProfiles')renderAdminIdentity();
     if(path==='teacherSubmissions')updatePendingBadge();
     if(path==='community')updateCommunityBadge();
     if(pathsForTab(currentAdminTab).includes(path))renderTab(currentAdminTab);
     if(currentAdminTab==='overview'&&ADMIN_CORE_PATHS.includes(path))renderOverview();
   };
   const errorHandler=err=>{
     console.error('Admin data listener failed:',path,err);
     root[path]=root[path]||{};first=false;resolve(false);
   };
   ref.on('value',handler,errorHandler);
   adminPathStops.set(path,()=>ref.off('value',handler));
 });
 adminPathPromises.set(path,promise);
 return promise;
}
async function ensureAdminPaths(paths){
 const list=[...new Set(paths||[])];
 if(!list.length)return true;
 const results=await Promise.all(list.map(attachAdminPath));
 return results.every(Boolean);
}
function stopAdminListeners(){
 adminPathStops.forEach(stop=>{try{stop()}catch{}});
 adminPathStops.clear();adminPathPromises.clear();
}
async function setTab(tab,updateUrl=true){
 if(!adminMeta[tab]&&!document.getElementById('admin-tab-'+tab))tab='overview';
 currentAdminTab=tab;
 $$('.admin-tab').forEach(s=>s.classList.toggle('active',s.id==='admin-tab-'+tab));
 $$('[data-admin-tab]').forEach(b=>{
   const active=b.dataset.adminTab===tab;
   b.classList.toggle('active',active);
   if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
 });
 const meta=adminMeta[tab]||['الإدارة','لوحة الإدارة'];
 $('adminSectionKicker').textContent=meta[0];$('adminSectionTitle').textContent=meta[1];
 $('adminSidebar').classList.remove('open');$('adminOverlay').classList.add('hidden');
 if(updateUrl){
   const url=new URL(location.href);
   if(tab==='overview')url.searchParams.delete('tab');else url.searchParams.set('tab',tab);
   history.replaceState({},'',url);
 }
 const needed=pathsForTab(tab),missing=needed.filter(path=>!adminPathPromises.has(path));
 if(missing.length)window.AcademyUI?.showPageLoading('جاري تحميل '+meta[1]+'...');
 const ok=await ensureAdminPaths(needed);
 renderAdminIdentity();updatePendingBadge();updateCommunityBadge();renderTab(tab);
 if(missing.length)window.AcademyUI?.hidePageLoading();
 if(!ok)toast('تم تحميل القسم مع تعذر قراءة جزء من البيانات.','error');
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
   const image=safeSubjectImageUrl(custom?.imageUrl||s.imageUrl||'');
   return '<article class="admin-subject-card '+(image?'has-image':'')+'">'+
     (image?'<div class="admin-subject-thumb" style="background-image:url(&quot;'+esc(image)+'&quot;)"></div>':'<div class="admin-subject-auto-art"><span>'+esc(s.emoji||'📚')+'</span></div>')+
     '<span class="section-kicker">'+esc(typeLabel(type))+' • '+esc(gradeLabel(stage,grade))+'</span><h3>'+esc(s.name)+'</h3><p>رمز المادة: '+esc(s.id)+'</p><div class="admin-unit-tags">'+(units.length?units.map((u,i)=>'<span>'+(i+1)+'. '+esc(u.name||u)+'</span>').join(''):'<span>بدون وحدات مخصصة</span>')+'</div>'+
     '<div class="admin-action-row" style="margin-top:12px"><button class="admin-action-btn" data-edit-subject="'+esc(s.id)+'" title="تعديل المادة والصورة والوحدات"><i class="fa-solid fa-pen"></i></button>'+(custom?'<button class="admin-action-btn danger" data-delete-subject="'+esc(s.id)+'" title="حذف التخصيص والعودة للوضع الافتراضي"><i class="fa-solid fa-rotate-left"></i></button>':'')+'</div></article>';
 }).join(''):empty();
 $$('[data-edit-subject]').forEach(b=>b.onclick=()=>editSubject(b.dataset.editSubject));
 $$('[data-delete-subject]').forEach(b=>b.onclick=()=>deleteSubject(b.dataset.deleteSubject));
}
function safeSubjectImageUrl(value=''){
 try{if(!value)return'';const u=new URL(value,location.href);return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return''}
}
function renderSubjectImagePreview(){
 const box=$('subjectImagePreview');if(!box)return;
 const safe=safeSubjectImageUrl($('subjectImageUrl')?.value.trim()||'');
 box.classList.toggle('has-image',!!safe);
 box.style.backgroundImage=safe?'linear-gradient(180deg,rgba(5,31,84,.05),rgba(5,31,84,.28)),url("'+safe.replace(/"/g,'%22')+'")':'';
 box.querySelector('span').textContent=safe?'معاينة صورة المادة':'سيظهر التصميم التلقائي عند عدم إضافة صورة';
}
function resetSubjectEditor(){
 editState.subject=null;$('subjectForm').reset();
 ['subjectType','subjectStage','subjectGrade','subjectId'].forEach(id=>{$(id).disabled=false});
 $('subjectType').value='public';$('subjectStage').value='primary';fillGrades($('subjectGrade'),'primary');$('subjectEmoji').value='📚';$('subjectImageUrl').value='';renderSubjectImagePreview();
 if($('subjectModalTitle'))$('subjectModalTitle').textContent='إضافة مادة ووحداتها';
}
function editSubject(id){
 const type=$('curriculumType').value,stage=$('curriculumStage').value,grade=$('curriculumGrade').value;
 const current=root.customSubjects?.[stage]?.[grade],arr=Array.isArray(current)?current:Object.values(current||{});
 const custom=arr.find(x=>x?.id===id&&(!x.type||x.type===type));
 const fallback=(defaultSubjects[stage]||[]).find(x=>x.id===id);
 const s=custom||fallback;if(!s)return;
 editState.subject={id,type,stage,grade,isDefaultOverride:!custom};
 $('subjectType').value=type;$('subjectStage').value=stage;fillGrades($('subjectGrade'),stage,grade);$('subjectGrade').value=String(grade);
 $('subjectId').value=s.id||id;$('subjectName').value=s.name||'';$('subjectEmoji').value=s.emoji||'📚';$('subjectImageUrl').value=s.imageUrl||'';renderSubjectImagePreview();$('subjectUnits').value=(s.units||[]).map(u=>u?.name||u||'').filter(Boolean).join('\n');
 ['subjectType','subjectStage','subjectGrade','subjectId'].forEach(key=>{$(key).disabled=true});
 if($('subjectModalTitle'))$('subjectModalTitle').textContent='تعديل المادة والوحدات';openModal('subjectModal');
}
async function deleteSubject(id){
 if(!(await askConfirm({title:'حذف المادة؟',message:'سيتم حذف المادة المخصصة من هذا الصف. تأكد أنه لا يوجد محتوى تحتاجه مرتبط بها.',tone:'danger',acceptText:'حذف المادة'})))return;
 const type=$('curriculumType').value,stage=$('curriculumStage').value,grade=$('curriculumGrade').value;
 const current=root.customSubjects?.[stage]?.[grade],arr=Array.isArray(current)?[...current]:Object.values(current||{});
 const next=arr.filter(x=>!(x?.id===id&&(!x.type||x.type===type)));
 await db.ref('customSubjects/'+stage+'/'+grade).set(next);toast('تم حذف المادة');
}
async function saveSubject(e){
 e.preventDefault();
 const editing=editState.subject;
 const stage=editing?.stage||$('subjectStage').value,grade=String(editing?.grade||$('subjectGrade').value),type=editing?.type||$('subjectType').value;
 const current=root.customSubjects?.[stage]?.[grade],arr=Array.isArray(current)?[...current]:Object.values(current||{});
 const id=editing?.id||$('subjectId').value.trim(),name=$('subjectName').value.trim();if(!id||!name)return;
 const units=$('subjectUnits').value.split('\n').map(x=>x.trim()).filter(Boolean).map(name=>({name}));
 const rawImage=$('subjectImageUrl').value.trim(),imageUrl=safeSubjectImageUrl(rawImage);
 if(rawImage&&!imageUrl)return toast('رابط صورة المادة غير صحيح.','error');
 const value={id,name,type,emoji:$('subjectEmoji').value.trim()||'📚',imageUrl,units};
 if(editing){
   const idx=arr.findIndex(x=>x?.id===editing.id&&(!x.type||x.type===editing.type));
   if(idx<0)arr.push({...value,createdAt:Date.now(),updatedAt:Date.now()});
   else arr[idx]={...arr[idx],...value,updatedAt:Date.now()};
   await db.ref('customSubjects/'+stage+'/'+grade).set(arr);toast('تم تحديث المادة والصورة والوحدات');
 }else{
   if(arr.some(x=>x?.id===id&&(!x.type||x.type===type)))return toast('رمز المادة موجود بالفعل.','error');
   arr.push({...value,createdAt:Date.now()});
   await db.ref('customSubjects/'+stage+'/'+grade).set(arr);toast('تمت إضافة المادة');
 }
 closeModal('subjectModal');resetSubjectEditor();
}

function renderLessonVideosEditor(videos){
 const list=Array.isArray(videos)&&videos.length?videos:[{name:'',url:''}];
 const wrap=$('lessonVideosEditor');if(!wrap)return;
 wrap.innerHTML=list.map((v,i)=>'<div class="admin-video-row"><input class="lesson-video-name" value="'+esc(v?.name||'')+'" placeholder="اسم المدرس"><input class="lesson-video-url" type="url" dir="ltr" value="'+esc(v?.url||'')+'" placeholder="رابط YouTube"><button type="button" class="admin-action-btn danger" data-remove-video-row="'+i+'" title="حذف الفيديو"><i class="fa-solid fa-xmark"></i></button></div>').join('');
 $$('[data-remove-video-row]',wrap).forEach(b=>b.onclick=()=>{
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
 editState.lesson=null;$('lessonForm').reset();fillGrades($('newLessonGrade'),$('newLessonStage').value);fillSubjects($('newLessonSubject'),$('newLessonStage').value,$('newLessonGrade').value,$('newLessonType').value);renderLessonVideosEditor([{name:'',url:''}]);$('newLessonImagePosition').value='top';$('newLessonQuestions').value='[]';if($('lessonModalTitle'))$('lessonModalTitle').textContent='إضافة درس جديد';
}

/* Lessons */
function filteredLessons(){
 const q=($('lessonSearch')?.value||'').trim().toLowerCase(),stage=$('lessonFilterStage')?.value||'',type=$('lessonFilterType')?.value||'';
 return values(root.lessons).filter(l=>(!q||(l.title||'').toLowerCase().includes(q))&&(!stage||l.stage===stage)&&(!type||l.type===type)).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
}
function renderLessons(){
 const arr=filteredLessons();
 $('lessonsAdminList').innerHTML=arr.length?'<table class="admin-table"><thead><tr><th>الدرس</th><th>المسار</th><th>المرحلة</th><th>المادة</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>'+arr.map(l=>'<tr><td><strong>'+esc(l.title||'درس')+'</strong><br><small>'+(l.videos?.length||0)+' فيديو • '+(l.questions?.length||0)+' سؤال</small></td><td>'+esc(typeLabel(l.type))+'</td><td>'+esc(gradeLabel(l.stage,l.grade))+'</td><td>'+esc(l.subject||'-')+'</td><td><span class="status-pill '+(l.isHidden?'rejected':'approved')+'">'+(l.isHidden?'مخفي':'منشور')+'</span></td><td><div class="admin-action-row"><button class="admin-action-btn" data-edit-lesson="'+l.id+'" title="تعديل"><i class="fa-solid fa-pen"></i></button><button class="admin-action-btn" data-toggle-lesson="'+l.id+'" title="إظهار/إخفاء"><i class="fa-solid fa-eye"></i></button><button class="admin-action-btn danger" data-delete-lesson="'+l.id+'" title="حذف"><i class="fa-solid fa-trash"></i></button></div></td></tr>').join('')+'</tbody></table>':empty('لا توجد دروس','أضف أول درس جديد.');
 $$('[data-edit-lesson]').forEach(b=>b.onclick=()=>editLesson(b.dataset.editLesson));
 $$('[data-toggle-lesson]').forEach(b=>b.onclick=()=>{const l=root.lessons?.[b.dataset.toggleLesson];db.ref('lessons/'+b.dataset.toggleLesson+'/isHidden').set(!l?.isHidden)});
 $$('[data-delete-lesson]').forEach(b=>b.onclick=async()=>{if(await askConfirm({title:'حذف الدرس نهائيًا؟',message:'لن يمكن استرجاع الدرس بعد الحذف من المنصة.',tone:'danger',acceptText:'حذف الدرس'}))await db.ref('lessons/'+b.dataset.deleteLesson).remove()});
}
async function editLesson(id){
 const l=root.lessons?.[id];if(!l)return;
 editState.lesson=id;
 $('newLessonType').value=l.type||'public';$('newLessonStage').value=l.stage||'primary';fillGrades($('newLessonGrade'),$('newLessonStage').value,l.grade||'1');$('newLessonGrade').value=String(l.grade||'1');fillSubjects($('newLessonSubject'),l.stage||'primary',String(l.grade||'1'),l.type||'public');$('newLessonSubject').value=l.subject||'';
 $('newLessonUnit').value=Number(l.unit||1);$('newLessonTitle').value=l.title||'';$('newLessonContent').value=l.content||'';$('newLessonImage').value=l.imageUrl||'';$('newLessonImagePosition').value=l.imagePosition||'top';$('newLessonQuestions').value=JSON.stringify(l.questions||[],null,2);$('newLessonHidden').checked=!!l.isHidden;renderLessonVideosEditor(l.videos||[]);
 if($('lessonModalTitle'))$('lessonModalTitle').textContent='تعديل الدرس';openModal('lessonModal');
}
async function saveLesson(e){
 e.preventDefault();
 const videos=collectLessonVideos(),existing=editState.lesson?root.lessons?.[editState.lesson]:null;
 let questions=[];
 try{
   questions=JSON.parse($('newLessonQuestions').value.trim()||'[]');
   if(!Array.isArray(questions))throw new Error();
 }catch{return toast('صيغة JSON لأسئلة الدرس غير صحيحة.','error')}
 try{questions=window.AcademyUtils.validateQuestions(questions)}catch(err){return toast(err.message,'error')}
 const payload={type:$('newLessonType').value,stage:$('newLessonStage').value,grade:$('newLessonGrade').value,subject:$('newLessonSubject').value,unit:Number($('newLessonUnit').value||1),title:$('newLessonTitle').value.trim(),content:$('newLessonContent').value.trim(),imageUrl:$('newLessonImage').value.trim(),imagePosition:$('newLessonImagePosition').value,videos,questions,isLocked:existing?.isLocked||false,isHidden:$('newLessonHidden').checked};
 if(editState.lesson){payload.updatedAt=Date.now();await db.ref('lessons/'+editState.lesson).update(payload);toast('تم تحديث الدرس')}
 else{payload.createdAt=Date.now();await db.ref('lessons').push(payload);toast('تم نشر الدرس')}
 closeModal('lessonModal');resetLessonEditor();
}

/* Quizzes */
function renderQuizzes(){
 const arr=values(root.quizzes).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
 $('quizzesAdminList').innerHTML=arr.length?'<table class="admin-table"><thead><tr><th>الاختبار</th><th>المرحلة</th><th>المادة</th><th>الوحدة</th><th>الأسئلة</th><th>إجراء</th></tr></thead><tbody>'+arr.map(q=>'<tr><td><strong>'+esc(q.name||'اختبار')+'</strong></td><td>'+esc(gradeLabel(q.stage,q.grade))+'</td><td>'+esc(q.subject||'-')+'</td><td>'+(Number(q.unit||0)===0?'شامل':esc(q.unit||'-'))+'</td><td>'+(q.questions?.length||0)+'</td><td><div class="admin-action-row"><button class="admin-action-btn" data-edit-quiz="'+q.id+'" title="تعديل"><i class="fa-solid fa-pen"></i></button><button class="admin-action-btn danger" data-delete-quiz="'+q.id+'"><i class="fa-solid fa-trash"></i></button></div></td></tr>').join('')+'</tbody></table>':empty('لا توجد اختبارات','أنشئ أول اختبار.');
 $$('[data-edit-quiz]').forEach(b=>b.onclick=()=>editQuiz(b.dataset.editQuiz));
 $$('[data-delete-quiz]').forEach(b=>b.onclick=async()=>{if(await askConfirm({title:'حذف الاختبار؟',message:'سيتم حذف الاختبار والأسئلة الموجودة بداخله من المنصة.',tone:'danger',acceptText:'حذف الاختبار'}))await db.ref('quizzes/'+b.dataset.deleteQuiz).remove()});
}
function resetQuizEditor(){editState.quiz=null;$('quizForm').reset();fillGrades($('newQuizGrade'),$('newQuizStage').value);fillSubjects($('newQuizSubject'),$('newQuizStage').value,$('newQuizGrade').value,$('newQuizType').value);if($('quizModalTitle'))$('quizModalTitle').textContent='إنشاء اختبار'}
function editQuiz(id){
 const q=root.quizzes?.[id];if(!q)return;editState.quiz=id;
 $('newQuizType').value=q.type||'public';$('newQuizStage').value=q.stage||'primary';fillGrades($('newQuizGrade'),q.stage||'primary',q.grade||'1');$('newQuizGrade').value=String(q.grade||'1');fillSubjects($('newQuizSubject'),q.stage||'primary',String(q.grade||'1'),q.type||'public');$('newQuizSubject').value=q.subject||'';$('newQuizUnit').value=Number(q.unit||0);$('newQuizName').value=q.name||'';$('newQuizQuestions').value=JSON.stringify(q.questions||[],null,2);if($('quizModalTitle'))$('quizModalTitle').textContent='تعديل الاختبار';openModal('quizModal');
}
async function saveQuiz(e){
 e.preventDefault();let questions=[];
 try{questions=JSON.parse($('newQuizQuestions').value.trim()||'[]');if(!Array.isArray(questions))throw new Error()}catch{return toast('صيغة JSON للأسئلة غير صحيحة.','error')}
 try{questions=window.AcademyUtils.validateQuestions(questions)}catch(err){return toast(err.message,'error')}
 if(!questions.length)return toast('أضف سؤالًا صحيحًا واحدًا على الأقل.','error');
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
 $$('[data-edit-sim]').forEach(b=>b.onclick=()=>editSimulation(b.dataset.editSim));
 $$('[data-toggle-sim]').forEach(b=>b.onclick=()=>db.ref('simulations/'+b.dataset.toggleSim+'/isHidden').set(!root.simulations?.[b.dataset.toggleSim]?.isHidden));
 $$('[data-delete-sim]').forEach(b=>b.onclick=async()=>{if(await askConfirm({title:'حذف المحاكي؟',message:'سيتم حذف إعدادات هذا المحاكي من المنصة.',tone:'danger',acceptText:'حذف المحاكي'}))await db.ref('simulations/'+b.dataset.deleteSim).remove()});
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
 $$('[data-edit-file]').forEach(b=>b.onclick=()=>editFile(b.dataset.editFile));
 $$('[data-delete-file]').forEach(b=>b.onclick=async()=>{if(await askConfirm({title:'حذف الملف؟',message:'سيتم إزالة الملف من مكتبة المنصة.',tone:'danger',acceptText:'حذف الملف'}))await db.ref('files/'+b.dataset.deleteFile).remove()});
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
 $$('[data-edit-live]').forEach(b=>b.onclick=()=>editLiveSession(b.dataset.editLive));
 $$('[data-delete-live]').forEach(b=>b.onclick=async()=>{if(await askConfirm({title:'حذف الجلسة؟',message:'سيتم حذف موعد البث أو الجلسة من جداول الطلاب.',tone:'danger',acceptText:'حذف الجلسة'}))await db.ref('liveSessions/'+b.dataset.deleteLive).remove()});
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

/* Weekly schedule */
const scheduleDayNames={0:'الأحد',1:'الاثنين',2:'الثلاثاء',3:'الأربعاء',4:'الخميس',5:'الجمعة',6:'السبت'};
function renderScheduleEvents(){
 const list=values(root.scheduleEvents).sort((a,b)=>Number(a.dayOfWeek||0)-Number(b.dayOfWeek||0)||String(a.time||'').localeCompare(String(b.time||'')));
 const el=$('scheduleAdminList');if(!el)return;
 el.innerHTML=list.length?list.map(e=>{
   const status=e.isActive===false?'موقوفة':'نشطة';
   return '<div class="admin-list-item"><div><strong>'+esc(e.title||'حصة')+'</strong><small>'+esc(typeLabel(e.type))+' • '+esc(gradeLabel(e.stage,e.grade))+' • '+esc(e.subjectName||e.subject||'')+'</small><small>'+esc(scheduleDayNames[Number(e.dayOfWeek)]||'')+' • '+esc(e.time||'')+' • '+Number(e.duration||60)+' دقيقة • '+esc(e.teacher||'بدون مدرس')+'</small></div><div class="admin-action-row"><button class="admin-action-btn" data-edit-schedule="'+e.id+'" title="تعديل"><i class="fa-solid fa-pen"></i></button><button class="admin-action-btn '+(e.isActive===false?'success':'')+'" data-toggle-schedule="'+e.id+'" title="تفعيل/إيقاف"><i class="fa-solid '+(e.isActive===false?'fa-play':'fa-pause')+'"></i></button><button class="admin-action-btn danger" data-delete-schedule="'+e.id+'" title="حذف"><i class="fa-solid fa-trash"></i></button></div></div>';
 }).join(''):empty('لا توجد حصص أسبوعية','أضف أول حصة من النموذج.');
 $$('[data-edit-schedule]').forEach(b=>b.onclick=()=>editScheduleEvent(b.dataset.editSchedule));
 $$('[data-toggle-schedule]').forEach(b=>b.onclick=()=>db.ref('scheduleEvents/'+b.dataset.toggleSchedule+'/isActive').set(root.scheduleEvents?.[b.dataset.toggleSchedule]?.isActive===false));
 $$('[data-delete-schedule]').forEach(b=>b.onclick=async()=>{if(await askConfirm({title:'حذف الحصة؟',message:'سيختفي هذا الموعد من جداول الطلاب المستهدفين.',tone:'danger',acceptText:'حذف الحصة'}))await db.ref('scheduleEvents/'+b.dataset.deleteSchedule).remove()});
}
function resetScheduleEditor(){
 editState.schedule=null;$('scheduleEventForm')?.reset();
 if($('scheduleTime'))$('scheduleTime').value='18:00';
 if($('scheduleDuration'))$('scheduleDuration').value=60;
 if($('scheduleActive'))$('scheduleActive').checked=true;
 fillGrades($('scheduleGrade'),$('scheduleStage')?.value||'primary');
 fillSubjects($('scheduleSubject'),$('scheduleStage')?.value||'primary',$('scheduleGrade')?.value||'1',$('scheduleType')?.value||'public');
}
function editScheduleEvent(id){
 const e=root.scheduleEvents?.[id];if(!e)return;editState.schedule=id;
 $('scheduleType').value=e.type||'public';$('scheduleStage').value=e.stage||'primary';
 fillGrades($('scheduleGrade'),e.stage||'primary',e.grade||'1');$('scheduleGrade').value=String(e.grade||1);
 fillSubjects($('scheduleSubject'),e.stage||'primary',String(e.grade||1),e.type||'public');$('scheduleSubject').value=e.subject||'';
 $('scheduleTitle').value=e.title||'';$('scheduleTeacher').value=e.teacher||'';$('scheduleDay').value=String(e.dayOfWeek??6);
 $('scheduleTime').value=e.time||'18:00';$('scheduleDuration').value=Number(e.duration||60);$('scheduleUrl').value=e.url||'';$('scheduleActive').checked=e.isActive!==false;
 $('scheduleTitle').focus();window.scrollTo({top:0,behavior:'smooth'});
}
async function saveScheduleEvent(e){
 e.preventDefault();
 const subject=$('scheduleSubject').value,subjectName=$('scheduleSubject').selectedOptions[0]?.textContent||subject;
 const payload={type:$('scheduleType').value,stage:$('scheduleStage').value,grade:$('scheduleGrade').value,subject,subjectName,title:$('scheduleTitle').value.trim(),teacher:$('scheduleTeacher').value.trim(),dayOfWeek:Number($('scheduleDay').value),time:$('scheduleTime').value,duration:Number($('scheduleDuration').value||60),url:$('scheduleUrl').value.trim(),isActive:$('scheduleActive').checked};
 if(!payload.title||!payload.time)return toast('أكمل عنوان الحصة والوقت.','error');
 if(editState.schedule){payload.updatedAt=Date.now();await db.ref('scheduleEvents/'+editState.schedule).update(payload);toast('تم تحديث موعد الحصة')}
 else{payload.createdAt=Date.now();await db.ref('scheduleEvents').push(payload);toast('تمت إضافة الحصة للجدول')}
 resetScheduleEditor();
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
 $$('[data-delete-post]').forEach(b=>b.onclick=async()=>{if(await askConfirm({title:'حذف المنشور؟',message:'سيتم حذف المنشور من مجتمع الطلاب نهائيًا.',tone:'danger',acceptText:'حذف المنشور'}))await db.ref('community/forums/'+b.dataset.deletePost).remove()});
 $$('[data-clear-reports]').forEach(b=>b.onclick=()=>db.ref('community/forums/'+b.dataset.clearReports+'/reports').remove());
 $$('[data-delete-group]').forEach(b=>b.onclick=async()=>{if(await askConfirm({title:'حذف مجموعة الدراسة؟',message:'سيتم حذف المجموعة وإزالتها من قائمة الطلاب.',tone:'danger',acceptText:'حذف المجموعة'}))await db.ref('community/studyGroups/'+b.dataset.deleteGroup).remove()});
 updateCommunityBadge();
}
async function saveStudyGroup(e){
 e.preventDefault();const name=$('studyGroupName').value.trim();if(!name)return;
 const payload={name,stage:$('studyGroupStage').value||'',subjectName:$('studyGroupSubject').value.trim(),members:{},createdBy:'admin',createdAt:Date.now()};
 await db.ref('community/studyGroups').push(payload);e.target.reset();toast('تم إنشاء مجموعة الدراسة');
}

/* Teachers */
function assignmentsOf(t){return Array.isArray(t?.assignments)?t.assignments:Object.values(t?.assignments||{})}
async function createTeacherAccount(event){
 event.preventDefault();
 const form=event.currentTarget,button=$('createTeacherBtn'),status=$('createTeacherStatus');
 const name=$('newTeacherName').value.trim(),email=$('newTeacherEmail').value.trim().toLowerCase(),password=$('newTeacherPassword').value;
 if(!name||!email||password.length<8){status.textContent='أكمل اسم المدرس والبريد وكلمة مرور من 8 أحرف على الأقل.';status.classList.add('error');return}
 if(!currentUser||!(await verifyAdmin(currentUser))){status.textContent='انتهت صلاحية الإدارة. سجّل الدخول من جديد.';status.classList.add('error');return}
 button.disabled=true;status.textContent='جاري إنشاء حساب المدرس...';status.classList.remove('error');
 let secondaryApp,createdUser=null,profileSaved=false;
 try{
   secondaryApp=firebase.initializeApp(firebaseConfig,'teacher-provision-'+Date.now());
   const secondaryAuth=secondaryApp.auth();
   await secondaryAuth.setPersistence(firebase.auth.Auth.Persistence.NONE);
   const credential=await secondaryAuth.createUserWithEmailAndPassword(email,password);
   createdUser=credential.user;
   await db.ref('teacherProfiles/'+createdUser.uid).set({name,email,isActive:true,createdAt:Date.now(),assignments:[]});
   profileSaved=true;form.reset();
   status.textContent='تم إنشاء حساب '+name+' بنجاح. اسند له المادة والصف من القائمة أدناه، ثم أعطه بيانات الدخول بشكل خاص.';
   toast('تم إنشاء حساب المدرس.');
 }catch(err){
   console.error('Teacher account creation failed:',err);
   if(createdUser&&!profileSaved){try{await createdUser.delete();createdUser=null}catch(cleanupError){console.error('Teacher account cleanup failed:',cleanupError)}}
   status.classList.add('error');
   status.textContent=err.code==='auth/email-already-in-use'?'البريد مستخدم بالفعل. إذا كان الحساب موجودًا كطالب، رقّه من القائمة أدناه.':
     createdUser?'تعذر حفظ صلاحية المدرس. أُنشئ حساب تسجيل الدخول؛ احذفه من Firebase Authentication قبل إعادة المحاولة.':'تعذر إنشاء الحساب. راجع اتصالك وصلاحيات Firebase وحاول مجددًا.';
 }finally{
   if(secondaryApp){try{await secondaryApp.auth().signOut()}catch{}try{await secondaryApp.delete()}catch{}}
   $('newTeacherPassword').value='';button.disabled=false;
 }
}
const publicProfileFields=['name','title','photoUrl','bio','qualifications','experience','teachingStyle'];
function cleanPublicProfile(raw={}){
 const limits={name:80,title:100,photoUrl:500,bio:1200,qualifications:200,experience:200,teachingStyle:450},out={};
 publicProfileFields.forEach(key=>out[key]=String(raw[key]||'').trim().slice(0,limits[key]));
 out.photoUrl=out.photoUrl&&cleanUrl(out.photoUrl)!=='#'?out.photoUrl:'';
 return out;
}
function fillTeacherProfileEditor(){
 const uid=$('profileTeacherId').value,t=root.teacherProfiles?.[uid]||{},p=root.settings?.publicTeachers?.[uid]||{};
 const fields={Name:p.name||t.name||'',Title:p.title||'',Photo:p.photoUrl||'',Bio:p.bio||'',Qualifications:p.qualifications||'',Experience:p.experience||'',Style:p.teachingStyle||''};
 Object.entries(fields).forEach(([key,value])=>{$('profileTeacher'+key).value=value});
}
async function saveTeacherProfile(e){
 e.preventDefault();const uid=$('profileTeacherId').value,t=root.teacherProfiles?.[uid];
 if(!t||t.isActive===false)return toast('اختر مدرسًا نشطًا أولًا.','error');
 const raw={name:$('profileTeacherName').value,title:$('profileTeacherTitle').value,photoUrl:$('profileTeacherPhoto').value,bio:$('profileTeacherBio').value,qualifications:$('profileTeacherQualifications').value,experience:$('profileTeacherExperience').value,teachingStyle:$('profileTeacherStyle').value};
 const profile=cleanPublicProfile(raw);if(!profile.name||!profile.title)return toast('الاسم والتخصص مطلوبان.','error');
 if(raw.photoUrl.trim()&&!profile.photoUrl)return toast('رابط الصورة يجب أن يبدأ بـ https:// أو http://.','error');
 try{await db.ref('settings/publicTeachers/'+uid).set({...profile,active:true,updatedAt:Date.now()});toast('تم نشر ملف المدرس للطلاب')}catch(err){console.error(err);toast('تعذر حفظ ملف المدرس.','error')}
}
async function reviewTeacherProfile(key,approved){
 const [uid,id]=key.split('|'),s=root.teacherSubmissions?.[uid]?.[id],t=root.teacherProfiles?.[uid];
 if(!s||s.type!=='profile'||s.status!=='pending')return;
 if(approved&&(!t||t.isActive===false))return toast('المدرس غير نشط؛ لا يمكن نشر ملفه.','error');
 try{
   if(approved){const profile=cleanPublicProfile(s.profile);if(!profile.name||!profile.title)throw Error('بيانات الملف غير مكتملة');await db.ref('settings/publicTeachers/'+uid).set({...profile,active:true,updatedAt:Date.now()})}
   await db.ref('teacherSubmissions/'+uid+'/'+id).update({status:approved?'approved':'rejected',reviewedAt:Date.now()});
   toast(approved?'تم اعتماد الملف ونشره':'تم رفض طلب التعديل');
 }catch(err){console.error(err);toast('تعذر مراجعة الطلب.','error')}
}
function renderTeachers(){
 const teachers=values(root.teacherProfiles),students=values(root.studentProfilesV3),all=flattenSubmissions(),subs=all.filter(s=>s.type!=='profile'),profileRequests=all.filter(s=>s.type==='profile').sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)),pending=subs.filter(s=>(s.status||'pending')==='pending');
 const selected=$('profileTeacherId').value;
 $('profileTeacherId').innerHTML='<option value="">اختر المدرس</option>'+teachers.filter(t=>t.isActive!==false).map(t=>'<option value="'+esc(t.id)+'">'+esc(t.name||t.email||'مدرس')+'</option>').join('');
 $('profileTeacherId').value=teachers.some(t=>t.id===selected&&t.isActive!==false)?selected:'';
 if(!$('profileTeacherId').value&&teachers.some(t=>t.isActive!==false))$('profileTeacherId').value=teachers.find(t=>t.isActive!==false).id;
 if(document.activeElement?.closest('#adminTeacherProfileForm')===null||document.activeElement===$('profileTeacherId'))fillTeacherProfileEditor();
 $('teacherProfileRequestsList').innerHTML=profileRequests.length?profileRequests.map(s=>{const p=s.profile||{},photo=cleanUrl(p.photoUrl||'');return '<div class="admin-list-item"><div><strong>'+esc(p.name||root.teacherProfiles?.[s.uid]?.name||'مدرس')+'</strong><small>'+esc(p.title||'')+'</small><details class="teacher-profile-review"><summary>عرض المعلومات المقترحة</summary>'+(photo!=='#'?'<img src="'+esc(photo)+'" alt="الصورة المقترحة" loading="lazy">':'')+'<p><b>النبذة:</b> '+esc(p.bio||'—')+'</p><p><b>المؤهلات:</b> '+esc(p.qualifications||'—')+'</p><p><b>الخبرة:</b> '+esc(p.experience||'—')+'</p><p><b>أسلوب الشرح:</b> '+esc(p.teachingStyle||'—')+'</p></details></div><div class="admin-action-row">'+(s.status==='pending'?'<button class="admin-action-btn success" data-approve-profile="'+s.uid+'|'+s.id+'" title="اعتماد ونشر" aria-label="اعتماد ملف '+esc(p.name||'المدرس')+'">✓</button><button class="admin-action-btn danger" data-reject-profile="'+s.uid+'|'+s.id+'" title="رفض" aria-label="رفض ملف '+esc(p.name||'المدرس')+'">✕</button>':'<span class="status-pill '+(s.status==='approved'?'approved':'rejected')+'">'+(s.status==='approved'?'معتمد':'مرفوض')+'</span>')+'</div></div>'}).join(''):empty('لا توجد طلبات ملفات','يمكن للمدرس تقديم معلومات ملفه من بوابته.');
 $$('[data-approve-profile]').forEach(b=>b.onclick=()=>reviewTeacherProfile(b.dataset.approveProfile,true));
 $$('[data-reject-profile]').forEach(b=>b.onclick=()=>reviewTeacherProfile(b.dataset.rejectProfile,false));
 $('pendingCountText').textContent=pending.length+' قيد المراجعة';
 $('teachersAdminList').innerHTML=teachers.length?teachers.map(t=>'<div class="admin-list-item"><div><strong>'+esc(t.name||t.email||'مدرس')+'</strong><small>'+esc(t.email||'')+' • '+assignmentsOf(t).length+' صلاحية • '+(t.isActive===false?'موقوف':'نشط')+'</small></div><div class="admin-action-row"><button class="admin-action-btn" data-reset-teacher="'+t.id+'" title="إرسال رابط تغيير كلمة المرور" aria-label="إرسال رابط تغيير كلمة المرور إلى '+esc(t.name||t.email||'المدرس')+'"><i class="fa-solid fa-key"></i></button><button class="admin-action-btn '+(t.isActive===false?'success':'')+'" data-toggle-teacher="'+t.id+'" title="تفعيل أو إيقاف" aria-label="تفعيل أو إيقاف '+esc(t.name||'المدرس')+'"><i class="fa-solid '+(t.isActive===false?'fa-play':'fa-pause')+'"></i></button><button class="admin-action-btn danger" data-remove-teacher="'+t.id+'" title="إزالة الصلاحية" aria-label="إزالة صلاحية '+esc(t.name||'المدرس')+'"><i class="fa-solid fa-user-minus"></i></button></div></div>').join(''):empty('لا يوجد مدرسون','أنشئ حسابًا جديدًا من النموذج أعلاه أو رقّ حسابًا موجودًا.');
 const teacherIds=new Set(teachers.map(t=>t.id)),candidates=students.filter(s=>!teacherIds.has(s.id)&&s.email&&!s.phone);
 $('teacherCandidates').innerHTML=candidates.length?candidates.map(s=>'<div class="admin-list-item"><div><strong>'+esc(s.name||s.email||'طالب')+'</strong><small>'+esc(s.email||'')+'</small></div><button class="admin-action-btn success" data-promote="'+s.id+'"><i class="fa-solid fa-plus"></i></button></div>').join(''):empty('لا توجد حسابات للترقية','كل الحسابات الحالية لها حالة مدرس أو لا توجد حسابات.');
 $('assignTeacher').innerHTML=teachers.map(t=>'<option value="'+esc(t.id)+'">'+esc(t.name||t.email||t.id)+'</option>').join('');
 refreshAssignmentSubjects();
 $('teacherSubmissionsList').innerHTML=subs.length?subs.map(s=>'<div class="admin-list-item"><div><strong>'+esc(s.title||'محتوى')+'</strong><small>'+esc(s.teacherName||root.teacherProfiles?.[s.uid]?.name||'مدرس')+' • '+esc(typeLabel(s.type))+' • '+esc(gradeLabel(s.stage,s.grade))+' • '+esc(s.subjectName||s.subject||'')+'</small>'+(s.videoUrl?'<a href="'+cleanUrl(s.videoUrl)+'" target="_blank" rel="noopener" style="font-size:9px;color:#2563eb">فتح الفيديو</a>':'')+'</div><div class="admin-action-row">'+((s.status||'pending')==='pending'?'<button class="admin-action-btn success" data-approve="'+s.uid+'|'+s.id+'" title="اعتماد"><i class="fa-solid fa-check"></i></button><button class="admin-action-btn danger" data-reject="'+s.uid+'|'+s.id+'" title="رفض"><i class="fa-solid fa-xmark"></i></button>':'<span class="status-pill '+(s.status==='approved'?'approved':'rejected')+'">'+(s.status==='approved'?'معتمد':'مرفوض')+'</span>')+'</div></div>').join(''):empty('لا توجد طلبات محتوى','عندما يرسل مدرس درسًا سيظهر هنا.');
 $$('[data-toggle-teacher]').forEach(b=>b.onclick=async()=>{const uid=b.dataset.toggleTeacher,activate=root.teacherProfiles?.[uid]?.isActive===false;try{await db.ref('teacherProfiles/'+uid+'/isActive').set(activate);if(root.settings?.publicTeachers?.[uid])await db.ref('settings/publicTeachers/'+uid+'/active').set(activate)}catch(err){console.error(err);toast('تعذر تغيير حالة المدرس.','error')}});
 $$('[data-reset-teacher]').forEach(b=>b.onclick=async()=>{const email=root.teacherProfiles?.[b.dataset.resetTeacher]?.email;if(!email)return toast('لا يوجد بريد لهذا المدرس.','error');try{await auth.sendPasswordResetEmail(email);toast('تم إرسال رابط تغيير كلمة المرور إلى بريد المدرس.')}catch(err){console.error(err);toast('تعذر إرسال رابط تغيير كلمة المرور.','error')}});
 $$('[data-remove-teacher]').forEach(b=>b.onclick=async()=>{if(await askConfirm({title:'إزالة صلاحية المدرس؟',message:'سيفقد هذا الحساب الوصول إلى بوابة المدرس وصلاحيات المواد المسندة إليه.',tone:'warning',acceptText:'إزالة الصلاحية'})){const uid=b.dataset.removeTeacher;try{await db.ref('settings/publicTeachers/'+uid).remove();await db.ref('teacherProfiles/'+uid).remove()}catch(err){console.error(err);toast('تعذرت إزالة صلاحية المدرس.','error')}}});
 $$('[data-promote]').forEach(b=>b.onclick=async()=>{const s=root.studentProfilesV3?.[b.dataset.promote]||{};await db.ref('teacherProfiles/'+b.dataset.promote).set({name:s.name||'',email:s.email||'',isActive:true,createdAt:Date.now(),assignments:[]});toast('تم تحويل الحساب إلى مدرس')});
 $$('[data-approve]').forEach(b=>b.onclick=()=>approveSubmission(b.dataset.approve));
 $$('[data-reject]').forEach(b=>b.onclick=async()=>{const [uid,id]=b.dataset.reject.split('|');await db.ref('teacherSubmissions/'+uid+'/'+id).update({status:'rejected',reviewedAt:Date.now()});toast('تم رفض المحتوى')});
}
function refreshAssignmentSubjects(){
 fillGrades($('assignGrade'),$('assignStage').value);fillSubjects($('assignSubject'),$('assignStage').value,$('assignGrade').value,$('assignType').value);
}
async function addAssignment(){
 const uid=$('assignTeacher').value,btn=$('addAssignmentBtn');if(!uid)return toast('لا يوجد مدرس محدد.','error');
 const payload={type:$('assignType').value,stage:$('assignStage').value,grade:$('assignGrade').value,subject:$('assignSubject').value,subjectName:$('assignSubject').selectedOptions[0]?.textContent||'',createdAt:Date.now()};
 if(!payload.subject)return toast('اختر مادة صحيحة أولًا.','error');
 const teacherProfile=root.teacherProfiles?.[uid]||{};
 const existing=Array.isArray(teacherProfile.assignments)?teacherProfile.assignments:Object.values(teacherProfile.assignments||{});
 if(existing.some(a=>a?.type===payload.type&&a?.stage===payload.stage&&String(a?.grade)===String(payload.grade)&&a?.subject===payload.subject)){
   return toast('هذه المادة مسندة لهذا المدرس بالفعل.','error');
 }
 window.AcademyUI?.setButtonLoading(btn,true,'إسناد');
 try{
   await db.ref('teacherProfiles/'+uid+'/assignments').push(payload);toast('تم إسناد المادة للمدرس');
 }catch(err){console.error(err);toast('تعذر إسناد المادة الآن.','error')}
 finally{window.AcademyUI?.setButtonLoading(btn,false)}
}
async function approveSubmission(key){
 const [uid,id]=key.split('|'),s=root.teacherSubmissions?.[uid]?.[id];if(!s)return;
 if(s.type==='profile')return;
 if((s.status||'pending')!=='pending')return toast('تمت مراجعة هذا الطلب بالفعل.','error');
 try{
   const ref=db.ref('lessons').push();
   await ref.set({title:s.title||'درس',content:'',type:s.type||'public',stage:s.stage||'prep',grade:String(s.grade||1),subject:s.subject||'',unit:Number(s.unit||1),videos:s.videoUrl?[{name:s.teacherName||root.teacherProfiles?.[uid]?.name||'المدرس',url:s.videoUrl,teacherId:uid}]:[],questions:[],isLocked:false,isHidden:false,teacherId:uid,teacherSubmissionId:id,createdAt:Date.now()});
   await db.ref('teacherSubmissions/'+uid+'/'+id).update({status:'approved',lessonId:ref.key,reviewedAt:Date.now()});toast('تم اعتماد المحتوى ونشره');
 }catch(err){console.error(err);toast('تعذر اعتماد المحتوى الآن.','error')}
}

/* Students */
function renderStudents(){
 const q=($('studentSearch')?.value||'').trim().toLowerCase();
 const arr=values(root.studentProfilesV3).filter(s=>!q||(s.name||'').toLowerCase().includes(q)||(s.phone||'').includes(q)||(s.email||'').toLowerCase().includes(q)).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
 $('studentsAdminList').innerHTML=arr.length?'<table class="admin-table"><thead><tr><th>الطالب</th><th>المرحلة</th><th>XP</th><th>الدروس</th><th>الاختبارات</th><th>آخر نشاط</th></tr></thead><tbody>'+arr.map(s=>'<tr><td><strong>'+esc(s.name||'طالب')+'</strong><br><small>'+esc(s.phone||s.email||'')+'</small></td><td>'+esc(typeLabel(s.educationType))+' • '+esc(gradeLabel(s.stage,s.grade))+'</td><td>'+Number(s.stats?.totalXP||0)+'</td><td>'+Number(s.stats?.completedLessons||0)+'</td><td>'+Number(s.stats?.completedQuizzes||0)+'</td><td>'+((s.lastActiveAt||s.activity?.lastSeenAt)?new Date(s.lastActiveAt||s.activity.lastSeenAt).toLocaleDateString('ar-EG'):'-')+'</td></tr>').join('')+'</tbody></table>':empty('لا يوجد طلاب مطابقون','ستظهر حسابات الطلاب الجديدة هنا.');
}

/* News */
function newsItems(){return values(root.posts).sort((a,b)=>(b.date||b.createdAt||0)-(a.date||a.createdAt||0))}
function resetNewsEditor(){
 editState.news=null;$('newsForm')?.reset();
 if($('newsEditorTitle'))$('newsEditorTitle').textContent='خبر جديد';
 if($('newsSaveBtn'))$('newsSaveBtn').textContent='نشر الخبر';
 $('newsCancelEdit')?.classList.add('hidden');
}
function renderNews(){
 const list=newsItems(),el=$('newsAdminList');if(!el)return;
 el.innerHTML=list.length?list.map(n=>'<div class="admin-list-item"><div><strong>'+esc(n.title||'خبر')+'</strong><small>'+(n.date?new Date(n.date).toLocaleDateString('ar-EG'):'')+'</small><p style="font-size:9px;color:#64748b;margin:5px 0 0">'+esc((n.content||'').slice(0,150))+'</p></div><div class="admin-action-row"><button class="admin-action-btn" data-edit-news="'+n.id+'" title="تعديل"><i class="fa-solid fa-pen"></i></button><button class="admin-action-btn danger" data-delete-news="'+n.id+'" title="حذف"><i class="fa-solid fa-trash"></i></button></div></div>').join(''):empty('لا توجد أخبار','اكتب أول تحديث للمنصة.');
 $$('[data-edit-news]').forEach(b=>b.onclick=()=>editNews(b.dataset.editNews));
 $$('[data-delete-news]').forEach(b=>b.onclick=async()=>{if(await askConfirm({title:'حذف الخبر؟',message:'سيتم حذف الخبر أو التحديث من المنصة.',tone:'danger',acceptText:'حذف الخبر'}))await db.ref('posts/'+b.dataset.deleteNews).remove()});
}
function editNews(id){
 const n=root.posts?.[id];if(!n)return;editState.news=id;
 $('newsTitle').value=n.title||'';$('newsContent').value=n.content||'';$('newsImage').value=n.image||'';
 $('newsEditorTitle').textContent='تعديل الخبر';$('newsSaveBtn').textContent='حفظ التعديل';$('newsCancelEdit').classList.remove('hidden');
 $('newsTitle').focus();
}
async function saveNews(e){
 e.preventDefault();
 const payload={title:$('newsTitle').value.trim(),content:$('newsContent').value.trim(),image:$('newsImage').value.trim()};
 if(editState.news){payload.updatedAt=Date.now();await db.ref('posts/'+editState.news).update(payload);toast('تم تحديث الخبر')}
 else{payload.date=Date.now();await db.ref('posts').push(payload);toast('تم نشر الخبر')}
 resetNewsEditor();
}

/* Announcement + settings */
function loadAnnouncement(){
 const a=root.announcements||{};$('announcementText').value=a.text||'';$('announcementActive').checked=!!a.isActive;
 if(a.expiry)$('announcementDays').value=Math.max(1,Math.ceil((a.expiry-Date.now())/86400000));
}
async function saveAnnouncement(e){e.preventDefault();const days=Math.max(1,Number($('announcementDays').value||3));await db.ref('announcements').set({text:$('announcementText').value.trim(),isActive:$('announcementActive').checked,expiry:Date.now()+days*86400000,updatedAt:Date.now()});toast('تم حفظ الإعلان')}
function safeAdminImageUrl(value=''){
 try{
   if(!value)return'';
   const u=new URL(value,location.href);
   return ['http:','https:'].includes(u.protocol)?u.href:'';
 }catch{return''}
}
function renderDashboardHeroSettingPreview(){
 const preview=$('settingDashboardHeroPreview');if(!preview)return;
 const value=$('settingDashboardHero')?.value.trim()||'';
 const safe=safeAdminImageUrl(value);
 const image=(safe||'./assets/dashboard-hero.jpg').replace(/"/g,'%22');
 preview.style.backgroundImage='linear-gradient(90deg,rgba(7,35,111,.88),rgba(11,64,171,.34),rgba(6,28,85,.04)),url("'+image+'")';
 preview.classList.toggle('custom',!!safe);
 preview.querySelector('span').textContent=safe?'معاينة الغلاف المخصص':'الغلاف الافتراضي';
}
function loadSettings(){
 const s=root.settings||{};
 $('settingSiteName').value=s.siteName||'الأكاديمية';
 $('settingWhatsapp').value=s.whatsapp||'';
 $('settingLogo').value=s.siteLogo||'';
 $('settingDashboardHero').value=s.dashboardHeroUrl||'';
 $('settingDashboardHeroSubtitle').value=s.dashboardHeroSubtitle||'كل يوم هو فرصة جديدة للتعلم وتقترب من أهدافك';
 $('settingAbout').value=s.aboutText||'';
 renderDashboardHeroSettingPreview();
}
async function saveSettings(e){
 e.preventDefault();
 const heroValue=$('settingDashboardHero').value.trim();
 if(heroValue&&!safeAdminImageUrl(heroValue))return toast('رابط صورة الغلاف غير صحيح.','error');
 await db.ref('settings').update({
   siteName:$('settingSiteName').value.trim(),
   whatsapp:$('settingWhatsapp').value.trim(),
   siteLogo:$('settingLogo').value.trim(),
   dashboardHeroUrl:heroValue,
   dashboardHeroSubtitle:$('settingDashboardHeroSubtitle').value.trim()||'كل يوم هو فرصة جديدة للتعلم وتقترب من أهدافك',
   aboutText:$('settingAbout').value.trim(),
   updatedAt:Date.now()
 });
 toast('تم حفظ الإعدادات وتحديث غلاف لوحة الطالب');
}

/* Pending + auth */
function updatePendingBadge(){
 const n=flattenSubmissions().filter(s=>(s.status||'pending')==='pending').length;$('pendingBadge').textContent=n;$('pendingBadge').classList.toggle('hidden',!n);
}
async function verifyAdmin(user){
 const snap=await db.ref('adminProfiles/'+user.uid).once('value');return snap.val()?.isAdmin===true;
}
async function startDataListener(){
 if(unsubscribe)unsubscribe();
 stopAdminListeners();
 const ok=await ensureAdminPaths(ADMIN_CORE_PATHS);
 renderAdminIdentity();updatePendingBadge();updateCommunityBadge();
 const requested=new URLSearchParams(location.search).get('tab')||'overview';
 await setTab(requested,false);
 window.AcademyUI?.hidePageLoading();
 if(!ok)toast('تم تحميل لوحة الإدارة مع تعذر قراءة بعض البيانات الأساسية.','error');
 unsubscribe=()=>stopAdminListeners();
}

function initAdminCollapse(){
 const shell=$('adminApp'),btn=$('adminCollapseBtn');if(!shell||!btn)return;
 const apply=()=>{const collapsed=innerWidth>900&&localStorage.getItem('academyAdminCollapsed')==='1';shell.classList.toggle('admin-collapsed',collapsed)};
 apply();
 btn.onclick=()=>{if(innerWidth<=900)return;const next=!shell.classList.contains('admin-collapsed');shell.classList.toggle('admin-collapsed',next);localStorage.setItem('academyAdminCollapsed',next?'1':'0')};
 $$('.admin-nav button,.admin-sidebar-footer a,.admin-sidebar-footer button').forEach(el=>{if(!el.title)el.title=el.textContent.trim().replace(/\s+/g,' ')});
 window.addEventListener('resize',apply,{passive:true});
}

function bindAdminForm(id,handler,label='حفظ'){
 const form=$(id);if(!form)return;
 form.onsubmit=async e=>{
   e.preventDefault();
   const btn=e.submitter||form.querySelector('button[type="submit"]');
   window.AcademyUI?.setButtonLoading(btn,true,label);
   try{
     await handler(e);
   }catch(err){
     console.error('Admin form failed:',id,err);
     toast('تعذر حفظ البيانات الآن. حاول مرة أخرى.','error');
   }finally{
     window.AcademyUI?.setButtonLoading(btn,false);
     if(id==='newsForm'&&btn)btn.textContent=editState.news?'حفظ التعديل':'نشر الخبر';
   }
 };
}

/* events */
$$('[data-admin-tab]').forEach(b=>b.onclick=()=>setTab(b.dataset.adminTab));
$$('[data-jump-tab]').forEach(b=>b.onclick=()=>setTab(b.dataset.jumpTab));
$$('[data-admin-quick]').forEach(b=>b.onclick=async()=>{
 const action=b.dataset.adminQuick;
 if(action==='lesson'){await setTab('lessons');resetLessonEditor();openModal('lessonModal')}
 else if(action==='quiz'){await setTab('quizzes');resetQuizEditor();openModal('quizModal')}
 else if(action==='teachers'){await setTab('teachers')}
});
$$('[data-close-admin-modal]').forEach(b=>b.onclick=()=>closeModal(b.dataset.closeAdminModal));
$$('.modal-backdrop[id]').forEach(modal=>modal.addEventListener('click',e=>{if(e.target===modal)closeModal(modal.id)}));
document.addEventListener('keydown',e=>{
 if(e.key!=='Escape')return;
 const open=$$('.modal-backdrop[id]:not(.hidden)')[0];
 if(open)closeModal(open.id);
});
$('openSubjectModal').onclick=()=>{resetSubjectEditor();openModal('subjectModal')};$('openLessonModal').onclick=()=>{resetLessonEditor();openModal('lessonModal')};$('openQuizModal').onclick=()=>{resetQuizEditor();openModal('quizModal')};$('openFileModal').onclick=()=>{resetFileEditor();openModal('fileModal')};$('openSimulationModal').onclick=()=>{resetSimulationEditor();openModal('simulationModal')};$('openLiveModal').onclick=()=>{resetLiveEditor();openModal('liveModal')};
$('addLessonVideoRow').onclick=addLessonVideoRow;
renderLessonVideosEditor([{name:'',url:''}]);
bindAdminForm('newsForm',saveNews,'نشر');
$('newsCancelEdit').onclick=resetNewsEditor;
bindAdminForm('subjectForm',saveSubject,'حفظ المادة');
$('subjectImageUrl')?.addEventListener('input',renderSubjectImagePreview);
bindAdminForm('lessonForm',saveLesson,'حفظ الدرس');
bindAdminForm('quizForm',saveQuiz,'حفظ الاختبار');
bindAdminForm('fileForm',saveFile,'حفظ الملف');
bindAdminForm('simulationForm',saveSimulation,'حفظ المحاكي');
bindAdminForm('liveForm',saveLiveSession,'حفظ الجلسة');
bindAdminForm('scheduleEventForm',saveScheduleEvent,'حفظ الموعد');
bindAdminForm('studyGroupForm',saveStudyGroup,'إنشاء المجموعة');
bindAdminForm('announcementForm',saveAnnouncement,'حفظ الإعلان');
bindAdminForm('settingsForm',saveSettings,'حفظ الإعدادات');
$('profileTeacherId')?.addEventListener('change',fillTeacherProfileEditor);
$('adminTeacherProfileForm')?.addEventListener('submit',saveTeacherProfile);
$('settingDashboardHero')?.addEventListener('input',renderDashboardHeroSettingPreview);
$('resetDashboardHero')?.addEventListener('click',()=>{
  $('settingDashboardHero').value='';
  renderDashboardHeroSettingPreview();
  toast('تم اختيار الغلاف الافتراضي. اضغط حفظ الإعدادات لتطبيقه.');
});
$('lessonSearch').oninput=renderLessons;$('lessonFilterStage').onchange=renderLessons;$('lessonFilterType').onchange=renderLessons;$('studentSearch').oninput=renderStudents;
$('curriculumType').onchange=renderCurriculum;$('curriculumStage').onchange=()=>{fillGrades($('curriculumGrade'),$('curriculumStage').value);renderCurriculum()};$('curriculumGrade').onchange=renderCurriculum;
$('assignType').onchange=refreshAssignmentSubjects;$('assignStage').onchange=refreshAssignmentSubjects;$('assignGrade').onchange=refreshAssignmentSubjects;$('addAssignmentBtn').onclick=addAssignment;
initAdminCollapse();
$('adminMenuBtn').onclick=()=>{$('adminSidebar').classList.add('open');$('adminOverlay').classList.remove('hidden')};$('adminOverlay').onclick=()=>{$('adminSidebar').classList.remove('open');$('adminOverlay').classList.add('hidden')};
$('adminRefreshBtn').onclick=async()=>{
 const btn=$('adminRefreshBtn'),paths=[...new Set([...ADMIN_CORE_PATHS,...pathsForTab(currentAdminTab)])];
 window.AcademyUI?.setButtonLoading(btn,true,'تحديث');
 try{
   const snaps=await Promise.all(paths.map(path=>db.ref(path).once('value')));
   paths.forEach((path,i)=>root[path]=snaps[i].val()||{});
   renderAdminIdentity();updatePendingBadge();updateCommunityBadge();renderTab(currentAdminTab);toast('تم تحديث القسم الحالي');
 }catch(err){
   console.error(err);toast('تعذر تحديث البيانات الآن.','error');
 }finally{
   window.AcademyUI?.setButtonLoading(btn,false);
 }
};
$('adminLogout').onclick=async()=>{
 const ok=await askConfirm({title:'تسجيل الخروج؟',message:'سيتم إغلاق جلسة الإدارة الحالية.',tone:'warning',acceptText:'تسجيل الخروج'});
 if(!ok)return;
 try{await auth.signOut()}catch(err){console.error(err);toast('تعذر تسجيل الخروج الآن.','error')}
};
function globalSearchItems(q){
 const needle=q.trim().toLowerCase();if(!needle)return[];
 const out=[];
 values(root.lessons).forEach(x=>{
   const hay=((x.title||'')+' '+(x.subject||'')+' '+(x.teacherName||'')).toLowerCase();
   if(hay.includes(needle))out.push({type:'lesson',id:x.id,title:x.title||'درس',meta:'درس • '+(x.subject||'')});
 });
 values(root.studentProfilesV3).forEach(x=>{
   const hay=((x.name||'')+' '+(x.phone||'')+' '+(x.email||'')).toLowerCase();
   if(hay.includes(needle))out.push({type:'student',id:x.id,title:x.name||x.phone||x.email||'طالب',meta:'طالب • '+(x.phone||x.email||'')});
 });
 values(root.teacherProfiles).forEach(x=>{
   const hay=((x.name||'')+' '+(x.email||'')).toLowerCase();
   if(hay.includes(needle))out.push({type:'teacher',id:x.id,title:x.name||x.email||'مدرس',meta:'مدرس • '+(x.email||'')});
 });
 values(root.quizzes).forEach(x=>{
   const hay=((x.name||'')+' '+(x.subject||'')).toLowerCase();
   if(hay.includes(needle))out.push({type:'quiz',id:x.id,title:x.name||'اختبار',meta:'اختبار • '+(x.subject||'')});
 });
 return out.slice(0,8);
}
function hideGlobalSearch(){
 $('adminGlobalSearchResults')?.classList.add('hidden');
}
function renderGlobalSearch(q){
 const box=$('adminGlobalSearchResults');if(!box)return;
 const items=globalSearchItems(q);
 if(!q.trim()){box.innerHTML='';box.classList.add('hidden');return}
 box.innerHTML=items.length?items.map((x,i)=>
   '<button type="button" class="admin-search-result" data-admin-search-type="'+x.type+'" data-admin-search-id="'+esc(x.id)+'" role="option">'+
   '<span class="admin-search-result-icon"><i class="fa-solid '+(x.type==='lesson'?'fa-circle-play':x.type==='student'?'fa-user-graduate':x.type==='teacher'?'fa-chalkboard-user':'fa-file-circle-question')+'"></i></span>'+
   '<span><strong>'+esc(x.title)+'</strong><small>'+esc(x.meta)+'</small></span></button>'
 ).join(''):'<div class="admin-search-empty">لا توجد نتائج مطابقة.</div>';
 box.classList.remove('hidden');
 $$('[data-admin-search-type]',box).forEach(btn=>btn.onclick=async()=>{
   const type=btn.dataset.adminSearchType,id=btn.dataset.adminSearchId;
   if(type==='lesson'){
     await setTab('lessons');const item=root.lessons?.[id];$('lessonSearch').value=item?.title||'';renderLessons();
   }else if(type==='student'){
     await setTab('students');const item=root.studentProfilesV3?.[id];$('studentSearch').value=item?.name||item?.phone||item?.email||'';renderStudents();
   }else if(type==='teacher'){
     await setTab('teachers');
   }else if(type==='quiz'){
     await setTab('quizzes');
   }
   $('adminGlobalSearch').value='';hideGlobalSearch();
 });
}
$('adminGlobalSearch').oninput=e=>renderGlobalSearch(e.target.value);
$('adminGlobalSearch').onkeydown=e=>{if(e.key==='Escape'){e.target.value='';hideGlobalSearch()}};
document.addEventListener('click',e=>{if(!e.target.closest('.admin-global-search-wrap'))hideGlobalSearch()});
if($('adminLoginForm')?.dataset.adminAuthBound!=='true'){
 $('adminLoginForm').onsubmit=async e=>{
  e.preventDefault();const btn=$('adminLoginBtn');btn.disabled=true;btn.textContent='جاري التحقق...';
  try{
   await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
   await auth.signInWithEmailAndPassword($('adminEmail').value.trim(),$('adminPassword').value);
  }catch(err){toast('البريد أو كلمة المرور غير صحيحة.','error')}
  finally{btn.disabled=false;btn.textContent='دخول لوحة الإدارة'}
 };
}
$('adminResetPassword').onclick=async()=>{const email=$('adminEmail').value.trim();if(!email)return toast('اكتب البريد أولًا.','error');try{await auth.sendPasswordResetEmail(email);toast('تم إرسال رابط إعادة تعيين كلمة المرور.')}catch{toast('تعذر إرسال الرابط.','error')}};
$('createTeacherForm').addEventListener('submit',createTeacherAccount);

bindHierarchy('subjectType','subjectStage','subjectGrade',null);
bindHierarchy('newLessonType','newLessonStage','newLessonGrade','newLessonSubject');
bindHierarchy('newQuizType','newQuizStage','newQuizGrade','newQuizSubject');
bindHierarchy('newFileType','newFileStage','newFileGrade','newFileSubject');
bindHierarchy('scheduleType','scheduleStage','scheduleGrade','scheduleSubject');
bindHierarchy('simType','simStage','simGrade',null);
fillGrades($('curriculumGrade'),$('curriculumStage').value);
refreshAssignmentSubjects();

auth.onAuthStateChanged(async user=>{
 currentUser=user;
 if(unsubscribe){unsubscribe();unsubscribe=null}
 stopAdminListeners();root={};
 if(!user){window.AcademyUI?.hidePageLoading();$('adminApp').classList.add('hidden');$('adminLogin').classList.remove('hidden');return}
 window.AcademyUI?.showPageLoading('جاري التحقق من صلاحيات الإدارة وتحميل البيانات...');
 try{
   const ok=await verifyAdmin(user);
   if(auth.currentUser?.uid!==user.uid)return;
   if(!ok){window.AcademyUI?.hidePageLoading();$('adminApp').classList.add('hidden');$('adminLogin').classList.remove('hidden');toast('هذا الحساب ليس له صلاحية مدير.','error');return}
   $('adminLogin').classList.add('hidden');$('adminApp').classList.remove('hidden');await startDataListener();
 }catch(err){console.error(err);window.AcademyUI?.hidePageLoading();$('adminApp').classList.add('hidden');$('adminLogin').classList.remove('hidden');toast('تعذر التحقق من صلاحية الإدارة.','error')}
});
})();
