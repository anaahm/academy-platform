(()=>{
'use strict';
const cache=new Map();
function config(){
 const cfg=window.ACADEMY_FIREBASE_CONFIG;
 if(!cfg)throw new Error('Firebase configuration is missing');
 return cfg;
}
function get(name=''){
 if(!window.firebase)throw new Error('Firebase SDK is missing');
 const key=String(name||'').trim();
 if(cache.has(key))return cache.get(key);
 let app;
 if(!key){
   app=firebase.apps.find(a=>a.name==='[DEFAULT]')||firebase.initializeApp(config());
 }else{
   app=firebase.apps.find(a=>a.name===key)||firebase.initializeApp(config(),key);
 }
 const session={name:key||'[DEFAULT]',app,auth:app.auth(),db:app.database()};
 cache.set(key,session);return session;
}
function page(){
 const name=document.body?.dataset?.academyAuthApp||'';
 return get(name);
}
window.AcademyRoleSession={get,page};
})();