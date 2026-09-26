(function proRolesAdmin(){
'use strict';
if(!window.firebase)return;
const app=firebase.apps[0],auth=app.auth(),db=app.database(),$=id=>document.getElementById(id),esc=(v='')=>String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let current=null,roles={};
const labels={subjectSupervisor:'مشرف مادة',contentReviewer:'مراجع محتوى',assistantTeacher:'مساعد معلم',parent:'ولي أمر'};
function toast(msg,type='success'){const el=$('toast');if(!el)return;el.textContent=msg;el.className='toast show '+type;clearTimeout(toast.t);toast.t=setTimeout(()=>el.className='toast',2600)}
function mount(){
 const host=$('admin-tab-pro-suite');if(!host||$('proRolesPanel'))return;
 const panel=document.createElement('article');panel.className='pro-panel';panel.id='proRolesPanel';
 panel.innerHTML='<div class="pro-panel-head"><div><h2>الصلاحيات المتقدمة</h2><p>أدوار إضافية بدون منح صلاحية مدير كامل: مشرف مادة، مراجع محتوى، مساعد معلم، وولي أمر.</p></div><span class="pro-badge">RBAC</span></div>'+
 '<form id="proRoleForm" class="pro-form"><label class="full"><span>UID المستخدم</span><input id="proRoleUid" dir="ltr" required placeholder="Firebase UID"></label><label><span>الدور</span><select id="proRoleValue"><option value="subjectSupervisor">مشرف مادة</option><option value="contentReviewer">مراجع محتوى</option><option value="assistantTeacher">مساعد معلم</option><option value="parent">ولي أمر</option></select></label><label><span>الحالة</span><select id="proRoleActive"><option value="true">مفعل</option><option value="false">موقوف</option></select></label><label class="full"><span>المادة / النطاق</span><input id="proRoleSubject" maxlength="100" placeholder="مثال: math أو arabic — مطلوب للمشرف والمراجع"></label><label class="full"><span>ملاحظة إدارية</span><input id="proRoleNote" maxlength="200"></label><div class="full"><button class="pro-btn" type="submit">حفظ الدور</button></div></form><div class="pro-list" id="proRolesList" style="margin-top:18px"></div>';
 const audit=host.querySelector('#proAuditList')?.closest('.pro-panel');if(audit)host.insertBefore(panel,audit);else host.appendChild(panel);
 $('proRoleForm').addEventListener('submit',save);render();
}
async function save(e){
 e.preventDefault();if(!current)return;
 const uid=$('proRoleUid').value.trim(),role=$('proRoleValue').value,active=$('proRoleActive').value==='true',subject=$('proRoleSubject').value.trim(),note=$('proRoleNote').value.trim();
 if(!uid)return toast('اكتب UID المستخدم.','error');
 if((role==='subjectSupervisor'||role==='contentReviewer')&&!subject)return toast('حدد المادة للمشرف أو مراجع المحتوى.','error');
 try{
   const payload={role,active,subject,note,updatedAt:Date.now(),updatedBy:current.uid};
   await db.ref('roleProfiles/'+uid).set(payload);
   await db.ref('auditLog').push().set({actorId:current.uid,actorRole:'admin',actorName:current.email||'admin',action:'role_updated',targetId:uid,meta:{role,active,subject},createdAt:Date.now()}).catch(()=>{});
   roles[uid]=payload;e.target.reset();render();toast('تم حفظ الدور والصلاحية ✅');
 }catch(err){console.error(err);toast('تعذر حفظ الدور.','error')}
}
function render(){
 const box=$('proRolesList');if(!box)return;
 const arr=Object.entries(roles||{}).map(([uid,r])=>({uid,...(r||{})})).sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0));
 box.innerHTML=arr.length?arr.map(r=>'<div class="pro-list-item"><div><h4>'+esc(labels[r.role]||r.role||'دور')+'</h4><p dir="ltr">'+esc(r.uid)+'</p><small>'+esc(r.subject||'بدون مادة محددة')+(r.note?' • '+esc(r.note):'')+'</small></div><span class="pro-badge '+(r.active!==false?'approved':'rejected')+'">'+(r.active!==false?'مفعل':'موقوف')+'</span></div>').join(''):'<div class="pro-empty">لا توجد أدوار إضافية حتى الآن.</div>';
}
auth.onAuthStateChanged(async u=>{if(!u)return;current=u;try{const s=await db.ref('roleProfiles').once('value');roles=s.val()||{};mount();db.ref('roleProfiles').on('value',x=>{roles=x.val()||{};render()})}catch(err){console.warn('Role manager unavailable',err)}});
})();