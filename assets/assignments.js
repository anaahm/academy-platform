(() => {
'use strict';
const C=window.AcademyCore,$=id=>document.getElementById(id),$$=(s,r=document)=>[...r.querySelectorAll(s)];
let user,profile,assignments=[],submissions={},filter='all',activeAssignment=null;

function matching(){
  return assignments.filter(a=>!a.isHidden&&a.type===profile.educationType&&a.stage===profile.stage&&String(a.grade)===String(profile.grade)).sort((a,b)=>Number(a.dueAt||Infinity)-Number(b.dueAt||Infinity));
}
function statusFor(a){
  const s=submissions[a.id];
  if(s?.status==='graded')return'graded';
  if(s)return'submitted';
  return'pending';
}
function statusLabel(s){return s==='graded'?'تم التصحيح':s==='submitted'?'تم التسليم':'مطلوب'}
function dueText(ts){
  if(!ts)return'بدون موعد نهائي';
  const d=new Date(ts),diff=ts-Date.now(),days=Math.ceil(diff/86400000);
  if(diff<0)return'انتهى الموعد';
  if(days===0)return'اليوم';
  if(days===1)return'غدًا';
  return d.toLocaleDateString('ar-EG',{day:'numeric',month:'short'});
}
function subjectName(id){
  return C.subjectName({customSubjects:{}},id,profile.stage,String(profile.grade),profile.educationType)||id||'مادة';
}
function filtered(){
  const arr=matching();
  return filter==='all'?arr:arr.filter(a=>statusFor(a)===filter);
}
function renderStats(){
  const arr=matching(),subs=arr.map(a=>submissions[a.id]).filter(Boolean),graded=subs.filter(s=>s.status==='graded'&&Number.isFinite(Number(s.score)));
  $('assignmentTotal').textContent=arr.length;
  $('assignmentPending').textContent=arr.filter(a=>!submissions[a.id]).length;
  $('assignmentSubmitted').textContent=subs.length;
  $('assignmentAverage').textContent=graded.length?Math.round(graded.reduce((n,s)=>n+Number(s.score||0),0)/graded.length)+'%':'—';
}
function render(){
  renderStats();
  const arr=filtered();
  $('assignmentList').innerHTML=arr.length?arr.map(a=>{
    const s=submissions[a.id],st=statusFor(a),overdue=!s&&a.dueAt&&Date.now()>Number(a.dueAt);
    return '<article class="assignment-card '+st+' '+(overdue?'overdue':'')+'"><div class="assignment-icon"><i class="fa-solid '+(st==='graded'?'fa-star':st==='submitted'?'fa-paper-plane':'fa-clipboard-list')+'"></i></div><div class="assignment-copy"><div class="assignment-topline"><span class="status-pill '+(st==='graded'?'approved':st==='submitted'?'info':'pending')+'">'+statusLabel(st)+'</span><span>'+C.esc(subjectName(a.subject))+'</span></div><h3>'+C.esc(a.title||'واجب')+'</h3><p>'+C.esc((a.instructions||'').slice(0,140))+'</p><div class="assignment-meta"><span><i class="fa-solid fa-chalkboard-user"></i> '+C.esc(a.teacherName||'المدرس')+'</span><span><i class="fa-regular fa-calendar"></i> '+C.esc(dueText(Number(a.dueAt||0)))+'</span><span><i class="fa-solid fa-star"></i> '+Number(a.maxScore||100)+' درجة</span></div></div><div class="assignment-side">'+(st==='graded'?'<strong class="assignment-score">'+Number(s.score||0)+'%</strong>':'')+'<button class="btn '+(st==='pending'?'btn-primary':'btn-soft')+'" data-open-assignment="'+a.id+'">'+(st==='pending'?'فتح وتسليم':'عرض التفاصيل')+'</button></div></article>';
  }).join(''):'<div class="feature-empty"><span>📚</span><h3>مفيش واجبات في القسم ده</h3><p>أي واجب مناسب لمرحلتك وصفك هيظهر هنا تلقائيًا.</p></div>';
  $$('[data-open-assignment]').forEach(b=>b.onclick=()=>openAssignment(b.dataset.openAssignment));
}
function openAssignment(id){
  const a=assignments.find(x=>x.id===id);if(!a)return;
  activeAssignment=a;
  const s=submissions[id],st=statusFor(a);
  $('assignmentModalBody').innerHTML='<div class="assignment-modal-head"><span class="section-kicker">'+C.esc(subjectName(a.subject))+'</span><h2>'+C.esc(a.title||'واجب')+'</h2><p>'+C.esc(a.instructions||'لا توجد تعليمات إضافية.')+'</p></div><div class="assignment-detail-grid"><div><small>المدرس</small><strong>'+C.esc(a.teacherName||'المدرس')+'</strong></div><div><small>آخر موعد</small><strong>'+C.esc(dueText(Number(a.dueAt||0)))+'</strong></div><div><small>الدرجة</small><strong>'+Number(a.maxScore||100)+'</strong></div></div>'+
  (st==='graded'
    ?'<div class="assignment-feedback"><span>✅</span><div><strong>تم التصحيح • '+Number(s.score||0)+'%</strong><p>'+C.esc(s.feedback||'لا توجد ملاحظات إضافية من المدرس.')+'</p></div></div><div class="assignment-submission-preview"><small>إجابتك</small><p>'+C.esc(s.answer||'—')+'</p>'+(s.link?'<a href="'+C.safeUrl(s.link)+'" target="_blank" rel="noopener">فتح الرابط المرفق</a>':'')+'</div>'
    :'<form id="assignmentSubmitForm" class="assignment-submit-form"><label><span>إجابتك أو ملاحظاتك</span><textarea id="assignmentAnswer" maxlength="5000" placeholder="اكتب إجابتك هنا...">'+C.esc(s?.answer||'')+'</textarea></label><label><span>رابط ملف أو Google Drive — اختياري</span><input id="assignmentLink" type="url" dir="ltr" value="'+C.esc(s?.link||'')+'" placeholder="https://..."></label><button class="btn btn-primary btn-block" type="submit">'+(s?'تحديث التسليم':'تسليم الواجب')+'</button></form>');
  $('assignmentModal').classList.remove('hidden');document.body.style.overflow='hidden';
  const form=$('assignmentSubmitForm');if(form)form.onsubmit=submitAssignment;
}
async function submitAssignment(e){
  e.preventDefault();if(!activeAssignment)return;
  const answer=$('assignmentAnswer').value.trim(),link=$('assignmentLink').value.trim();
  if(!answer&&!link)return C.toast('اكتب إجابة أو أضف رابطًا للتسليم.','error');
  const current=submissions[activeAssignment.id];
  if(current?.status==='graded')return C.toast('تم تصحيح هذا الواجب بالفعل.','error');
  const payload={answer,link,status:'submitted',submittedAt:Date.now(),studentName:profile.name||user.displayName||'طالب',assignmentTitle:activeAssignment.title||'واجب',subject:activeAssignment.subject||''};
  await C.db.ref('assignmentSubmissions/'+activeAssignment.id+'/'+user.uid).set(payload);
  C.toast('تم تسليم الواجب بنجاح ✅');closeModal();
}
function closeModal(){$('assignmentModal').classList.add('hidden');document.body.style.overflow='';activeAssignment=null}
$('closeAssignmentModal').onclick=closeModal;$('assignmentModal').onclick=e=>{if(e.target===$('assignmentModal'))closeModal()};
$$('[data-assignment-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.assignmentFilter;$$('[data-assignment-filter]').forEach(x=>x.classList.toggle('active',x===b));render()});

(async()=>{
  ({user,profile}=await C.requireStudent());$('pageAvatar').textContent=C.initials(profile.name||user.displayName||'طالب');
  const a=await C.db.ref('assignments').once('value');
  assignments=Object.entries(a.val()||{}).map(([id,v])=>({id,...(v||{})}));
  const mine=matching();
  const snaps=await Promise.all(mine.map(x=>C.db.ref('assignmentSubmissions/'+x.id+'/'+user.uid).once('value')));
  submissions={};mine.forEach((x,i)=>{if(snaps[i].exists())submissions[x.id]=snaps[i].val()});
  mine.forEach(x=>C.db.ref('assignmentSubmissions/'+x.id+'/'+user.uid).on('value',snap=>{
    if(snap.exists())submissions[x.id]=snap.val();else delete submissions[x.id];
    render();
  }));
  render();
})();
})();