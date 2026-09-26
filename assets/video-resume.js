(() => {
'use strict';
const frameBox=()=>document.getElementById('videoFrame');
let observer=null,currentPlayer=null,timer=null,user=null;
function lessonId(){return new URLSearchParams(location.search).get('id')||''}
function loadApi(){
 if(window.YT?.Player)return Promise.resolve(window.YT);
 return new Promise(resolve=>{
  const previous=window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady=()=>{try{previous?.()}catch{}resolve(window.YT)};
  if(!document.querySelector('script[data-academy-youtube-api]')){
    const s=document.createElement('script');s.src='https://www.youtube.com/iframe_api';s.dataset.academyYoutubeApi='1';document.head.appendChild(s);
  }
  setTimeout(()=>resolve(window.YT||null),5000);
 });
}
function cleanup(){
 clearInterval(timer);timer=null;
 try{currentPlayer?.destroy?.()}catch{}
 currentPlayer=null;
}
async function bindFrame(iframe){
 cleanup();
 if(!iframe||!user||!window.AcademyPro||!lessonId())return;
 const index=Number(iframe.dataset.videoIndex||0),key=lessonId()+'-'+index;
 const YT=await loadApi();if(!YT?.Player||!document.body.contains(iframe))return;
 let saved=null;try{saved=await window.AcademyPro.getResume('video',key,user.uid)}catch{}
 try{
  currentPlayer=new YT.Player(iframe,{
   events:{
    onReady:e=>{
     try{
      const duration=Number(e.target.getDuration?.()||0),position=Number(saved?.position||0);
      if(position>5&&(!duration||position<duration-8))e.target.seekTo(position,true);
     }catch{}
     timer=setInterval(async()=>{
      try{
       const position=Number(currentPlayer?.getCurrentTime?.()||0),duration=Number(currentPlayer?.getDuration?.()||0);
       if(duration>0)await window.AcademyPro.saveResume('video',key,position,duration,user.uid);
      }catch{}
     },10000);
    },
    onStateChange:e=>{
     if(e.data===0){
      try{
       const d=Number(e.target.getDuration?.()||0);
       window.AcademyPro.saveResume('video',key,d,d,user.uid).catch(()=>{});
       window.AcademyPro.incrementGoal('minutes',Math.max(1,Math.round(d/60)),user.uid).catch(()=>{});
      }catch{}
     }
    }
   }
  });
 }catch(err){console.warn('Video resume unavailable',err)}
}
function watch(){
 const box=frameBox();if(!box)return;
 observer?.disconnect();
 observer=new MutationObserver(()=>{
  const iframe=box.querySelector('iframe[data-video-index]');
  if(iframe)bindFrame(iframe);
  else cleanup();
 });
 observer.observe(box,{childList:true,subtree:true});
 const iframe=box.querySelector('iframe[data-video-index]');if(iframe)bindFrame(iframe);
}
function boot(){
 if(!window.firebase||!window.AcademyPro)return;
 window.AcademyPro.auth.onAuthStateChanged(u=>{user=u||null;if(user)watch();else cleanup()});
}
window.addEventListener('beforeunload',()=>{
 try{
  if(currentPlayer&&user&&window.AcademyPro){
   const iframe=frameBox()?.querySelector('iframe[data-video-index]'),key=lessonId()+'-'+Number(iframe?.dataset.videoIndex||0);
   const p=Number(currentPlayer.getCurrentTime?.()||0),d=Number(currentPlayer.getDuration?.()||0);
   if(d>0)window.AcademyPro.saveResume('video',key,p,d,user.uid).catch(()=>{});
  }
 }catch{}
 cleanup();
});
boot();
})();