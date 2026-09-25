(() => {
'use strict';

const cfg=window.ACADEMY_FIREBASE_CONFIG;
if(!cfg)throw new Error('Firebase config missing');
if(!firebase.apps.length)firebase.initializeApp(cfg);
const db=firebase.database();
const $=id=>document.getElementById(id),$$=(s,r=document)=>[...r.querySelectorAll(s)];

let root={customSubjects:{}},allResults=[],activeType='all',activeScope='',loadToken=0;
const indexCache=new Map();
const stageNames={primary:'ابتدائي',prep:'إعدادي',sec:'ثانوي'};
const defaultSubjectNames={arabic:'اللغة العربية',math:'الرياضيات',science:'العلوم',english:'اللغة الإنجليزية',social:'الدراسات الاجتماعية',religion:'التربية الدينية',computer:'الحاسب الآلي',physics:'الفيزياء',chemistry:'الكيمياء',biology:'الأحياء',history:'التاريخ',geography:'الجغرافيا'};

const esc=(v='')=>String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const normalize=(v='')=>String(v).toLowerCase().normalize('NFKD').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
const safeUrl=(u='')=>window.AcademyUtils.safeUrl(u);

function subjectName(id,stage,grade,type){
 const custom=root.customSubjects?.[stage]?.[grade],arr=Array.isArray(custom)?custom:Object.values(custom||{});
 return arr.find(s=>s?.id===id&&(!s.type||s.type===type))?.name||defaultSubjectNames[id]||id||'مادة';
}
function lessonLink(x){
 const q=new URLSearchParams({type:x.type||'public',stage:x.stage||'prep',grade:String(x.grade||1),subject:x.subject||'',id:x.id});
 return './lesson.html?'+q.toString();
}
function quizLink(x){
 const q=new URLSearchParams({type:x.type||'public',stage:x.stage||'prep',grade:String(x.grade||1),subject:x.subject||'',quiz:x.id});
 return './lesson.html?'+q.toString();
}
function makeIndex(data){
 const items=[];
 Object.entries(data.lessons||{}).forEach(([id,l])=>{
   if(!l||l.isHidden)return;
   const subject=subjectName(l.subject,l.stage,String(l.grade),l.type);
   const plain=String(l.content||'').replace(/<[^>]*>/g,' ').replace(/[#*:_-]/g,' ');
   items.push({kind:'lesson',id,title:l.title||'درس',description:plain.slice(0,180),subject,type:l.type,stage:l.stage,grade:l.grade,search:[l.title,plain,subject].join(' '),href:lessonLink({id,...l})});
 });
 Object.entries(data.quizzes||{}).forEach(([id,q])=>{
   if(!q||q.isHidden)return;
   const subject=subjectName(q.subject,q.stage,String(q.grade),q.type);
   items.push({kind:'quiz',id,title:q.name||'اختبار',description:'اختبار يحتوي على '+(q.questions?.length||0)+' سؤال',subject,type:q.type,stage:q.stage,grade:q.grade,search:[q.name,subject,'اختبار',(q.questions||[]).map(x=>x?.text||'').join(' ')].join(' '),href:quizLink({id,...q})});
 });
 Object.entries(data.files||{}).forEach(([id,f])=>{
   if(!f||f.isHidden)return;
   const subject=subjectName(f.subject,f.stage,String(f.grade),f.type),href=safeUrl(f.url);
   items.push({kind:'file',id,title:f.title||'ملف',description:'ملف أو مرجع مساعد',subject,type:f.type,stage:f.stage,grade:f.grade,search:[f.title,subject,'ملف pdf مذكرة'].join(' '),href,external:!!href});
 });
 return items;
}
async function fetchIndex(stage=''){
 const key=stage||'all';
 if(indexCache.has(key))return indexCache.get(key);
 if(key!=='all'&&indexCache.has('all')){
   const all=await indexCache.get('all');
   const subset=all.filter(x=>x.stage===stage);indexCache.set(key,Promise.resolve(subset));return subset;
 }
 const promise=(async()=>{
   const get=path=>stage?db.ref(path).orderByChild('stage').equalTo(stage).once('value'):db.ref(path).once('value');
   const [lessonsSnap,quizzesSnap,filesSnap]=await Promise.all([get('lessons'),get('quizzes'),get('files')]);
   return makeIndex({lessons:lessonsSnap.val()||{},quizzes:quizzesSnap.val()||{},files:filesSnap.val()||{}});
 })();
 indexCache.set(key,promise);
 try{return await promise}catch(err){indexCache.delete(key);throw err}
}
function scoreItem(item,q){
 const nq=normalize(q),title=normalize(item.title),subject=normalize(item.subject),full=normalize(item.search);
 if(!nq)return 0;
 let score=0;
 if(title===nq)score+=100;
 if(title.startsWith(nq))score+=70;
 if(title.includes(nq))score+=50;
 if(subject.includes(nq))score+=35;
 nq.split(' ').filter(Boolean).forEach(w=>{if(title.includes(w))score+=16;if(subject.includes(w))score+=10;if(full.includes(w))score+=4});
 return score;
}
function filtered(){
 const q=$('searchInput').value.trim(),edu=$('filterEducation').value,stage=$('filterStage').value;
 return allResults.map(x=>({...x,score:scoreItem(x,q)})).filter(x=>x.score>0&&(activeType==='all'||x.kind===activeType)&&(!edu||x.type===edu)&&(!stage||x.stage===stage)).sort((a,b)=>b.score-a.score);
}
function countsForQuery(){
 const q=$('searchInput').value.trim(),edu=$('filterEducation').value,stage=$('filterStage').value;
 const base=allResults.map(x=>({...x,score:scoreItem(x,q)})).filter(x=>x.score>0&&(!edu||x.type===edu)&&(!stage||x.stage===stage));
 return {all:base.length,lesson:base.filter(x=>x.kind==='lesson').length,quiz:base.filter(x=>x.kind==='quiz').length,file:base.filter(x=>x.kind==='file').length};
}
function kindLabel(k){return k==='lesson'?'درس':k==='quiz'?'اختبار':'ملف'}
function icon(k){return k==='lesson'?'fa-circle-play':k==='quiz'?'fa-file-circle-question':'fa-file-pdf'}
function resultHtml(x){
 const inner='<span class="search-result-icon '+x.kind+'"><i class="fa-solid '+icon(x.kind)+'"></i></span><div><h3>'+esc(x.title)+'</h3><p>'+esc(x.description||'')+'</p><div class="search-result-tags"><span>'+kindLabel(x.kind)+'</span><span>'+esc(x.subject)+'</span><span>'+esc(x.type==='azhar'?'أزهر':'تعليم عام')+'</span><span>'+esc(stageNames[x.stage]||x.stage||'')+' • صف '+esc(x.grade||'-')+'</span></div></div><span class="search-result-open"><i class="fa-solid '+(x.href?'fa-arrow-left':'fa-ban')+'"></i></span>';
 if(!x.href)return '<article class="search-result-card disabled" aria-disabled="true">'+inner+'</article>';
 return '<a class="search-result-card" href="'+esc(x.href)+'" '+(x.external?'target="_blank" rel="noopener noreferrer"':'')+'>'+inner+'</a>';
}
function resetCounts(){['countAll','countLessons','countQuizzes','countFiles'].forEach(id=>$(id).textContent='0')}
function render(){
 const q=$('searchInput').value.trim();
 if(!q){
   $('searchResults').classList.add('hidden');$('searchEmpty').classList.remove('hidden');$('resultsTitle').textContent='ابدأ بالبحث';$('resultsMeta').textContent='0 نتيجة';resetCounts();return;
 }
 const c=countsForQuery();
 $('countAll').textContent=c.all;$('countLessons').textContent=c.lesson;$('countQuizzes').textContent=c.quiz;$('countFiles').textContent=c.file;
 const items=filtered();$('resultsTitle').textContent='نتائج البحث عن «'+q+'»';$('resultsMeta').textContent=items.length+' نتيجة';
 if(!items.length){
   $('searchResults').classList.add('hidden');$('searchEmpty').classList.remove('hidden');$('searchEmpty').innerHTML='<span>🤔</span><h3>ملقيناش نتيجة مطابقة</h3><p>جرّب كلمة أقصر أو اسم المادة بدل اسم الدرس بالكامل.</p>';return;
 }
 $('searchEmpty').classList.add('hidden');$('searchResults').classList.remove('hidden');
 $('searchResults').innerHTML=items.slice(0,100).map(resultHtml).join('');
}
async function ensureCurrentIndex(){
 const stage=$('filterStage').value||'',token=++loadToken;
 if(activeScope===stage&&indexCache.has(stage||'all'))return true;
 $('searchLoading').classList.remove('hidden');$('searchEmpty').classList.add('hidden');
 try{
   const items=await fetchIndex(stage);
   if(token!==loadToken)return false;
   allResults=items;activeScope=stage;return true;
 }catch(err){
   console.error(err);
   if(token===loadToken){
     $('searchResults').classList.add('hidden');$('searchEmpty').classList.remove('hidden');
     $('searchEmpty').innerHTML='<span>⚠️</span><h3>تعذر تحميل البحث</h3><p>تحقق من الاتصال ثم حاول مرة أخرى.</p>';
   }
   return false;
 }finally{
   if(token===loadToken)$('searchLoading').classList.add('hidden');
 }
}
async function doSearch(push=true){
 const q=$('searchInput').value.trim();
 if(push){
   const u=new URL(location.href);
   if(q)u.searchParams.set('q',q);else u.searchParams.delete('q');
   const stage=$('filterStage').value;if(stage)u.searchParams.set('stage',stage);else u.searchParams.delete('stage');
   history.replaceState({},'',u);
 }
 if(!q){render();return}
 const ok=await ensureCurrentIndex();if(ok)render();
}
$('searchForm').onsubmit=e=>{e.preventDefault();doSearch()};
$$('[data-suggest]').forEach(b=>b.onclick=()=>{$('searchInput').value=b.dataset.suggest;doSearch()});
$$('[data-search-type]').forEach(b=>b.onclick=()=>{
 activeType=b.dataset.searchType;
 $$('[data-search-type]').forEach(x=>{const active=x===b;x.classList.toggle('active',active);x.setAttribute('aria-pressed',active?'true':'false')});
 render();
});
$('filterEducation').onchange=()=>{if($('searchInput').value.trim())render()};
$('filterStage').onchange=()=>{if($('searchInput').value.trim())doSearch(false)};

(async function init(){
 window.AcademyUI?.showPageLoading('جاري تجهيز البحث...');
 try{
   const subjectsSnap=await db.ref('customSubjects').once('value');
   root.customSubjects=subjectsSnap.val()||{};
   const params=new URLSearchParams(location.search),q=params.get('q')||'',stage=params.get('stage')||'';
   $('searchInput').value=q;
   if(['primary','prep','sec'].includes(stage))$('filterStage').value=stage;
   if(q)await doSearch(false);else $('searchEmpty').classList.remove('hidden');
 }catch(err){
   console.error(err);$('searchEmpty').classList.remove('hidden');
   $('searchEmpty').innerHTML='<span>⚠️</span><h3>تعذر تجهيز البحث</h3><p>جرّب تحديث الصفحة بعد لحظات.</p>';
 }finally{window.AcademyUI?.hidePageLoading()}
})();
})();
