(() => {
'use strict';

const path=(location.pathname.split('/').pop()||'index.html').toLowerCase();
const groups={
  home:['index.html',''],
  learn:['subject.html','lesson.html','explore.html','search.html','library.html','exam-center.html','simulations.html'],
  plan:['planner.html','schedule.html','assignments.html','weekly-report.html','progress.html'],
  alerts:['notifications.html','live.html'],
  profile:['profile.html']
};
function activeFor(key){return groups[key]?.includes(path)}

function injectMobileNav(){
  if(document.querySelector('.student-mobile-nav'))return;
  if(document.body.classList.contains('admin-v3-body')||document.body.classList.contains('teacher-v3-body'))return;
  const nav=document.createElement('nav');
  nav.className='student-mobile-nav';
  nav.setAttribute('aria-label','التنقل الرئيسي');
  nav.innerHTML=
    '<a href="./index.html" class="'+(activeFor('home')?'active':'')+'"><i class="fa-solid fa-house"></i><span>الرئيسية</span></a>'+
    '<a href="./explore.html" class="'+(activeFor('learn')?'active':'')+'"><i class="fa-solid fa-book-open"></i><span>تعلّم</span></a>'+
    '<a href="./planner.html" class="'+(activeFor('plan')?'active':'')+'"><i class="fa-regular fa-calendar-check"></i><span>خطتي</span></a>'+
    '<a href="./notifications.html" class="'+(activeFor('alerts')?'active':'')+'"><i class="fa-regular fa-bell"></i><span>التنبيهات</span></a>'+
    '<a href="./profile.html" class="'+(activeFor('profile')?'active':'')+'"><i class="fa-regular fa-user"></i><span>حسابي</span></a>';
  document.body.appendChild(nav);
}
function enhancePageAvatar(){
  const avatar=document.getElementById('pageAvatar');if(!avatar)return;
  avatar.classList.add('student-profile-shortcut');
  avatar.setAttribute('role','link');avatar.setAttribute('tabindex','0');avatar.setAttribute('title','فتح حسابي');
  const go=()=>location.href='./profile.html';
  avatar.addEventListener('click',go);
  avatar.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}});
}
function addBackButton(){
  const nav=document.querySelector('.learning-nav');
  if(!nav||nav.querySelector('.student-back-button')||path==='index.html')return;
  const btn=document.createElement('button');
  btn.className='student-back-button';
  btn.type='button';
  btn.setAttribute('aria-label','رجوع');
  btn.innerHTML='<i class="fa-solid fa-arrow-right"></i>';
  btn.onclick=()=>history.length>1?history.back():location.href='./index.html';
  nav.prepend(btn);
}
document.addEventListener('DOMContentLoaded',()=>{injectMobileNav();addBackButton();enhancePageAvatar()});
})();