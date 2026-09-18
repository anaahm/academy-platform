(() => {
'use strict';
const C=window.AcademyCore,$=id=>document.getElementById(id),$$=(s,r=document)=>[...r.querySelectorAll(s)];
let user,profile,data={customSubjects:{}},tasks={},filter='all';

const today=()=>new Date().toISOString().slice(0,10);
const weekStart=()=>{const d=new Date();const day=(d.getDay()+6)%7;d.setHours(0,0,0,0);d.setDate(d.getDate()-day);return d.getTime()};

function taskArray(){
 return Object.entries(tasks||{}).map(([id,v])=>({id,...(v||{})})).sort((a,b)=>{
   if(!!a.done!==!!b.done)return a.done?1:-1;
   return String(a.date||'').localeCompare(String(b.date||''))||(b.createdAt||0)-(a.createdAt||0);
 });
}
function currentSubjects(){return C.subjectsFor(data,profile.stage,String(profile.grade),profile.educationType)}
function renderStats(){
 const arr=taskArray(),done=arr.filter(x=>x.done).length,td=arr.filter(x=>x.date===today()&&!x.done).length;
 $('plannerTotal').textContent=arr.length;$('plannerDone').textContent=done;$('plannerToday').textContent=td;$('plannerRate').textContent=(arr.length?Math.round(done/arr.length*100):0)+'%';
 const weekDone=arr.filter(x=>x.done&&Number(x.completedAt||0)>=weekStart()).length,cap=Math.min(5,weekDone);
 $('plannerWeekDone').textContent=cap+'/5';$('plannerWeekRing').style.background='conic-gradient(#10b981 '+(cap/5*360)+'deg,#e5e7eb 0deg)';
}
function filteredTasks(){
 const arr=taskArray();
 if(filter==='today')return arr.filter(x=>x.date===today());
 if(filter==='pending')return arr.filter(x=>!x.done);
 if(filter==='done')return arr.filter(x=>x.done);
 return arr;
}
function priorityLabel(p){return p==='urgent'?'عاجلة':p==='high'?'مهمة':'عادية'}
function renderTasks(){
 const arr=filteredTasks();
 $('plannerTaskList').innerHTML=arr.length?arr.map(t=>{
   const sub=currentSubjects().find(s=>s.id===t.subject);
   return '<article class="planner-task '+(t.done?'done':'')+'"><button class="planner-check" data-toggle-task="'+t.id+'"><i class="fa-solid '+(t.done?'fa-check':'fa-circle')+'"></i></button><div class="planner-task-copy"><h3>'+C.esc(t.title||'مهمة')+'</h3><div class="planner-task-meta"><span>'+(sub?C.esc(sub.emoji+' '+sub.name):'📚 مادة')+'</span><span><i class="fa-regular fa-calendar"></i> '+C.esc(t.date||'')+'</span><span><i class="fa-regular fa-clock"></i> '+Number(t.duration||30)+' دقيقة</span><span class="priority '+C.esc(t.priority||'normal')+'">'+priorityLabel(t.priority)+'</span></div></div><button class="planner-delete" data-delete-task="'+t.id+'"><i class="fa-solid fa-trash"></i></button></article>';
 }).join(''):'<div class="feature-empty"><span>🗒️</span><h3>مفيش مهام في القسم ده</h3><p>أضف مهمة صغيرة وابدأ خطوة بخطوة.</p></div>';
 $$('[data-toggle-task]').forEach(b=>b.onclick=()=>toggleTask(b.dataset.toggleTask));
 $$('[data-delete-task]').forEach(b=>b.onclick=()=>removeTask(b.dataset.deleteTask));
}
function renderSuggestion(){
 const subjects=currentSubjects(),sp=profile.subjectProgress||{};
 const weak=[...subjects].sort((a,b)=>Number(sp[a.id]||0)-Number(sp[b.id]||0))[0];
 const box=$('plannerSuggestion');
 if(!weak){box.innerHTML='<p>ابدأ بإضافة أول مهمة مذاكرة.</p>';return}
 const pct=Number(sp[weak.id]||0);
 box.innerHTML='<span class="planner-suggest-emoji">'+C.esc(weak.emoji||'📚')+'</span><strong>'+C.esc(weak.name)+'</strong><p>تقدمك الحالي '+pct+'%. خصص 30 دقيقة اليوم لمراجعة درس واحد فيها.</p><button class="btn btn-soft btn-block" id="useSuggestion">أضفها للخطة</button>';
 $('useSuggestion').onclick=()=>{$('plannerTitle').value='مراجعة درس في '+weak.name;$('plannerSubject').value=weak.id;$('plannerDate').value=today();$('plannerDuration').value='30';window.scrollTo({top:0,behavior:'smooth'})};
}
async function toggleTask(id){
 const t=tasks[id];if(!t)return;
 const done=!t.done;await C.db.ref('studentProfilesV3/'+user.uid+'/studyPlanner/'+id).update({done,completedAt:done?Date.now():null});
}
async function removeTask(id){const ok=await window.AcademyUI.confirm({title:'حذف المهمة؟',message:'سيتم حذف المهمة من مخطط المذاكرة الخاص بك.',tone:'danger',acceptText:'حذف المهمة'});if(ok)await C.db.ref('studentProfilesV3/'+user.uid+'/studyPlanner/'+id).remove()}
$('plannerForm').onsubmit=async e=>{
 e.preventDefault();
 const payload={title:$('plannerTitle').value.trim(),subject:$('plannerSubject').value,date:$('plannerDate').value,duration:Number($('plannerDuration').value||30),priority:$('plannerPriority').value,done:false,createdAt:Date.now()};
 if(!payload.title||!payload.date)return;
 await C.db.ref('studentProfilesV3/'+user.uid+'/studyPlanner').push(payload);e.target.reset();$('plannerDate').value=today();C.toast('تمت إضافة المهمة للخطة ✅');
};
$$('[data-planner-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.plannerFilter;$$('[data-planner-filter]').forEach(x=>x.classList.toggle('active',x===b));renderTasks()});

(async()=>{
 ({user,profile}=await C.requireStudent());$('pageAvatar').textContent=C.initials(profile.name||user.displayName||'طالب');
 const s=await C.db.ref('customSubjects').once('value');data.customSubjects=s.val()||{};
 $('plannerSubject').innerHTML=currentSubjects().map(s=>'<option value="'+C.esc(s.id)+'">'+C.esc(s.name)+'</option>').join('');
 $('plannerDate').value=today();
 C.db.ref('studentProfilesV3/'+user.uid+'/studyPlanner').on('value',snap=>{tasks=snap.val()||{};renderStats();renderTasks();renderSuggestion()});
})();
})();