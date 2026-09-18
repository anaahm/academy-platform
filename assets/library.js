(() => {
'use strict';
const C=window.AcademyCore,$=id=>document.getElementById(id),$$=(s,r=document)=>[...r.querySelectorAll(s)];
let user,profile,data={customSubjects:{},files:{}},scope='mine';

function files(){
 const q=$('librarySearch').value.trim().toLowerCase(),subject=$('librarySubjectFilter').value;
 return Object.entries(data.files||{}).map(([id,v])=>({id,...v})).filter(f=>{
   const mine=f.type===profile.educationType&&f.stage===profile.stage&&String(f.grade)===String(profile.grade);
   if(scope==='mine'&&!mine)return false;
   if(subject&&f.subject!==subject)return false;
   if(q&&!(f.title||'').toLowerCase().includes(q))return false;
   return true;
 }).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
}
function renderFilters(){
 const subs=C.subjectsFor(data,profile.stage,String(profile.grade),profile.educationType);
 $('librarySubjectFilter').innerHTML='<option value="">كل المواد</option>'+subs.map(s=>'<option value="'+C.esc(s.id)+'">'+C.esc(s.name)+'</option>').join('');
}
function render(){
 const list=files(),mineAll=Object.entries(data.files||{}).map(([id,v])=>({id,...v})).filter(f=>scope==='all'||(f.type===profile.educationType&&f.stage===profile.stage&&String(f.grade)===String(profile.grade)));
 $('libraryTotal').textContent=mineAll.length;$('librarySubjects').textContent=new Set(mineAll.map(f=>f.subject).filter(Boolean)).size;$('libraryStage').textContent=C.stageLabel(profile.stage).replace('المرحلة ','');$('libraryVisible').textContent=list.length;
 $('libraryGrid').innerHTML=list.length?list.map(f=>{
   const sub=C.subjectName(data,f.subject,f.stage,String(f.grade),f.type);
   return '<article class="library-card"><span class="library-icon"><i class="fa-solid fa-file-pdf"></i></span><div><h3>'+C.esc(f.title||'ملف')+'</h3><p>'+C.esc(sub)+' • '+C.esc(C.typeLabel(f.type))+' • '+C.esc(C.gradeLabel(f.stage,f.grade))+'</p></div><a class="library-open" href="'+C.safeUrl(f.url)+'" target="_blank" rel="noopener" title="فتح الملف"><i class="fa-solid fa-arrow-up-right-from-square"></i></a></article>';
 }).join(''):'<div class="feature-empty"><span>📂</span><h3>لا توجد ملفات مطابقة</h3><p>جرّب إزالة الفلتر أو اختر كل المراحل.</p></div>';
}
$$('[data-library-scope]').forEach(b=>b.onclick=()=>{scope=b.dataset.libraryScope;$$('[data-library-scope]').forEach(x=>x.classList.toggle('active',x===b));render()});
$('librarySubjectFilter').onchange=render;$('librarySearch').oninput=render;

(async()=>{
 ({user,profile}=await C.requireStudent());$('pageAvatar').textContent=C.initials(profile.name||user.displayName||'طالب');
 const [s,f]=await Promise.all([C.db.ref('customSubjects').once('value'),C.db.ref('files').once('value')]);data={customSubjects:s.val()||{},files:f.val()||{}};renderFilters();render();
})();
})();