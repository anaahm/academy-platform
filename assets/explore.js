(() => {
'use strict';

const firebaseConfig=window.ACADEMY_FIREBASE_CONFIG||JSON.parse(localStorage.getItem('academyFirebaseConfig')||'null');
if(!firebaseConfig){location.replace('./index.html');return}
if(!firebase.apps.length)firebase.initializeApp(firebaseConfig);
const db=firebase.database();
const $=id=>document.getElementById(id),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=(v='')=>String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

const params=new URLSearchParams(location.search);
const initialType=['public','azhar'].includes(params.get('type'))?params.get('type'):'public';
const initialStage=['primary','prep','sec'].includes(params.get('stage'))?params.get('stage'):'primary';
const state={type:initialType,stage:initialStage,grade:null,data:{customSubjects:{}},search:'',stageCache:{}};
const grades={primary:[1,2,3,4,5,6],prep:[1,2,3],sec:[1,2,3]};
const gradeNames={
 primary:{1:'الأول الابتدائي',2:'الثاني الابتدائي',3:'الثالث الابتدائي',4:'الرابع الابتدائي',5:'الخامس الابتدائي',6:'السادس الابتدائي'},
 prep:{1:'الأول الإعدادي',2:'الثاني الإعدادي',3:'الثالث الإعدادي'},
 sec:{1:'الأول الثانوي',2:'الثاني الثانوي',3:'الثالث الثانوي'}
};
const defaults={
 primary:[{id:'arabic',name:'اللغة العربية',emoji:'📖'},{id:'math',name:'الرياضيات',emoji:'🧮'},{id:'science',name:'العلوم',emoji:'🔬'},{id:'english',name:'اللغة الإنجليزية',emoji:'🇬🇧'},{id:'social',name:'الدراسات الاجتماعية',emoji:'🌍'},{id:'religion',name:'التربية الدينية',emoji:'🕌'}],
 prep:[{id:'arabic',name:'اللغة العربية',emoji:'📖'},{id:'math',name:'الرياضيات',emoji:'🧮'},{id:'science',name:'العلوم',emoji:'🔬'},{id:'english',name:'اللغة الإنجليزية',emoji:'🇬🇧'},{id:'social',name:'الدراسات الاجتماعية',emoji:'🌍'},{id:'computer',name:'الحاسب الآلي',emoji:'💻'}],
 sec:[{id:'arabic',name:'اللغة العربية',emoji:'📖'},{id:'english',name:'اللغة الإنجليزية',emoji:'🇬🇧'},{id:'math',name:'الرياضيات',emoji:'🧮'},{id:'physics',name:'الفيزياء',emoji:'⚛️'},{id:'chemistry',name:'الكيمياء',emoji:'🧪'},{id:'biology',name:'الأحياء',emoji:'🧬'},{id:'history',name:'التاريخ',emoji:'🏛️'},{id:'geography',name:'الجغرافيا',emoji:'🌍'}]
};

function customList(stage,grade){
 const custom=state.data.customSubjects?.[stage]?.[grade];
 return Array.isArray(custom)?custom:Object.values(custom||{});
}
function getSubjects(stage,grade,type){
 const list=[...(defaults[stage]||[])];
 customList(stage,grade).forEach(s=>{
   if(!s?.id||!s?.name||(s.type&&s.type!==type))return;
   const item={id:s.id,name:s.name,emoji:s.emoji||'⭐',imageUrl:s.imageUrl||''},i=list.findIndex(x=>x.id===s.id);
   if(i>=0)list[i]={...list[i],...item};else list.push(item);
 });
 return list;
}
async function ensureStage(stage){
 if(state.stageCache[stage])return state.stageCache[stage];
 const promise=(async()=>{
   const [lessonsSnap,quizzesSnap]=await Promise.all([
     db.ref('lessons').orderByChild('stage').equalTo(stage).once('value'),
     db.ref('quizzes').orderByChild('stage').equalTo(stage).once('value')
   ]);
   return {lessons:lessonsSnap.val()||{},quizzes:quizzesSnap.val()||{}};
 })();
 state.stageCache[stage]=promise;
 try{return await promise}
 catch(err){delete state.stageCache[stage];throw err}
}
function stageData(){
 const cached=state.stageCache[state.stage];
 return cached&&typeof cached.then!=='function'?cached:{lessons:{},quizzes:{}};
}
function contentVisible(item){
 if(!item||item.isHidden||item.workflowStatus==='draft')return false;
 const at=Number(item.publishAt||0);
 return !at||at<=Date.now();
}
function countContent(subjectId){
 const data=stageData();
 const lessonRows=Object.values(data.lessons||{}).filter(l=>contentVisible(l)&&l.type===state.type&&String(l.grade)===String(state.grade)&&l.subject===subjectId);
 const quizRows=Object.values(data.quizzes||{}).filter(q=>contentVisible(q)&&q.type===state.type&&String(q.grade)===String(state.grade)&&q.subject===subjectId);
 const teachers=new Set(),units=new Set();
 lessonRows.forEach(l=>{
   units.add(Number(l.unit||1));
   if(l.teacherId)teachers.add(String(l.teacherId));
   (Array.isArray(l.videos)?l.videos:[]).forEach(v=>{if(v?.teacherId)teachers.add(String(v.teacherId))});
 });
 return {lessons:lessonRows.length,quizzes:quizRows.length,teachers:teachers.size,units:units.size};
}
function safeImageUrl(value=''){
 try{if(!value)return'';const u=new URL(value,location.href);return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return''}
}
function subjectUrl(id){
 const q=new URLSearchParams({type:state.type,stage:state.stage,grade:String(state.grade),subject:id});
 return './subject.html?'+q.toString();
}
function syncUrl(){
 const url=new URL(location.href);
 url.searchParams.set('type',state.type);url.searchParams.set('stage',state.stage);
 if(state.grade)url.searchParams.set('grade',String(state.grade));else url.searchParams.delete('grade');
 history.replaceState({},'',url);
}
function updateExplorePath(){
 if($('explorePathType'))$('explorePathType').textContent=state.type==='azhar'?'التعليم الأزهري':'التعليم العام';
 if($('explorePathStage'))$('explorePathStage').textContent=state.stage==='primary'?'المرحلة الابتدائية':state.stage==='prep'?'المرحلة الإعدادية':'المرحلة الثانوية';
 if($('explorePathGrade')){
   $('explorePathGrade').textContent=state.grade?gradeNames[state.stage][state.grade]:'اختر الصف';
   $('explorePathGrade').closest('span')?.classList.toggle('muted',!state.grade);
 }
}
function renderGrades(){
 const stageIcon=state.stage==='primary'?'🎒':state.stage==='prep'?'📚':'🎓';
 $('exploreGradeGrid').innerHTML=grades[state.stage].map(g=>{
   const active=state.grade===g;
   return '<button class="explore-grade-card '+(active?'active':'')+'" data-grade="'+g+'" aria-pressed="'+(active?'true':'false')+'">'+
     '<span class="explore-grade-number">'+g+'</span>'+
     '<div><small>'+stageIcon+' الصف</small><strong>'+esc(gradeNames[state.stage][g])+'</strong><p>اضغط لعرض المواد والدروس المتاحة</p></div>'+
     '<span class="explore-grade-arrow"><i class="fa-solid fa-arrow-left"></i></span>'+
   '</button>';
 }).join('');
 $$('[data-grade]').forEach(b=>b.onclick=async()=>{
   state.grade=Number(b.dataset.grade);syncUrl();
   $$('[data-grade]').forEach(x=>{const active=x===b;x.classList.toggle('active',active);x.setAttribute('aria-pressed',active?'true':'false')});
   updateExplorePath();
   await loadAndRenderSubjects();
 });
 if(!state.grade){$('exploreSubjectBlock').classList.add('hidden');$('gradeHint').textContent='اختر الصف لعرض مواده'}
 updateExplorePath();
}
function renderSubjects(){
 const term=state.search.trim().toLowerCase();
 const subjects=getSubjects(state.stage,String(state.grade),state.type).filter(s=>!term||s.name.toLowerCase().includes(term));
 $('exploreSubjectBlock').classList.remove('hidden');
 $('gradeHint').textContent=gradeNames[state.stage][state.grade];
 $('exploreSubjectsTitle').textContent='مواد '+gradeNames[state.stage][state.grade];
 $('exploreSubjectCount').textContent=subjects.length+' مادة';
 $('exploreSubjectGrid').innerHTML=subjects.map((s,index)=>{
   const counts=countContent(s.id),image=safeImageUrl(s.imageUrl||''),palette=['blue','violet','green','orange','rose','teal'][index%6];
   return '<a class="explore-subject-card explore-subject-card-v2 '+palette+' '+(image?'has-image':'')+'" href="'+subjectUrl(s.id)+'">'+
     '<div class="explore-subject-cover">'+
       (image?'<img data-subject-image data-fallback="'+esc(s.emoji||'📚')+'" src="'+esc(image)+'" alt="" loading="lazy">':'<span>'+esc(s.emoji||'📚')+'</span>')+
       '<em>'+esc(gradeNames[state.stage][state.grade])+'</em>'+
     '</div>'+
     '<div class="explore-subject-body"><div class="explore-subject-title-row"><div><small>'+esc(state.type==='azhar'?'التعليم الأزهري':'التعليم العام')+'</small><h3>'+esc(s.name)+'</h3></div><span class="explore-open"><i class="fa-solid fa-arrow-left"></i></span></div>'+
       '<div class="explore-subject-metrics"><span><i class="fa-solid fa-circle-play"></i><b>'+counts.lessons+'</b><small>درس</small></span><span><i class="fa-solid fa-brain"></i><b>'+counts.quizzes+'</b><small>اختبار</small></span><span><i class="fa-solid fa-layer-group"></i><b>'+(counts.units||'—')+'</b><small>وحدة</small></span><span><i class="fa-solid fa-chalkboard-user"></i><b>'+(counts.teachers||'—')+'</b><small>مدرس</small></span></div>'+
       '<div class="explore-subject-footer"><span>استكشف محتوى المادة</span><strong>فتح المادة <i class="fa-solid fa-arrow-left"></i></strong></div>'+
     '</div>'+
   '</a>';
 }).join('')||'<div class="empty-state"><span>🔎</span><h3>لا توجد مادة مطابقة</h3><p>جرّب كلمة أقصر أو صفًا آخر.</p></div>';
 updateExplorePath();
}
async function loadAndRenderSubjects(){
 const requestedStage=state.stage,requestedGrade=state.grade;
 $('exploreSubjectBlock').classList.remove('hidden');
 $('exploreSubjectGrid').innerHTML='<div class="explore-inline-loading"><i class="fa-solid fa-spinner fa-spin"></i><span>جاري تحميل محتوى المرحلة...</span></div>';
 try{
   const data=await ensureStage(requestedStage);
   state.stageCache[requestedStage]=data;
   if(state.stage!==requestedStage||state.grade!==requestedGrade)return;
   renderSubjects();
 }catch(err){
   console.error(err);
   $('exploreSubjectGrid').innerHTML='<div class="empty-state"><span>⚠️</span><h3>تعذر تحميل محتوى المرحلة</h3><p>تحقق من الاتصال ثم حاول اختيار الصف مرة أخرى.</p></div>';
 }
}
function selectType(type){
 state.type=type;state.grade=null;syncUrl();
 $$('[data-type]').forEach(b=>{const active=b.dataset.type===type;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active?'true':'false')});
 $('activeTypeLabel').textContent=type==='azhar'?'التعليم الأزهري':'التعليم العام';
 renderGrades();updateExplorePath();
}
function selectStage(stage){
 state.stage=stage;state.grade=null;syncUrl();
 $$('[data-stage]').forEach(b=>{const active=b.dataset.stage===stage;b.classList.toggle('active',active);b.setAttribute('aria-selected',active?'true':'false')});
 renderGrades();updateExplorePath();
}

$$('[data-type]').forEach(b=>b.onclick=()=>selectType(b.dataset.type));
$$('[data-stage]').forEach(b=>b.onclick=()=>selectStage(b.dataset.stage));
$('explorePageSearch').addEventListener('input',e=>{state.search=e.target.value.trim();if(state.grade)renderSubjects()});

(async()=>{
 window.AcademyUI?.showPageLoading('جاري تجهيز المراحل والمواد...');
 try{
   const subjectsSnap=await db.ref('customSubjects').once('value');
   state.data.customSubjects=subjectsSnap.val()||{};
   $$('[data-type]').forEach(b=>{const active=b.dataset.type===state.type;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active?'true':'false')});
   $$('[data-stage]').forEach(b=>{const active=b.dataset.stage===state.stage;b.classList.toggle('active',active);b.setAttribute('aria-selected',active?'true':'false')});
   $('activeTypeLabel').textContent=state.type==='azhar'?'التعليم الأزهري':'التعليم العام';
   const requested=Number(params.get('grade')||0);
   state.grade=grades[state.stage].includes(requested)?requested:null;
   renderGrades();
   if(state.grade)await loadAndRenderSubjects();
 }catch(err){
   console.error(err);renderGrades();
   window.AcademyUI?.errorStateHtml&&($('exploreGradeGrid').innerHTML=window.AcademyUI.errorStateHtml('تعذر تحميل بيانات الاستكشاف','تحقق من الاتصال ثم حاول مرة أخرى.','<button class="btn btn-primary" onclick="location.reload()">إعادة المحاولة</button>'));
 }finally{window.AcademyUI?.hidePageLoading()}
})();
})();
