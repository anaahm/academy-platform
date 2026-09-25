(() => {
'use strict';
const C=window.AcademyCore,$=id=>document.getElementById(id),$$=(s,r=document)=>[...r.querySelectorAll(s)];
let user,profile,data={customSubjects:{},files:{}},scope='mine',allLoaded=false;

function allFiles(){return Object.entries(data.files||{}).map(([id,v])=>({id,...(v||{})}))}
function mineFile(f){
 return f.type===profile.educationType&&f.stage===profile.stage&&String(f.grade)===String(profile.grade);
}
function visibleBase(){return scope==='mine'?allFiles().filter(mineFile):allFiles()}
function files(){
 const q=$('librarySearch').value.trim().toLowerCase(),subject=$('librarySubjectFilter').value;
 return visibleBase().filter(f=>{
   if(f.isHidden===true)return false;
   if(subject&&f.subject!==subject)return false;
   const sub=C.subjectName(data,f.subject,f.stage,String(f.grade),f.type);
   if(q&&!((f.title||'')+' '+sub).toLowerCase().includes(q))return false;
   return true;
 }).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
}
function renderFilters(){
 const current=$('librarySubjectFilter').value;
 let options=[];
 if(scope==='mine'){
   options=C.subjectsFor(data,profile.stage,String(profile.grade),profile.educationType).map(s=>({id:s.id,name:s.name}));
 }else{
   const seen=new Map();
   visibleBase().forEach(f=>{
     if(!f.subject||seen.has(f.subject))return;
     seen.set(f.subject,C.subjectName(data,f.subject,f.stage,String(f.grade),f.type)||f.subject);
   });
   options=[...seen].map(([id,name])=>({id,name})).sort((a,b)=>a.name.localeCompare(b.name,'ar'));
 }
 $('librarySubjectFilter').innerHTML='<option value="">كل المواد</option>'+options.map(s=>'<option value="'+C.esc(s.id)+'">'+C.esc(s.name)+'</option>').join('');
 if(options.some(s=>s.id===current))$('librarySubjectFilter').value=current;
}
function render(){
 const list=files(),base=visibleBase().filter(f=>f.isHidden!==true);
 $('libraryTotal').textContent=base.length;
 $('librarySubjects').textContent=new Set(base.map(f=>f.subject).filter(Boolean)).size;
 $('libraryStage').textContent=scope==='mine'?C.stageLabel(profile.stage).replace('المرحلة ',''):'كل المراحل';
 $('libraryVisible').textContent=list.length;
 $('libraryGrid').innerHTML=list.length?list.map(f=>{
   const sub=C.subjectName(data,f.subject,f.stage,String(f.grade),f.type);
   const safe=C.safeUrl(f.url);
   return '<article class="library-card">'+
     '<span class="library-icon"><i class="fa-solid fa-file-pdf"></i></span>'+
     '<div class="library-card-copy"><h3>'+C.esc(f.title||'ملف')+'</h3><p>'+C.esc(sub)+' • '+C.esc(C.typeLabel(f.type))+' • '+C.esc(C.gradeLabel(f.stage,f.grade))+'</p></div>'+
     (safe&&safe!=='#'?'<a class="library-open" href="'+C.esc(safe)+'" target="_blank" rel="noopener noreferrer" aria-label="فتح '+C.esc(f.title||'الملف')+'"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>':'<span class="library-open disabled" title="الرابط غير متاح"><i class="fa-solid fa-ban"></i></span>')+
   '</article>';
 }).join(''):'<div class="feature-empty"><span>📂</span><h3>لا توجد ملفات مطابقة</h3><p>جرّب إزالة الفلتر أو اختر نطاقًا آخر.</p></div>';
}
async function loadAllFiles(){
 if(allLoaded)return true;
 window.AcademyUI?.showPageLoading('جاري تحميل ملفات كل المراحل...');
 try{
   const snap=await C.db.ref('files').once('value');
   data.files=snap.val()||{};allLoaded=true;return true;
 }catch(err){
   console.error(err);C.toast('تعذر تحميل كل المراحل الآن.','error');return false;
 }finally{window.AcademyUI?.hidePageLoading()}
}
$$('[data-library-scope]').forEach(b=>b.onclick=async()=>{
 const next=b.dataset.libraryScope;
 if(next==='all'&&!allLoaded){
   const ok=await loadAllFiles();if(!ok)return;
 }
 scope=next;
 $$('[data-library-scope]').forEach(x=>{const active=x===b;x.classList.toggle('active',active);x.setAttribute('aria-selected',active?'true':'false')});
 renderFilters();render();
});
$('librarySubjectFilter').onchange=render;
$('librarySearch').oninput=render;

(async()=>{
 window.AcademyUI?.showPageLoading('جاري تحميل مكتبتك التعليمية...');
 try{
   ({user,profile}=await C.requireStudent());$('pageAvatar').textContent=C.initials(profile.name||user.displayName||'طالب');
   const [s,f]=await Promise.all([
     C.db.ref('customSubjects').once('value'),
     C.db.ref('files').orderByChild('stage').equalTo(profile.stage).once('value')
   ]);
   data={customSubjects:s.val()||{},files:f.val()||{}};
   renderFilters();render();
 }catch(err){
   console.error(err);C.toast('تعذر تحميل المكتبة الآن.','error');
   $('libraryGrid').innerHTML=window.AcademyUI?.errorStateHtml('تعذر تحميل المكتبة','تحقق من الإنترنت ثم حاول مرة أخرى.','<button class="btn btn-primary" onclick="location.reload()">إعادة المحاولة</button>')||'';
 }finally{window.AcademyUI?.hidePageLoading()}
})();
})();
