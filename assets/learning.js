(() => {
'use strict';

const firebaseConfig = window.ACADEMY_FIREBASE_CONFIG || JSON.parse(localStorage.getItem('academyFirebaseConfig') || 'null');
if(!firebaseConfig){ location.replace('./index.html'); return; }
if(!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth=firebase.auth(), db=firebase.database();
const $=id=>document.getElementById(id), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const page=document.documentElement.dataset.page, params=new URLSearchParams(location.search);
const state={user:null,profile:null,data:{},lessons:[],quizzes:[],files:[],subject:null,currentLesson:null,unitLessons:[],quiz:null,quizIndex:0};

const stages={primary:{name:'المرحلة الابتدائية',emoji:'🎒'},prep:{name:'المرحلة الإعدادية',emoji:'📚'},sec:{name:'المرحلة الثانوية',emoji:'🎓'}};
const grades={
 primary:{1:'الأول الابتدائي',2:'الثاني الابتدائي',3:'الثالث الابتدائي',4:'الرابع الابتدائي',5:'الخامس الابتدائي',6:'السادس الابتدائي'},
 prep:{1:'الأول الإعدادي',2:'الثاني الإعدادي',3:'الثالث الإعدادي'},
 sec:{1:'الأول الثانوي',2:'الثاني الثانوي',3:'الثالث الثانوي'}
};
const defaults={
 primary:[{id:'arabic',name:'اللغة العربية',emoji:'📖'},{id:'math',name:'الرياضيات',emoji:'🧮'},{id:'science',name:'العلوم',emoji:'🔬'},{id:'english',name:'اللغة الإنجليزية',emoji:'🇬🇧'},{id:'social',name:'الدراسات الاجتماعية',emoji:'🌍'},{id:'religion',name:'التربية الدينية',emoji:'🕌'}],
 prep:[{id:'arabic',name:'اللغة العربية',emoji:'📖'},{id:'math',name:'الرياضيات',emoji:'🧮'},{id:'science',name:'العلوم',emoji:'🔬'},{id:'english',name:'اللغة الإنجليزية',emoji:'🇬🇧'},{id:'social',name:'الدراسات الاجتماعية',emoji:'🌍'},{id:'computer',name:'الحاسب الآلي',emoji:'💻'}],
 sec:[{id:'arabic',name:'اللغة العربية',emoji:'📖'},{id:'english',name:'اللغة الإنجليزية',emoji:'🇬🇧'},{id:'math',name:'الرياضيات',emoji:'🧮'},{id:'physics',name:'الفيزياء',emoji:'⚛️'},{id:'chemistry',name:'الكيمياء',emoji:'🧪'},{id:'biology',name:'الأحياء',emoji:'🧬'},{id:'history',name:'التاريخ',emoji:'🏛️'},{id:'geography',name:'الجغرافيا',emoji:'🌍'}]
};
const esc=(v='')=>String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const initials=(n='طالب')=>(n.trim()[0]||'ط').toUpperCase();

function toast(msg,type='success'){
 const el=$('toast'); if(!el)return; el.textContent=msg; el.className='toast show '+type;
 clearTimeout(toast.t); toast.t=setTimeout(()=>el.className='toast',3000);
}
function ctx(){
 const p=state.profile||{};
 return {type:params.get('type')||p.educationType||'public',stage:params.get('stage')||p.stage||'prep',grade:params.get('grade')||String(p.grade||1),subject:params.get('subject')||null};
}
function getSubjects(stage,grade,type){
 const list=[...(defaults[stage]||[])], custom=state.data.customSubjects?.[stage]?.[grade];
 if(Array.isArray(custom)) custom.forEach(s=>{
   if(!s?.id||!s?.name||(s.type&&s.type!==type))return;
   const item={id:s.id,name:s.name,emoji:s.emoji||'⭐',units:s.units||[]}, i=list.findIndex(x=>x.id===s.id);
   if(i>=0)list[i]={...list[i],...item}; else list.push(item);
 });
 return list;
}
function subjectFor(c){return getSubjects(c.stage,String(c.grade),c.type).find(s=>s.id===c.subject)||{id:c.subject||'subject',name:'المادة الدراسية',emoji:'📚'};}
function customSubject(c){
 const a=state.data.customSubjects?.[c.stage]?.[c.grade];
 return Array.isArray(a)?a.find(s=>s?.id===c.subject&&(!s.type||s.type===c.type))||null:null;
}
function unitName(c,u){
 const n=customSubject(c)?.units?.[Number(u)-1]?.name;
 return n||['','الوحدة الأولى','الوحدة الثانية','الوحدة الثالثة','الوحدة الرابعة','الوحدة الخامسة','الوحدة السادسة'][Number(u)]||('الوحدة '+u);
}
function filterContent(c){
 state.lessons=Object.entries(state.data.lessons||{}).map(([id,v])=>({id,...v})).filter(l=>l.type===c.type&&l.stage===c.stage&&String(l.grade)===String(c.grade)&&l.subject===c.subject&&!l.isHidden).sort((a,b)=>(a.unit||1)-(b.unit||1)||(a.createdAt||0)-(b.createdAt||0));
 state.quizzes=Object.entries(state.data.quizzes||{}).map(([id,v])=>({id,...v})).filter(q=>q.type===c.type&&q.stage===c.stage&&String(q.grade)===String(c.grade)&&q.subject===c.subject&&!q.isHidden).sort((a,b)=>(a.unit||0)-(b.unit||0)||(a.createdAt||0)-(b.createdAt||0));
 state.files=Object.entries(state.data.files||{}).map(([id,v])=>({id,...v})).filter(f=>f.type===c.type&&f.stage===c.stage&&String(f.grade)===String(c.grade)&&(!f.subject||f.subject===c.subject));
}
function pLesson(id){return state.profile?.learningProgress?.[id]||{}}
function done(id){return !!pLesson(id).completed}
function progress(){return state.lessons.length?Math.round(state.lessons.filter(l=>done(l.id)).length/state.lessons.length*100):0}
function url(file,c,extra={}){
 const q=new URLSearchParams({type:c.type,stage:c.stage,grade:String(c.grade),subject:c.subject,...extra});
 return './'+file+'?'+q.toString();
}
function yt(raw=''){
 try{
   if(!raw)return''; if(raw.includes('youtube.com/embed/'))return raw;
   const u=new URL(raw); let id='';
   if(u.hostname.includes('youtu.be'))id=u.pathname.replace('/','').split('/')[0];
   else if(u.pathname.includes('/shorts/'))id=u.pathname.split('/shorts/')[1]?.split('/')[0];
   else id=u.searchParams.get('v')||'';
   return id?'https://www.youtube.com/embed/'+encodeURIComponent(id)+'?rel=0&modestbranding=1':'';
 }catch{return''}
}
function format(text=''){
 let s=esc(text).replace(/^###\s+(.+)$/gm,'<h3>$1</h3>').replace(/^##\s+(.+)$/gm,'<h2>$1</h2>').replace(/^#\s+(.+)$/gm,'<h1>$1</h1>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/^-\s+(.+)$/gm,'<li>$1</li>');
 s=s.replace(/(?:<li>[\s\S]*?<\/li>\s*)+/g,m=>'<ul>'+m+'</ul>');
 return s.split(/\n{2,}/).map(b=>{b=b.trim();if(!b)return'';if(/^<(h\d|ul|div)/.test(b))return b;return'<p>'+b.replace(/\n/g,'<br>')+'</p>'}).join('');
}
async function loadProfile(user){
 if(!user){state.profile=null;return}
 const s=await db.ref('studentProfilesV3/'+user.uid).once('value');state.profile=s.val()||{};
 if($('learningAvatar'))$('learningAvatar').textContent=initials(state.profile.name||user.displayName||'طالب');
}

/* subject */
function renderSubject(){
 const c=ctx(); if(!c.subject){location.replace('./index.html');return}
 state.subject=subjectFor(c);filterContent(c);
 const pct=progress(), complete=state.lessons.filter(l=>done(l.id)).length;
 document.title=state.subject.name+' | الأكاديمية';
 $('subjectTitle').textContent=state.subject.name;$('subjectEmoji').textContent=state.subject.emoji||'📚';
 $('subjectStageLabel').textContent=(c.type==='azhar'?'التعليم الأزهري':'التعليم العام')+' • '+(grades[c.stage]?.[c.grade]||stages[c.stage]?.name||'');
 $('subjectDescription').textContent='منهج '+state.subject.name+' مرتب في وحدات ودروس، مع اختبارات وتدريبات لمتابعة تقدمك.';
 $('subjectProgressText').textContent=pct+'%';$('subjectProgressBar').style.width=pct+'%';
 const certBtn=$('subjectCertificateBtn');
 if(certBtn){
   const canCert=!!state.user && pct>=100 && state.lessons.length>0;
   certBtn.classList.toggle('hidden',!canCert);
   if(canCert)certBtn.href='./certificate.html?'+new URLSearchParams({type:c.type,stage:c.stage,grade:String(c.grade),subject:c.subject}).toString();
 }
 $('lessonCount').textContent=state.lessons.length;$('completedCount').textContent=complete;$('quizCount').textContent=state.quizzes.length;
 $('subjectBreadcrumb').innerHTML='<a href="./index.html">الرئيسية</a><i class="fa-solid fa-chevron-left"></i><span>'+esc(state.subject.name)+'</span>';
 renderCurriculum(c,'all');renderSubjectSide(c);
 $$('[data-content-filter]').forEach(b=>b.onclick=()=>{$$('[data-content-filter]').forEach(x=>x.classList.toggle('active',x===b));renderCurriculum(c,b.dataset.contentFilter)});
}
function renderCurriculum(c,filter){
 $('curriculumSkeleton').classList.add('hidden');
 const map=new Map();
 state.lessons.forEach(l=>{const u=Number(l.unit||1);if(!map.has(u))map.set(u,{lessons:[],quizzes:[]});map.get(u).lessons.push(l)});
 state.quizzes.filter(q=>Number(q.unit||0)>0).forEach(q=>{const u=Number(q.unit);if(!map.has(u))map.set(u,{lessons:[],quizzes:[]});map.get(u).quizzes.push(q)});
 const comprehensive=state.quizzes.filter(q=>Number(q.unit||0)===0);
 if(!map.size&&!comprehensive.length){$('curriculumEmpty').classList.remove('hidden');$('curriculumList').classList.add('hidden');return}
 $('curriculumEmpty').classList.add('hidden');$('curriculumList').classList.remove('hidden');
 const cards=[...map.entries()].sort((a,b)=>a[0]-b[0]).map(([u,d])=>{
   const items=[];
   if(filter!=='quizzes')d.lessons.forEach((l,i)=>{
     const complete=done(l.id);
     items.push('<article class="curriculum-item"><span class="item-icon '+(complete?'done':'')+'"><i class="fa-solid '+(complete?'fa-check':'fa-circle-play')+'"></i></span><div><h4>'+esc(l.title||'درس')+'</h4><p>الدرس '+(i+1)+' • '+(l.videos?.length||0)+' فيديو • '+(l.questions?.length||0)+' سؤال</p></div><div class="item-action"><span class="item-state '+(complete?'complete':'')+'">'+(complete?'مكتمل':'ابدأ')+'</span><a class="item-open" href="'+url('lesson.html',c,{id:l.id})+'"><i class="fa-solid fa-arrow-left"></i></a></div></article>');
   });
   if(filter!=='lessons')d.quizzes.forEach(q=>items.push('<article class="curriculum-item"><span class="item-icon quiz"><i class="fa-solid fa-file-circle-question"></i></span><div><h4>'+esc(q.name||'اختبار الوحدة')+'</h4><p>اختبار • '+(q.questions?.length||0)+' سؤال</p></div><div class="item-action"><span class="item-state">اختبار</span><a class="item-open" href="'+url('lesson.html',c,{quiz:q.id})+'"><i class="fa-solid fa-arrow-left"></i></a></div></article>'));
   if(!items.length)return'';
   const dcount=d.lessons.filter(x=>done(x.id)).length;
   return '<section class="unit-card"><header class="unit-head"><div><span class="unit-number">'+u+'</span><div><h3>'+esc(unitName(c,u))+'</h3><p>'+d.lessons.length+' درس • '+d.quizzes.length+' اختبار</p></div></div><span class="unit-progress">'+dcount+'/'+d.lessons.length+' مكتمل</span></header><div class="unit-items">'+items.join('')+'</div></section>';
 });
 if(comprehensive.length&&filter!=='lessons')cards.push('<section class="unit-card"><header class="unit-head"><div><span class="unit-number"><i class="fa-solid fa-trophy"></i></span><div><h3>اختبارات شاملة</h3><p>قيّم مستواك في المنهج كاملًا</p></div></div></header><div class="unit-items">'+comprehensive.map(q=>'<article class="curriculum-item"><span class="item-icon quiz"><i class="fa-solid fa-file-circle-question"></i></span><div><h4>'+esc(q.name||'اختبار شامل')+'</h4><p>'+(q.questions?.length||0)+' سؤال</p></div><div class="item-action"><a class="item-open" href="'+url('lesson.html',c,{quiz:q.id})+'"><i class="fa-solid fa-arrow-left"></i></a></div></article>').join('')+'</div></section>');
 $('curriculumList').innerHTML=cards.join('')||'<div class="empty-state"><span>🔎</span><h3>لا يوجد محتوى بهذا الفلتر</h3></div>';
}
function renderSubjectSide(c){
 const next=state.lessons.find(l=>!done(l.id))||state.lessons[0];
 if(next){$('resumeTitle').textContent=done(next.id)?'راجع أول درس':next.title||'ابدأ أول درس';$('resumeDescription').textContent=unitName(c,next.unit||1)+' • '+(next.videos?.length||0)+' فيديو';$('resumeBtn').onclick=()=>location.href=url('lesson.html',c,{id:next.id})} else $('resumeBtn').disabled=true;
 const week=Math.min(3,state.lessons.filter(l=>pLesson(l.id).completedAt&&Date.now()-pLesson(l.id).completedAt<604800000).length);
 $('weeklyProgressText').textContent=week+' من 3';$('weeklyProgressBar').style.width=(week/3*100)+'%';
 $('exploreStagesBtn').onclick=()=>openLearningExplorer();$('exploreOtherSubjectsBtn').onclick=()=>openLearningExplorer();
}

/* Aggregate content analytics without exposing student identities */
function trackContentEvent(id,eventName,score=null){
 if(!id||!state.user)return;
 const key='academy-analytics-'+eventName+'-'+id;
 if((eventName==='views'||eventName==='completions')&&sessionStorage.getItem(key))return;
 if(eventName==='views'||eventName==='completions')sessionStorage.setItem(key,'1');
 db.ref('contentAnalytics/'+id).transaction(a=>{
   a=a||{};
   if(eventName==='views')a.views=Number(a.views||0)+1;
   if(eventName==='completions')a.completions=Number(a.completions||0)+1;
   if(eventName==='quiz'){
     a.quizAttempts=Number(a.quizAttempts||0)+1;
     a.quizScoreTotal=Number(a.quizScoreTotal||0)+Number(score||0);
     a.quizAverage=Math.round(a.quizScoreTotal/a.quizAttempts);
   }
   a.updatedAt=Date.now();return a;
 }).catch(()=>{});
}

/* lesson */
function renderLesson(){
 const c=ctx(),quizId=params.get('quiz'); if(quizId){renderQuizOnly(c,quizId);return}
 const id=params.get('id'), lesson=state.data.lessons?.[id];
 if(!id||!lesson||lesson.isHidden){toast('الدرس غير موجود أو غير متاح.','error');setTimeout(()=>history.back(),900);return}
 state.currentLesson={id,...lesson};state.subject=subjectFor(c);filterContent(c);state.unitLessons=state.lessons.filter(l=>Number(l.unit||1)===Number(lesson.unit||1));
 trackContentEvent(id,'views');
 if(state.user) db.ref('studentProfilesV3/'+state.user.uid).update({lastLessonTitle:lesson.title||'',lastSubjectId:c.subject,lastLessonId:id,lastActiveAt:Date.now()}).catch(()=>{});
 document.title=(lesson.title||'الدرس')+' | الأكاديمية';$('lessonTitle').textContent=lesson.title||'الدرس';$('lessonMeta').textContent=unitName(c,lesson.unit||1)+' • '+state.subject.name;
 $('lessonBreadcrumb').innerHTML='<a href="./index.html">الرئيسية</a><i class="fa-solid fa-chevron-left"></i><a id="backToSubjectLink" href="'+url('subject.html',c)+'">'+esc(state.subject.name)+'</a><i class="fa-solid fa-chevron-left"></i><span>'+esc(lesson.title||'الدرس')+'</span>';
 renderVideo(lesson);renderExplanation(lesson);renderFiles();renderOutline(c,lesson);renderNav(c);updateProgress(id);updateBookmarkUI(id);bindTabs();setupQuiz(c,lesson);loadLessonNotes(id);
 $('markCompleteBtn').onclick=()=>markComplete(c,id);$('markCompleteHeader').onclick=()=>markComplete(c,id);
 if($('bookmarkLessonBtn')) $('bookmarkLessonBtn').onclick=()=>toggleBookmark(c,id);
}
function renderVideo(l){
 const vids=Array.isArray(l.videos)?l.videos.filter(v=>v?.url):[];
 if(!vids.length)return;
 const src=yt(vids[0].url);if(src)$('videoFrame').innerHTML='<iframe src="'+src+'" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
 $('teacherSwitcherWrap').classList.remove('hidden');$('teacherCountBadge').textContent=vids.length+' '+(vids.length===1?'مدرس':'مدرسين');
 $('teacherSwitcher').innerHTML=vids.map((v,i)=>'<button class="teacher-choice '+(i===0?'active':'')+'" data-v="'+i+'"><span class="teacher-mini-avatar">'+esc((v.name||'م')[0])+'</span><strong>'+esc(v.name||('المدرس '+(i+1)))+'</strong></button>').join('');
 $$('[data-v]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.v),s=yt(vids[i].url);if(s)$('videoFrame').innerHTML='<iframe src="'+s+'" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';$$('[data-v]').forEach(x=>x.classList.toggle('active',x===b))});
}
function renderExplanation(l){
 $('lessonContent').innerHTML=l.content?format(l.content):'<p style="color:#94a3b8">لا يوجد شرح مكتوب لهذا الدرس حتى الآن.</p>';
 if(l.imageUrl){const top=l.imagePosition==='top',w=$(top?'lessonTopImageWrap':'lessonBottomImageWrap'),im=$(top?'lessonTopImage':'lessonBottomImage');im.src=l.imageUrl;im.alt=l.title||'';w.classList.remove('hidden')}
}
function renderFiles(){
 $('lessonResources').innerHTML=state.files.length?state.files.map(f=>'<article class="resource-item"><i class="fa-solid fa-file-pdf"></i><div><strong>'+esc(f.title||'ملف')+'</strong><small>ملف مساعد للمادة</small></div><a href="'+esc(f.url||'#')+'" target="_blank" rel="noopener">فتح الملف <i class="fa-solid fa-arrow-up-right-from-square"></i></a></article>').join(''):'<div class="empty-state"><span>📎</span><h3>لا توجد مرفقات لهذه المادة حاليًا</h3></div>';
}
function renderOutline(c,l){
 $('outlineUnitTitle').textContent=unitName(c,l.unit||1);
 $('lessonOutline').innerHTML=state.unitLessons.map((x,i)=>'<a class="outline-item '+(x.id===state.currentLesson.id?'active':'')+'" href="'+url('lesson.html',c,{id:x.id})+'"><span class="outline-num">'+(done(x.id)?'✓':i+1)+'</span><strong>'+esc(x.title||'درس')+'</strong></a>').join('');
}
function renderNav(c){
 const i=state.lessons.findIndex(l=>l.id===state.currentLesson.id),prev=state.lessons[i-1],next=state.lessons[i+1];
 $('previousLessonBtn').disabled=!prev;$('nextLessonBtn').disabled=!next;
 $('previousLessonBtn').onclick=()=>{if(prev)location.href=url('lesson.html',c,{id:prev.id})};$('nextLessonBtn').onclick=()=>{if(next)location.href=url('lesson.html',c,{id:next.id})};
}
function bindTabs(){
 $$('[data-lesson-tab]').forEach(b=>b.onclick=()=>{
   $$('[data-lesson-tab]').forEach(x=>x.classList.toggle('active',x===b));
   $('lessonExplanationPanel').classList.toggle('hidden',b.dataset.lessonTab!=='explanation');
   $('lessonQuizPanel').classList.toggle('hidden',b.dataset.lessonTab!=='quiz');
   $('lessonResourcesPanel').classList.toggle('hidden',b.dataset.lessonTab!=='resources');
   $('lessonNotesPanel')?.classList.toggle('hidden',b.dataset.lessonTab!=='notes');
 });
}
async function loadLessonNotes(id){
 const textarea=$('lessonNotesText'),status=$('lessonNotesStatus'),btn=$('saveLessonNotesBtn');
 if(!textarea||!status||!btn)return;
 if(!state.user){
   textarea.disabled=true;btn.disabled=true;textarea.placeholder='سجّل الدخول علشان تستخدم ملاحظاتك الخاصة.';status.textContent='الملاحظات متاحة بعد تسجيل الدخول';return;
 }
 try{
   const snap=await db.ref('studentProfilesV3/'+state.user.uid+'/lessonNotes/'+id).once('value');
   const note=snap.val()||{};textarea.value=note.text||'';status.textContent=note.updatedAt?'آخر حفظ: '+new Date(note.updatedAt).toLocaleString('ar-EG'):'جاهز للكتابة';
 }catch{status.textContent='تعذر تحميل الملاحظات'}
 btn.onclick=()=>saveLessonNotes(id);
}
async function saveLessonNotes(id){
 const textarea=$('lessonNotesText'),status=$('lessonNotesStatus'),btn=$('saveLessonNotesBtn');
 if(!state.user||!textarea)return;
 const text=textarea.value.trim();btn.disabled=true;status.textContent='جاري الحفظ...';
 try{
   if(text)await db.ref('studentProfilesV3/'+state.user.uid+'/lessonNotes/'+id).set({text,updatedAt:Date.now(),title:state.currentLesson?.title||'درس'});
   else await db.ref('studentProfilesV3/'+state.user.uid+'/lessonNotes/'+id).remove();
   status.textContent=text?'تم الحفظ الآن ✅':'تم حذف الملاحظة';toast(text?'تم حفظ ملاحظاتك الخاصة.':'تم حذف الملاحظات.');
 }catch{status.textContent='تعذر الحفظ';toast('تعذر حفظ الملاحظات.','error')}
 finally{btn.disabled=false}
}
function isBookmarked(id){return !!state.profile?.bookmarks?.[id]}
function updateBookmarkUI(id){
 const btn=$('bookmarkLessonBtn');if(!btn)return;
 const saved=isBookmarked(id);
 btn.innerHTML=saved?'<i class="fa-solid fa-bookmark"></i>':'<i class="fa-regular fa-bookmark"></i>';
 btn.title=saved?'إزالة من المحفوظات':'حفظ للمراجعة';
 btn.style.color=saved?'#1d4ed8':'';
}
async function toggleBookmark(c,id){
 if(!state.user){toast('سجّل الدخول أولًا لحفظ الدرس.','error');return}
 const saved=isBookmarked(id),ref=db.ref('studentProfilesV3/'+state.user.uid+'/bookmarks/'+id);
 if(saved){
   await ref.remove();
   if(state.profile.bookmarks)delete state.profile.bookmarks[id];
   toast('تمت إزالة الدرس من المحفوظات.');
 }else{
   const payload={lessonId:id,title:state.currentLesson?.title||'درس',subject:c.subject,type:c.type,stage:c.stage,grade:String(c.grade),savedAt:Date.now()};
   await ref.set(payload);
   state.profile.bookmarks=state.profile.bookmarks||{};state.profile.bookmarks[id]=payload;
   toast('تم حفظ الدرس للمراجعة ⭐');
 }
 updateBookmarkUI(id);
}

function updateProgress(id){
 const complete=done(id);$('lessonProgressBar').style.width=complete?'100%':'35%';$('lessonProgressText').textContent=complete?'أحسنت! أكملت هذا الدرس ويمكنك مراجعته في أي وقت.':'شاهد الشرح ثم حل التدريب، وبعدها علّم الدرس كمكتمل.';
 $('lessonStatusIcon').classList.toggle('complete',complete);$('lessonStatusIcon').innerHTML=complete?'<i class="fa-solid fa-check"></i>':'<i class="fa-regular fa-circle"></i>';$('markCompleteBtn').innerHTML=complete?'<i class="fa-solid fa-check"></i> تم إكمال الدرس':'<i class="fa-regular fa-circle-check"></i> تعليم الدرس كمكتمل';
}
async function markComplete(c,id){
 if(!state.user){toast('سجّل الدخول أولًا لحفظ تقدمك.','error');return} if(done(id)){toast('هذا الدرس مكتمل بالفعل ✨');return}
 const at=Date.now();await db.ref('studentProfilesV3/'+state.user.uid+'/learningProgress/'+id).update({completed:true,completedAt:at,subject:c.subject});
 await db.ref('studentProfilesV3/'+state.user.uid+'/dailyGoals/'+new Date().toISOString().slice(0,10)+'/lesson').set(true);
 await db.ref('studentProfilesV3/'+state.user.uid+'/stats').transaction(s=>{s=s||{};s.completedLessons=(s.completedLessons||0)+1;s.totalXP=(s.totalXP||0)+50;s.level=Math.floor((s.totalXP||0)/1000)+1;return s});
 if(window.AcademyCore?.addLeaderboardXP) await window.AcademyCore.addLeaderboardXP(state.user.uid,state.profile?.name||state.user.displayName||'طالب',50,0);
 state.profile.learningProgress=state.profile.learningProgress||{};state.profile.learningProgress[id]={completed:true,completedAt:at,subject:c.subject};
 const subjectPct=progress();
 await db.ref('studentProfilesV3/'+state.user.uid+'/subjectProgress/'+c.subject).set(subjectPct);
 await db.ref('studentProfilesV3/'+state.user.uid).update({lastLessonTitle:state.currentLesson?.title||'',lastSubjectId:c.subject,lastActiveAt:Date.now()});
 trackContentEvent(id,'completions');
 updateProgress(id);renderOutline(c,state.currentLesson);toast('رائع! +50 XP وتم حفظ تقدمك 🎉');
}
function setupQuiz(c,l){
 const qs=Array.isArray(l.questions)?l.questions:[];$('quizIntroText').textContent=qs.length?'تدريب مكوّن من '+qs.length+' سؤال على هذا الدرس.':'لا توجد أسئلة مضافة لهذا الدرس حتى الآن.';$('startQuizBtn').disabled=!qs.length;$('startQuizBtn').onclick=()=>startQuiz(qs,c,l.id);$('retryQuizBtn').onclick=()=>startQuiz(qs,c,l.id);$('reviewLessonBtn').onclick=()=>$('[data-lesson-tab]').find(b=>b.dataset.lessonTab==='explanation')?.click();
}
function startQuiz(qs,c,sourceId){
 const ok=qs.filter(q=>q&&Array.isArray(q.opts)&&q.opts.length>=2);if(!ok.length){toast('لا توجد أسئلة قابلة للتشغيل حاليًا.','error');return}
 state.quiz={questions:ok,answers:new Array(ok.length).fill(null),c,sourceId};state.quizIndex=0;$('quizIntro').classList.add('hidden');$('quizResult').classList.add('hidden');$('quizEngine').classList.remove('hidden');renderQuestion();
}
function renderQuestion(){
 const qz=state.quiz,i=state.quizIndex,q=qz.questions[i],total=qz.questions.length,letters=['أ','ب','ج','د','هـ'];
 $('quizProgressText').textContent='السؤال '+(i+1)+' من '+total;$('quizProgressBar').style.width=((i+1)/total*100)+'%';$('questionNumber').textContent=i+1;$('questionText').textContent=q.text||'';
 $('questionOptions').innerHTML=(q.opts||[]).map((o,j)=>'<button class="quiz-option-v3 '+(qz.answers[i]===j?'selected':'')+'" data-a="'+j+'"><span class="opt-letter">'+(letters[j]||j+1)+'</span><span>'+esc(o)+'</span></button>').join('');
 $$('[data-a]').forEach(b=>b.onclick=()=>{qz.answers[i]=Number(b.dataset.a);renderQuestion()});$('prevQuestionBtn').disabled=i===0;$('nextQuestionBtn').textContent=i===total-1?'إنهاء التدريب':'التالي';
 $('prevQuestionBtn').onclick=()=>{if(state.quizIndex>0){state.quizIndex--;renderQuestion()}};$('nextQuestionBtn').onclick=()=>{if(qz.answers[i]===null){toast('اختر إجابة أولًا.','error');return}if(i===total-1)finishQuiz();else{state.quizIndex++;renderQuestion()}};
}
async function finishQuiz(){
 const qz=state.quiz;let score=0;qz.questions.forEach((q,i)=>{if(Number(qz.answers[i])===Number(q.correctAnswer))score++});const pct=Math.round(score/qz.questions.length*100);
 $('quizEngine').classList.add('hidden');$('quizResult').classList.remove('hidden');$('resultPercent').textContent=pct+'%';$('resultRing').style.background='conic-gradient(#10b981 '+(pct*3.6)+'deg,#e5e7eb 0deg)';
 $('resultTitle').textContent=pct>=80?'ممتاز جدًا! 🌟':pct>=60?'أداء جيد 👏':'راجع الشرح وجرّب مرة أخرى';$('resultMessage').textContent='أجبت عن '+score+' من '+qz.questions.length+' إجابة بشكل صحيح.';
 trackContentEvent(qz.sourceId,'quiz',pct);
 if(state.user){
   const gained=pct>=80?40:20;
   await db.ref('studentProfilesV3/'+state.user.uid+'/stats').transaction(s=>{s=s||{};s.completedQuizzes=(s.completedQuizzes||0)+1;s.totalXP=(s.totalXP||0)+gained;s.level=Math.floor((s.totalXP||0)/1000)+1;return s});
   await db.ref('studentProfilesV3/'+state.user.uid+'/quizHistory').push({
     sourceId:qz.sourceId,
     sourceType:state.currentLesson?'lesson':'quiz',
     title:state.currentLesson?.title||'اختبار',
     subject:qz.c?.subject||'',
     score:pct,
     correct:score,
     total:qz.questions.length,
     createdAt:Date.now()
   });
   await db.ref('studentProfilesV3/'+state.user.uid+'/dailyGoals/'+new Date().toISOString().slice(0,10)+'/quiz').set(true);
   if(window.AcademyCore?.addLeaderboardXP) await window.AcademyCore.addLeaderboardXP(state.user.uid,state.profile?.name||state.user.displayName||'طالب',gained,1);
 }
}
function renderQuizOnly(c,id){
 const q=state.data.quizzes?.[id];if(!q||q.isHidden){toast('الاختبار غير موجود.','error');setTimeout(()=>history.back(),800);return}
 state.subject=subjectFor(c);filterContent(c);$('lessonTitle').textContent=q.name||'اختبار';$('lessonMeta').textContent=(Number(q.unit||0)===0?'اختبار شامل':unitName(c,q.unit))+' • '+state.subject.name;$('lessonSubtitle').textContent='اختبر مستواك واعرف نقاط القوة وما يحتاج للمراجعة.';
 document.querySelector('.video-theater').classList.add('hidden');$('lessonExplanationPanel').classList.add('hidden');$('lessonResourcesPanel').classList.add('hidden');$('lessonTabs').innerHTML='<button class="active"><i class="fa-solid fa-bullseye"></i> الاختبار</button>';$('lessonQuizPanel').classList.remove('hidden');
 $('quizIntroText').textContent='الاختبار مكوّن من '+(q.questions?.length||0)+' سؤال.';$('startQuizBtn').disabled=!(q.questions?.length);$('startQuizBtn').onclick=()=>startQuiz(q.questions||[],c,id);$('retryQuizBtn').onclick=()=>startQuiz(q.questions||[],c,id);$('reviewLessonBtn').classList.add('hidden');
 $('outlineUnitTitle').textContent='الاختبار';$('lessonOutline').innerHTML='<div class="outline-item active"><span class="outline-num">✓</span><strong>'+esc(q.name||'اختبار')+'</strong></div>';
 document.querySelector('.lesson-progress-card')?.classList.add('hidden');const back=url('subject.html',c);$('backToSubjectLink').href=back;$('previousLessonBtn').onclick=()=>location.href=back;$('previousLessonBtn').innerHTML='<i class="fa-solid fa-arrow-right"></i> العودة للمادة';$('nextLessonBtn').classList.add('hidden');
}


function bindLearningExplorer(){
 if(!$('explorerDrawer'))return;
 $('closeExplorer').onclick=closeLearningExplorer;
 $('explorerBackdrop').onclick=closeLearningExplorer;
 $$('[data-explorer-tab]').forEach(b=>b.onclick=()=>{
   $$('[data-explorer-tab]').forEach(x=>x.classList.toggle('active',x===b));
   $('explorerStagesView').classList.toggle('hidden',b.dataset.explorerTab!=='stages');
   $('explorerSubjectsView').classList.toggle('hidden',b.dataset.explorerTab!=='subjects');
 });
 $$('[data-type-filter]').forEach(b=>b.onclick=()=>{
   $$('[data-type-filter]').forEach(x=>x.classList.toggle('active',x===b));
   renderLearningStages(b.dataset.typeFilter);
 });
 $('explorerSearch').addEventListener('input',()=>renderLearningStages(document.querySelector('[data-type-filter].active')?.dataset.typeFilter||'all'));
}
function openLearningExplorer(){
 $('explorerBackdrop').classList.remove('hidden');$('explorerDrawer').classList.add('open');document.body.style.overflow='hidden';
 renderLearningStages('all');
}
function closeLearningExplorer(){
 $('explorerBackdrop').classList.add('hidden');$('explorerDrawer').classList.remove('open');document.body.style.overflow='';
}
function renderLearningStages(typeFilter='all'){
 const q=($('explorerSearch')?.value||'').trim().toLowerCase(), types=typeFilter==='all'?['public','azhar']:[typeFilter];
 const rows=[];
 types.forEach(type=>['primary','prep','sec'].forEach(stage=>{
   const title=stages[stage].name+' • '+(type==='azhar'?'أزهر':'تعليم عام');
   if(q && !title.toLowerCase().includes(q))return;
   const gradeList=stage==='primary'?[1,2,3,4,5,6]:[1,2,3];
   rows.push('<article class="explorer-stage-item explorer-stage-rich"><span class="emoji">'+(type==='azhar'?'🕌':stages[stage].emoji)+'</span><div><strong>'+esc(title)+'</strong><small>اختر الصف ثم شاهد مواده</small><div class="explore-grade-links">'+gradeList.map(g=>'<button data-explore-grade="'+g+'" data-explore-stage="'+stage+'" data-explore-type="'+type+'">'+g+'</button>').join('')+'</div></div></article>');
 }));
 $('explorerStageList').innerHTML=rows.join('')||'<p>لا توجد نتائج مطابقة.</p>';
 $$('[data-explore-grade]').forEach(b=>b.onclick=()=>renderLearningSubjects(b.dataset.exploreType,b.dataset.exploreStage,b.dataset.exploreGrade));
}
function renderLearningSubjects(type,stage,grade){
 const subjects=getSubjects(stage,String(grade),type);
 $('explorerStagesView').classList.add('hidden');$('explorerSubjectsView').classList.remove('hidden');
 $$('[data-explorer-tab]').forEach(b=>b.classList.toggle('active',b.dataset.explorerTab==='subjects'));
 $('explorerSubjectList').innerHTML=subjects.map(s=>'<a class="explorer-subject-item" href="'+url('subject.html',{type,stage,grade,subject:s.id})+'"><span class="emoji">'+(s.emoji||'📚')+'</span><div><strong>'+esc(s.name)+'</strong><small>'+esc(grades[stage]?.[grade]||'')+' • '+(type==='azhar'?'أزهر':'تعليم عام')+'</small></div><button><i class="fa-solid fa-arrow-left"></i></button></a>').join('');
}

async function init(){
 try{
   const [subjectsSnap,lessonsSnap,quizzesSnap,filesSnap]=await Promise.all([
     db.ref('customSubjects').once('value'),
     db.ref('lessons').once('value'),
     db.ref('quizzes').once('value'),
     db.ref('files').once('value')
   ]);
   state.data={customSubjects:subjectsSnap.val()||{},lessons:lessonsSnap.val()||{},quizzes:quizzesSnap.val()||{},files:filesSnap.val()||{}};
 }catch(e){toast('تعذر تحميل المحتوى الآن.','error')}
 auth.onAuthStateChanged(async user=>{state.user=user;await loadProfile(user);if(page==='subject'){renderSubject();bindLearningExplorer()}if(page==='lesson')renderLesson()});
}
init();
})();