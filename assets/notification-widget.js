(() => {
'use strict';
if(!window.AcademyNotifications)return;
const auth=firebase.auth();
let currentUser=null,timer=null;

function setBadge(button,count){
  if(!button)return;
  button.classList.toggle('has-notification-badge',count>0);
  let badge=button.querySelector('.notification-badge');
  if(count<=0){badge?.remove();return}
  if(!badge){badge=document.createElement('span');badge.className='notification-badge';button.appendChild(badge)}
  badge.textContent=count>99?'99+':String(count);
}
function addCenterLink(){
  const cards=[...document.querySelectorAll('.dashboard-smart-card')];
  const card=cards.find(x=>x.querySelector('h3')?.textContent.trim()==='الإشعارات');
  if(card&&!card.querySelector('.notification-center-link')){
    const a=document.createElement('a');a.href='./notifications.html';a.className='text-btn notification-center-link';a.style.marginTop='12px';a.innerHTML='عرض مركز الإشعارات <i class="fa-solid fa-arrow-left"></i>';card.appendChild(a);
  }
}
async function refresh(){
  if(!currentUser)return;
  try{
    const result=await window.AcademyNotifications.loadNotifications(currentUser);
    setBadge(document.getElementById('notificationBtn'),result.unread);
    setBadge(document.getElementById('dashNotificationBtn'),result.unread);
    addCenterLink();
  }catch(e){console.warn('Notification badge update failed',e)}
}
document.addEventListener('click',e=>{
  const btn=e.target.closest('#notificationBtn,#dashNotificationBtn');
  if(!btn)return;
  e.preventDefault();e.stopImmediatePropagation();location.href='./notifications.html';
},true);
auth.onAuthStateChanged(user=>{
  currentUser=user;
  if(timer){clearInterval(timer);timer=null}
  if(!user){setBadge(document.getElementById('notificationBtn'),0);setBadge(document.getElementById('dashNotificationBtn'),0);return}
  setTimeout(refresh,700);timer=setInterval(refresh,60000);
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
})();