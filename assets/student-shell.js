(() => {
'use strict';

const path=(location.pathname.split('/').pop()||'index.html').toLowerCase();
const groups={
  home:['index.html',''],
  learn:['subject.html','lesson.html','explore.html','search.html','library.html','exam-center.html','simulations.html','community.html','leaderboard.html'],
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
  const item=(href,key,icon,label)=>'<a href="'+href+'" class="'+(activeFor(key)?'active':'')+'" '+(activeFor(key)?'aria-current="page"':'')+'><i class="'+icon+'"></i><span>'+label+'</span></a>';
  nav.innerHTML=
    item('./index.html','home','fa-solid fa-house','الرئيسية')+
    item('./explore.html','learn','fa-solid fa-book-open','تعلّم')+
    item('./planner.html','plan','fa-regular fa-calendar-check','خطتي')+
    item('./notifications.html','alerts','fa-regular fa-bell','التنبيهات')+
    item('./profile.html','profile','fa-regular fa-user','حسابي');
  document.body.appendChild(nav);
}
function injectIndexNavWhenReady(){
  const dash=document.getElementById('studentDashboard');
  if(!dash){injectMobileNav();return}
  if(!dash.classList.contains('hidden')){injectMobileNav();return}
  const observer=new MutationObserver(()=>{
    if(!dash.classList.contains('hidden')){injectMobileNav();observer.disconnect()}
  });
  observer.observe(dash,{attributes:true,attributeFilter:['class']});
}
function enhancePageAvatar(){
  const avatar=document.getElementById('pageAvatar');if(!avatar||avatar.dataset.profileShortcut==='1')return;
  avatar.dataset.profileShortcut='1';avatar.classList.add('student-profile-shortcut');
  avatar.setAttribute('role','link');avatar.setAttribute('tabindex','0');avatar.setAttribute('title','فتح حسابي');avatar.setAttribute('aria-label','فتح حسابي');
  const go=()=>location.href='./profile.html';
  avatar.addEventListener('click',go);
  avatar.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}});
}
function addBackButton(){
  const nav=document.querySelector('.learning-nav');
  if(!nav||nav.querySelector('.student-back-button')||path==='index.html'||path==='')return;
  const btn=document.createElement('button');
  btn.className='student-back-button';btn.type='button';btn.setAttribute('aria-label','رجوع');
  btn.innerHTML='<i class="fa-solid fa-arrow-right"></i>';
  btn.onclick=()=>{
    let sameOrigin=false;
    try{sameOrigin=!!document.referrer&&new URL(document.referrer).origin===location.origin}catch{}
    if(sameOrigin&&history.length>1)history.back();else location.href='./index.html';
  };
  nav.prepend(btn);
}
document.addEventListener('DOMContentLoaded',()=>{
  if(path==='index.html'||path==='')injectIndexNavWhenReady();else injectMobileNav();
  addBackButton();enhancePageAvatar();
});
})();