(() => {
  'use strict';

  const firebaseConfig = {
    apiKey: "AIzaSyDyaSx72GXPLZqvfinZm6lpWvtLi3jvrR4",
    authDomain: "talebyg-a2609.firebaseapp.com",
    databaseURL: "https://talebyg-a2609-default-rtdb.firebaseio.com",
    projectId: "talebyg-a2609",
    storageBucket: "talebyg-a2609.firebasestorage.app"
  };

  localStorage.setItem('academyFirebaseConfig', JSON.stringify(firebaseConfig));
  firebase.initializeApp(firebaseConfig);
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

  function initials(name = '') {
    return (name.trim()[0] || 'ط').toUpperCase();
  }

  async function loadDatabaseSnapshot() {
    try {
      const snap = await database.ref('/').once('value');
      state.dbData = snap.val() || {};
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
    $('publicExperience').classList.add('hidden');
    $('publicFooter').classList.add('hidden');
    $('studentDashboard').classList.remove('hidden');
    $('guestNavActions').classList.add('hidden');
    $('userNavActions').classList.remove('hidden');
    renderDashboard();
    window.scrollTo({top:0});
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

  function renderDashboard() {
    const p = state.profile;
    const name = p.name || state.user.displayName || 'طالبنا';
    const stats = statsFromProfile();
    const subjects = getSubjects(p.stage, String(p.grade), p.educationType);

    $('dashStudentName').textContent = name;
    $('currentGradeTitle').textContent = gradeLabels[p.stage]?.[p.grade] || stageLabels[p.stage] || 'مرحلتك الدراسية';
    $('currentEducationTitle').textContent = educationLabel(p.educationType);
    $('levelNumber').textContent = stats.level;
    $('xpValue').textContent = stats.xp % 1000;
    $('xpStat').textContent = stats.xp;
    $('completedLessons').textContent = stats.lessons;
    $('completedQuizzes').textContent = stats.quizzes;
    $('streakValue').textContent = stats.streak;
    $('xpProgress').style.width = Math.min(100, (stats.xp % 1000) / 10) + '%';

    const subjectProgress = p.subjectProgress || {};
    $('dashboardSubjects').innerHTML = subjects.map((s, i) => {
      const progress = Math.max(0, Math.min(100, Number(subjectProgress[s.id] || 0)));
      return `<article class="dash-subject-card" data-subject="${s.id}">
        <span class="emoji">${s.emoji}</span>
        <h3>${s.name}</h3>
        <p>${progress ? 'أكمل من حيث توقفت' : 'ابدأ أول درس في المادة'}</p>
        <div class="progress"><span style="width:${progress}%"></span></div>
        <footer><span>${progress}% مكتمل</span><strong>فتح المادة ←</strong></footer>
      </article>`;
    }).join('');

    $('.dash-subject-card').forEach(card => {
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => {
        const subjectId = card.dataset.subject;
        const q = new URLSearchParams({
          type: p.educationType,
          stage: p.stage,
          grade: String(p.grade),
          subject: subjectId
        });
        location.href = './subject.html?' + q.toString();
      });
    });

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
    $('userChip').addEventListener('click', () => $('userMenu').classList.toggle('hidden'));
    $('goDashboardBtn').addEventListener('click', showDashboard);
    $('exploreFromMenu').addEventListener('click', () => openExplorer());
    $('logoutBtn').addEventListener('click', async () => { await auth.signOut(); $('userMenu').classList.add('hidden'); });

    $('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('loginSubmitBtn');
      btn.disabled = true; btn.textContent = 'جاري تسجيل الدخول...';
      try {
        await auth.signInWithEmailAndPassword($('loginEmail').value.trim(), $('loginPassword').value);
        closeModal('authModal');
        toast('تم تسجيل الدخول بنجاح 👋');
      } catch (error) {
        toast(friendlyAuthError(error), 'error');
      } finally {
        btn.disabled = false; btn.textContent = 'تسجيل الدخول';
      }
    });

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
    $('exploreAllStagesMain').addEventListener('click', () => openExplorer());
    $('exploreAllStagesSide').addEventListener('click', () => openExplorer());
    $('exploreSubjectsDash').addEventListener('click', () => { openExplorer(); switchExplorerTab('subjects'); });
    $('mobileExploreBtn').addEventListener('click', () => openExplorer());
    $('mobileSubjectsBtn').addEventListener('click', () => document.querySelector('.dashboard-section')?.scrollIntoView({behavior:'smooth'}));
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


    document.addEventListener('click', (e) => {
      if (!e.target.closest('#userChip') && !e.target.closest('#userMenu')) $('userMenu')?.classList.add('hidden');
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

    try {
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
    await loadDatabaseSnapshot();
    renderExplorerStages();
    renderExplorerSubjects();
  }

  init();
})();