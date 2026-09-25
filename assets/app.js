(() => {
  'use strict';

  const firebaseConfig = window.ACADEMY_FIREBASE_CONFIG;
  if (!firebaseConfig) throw new Error('Firebase config is missing');

  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const database = firebase.database();

  const $ = (id) => document.getElementById(id);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const state = {
    user: null,
    profile: null,
    dbData: {},
    explorer: { type: 'all', stage: null, tab: 'stages', search: '' }
  };
  let baseDataPromise = null;

  const stageLabels = {
    primary: 'المرحلة الابتدائية',
    prep: 'المرحلة الإعدادية',
    sec: 'المرحلة الثانوية'
  };

  const gradeLabels = {
    primary: {1:'الصف الأول الابتدائي',2:'الصف الثاني الابتدائي',3:'الصف الثالث الابتدائي',4:'الصف الرابع الابتدائي',5:'الصف الخامس الابتدائي',6:'الصف السادس الابتدائي'},
    prep: {1:'الصف الأول الإعدادي',2:'الصف الثاني الإعدادي',3:'الصف الثالث الإعدادي'},
    sec: {1:'الصف الأول الثانوي',2:'الصف الثاني الثانوي',3:'الصف الثالث الثانوي'}
  };

  const defaults = {
    primary: [
      {id:'arabic',name:'اللغة العربية',emoji:'📖'},
      {id:'math',name:'الرياضيات',emoji:'🧮'},
      {id:'science',name:'العلوم',emoji:'🔬'},
      {id:'english',name:'اللغة الإنجليزية',emoji:'🇬🇧'},
      {id:'social',name:'الدراسات الاجتماعية',emoji:'🌍'},
      {id:'religion',name:'التربية الدينية',emoji:'🕌'}
    ],
    prep: [
      {id:'arabic',name:'اللغة العربية',emoji:'📖'},
      {id:'math',name:'الرياضيات',emoji:'🧮'},
      {id:'science',name:'العلوم',emoji:'🔬'},
      {id:'english',name:'اللغة الإنجليزية',emoji:'🇬🇧'},
      {id:'social',name:'الدراسات الاجتماعية',emoji:'🌍'},
      {id:'computer',name:'الحاسب الآلي',emoji:'💻'}
    ],
    sec: [
      {id:'arabic',name:'اللغة العربية',emoji:'📖'},
      {id:'english',name:'اللغة الإنجليزية',emoji:'🇬🇧'},
      {id:'math',name:'الرياضيات',emoji:'🧮'},
      {id:'physics',name:'الفيزياء',emoji:'⚛️'},
      {id:'chemistry',name:'الكيمياء',emoji:'🧪'},
      {id:'biology',name:'الأحياء',emoji:'🧬'},
      {id:'history',name:'التاريخ',emoji:'🏛️'},
      {id:'geography',name:'الجغرافيا',emoji:'🌍'}
    ]
  };

  function toast(message, type = 'success') {
    const el = $('toast');
    el.textContent = message;
    el.className = 'toast show ' + type;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.className = 'toast', 3200);
  }

  function friendlyAuthError(error) {
    const map = {
      'auth/email-already-in-use': 'هذا البريد مسجل بالفعل. جرّب تسجيل الدخول.',
      'auth/invalid-email': 'صيغة البريد الإلكتروني غير صحيحة.',
      'auth/weak-password': 'كلمة المرور ضعيفة. استخدم 6 أحرف على الأقل.',
      'auth/user-not-found': 'لا يوجد حساب بهذا البريد.',
      'auth/wrong-password': 'كلمة المرور غير صحيحة.',
      'auth/invalid-login-credentials': 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
      'auth/too-many-requests': 'محاولات كثيرة. انتظر قليلًا ثم جرّب مرة أخرى.',
      'auth/operation-not-allowed': 'تسجيل البريد وكلمة المرور غير مفعل بعد في Firebase. فعّله من Authentication > Sign-in method.'
    };
    return map[error.code] || error.message || 'حدث خطأ غير متوقع.';
  }

  function openModal(id) {
    const el = $(id);
    if (!el) return;
    el.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(id) {
    const el = $(id);
    if (!el) return;
    el.classList.add('hidden');
    if (!$('explorerDrawer').classList.contains('open')) document.body.style.overflow = '';
  }

  function switchAuthTab(tab) {
    $$('[data-auth-tab]').forEach(btn => btn.classList.toggle('active', btn.dataset.authTab === tab));
    $('loginForm').classList.toggle('hidden', tab !== 'login');
    $('registerForm').classList.toggle('hidden', tab !== 'register');
  }

  function updateGradeOptions(stage) {
    const grid = $('gradeGrid');
    const grades = stage === 'primary' ? [1,2,3,4,5,6] : [1,2,3];
    const short = stage === 'primary'
      ? ['الأول','الثاني','الثالث','الرابع','الخامس','السادس']
      : ['الأول','الثاني','الثالث'];
    grid.innerHTML = grades.map((g, i) =>
      `<label><input type="radio" name="grade" value="${g}" required><span>${short[i]}</span></label>`
    ).join('');
  }

  function getSubjects(stage, grade, type) {
    const base = [...(defaults[stage] || [])];
    const custom = state.dbData.customSubjects?.[stage]?.[grade];
    if (Array.isArray(custom)) {
      custom.forEach(s => {
        if (!s || !s.id || !s.name) return;
        if (s.type && s.type !== type) return;
        if (!base.some(x => x.id === s.id)) {
          base.push({ id:s.id, name:s.name, emoji:s.emoji || '⭐' });
        }
      });
    }
    return base;
  }

  function educationLabel(type) {
    return type === 'azhar' ? 'التعليم الأزهري' : 'التعليم العام';
  }

  function subjectProgressOf(profile,subjectId,ctx={}) {
    const type=ctx.type||profile?.educationType||'public';
    const stage=ctx.stage||profile?.stage||'prep';
    const grade=String(ctx.grade||profile?.grade||1);
    const contextual=profile?.subjectProgressV3?.[type]?.[stage]?.[grade]?.[subjectId];
    return contextual===undefined||contextual===null
      ?Number(profile?.subjectProgress?.[subjectId]||0)
      :Number(contextual||0);
  }

  function initials(name = '') {
    return (name.trim()[0] || 'ط').toUpperCase();
  }

  async function loadDatabaseSnapshot() {
    try {
      const [subjectsSnap, announcementsSnap, settingsSnap, postsSnap] = await Promise.all([
        database.ref('customSubjects').once('value'),
        database.ref('announcements').once('value'),
        database.ref('settings').once('value'),
        database.ref('posts').once('value')
      ]);
      state.dbData = {
        customSubjects: subjectsSnap.val() || {},
        announcements: announcementsSnap.val() || {},
        settings: settingsSnap.val() || {},
        posts: postsSnap.val() || {}
      };
    } catch (e) {
      console.warn('Database read unavailable', e);
      state.dbData = {};
    }
  }

  async function loadProfile(uid) {
    const snap = await database.ref('studentProfilesV3/' + uid).once('value');
    return snap.val();
  }

  async function saveProfile(uid, patch) {
    await database.ref('studentProfilesV3/' + uid).update(patch);
  }

  function showPublicExperience() {
    window.AcademyUI?.hidePageLoading();
    $('siteHeader').classList.remove('hidden');
    $('publicExperience').classList.remove('hidden');
    $('publicFooter').classList.remove('hidden');
    $('studentDashboard').classList.add('hidden');
    $('guestNavActions').classList.toggle('hidden', !!state.user);
    $('userNavActions').classList.toggle('hidden', !state.user);
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function showDashboard() {
    if (!state.user || !state.profile?.stage || !state.profile?.grade) {
      showPublicExperience();
      return;
    }
    $('siteHeader').classList.add('hidden');
    $('publicExperience').classList.add('hidden');
    $('publicFooter').classList.add('hidden');
    $('studentDashboard').classList.remove('hidden');
    $('guestNavActions').classList.add('hidden');
    $('userNavActions').classList.remove('hidden');
    renderDashboard();
    window.AcademyUI?.hidePageLoading();
    window.scrollTo({top:0});
  }

  function renderPublicNews() {
    const grid = $('homeNewsGrid');
    if (!grid) return;
    const posts = Object.entries(state.dbData.posts || {})
      .map(([id,v]) => ({id,...(v||{})}))
      .sort((a,b) => Number(b.date || b.createdAt || 0) - Number(a.date || a.createdAt || 0))
      .slice(0,3);
    grid.innerHTML = posts.length
      ? posts.map(n => `<article class="home-news-card">
          <span class="news-date">${n.date ? new Date(n.date).toLocaleDateString('ar-EG',{day:'numeric',month:'long',year:'numeric'}) : ''}</span>
          <h3>${safeHtml(n.title || 'تحديث جديد')}</h3>
          <p>${safeHtml(n.content || '')}</p>
          <a href="./news.html">قراءة الأخبار <i class="fa-solid fa-arrow-left"></i></a>
        </article>`).join('')
      : '<article class="home-news-card"><span class="news-date">الأكاديمية</span><h3>قريبًا تحديثات جديدة</h3><p>ستظهر هنا أحدث الأخبار والإضافات التي تنشرها الإدارة.</p><a href="./news.html">صفحة الأخبار</a></article>';
  }

  function renderHeaderUser() {
    if (!state.user) return;
    const name = state.profile?.name || state.user.displayName || state.user.email?.split('@')[0] || 'الطالب';
    $('headerUserName').textContent = name;
    $('headerAvatar').textContent = initials(name);
    $('headerUserGrade').textContent = state.profile?.stage && state.profile?.grade
      ? gradeLabels[state.profile.stage]?.[state.profile.grade] || 'حساب طالب'
      : 'أكمل إعداد الحساب';
  }

  function animateDashboardNumber(id,target,duration=550){
    const el=$(id);if(!el)return;
    const end=Math.max(0,Number(target||0)),start=Number(el.dataset.current||0),started=performance.now();
    const tick=now=>{
      const t=Math.min(1,(now-started)/duration),ease=1-Math.pow(1-t,3),value=Math.round(start+(end-start)*ease);
      el.textContent=value;el.dataset.current=String(value);
      if(t<1)requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function statsFromProfile() {
    const s = state.profile?.stats || {};
    return {
      xp: Number(s.totalXP || 0),
      level: Number(s.level || Math.max(1, Math.floor((s.totalXP || 0) / 1000) + 1)),
      lessons: Number(s.completedLessons || 0),
      quizzes: Number(s.completedQuizzes || s.totalQuizzes || 0),
      streak: Number(s.streak || 0)
    };
  }


  function safeHtml(value = '') {
    return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  async function updateDailyActivity(uid) {
    const today = new Date().toISOString().slice(0,10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0,10);
    await database.ref('studentProfilesV3/' + uid).transaction(profile => {
      if (!profile) return profile;
      profile.activity = profile.activity || {};
      profile.stats = profile.stats || {};
      const last = profile.activity.lastDate || '';
      if (last !== today) {
        profile.stats.streak = last === yesterday ? Number(profile.stats.streak || 0) + 1 : 1;
        profile.activity.lastDate = today;
      }
      profile.activity.lastSeenAt = Date.now();
      return profile;
    });
  }

  function buildDashboardNotifications() {
    const items = [];
    const ann = state.dbData.announcements;
    if (ann?.isActive && (!ann.expiry || Date.now() < ann.expiry) && ann.text) {
      items.push({icon:'fa-bullhorn',title:'إعلان من الأكاديمية',text:ann.text});
    }
    if (state.profile?.lastLessonTitle) {
      items.push({icon:'fa-circle-play',title:'أكمل من حيث توقفت',text:'ارجع إلى ' + state.profile.lastLessonTitle + ' وكمّل تقدمك.'});
    } else {
      items.push({icon:'fa-rocket',title:'ابدأ أول درس',text:'اختر مادة من موادك وابدأ أول خطوة في رحلتك.'});
    }
    const streak = Number(state.profile?.stats?.streak || 0);
    if (streak >= 2) items.push({icon:'fa-fire',title:'حافظ على السلسلة',text:'أنت مستمر منذ ' + streak + ' أيام. درس قصير اليوم يحافظ عليها.'});
    const xp = Number(state.profile?.stats?.totalXP || 0);
    if (xp < 500) items.push({icon:'fa-star',title:'هدفك القادم',text:'باقي ' + Math.max(0,500-xp) + ' XP للوصول لإنجاز 500 نقطة.'});
    return items.slice(0,4);
  }

  function renderSmartDashboard() {
    const stats = statsFromProfile();
    const p = state.profile || {};
    const subjects = p.stage && p.grade ? getSubjects(p.stage, String(p.grade), p.educationType) : [];
    const weakest = [...subjects].sort((a,b)=>subjectProgressOf(p,a.id)-subjectProgressOf(p,b.id))[0];
    const weakPct = weakest ? subjectProgressOf(p,weakest.id) : 0;
    const achievements = [
      {emoji:'🚀',name:'البداية',ok:stats.lessons>=1},
      {emoji:'📚',name:'5 دروس',ok:stats.lessons>=5},
      {emoji:'🎯',name:'أول اختبار',ok:stats.quizzes>=1},
      {emoji:'⭐',name:'500 XP',ok:stats.xp>=500}
    ];
    let shell = document.getElementById('smartDashboardGrid');
    if (!shell) {
      shell = document.createElement('section');
      shell.id = 'smartDashboardGrid';
      shell.className = 'smart-dashboard-grid';
      const anchor = document.querySelector('.dashboard-bottom-grid');
      if (anchor) anchor.insertAdjacentElement('afterend', shell);
    }
    const notes = buildDashboardNotifications();
    let recommendation = '';
    if (weakest) {
      const q = new URLSearchParams({
        type:p.educationType || 'public',
        stage:p.stage,
        grade:String(p.grade),
        subject:weakest.id
      });
      const advice = weakPct === 0
        ? 'لسه مبدأتش المادة. ابدأ بدرس واحد قصير النهارده.'
        : weakPct < 40
          ? 'دي أقل مادة في تقدمك حاليًا. جلسة 30 دقيقة هتعمل فرق واضح.'
          : 'تقدمك فيها أقل من باقي المواد. راجع درسًا واحدًا وحل تدريبًا.';
      recommendation = `
        <article class="dashboard-smart-card smart-recommendation-card">
          <div class="smart-recommendation-icon">${weakest.emoji || '📚'}</div>
          <div class="smart-recommendation-copy">
            <span class="section-kicker">توصية مخصصة ليك</span>
            <h3>ركّز اليوم على ${safeHtml(weakest.name)}</h3>
            <p>${safeHtml(advice)} تقدمك الحالي: <strong>${weakPct}%</strong>.</p>
            <div class="smart-recommendation-actions">
              <a class="btn btn-primary" href="./subject.html?${q.toString()}">ابدأ المذاكرة <i class="fa-solid fa-arrow-left"></i></a>
              <a class="btn btn-soft" href="./planner.html">أضفها لخطة اليوم</a>
            </div>
          </div>
          <div class="smart-recommendation-progress"><span>${weakPct}%</span><div class="progress"><i style="width:${Math.max(4,weakPct)}%"></i></div><small>تقدم المادة</small></div>
        </article>`;
    }
    shell.innerHTML = `
      ${recommendation}
      <article class="dashboard-smart-card">
        <div class="smart-card-head"><div><span class="section-kicker">رحلتك تتحسن</span><h3>إنجازاتك</h3></div><span>🏆</span></div>
        <div class="achievement-row">
          ${achievements.map(a=>`<div class="achievement-mini ${a.ok?'':'locked'}"><span>${a.emoji}</span><strong>${a.name}</strong></div>`).join('')}
        </div>
        <a href="./profile.html" class="text-btn" style="margin-top:14px">عرض كل الإنجازات <i class="fa-solid fa-arrow-left"></i></a>
      </article>
      <article class="dashboard-smart-card">
        <div class="smart-card-head"><div><span class="section-kicker">مهم لك الآن</span><h3>الإشعارات</h3></div><span>🔔</span></div>
        <div class="notification-list">
          ${notes.slice(0,3).map(n=>`<div class="notification-item"><span><i class="fa-solid ${n.icon}"></i></span><div><strong>${safeHtml(n.title)}</strong><p>${safeHtml(n.text)}</p></div></div>`).join('')}
        </div>
      </article>`;
  }

  function showNotificationPopover() {
    document.getElementById('notificationPopover')?.remove();
    const notes = buildDashboardNotifications();
    const box = document.createElement('div');
    box.id = 'notificationPopover';
    box.className = 'notification-popover';
    box.innerHTML = '<h3>إشعاراتك</h3><div class="notification-list">' +
      notes.map(n=>`<div class="notification-item"><span><i class="fa-solid ${n.icon}"></i></span><div><strong>${safeHtml(n.title)}</strong><p>${safeHtml(n.text)}</p></div></div>`).join('') +
      '</div>';
    document.body.appendChild(box);
    setTimeout(()=>document.addEventListener('click', function closer(e){
      if (!e.target.closest('#notificationPopover') && !e.target.closest('#notificationBtn') && !e.target.closest('#dashNotificationBtn')) {
        box.remove(); document.removeEventListener('click', closer);
      }
    }),0);
  }

  function todayKey() {
    return new Date().toISOString().slice(0,10);
  }

  function renderDailyGoals(goals = {}) {
    const keys=['lesson','quiz','review'];
    const done=keys.filter(k=>goals?.[k]).length;
    const pct=Math.round(done/keys.length*100);
    const ring=$('dailyGoalRing');
    if(ring) ring.style.background='conic-gradient(#2563eb '+(pct*3.6)+'deg,#e8eef7 0deg)';
    if($('dailyGoalPercent')) $('dailyGoalPercent').textContent=pct+'%';
    if($('dailyGoalCount')) $('dailyGoalCount').textContent=done+' من 3 مكتمل';
    if($('pulseChallengeState')) $('pulseChallengeState').textContent=done+' / 3';
    if($('dailyGoalMessage')) {
      $('dailyGoalMessage').textContent=done===3?'ممتاز! أنهيت تحدي اليوم بالكامل 🎉':done===2?'باقي خطوة واحدة فقط، كمّلها 💪':done===1?'بداية ممتازة، كمّل خطوتين كمان.':'ابدأ بخطوة صغيرة وخلي اليوم يتحسب لك.';
    }
    $$('[data-daily-goal]').forEach(btn=>{
      const key=btn.dataset.dailyGoal,complete=!!goals?.[key];
      btn.classList.toggle('completed',complete);
      const icon=btn.querySelector('.goal-state');
      if(icon) icon.className=complete?'fa-solid fa-circle-check goal-state':'fa-regular fa-circle goal-state';
    });
  }

  async function loadDailyGoals() {
    if(!state.user)return;
    try{
      const snap=await database.ref('studentProfilesV3/'+state.user.uid+'/dailyGoals/'+todayKey()).once('value');
      renderDailyGoals(snap.val()||{});
    }catch(e){console.warn('Daily goals load failed',e)}
  }

  async function toggleDailyGoal(key) {
    if(!state.user||!key)return;
    const ref=database.ref('studentProfilesV3/'+state.user.uid+'/dailyGoals/'+todayKey()+'/'+key);
    try{
      await ref.transaction(v=>!v);
      await loadDailyGoals();
    }catch(e){toast('تعذر تحديث تحدي اليوم.','error')}
  }

  function initDashboardSidebar() {
    const shell=$('studentDashboard');
    if(!shell)return;
    const saved=localStorage.getItem('academySidebarCollapsed')==='1';
    shell.classList.toggle('sidebar-collapsed',saved);
    $('sidebarCollapseBtn')?.addEventListener('click',()=>{
      shell.classList.toggle('sidebar-collapsed');
      localStorage.setItem('academySidebarCollapsed',shell.classList.contains('sidebar-collapsed')?'1':'0');
    });
    $('dashboardMoreToggle')?.addEventListener('click',()=>{
      $('dashboardMoreMenu')?.classList.toggle('hidden');
      $('dashboardMoreToggle')?.classList.toggle('open');
    });
    $$('[data-nav-label]').forEach(btn=>btn.addEventListener('click',()=>{
      if(btn.id==='dashHomeBtn'||btn.id==='dashSubjectsBtn'){
        $$('[data-nav-label]').forEach(x=>x.classList.remove('active'));
        btn.classList.add('active');
      }
      document.querySelector('.dashboard-sidebar')?.classList.remove('open');
    }));
  }

  function nextWeeklyDate(dayOfWeek,time='18:00') {
    const now=new Date(),d=new Date(now);
    const diff=(Number(dayOfWeek)-now.getDay()+7)%7;
    d.setDate(now.getDate()+diff);
    const [h,m]=String(time||'18:00').split(':').map(Number);
    d.setHours(h||0,m||0,0,0);
    if(d.getTime()<Date.now()-60000)d.setDate(d.getDate()+7);
    return d.getTime();
  }

  async function loadDashboardPulse() {
    if(!state.user||!state.profile)return;
    const p=state.profile,uid=state.user.uid,now=Date.now();
    try{
      const [plannerSnap,assignSnap,scheduleSnap]=await Promise.all([
        database.ref('studentProfilesV3/'+uid+'/studyPlanner').once('value'),
        database.ref('assignments').orderByChild('stage').equalTo(p.stage).once('value'),
        database.ref('scheduleEvents').orderByChild('stage').equalTo(p.stage).once('value')
      ]);
      const candidates=[];
      const today=todayKey();

      Object.entries(plannerSnap.val()||{}).forEach(([id,t])=>{
        if(!t||t.done||!t.date)return;
        const isToday=t.date===today;
        const at=new Date(t.date+'T18:00:00').getTime();
        if(isToday || at>=now){
          candidates.push({
            kind:'planner',
            rank:isToday?0:4,
            at,
            title:isToday?'كمّل مهمة المذاكرة دي النهارده':'مهمة مذاكرة قادمة',
            text:t.title||'مهمة مذاكرة',
            href:'./planner.html'
          });
        }
      });

      const assignments=Object.entries(assignSnap.val()||{}).map(([id,a])=>({id,...(a||{})}))
        .filter(a=>!a.isHidden && a.type===p.educationType && a.stage===p.stage && String(a.grade)===String(p.grade) && Number(a.dueAt||0)>=now);
      const nearAssignments=assignments.sort((a,b)=>Number(a.dueAt||0)-Number(b.dueAt||0)).slice(0,8);
      const submissionSnaps=await Promise.all(nearAssignments.map(a=>database.ref('assignmentSubmissions/'+a.id+'/'+uid).once('value')));
      nearAssignments.forEach((a,i)=>{
        const s=submissionSnaps[i].val();
        if(s)return;
        const diff=Number(a.dueAt)-now;
        candidates.push({
          kind:'assignment',
          rank:diff<=86400000?1:3,
          at:Number(a.dueAt),
          title:diff<=86400000?'واجب محتاج تسليمه قريب':'عندك واجب قادم',
          text:a.title||'واجب دراسي',
          href:'./assignments.html'
        });
      });

      Object.entries(scheduleSnap.val()||{}).forEach(([id,e])=>{
        if(!e||e.isActive===false)return;
        if(e.type&&e.type!==p.educationType)return;
        if(e.stage&&e.stage!==p.stage)return;
        if(e.grade&&String(e.grade)!==String(p.grade))return;
        const at=nextWeeklyDate(e.dayOfWeek,e.time||'18:00');
        const diff=at-now;
        if(diff<=3*86400000){
          candidates.push({
            kind:'schedule',
            rank:diff<=6*3600000?2:5,
            at,
            title:diff<=6*3600000?'عندك حصة قريبة':'الحصة القادمة',
            text:(e.title||'حصة دراسية')+(e.teacher?' • '+e.teacher:''),
            href:'./schedule.html'
          });
        }
      });

      candidates.sort((a,b)=>a.rank-b.rank || a.at-b.at);
      let pick=candidates[0];

      if(!pick){
        const subjects=getSubjects(p.stage,String(p.grade),p.educationType);
        const weak=[...subjects].sort((a,b)=>subjectProgressOf(p,a.id)-subjectProgressOf(p,b.id))[0];
        if(weak){
          const q=new URLSearchParams({type:p.educationType,stage:p.stage,grade:String(p.grade),subject:weak.id});
          pick={title:'ابدأ خطوة خفيفة في '+weak.name,text:'مفيش التزامات عاجلة دلوقتي. درس واحد كفاية كبداية.',href:'./subject.html?'+q.toString(),at:0};
        }
      }

      if(pick){
        $('pulseActionTitle').textContent=pick.title;
        $('pulseActionText').textContent=pick.text;
        $('pulseActionBtn').onclick=()=>location.href=pick.href;
      }else{
        $('pulseActionTitle').textContent='أنت محدث كل شيء 🎉';
        $('pulseActionText').textContent='استكشف مادة جديدة أو راجع درسًا قديمًا.';
        $('pulseActionBtn').onclick=()=>location.href='./explore.html';
      }

      const next=candidates.filter(x=>x.at>=now).sort((a,b)=>a.at-b.at)[0];
      if($('pulseNextTime')){
        $('pulseNextTime').textContent=next
          ? new Date(next.at).toLocaleString('ar-EG',{weekday:'short',hour:'numeric',minute:'2-digit'})
          : 'لا يوجد موعد قريب';
      }
    }catch(e){
      console.warn('Dashboard pulse failed',e);
      if($('pulseActionTitle'))$('pulseActionTitle').textContent='ابدأ من موادك الدراسية';
      if($('pulseActionText'))$('pulseActionText').textContent='اختر مادة وابدأ درسًا قصيرًا.';
      if($('pulseActionBtn'))$('pulseActionBtn').onclick=()=>document.querySelector('.dashboard-section')?.scrollIntoView({behavior:'smooth'});
    }
  }

  function renderDashboard() {
    const p = state.profile;
    const name = p.name || state.user.displayName || 'طالبنا';
    const stats = statsFromProfile();
    const subjects = getSubjects(p.stage, String(p.grade), p.educationType);

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'صباح الخير' : hour < 18 ? 'أهلًا' : 'مساء الخير';
    const greetingEl=document.querySelector('.dashboard-greeting');
    if(greetingEl) greetingEl.childNodes[0].textContent=greeting+' ';
    $('dashStudentName').textContent = name;
    if($('dashTodayLabel')){
      const today=new Intl.DateTimeFormat('ar-EG',{weekday:'long',day:'numeric',month:'long'}).format(new Date());
      $('dashTodayLabel').textContent=today+' • كل خطوة صغيرة بتفرق';
    }
    if ($('dashAccountName')) $('dashAccountName').textContent = name;
    if ($('dashAccountAvatar')) $('dashAccountAvatar').textContent = initials(name);
    $('currentGradeTitle').textContent = gradeLabels[p.stage]?.[p.grade] || stageLabels[p.stage] || 'مرحلتك الدراسية';
    $('currentEducationTitle').textContent = educationLabel(p.educationType);
    animateDashboardNumber('levelNumber',stats.level,400);
    animateDashboardNumber('xpValue',stats.xp % 1000,600);
    animateDashboardNumber('xpStat',stats.xp,650);
    animateDashboardNumber('completedLessons',stats.lessons,500);
    animateDashboardNumber('completedQuizzes',stats.quizzes,500);
    animateDashboardNumber('streakValue',stats.streak,450);
    const levelXp=stats.xp % 1000;
    $('xpProgress').style.width = Math.min(100, levelXp / 10) + '%';
    $('xpProgressTrack')?.setAttribute('aria-valuenow',String(levelXp));

    $('dashboardSubjects').innerHTML = subjects.map((s) => {
      const progress = Math.max(0, Math.min(100, subjectProgressOf(p,s.id)));
      const q = new URLSearchParams({
        type: p.educationType,
        stage: p.stage,
        grade: String(p.grade),
        subject: s.id
      });
      const status = progress >= 100 ? 'مكتملة' : progress > 0 ? 'قيد التعلّم' : 'جاهزة للبدء';
      return `<a class="dash-subject-card" href="./subject.html?${q.toString()}" aria-label="فتح مادة ${safeHtml(s.name)}">
        <div class="dash-subject-card-head">
          <span class="emoji">${safeHtml(s.emoji || '📚')}</span>
          <span class="subject-status ${progress >= 100 ? 'complete' : progress > 0 ? 'active' : ''}">${status}</span>
        </div>
        <h3>${safeHtml(s.name)}</h3>
        <p>${progress ? 'أكمل من حيث توقفت' : 'ابدأ أول درس في المادة'}</p>
        <div class="progress" role="progressbar" aria-label="تقدمك في ${safeHtml(s.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><span style="width:${progress}%"></span></div>
        <footer><span>${progress}% مكتمل</span><strong>فتح المادة <i class="fa-solid fa-arrow-left"></i></strong></footer>
      </a>`;
    }).join('');

    const first = subjects[0];
    const lastSubject = subjects.find(s => s.id === p.lastSubjectId) || first;
    if (lastSubject) {
      $('continueTitle').textContent = p.lastLessonTitle || `ابدأ أول درس في ${lastSubject.name}`;
      $('continueMeta').textContent = p.lastLessonTitle
        ? `${lastSubject.name} • ${gradeLabels[p.stage]?.[p.grade] || ''}`
        : 'اختر المادة وابدأ، وسنحفظ تقدمك تلقائيًا.';
      $('continueLearningBtn').onclick = () => {
        const q = new URLSearchParams({
          type: p.educationType,
          stage: p.stage,
          grade: String(p.grade),
          subject: lastSubject.id
        });
        if (p.lastLessonId) q.set('id', p.lastLessonId);
        location.href = p.lastLessonId
          ? './lesson.html?' + q.toString()
          : './subject.html?' + q.toString();
      };
    }
    loadDailyGoals();
    loadDashboardPulse();
    renderSmartDashboard();
    renderHeaderUser();
  }

  function renderExplorerStages() {
    const list = $('explorerStageList');
    const query = state.explorer.search.toLowerCase().trim();
    const types = state.explorer.type === 'all' ? ['public','azhar'] : [state.explorer.type];
    const rows = [];

    types.forEach(type => {
      ['primary','prep','sec'].forEach(stage => {
        const title = `${stageLabels[stage]} • ${educationLabel(type)}`;
        if (query && !title.toLowerCase().includes(query)) return;
        rows.push({type,stage,title,emoji: stage==='primary'?'🎒':stage==='prep'?'📚':'🎓'});
      });
    });

    list.innerHTML = rows.map(r => `<article class="explorer-stage-item" data-explorer-stage="${r.stage}" data-explorer-type="${r.type}">
      <span class="emoji">${r.type==='azhar'?'🕌':r.emoji}</span>
      <div><strong>${r.title}</strong><small>استكشف الصفوف والمواد المتاحة بدون تغيير مرحلتك الأساسية.</small></div>
      <button aria-label="استكشف"><i class="fa-solid fa-arrow-left"></i></button>
    </article>`).join('') || '<p>لا توجد نتائج مطابقة.</p>';
  }

  function allExplorerSubjects() {
    const seen = new Map();
    Object.keys(defaults).forEach(stage => defaults[stage].forEach(s => seen.set(s.id, s)));
    const customSubjects = state.dbData.customSubjects || {};
    Object.entries(customSubjects).forEach(([stage, grades]) => {
      Object.values(grades || {}).forEach(arr => {
        if (!Array.isArray(arr)) return;
        arr.forEach(s => { if (s?.id && s?.name && !seen.has(s.id)) seen.set(s.id,{id:s.id,name:s.name,emoji:s.emoji||'⭐'}); });
      });
    });
    return [...seen.values()];
  }

  function renderExplorerSubjects(subjects = null, context = null) {
    const query = state.explorer.search.toLowerCase().trim();
    const items = subjects || allExplorerSubjects();
    $('explorerSubjectList').innerHTML = items
      .filter(s => !query || s.name.toLowerCase().includes(query))
      .map(s => `<article class="explorer-subject-item">
        <span class="emoji">${s.emoji || '📚'}</span>
        <div><strong>${s.name}</strong><small>${context || 'متاحة في مراحل مختلفة حسب المنهج'}</small></div>
        <button aria-label="فتح المادة"><i class="fa-solid fa-arrow-left"></i></button>
      </article>`).join('') || '<p>لا توجد مواد مطابقة.</p>';
  }

  function switchExplorerTab(tab) {
    state.explorer.tab = tab;
    $$('[data-explorer-tab]').forEach(b => b.classList.toggle('active', b.dataset.explorerTab === tab));
    $('explorerStagesView').classList.toggle('hidden', tab !== 'stages');
    $('explorerSubjectsView').classList.toggle('hidden', tab !== 'subjects');
    if (tab === 'stages') renderExplorerStages(); else renderExplorerSubjects();
  }

  function openExplorer(type = 'all', stage = null) {
    state.explorer.type = type || 'all';
    state.explorer.stage = stage || null;
    state.explorer.search = '';
    $('explorerSearch').value = '';
    $$('[data-type-filter]').forEach(b => b.classList.toggle('active', b.dataset.typeFilter === state.explorer.type));
    switchExplorerTab('stages');
    $('explorerBackdrop').classList.remove('hidden');
    $('explorerDrawer').classList.add('open');
    document.body.style.overflow = 'hidden';

    if (stage && type && type !== 'all') {
      const subjects = getSubjects(stage, '1', type);
      switchExplorerTab('subjects');
      renderExplorerSubjects(subjects, `${stageLabels[stage]} • ${educationLabel(type)}`);
    }
  }

  function closeExplorer() {
    $('explorerDrawer').classList.remove('open');
    $('explorerBackdrop').classList.add('hidden');
    document.body.style.overflow = '';
  }

  function bindEvents() {
    $('year').textContent = new Date().getFullYear();

    $$('[data-open-auth]').forEach(btn => btn.addEventListener('click', () => {
      switchAuthTab(btn.dataset.openAuth);
      openModal('authModal');
    }));

    $$('[data-close-modal]').forEach(btn => btn.addEventListener('click', () => closeModal(btn.dataset.closeModal)));
    $$('[data-auth-tab]').forEach(btn => btn.addEventListener('click', () => switchAuthTab(btn.dataset.authTab)));

    $$('[data-toggle-pass]').forEach(btn => btn.addEventListener('click', () => {
      const input = $(btn.dataset.togglePass);
      input.type = input.type === 'password' ? 'text' : 'password';
      btn.innerHTML = input.type === 'password' ? '<i class="fa-regular fa-eye"></i>' : '<i class="fa-regular fa-eye-slash"></i>';
    }));

    $('mobileMenuBtn').addEventListener('click', () => $('mobileMenu').classList.toggle('hidden'));
    const dashSearchInput = $('dashSearchInput');
    const dashSearchForm = $('dashSearchForm');
    dashSearchForm?.addEventListener('submit',e=>{
      e.preventDefault();
      const q=dashSearchInput?.value.trim()||'';
      if(q)location.href='./search.html?q='+encodeURIComponent(q);
      else dashSearchInput?.focus();
    });
    $('userChip').addEventListener('click', () => $('userMenu').classList.toggle('hidden'));
    if (!document.getElementById('profileMenuBtn')) {
      const profileBtn = document.createElement('button');
      profileBtn.id = 'profileMenuBtn';
      profileBtn.innerHTML = '<i class="fa-regular fa-user"></i> حسابي';
      profileBtn.addEventListener('click', () => location.href='./profile.html');
      $('userMenu').insertBefore(profileBtn, $('logoutBtn'));
    }
    $('mobileProfileBtn')?.addEventListener('click', () => location.href='./profile.html');
    $('notificationBtn')?.addEventListener('click', (e) => { e.stopPropagation(); showNotificationPopover(); });
    $('dashNotificationBtn')?.addEventListener('click', (e) => { e.stopPropagation(); showNotificationPopover(); });
    $('goDashboardBtn').addEventListener('click', showDashboard);
    $('exploreFromMenu').addEventListener('click', () => location.href='./explore.html');
    $('logoutBtn').addEventListener('click', async () => { await auth.signOut(); $('userMenu').classList.add('hidden'); });

    $('dashProfileBtn')?.addEventListener('click', () => location.href='./profile.html?tab=account');
    $('dashStudySettingsBtn')?.addEventListener('click', () => location.href='./profile.html?tab=study');
    $('dashChangeStudyBtn')?.addEventListener('click', () => location.href='./profile.html?tab=study');
    $('dashAccountProfile')?.addEventListener('click', () => location.href='./profile.html?tab=account');
    $('dashAccountStudy')?.addEventListener('click', () => location.href='./profile.html?tab=study');
    $('dashAccountBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      $('dashAccountMenu')?.classList.toggle('hidden');
    });
    const dashboardLogout = async () => {
      await auth.signOut();
      location.replace('./index.html');
    };
    $('dashLogoutBtn')?.addEventListener('click', dashboardLogout);
    $('dashAccountLogout')?.addEventListener('click', dashboardLogout);

    const loginForm = $('loginForm');
    if (loginForm && loginForm.dataset.authBound !== 'true') {
      loginForm.dataset.authBound = 'true';
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = $('loginSubmitBtn');
        btn.disabled = true; btn.textContent = 'جاري تسجيل الدخول...';
        try {
          await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
          await auth.signInWithEmailAndPassword($('loginEmail').value.trim(), $('loginPassword').value);
          closeModal('authModal');
          toast('تم تسجيل الدخول بنجاح 👋');
        } catch (error) {
          toast(friendlyAuthError(error), 'error');
        } finally {
          btn.disabled = false; btn.textContent = 'تسجيل الدخول';
        }
      });
    }

    $('registerForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('registerSubmitBtn');
      const name = $('registerName').value.trim();
      btn.disabled = true; btn.textContent = 'جاري إنشاء الحساب...';
      try {
        const cred = await auth.createUserWithEmailAndPassword($('registerEmail').value.trim(), $('registerPassword').value);
        await cred.user.updateProfile({displayName:name});
        await saveProfile(cred.user.uid, {
          name,
          email: cred.user.email,
          createdAt: firebase.database.ServerValue.TIMESTAMP,
          stats: { totalXP:0, level:1, completedLessons:0, completedQuizzes:0, streak:0 }
        });
        state.profile = await loadProfile(cred.user.uid);
        closeModal('authModal');
        openModal('onboardingModal');
        toast('تم إنشاء الحساب. اختر مرحلتك الآن ✨');
      } catch (error) {
        toast(friendlyAuthError(error), 'error');
      } finally {
        btn.disabled = false; btn.textContent = 'متابعة واختيار المرحلة';
      }
    });

    $('forgotPasswordBtn').addEventListener('click', async () => {
      const email = $('loginEmail').value.trim();
      if (!email) return toast('اكتب بريدك الإلكتروني أولًا.', 'error');
      try {
        await auth.sendPasswordResetEmail(email);
        toast('أرسلنا لك رابط إعادة تعيين كلمة المرور.');
      } catch (error) {
        toast(friendlyAuthError(error), 'error');
      }
    });

    $$('input[name="stage"]').forEach(input => input.addEventListener('change', () => updateGradeOptions(input.value)));

    $('onboardingForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const type = document.querySelector('input[name="educationType"]:checked')?.value;
      const stage = document.querySelector('input[name="stage"]:checked')?.value;
      const grade = document.querySelector('input[name="grade"]:checked')?.value;
      if (!type || !stage || !grade) return toast('اختر نوع التعليم والمرحلة والصف.', 'error');
      try {
        await saveProfile(state.user.uid, {
          educationType:type,
          stage,
          grade:Number(grade),
          onboardingCompleted:true,
          updatedAt:firebase.database.ServerValue.TIMESTAMP
        });
        state.profile = await loadProfile(state.user.uid);
        closeModal('onboardingModal');
        showDashboard();
        toast('تم تجهيز تجربتك التعليمية بنجاح 🎉');
      } catch (error) {
        toast('تعذر حفظ المرحلة. حاول مرة أخرى.', 'error');
      }
    });

    $('openExplorerPublic').addEventListener('click', () => openExplorer());
    $('openSubjectsExplorer').addEventListener('click', () => { openExplorer(); switchExplorerTab('subjects'); });
    $('exploreAllStagesMain').addEventListener('click', () => location.href='./explore.html');
    $('dashHomeBtn')?.addEventListener('click', () => window.scrollTo({top:0,behavior:'smooth'}));
    $('dashSubjectsBtn')?.addEventListener('click', () => document.querySelector('.dashboard-section')?.scrollIntoView({behavior:'smooth'}));
    $('dashTestsBtn')?.addEventListener('click', () => location.href='./exam-center.html');
    $('dashProgressBtn')?.addEventListener('click', () => location.href='./progress.html');
    $('dashPlannerBtn')?.addEventListener('click', () => location.href='./planner.html');
    $('dashSimulationsBtn')?.addEventListener('click', () => location.href='./simulations.html');
    $('dashLibraryBtn')?.addEventListener('click', () => location.href='./library.html');
    $('dashLiveBtn')?.addEventListener('click', () => location.href='./live.html');
    $('dashCommunityBtn')?.addEventListener('click', () => location.href='./community.html');
    $('dashLeaderboardBtn')?.addEventListener('click', () => location.href='./leaderboard.html');
    $('exploreAllStagesSide').addEventListener('click', () => location.href='./explore.html');
    $('exploreSubjectsDash').addEventListener('click', () => location.href='./explore.html');
    $('mobileExploreBtn').addEventListener('click', () => location.href='./explore.html');
    $('mobileSubjectsBtn').addEventListener('click', () => document.querySelector('.dashboard-section')?.scrollIntoView({behavior:'smooth'}));
    $('mobileTestsBtn')?.addEventListener('click', () => location.href='./exam-center.html');
    $('mobileHomeBtn')?.addEventListener('click', () => window.scrollTo({top:0,behavior:'smooth'}));
    $('closeExplorer').addEventListener('click', closeExplorer);
    $('explorerBackdrop').addEventListener('click', closeExplorer);

    $$('[data-explore-type][data-explore-stage]').forEach(card => card.addEventListener('click', () => openExplorer(card.dataset.exploreType, card.dataset.exploreStage)));

    $$('[data-type-filter]').forEach(btn => btn.addEventListener('click', () => {
      state.explorer.type = btn.dataset.typeFilter;
      $$('[data-type-filter]').forEach(b => b.classList.toggle('active', b === btn));
      renderExplorerStages();
    }));

    $$('[data-explorer-tab]').forEach(btn => btn.addEventListener('click', () => switchExplorerTab(btn.dataset.explorerTab)));

    $('explorerSearch').addEventListener('input', (e) => {
      state.explorer.search = e.target.value;
      if (state.explorer.tab === 'stages') renderExplorerStages(); else renderExplorerSubjects();
    });

    $('explorerStageList').addEventListener('click', (e) => {
      const row = e.target.closest('[data-explorer-stage]');
      if (!row) return;
      const stage = row.dataset.explorerStage;
      const type = row.dataset.explorerType;
      const subjects = getSubjects(stage, '1', type);
      switchExplorerTab('subjects');
      renderExplorerSubjects(subjects, `${stageLabels[stage]} • ${educationLabel(type)}`);
    });

    $('dashMobileMenu').addEventListener('click', () => document.querySelector('.dashboard-sidebar').classList.toggle('open'));

    initDashboardSidebar();
    $$('[data-daily-goal]').forEach(btn=>btn.addEventListener('click',()=>toggleDailyGoal(btn.dataset.dailyGoal)));
    $('dailyQuickStart')?.addEventListener('click',()=>{
      const firstIncomplete=$$('[data-daily-goal]').find(btn=>!btn.classList.contains('completed'));
      const key=firstIncomplete?.dataset.dailyGoal||'lesson';
      if(key==='lesson') $('continueLearningBtn')?.click();
      else if(key==='quiz') location.href='./exam-center.html';
      else location.href='./progress.html';
    });


    document.addEventListener('click', (e) => {
      if (!e.target.closest('#userChip') && !e.target.closest('#userMenu')) $('userMenu')?.classList.add('hidden');
      if (!e.target.closest('#dashAccountBtn') && !e.target.closest('#dashAccountMenu')) $('dashAccountMenu')?.classList.add('hidden');
    });
  }

  auth.onAuthStateChanged(async user => {
    state.user = user;
    if (!user) {
      state.profile = null;
      showPublicExperience();
      $('guestNavActions').classList.remove('hidden');
      $('userNavActions').classList.add('hidden');
      return;
    }

    window.AcademyUI?.showPageLoading('جاري تجهيز مساحتك التعليمية...');
    try {
      if(!baseDataPromise) baseDataPromise=loadDatabaseSnapshot();
      await baseDataPromise;
      state.profile = await loadProfile(user.uid);
      await updateDailyActivity(user.uid);
      state.profile = await loadProfile(user.uid);
    } catch (e) {
      console.warn(e);
      state.profile = null;
    }

    renderHeaderUser();

    if (!state.profile?.onboardingCompleted || !state.profile?.stage || !state.profile?.grade) {
      showPublicExperience();
      openModal('onboardingModal');
    } else {
      showDashboard();
    }
  });

  async function init() {
    bindEvents();
    if(!baseDataPromise) baseDataPromise=loadDatabaseSnapshot();
    await baseDataPromise;
    renderPublicNews();
    renderExplorerStages();
    renderExplorerSubjects();
  }

  init();
})();