(() => {
'use strict';
const C=window.AcademyCore,S=window.AcademySubscription,$=id=>document.getElementById(id);if(!C||!S)return;
let user=null,profile={},access={},requests={};
const esc=C.esc;
const fmt=n=>{const x=Number(n||0);return x?new Date(x).toLocaleDateString('ar-EG',{day:'numeric',month:'long',year:'numeric'}):'—'};
function subjectsText(plan){
 if(plan?.accessMode!=='subjects')return'كل المواد';
 const ids=Object.entries(plan.subjects||{}).filter(([,v])=>v).map(([k])=>k);
 return ids.length?ids.join(' • '):'مواد محددة';
}
function renderCurrent(){
 const sub=access.subscription,plan=access.plan,status=access.status;
 $('subscriptionHeroStatus').textContent=S.statusLabel(status);$('subscriptionHeroDays').textContent=access.active?access.daysLeft+' يوم':'—';
 $('subscriptionCurrentPlan').textContent=plan?.name||'لا توجد باقة نشطة';$('subscriptionStatusText').textContent=S.statusLabel(status);$('subscriptionStart').textContent=fmt(sub?.startsAt);$('subscriptionEnd').textContent=fmt(sub?.endsAt);$('subscriptionAccess').textContent=access.active?subjectsText(plan):'المجاني فقط';
 $('subscriptionCurrentText').textContent=access.active?'اشتراكك فعال ويمكنك الوصول للمحتوى الذي تشمله الباقة.':status==='pending'?'اشتراكك موجود لكنه لم يبدأ بعد.':status==='suspended'?'الاشتراك موقوف حاليًا. تواصل مع الإدارة إذا احتجت مساعدة.':status==='expired'?'انتهت مدة اشتراكك ويمكنك طلب تجديد أو باقة جديدة.':'يمكنك استخدام المحتوى المجاني وطلب الاشتراك في أي باقة متاحة.';
 const start=Number(sub?.startsAt||0),end=Number(sub?.endsAt||0),total=Math.max(1,end-start),left=Math.max(0,end-Date.now()),pct=access.active?Math.max(0,Math.min(100,left/total*100)):0;$('subscriptionProgressBar').style.width=pct+'%';
}
function planEligible(plan){
 if(plan.isActive===false)return false;
 return S.matchesPlanScope(plan,profile);
}
function renderPlans(){
 const box=$('subscriptionPlans'),plans=Object.entries(access.plans||{}).map(([id,v])=>({id,...(v||{})})).filter(planEligible).sort((a,b)=>Number(a.sortOrder||999)-Number(b.sortOrder||999)||Number(a.price||0)-Number(b.price||0));
 box.innerHTML=plans.length?plans.map((p,i)=>{
   const current=access.subscription?.planId===p.id&&['active','pending'].includes(access.status),subjectCount=Object.values(p.subjects||{}).filter(Boolean).length;
   return '<article class="subscription-plan '+(i===0?'featured':'')+'"><div class="subscription-plan-top"><span class="subscription-plan-icon">'+esc(p.icon||'👑')+'</span>'+(p.badge?'<span class="subscription-plan-badge">'+esc(p.badge)+'</span>':'')+'</div><h3>'+esc(p.name||'باقة')+'</h3><p>'+esc(p.description||'وصول منظم لمحتوى الأكاديمية.')+'</p><div class="subscription-price"><strong>'+esc(S.planPrice(p).replace(' ج.م',''))+'</strong><span>'+(Number(p.price||0)?'ج.م':'')+' / '+Number(p.durationDays||30)+' يوم</span></div><div class="subscription-plan-meta"><span>'+Number(p.durationDays||30)+' يوم</span><span>'+(p.accessMode==='subjects'?subjectCount+' مواد':'كل المواد')+'</span></div><ul><li><i class="fa-solid fa-circle-check"></i> المحتوى المجاني دائمًا متاح</li><li><i class="fa-solid fa-circle-check"></i> '+esc(p.accessMode==='subjects'?'المواد المحددة في الباقة':'كل مواد صفك')+'</li><li><i class="fa-solid fa-circle-check"></i> التفعيل بعد مراجعة الإدارة</li></ul><button class="btn '+(current?'btn-soft':'btn-primary')+'" data-request-plan="'+p.id+'" '+(current?'disabled':'')+'>'+(current?'الباقة الحالية / قيد التفعيل':'طلب الاشتراك')+'</button></article>';
 }).join(''):'<div class="subscription-current" style="grid-column:1/-1;text-align:center">لا توجد باقات متاحة لصفك حاليًا.</div>';
 box.querySelectorAll('[data-request-plan]').forEach(b=>b.onclick=()=>requestPlan(b.dataset.requestPlan,b));
}
function requestRows(){return Object.entries(requests||{}).map(([id,v])=>({id,...(v||{})})).sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0))}
function renderRequests(){
 const rows=requestRows(),box=$('subscriptionRequests');
 box.innerHTML=rows.length?rows.slice(0,12).map(r=>'<article class="subscription-request"><div><strong>'+esc(r.planName||'طلب اشتراك')+'</strong><small>'+fmt(r.createdAt)+' • '+esc(r.note||'تم إرسال الطلب للإدارة')+'</small></div><span class="subscription-status '+esc(r.status||'pending')+'">'+esc({pending:'قيد المراجعة',approved:'تم الاعتماد',rejected:'مرفوض',cancelled:'ملغي'}[r.status]||r.status)+'</span></article>').join(''):'<div style="padding:16px;text-align:center;color:#7183a0">لم ترسل طلب اشتراك بعد.</div>';
}
async function requestPlan(id,btn){
 const plan=access.plans?.[id];if(!plan)return;
 const pending=requestRows().some(r=>r.planId===id&&r.status==='pending');if(pending)return C.toast('لديك طلب قيد المراجعة لهذه الباقة.','error');
 window.AcademyUI?.setButtonLoading(btn,true,'إرسال');
 try{
   const ref=C.db.ref('subscriptionRequestsV1/'+user.uid).push(),now=Date.now();
   await ref.set({studentId:user.uid,studentName:profile.name||'طالب',studentPhone:profile.phone||'',planId:id,planName:plan.name||'باقة',price:Number(plan.price||0),durationDays:Number(plan.durationDays||30),status:'pending',createdAt:now,updatedAt:now});
   C.toast('تم إرسال طلب الاشتراك للإدارة ✅');
 }catch(err){console.error(err);C.toast('تعذر إرسال الطلب الآن.','error')}finally{window.AcademyUI?.setButtonLoading(btn,false)}
}
(async()=>{
 window.AcademyUI?.showPageLoading('جاري تحميل اشتراكك...');
 try{
   ({user,profile}=await C.requireStudent());$('subscriptionAvatar').textContent=C.initials(profile.name||'طالب');access=await S.load(user.uid,profile,true);renderCurrent();renderPlans();
   const ref=C.db.ref('subscriptionRequestsV1/'+user.uid),handler=s=>{requests=s.val()||{};renderRequests()};ref.on('value',handler);window.addEventListener('pagehide',()=>ref.off('value',handler),{once:true});
 }catch(err){console.error(err);C.toast('تعذر تحميل بيانات الاشتراك.','error')}finally{window.AcademyUI?.hidePageLoading()}
})();
})();