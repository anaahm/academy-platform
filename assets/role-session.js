(()=>{
'use strict';
const names={admin:'admin-portal',teacher:'teacher-portal',parent:'parent-portal'};
function get(role){
 if(!window.firebase||!firebase.auth||!firebase.database)throw new Error('Firebase SDK unavailable');
 const cfg=window.ACADEMY_FIREBASE_CONFIG;if(!cfg)throw new Error('Firebase config missing');
 const name=names[role];if(!name)throw new Error('Unknown role session: '+role);
 const app=firebase.apps.find(x=>x.name===name)||firebase.initializeApp(cfg,name);
 return{role,name,app,auth:app.auth(),db:app.database()};
}
async function roleForUid(db,uid){
 if(!uid)return'guest';
 const [a,t,p,s]=await Promise.all([
  db.ref('adminProfiles/'+uid).once('value'),
  db.ref('teacherProfiles/'+uid).once('value'),
  db.ref('parentProfilesV4/'+uid).once('value'),
  db.ref('studentProfilesV3/'+uid).once('value')
 ]);
 if(a.val()?.isAdmin===true)return'admin';
 if(t.exists())return'teacher';
 if(p.exists())return'parent';
 if(s.exists())return'student';
 return'unknown';
}
function portal(role){return role==='admin'?'./admin.html':role==='teacher'?'./teacher.html':role==='parent'?'./parent.html':'./index.html'}
window.AcademyRoleSession={get,roleForUid,portal,names};
})();