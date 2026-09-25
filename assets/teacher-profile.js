(() => {
 'use strict';
 const el=document.getElementById('teacherProfileView'),id=new URLSearchParams(location.search).get('id');
 const escape=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const section=(title,value,icon)=>value?'<section class="teacher-profile-section"><h2><i class="fa-solid '+icon+'"></i> '+title+'</h2><p>'+escape(value)+'</p></section>':'';
 const unavailable=()=>{el.innerHTML='<div class="teacher-profile-empty"><span>👨‍🏫</span><h1>هذا الملف غير متاح حاليًا</h1><p>ستظهر معلومات المعلم هنا بعد نشرها من الإدارة.</p><a class="btn btn-primary" href="./index.html">استكشف المنصة</a></div>'};
 if(!id||!window.ACADEMY_FIREBASE_CONFIG||!window.firebase){unavailable();return}
 try{
   if(!firebase.apps.length)firebase.initializeApp(window.ACADEMY_FIREBASE_CONFIG);
   firebase.database().ref('settings/publicTeachers/'+id).once('value').then(s=>{
     const p=s.val();if(!p||p.active===false||!p.name){unavailable();return}
     document.title=p.name+' | معلمو الأكاديمية';
     let photo='';try{const u=new URL(p.photoUrl);if(['https:','http:'].includes(u.protocol))photo=u.href}catch{}
     el.innerHTML='<article class="teacher-profile-card"><div class="teacher-profile-banner"></div><div class="teacher-profile-content"><div class="teacher-profile-identity"><div class="teacher-profile-photo">'+(photo?'<img src="'+escape(photo)+'" alt="صورة '+escape(p.name)+'" loading="eager">':escape(p.name[0]))+'</div><div><span class="teacher-profile-eyebrow">من فريق التدريس</span><h1>'+escape(p.name)+'</h1><p>'+escape(p.title||'معلم في الأكاديمية')+'</p></div></div><div class="teacher-profile-details">'+section('نبذة عني',p.bio,'fa-user')+section('المؤهلات',p.qualifications,'fa-graduation-cap')+section('الخبرة',p.experience,'fa-chalkboard-user')+section('طريقتي في الشرح',p.teachingStyle,'fa-lightbulb')+'</div><a class="btn btn-primary" href="./explore.html">استكشف المواد والدروس <i class="fa-solid fa-arrow-left"></i></a></div></article>';
     el.querySelector('img')?.addEventListener('error',e=>{e.target.parentElement.textContent=p.name[0]},{once:true});
   }).catch(unavailable);
 }catch{unavailable()}
})();
