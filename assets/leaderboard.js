(() => {
'use strict';
const C=window.AcademyCore,$=id=>document.getElementById(id),$$=(s,r=document)=>[...r.querySelectorAll(s)];
let user,profile,period='daily',rows=[];

function keyForPeriod(){
 const keys=C.leaderboardKeys();
 return period==='daily'?keys.daily:period==='weekly'?keys.weekly:period==='monthly'?keys.monthly:keys.allTime;
}
function periodLabel(){return period==='daily'?'اليوم':period==='weekly'?'هذا الأسبوع':period==='monthly'?'هذا الشهر':'كل الوقت'}
function render(){
 const limit=Number($('leaderLimit').value||20);
 const list=[...rows].sort((a,b)=>Number(b.xp||0)-Number(a.xp||0)||Number(b.quizzes||0)-Number(a.quizzes||0)).slice(0,limit);
 const meIndex=list.findIndex(x=>x.id===user.uid);
 const me=list.find(x=>x.id===user.uid)||{};
 $('myRank').textContent=meIndex>=0?'#'+(meIndex+1):'—';$('myXp').textContent=Number(me.xp||0);$('myQuizCount').textContent=Number(me.quizzes||0);$('myLevel').textContent=profile.stats?.level||1;
 const top=list.slice(0,3);
 const medals=['🥇','🥈','🥉'];
 $('podium').innerHTML=top.length?top.map((r,i)=>'<article class="podium-card '+(i===0?'first':'')+'"><span class="podium-medal">'+medals[i]+'</span><span class="podium-avatar">'+C.esc(C.initials(r.name||'طالب'))+'</span><h3>'+C.esc(r.name||'طالب')+'</h3><strong>'+Number(r.xp||0)+' XP</strong><p style="font-size:8px;color:#64748b">'+Number(r.quizzes||0)+' اختبار</p></article>').join(''):'<div class="feature-empty"><span>🏁</span><h3>الترتيب لسه بيبدأ</h3><p>أكمل درسًا أو اختبارًا ليظهر ترتيبك.</p></div>';
 $('rankList').innerHTML=list.length?list.map((r,i)=>'<div class="rank-row"><span class="rank-position">'+(i+1)+'</span><div class="rank-user"><span class="rank-avatar">'+C.esc(C.initials(r.name||'طالب'))+'</span><div><strong>'+C.esc(r.name||'طالب')+(r.id===user.uid?' • أنت':'')+'</strong><small>'+periodLabel()+'</small></div></div><span class="rank-xp">'+Number(r.xp||0)+' XP</span><span class="rank-level">'+Number(r.quizzes||0)+' اختبار</span></div>').join(''):'';
}
async function load(){
 const snap=await C.db.ref('leaderboardV3/'+keyForPeriod()).once('value');
 rows=Object.entries(snap.val()||{}).map(([id,v])=>({id,...(v||{})}));render();
}
$$('[data-period]').forEach(b=>b.onclick=async()=>{period=b.dataset.period;$$('[data-period]').forEach(x=>x.classList.toggle('active',x===b));await load()});
$('leaderLimit').onchange=render;

(async()=>{
 ({user,profile}=await C.requireStudent());$('pageAvatar').textContent=C.initials(profile.name||user.displayName||'طالب');
 await C.syncAllTimeLeaderboard(user.uid,profile);
 await load();
})();
})();