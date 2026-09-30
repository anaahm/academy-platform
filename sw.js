const CACHE='academy-shell-2026-09-30-v76';
const CORE=[
 './','./index.html','./offline.html',
 './explore.html','./search.html','./news.html','./subject.html','./lesson.html','./profile.html',
 './exam-center.html','./simulations.html','./progress.html','./planner.html','./assignments.html','./weekly-report.html','./schedule.html',
 './library.html','./live.html','./community.html','./leaderboard.html','./challenges.html','./notifications.html','./support.html','./certificate.html','./smart-review.html','./admin.html','./teacher.html','./teacher-profile.html',
 './assets/experience.css?v=39','./assets/future-theme.css?v=1','./assets/academy-mix-theme.css?v=26','./assets/gamification.css?v=1','./assets/ui-polish.css?v=1','./assets/communications.css?v=1','./assets/support.css?v=1','./assets/admin-content-ops.css?v=1','./assets/academy-utils.js',
 './assets/styles.css','./assets/learning.css?v=42','./assets/portal.css?v=42','./assets/hub.css','./assets/search.css','./assets/news.css','./assets/certificate.css','./assets/admin.css?v=42','./assets/admin-intelligence.css?v=1','./assets/ui-kit.css?v=35',
 './assets/ui-kit.js','./assets/student-shell.js','./assets/firebase-config.js','./assets/auth-flow.js','./assets/student-core.js',
 './assets/app.js?v=50','./assets/learning.js?v=55','./assets/explore.js?v=3','./assets/search.js?v=4','./assets/news.js','./assets/profile.js?v=43',
 './assets/exam-center.js?v=45','./assets/simulations.js','./assets/progress.js?v=1','./assets/planner.js?v=1','./assets/assignments.js?v=2','./assets/weekly-report.js?v=1','./assets/schedule.js?v=1',
 './assets/library.js?v=3','./assets/live.js?v=1','./assets/community.js?v=2','./assets/gamification.js?v=1','./assets/challenges.js?v=1','./assets/leaderboard.js?v=2','./assets/ui-polish.js?v=1','./assets/student-communications.js?v=1','./assets/teacher-communications.js?v=1','./assets/admin-communications.js?v=1','./assets/student-communication-status.js?v=1','./assets/support.js?v=1','./assets/teacher-support.js?v=1','./assets/admin-support.js?v=1','./assets/admin-content-ops.js?v=1','./assets/notification-engine.js?v=2','./assets/notifications.js?v=2','./assets/notification-widget.js?v=2',
 './assets/growth-pack.css?v=1','./assets/growth-pack.js?v=1','./assets/planner-auto.js?v=1','./assets/smart-review.js?v=1','./assets/activity-tracker.js','./assets/admin-auth-flow.js?v=33','./assets/admin-intelligence.js?v=1','./assets/admin.js?v=57','./assets/admin-notifications.js?v=2','./assets/teacher.js?v=46','./assets/teacher-profile.js?v=36','./assets/certificate.js','./assets/pwa.js','./assets/dashboard-hero.jpg','./assets/reference-hero.jpg','./assets/reference-stage-primary.jpg','./assets/reference-stage-prep.jpg','./assets/reference-stage-sec.jpg','./assets/reference-stage-azhar.jpg','./assets/app-icon.svg','./manifest.webmanifest'
];

self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('academy-shell-')&&k!==CACHE).map(k=>caches.delete(k)))));
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
