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
const safeUrl=(u='')=>window.AcademyUtils.safeUrl(u);
const localDateKey=(d=new Date())=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const quizXpTarget=score=>Number(score)>=80?40:20;

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
   const item={id:s.id,name:s.name,emoji:s.emoji||'⭐',imageUrl:s.imageUrl||'',units:s.units||[]}, i=list.findIndex(x=>x.id===s.id);
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
function audienceAllows(item){
 if(!item||item.targetMode!=='students')return true;
 if(!state.user)return false;
 const raw=item.targetStudentIds||item.targetStudents||[];
 const ids=Array.isArray(raw)?raw:Object.keys(raw||{}).filter(k=>raw[k]);
 return ids.includes(state.user.uid);
}
function filterContent(c){
 state.lessons=Object.entries(state.data.lessons||{}).map(([id,v])=>({id,...v})).filter(l=>l.type===c.type&&l.stage===c.stage&&String(l.grade)===String(c.grade)&&l.subject===c.subject&&!l.isHidden).sort((a,b)=>(a.unit||1)-(b.unit||1)||(a.createdAt||0)-(b.createdAt||0));
 state.quizzes=Object.entries(state.data.quizzes||{}).map(([id,v])=>({id,...v})).filter(q=>q.type===c.type&&q.stage===c.stage&&String(q.grade)===String(c.grade)&&q.subject===c.subject&&!q.isHidden&&audienceAllows(q)).sort((a,b)=>(a.unit||0)-(b.unit||0)||(a.createdAt||0)-(b.createdAt||0));
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
   if(!raw)return'';
   if(raw.includes('youtube.com/embed/')){
     const u=new URL(raw);u.searchParams.set('rel','0');u.searchParams.set('modestbranding','1');u.searchParams.set('enablejsapi','1');return u.href;
   }
   const u=new URL(raw); let id='';
   if(u.hostname.includes('youtu.be'))id=u.pathname.replace('/','').split('/')[0];
   else if(u.pathname.includes('/shorts/'))id=u.pathname.split('/shorts/')[1]?.split('/')[0];
   else id=u.searchParams.get('v')||'';
   return id?'https://www.youtube.com/embed/'+encodeURIComponent(id)+'?rel=0&modestbranding=1&enablejsapi=1':'';
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
function firstIncompleteLesson(){
 return state.lessons.find(l=>!done(l.id))||null;
}
function unitLessonsFor(unit){
 return state.lessons.filter(l=>Number(l.unit||1)===Number(unit));
}
function unitIsComplete(unit){
 const list=unitLessonsFor(unit);
 return !list.length || list.every(l=>done(l.id));
}
function subjectIsComplete(){
 return !state.lessons.length || state.lessons.every(l=>done(l.id));
}
function renderSubjectPath(c){
 const track=$('subjectPathTrack'); if(!track)return;
 const units=[...new Set(state.lessons.map(l=>Number(l.unit||1)))].sort((a,b)=>a-b);
 const next=firstIncompleteLesson();
 const currentUnit=next?Number(next.unit||1):(units.at(-1)||1);
 const nodes=units.map((u,index)=>{
   const lessons=unitLessonsFor(u),completed=lessons.filter(l=>done(l.id)).length;
   const isComplete=lessons.length>0&&completed===lessons.length;
   const isCurrent=!isComplete&&u===currentUnit;
   const pct=lessons.length?Math.round(completed/lessons.length*100):0;
   const stateClass=isComplete?'complete':isCurrent?'current':'upcoming';
   const icon=isComplete?'fa-check':isCurrent?'fa-play':'fa-lock-open';
   return '<button class="subject-path-node '+stateClass+'" data-path-unit="'+u+'" aria-label="'+esc(unitName(c,u))+'، '+completed+' من '+lessons.length+' دروس مكتملة" '+(isCurrent?'aria-current="step"':'')+'>'+
     '<span class="path-node-icon"><i class="fa-solid '+icon+'"></i></span>'+
     '<span class="path-node-copy"><small>المرحلة '+(index+1)+'</small><strong>'+esc(unitName(c,u))+'</strong><em>'+completed+' / '+lessons.length+' درس</em></span>'+
     '<span class="path-node-progress"><i style="width:'+pct+'%"></i></span>'+
   '</button>';
 });
 nodes.push('<div class="subject-path-node finish '+(subjectIsComplete()?'complete':'upcoming')+'"><span class="path-node-icon"><i class="fa-solid fa-trophy"></i></span><span class="path-node-copy"><small>النهاية</small><strong>إتمام المادة</strong><em>'+(subjectIsComplete()?'تم الإنجاز 🎉':'أكمل الوحدات')+'</em></span></div>');
 track.innerHTML=nodes.join('');
 $$('[data-path-unit]').forEach(b=>b.onclick=()=>document.querySelector('[data-unit-card="'+b.dataset.pathUnit+'"]')?.scrollIntoView({behavior:'smooth',block:'start'}));
 const btn=$('subjectPathContinueBtn');
 if(next){
   $('subjectPathHint').textContent='خطوتك التالية: '+(next.title||'الدرس التالي')+' في '+unitName(c,next.unit||1)+'.';
   btn.disabled=false;btn.innerHTML='<i class="fa-solid fa-play"></i> كمّل من مكانك';
   btn.onclick=()=>location.href=url('lesson.html',c,{id:next.id});
 }else if(state.lessons.length){
   $('subjectPathHint').textContent='أحسنت! أكملت جميع دروس المادة. جرّب الاختبارات الشاملة أو افتح شهادتك.';
   btn.disabled=false;btn.innerHTML='<i class="fa-solid fa-award"></i> راجع إنجازك';
   btn.onclick=()=>document.querySelector('.curriculum-column')?.scrollIntoView({behavior:'smooth'});
 }else{
   $('subjectPathHint').textContent='سيظهر مسار التعلم هنا عند إضافة الدروس.';
   btn.disabled=true;
 }
}
function renderSubject(){
 const c=ctx(); if(!c.subject){location.replace('./index.html');return}
 state.subject=subjectFor(c);filterContent(c);
 const pct=progress(), complete=state.lessons.filter(l=>done(l.id)).length,next=firstIncompleteLesson();
 document.title=state.subject.name+' | الأكاديمية';
 $('subjectTitle').textContent=state.subject.name;
 const hero=document.querySelector('.subject-hero-card'),rawImage=state.subject.imageUrl||'',safeImage=(()=>{try{if(!rawImage)return'';const u=new URL(rawImage,location.href);return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return''}})();
 if($('subjectEmoji')){
   $('subjectEmoji').innerHTML=safeImage?'<img data-subject-image data-fallback="'+esc(state.subject.emoji||'📚')+'" src="'+esc(safeImage)+'" alt="" loading="lazy">':esc(state.subject.emoji||'📚');
   $('subjectEmoji').classList.toggle('has-subject-image',!!safeImage);
 }
 if(hero){
   hero.classList.toggle('has-custom-subject-image',!!safeImage);
   hero.style.backgroundImage=safeImage?'linear-gradient(90deg,rgba(4,34,102,.98) 0%,rgba(4,74,180,.92) 46%,rgba(4,77,179,.54) 72%,rgba(3,45,118,.38) 100%),url("'+safeImage.replace(/"/g,'%22')+'")':'';
   hero.style.backgroundSize=safeImage?'cover':'';
   hero.style.backgroundPosition=safeImage?'center':'';
 }
 $('subjectStageLabel').textContent=(c.type==='azhar'?'التعليم الأزهري':'التعليم العام')+' • '+(grades[c.stage]?.[c.grade]||stages[c.stage]?.name||'');
 $('subjectDescription').textContent='منهج '+state.subject.name+' مرتب في وحدات ودروس، مع اختبارات وتدريبات لمتابعة تقدمك.';
 $('subjectProgressText').textContent=pct+'%';$('subjectProgressBar').style.width=pct+'%';
 $('subjectProgressTrack')?.setAttribute('aria-valuenow',String(pct));
 if($('nextLessonStat'))$('nextLessonStat').textContent=next?(next.title||'الدرس التالي'):(state.lessons.length?'مراجعة المادة':'—');
 const certBtn=$('subjectCertificateBtn');
 if(certBtn){
   const canCert=!!state.user && pct>=100 && state.lessons.length>0;
   certBtn.classList.toggle('hidden',!canCert);
   if(canCert)certBtn.href='./certificate.html?'+new URLSearchParams({type:c.type,stage:c.stage,grade:String(c.grade),subject:c.subject}).toString();
 }
 $('lessonCount').textContent=state.lessons.length;$('completedCount').textContent=complete;$('quizCount').textContent=state.quizzes.length;
 $('subjectBreadcrumb').innerHTML='<a href="./index.html">الرئيسية</a><i class="fa-solid fa-chevron-left"></i><span>'+esc(state.subject.name)+'</span>';
 renderSubjectPath(c);renderCurriculum(c,'all');renderSubjectSide(c);
 $$('[data-content-filter]').forEach(b=>b.onclick=()=>{
   $$('[data-content-filter]').forEach(x=>{
     const active=x===b;
     x.classList.toggle('active',active);
     x.setAttribute('aria-selected',active?'true':'false');
   });
   renderCurriculum(c,b.dataset.contentFilter);
 });
}
function renderCurriculum(c,filter){
 $('curriculumSkeleton').classList.add('hidden');
 const map=new Map();
 state.lessons.forEach(l=>{const u=Number(l.unit||1);if(!map.has(u))map.set(u,{lessons:[],quizzes:[]});map.get(u).lessons.push(l)});
 state.quizzes.filter(q=>q.lessonId||Number(q.unit||0)>0).forEach(q=>{const u=Number(q.lessonId?state.lessons.find(l=>l.id===q.lessonId)?.unit||q.unit||1:q.unit);if(!map.has(u))map.set(u,{lessons:[],quizzes:[]});map.get(u).quizzes.push(q)});
 const comprehensive=state.quizzes.filter(q=>!q.lessonId&&Number(q.unit||0)===0);
 if(!map.size&&!comprehensive.length){$('curriculumEmpty').classList.remove('hidden');$('curriculumList').classList.add('hidden');return}
 $('curriculumEmpty').classList.add('hidden');$('curriculumList').classList.remove('hidden');

 const next=firstIncompleteLesson();
 const cards=[...map.entries()].sort((a,b)=>a[0]-b[0]).map(([u,d])=>{
   const items=[];
   const unitComplete=!d.lessons.length||d.lessons.every(x=>done(x.id));
   if(filter!=='quizzes')d.lessons.forEach((l,i)=>{
     const complete=done(l.id),current=next?.id===l.id;
     const cls=complete?'complete':current?'current':'upcoming';
     const status=complete?'مكتمل':current?'خطوتك التالية':'متاح';
     items.push('<a class="curriculum-item '+cls+'" href="'+url('lesson.html',c,{id:l.id})+'" aria-label="فتح درس '+esc(l.title||'درس')+'">'+
       '<span class="item-icon '+(complete?'done':current?'current':'')+'"><i class="fa-solid '+(complete?'fa-check':current?'fa-play':'fa-circle-play')+'"></i></span>'+
       '<div><div class="curriculum-title-line"><h4>'+esc(l.title||'درس')+'</h4>'+(current?'<span class="next-step-badge">التالي لك</span>':'')+'</div><p>الدرس '+(i+1)+' • '+(l.videos?.length||0)+' فيديو • '+(l.questions?.length||0)+' سؤال</p></div>'+
       '<div class="item-action"><span class="item-state '+(complete?'complete':current?'current':'')+'">'+status+'</span><span class="item-open"><i class="fa-solid fa-arrow-left"></i></span></div>'+
     '</a>');
   });
   if(filter!=='lessons')d.quizzes.filter(q=>q.lessonId).forEach(q=>{
     const linked=state.lessons.find(l=>l.id===q.lessonId),locked=!linked||!done(q.lessonId);
     const body='<span class="item-icon quiz"><i class="fa-solid '+(locked?'fa-lock':'fa-file-circle-question')+'"></i></span><div><h4>'+esc(q.name||'اختبار الدرس')+'</h4><p>مرتبط بدرس: '+esc(linked?.title||'درس غير متاح')+' • '+(q.questions?.length||0)+' سؤال</p></div><div class="item-action"><span class="item-state '+(locked?'locked':'quiz-ready')+'">'+(locked?'أكمل الدرس':'ابدأ الاختبار')+'</span></div>';
     items.push(locked?'<button type="button" class="curriculum-item quiz-item locked locked-curriculum-action" data-locked-quiz="lesson" aria-label="أكمل الدرس لفتح الاختبار">'+body+'</button>':'<a class="curriculum-item quiz-item unlocked" href="'+url('lesson.html',c,{quiz:q.id})+'">'+body+'</a>');
   });
   if(filter!=='lessons')d.quizzes.filter(q=>!q.lessonId).forEach(q=>{
     const locked=!unitComplete;
     const body='<span class="item-icon quiz"><i class="fa-solid '+(locked?'fa-lock':'fa-file-circle-question')+'"></i></span>'+
       '<div><h4>'+esc(q.name||'اختبار الوحدة')+'</h4><p>'+(locked?'أكمل دروس الوحدة لفتح الاختبار':'جاهز الآن • ')+(q.questions?.length||0)+' سؤال</p></div>'+
       '<div class="item-action"><span class="item-state '+(locked?'locked':'quiz-ready')+'">'+(locked?'مغلق':'ابدأ الاختبار')+'</span><span class="item-open '+(locked?'locked-action':'')+'"><i class="fa-solid '+(locked?'fa-lock':'fa-arrow-left')+'"></i></span></div>';
     items.push(locked
       ?'<button type="button" class="curriculum-item quiz-item locked locked-curriculum-action" data-locked-quiz="'+u+'" aria-label="اختبار مغلق">'+body+'</button>'
       :'<a class="curriculum-item quiz-item unlocked" href="'+url('lesson.html',c,{quiz:q.id})+'" aria-label="فتح اختبار '+esc(q.name||'الوحدة')+'">'+body+'</a>');
   });
   if(!items.length)return'';
   const dcount=d.lessons.filter(x=>done(x.id)).length,pct=d.lessons.length?Math.round(dcount/d.lessons.length*100):0;
   return '<section class="unit-card '+(unitComplete?'unit-complete':'')+'" data-unit-card="'+u+'">'+
     '<header class="unit-head"><div class="unit-head-main"><span class="unit-number">'+(unitComplete?'<i class="fa-solid fa-check"></i>':u)+'</span><div><h3>'+esc(unitName(c,u))+'</h3><p>'+d.lessons.length+' درس • '+d.quizzes.length+' اختبار</p></div></div>'+
     '<div class="unit-head-actions"><div class="unit-progress-rich"><strong>'+dcount+'/'+d.lessons.length+'</strong><span>مكتمل</span><div class="mini-progress"><i style="width:'+pct+'%"></i></div></div>'+
     '<button type="button" class="unit-toggle" data-toggle-unit="'+u+'" aria-expanded="true" aria-controls="unitItems-'+u+'" title="طي أو فتح الوحدة"><i class="fa-solid fa-chevron-up"></i></button></div></header>'+
     '<div class="unit-items" id="unitItems-'+u+'">'+items.join('')+'</div></section>';
 });

 if(comprehensive.length&&filter!=='lessons'){
   const unlocked=subjectIsComplete();
   const body=comprehensive.map(q=>{
     const content='<span class="item-icon quiz"><i class="fa-solid '+(unlocked?'fa-file-circle-question':'fa-lock')+'"></i></span><div><h4>'+esc(q.name||'اختبار شامل')+'</h4><p>'+(q.questions?.length||0)+' سؤال</p></div><div class="item-action"><span class="item-state '+(unlocked?'quiz-ready':'locked')+'">'+(unlocked?'جاهز':'مغلق')+'</span><span class="item-open '+(unlocked?'':'locked-action')+'"><i class="fa-solid '+(unlocked?'fa-arrow-left':'fa-lock')+'"></i></span></div>';
     return unlocked
       ?'<a class="curriculum-item quiz-item unlocked" href="'+url('lesson.html',c,{quiz:q.id})+'">'+content+'</a>'
       :'<button type="button" class="curriculum-item quiz-item locked locked-curriculum-action" data-locked-quiz="all">'+content+'</button>';
   }).join('');
   cards.push('<section class="unit-card comprehensive-card '+(unlocked?'unit-complete':'')+'"><header class="unit-head"><div class="unit-head-main"><span class="unit-number"><i class="fa-solid fa-trophy"></i></span><div><h3>اختبارات شاملة</h3><p>'+(unlocked?'أنت جاهز لتقييم المنهج كاملًا':'تفتح بعد إكمال جميع دروس المادة')+'</p></div></div><div class="unit-head-actions"><button type="button" class="unit-toggle" data-toggle-unit="comprehensive" aria-expanded="true" aria-controls="unitItems-comprehensive" title="طي أو فتح الاختبارات"><i class="fa-solid fa-chevron-up"></i></button></div></header><div class="unit-items" id="unitItems-comprehensive">'+body+'</div></section>');
 }
 $('curriculumList').innerHTML=cards.join('')||'<div class="empty-state"><span>🔎</span><h3>لا يوجد محتوى بهذا الفلتر</h3></div>';
 $$('[data-locked-quiz]').forEach(b=>b.onclick=()=>{
   toast(b.dataset.lockedQuiz==='lesson'?'أكمل الدرس المرتبط لفتح الاختبار.':b.dataset.lockedQuiz==='all'?'أكمل دروس المادة أولًا لفتح الاختبار الشامل.':'أكمل دروس هذه الوحدة أولًا لفتح الاختبار.','error');
 });
 $$('[data-toggle-unit]').forEach(btn=>btn.onclick=()=>{
   const target=$('unitItems-'+btn.dataset.toggleUnit);if(!target)return;
   const collapsed=target.classList.toggle('collapsed');
   btn.setAttribute('aria-expanded',collapsed?'false':'true');
   const icon=btn.querySelector('i');if(icon)icon.className='fa-solid '+(collapsed?'fa-chevron-down':'fa-chevron-up');
   btn.closest('.unit-card')?.classList.toggle('collapsed-unit',collapsed);
 });
}

function renderSubjectSide(c){
 const next=state.lessons.find(l=>!done(l.id))||state.lessons[0];
 if(next){$('resumeTitle').textContent=done(next.id)?'راجع أول درس':next.title||'ابدأ أول درس';$('resumeDescription').textContent=unitName(c,next.unit||1)+' • '+(next.videos?.length||0)+' فيديو';$('resumeBtn').onclick=()=>location.href=url('lesson.html',c,{id:next.id})} else $('resumeBtn').disabled=true;
 const week=Math.min(3,state.lessons.filter(l=>pLesson(l.id).completedAt&&Date.now()-pLesson(l.id).completedAt<604800000).length);
 $('weeklyProgressText').textContent=week+' من 3';$('weeklyProgressBar').style.width=(week/3*100)+'%';
 $('exploreStagesBtn').onclick=()=>openLearningExplorer();$('exploreOtherSubjectsBtn').onclick=()=>openLearningExplorer();
}

/* Aggregate content analytics without exposing student identities */
function trackContentEvent(id,eventName,score=null,questions=null,answers=null){
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
     if(questions&&answers){
       a.questionStats=a.questionStats||{};
       questions.forEach((q,i)=>{
         const index=String(q._sourceIndex??i),record=a.questionStats[index]||{};
         record.attempts=Number(record.attempts||0)+1;
         record.correct=Number(record.correct||0)+(answers[i]===Number(q.correctAnswer)?1:0);
         record.optionCounts=record.optionCounts||{};
         const chosen=String(answers[i]);
         record.optionCounts[chosen]=Number(record.optionCounts[chosen]||0)+1;
         a.questionStats[index]=record;
         if(q.questionBankId){
           db.ref('questionAnalytics/'+q.questionBankId).transaction(stat=>{
             stat=stat||{};stat.attempts=Number(stat.attempts||0)+1;stat.correct=Number(stat.correct||0)+(answers[i]===Number(q.correctAnswer)?1:0);
             stat.optionCounts=stat.optionCounts||{};stat.optionCounts[chosen]=Number(stat.optionCounts[chosen]||0)+1;stat.updatedAt=Date.now();return stat;
           }).catch(()=>{});
         }
       });
     }
   }
   a.updatedAt=Date.now();return a;
 }).catch(()=>{});
}

/* lesson */
function renderLesson(){
 const c=ctx(),quizId=params.get('quiz'); if(quizId){renderQuizOnly(c,quizId);return}
 const id=params.get('id'), lesson=state.data.lessons?.[id];
 if(!id||!lesson||lesson.isHidden){toast('الدرس غير موجود أو غير متاح.','error');setTimeout(()=>history.back(),900);return}
 state.currentLesson={...lesson,id};state.subject=subjectFor(c);filterContent(c);state.unitLessons=state.lessons.filter(l=>Number(l.unit||1)===Number(lesson.unit||1));
 trackContentEvent(id,'views');
 if(state.user) db.ref('studentProfilesV3/'+state.user.uid).update({lastLessonTitle:lesson.title||'',lastSubjectId:c.subject,lastLessonId:id,lastActiveAt:Date.now()}).catch(()=>{});
 document.title=(lesson.title||'الدرس')+' | الأكاديمية';$('lessonTitle').textContent=lesson.title||'الدرس';$('lessonMeta').textContent=unitName(c,lesson.unit||1)+' • '+state.subject.name;
 const unitIndex=state.unitLessons.findIndex(x=>x.id===id);
 if($('lessonPositionText'))$('lessonPositionText').textContent='الدرس '+(unitIndex+1)+' من '+state.unitLessons.length;
 if($('lessonVideoCount'))$('lessonVideoCount').textContent=(Array.isArray(lesson.videos)?lesson.videos.filter(v=>v?.url).length:0)+' فيديو';
 if($('lessonQuestionCount'))$('lessonQuestionCount').textContent=(Array.isArray(lesson.questions)?lesson.questions.length:0)+' سؤال';
 $('lessonBreadcrumb').innerHTML='<a href="./index.html">الرئيسية</a><i class="fa-solid fa-chevron-left"></i><a id="backToSubjectLink" href="'+url('subject.html',c)+'">'+esc(state.subject.name)+'</a><i class="fa-solid fa-chevron-left"></i><span>'+esc(lesson.title||'الدرس')+'</span>';
 renderVideo(lesson);renderExplanation(lesson);renderQuickCheck(lesson);renderFiles();renderOutline(c,lesson);renderNav(c);updateProgress(id);updateBookmarkUI(id);bindTabs();setupQuiz(c,state.currentLesson);renderLinkedLessonQuizzes(c,id);renderLessonPath();loadLessonNotes(id);
 $('markCompleteBtn').onclick=()=>markComplete(c,id);$('markCompleteHeader').onclick=()=>markComplete(c,id);
 if($('bookmarkLessonBtn')) $('bookmarkLessonBtn').onclick=()=>toggleBookmark(c,id);
}
function renderQuickCheck(lesson){
 const box=$('lessonQuickCheck');if(!box)return;
 const questions=Array.isArray(lesson.questions)?lesson.questions.filter(q=>q&&Array.isArray(q.opts)&&q.opts.length>=2):[];
 if(!questions.length){box.classList.add('hidden');return}
 const q=questions[0],letters=['أ','ب','ج','د','هـ'];
 box.classList.remove('hidden');
 box.innerHTML='<div class="quick-check-head"><div><span class="section-kicker">اختبار خاطف</span><h3>اتأكد إن الفكرة وصلت</h3><p>سؤال واحد فقط قبل التدريب الكامل.</p></div><span>⚡</span></div>'+
   '<div class="quick-check-question"><strong>'+esc(q.text||'اختر الإجابة الصحيحة')+'</strong><div class="quick-check-options">'+
   q.opts.map((o,i)=>'<button data-quick-answer="'+i+'"><span>'+(letters[i]||i+1)+'</span>'+esc(o)+'</button>').join('')+
   '</div><div class="quick-check-feedback hidden" id="quickCheckFeedback"></div></div>';
 $$('[data-quick-answer]').forEach(btn=>btn.onclick=()=>{
   const chosen=Number(btn.dataset.quickAnswer),correct=Number(q.correctAnswer);
   $$('[data-quick-answer]').forEach(x=>{
     x.disabled=true;
     const idx=Number(x.dataset.quickAnswer);
     x.classList.toggle('correct',idx===correct);
     x.classList.toggle('wrong',idx===chosen&&chosen!==correct);
   });
   const fb=$('quickCheckFeedback');fb.classList.remove('hidden');
   fb.className='quick-check-feedback '+(chosen===correct?'correct':'wrong');
   fb.innerHTML=chosen===correct
     ?'<i class="fa-solid fa-circle-check"></i><div><strong>إجابة صحيحة 👏</strong><p>ممتاز، تقدر تدخل التدريب الكامل لما تكون جاهز.</p></div>'
     :'<i class="fa-solid fa-circle-xmark"></i><div><strong>مش هي دي الإجابة.</strong><p>راجع النقطة دي سريعًا، والإجابة الصحيحة هي: '+esc(q.opts[correct]||'—')+'.</p></div>';
 });
}
function renderLinkedLessonQuizzes(c,id){
 const box=$('linkedLessonQuizzes');if(!box)return;
 const quizzes=state.quizzes.filter(q=>q.lessonId===id);
 box.classList.toggle('hidden',!quizzes.length);
 box.innerHTML=quizzes.length?'<h3><i class="fa-solid fa-file-circle-question"></i> اختبارات مرتبطة بهذا الدرس</h3>'+quizzes.map(q=>done(id)?'<a class="linked-quiz-item" href="'+url('lesson.html',c,{quiz:q.id})+'"><span>'+esc(q.name||'اختبار الدرس')+' <small>'+(q.questions?.length||0)+' سؤال</small></span><i class="fa-solid fa-arrow-left"></i></a>':'<div class="linked-quiz-item is-locked"><span>'+esc(q.name||'اختبار الدرس')+' <small>أكمل الدرس لفتح الاختبار</small></span><i class="fa-solid fa-lock"></i></div>').join(''):'';
}
function showLessonCelebration(c,id,xp=50){
 document.getElementById('lessonCelebration')?.remove();
 const index=state.lessons.findIndex(l=>l.id===id),next=state.lessons[index+1];
 const lesson=state.currentLesson,practiced=Object.values(state.profile?.quizHistory||{}).some(entry=>entry?.sourceId===id),errors=Object.keys(state.profile?.mistakeNotebook?.[id]||{}).length;
 const action=Array.isArray(lesson?.questions)&&lesson.questions.length&&!practiced?'ابدأ التدريب':errors?'راجع أخطاءك':next?'الدرس التالي':'العودة للمادة';
 const overlay=document.createElement('div');overlay.id='lessonCelebration';overlay.className='lesson-celebration';
 overlay.innerHTML='<div class="celebration-confetti"><i></i><i></i><i></i><i></i><i></i><i></i></div>'+
   '<div class="celebration-card"><button class="celebration-close" aria-label="إغلاق"><i class="fa-solid fa-xmark"></i></button><span class="celebration-trophy">🏆</span><span class="section-kicker">درس مكتمل</span><h2>أحسنت جدًا!</h2><p>أضفنا <strong>+'+xp+' XP</strong> لرصيدك، وتقدمك في المادة اتحفظ تلقائيًا.</p>'+
   '<div class="celebration-xp"><i class="fa-solid fa-bolt"></i><strong>+'+xp+' XP</strong></div>'+
   '<div class="celebration-actions"><button class="btn btn-primary" id="celebrationNext">'+action+' <i class="fa-solid fa-arrow-left"></i></button>'+ 
   '<button class="btn btn-soft" id="celebrationStay">ابقَ هنا</button></div></div>';
 document.body.appendChild(overlay);requestAnimationFrame(()=>overlay.classList.add('show'));
 const close=()=>{overlay.classList.remove('show');setTimeout(()=>overlay.remove(),220)};
 overlay.querySelector('.celebration-close').onclick=close;overlay.querySelector('#celebrationStay').onclick=close;
 overlay.querySelector('#celebrationNext').onclick=()=>{
   if(Array.isArray(lesson?.questions)&&lesson.questions.length&&!practiced){close();$('tabQuiz').click();return}
   location.href=errors?url('lesson.html',c,{id,reviewMistakes:'1'}):next?url('lesson.html',c,{id:next.id}):url('subject.html',c);
 };
}
function renderVideo(l){
 const vids=Array.isArray(l.videos)?l.videos.filter(v=>v?.url):[];
 if(!vids.length)return;
 const frameHtml=(v,i)=>{
   const src=yt(v.url);if(!src)return'';
   const teacher=v.name||('المدرس '+(i+1));
   return '<iframe src="'+src+'" title="'+esc((l.title||'الدرس')+' - شرح '+teacher)+'" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
 };
 const first=frameHtml(vids[0],0);if(first)$('videoFrame').innerHTML=first;
 $('teacherSwitcherWrap').classList.remove('hidden');$('teacherCountBadge').textContent=vids.length+' '+(vids.length===1?'مدرس':'مدرسين');
 $('teacherSwitcher').innerHTML=vids.map((v,i)=>'<button class="teacher-choice '+(i===0?'active':'')+'" data-v="'+i+'" aria-pressed="'+(i===0?'true':'false')+'"><span class="teacher-mini-avatar">'+esc((v.name||'م')[0])+'</span><strong>'+esc(v.name||('المدرس '+(i+1)))+'</strong><small>'+(i===0?'يتم العرض الآن':'اختر هذا الشرح')+'</small></button>').join('');
 $$('[data-v]').forEach(b=>b.onclick=()=>{
   const i=Number(b.dataset.v),html=frameHtml(vids[i],i);if(html)$('videoFrame').innerHTML=html;
   $$('[data-v]').forEach(x=>{
     const active=x===b;x.classList.toggle('active',active);x.setAttribute('aria-pressed',active?'true':'false');
     const small=x.querySelector('small');if(small)small.textContent=active?'يتم العرض الآن':'اختر هذا الشرح';
   });
 });
}
function renderExplanation(l){
 $('lessonContent').innerHTML=l.content?format(l.content):'<p style="color:#94a3b8">لا يوجد شرح مكتوب لهذا الدرس حتى الآن.</p>';
 if(l.imageUrl){const top=l.imagePosition==='top',w=$(top?'lessonTopImageWrap':'lessonBottomImageWrap'),im=$(top?'lessonTopImage':'lessonBottomImage');im.src=l.imageUrl;im.alt=l.title||'';w.classList.remove('hidden')}
}
function renderFiles(){
 $('lessonResources').innerHTML=state.files.length?state.files.map(f=>{
   const href=safeUrl(f.url||'');
   return '<article class="resource-item"><i class="fa-solid fa-file-pdf"></i><div><strong>'+esc(f.title||'ملف')+'</strong><small>ملف مساعد للمادة</small></div>'+
     (href?'<a href="'+esc(href)+'" target="_blank" rel="noopener noreferrer">فتح الملف <i class="fa-solid fa-arrow-up-right-from-square"></i></a>':'<span class="resource-link-disabled"><i class="fa-solid fa-ban"></i> الرابط غير متاح</span>')+
   '</article>';
 }).join(''):'<div class="empty-state"><span>📎</span><h3>لا توجد مرفقات لهذه المادة حاليًا</h3></div>';
}
function renderOutline(c,l){
 $('outlineUnitTitle').textContent=unitName(c,l.unit||1);
 const completed=state.unitLessons.filter(x=>done(x.id)).length;
 if($('outlineProgressText'))$('outlineProgressText').textContent=completed+' من '+state.unitLessons.length+' دروس مكتملة';
 $('lessonOutline').innerHTML=state.unitLessons.map((x,i)=>{
   const active=x.id===state.currentLesson.id,complete=done(x.id);
   return '<a class="outline-item '+(active?'active ':'')+(complete?'complete':'')+'" href="'+url('lesson.html',c,{id:x.id})+'" '+(active?'aria-current="page"':'')+'><span class="outline-num">'+(complete?'<i class="fa-solid fa-check"></i>':i+1)+'</span><span><strong>'+esc(x.title||'درس')+'</strong><small>'+(active?'أنت هنا':complete?'مكتمل':'متاح')+'</small></span></a>';
 }).join('');
}
function renderNav(c){
 const i=state.lessons.findIndex(l=>l.id===state.currentLesson.id),prev=state.lessons[i-1],next=state.lessons[i+1];
 $('previousLessonBtn').disabled=!prev;$('nextLessonBtn').disabled=!next;
 $('previousLessonBtn').title=prev?'الدرس السابق: '+(prev.title||'درس'):'لا يوجد درس سابق';
 $('nextLessonBtn').title=next?'الدرس التالي: '+(next.title||'درس'):'هذا آخر درس';
 $('previousLessonBtn').onclick=()=>{if(prev)location.href=url('lesson.html',c,{id:prev.id})};
 $('nextLessonBtn').onclick=()=>{if(next)location.href=url('lesson.html',c,{id:next.id})};
}
function bindTabs(){
 const tabs=$$('[data-lesson-tab]');
 const activate=b=>{
   tabs.forEach(x=>{
     const active=x===b;x.classList.toggle('active',active);x.setAttribute('aria-selected',active?'true':'false');x.tabIndex=active?0:-1;
   });
   const key=b.dataset.lessonTab;
   $('lessonExplanationPanel').classList.toggle('hidden',key!=='explanation');
   $('lessonQuizPanel').classList.toggle('hidden',key!=='quiz');
   $('lessonResourcesPanel').classList.toggle('hidden',key!=='resources');
   $('lessonNotesPanel')?.classList.toggle('hidden',key!=='notes');
 };
 tabs.forEach((b,i)=>{
   b.onclick=()=>activate(b);
   b.onkeydown=e=>{
     if(!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return;
     e.preventDefault();
     let next=i;
     if(e.key==='ArrowRight')next=(i-1+tabs.length)%tabs.length;
     if(e.key==='ArrowLeft')next=(i+1)%tabs.length;
     if(e.key==='Home')next=0;if(e.key==='End')next=tabs.length-1;
     tabs[next].focus();activate(tabs[next]);
   };
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
 const text=textarea.value.trim();status.textContent='جاري الحفظ...';window.AcademyUI?.setButtonLoading(btn,true,'حفظ');
 try{
   if(text)await db.ref('studentProfilesV3/'+state.user.uid+'/lessonNotes/'+id).set({text,updatedAt:Date.now(),title:state.currentLesson?.title||'درس'});
   else await db.ref('studentProfilesV3/'+state.user.uid+'/lessonNotes/'+id).remove();
   status.textContent=text?'تم الحفظ الآن ✅':'تم حذف الملاحظة';toast(text?'تم حفظ ملاحظاتك الخاصة.':'تم حذف الملاحظات.');
 }catch(err){console.error(err);status.textContent='تعذر الحفظ';toast('تعذر حفظ الملاحظات.','error')}
 finally{window.AcademyUI?.setButtonLoading(btn,false);if(!window.AcademyUI)btn.disabled=false}
}
function isBookmarked(id){return !!state.profile?.bookmarks?.[id]}
function updateBookmarkUI(id){
 const btn=$('bookmarkLessonBtn');if(!btn)return;
 const saved=isBookmarked(id);
 btn.innerHTML=saved?'<i class="fa-solid fa-bookmark"></i>':'<i class="fa-regular fa-bookmark"></i>';
 btn.title=saved?'إزالة من المحفوظات':'حفظ للمراجعة';
 btn.setAttribute('aria-label',saved?'إزالة الدرس من المحفوظات':'حفظ الدرس للمراجعة');
 btn.setAttribute('aria-pressed',saved?'true':'false');
 btn.style.color=saved?'#1d4ed8':'';
}
async function toggleBookmark(c,id){
 if(!state.user){toast('سجّل الدخول أولًا لحفظ الدرس.','error');return}
 const btn=$('bookmarkLessonBtn'),saved=isBookmarked(id),ref=db.ref('studentProfilesV3/'+state.user.uid+'/bookmarks/'+id);
 if(btn)btn.disabled=true;
 try{
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
 }catch(err){console.error(err);toast('تعذر تحديث المحفوظات الآن.','error')}
 finally{if(btn)btn.disabled=false}
}

function updateProgress(id){
 const complete=done(id),value=complete?100:0;
 $('lessonProgressBar').style.width=value+'%';$('lessonProgressText').textContent=complete?'أحسنت! أكملت هذا الدرس ويمكنك مراجعته في أي وقت.':'شاهد الشرح ثم حل التدريب، وبعدها علّم الدرس كمكتمل.';
 $('lessonProgressTrack')?.setAttribute('aria-valuenow',String(value));
 $('lessonStatusIcon').classList.toggle('complete',complete);$('lessonStatusIcon').innerHTML=complete?'<i class="fa-solid fa-check"></i>':'<i class="fa-regular fa-circle"></i>';
 $('markCompleteBtn').innerHTML=complete?'<i class="fa-solid fa-check"></i> تم إكمال الدرس':'<i class="fa-regular fa-circle-check"></i> تعليم الدرس كمكتمل';
 $('markCompleteBtn').disabled=complete;
 $('markCompleteHeader').setAttribute('aria-pressed',complete?'true':'false');
 $('markCompleteHeader').title=complete?'الدرس مكتمل':'تعليم كمكتمل';
}
let completingLesson=false;
async function markComplete(c,id){
 if(!state.user){toast('سجّل الدخول أولًا لحفظ تقدمك.','error');return}
 if(completingLesson||done(id))return;
 completingLesson=true;
 const btn=$('markCompleteBtn'),head=$('markCompleteHeader');
 window.AcademyUI?.setButtonLoading(btn,true,'حفظ التقدم');if(head)head.disabled=true;
 try{
   const at=Date.now(),date=localDateKey();
   const result=await db.ref('studentProfilesV3/'+state.user.uid).transaction(profile=>{
     if(!profile)return;
     if(profile.learningProgress?.[id]?.completed)return;
     profile.learningProgress=profile.learningProgress||{};
     profile.learningProgress[id]={completed:true,completedAt:at,subject:c.subject};
     profile.dailyGoals=profile.dailyGoals||{};profile.dailyGoals[date]=profile.dailyGoals[date]||{};profile.dailyGoals[date].lesson=true;
     const stats=profile.stats=profile.stats||{};
     stats.completedLessons=Number(stats.completedLessons||0)+1;stats.totalXP=Number(stats.totalXP||0)+50;stats.level=Math.floor(stats.totalXP/1000)+1;
     const pct=state.lessons.length?Math.round(state.lessons.filter(l=>profile.learningProgress[l.id]?.completed).length/state.lessons.length*100):0;
     const progress=profile.subjectProgressV3=profile.subjectProgressV3||{};
     progress[c.type]=progress[c.type]||{};progress[c.type][c.stage]=progress[c.type][c.stage]||{};
     progress[c.type][c.stage][c.grade]=progress[c.type][c.stage][c.grade]||{};progress[c.type][c.stage][c.grade][c.subject]=pct;
     if(c.type===(profile.educationType||'public')&&c.stage===profile.stage&&String(c.grade)===String(profile.grade)){
       profile.subjectProgress=profile.subjectProgress||{};profile.subjectProgress[c.subject]=pct;
     }
     Object.assign(profile,{lastLessonTitle:state.currentLesson?.title||'',lastLessonId:id,lastSubjectId:c.subject,lastActiveAt:at});
     return profile;
   });
   state.profile=result.snapshot.val()||state.profile;
   if(!result.committed){toast('هذا الدرس مكتمل بالفعل.');return}
   if(window.AcademyCore?.addLeaderboardXP){
     try{await window.AcademyCore.addLeaderboardXP(state.user.uid,state.profile.name||'طالب',50,0)}
     catch(err){console.warn('Leaderboard sync deferred',err);toast('حُفظ تقدمك؛ تعذر تحديث ترتيبك الآن.','error')}
   }
   trackContentEvent(id,'completions');renderOutline(c,state.currentLesson);renderLinkedLessonQuizzes(c,id);
   renderLessonPath();
   toast('رائع! +50 XP وتم حفظ تقدمك 🎉');window.dispatchEvent(new CustomEvent('academy:lesson-completed',{detail:{lessonId:id,subject:c.subject}}));showLessonCelebration(c,id,50);
 }catch(err){console.error(err);toast('تعذر حفظ تقدم الدرس الآن. حاول مرة أخرى.','error')}
 finally{
   completingLesson=false;window.AcademyUI?.setButtonLoading(btn,false);
   if(head)head.disabled=done(id);updateProgress(id);
 }
}
function setupQuiz(c,l){
 const qs=Array.isArray(l.questions)?l.questions:[];$('quizIntroText').textContent=qs.length?'تدريب مكوّن من '+qs.length+' سؤال على هذا الدرس.':'لا توجد أسئلة مضافة لهذا الدرس حتى الآن.';$('startQuizBtn').disabled=!qs.length;$('startQuizBtn').onclick=()=>startQuiz(qs,c,l.id);$('retryQuizBtn').onclick=()=>startQuiz(qs,c,l.id);$('retryQuizReviewBtn').onclick=()=>startQuiz(qs,c,l.id);$('reviewLessonBtn').onclick=()=>$$('[data-lesson-tab]').find(b=>b.dataset.lessonTab==='explanation')?.click();
 if(params.get('reviewMistakes')==='1'){
   const mistakes=state.profile?.mistakeNotebook?.[l.id]||{};
   const targeted=qs.map((q,i)=>({...q,_sourceIndex:i})).filter(q=>mistakes[q._sourceIndex]);
   $('quizIntroText').textContent=targeted.length?'راجع '+targeted.length+' سؤال من أخطائك في هذا الدرس.':'أحسنت! لا توجد أسئلة معلّقة للمراجعة في هذا الدرس.';
   $('startQuizBtn').disabled=!targeted.length;
   $('startQuizBtn').onclick=()=>startQuiz(targeted,c,l.id);
   $('retryQuizBtn').onclick=()=>startQuiz(targeted,c,l.id);
   $('retryQuizReviewBtn').onclick=()=>startQuiz(targeted,c,l.id);
   $('tabQuiz').click();
 }
}
function renderLessonPath(){
 const lesson=state.currentLesson,card=$('lessonPathCard');if(!lesson||!card)return;
 const history=Object.values(state.profile?.quizHistory||{}).filter(x=>x?.sourceId===lesson.id);
 const practiced=history.length>0,errors=Object.keys(state.profile?.mistakeNotebook?.[lesson.id]||{}).length;
 const complete=done(lesson.id),hasQuiz=Array.isArray(lesson.questions)&&lesson.questions.length>0;
 const steps=[['اقرأ أو شاهد الشرح',practiced||complete],[hasQuiz?'حل التدريب':'لا يوجد تدريب',!hasQuiz||practiced],['راجع الأخطاء',!hasQuiz||(practiced&&errors===0)],['انتقل للدرس التالي',complete&&(!hasQuiz||(practiced&&errors===0))]];
 $('lessonPathSteps').innerHTML=steps.map(([label,finished],i)=>'<li class="'+(finished?'complete':'pending')+'"><span>'+(finished?'<i class="fa-solid fa-check"></i>':i+1)+'</span><strong>'+label+'</strong></li>').join('');
 const action=$('lessonPathAction'),c=ctx(),next=state.lessons[state.lessons.findIndex(l=>l.id===lesson.id)+1];
 if(hasQuiz&&!practiced){action.textContent='ابدأ التدريب';action.onclick=()=>$('tabQuiz').click()}
 else if(practiced&&errors){action.textContent='تدرّب على أخطائك ('+errors+')';action.onclick=()=>location.href=url('lesson.html',c,{id:lesson.id,reviewMistakes:'1'})}
 else if(!complete){action.textContent='علّم الدرس كمكتمل';action.onclick=()=>markComplete(c,lesson.id)}
 else{action.textContent=next?'الدرس التالي':'العودة للمادة';action.onclick=()=>location.href=next?url('lesson.html',c,{id:next.id}):url('subject.html',c)}
}
function startQuiz(qs,c,sourceId){
 let ok;try{ok=window.AcademyUtils.validateQuestions(qs)}catch(err){toast(err.message,'error');return}if(!ok.length){toast('لا توجد أسئلة قابلة للتشغيل حاليًا.','error');return}
 state.quiz={questions:ok,answers:new Array(ok.length).fill(null),c,sourceId};state.quizIndex=0;$('quizIntro').classList.add('hidden');$('quizResult').classList.add('hidden');$('quizReview').classList.add('hidden');$('quizReviewList').replaceChildren();$('quizEngine').classList.remove('hidden');renderQuestion();$('quizEngine').scrollIntoView({behavior:'smooth',block:'start'});
}
function renderQuestion(){
 const qz=state.quiz,i=state.quizIndex,q=qz.questions[i],total=qz.questions.length,letters=['أ','ب','ج','د','هـ'],answer=qz.answers[i],correct=Number(q.correctAnswer),answered=answer!==null;
 $('quizProgressText').textContent='السؤال '+(i+1)+' من '+total;$('quizProgressBar').style.width=((i+1)/total*100)+'%';$('questionNumber').textContent=i+1;$('questionText').textContent=q.text||'';
 $('quizProgressTrack')?.setAttribute('aria-valuemax',String(total));$('quizProgressTrack')?.setAttribute('aria-valuenow',String(i+1));
 $('questionOptions').innerHTML=(q.opts||[]).map((o,j)=>'<button type="button" class="quiz-option-v3 '+(answered?(j===correct?'correct':j===answer?'wrong':''):'')+'" data-a="'+j+'" aria-pressed="'+(answer===j?'true':'false')+'" '+(answered?'disabled':'')+'><span class="opt-letter">'+(letters[j]||j+1)+'</span><span>'+esc(o)+'</span>'+(answered&&j===correct?'<i class="fa-solid fa-circle-check option-status-icon" aria-hidden="true"></i>':answered&&j===answer?'<i class="fa-solid fa-circle-xmark option-status-icon" aria-hidden="true"></i>':'')+'</button>').join('');
 const feedback=$('questionFeedback');feedback.classList.toggle('hidden',!answered);feedback.classList.toggle('is-correct',answered&&answer===correct);feedback.classList.toggle('is-wrong',answered&&answer!==correct);
 feedback.innerHTML=answered?(answer===correct?'<i class="fa-solid fa-circle-check" aria-hidden="true"></i><span><strong>إجابة صحيحة! أحسنت.</strong>'+(q.explanation?'<br><small>'+esc(q.explanation)+'</small>':'')+'</span>':'<i class="fa-solid fa-circle-xmark" aria-hidden="true"></i><span><strong>إجابة غير صحيحة.</strong> الإجابة الصحيحة: <strong>'+esc(q.opts[correct])+'</strong>'+(q.explanation?'<br><small>'+esc(q.explanation)+'</small>':'')+'</span>'):'';
 $$('[data-a]').forEach(b=>b.onclick=()=>{if(qz.answers[i]!==null)return;qz.answers[i]=Number(b.dataset.a);renderQuestion()});$('prevQuestionBtn').disabled=i===0;$('nextQuestionBtn').textContent=i===total-1?'عرض النتيجة':'التالي';$('nextQuestionBtn').disabled=!answered;
 $('prevQuestionBtn').onclick=()=>{if(state.quizIndex>0){state.quizIndex--;renderQuestion()}};$('nextQuestionBtn').onclick=()=>{if(qz.answers[i]===null){toast('اختر إجابة أولًا.','error');return}if(i===total-1)finishQuiz();else{state.quizIndex++;renderQuestion()}};
}
function renderQuizReview(qz){
 $('quizReviewList').innerHTML=qz.questions.map((q,i)=>{
   const chosen=qz.answers[i],correct=Number(q.correctAnswer),right=chosen===correct;
   return '<article class="quiz-review-item '+(right?'is-correct':'is-wrong')+'">'+
     '<div class="quiz-review-item-head"><span>السؤال '+(i+1)+'</span><strong><i class="fa-solid '+(right?'fa-circle-check':'fa-circle-xmark')+'" aria-hidden="true"></i> '+(right?'إجابة صحيحة':'إجابة خاطئة')+'</strong></div>'+
     '<h3>'+esc(q.text)+'</h3><p class="quiz-review-student">إجابتك: <strong>'+esc(chosen===null?'لم تجب':q.opts[chosen])+'</strong></p>'+
     '<p class="quiz-review-correct">الإجابة الصحيحة: <strong>'+esc(q.opts[correct])+'</strong></p>'+
     (q.explanation?'<p class="quiz-review-explanation"><strong>الشرح:</strong> '+esc(q.explanation)+'</p>':'')+'</article>';
 }).join('');
 $('quizReview').classList.remove('hidden');
}
async function finishQuiz(){
 const qz=state.quiz;let score=0;
 if(qz.answers.some(answer=>answer===null)){toast('أجب عن جميع الأسئلة أولًا.','error');return}
 qz.questions.forEach((q,i)=>{if(Number(qz.answers[i])===Number(q.correctAnswer))score++});
 const pct=Math.round(score/qz.questions.length*100);
 $('quizEngine').classList.add('hidden');$('quizResult').classList.remove('hidden');$('resultPercent').textContent=pct+'%';$('resultRing').style.background='conic-gradient(#10b981 '+(pct*3.6)+'deg,#e5e7eb 0deg)';
 $('resultTitle').textContent=pct>=80?'ممتاز جدًا! 🌟':pct>=60?'أداء جيد 👏':'راجع الشرح وجرّب مرة أخرى';
 $('resultMessage').textContent='أجبت عن '+score+' من '+qz.questions.length+' إجابة بشكل صحيح.';
 $('openMistakesBtn').classList.toggle('hidden',score===qz.questions.length);
 renderQuizReview(qz);
 $('quizResult').scrollIntoView({behavior:'smooth',block:'start'});
 trackContentEvent(qz.sourceId,'quiz',pct,qz.questions,qz.answers);
 if(!state.user)return;
 try{
   const attemptId=qz.attemptId||(qz.attemptId=db.ref('studentProfilesV3/'+state.user.uid+'/quizHistory').push().key),at=Date.now();
   const result=await db.ref('studentProfilesV3/'+state.user.uid).transaction(profile=>{
     if(!profile||profile.quizHistory?.[attemptId])return;
     const history=Object.values(profile.quizHistory||{}).filter(x=>x?.sourceId===qz.sourceId);
     const previous=history.length?Math.max(...history.map(x=>quizXpTarget(Number(x.score||0)))):0;
     const gained=Math.max(0,quizXpTarget(pct)-previous),quizDelta=history.length?0:1;
     profile.quizHistory=profile.quizHistory||{};
     profile.quizHistory[attemptId]={sourceId:qz.sourceId,sourceType:state.currentLesson?'lesson':'quiz',title:state.currentQuiz?.name||state.currentLesson?.title||'اختبار',subject:qz.c?.subject||'',unit:Number(state.currentQuiz?.unit||state.currentLesson?.unit||0),score:pct,correct:score,total:qz.questions.length,xp:gained,quizDelta,createdAt:at};
     profile.mistakeNotebook=profile.mistakeNotebook||{};
     const sourceMistakes=profile.mistakeNotebook[qz.sourceId]||{};
     qz.questions.forEach((q,i)=>{
       const key=String(q._sourceIndex??i);
       if(qz.answers[i]===Number(q.correctAnswer))delete sourceMistakes[key];
       else sourceMistakes[key]={text:q.text,opts:q.opts,correctAnswer:Number(q.correctAnswer),chosen:Number(qz.answers[i]),explanation:q.explanation||'',skill:q.skill||'',difficulty:Number(q.difficulty||2),questionBankId:q.questionBankId||'',sourceId:qz.sourceId,sourceType:state.currentLesson?'lesson':'quiz',title:state.currentQuiz?.name||state.currentLesson?.title||'تدريب',subject:qz.c?.subject||'',type:qz.c?.type||'',stage:qz.c?.stage||'',grade:String(qz.c?.grade||''),updatedAt:at};
     });
     if(Object.keys(sourceMistakes).length)profile.mistakeNotebook[qz.sourceId]=sourceMistakes;
     else delete profile.mistakeNotebook[qz.sourceId];
     const stats=profile.stats=profile.stats||{};
     stats.completedQuizzes=Number(stats.completedQuizzes||0)+quizDelta;stats.totalXP=Number(stats.totalXP||0)+gained;stats.level=Math.floor(stats.totalXP/1000)+1;
     const day=localDateKey();profile.dailyGoals=profile.dailyGoals||{};profile.dailyGoals[day]=profile.dailyGoals[day]||{};profile.dailyGoals[day].quiz=true;
     return profile;
   });
   state.profile=result.snapshot.val()||state.profile;
   if(state.currentLesson)renderLessonPath();
   if(!result.committed)return;
   const rec=state.profile.quizHistory[attemptId];
   if(window.AcademyCore?.addLeaderboardXP&&(rec.xp||rec.quizDelta)){
     try{await window.AcademyCore.addLeaderboardXP(state.user.uid,state.profile.name||'طالب',rec.xp,rec.quizDelta)}
     catch(err){console.warn('Leaderboard sync deferred',err)}
   }
   toast(rec.xp>0?'أضفنا +'+rec.xp+' XP لتحسن نتيجتك ✨':'تم حفظ المحاولة؛ نقاط هذا المستوى حصلت عليها بالفعل.');
   window.dispatchEvent(new CustomEvent('academy:quiz-finished',{detail:{sourceId:qz.sourceId,score:pct,correct,total:qz.questions.length}}));
 }catch(err){
   console.error(err);toast('تم حساب النتيجة لكن تعذر حفظ المحاولة الآن.','error');
 }
}
function renderQuizOnly(c,id){
 const q=state.data.quizzes?.[id];if(!q||q.isHidden||!audienceAllows(q)){toast('الاختبار غير موجود أو غير متاح لحسابك.','error');setTimeout(()=>history.back(),800);return}
 state.currentQuiz={...q,id};
 filterContent(c);
 const unit=Number(q.unit||0);
 const unlocked=q.lessonId?done(q.lessonId):unit===0?subjectIsComplete():unitIsComplete(unit);
 if(state.user && !unlocked){
   toast(q.lessonId?'أكمل الدرس المرتبط أولًا لفتح الاختبار.':unit===0?'أكمل دروس المادة أولًا لفتح الاختبار الشامل.':'أكمل دروس الوحدة أولًا لفتح الاختبار.','error');
   setTimeout(()=>location.replace(url('subject.html',c)),900);return;
 }
 state.subject=subjectFor(c);filterContent(c);$('lessonTitle').textContent=q.name||'اختبار';$('lessonMeta').textContent=(Number(q.unit||0)===0?'اختبار شامل':unitName(c,q.unit))+' • '+state.subject.name;$('lessonSubtitle').textContent='اختبر مستواك واعرف نقاط القوة وما يحتاج للمراجعة.';
 document.querySelector('.video-theater').classList.add('hidden');$('lessonExplanationPanel').classList.add('hidden');$('lessonResourcesPanel').classList.add('hidden');$('lessonTabs').innerHTML='<button class="active"><i class="fa-solid fa-bullseye"></i> الاختبار</button>';$('lessonQuizPanel').classList.remove('hidden');
 $('quizIntroTitle').textContent='اختبر معلوماتك';$('quizIntroText').textContent='الاختبار مكوّن من '+(q.questions?.length||0)+' سؤال.';$('startQuizBtn').textContent='ابدأ الاختبار';$('retryQuizBtn').textContent='إعادة الاختبار';$('retryQuizReviewBtn').textContent='إعادة الاختبار';$('startQuizBtn').disabled=!(q.questions?.length);$('startQuizBtn').onclick=()=>startQuiz(q.questions||[],c,id);$('retryQuizBtn').onclick=()=>startQuiz(q.questions||[],c,id);$('retryQuizReviewBtn').onclick=()=>startQuiz(q.questions||[],c,id);$('reviewLessonBtn').classList.add('hidden');
 if(params.get('reviewMistakes')==='1'){
   const mistakes=state.profile?.mistakeNotebook?.[id]||{};
   const targeted=(q.questions||[]).map((item,i)=>({...item,_sourceIndex:i})).filter(item=>mistakes[item._sourceIndex]);
   $('quizIntroText').textContent=targeted.length?'راجع '+targeted.length+' سؤال من أخطائك في هذا الاختبار.':'أحسنت! لا توجد أسئلة معلّقة للمراجعة في هذا الاختبار.';
   $('startQuizBtn').disabled=!targeted.length;
   $('startQuizBtn').onclick=()=>startQuiz(targeted,c,id);
   $('retryQuizBtn').onclick=()=>startQuiz(targeted,c,id);
   $('retryQuizReviewBtn').onclick=()=>startQuiz(targeted,c,id);
 }
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
 if(page==='subject')document.addEventListener('click',e=>{
   if(state.user)return;
   const target=e.target.closest('a[href*="lesson.html"], .locked-curriculum-action, #resumeBtn, #subjectPathContinueBtn');
   if(!target)return;
   e.preventDefault();e.stopImmediatePropagation();
   const destination=target.href&&new URL(target.href,location.href).pathname.endsWith('/lesson.html')?new URL(target.href,location.href).pathname+new URL(target.href,location.href).search:location.pathname+location.search;
   const login=new URL('./index.html',location.href);login.searchParams.set('auth','login');login.searchParams.set('return',destination);location.assign(login.href);
 },true);
 window.AcademyUI?.showPageLoading(page==='lesson'?'جاري تجهيز الدرس...':'جاري تجهيز المادة...');
 try{
   const requestedSubject=params.get('subject'),requestedStage=params.get('stage');
   const lessonsRef=requestedSubject?db.ref('lessons').orderByChild('subject').equalTo(requestedSubject):db.ref('lessons');
   const quizzesRef=requestedSubject?db.ref('quizzes').orderByChild('subject').equalTo(requestedSubject):db.ref('quizzes');
   const filesRef=requestedStage?db.ref('files').orderByChild('stage').equalTo(requestedStage):db.ref('files');
   const [subjectsSnap,lessonsSnap,quizzesSnap,filesSnap]=await Promise.all([
     db.ref('customSubjects').once('value'),
     lessonsRef.once('value'),
     quizzesRef.once('value'),
     filesRef.once('value')
   ]);
   state.data={customSubjects:subjectsSnap.val()||{},lessons:lessonsSnap.val()||{},quizzes:quizzesSnap.val()||{},files:filesSnap.val()||{}};
 }catch(e){toast('تعذر تحميل المحتوى الآن.','error')}
 auth.onAuthStateChanged(async user=>{
   state.user=user;
   if(page==='lesson'&&!user){const login=new URL('./index.html',location.href);login.searchParams.set('auth','login');login.searchParams.set('return',location.pathname+location.search);location.replace(login.href);return}
   try{
     await loadProfile(user);
     if(page==='subject'){renderSubject();bindLearningExplorer()}
     if(page==='lesson')renderLesson();
   }finally{window.AcademyUI?.hidePageLoading()}
 });
}
init();
})();
