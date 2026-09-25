const CACHE='academy-shell-2026-09-25-v28';
const CORE=[
 './','./index.html','./offline.html',
 './explore.html','./search.html','./news.html','./subject.html','./lesson.html','./profile.html',
 './exam-center.html','./simulations.html','./progress.html','./planner.html','./assignments.html','./weekly-report.html','./schedule.html',
 './library.html','./live.html','./community.html','./leaderboard.html','./notifications.html','./certificate.html',
 './assets/styles.css','./assets/learning.css','./assets/portal.css','./assets/hub.css','./assets/search.css','./assets/news.css','./assets/certificate.css','./assets/ui-kit.css',
 './assets/ui-kit.js','./assets/student-shell.js','./assets/firebase-config.js','./assets/auth-flow.js','./assets/student-core.js',
 './assets/app.js','./assets/learning.js','./assets/explore.js','./assets/search.js','./assets/news.js','./assets/profile.js',
 './assets/exam-center.js','./assets/simulations.js','./assets/progress.js','./assets/planner.js','./assets/assignments.js','./assets/weekly-report.js','./assets/schedule.js',
 './assets/library.js','./assets/live.js','./assets/community.js','./assets/leaderboard.js','./assets/notification-engine.js','./assets/notifications.js','./assets/notification-widget.js',
 './assets/activity-tracker.js','./assets/pwa.js','./assets/app-icon.svg','./manifest.webmanifest'
];

self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).catch(()=>{}));
 self.skipWaiting();
});

self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
 self.clients.claim();
});

async function networkFirst(req){
 try{
  const res=await fetch(req);
  if(res&&res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{})}
  return res;
 }catch{
  const cached=await caches.match(req);
  if(cached)return cached;
  if(req.mode==='navigate')return caches.match('./offline.html');
  return Response.error();
 }
}

self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==location.origin)return;

 if(req.mode==='navigate'){
  event.respondWith(networkFirst(req));
  return;
 }

 if(/\.(?:css|js|webmanifest)$/i.test(url.pathname)){
  event.respondWith(networkFirst(req));
  return;
 }

 if(/\.(?:svg|png|jpg|jpeg|webp|gif|woff2?)$/i.test(url.pathname)){
  event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(res=>{
   if(res&&res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{})}
   return res;
  })));
 }
});