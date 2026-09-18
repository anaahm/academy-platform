(() => {
'use strict';

const cfg=window.ACADEMY_FIREBASE_CONFIG;
if(!cfg) throw new Error('Firebase config missing');
if(!firebase.apps.length) firebase.initializeApp(cfg);
const db=firebase.database();
const $=id=>document.getElementById(id), $$=(s,r=document)=>[...r.querySelectorAll(s)];

let root={},allResults=[],activeType='all';
const stageNames={primary:'ابتدائي',prep:'إعدادي',sec:'ثانوي'};
const defaultSubjectNames={arabic:'اللغة العربية',math:'الرياضيات',science:'العلوم',english:'اللغة الإنجليزية',social:'الدراسات الاجتماعية',religion:'التربية الدينية',computer:'الحاسب الآلي',physics:'الفيزياء',chemistry:'الكيمياء',biology:'الأحياء',history:'التاريخ',geography:'الجغرافيا'};

const esc=(v='')=>String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const normalize=(v='')=>String(v).toLowerCase().normalize('NFKD').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
const safeUrl=(u='')=>{try{const x=new URL(u);return ['http:','https:'].includes(x.protocol)?x.href:'#'}catch{return'#'}};

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
function buildIndex(){
 const items=[];
 Object.entries(root.lessons||{}).forEach(([id,l])=>{
   if(!l||l.isHidden)return;
   const subject=subjectName(l.subject,l.stage,String(l.grade),l.type);
   items.push({kind:'lesson',id,title:l.title||'درس',description:(l.content||'').replace(/[#*:_-]/g,' ').slice(0,180),subject,type:l.type,stage:l.stage,grade:l.grade,search:[l.title,l.content,subject].join(' '),href:lessonLink({id,...l})});
 });
 Object.entries(root.quizzes||{}).forEach(([id,q])=>{
   if(!q||q.isHidden)return;
   const subject=subjectName(q.subject,q.stage,String(q.grade),q.type);
   items.push({kind:'quiz',id,title:q.name||'اختبار',description:'اختبار يحتوي على '+(q.questions?.length||0)+' سؤال',subject,type:q.type,stage:q.stage,grade:q.grade,search:[q.name,subject,'اختبار',q.questions?.map(x=>x.text).join(' ')].join(' '),href:quizLink({id,...q})});
 });
 Object.entries(root.files||{}).forEach(([id,f])=>{
   if(!f)return;
   const subject=subjectName(f.subject,f.stage,String(f.grade),f.type);
   items.push({kind:'file',id,title:f.title||'ملف',description:'ملف أو مرجع مساعد',subject,type:f.type,stage:f.stage,grade:f.grade,search:[f.title,subject,'ملف pdf مذكرة'].join(' '),href:safeUrl(f.url),external:true});
 });
 allResults=items;
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
function render(){
 const q=$('searchInput').value.trim();
 if(!q){
   $('searchResults').classList.add('hidden');$('searchEmpty').classList.remove('hidden');$('resultsTitle').textContent='ابدأ بالبحث';$('resultsMeta').textContent='0 نتيجة';
   ['countAll','countLessons','countQuizzes','countFiles'].forEach(id=>$(id).textContent='0');return;
 }
 const c=countsForQuery();
 $('countAll').textContent=c.all;$('countLessons').textContent=c.lesson;$('countQuizzes').textContent=c.quiz;$('countFiles').textContent=c.file;
 const items=filtered();$('resultsTitle').textContent='نتائج البحث عن «'+q+'»';$('resultsMeta').textContent=items.length+' نتيجة';
 if(!items.length){
   $('searchResults').classList.add('hidden');$('searchEmpty').classList.remove('hidden');$('searchEmpty').innerHTML='<span>🤔</span><h3>ملقيناش نتيجة مطابقة</h3><p>جرّب كلمة أقصر أو اسم المادة بدل اسم الدرس بالكامل.</p>';return;
 }
 $('searchEmpty').classList.add('hidden');$('searchResults').classList.remove('hidden');
 $('searchResults').innerHTML=items.map(x=>'<a class="search-result-card" href="'+esc(x.href)+'" '+(x.external?'target="_blank" rel="noopener"':'')+'><span class="search-result-icon '+x.kind+'"><i class="fa-solid '+icon(x.kind)+'"></i></span><div><h3>'+esc(x.title)+'</h3><p>'+esc(x.description||'')+'</p><div class="search-result-tags"><span>'+kindLabel(x.kind)+'</span><span>'+esc(x.subject)+'</span><span>'+esc(x.type==='azhar'?'أزهر':'تعليم عام')+'</span><span>'+esc(stageNames[x.stage]||x.stage||'')+' • صف '+esc(x.grade||'-')+'</span></div></div><span class="search-result-open"><i class="fa-solid fa-arrow-left"></i></span></a>').join('');
}
function doSearch(push=true){
 const q=$('searchInput').value.trim();
 if(push){const u=new URL(location.href);if(q)u.searchParams.set('q',q);else u.searchParams.delete('q');history.replaceState({},'',u)}
 render();
}
$('searchForm').onsubmit=e=>{e.preventDefault();doSearch()};
$$('[data-suggest]').forEach(b=>b.onclick=()=>{$('searchInput').value=b.dataset.suggest;doSearch()});
$$('[data-search-type]').forEach(b=>b.onclick=()=>{activeType=b.dataset.searchType;$$('[data-search-type]').forEach(x=>x.classList.toggle('active',x===b));render()});
$('filterEducation').onchange=render;$('filterStage').onchange=render;

async function init(){
 $('searchLoading').classList.remove('hidden');$('searchEmpty').classList.add('hidden');
 try{
   const [subjectsSnap,lessonsSnap,quizzesSnap,filesSnap]=await Promise.all([
     db.ref('customSubjects').once('value'),
     db.ref('lessons').once('value'),
     db.ref('quizzes').once('value'),
     db.ref('files').once('value')
   ]);
   root={customSubjects:subjectsSnap.val()||{},lessons:lessonsSnap.val()||{},quizzes:quizzesSnap.val()||{},files:filesSnap.val()||{}};
   buildIndex();
 }
 catch(e){console.error(e);$('searchEmpty').classList.remove('hidden');$('searchEmpty').innerHTML='<span>⚠️</span><h3>تعذر تحميل البحث</h3><p>جرّب تحديث الصفحة بعد لحظات.</p>';return}
 finally{$('searchLoading').classList.add('hidden')}
 const q=new URLSearchParams(location.search).get('q')||'';$('searchInput').value=q;
 if(q)render();else $('searchEmpty').classList.remove('hidden');
}
init();
})();