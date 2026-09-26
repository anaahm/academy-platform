(function proStaffReview(){
'use strict';
if(!window.firebase)return;
const app=firebase.apps.find(a=>a.name==='teacher-portal')||firebase.apps[0],auth=app.auth(),db=app.database(),$=id=>document.getElementById(id),esc=(v='')=>String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let user=null,role=null,bank={};
function toast(msg,type='success'){const el=$('toast');if(!el)return;el.textContent=msg;el.className='toast show '+type;clearTimeout(toast.t);toast.t=setTimeout(()=>el.className='toast',2800)}
function allowed(){return role?.active===true&&(role.role==='subjectSupervisor'||role.role==='contentReviewer')&&!!role.subject}
function mount(){
 const host=$('teacher-tab-pro-suite');if(!host||$('proStaffReviewPanel')||!allowed())return;
 const panel=document.createElement('section');panel.className='pro-panel';panel.id='proStaffReviewPanel';
 panel.innerHTML='<div class="pro-panel-head"><div><span class="section-kicker">مراجعة حسب الصلاحية</span><h2>'+(role.role==='subjectSupervisor'?'مشرف مادة':'مراجع محتوى')+' — '+esc(role.subject)+'</h2><p>يمكنك اعتماد أو رفض أسئلة المادة المحددة فقط، ولا تحصل على صلاحيات المدير العام.</p></div><span class="pro-badge approved">نطاق محدود</span></div><div class="pro-list" id="proStaffPendingQuestions"></div>';
 host.insertBefore(panel,host.firstChild);render();
}
function render(){
 const box=$('proStaffPendingQuestions');if(!box||!allowed())return;
 const arr=Object.entries(bank||{}).map(([id,q])=>({id,...(q||{})})).filter(q=>q.status==='pending'&&q.subject===role.subject).sort((a,b)=>Number(a.createdAt||0)-Number(b.createdAt||0));
 box.innerHTML=arr.length?arr.map(q=>'<div class="pro-list-item"><div><h4>'+esc(q.text||'سؤال')+'</h4><p>'+esc(q.teacherName||'معلم')+' • '+esc(q.skill||'')+' • صعوبة '+Number(q.difficulty||2)+'</p></div><div class="pro-toolbar"><button class="pro-btn success" data-staff-approve="'+q.id+'">اعتماد</button><button class="pro-btn danger" data-staff-reject="'+q.id+'">رفض</button></div></div>').join(''):'<div class="pro-empty">لا توجد أسئلة معلقة في نطاقك الآن ✅</div>';
 document.querySelectorAll('[data-staff-approve]').forEach(b=>b.onclick=()=>review(b.dataset.staffApprove,true));
 document.querySelectorAll('[data-staff-reject]').forEach(b=>b.onclick=()=>review(b.dataset.staffReject,false));
}
async function review(id,approved){
 const q=bank[id];if(!q||q.subject!==role.subject||q.status!=='pending')return toast('السؤال خارج نطاقك أو تمت مراجعته.','error');
 try{
  await db.ref('questionBank/'+id).update({status:approved?'approved':'rejected',reviewedAt:Date.now(),reviewedBy:user.uid,reviewedRole:role.role});
  await db.ref('auditLog').push().set({actorId:user.uid,actorRole:role.role,actorName:user.displayName||user.email||'staff',action:approved?'question_approved':'question_rejected',targetId:id,meta:{subject:q.subject},createdAt:Date.now()}).catch(()=>{});
  toast(approved?'تم اعتماد السؤال ✅':'تم رفض السؤال');
 }catch(err){console.error(err);toast('تعذر تحديث السؤال.','error')}
}
auth.onAuthStateChanged(async u=>{
 if(!u)return;user=u;
 try{
  const [r,b]=await Promise.all([db.ref('roleProfiles/'+u.uid).once('value'),db.ref('questionBank').once('value')]);role=r.val();bank=b.val()||{};
  if(!allowed())return;mount();db.ref('questionBank').on('value',s=>{bank=s.val()||{};render()});
 }catch(err){console.warn('Scoped staff review unavailable',err)}
});
})();