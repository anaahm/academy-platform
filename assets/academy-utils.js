/* Shared, dependency-free validation for every academy surface. */
(() => {
  'use strict';
  function safeUrl(value, base = location.href) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      const url = new URL(value.trim(), base);
      return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
    } catch { return ''; }
  }
  function youtubeEmbed(value) {
    const safe = safeUrl(value);
    if (!safe) return '';
    const url = new URL(safe), host = url.hostname.toLowerCase().replace(/^www\./, '');
    let id = '';
    if (host === 'youtu.be') id = url.pathname.split('/')[1];
    else if (['youtube.com', 'm.youtube.com', 'youtube-nocookie.com'].includes(host)) {
      id = /^\/(?:embed|live|shorts)\//.test(url.pathname) ? url.pathname.split('/')[2] : url.searchParams.get('v');
    }
    return /^[\w-]{11}$/.test(id || '') ? 'https://www.youtube-nocookie.com/embed/' + id + '?rel=0' : '';
  }
  function validateQuestions(input) {
    if (!Array.isArray(input)) throw new Error('الأسئلة يجب أن تكون قائمة JSON.');
    return input.map((q, i) => {
      const text = q?.text ?? q?.question, opts = q?.opts ?? q?.options;
      const answer = q?.correctAnswer;
      if (typeof text !== 'string' || !text.trim() || !Array.isArray(opts) || opts.length < 2 ||
          opts.some(o => typeof o !== 'string' || !o.trim()) ||
          !['number', 'string'].includes(typeof answer) || String(answer).trim() === '' ||
          !Number.isInteger(Number(answer)) || Number(answer) < 0 || Number(answer) >= opts.length) {
        throw new Error('راجع السؤال رقم ' + (i + 1) + ': النص والاختيارات مطلوبة، ورقم الإجابة يبدأ من 0 ويجب أن يكون ضمن الاختيارات.');
      }
      return {...q, text: text.trim(), opts: opts.map(o => o.trim()), correctAnswer: Number(answer)};
    });
  }
  function matchesStudent(item, profile) {
    return !!item && item.isHidden !== true && item.isActive !== false &&
      (!item.type || item.type === profile.educationType) &&
      (!item.stage || item.stage === profile.stage) &&
      (!item.grade || String(item.grade) === String(profile.grade));
  }
  window.AcademyUtils = {safeUrl, youtubeEmbed, validateQuestions, matchesStudent};
})();
