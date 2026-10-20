'use strict';

(() => {
  const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
  const KEYS = {
    apiKey: 'crh.apiKey',
    model: 'crh.model',
    history: 'crh.history',
    draft: 'crh.draft',
    batch: 'crh.batch',
    view: 'crh.view',
    roster: 'crh.roster',
    lastBackup: 'crh.lastBackup',
  };

  const CATEGORIES = ['人際關係', '情緒困擾', '學習適應', '生活常規', '行為偏差', '家庭關係', '身心健康', '校園安全', '生涯興趣', '其他'];
  // 國小常見狀況標籤（依類別分組；點選後會自動勾選所屬類別）
  const DETAILS_MAP = {
    生活常規: ['遲到', '作業缺交', '上課干擾', '忘記帶用品', '整潔習慣待加強', '不當使用 3C', '說髒話', '破壞公物'],
    學習適應: ['注意力不集中', '學習動機低落', '成績退步', '作業品質不佳', '上課打瞌睡', '考試焦慮'],
    情緒困擾: ['情緒低落', '焦慮緊張', '易怒衝動', '哭泣不止', '退縮不語', '自傷言語或行為'],
    人際關係: ['同儕衝突', '肢體碰撞', '言語嘲笑', '被排擠', '疑似霸凌', '網路不當留言'],
    行為偏差: ['頂撞師長', '說謊', '拿取他人物品'],
    家庭關係: ['家長反映', '作息不正常', '親子衝突', '家庭變故', '疑似受虐或疏忽'],
    校園安全: ['危險行為', '奔跑受傷', '攜帶危險物品'],
    身心健康: ['身體不適', '飲食問題', '睡眠不足'],
  };
  const DETAIL_TO_CAT = Object.fromEntries(Object.entries(DETAILS_MAP).flatMap(([cat, tags]) => tags.map((t) => [t, cat])));
  // 可能屬於法定通報事項的標籤
  const SENSITIVE_TAGS = ['自傷言語或行為', '疑似霸凌', '疑似受虐或疏忽', '攜帶危險物品'];
  const ACTIONS = ['傾聽與同理', '口頭提醒規勸', '引導換位思考', '約定改善目標', '給予正向鼓勵', '安排同儕協助', '調整座位', '聯絡家長', '轉介輔導室', '持續觀察'];
  const METHODS = ['個別晤談', '團體晤談', '電話聯繫', '聯絡簿', '家庭訪問', '線上訊息', '其他'];
  const LOCATIONS = ['原班教室', '導師辦公室', '輔導室', '走廊', '操場', '健康中心', '電話／線上'];

  const OTHER_CODES = ['乙生', '丙生', '丁生', '戊生', '己生', '庚生', '辛生', '壬生', '癸生'];
  const TARGET_LABEL = {
    student: '學生本人（教師未聯繫家長）',
    parent: '家長',
    both: '學生本人及家長',
    teacher: '其他教師／輔導室',
  };
  const TARGET_RULE = {
    student: '本次為教師與學生本人晤談，教師「沒有」聯繫家長。內容不得提及聯繫家長、家長回應或請家長配合等事項。',
    parent: '本次為教師與家長聯繫。請描述聯繫的緣由與教師向家長說明的內容；家長的回應與親師共識只有資料中有寫才描述，沒寫就不要自行描述家長的反應。',
    both: '本次教師先與學生本人晤談，並另外聯繫家長。請依序描述與學生的晤談，以及教師向家長說明的內容；家長的回應與親師共識只有資料中有寫才描述，沒寫就不要自行描述家長的反應。',
    teacher: '本次為教師與其他教師或輔導室討論學生狀況。請描述討論的內容、彼此的觀察與後續分工。',
  };
  const LENGTH_SPEC = {
    short: { kp: '20～40 字', ct: '80～150 字' },
    normal: { kp: '30～60 字', ct: '150～250 字' },
    long: { kp: '40～80 字', ct: '250～400 字' },
  };
  const REWRITE_RULE = {
    gentle: '改寫得更溫和、更具同理心，多描述學生的努力與成長的可能，但不得改變任何事實。',
    objective: '改寫得更客觀中立，刪除主觀評價、推測與情緒性字眼，只保留可觀察的行為與具體處置。',
    concise: '在不遺漏關鍵事實的前提下改寫得更精簡，篇幅約為原本的六成。',
    detail: '在不捏造任何新事實的前提下，把敘述寫得更完整通順，讓事件脈絡、教師引導與後續做法的銜接更清楚。',
  };
  const REWRITE_LABEL = { gentle: '更溫和', objective: '更客觀', concise: '更精簡', detail: '更完整' };

  const TEMPLATES = [
    {
      label: '同儕衝突', cats: ['人際關係', '生活常規'], details: ['同儕衝突', '肢體碰撞'], actions: ['傾聽與同理', '引導換位思考'],
      event: '下課時他和同學在走廊搶球，一生氣推了同學一把，同學跌倒膝蓋擦傷。他一開始覺得是對方先搶球，不覺得自己有錯。',
      handling: '先確認受傷的同學到保健室處理，再分別聽兩人說明經過。引導他說出當下生氣的感受，討論推人可能造成的危險，一起想下次生氣時可以先深呼吸、用說的或請老師幫忙。',
      response: '他冷靜後承認推人不對，主動向同學道歉，說下次會先用說的。',
    },
    {
      label: '上課分心', cats: ['學習適應'], details: ['注意力不集中', '作業品質不佳'], actions: ['約定改善目標', '調整座位'],
      event: '最近數學課常玩橡皮擦、和隔壁同學講話，提醒後很快又分心，習作也常寫不完。',
      handling: '下課找他個別聊聊，了解是聽不懂還是覺得無聊。他說分數的部分聽不太懂。和他約定上課不懂就舉手，並把座位調到靠近老師，下課利用十分鐘一起複習。',
      response: '他願意試試看，說會先把習作完成再去玩。',
    },
    {
      label: '作業缺交', cats: ['學習適應', '生活常規'], details: ['作業缺交'], actions: ['約定改善目標', '安排同儕協助'],
      event: '這兩週作業缺交五次，問他都說忘記帶或沒寫。',
      handling: '和他一起檢查聯絡簿的登記習慣，教他回家先看聯絡簿、寫完一項就打勾，並約定每天放學前由小老師提醒他。',
      response: '他說回家常常先看電視就忘了，答應會先寫完作業再看電視。',
    },
    {
      label: '情緒低落', cats: ['情緒困擾', '人際關係'], details: ['情緒低落', '退縮不語'], actions: ['傾聽與同理', '持續觀察'],
      event: '這幾天看起來悶悶不樂，下課都一個人坐在位子上，問他也只說沒事。',
      handling: '利用午休個別陪伴聊天，先聊他喜歡的事，再慢慢問近況。他說好朋友最近都跟別人玩，覺得被冷落。老師同理他的感受，和他討論可以主動邀請同學一起玩，也可以多認識其他同學。',
      response: '他說明天想試著邀好朋友一起打躲避球，也知道有心事可以找老師說。',
    },
    {
      label: '危險行為', cats: ['校園安全', '生活常規'], details: ['危險行為'], actions: ['口頭提醒規勸', '引導換位思考'],
      event: '美勞課時拿著剪刀在教室裡揮來揮去玩鬧，差點刺到旁邊的同學。',
      handling: '立刻請他放下剪刀，課後個別說明剪刀的正確使用方式和可能造成的傷害，請他想想如果被刺到的是自己會有什麼感覺。',
      response: '他了解這樣很危險，向同學道歉，答應之後會正確使用剪刀。',
    },
    {
      label: '遲到常規', cats: ['生活常規'], details: ['遲到', '作息不正常'], actions: ['約定改善目標'],
      event: '這個月已經遲到六次，常錯過早自習。他說早上爸媽很早出門，自己起不來。',
      handling: '和他討論前一晚的作息，建議早點睡並自己設定鬧鐘，同時說明準時到校的重要。',
      response: '他答應今晚十點前睡覺，並試著用鬧鐘自己起床。',
    },
  ];

  const SEAT_MAX = 35;
  const BATCH_LIMIT = 10;

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- 儲存（私密視窗或封鎖儲存時不會壞） ----------
  const store = {
    get(area, k) { try { return window[area].getItem(k); } catch { return null; } },
    set(area, k, v) { try { window[area].setItem(k, v); return true; } catch { return false; } },
    del(area, k) { try { window[area].removeItem(k); } catch { /* 忽略 */ } },
  };
  const getApiKey = () => store.get('sessionStorage', KEYS.apiKey) || store.get('localStorage', KEYS.apiKey) || '';
  const isKeyRemembered = () => !!store.get('localStorage', KEYS.apiKey);
  function setApiKey(key, remember) {
    store.del('localStorage', KEYS.apiKey);
    store.del('sessionStorage', KEYS.apiKey);
    if (key) store.set(remember ? 'localStorage' : 'sessionStorage', KEYS.apiKey, key);
  }
  const getModel = () => store.get('localStorage', KEYS.model) || '';
  const setModel = (m) => (m ? store.set('localStorage', KEYS.model, m) : store.del('localStorage', KEYS.model));

  function loadHistory() {
    try { return JSON.parse(store.get('localStorage', KEYS.history) || '[]'); } catch { return []; }
  }
  function saveHistory(list) {
    if (!store.set('localStorage', KEYS.history, JSON.stringify(list))) toast('瀏覽器無法儲存（可能是私密視窗）', 'error');
  }

  // ---------- 小工具 ----------
  let toastTimer;
  function toast(msg, type = '', ms = 2600) {
    const el = $('#toast');
    el.textContent = msg;
    el.className = `toast show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'toast'; }, ms);
  }
  function setStatus(msg, type = '') {
    const el = $('#status');
    el.textContent = msg;
    el.className = `status ${type}`;
  }
  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const countChars = (s) => s.replace(/\s/g, '').length;
  const toOneParagraph = (s) => String(s || '').replace(/\r/g, '').replace(/\s*\n+\s*/g, '').trim();
  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  function rocDate(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return iso || '';
    const [y, m, d] = iso.split('-').map(Number);
    return `${y - 1911} 年 ${m} 月 ${d} 日`;
  }
  const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const categoriesFromDetails = (details) => [...new Set(details.map((d) => DETAIL_TO_CAT[d]).filter(Boolean))];

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      ta.remove();
      return ok;
    }
  }

  // ---------- 標籤 UI ----------
  function tagLibHtml(selected = []) {
    return Object.entries(DETAILS_MAP).map(([cat, tags]) => `
      <div class="tag-group">
        <h4>${cat}</h4>
        <div class="chips small">${tags.map((t) => {
          const on = selected.includes(t);
          const warn = SENSITIVE_TAGS.includes(t) ? ' warn-tag' : '';
          return `<button type="button" class="chip-btn${on ? ' on' : ''}${warn}" data-tag="${t}" aria-pressed="${on}">${t}</button>`;
        }).join('')}</div>
      </div>`).join('');
  }
  function actionsHtml(selected = []) {
    return ACTIONS.map((a) => {
      const on = selected.includes(a);
      return `<button type="button" class="chip-btn action${on ? ' on' : ''}" data-action="${a}" aria-pressed="${on}">${a}</button>`;
    }).join('');
  }
  function toggleChip(btn) {
    const on = !btn.classList.contains('on');
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', on);
    return on;
  }
  function renderReportNotice(el, details) {
    const hits = details.filter((d) => SENSITIVE_TAGS.includes(d));
    el.hidden = !hits.length;
    if (hits.length) {
      el.innerHTML = `⚠️ 你點選了「${hits.map(escapeHtml).join('」「')}」。這類事件可能屬於<strong>法定通報事項</strong>（如兒少保護、校安通報、校園霸凌），請依學校流程在時限內完成通報，並告知輔導室與學務處。輔導紀錄只是紀錄，不能取代通報。`;
    }
  }

  function renderStatic() {
    $('#categories').innerHTML = CATEGORIES.map((c) => `<label><input type="checkbox" value="${c}"><span>${c}</span></label>`).join('');
    $$('.method-select').forEach((s) => { s.innerHTML = METHODS.map((m) => `<option>${m}</option>`).join(''); });
    $('#location').innerHTML = `<option value="">（不指定）</option>${LOCATIONS.map((l) => `<option>${l}</option>`).join('')}`;
    $('#singleTagLib').innerHTML = tagLibHtml();
    $('#singleActions').innerHTML = actionsHtml();
    const tplBox = $('#templates');
    TEMPLATES.forEach((t, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tpl';
      b.textContent = t.label;
      b.dataset.index = i;
      tplBox.appendChild(b);
    });
  }

  // ---------- 個別輔導表單 ----------
  const selectedDetails = () => $$('#singleTagLib .chip-btn.on').map((b) => b.dataset.tag);
  const selectedActions = () => $$('#singleActions .chip-btn.on').map((b) => b.dataset.action);

  function readForm() {
    return {
      studentName: $('#studentName').value.trim(),
      otherNames: $('#otherNames').value.trim(),
      grade: $('#grade').value,
      date: $('#date').value,
      target: ($('input[name=target]:checked') || {}).value || 'student',
      method: $('#method').value,
      location: $('#location').value,
      categories: $$('#categories input:checked').map((i) => i.value),
      details: selectedDetails(),
      actions: selectedActions(),
      event: $('#event').value.trim(),
      handling: $('#handling').value.trim(),
      response: $('#response').value.trim(),
      length: ($('input[name=length]:checked') || {}).value || 'normal',
      tone: ($('input[name=tone]:checked') || {}).value || 'neutral',
      restoreNames: $('#restoreNames').checked,
    };
  }

  function setChips(container, attr, values) {
    $$(`${container} .chip-btn`).forEach((b) => {
      const on = values.includes(b.dataset[attr]);
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on);
    });
  }

  function fillForm(f) {
    if (!f) return;
    $('#studentName').value = f.studentName || '';
    $('#otherNames').value = f.otherNames || '';
    $('#grade').value = f.grade || '';
    $('#date').value = f.date || todayStr();
    $$('input[name=target]').forEach((r) => { r.checked = r.value === (f.target || 'student'); });
    $('#method').value = f.method || '個別晤談';
    $('#location').value = f.location || '';
    $$('#categories input').forEach((c) => { c.checked = (f.categories || []).includes(c.value); });
    setChips('#singleTagLib', 'tag', f.details || []);
    setChips('#singleActions', 'action', f.actions || []);
    $('#event').value = f.event || '';
    $('#handling').value = f.handling || '';
    $('#response').value = f.response || '';
    $$('input[name=length]').forEach((r) => { r.checked = r.value === (f.length || 'normal'); });
    $$('input[name=tone]').forEach((r) => { r.checked = r.value === (f.tone || 'neutral'); });
    $('#restoreNames').checked = !!f.restoreNames;
    refreshSingleTagState();
  }

  function refreshSingleTagState() {
    const details = selectedDetails();
    $('#detailCount').textContent = details.length ? `已選 ${details.length}` : '';
    $('#eventReq').textContent = details.length ? '可只寫補充' : '必填';
    renderReportNotice($('#reportNotice'), details);
  }

  let draftTimer;
  function saveDraftSoon() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDraft, 400);
  }
  function saveDraft() {
    const data = { form: readForm(), keyPoints: $('#keyPoints').value, contact: $('#contact').value };
    store.set('localStorage', KEYS.draft, JSON.stringify(data));
  }
  function loadDraft() {
    try {
      const d = JSON.parse(store.get('localStorage', KEYS.draft) || 'null');
      if (!d) return false;
      fillForm(d.form);
      $('#keyPoints').value = d.keyPoints || '';
      $('#contact').value = d.contact || '';
      return true;
    } catch { return false; }
  }

  function updateCounts() {
    $('#kpCount').textContent = `${countChars($('#keyPoints').value)} 字`;
    $('#ctCount').textContent = `${countChars($('#contact').value)} 字`;
  }

  // ---------- 班級名冊（只存在本機，不會送給 AI） ----------
  function loadRoster() {
    try { return JSON.parse(store.get('localStorage', KEYS.roster) || '{}') || {}; } catch { return {}; }
  }
  let roster = loadRoster();
  function saveRoster(map) {
    roster = map;
    store.set('localStorage', KEYS.roster, JSON.stringify(map));
  }
  const rosterName = (k) => roster[String(k)] || '';
  const seatLabel = (k) => (rosterName(k) ? `${k} 號 ${rosterName(k)}` : `${k} 號`);
  const NAME_RE = /^[一-鿿A-Za-z·．.]{2,12}$/;

  // 支援「1 王小明」「01.王小明」「1號,王小明」、從 Excel 貼上的「1⇥王小明⇥男」，或只有一欄姓名（依順序編座號）
  function parseRoster(text) {
    const map = {};
    const bad = [];
    let seq = 0;
    text.split(/\r?\n/).forEach((line) => {
      const tokens = line.trim().split(/[\t,，、;；]+|\s+/).filter(Boolean);
      if (!tokens.length) return;
      seq += 1;
      let seat = seq;
      let name = tokens[0];
      const num = tokens[0].match(/^(\d{1,2})[號.．:：]?$/);
      if (num) {
        seat = Number(num[1]);
        name = tokens[1] || '';
        seq = seat;
      }
      if (seat >= 1 && seat <= SEAT_MAX && NAME_RE.test(name)) map[String(seat)] = name;
      else bad.push(line.trim());
    });
    return { map, bad };
  }
  const rosterToText = (map) => Object.keys(map).map(Number).sort((a, b) => a - b).map((k) => `${k} ${map[k]}`).join('\n');

  // ---------- 去識別化 ----------
  const splitNames = (s) => (s || '').split(/[,，、;；\s]+/).map((x) => x.trim()).filter((x) => x.length >= 2);

  function buildAliases(form) {
    const list = [];
    const mains = splitNames(form.studentName);
    mains.forEach((n) => list.push({ real: n, code: '甲生' }));
    const others = splitNames(form.otherNames).filter((n) => !mains.includes(n));
    // 名冊上的同學若出現在敘述裡，也自動換代號（老師忘了填「其他相關人物」也不會外洩）
    const text = [form.event, form.handling, form.response].join('\n');
    Object.values(roster).forEach((n) => {
      if (mains.includes(n) || others.includes(n)) return;
      const given = /^[一-鿿]{3}$/.test(n) ? n.slice(1) : '';
      if (text.includes(n) || (given && text.includes(given))) others.push(n);
    });
    others.forEach((n, i) => list.push({ real: n, code: OTHER_CODES[i] || `同學${i + 1}` }));
    // 三個字的中文姓名，也把「名」（如小明）換掉
    const extra = [];
    list.forEach(({ real, code }) => {
      if (/^[一-鿿]{3}$/.test(real)) extra.push({ real: real.slice(1), code, variant: true });
    });
    return [...list, ...extra].sort((a, b) => b.real.length - a.real.length);
  }

  function deidentify(text, aliases) {
    let t = text || '';
    aliases.forEach(({ real, code }) => { t = t.split(real).join(code); });
    t = t.replace(/(?:\+?886[-\s]?|0)9\d{2}[-\s]?\d{3}[-\s]?\d{3}/g, '[電話已遮蔽]');
    t = t.replace(/\(?0\d{1,2}\)?[-\s]?\d{3,4}[-\s]?\d{4}/g, '[電話已遮蔽]');
    t = t.replace(/[A-Z][12]\d{8}/gi, '[身分證字號已遮蔽]');
    return t;
  }

  function postProcess(text, aliases, restore) {
    let t = toOneParagraph(text).replace(/甲生/g, '該生');
    if (restore) {
      aliases.filter((a) => a.code !== '甲生' && !a.variant).forEach(({ real, code }) => {
        t = t.split(code).join(real);
      });
    }
    return t;
  }

  // ---------- 提示詞 ----------
  function systemRules(c) {
    const len = LENGTH_SPEC[c.length] || LENGTH_SPEC.normal;
    const tone = c.tone === 'warm'
      ? '語氣溫暖、正向、具同理心，肯定學生的努力，但仍維持專業書面用語。'
      : '語氣客觀、中性、專業，避免情緒性字眼。';
    return [
      '### 角色',
      '你是一位經驗豐富的臺灣國小導師，熟悉學校「學生輔導資料紀錄表」的撰寫方式。你的任務是把老師口語、零散的描述或點選的標籤，整理成可以直接登錄到校務系統的正式輔導紀錄。',
      '',
      '### 輸出內容',
      `1.「輔導內容重點」：用一段話簡要說明發生了什麼事（約 ${len.kp}）。`,
      `2.「聯繫內容」：用一段話詳細描述事件經過、教師如何處理與引導學生，以及學生未來可以怎麼做（約 ${len.ct}）。`,
      '',
      '### 撰寫規則',
      '- 一律使用繁體中文與臺灣慣用語，採書面語、第三人稱的教師紀錄視角。',
      '- 兩個部分各自只能是「一個段落」，不要條列、不要換行、不要另加標題，也不要在開頭寫姓名、日期、地點等欄位標籤。',
      '- 主角學生一律稱為「該生」（資料中可能寫作「甲生」）；其他人物保留資料中的代稱（如乙生、丙生），不得自行編造姓名。',
      `- ${TARGET_RULE[c.target] || TARGET_RULE.student}`,
      '- 只根據老師提供的資訊撰寫，不得捏造未提及的事件、對話、診斷或結果，也不要推測學生的心理狀態或家庭背景；資訊不足時用概括的方式描述。',
      '- 不要自行補上資料裡沒有的細節，例如聯繫家長的管道（電話、聯絡簿、面談）、時間、次數、地點或在場人員。',
      '- 資料沒有提供的項目（例如事件經過、教師的具體做法、學生的回應）就依狀況細節與教師處置概括帶過；內文絕對不要出現「未說明」「未填寫」「資料未提供」這類字眼，學生沒有表態時就改寫教師後續將持續觀察的重點。',
      '- 把口語轉為專業描述（例如「他說好」→「該生表示願意嘗試」、「很兇」→「情緒較為激動」），避免標籤化或貶抑字眼，不做醫療或心理診斷。',
      '- 這是事件紀錄，不是期末評語：不要寫「期許你…」「是個乖巧的孩子」這類對話句或評價句。',
      '- 「聯繫內容」依序包含：事件經過 → 教師的處理與引導 → 學生的反應或承諾（只有資料中有寫才寫，沒寫就略過，不要自行寫「表示理解」「願意配合」）→ 後續可行的做法或教師將持續觀察的重點。',
      `- ${tone}`,
    ];
  }

  // 把一位學生的資料轉成「輔導資料」區塊（文字已去識別化）
  function caseLines(c, di) {
    // 只列出老師有提供的項目；不在資料裡放「未填寫」之類的備註，避免 AI 把備註抄進紀錄
    const lines = [];
    if (c.date) lines.push(`- 日期：${rocDate(c.date)}`);
    if (c.grade) lines.push(`- 年級：${c.grade}`);
    lines.push(`- 輔導對象：${TARGET_LABEL[c.target] || TARGET_LABEL.student}`);
    lines.push(`- 輔導方式：${c.method}`);
    if (c.location) lines.push(`- 晤談地點：${c.location}`);
    if (c.categories.length) lines.push(`- 輔導類別：${c.categories.join('、')}`);
    if (c.details.length) lines.push(`- 狀況細節：${c.details.join('、')}`);
    if (c.actions.length) lines.push(`- 教師處置：${c.actions.join('、')}`);
    if (c.event) lines.push(`- 事件經過：${di(c.event)}`);
    if (c.handling) lines.push(`- 教師的處理與引導：${di(c.handling)}`);
    if (c.response) lines.push(`- 學生的回應與後續：${di(c.response)}`);
    return lines;
  }

  function buildMessages(form, mode) {
    const aliases = buildAliases(form);
    const c = { ...form, target: effectiveTarget(form.target, form.actions) };
    const system = systemRules(c);
    if (mode === 'json') {
      system.push('', '### 輸出格式', '以 JSON 輸出，欄位 key_points 為「輔導內容重點」，contact 為「聯繫內容」。');
    } else {
      system.push('', '### 輸出格式', '只輸出以下兩段，不要有其他說明：', '輔導內容重點：（一段文字）', '', '聯繫內容：（一段文字）');
    }
    const di = (s) => deidentify(s, aliases);
    const user = ['### 輔導資料', ...caseLines(c, di)];
    return { system: system.join('\n'), user: user.join('\n'), aliases };
  }

  // 勾了「聯絡家長」卻選「只和學生談」時，改用「學生＋家長」的規則，避免互相矛盾
  function effectiveTarget(target, actions = []) {
    return target === 'student' && actions.includes('聯絡家長') ? 'both' : target;
  }

  function updatePeek() {
    const form = readForm();
    if (!form.event && !form.details.length) {
      $('#peek').textContent = '（先填寫事件經過或點選常見狀況）';
      return;
    }
    const { system, user } = buildMessages(form, 'chat');
    $('#peek').textContent = `${system}\n\n${user}`;
  }

  // ---------- 解析 AI 回覆 ----------
  function parsePlain(text) {
    const t = String(text || '').replace(/\*\*/g, '').replace(/^#+\s*/gm, '');
    const kp = t.match(/輔導內容(?:重點|要點)\s*[：:]?\s*([\s\S]*?)(?=聯[繫絡](?:內容|事項)\s*[：:]|$)/);
    const ct = t.match(/聯[繫絡](?:內容|事項)\s*[：:]?\s*([\s\S]*)$/);
    return { key_points: kp ? kp[1] : '', contact: ct ? ct[1] : '' };
  }
  function parseResult(text) {
    const clean = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    try {
      const obj = JSON.parse(clean);
      if (obj && (obj.key_points || obj.contact)) return obj;
    } catch { /* 改用文字解析 */ }
    return parsePlain(clean);
  }

  // ---------- Gemini API ----------
  class ApiError extends Error {
    constructor(status, message) { super(message); this.status = status; }
  }
  async function toApiError(res) {
    let msg = '';
    try { msg = (await res.json())?.error?.message || ''; } catch { /* 忽略 */ }
    return new ApiError(res.status, msg);
  }
  function friendlyError(e) {
    if (e instanceof ApiError) {
      const m = e.message || '';
      if (/API key not valid|API_KEY_INVALID/i.test(m)) return '金鑰無效，請確認有沒有貼完整。';
      if (e.status === 400) return `請求格式有誤：${m.slice(0, 120)}`;
      if (e.status === 401 || e.status === 403) return '金鑰沒有權限或已被停用，請到 Google AI Studio 確認。';
      if (e.status === 404) return '這個模型已停用或不存在，請到「AI 設定」按「重新抓取」換一個模型。';
      if (e.status === 429) return '使用量超過額度（免費方案每分鐘、每天有上限），請稍等一下再試。';
      if (e.status >= 500) return 'Google 伺服器暫時忙碌，請稍後再試。';
      return `發生錯誤（${e.status}）：${m.slice(0, 120)}`;
    }
    if (e && e.name === 'TypeError') return '網路連線失敗，請確認網路後再試。';
    return e?.message || '發生未知錯誤';
  }
  const isFatal = (e) => e instanceof ApiError && [400, 401, 403, 404, 429].includes(e.status);

  const EXCLUDE_MODEL = /(embedding|tts|image|audio|live|native|computer-use|robotics|aqa|learnlm|veo|imagen|banana)/i;
  function rankModel(id) {
    let s = 0;
    if (/flash-lite/.test(id)) s += 300;
    else if (/flash/.test(id)) s += 200;
    else if (/pro/.test(id)) s += 100;
    if (/preview|exp/.test(id)) s -= 40;
    if (/latest/.test(id)) s += 3;
    const v = parseFloat((id.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || '0');
    return s + v * 10;
  }
  async function fetchModels(key) {
    const res = await fetch(`${API_BASE}/models?pageSize=1000`, { headers: { 'x-goog-api-key': key } });
    if (!res.ok) throw await toApiError(res);
    const data = await res.json();
    return (data.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m) => ({ id: m.name.replace(/^models\//, ''), label: m.displayName || m.name }))
      .filter((m) => /^gemini-/.test(m.id) && !EXCLUDE_MODEL.test(m.id))
      .sort((a, b) => rankModel(b.id) - rankModel(a.id));
  }

  // 伺服器忙碌（429/500/503）時自動等待重試；金鑰或格式錯誤則直接回報
  const RETRY_DELAYS = [2000, 4000, 8000];
  async function callGemini(system, user, { onRetry } = {}) {
    const key = getApiKey();
    const model = getModel();
    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: { key_points: { type: 'STRING' }, contact: { type: 'STRING' } },
          required: ['key_points', 'contact'],
        },
      },
    });
    let res;
    for (let attempt = 0; ; attempt += 1) {
      res = await fetch(`${API_BASE}/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body,
      });
      if (res.ok) break;
      if (![429, 500, 503].includes(res.status) || attempt >= RETRY_DELAYS.length) throw await toApiError(res);
      if (onRetry) onRetry(attempt + 1, RETRY_DELAYS[attempt]);
      await sleep(RETRY_DELAYS[attempt]);
    }
    const data = await res.json();
    const cand = data?.candidates?.[0];
    const text = (cand?.content?.parts || []).map((p) => p.text || '').join('');
    if (!text) {
      const reason = data?.promptFeedback?.blockReason || cand?.finishReason || '未知';
      throw new Error(`AI 沒有產生內容（原因：${reason}），請調整描述後再試。`);
    }
    return parseResult(text);
  }

  async function ensureModel() {
    if (getModel()) return getModel();
    const models = await fetchModels(getApiKey());
    if (!models.length) throw new Error('這個金鑰找不到可用的 Gemini 模型。');
    setModel(models[0].id);
    return models[0].id;
  }

  function requireKey(altHint) {
    if (getApiKey()) return true;
    openSettings(`先設定 Gemini API 金鑰；或關掉這個視窗，改用「${altHint}」。`);
    return false;
  }

  // ---------- 個別輔導：產生與改寫 ----------
  let busy = false;
  function setBusy(on, text = 'AI 正在撰寫紀錄…') {
    busy = on;
    $('#overlayText').textContent = text;
    $('#btnGenerate').classList.toggle('loading', on);
    ['#btnGenerate', '#btnRegenerate', ...$$('[data-rewrite]').map((b) => b)].forEach((s) => {
      (typeof s === 'string' ? $(s) : s).disabled = on;
    });
    $('#outputCard').classList.toggle('busy', on);
  }

  let undoStack = null;
  function rememberForUndo() {
    const kp = $('#keyPoints').value;
    const ct = $('#contact').value;
    if (kp || ct) {
      undoStack = { kp, ct };
      $('#btnUndo').disabled = false;
    }
  }

  async function generate() {
    if (busy) return;
    const form = readForm();
    if (!form.event && !form.details.length) {
      toast('請填寫「事件經過」，或點選至少一個常見狀況', 'error');
      $('#event').focus();
      return;
    }
    if (!requireKey('不用金鑰：複製提示詞到 Gemini')) return;
    const { system, user, aliases } = buildMessages(form, 'json');
    setBusy(true);
    setStatus('AI 整理中…');
    try {
      const model = await ensureModel();
      const r = await callGemini(system, user, {
        onRetry: (n) => { setStatus(`伺服器忙碌，第 ${n} 次重試…`); $('#overlayText').textContent = `伺服器忙碌，自動重試中（第 ${n} 次）…`; },
      });
      rememberForUndo();
      $('#keyPoints').value = postProcess(r.key_points, aliases, form.restoreNames);
      $('#contact').value = postProcess(r.contact, aliases, form.restoreNames);
      updateCounts();
      saveDraft();
      setStatus(`完成 ✓（${model}）`, 'ok');
      if (window.matchMedia('(max-width: 1080px)').matches) {
        $('#outputCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setModel('');
      setStatus('產生失敗', 'err');
      toast(friendlyError(e), 'error', 6000);
    } finally {
      setBusy(false);
    }
  }

  async function rewrite(kind) {
    if (busy) return;
    const kp0 = $('#keyPoints').value.trim();
    const ct0 = $('#contact').value.trim();
    if (!kp0 && !ct0) { toast('先產生紀錄，才能改寫', 'error'); return; }
    if (!requireKey('不用金鑰：複製提示詞到 Gemini')) return;
    const form = readForm();
    const aliases = buildAliases(form);
    const c = { ...form, target: effectiveTarget(form.target, form.actions) };
    const system = [...systemRules(c), '', '### 輸出格式', '以 JSON 輸出，欄位 key_points 為「輔導內容重點」，contact 為「聯繫內容」。'].join('\n');
    const user = [
      '### 目前的輔導紀錄',
      `輔導內容重點：${deidentify(kp0, aliases)}`,
      `聯繫內容：${deidentify(ct0, aliases)}`,
      '',
      '### 改寫指示',
      REWRITE_RULE[kind],
      '維持兩段式與上述所有撰寫規則，只輸出改寫後的結果。',
    ].join('\n');
    setBusy(true, `AI 正在改寫成「${REWRITE_LABEL[kind]}」版本…`);
    setStatus('改寫中…');
    try {
      await ensureModel();
      const r = await callGemini(system, user, { onRetry: (n) => setStatus(`伺服器忙碌，第 ${n} 次重試…`) });
      rememberForUndo();
      $('#keyPoints').value = postProcess(r.key_points, aliases, form.restoreNames);
      $('#contact').value = postProcess(r.contact, aliases, form.restoreNames);
      updateCounts();
      saveDraft();
      setStatus(`已改寫成「${REWRITE_LABEL[kind]}」✓ 不滿意可按復原`, 'ok');
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setModel('');
      setStatus('改寫失敗', 'err');
      toast(friendlyError(e), 'error', 6000);
    } finally {
      setBusy(false);
    }
  }

  function undo() {
    if (!undoStack) return;
    const cur = { kp: $('#keyPoints').value, ct: $('#contact').value };
    $('#keyPoints').value = undoStack.kp;
    $('#contact').value = undoStack.ct;
    undoStack = cur;
    updateCounts();
    saveDraft();
    setStatus('已切換回上一個版本（再按一次可切回來）', 'ok');
  }

  let lastChatAliases = [];
  async function copyPrompt() {
    const form = readForm();
    if (!form.event && !form.details.length) {
      toast('請填寫「事件經過」，或點選至少一個常見狀況', 'error');
      $('#event').focus();
      return;
    }
    const { system, user, aliases } = buildMessages(form, 'chat');
    lastChatAliases = aliases;
    const ok = await copyText(`${system}\n\n${user}`);
    if (!ok) {
      toast('複製失敗，請展開「查看實際送給 AI 的內容」手動複製', 'error', 5000);
      return;
    }
    $('#pasteBack').open = true;
    toast('已複製！到 Gemini 貼上送出，再把回覆貼回右邊的「貼回來」區。', '', 5000);
    window.open('https://gemini.google.com/app', '_blank', 'noopener');
  }

  function parsePasted() {
    const text = $('#pasteText').value.trim();
    if (!text) { toast('請先貼上 Gemini 的回覆', 'error'); return; }
    const r = parsePlain(text);
    if (!r.key_points && !r.contact) {
      toast('找不到「輔導內容重點」或「聯繫內容」標題，請確認貼上的內容。', 'error', 5000);
      return;
    }
    const aliases = lastChatAliases.length ? lastChatAliases : buildAliases(readForm());
    const restore = $('#restoreNames').checked;
    rememberForUndo();
    $('#keyPoints').value = postProcess(r.key_points, aliases, restore);
    $('#contact').value = postProcess(r.contact, aliases, restore);
    $('#pasteText').value = '';
    updateCounts();
    saveDraft();
    setStatus('已從貼上內容拆段 ✓', 'ok');
  }

  // ---------- 批次補登 ----------
  let batch = loadBatch();
  let batchBusy = false;

  function newBatch() {
    return {
      seats: {},
      active: null,
      results: {},
      common: { date: todayStr(), grade: '', target: 'student', method: '個別晤談', length: 'short', tone: 'neutral' },
    };
  }
  function loadBatch() {
    try {
      const b = JSON.parse(store.get('localStorage', KEYS.batch) || 'null');
      if (b && b.seats && b.results && b.common) return b;
    } catch { /* 忽略 */ }
    return newBatch();
  }
  let batchTimer;
  function saveBatchSoon() {
    clearTimeout(batchTimer);
    batchTimer = setTimeout(() => store.set('localStorage', KEYS.batch, JSON.stringify(batch)), 300);
  }
  const seatKeys = (obj) => Object.keys(obj).map(Number).sort((a, b) => a - b).map(String);

  function renderSeatGrid() {
    const html = [];
    for (let i = 1; i <= SEAT_MAX; i += 1) {
      const k = String(i);
      const cls = ['seat'];
      if (batch.seats[k]) cls.push('selected');
      if (batch.results[k]?.keyPoints || batch.results[k]?.contact) cls.push('done');
      if (batch.results[k]?.entered) cls.push('entered');
      if (batch.active === k) cls.push('active');
      const label = escapeHtml(seatLabel(k));
      html.push(`<button type="button" class="${cls.join(' ')}" data-seat="${k}" aria-pressed="${!!batch.seats[k]}" aria-label="${label}" title="${label}">${k}</button>`);
    }
    $('#seatGrid').innerHTML = html.join('');
    $('#seatCount').textContent = `已選 ${Object.keys(batch.seats).length} / ${BATCH_LIMIT} 人`;
  }

  function renderSeatEditor() {
    const k = batch.active;
    const s = k && batch.seats[k];
    $('#seatEditorEmpty').hidden = !!s;
    $('#seatEditorBody').hidden = !s;
    $('#btnRemoveSeat').hidden = !s;
    $('#seatEditorName').textContent = s ? `${seatLabel(k)}的狀況` : '勾選狀況';
    if (!s) return;
    $('#batchTagLib').innerHTML = tagLibHtml(s.details);
    $('#batchActions').innerHTML = actionsHtml(s.actions);
    $('#bNote').value = s.note || '';
    renderReportNotice($('#bReportNotice'), s.details);
  }

  function fillBatchCommon() {
    const c = batch.common;
    $('#bDate').value = c.date || todayStr();
    $('#bGrade').value = c.grade || '';
    $('#bTarget').value = c.target || 'student';
    $('#bMethod').value = c.method || '個別晤談';
    $$('input[name=bLength]').forEach((r) => { r.checked = r.value === (c.length || 'short'); });
    $$('input[name=bTone]').forEach((r) => { r.checked = r.value === (c.tone || 'neutral'); });
  }
  function readBatchCommon() {
    batch.common = {
      date: $('#bDate').value,
      grade: $('#bGrade').value,
      target: $('#bTarget').value,
      method: $('#bMethod').value,
      length: ($('input[name=bLength]:checked') || {}).value || 'short',
      tone: ($('input[name=bTone]:checked') || {}).value || 'neutral',
    };
    saveBatchSoon();
  }

  function onSeatClick(e) {
    const btn = e.target.closest('.seat');
    if (!btn || batchBusy) return;
    const k = btn.dataset.seat;
    if (!batch.seats[k]) {
      if (Object.keys(batch.seats).length >= BATCH_LIMIT) {
        toast(`一次最多 ${BATCH_LIMIT} 位，先產生完這批再選下一批`, 'error');
        return;
      }
      batch.seats[k] = { details: [], actions: [], note: '' };
    }
    batch.active = k;
    renderSeatGrid();
    renderSeatEditor();
    saveBatchSoon();
    if (window.matchMedia('(max-width: 1080px)').matches) $('.seat-editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function removeActiveSeat() {
    const k = batch.active;
    if (!k) return;
    delete batch.seats[k];
    delete batch.results[k];
    batch.active = null;
    renderSeatGrid();
    renderSeatEditor();
    renderBatchResults();
    saveBatchSoon();
  }

  function seatCase(k) {
    const s = batch.seats[k];
    const c = batch.common;
    return {
      date: c.date, grade: c.grade, method: c.method, location: '',
      target: effectiveTarget(c.target, s.actions),
      categories: categoriesFromDetails(s.details),
      details: s.details, actions: s.actions,
      event: s.note || '', handling: '', response: '',
      length: c.length, tone: c.tone,
    };
  }
  const seatAliases = (k) => buildAliases({ studentName: rosterName(k), otherNames: '', event: batch.seats[k]?.note || '', handling: '', response: '' });

  const seatHasInput = (k) => {
    const s = batch.seats[k];
    return s && (s.details.length || s.actions.length || (s.note || '').trim());
  };

  function setBatchProgress(done, total, text) {
    $('#batchProgressText').textContent = text;
    $('#batchBarFill').style.width = total ? `${Math.round((done / total) * 100)}%` : '0%';
  }

  async function batchGenerate() {
    if (batchBusy) return;
    readBatchCommon();
    const selected = seatKeys(batch.seats);
    if (!selected.length) { toast('先在左邊點選座號', 'error'); return; }
    const empty = selected.filter((k) => !seatHasInput(k));
    if (empty.length) {
      toast(`${empty.join('、')} 號還沒點選任何狀況或寫補充說明`, 'error', 4500);
      batch.active = empty[0];
      renderSeatGrid();
      renderSeatEditor();
      return;
    }
    const todo = selected.filter((k) => !(batch.results[k]?.keyPoints || batch.results[k]?.contact));
    if (!todo.length) { toast('這批都已經產生過了。要重寫某一位，請在結果卡片按「重寫」', 'error', 4500); return; }
    if (!requireKey('複製提示詞')) return;

    batchBusy = true;
    $('#btnBatchGenerate').disabled = true;
    $('#btnBatchGenerate').classList.add('loading');
    let done = 0;
    let failed = 0;
    try {
      const model = await ensureModel();
      for (const k of todo) {
        setBatchProgress(done, todo.length, `正在產生 ${k} 號（${done + 1} / ${todo.length}）…`);
        const c = seatCase(k);
        const system = [...systemRules(c), '', '### 輸出格式', '以 JSON 輸出，欄位 key_points 為「輔導內容重點」，contact 為「聯繫內容」。'].join('\n');
        const aliases = seatAliases(k);
        const user = ['### 輔導資料', ...caseLines(c, (s) => deidentify(s, aliases))].join('\n');
        try {
          const r = await callGemini(system, user, {
            onRetry: (n) => setBatchProgress(done, todo.length, `${k} 號：伺服器忙碌，第 ${n} 次重試…`),
          });
          batch.results[k] = { keyPoints: postProcess(r.key_points, aliases, false), contact: postProcess(r.contact, aliases, false) };
        } catch (e) {
          failed += 1;
          batch.results[k] = { keyPoints: '', contact: '', error: friendlyError(e) };
          if (isFatal(e)) {
            if (e.status === 404) setModel('');
            toast(`已停止：${friendlyError(e)}`, 'error', 6000);
            break;
          }
        }
        done += 1;
        renderBatchResults();
        renderSeatGrid();
        saveBatchSoon();
        await sleep(400);
      }
      setBatchProgress(done, todo.length, failed ? `完成 ${done - failed} 位，${failed} 位失敗（可按「重寫」再試）` : `✓ 全部完成（${done} 位，${model}）`);
      if (!failed) toast('批次產生完成 ✓');
    } catch (e) {
      setBatchProgress(done, todo.length, '產生失敗');
      toast(friendlyError(e), 'error', 6000);
    } finally {
      batchBusy = false;
      $('#btnBatchGenerate').disabled = false;
      $('#btnBatchGenerate').classList.remove('loading');
      renderBatchResults();
    }
  }

  function renderBatchResults() {
    const keys = seatKeys(batch.results);
    const box = $('#batchResultList');
    if (!keys.length) {
      box.innerHTML = '<p class="empty-text">產生後，每位學生的紀錄會出現在這裡，可以直接修改。</p>';
      return;
    }
    box.innerHTML = keys.map((k) => {
      const r = batch.results[k];
      const ok = !r.error && (r.keyPoints || r.contact);
      const name = rosterName(k);
      return `<article class="batch-card${r.error ? ' has-error' : ''}${r.entered ? ' entered' : ''}" data-seat="${k}">
        <div class="batch-card-head">
          <span class="seat-pill">${k} 號</span>
          ${name ? `<span class="seat-name">${escapeHtml(name)}</span>` : ''}
          ${r.entered ? '<span class="entered-pill">✓ 已登錄</span>' : ''}
          ${r.error ? `<span class="err-text">⚠️ ${escapeHtml(r.error)}</span>` : ''}
        </div>
        <div class="field-copy">
          <label class="mini-label">輔導內容重點</label>
          ${ok ? '<button type="button" class="btn small" data-bact="copyKp">複製</button>' : ''}
        </div>
        <textarea rows="2" data-field="keyPoints">${escapeHtml(r.keyPoints)}</textarea>
        <div class="field-copy">
          <label class="mini-label">聯繫內容</label>
          ${ok ? '<button type="button" class="btn small" data-bact="copyCt">複製</button>' : ''}
        </div>
        <textarea rows="5" data-field="contact">${escapeHtml(r.contact)}</textarea>
        <div class="batch-card-actions">
          ${ok ? `<button type="button" class="btn small ${r.entered ? 'ghost' : 'primary'}" data-bact="entered">${r.entered ? '↩ 取消已登錄' : '✓ 標記已登錄'}</button>` : ''}
          ${ok ? '<button type="button" class="btn small" data-bact="save">存入紀錄本</button>' : ''}
          <button type="button" class="btn small ghost" data-bact="redo" title="清掉這位的結果，下次批次產生時重寫">重寫</button>
        </div>
      </article>`;
    }).join('');
    renderEnteredCount();
  }

  function renderEnteredCount() {
    const keys = seatKeys(batch.results).filter((k) => batch.results[k].keyPoints || batch.results[k].contact);
    const n = keys.filter((k) => batch.results[k].entered).length;
    $('#enteredCount').textContent = keys.length ? `已登錄 ${n} / ${keys.length} 位` : '';
    $('#enteredCount').classList.toggle('all-done', keys.length > 0 && n === keys.length);
    $('#btnNextEntry').hidden = !keys.length || n === keys.length;
  }

  // 跳到下一位還沒登錄的學生，並先複製好「輔導內容重點」
  function gotoNextEntry() {
    const k = seatKeys(batch.results).find((x) => (batch.results[x].keyPoints || batch.results[x].contact) && !batch.results[x].entered);
    if (!k) { toast('這批都登錄完了 🎉'); return; }
    const card = $(`.batch-card[data-seat="${k}"]`);
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.remove('flash');
    void card.offsetWidth;
    card.classList.add('flash');
    copyText(batch.results[k].keyPoints).then((ok) => toast(ok ? `已複製 ${seatLabel(k)} 的「輔導內容重點」，貼上後再按「聯繫內容」旁的複製` : '複製失敗', ok ? '' : 'error', 4000));
  }

  function seatRecord(k) {
    const c = seatCase(k);
    const r = batch.results[k];
    return {
      id: uid(),
      savedAt: new Date().toISOString(),
      form: {
        studentName: seatLabel(k), otherNames: '', grade: c.grade, date: c.date, target: c.target, method: c.method,
        location: '', categories: c.categories, details: c.details, actions: c.actions,
        event: c.event, handling: '', response: '', length: c.length, tone: c.tone, restoreNames: false,
      },
      keyPoints: r.keyPoints,
      contact: r.contact,
    };
  }

  function onBatchResultClick(e) {
    const btn = e.target.closest('[data-bact]');
    if (!btn) return;
    const k = btn.closest('.batch-card').dataset.seat;
    const r = batch.results[k];
    if (btn.dataset.bact === 'copyKp' || btn.dataset.bact === 'copyCt') {
      const isKp = btn.dataset.bact === 'copyKp';
      copyText(isKp ? r.keyPoints : r.contact).then((ok) => toast(ok ? `已複製 ${seatLabel(k)} 的${isKp ? '輔導內容重點' : '聯繫內容'} ✓` : '複製失敗', ok ? '' : 'error'));
    } else if (btn.dataset.bact === 'entered') {
      r.entered = !r.entered;
      saveBatchSoon();
      renderBatchResults();
      renderSeatGrid();
      if (r.entered) toast(`${seatLabel(k)} 已標記為登錄完成 ✓`);
    } else if (btn.dataset.bact === 'save') {
      if (!r.keyPoints && !r.contact) { toast('這位的結果是空的', 'error'); return; }
      if (!batch.seats[k]) batch.seats[k] = { details: [], actions: [], note: '' };
      const list = loadHistory();
      list.unshift(seatRecord(k));
      saveHistory(list);
      renderHistoryCount();
      toast(`已把 ${k} 號存入紀錄本 💾`);
    } else if (btn.dataset.bact === 'redo') {
      delete batch.results[k];
      if (!batch.seats[k]) batch.seats[k] = { details: [], actions: [], note: '' };
      batch.active = k;
      renderBatchResults();
      renderSeatGrid();
      renderSeatEditor();
      saveBatchSoon();
      toast(`${k} 號可以調整狀況後，再按「開始批次產生」重寫`);
    }
  }

  function batchSaveAll() {
    const keys = seatKeys(batch.results).filter((k) => batch.results[k].keyPoints || batch.results[k].contact);
    if (!keys.length) { toast('還沒有可以儲存的結果', 'error'); return; }
    const list = loadHistory();
    keys.forEach((k) => {
      if (!batch.seats[k]) batch.seats[k] = { details: [], actions: [], note: '' };
      list.unshift(seatRecord(k));
    });
    saveHistory(list);
    renderHistoryCount();
    toast(`已把 ${keys.length} 位存入紀錄本 💾${backupNudge()}`, '', backupNeeded() ? 4500 : 2600);
  }

  function batchReset() {
    if (!Object.keys(batch.seats).length && !Object.keys(batch.results).length) return;
    if (!confirm('確定清空這批的座號、狀況與結果？（紀錄本不受影響，建議先「全部存入紀錄本」）')) return;
    const { common } = batch;
    batch = newBatch();
    batch.common = common;
    store.set('localStorage', KEYS.batch, JSON.stringify(batch));
    renderSeatGrid();
    renderSeatEditor();
    renderBatchResults();
    setBatchProgress(0, 0, '尚未開始');
  }

  async function batchCopyPrompt() {
    readBatchCommon();
    const selected = seatKeys(batch.seats).filter(seatHasInput);
    if (!selected.length) { toast('先點選座號並勾選狀況', 'error'); return; }
    const c0 = seatCase(selected[0]);
    const system = systemRules({ ...c0, target: batch.common.target });
    system.push(
      '- 每位學生的輔導對象以各自資料中的「輔導對象」為準。',
      '',
      '### 輸出格式',
      `本次共有 ${selected.length} 位學生，請依座號分別輸出，每位格式如下，不要有其他說明：`,
      '【3號】',
      '輔導內容重點：（一段文字）',
      '聯繫內容：（一段文字）',
    );
    const blocks = selected.map((k) => {
      const aliases = seatAliases(k);
      return [`### 【${k}號】的輔導資料`, ...caseLines(seatCase(k), (s) => deidentify(s, aliases))].join('\n');
    });
    const ok = await copyText(`${system.join('\n')}\n\n${blocks.join('\n\n')}`);
    if (!ok) { toast('複製失敗，請再試一次', 'error'); return; }
    $('#batchPasteBack').open = true;
    toast('已複製批次提示詞！貼到 Gemini，再把回覆貼回下方「依座號拆開」。', '', 5000);
    window.open('https://gemini.google.com/app', '_blank', 'noopener');
  }

  function batchParse() {
    const text = $('#batchPasteText').value.trim();
    if (!text) { toast('請先貼上 Gemini 的回覆', 'error'); return; }
    const parts = text.replace(/\*\*/g, '').split(/【\s*(\d{1,2})\s*號\s*】/);
    let n = 0;
    for (let i = 1; i < parts.length; i += 2) {
      const k = String(Number(parts[i]));
      const r = parsePlain(parts[i + 1]);
      if (!r.key_points && !r.contact) continue;
      batch.results[k] = { keyPoints: postProcess(r.key_points, [], false), contact: postProcess(r.contact, [], false) };
      if (!batch.seats[k]) batch.seats[k] = { details: [], actions: [], note: '' };
      n += 1;
    }
    if (!n) { toast('找不到「【3號】」這樣的座號標題，請確認貼上的內容', 'error', 5000); return; }
    $('#batchPasteText').value = '';
    renderBatchResults();
    renderSeatGrid();
    saveBatchSoon();
    toast(`已拆出 ${n} 位學生的紀錄 ✓`);
  }

  // ---------- 紀錄本 ----------
  function saveRecord() {
    const keyPoints = $('#keyPoints').value.trim();
    const contact = $('#contact').value.trim();
    if (!keyPoints && !contact) { toast('結果是空的，先產生紀錄吧', 'error'); return; }
    const list = loadHistory();
    list.unshift({ id: uid(), savedAt: new Date().toISOString(), form: readForm(), keyPoints, contact });
    saveHistory(list);
    renderHistoryCount();
    toast(`已存入紀錄本 💾${backupNudge()}`, '', backupNeeded() ? 4500 : 2600);
  }

  function renderHistoryCount() {
    $('#historyCount').textContent = loadHistory().length;
    const need = backupNeeded();
    $('#historyCount').classList.toggle('warn', need);
    $('#btnHistory').title = need ? '有紀錄還沒備份，建議打開紀錄本按「備份成檔案」' : '已儲存的輔導紀錄';
  }
  const backupNudge = () => (backupNeeded() ? '（有 ' + unbackedCount() + ' 筆還沒備份，記得到紀錄本備份）' : '');

  function renderHistory() {
    const q = $('#historySearch').value.trim();
    const list = loadHistory().filter((r) => {
      if (!q) return true;
      const f = r.form || {};
      return [f.studentName, f.date, f.grade, (f.categories || []).join(' '), (f.details || []).join(' '), r.keyPoints, r.contact].join(' ').includes(q);
    });
    const ul = $('#historyList');
    if (!list.length) {
      ul.innerHTML = `<li class="empty-text">${q ? '找不到符合的紀錄' : '還沒有儲存的紀錄'}</li>`;
      return;
    }
    ul.innerHTML = list.map((r) => {
      const f = r.form || {};
      const tags = (f.categories || []).map((c) => `<span class="history-tag">${escapeHtml(c)}</span>`).join('');
      return `<li class="history-item" data-id="${escapeHtml(r.id)}">
        <div class="history-meta">
          <strong>${escapeHtml(f.studentName || '（未填姓名）')}</strong>
          <span>${escapeHtml(f.grade || '')}</span>
          <span>${escapeHtml(f.date || '')}</span>
          <span>${escapeHtml(f.method || '')}</span>
          ${tags}
        </div>
        <p class="history-preview">${escapeHtml(r.keyPoints)}</p>
        <div class="history-actions">
          <button type="button" class="btn small" data-act="load">載入</button>
          <button type="button" class="btn small" data-act="copy">複製</button>
          <button type="button" class="btn small danger-ghost" data-act="delete">刪除</button>
        </div>
      </li>`;
    }).join('');
  }

  function onHistoryClick(e) {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.closest('.history-item').dataset.id;
    const list = loadHistory();
    const rec = list.find((r) => r.id === id);
    if (!rec) return;
    if (btn.dataset.act === 'load') {
      switchView('single');
      fillForm(rec.form);
      $('#keyPoints').value = rec.keyPoints;
      $('#contact').value = rec.contact;
      updateCounts();
      saveDraft();
      $('#historyDialog').close();
      setStatus('已載入紀錄', 'ok');
    } else if (btn.dataset.act === 'copy') {
      copyText(`輔導內容重點：${rec.keyPoints}\n\n聯繫內容：${rec.contact}`).then((ok) => toast(ok ? '已複製' : '複製失敗', ok ? '' : 'error'));
    } else if (btn.dataset.act === 'delete') {
      if (!confirm('確定刪除這筆紀錄？')) return;
      saveHistory(list.filter((r) => r.id !== id));
      renderHistory();
      renderHistoryCount();
    }
  }

  function exportCsv() {
    const list = loadHistory();
    if (!list.length) { toast('紀錄本是空的', 'error'); return; }
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['日期', '年級', '學生', '輔導對象', '輔導方式', '晤談地點', '輔導類別', '狀況細節', '輔導內容重點', '聯繫內容']];
    list.forEach((r) => {
      const f = r.form || {};
      rows.push([f.date, f.grade, f.studentName, TARGET_LABEL[f.target] || '', f.method, f.location || '', (f.categories || []).join('、'), (f.details || []).join('、'), r.keyPoints, r.contact]);
    });
    const csv = `﻿${rows.map((row) => row.map(cell).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `輔導紀錄_${todayStr()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---------- 備份與還原 ----------
  const BACKUP_TYPE = 'counseling-record-helper-backup';
  const getLastBackup = () => store.get('localStorage', KEYS.lastBackup) || '';
  const unbackedCount = () => {
    const last = getLastBackup();
    return loadHistory().filter((r) => !last || (r.savedAt || '') > last).length;
  };
  // 新增 5 筆以上沒備份，或距上次備份超過 14 天且有新紀錄，就提醒
  function backupNeeded() {
    const n = unbackedCount();
    if (n >= 5) return true;
    const last = getLastBackup();
    return n > 0 && !!last && Date.now() - new Date(last).getTime() > 14 * 86400000;
  }
  function fmtDateTime(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear() - 1911}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  function renderBackupHint() {
    const el = $('#backupHint');
    const total = loadHistory().length;
    const last = getLastBackup();
    const n = unbackedCount();
    const need = backupNeeded();
    el.className = `backup-hint${need ? ' need' : ''}`;
    if (!total) { el.textContent = '紀錄本還是空的。存入紀錄後，記得定期「備份成檔案」，換電腦或清除瀏覽資料也不怕。'; return; }
    el.textContent = last
      ? `上次備份：${fmtDateTime(last)}${n ? `，之後新增了 ${n} 筆還沒備份` : '，目前都已備份 ✓'}`
      : `這 ${total} 筆紀錄還沒備份過。清除瀏覽資料或換電腦就會不見，建議現在「備份成檔案」。`;
  }
  function downloadFile(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportBackup() {
    const records = loadHistory();
    if (!records.length && !Object.keys(roster).length) { toast('紀錄本和名冊都是空的，不需要備份', 'error'); return; }
    const data = { type: BACKUP_TYPE, version: 1, exportedAt: new Date().toISOString(), records, roster };
    downloadFile(`輔導紀錄備份_${todayStr()}.json`, JSON.stringify(data, null, 2), 'application/json');
    store.set('localStorage', KEYS.lastBackup, new Date().toISOString());
    renderBackupHint();
    renderHistoryCount();
    toast(`已備份 ${records.length} 筆紀錄${Object.keys(roster).length ? '與班級名冊' : ''}。檔案含學生姓名，請妥善保存 🔒`, '', 4500);
  }
  async function importBackup(file) {
    let data;
    try { data = JSON.parse(await file.text()); } catch { toast('這個檔案無法讀取，請確認是本工具的備份檔（.json）', 'error', 5000); return; }
    if (!data || data.type !== BACKUP_TYPE || !Array.isArray(data.records)) {
      toast('這不是輔導紀錄小幫手的備份檔', 'error', 5000);
      return;
    }
    const list = loadHistory();
    const ids = new Set(list.map((r) => r.id));
    const fresh = data.records.filter((r) => r && r.id && (r.keyPoints || r.contact) && !ids.has(r.id));
    const merged = [...list, ...fresh].sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')));
    saveHistory(merged);
    let rosterMsg = '';
    const incoming = data.roster && typeof data.roster === 'object' ? data.roster : {};
    if (Object.keys(incoming).length) {
      const same = JSON.stringify(incoming) === JSON.stringify(roster);
      if (!Object.keys(roster).length || (!same && confirm('備份檔裡有班級名冊，要用它取代目前的名冊嗎？'))) {
        saveRoster(incoming);
        renderRosterList();
        rosterMsg = '，並還原班級名冊';
      }
    }
    renderHistory();
    renderHistoryCount();
    renderBackupHint();
    renderSeatGrid();
    renderBatchResults();
    toast(`已還原 ${fresh.length} 筆紀錄${data.records.length - fresh.length ? `（略過 ${data.records.length - fresh.length} 筆已存在的）` : ''}${rosterMsg} ✓`, '', 4500);
  }

  // ---------- 班級名冊視窗 ----------
  function renderRosterList() {
    $('#rosterList').innerHTML = Object.keys(roster).map(Number).sort((a, b) => a - b)
      .map((k) => `<option value="${escapeHtml(roster[k])}">${k} 號</option>`).join('');
    const n = Object.keys(roster).length;
    $$('.roster-count').forEach((el) => { el.textContent = n ? `${n} 人` : ''; });
  }
  function previewRoster() {
    const { map, bad } = parseRoster($('#rosterText').value);
    const n = Object.keys(map).length;
    const el = $('#rosterPreview');
    el.className = `roster-preview${bad.length ? ' warn' : ''}`;
    el.textContent = n || bad.length
      ? `已辨識 ${n} 位${bad.length ? `；有 ${bad.length} 行看不懂（例如「${bad[0].slice(0, 12)}」），請改成「座號 姓名」` : ' ✓'}`
      : '每行一位，例如「1 王小明」。也可以直接從 Excel 複製「座號、姓名」兩欄貼上。';
  }
  function openRoster() {
    $('#rosterText').value = rosterToText(roster);
    previewRoster();
    $('#rosterDialog').showModal();
  }
  function saveRosterFromDialog() {
    const { map, bad } = parseRoster($('#rosterText').value);
    if (bad.length && !confirm(`有 ${bad.length} 行看不懂，會被略過。仍要儲存嗎？`)) return;
    saveRoster(map);
    renderRosterList();
    renderSeatGrid();
    renderSeatEditor();
    renderBatchResults();
    $('#rosterDialog').close();
    toast(Object.keys(map).length ? `已儲存 ${Object.keys(map).length} 位學生的名冊（只存在這台電腦）` : '已清空名冊');
  }

  // ---------- 列印 ----------
  function printRecord() {
    const keyPoints = $('#keyPoints').value.trim();
    const contact = $('#contact').value.trim();
    if (!keyPoints && !contact) { toast('結果是空的，先產生紀錄吧', 'error'); return; }
    const f = readForm();
    $('#printArea').innerHTML = `
      <h1>學生輔導紀錄</h1>
      <table>
        <tr><th>學生</th><td>${escapeHtml(f.studentName || '')}</td><th>年級</th><td>${escapeHtml(f.grade || '')}</td></tr>
        <tr><th>日期</th><td>${escapeHtml(rocDate(f.date))}</td><th>輔導方式</th><td>${escapeHtml(f.method)}${f.location ? `（${escapeHtml(f.location)}）` : ''}</td></tr>
        <tr><th>輔導對象</th><td>${escapeHtml(TARGET_LABEL[effectiveTarget(f.target, f.actions)])}</td><th>輔導類別</th><td>${escapeHtml(f.categories.join('、'))}</td></tr>
      </table>
      <section><h2>輔導內容重點</h2><p>${escapeHtml(keyPoints)}</p></section>
      <section><h2>聯繫內容</h2><p>${escapeHtml(contact)}</p></section>`;
    window.print();
  }

  // ---------- 設定 ----------
  function renderKeyDot() {
    $('#keyDot').classList.toggle('on', !!getApiKey());
    $('#btnSettings').title = getApiKey() ? `已設定金鑰（模型：${getModel() || '自動'}）` : '尚未設定 Gemini API 金鑰';
  }

  function fillModelSelect(models, selected) {
    const sel = $('#modelSelect');
    if (!models.length) {
      sel.innerHTML = '<option value="">（找不到可用模型）</option>';
      return;
    }
    sel.innerHTML = models.map((m) => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.label)}（${escapeHtml(m.id)}）</option>`).join('');
    sel.value = models.some((m) => m.id === selected) ? selected : models[0].id;
  }

  function setSettingsStatus(msg, type = '') {
    const el = $('#settingsStatus');
    el.textContent = msg;
    el.className = `status-line ${type}`;
  }

  function openSettings(hint) {
    const h = $('#settingsHint');
    h.hidden = !hint;
    h.textContent = hint || '';
    $('#apiKey').value = getApiKey();
    $('#apiKey').type = 'password';
    $('#btnToggleKey').textContent = '顯示';
    $('#rememberKey').checked = isKeyRemembered();
    const cur = getModel();
    if (cur && !$('#modelSelect').querySelector(`option[value="${CSS.escape(cur)}"]`)) {
      $('#modelSelect').innerHTML = `<option value="${escapeHtml(cur)}">${escapeHtml(cur)}</option>`;
    }
    if (cur) $('#modelSelect').value = cur;
    setSettingsStatus(getApiKey() ? `目前已設定金鑰${cur ? `，模型：${cur}` : ''}` : '');
    $('#settingsDialog').showModal();
    if (!getApiKey()) $('#apiKey').focus();
  }

  async function loadModelsInto(key) {
    setSettingsStatus('正在向 Google 確認金鑰與可用模型…');
    const models = await fetchModels(key);
    fillModelSelect(models, getModel());
    return models;
  }

  async function saveSettings() {
    const key = $('#apiKey').value.trim();
    if (!key) { setSettingsStatus('請先貼上金鑰', 'err'); return; }
    const btn = $('#btnSaveKey');
    btn.disabled = true;
    try {
      const models = await loadModelsInto(key);
      if (!models.length) { setSettingsStatus('金鑰可用，但找不到能產生文字的 Gemini 模型。', 'err'); return; }
      setApiKey(key, $('#rememberKey').checked);
      setModel($('#modelSelect').value);
      renderKeyDot();
      setSettingsStatus(`✓ 金鑰可用，已儲存（模型：${getModel()}）`, 'ok');
      toast('AI 設定完成 ✓');
      setTimeout(() => $('#settingsDialog').close(), 700);
    } catch (e) {
      setSettingsStatus(friendlyError(e), 'err');
    } finally {
      btn.disabled = false;
    }
  }

  async function refetchModels() {
    const key = $('#apiKey').value.trim() || getApiKey();
    if (!key) { setSettingsStatus('請先貼上金鑰', 'err'); return; }
    try {
      const models = await loadModelsInto(key);
      setSettingsStatus(`找到 ${models.length} 個可用模型，已依推薦順序排列。`, 'ok');
    } catch (e) {
      setSettingsStatus(friendlyError(e), 'err');
    }
  }

  // ---------- 語音輸入 ----------
  function setupSpeech() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const mics = $$('.mic');
    if (!SR) {
      mics.forEach((m) => { m.hidden = true; });
      return;
    }
    let rec = null;
    let activeBtn = null;
    const stop = () => { if (rec) rec.stop(); };
    mics.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (rec && activeBtn === btn) { stop(); return; }
        stop();
        const ta = $(`#${btn.dataset.target}`);
        let base = ta.value;
        rec = new SR();
        rec.lang = 'zh-TW';
        rec.continuous = true;
        rec.interimResults = true;
        activeBtn = btn;
        btn.classList.add('recording');
        btn.textContent = '⏹ 停止';
        rec.onresult = (ev) => {
          let interim = '';
          for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
            const r = ev.results[i];
            if (r.isFinal) base += r[0].transcript;
            else interim += r[0].transcript;
          }
          ta.value = base + interim;
        };
        rec.onerror = (ev) => {
          if (ev.error === 'not-allowed') toast('瀏覽器沒有麥克風權限', 'error');
        };
        rec.onend = () => {
          btn.classList.remove('recording');
          btn.textContent = '🎤 語音輸入';
          ta.value = base;
          if (activeBtn === btn) { rec = null; activeBtn = null; }
          saveDraftSoon();
        };
        try { rec.start(); } catch { toast('無法啟動語音輸入', 'error'); }
      });
    });
  }

  // ---------- 模式切換 ----------
  function switchView(view) {
    const isBatch = view === 'batch';
    $('#viewSingle').hidden = isBatch;
    $('#viewBatch').hidden = !isBatch;
    $('#tabSingle').setAttribute('aria-selected', String(!isBatch));
    $('#tabBatch').setAttribute('aria-selected', String(isBatch));
    store.set('localStorage', KEYS.view, view);
  }

  // ---------- 綁定 ----------
  function applyTemplate(i) {
    const t = TEMPLATES[i];
    const hasText = ['#event', '#handling', '#response'].some((s) => $(s).value.trim()) || selectedDetails().length;
    if (hasText && !confirm(`要用「${t.label}」範例取代目前填寫的內容嗎？`)) return;
    $('#event').value = t.event;
    $('#handling').value = t.handling;
    $('#response').value = t.response;
    $$('#categories input').forEach((c) => { c.checked = t.cats.includes(c.value); });
    setChips('#singleTagLib', 'tag', t.details);
    setChips('#singleActions', 'action', t.actions);
    refreshSingleTagState();
    saveDraftSoon();
    updatePeek();
  }

  function clearAll() {
    if (!confirm('確定清空所有填寫內容與結果？（紀錄本不受影響）')) return;
    fillForm({ date: todayStr() });
    $('#keyPoints').value = '';
    $('#contact').value = '';
    undoStack = null;
    $('#btnUndo').disabled = true;
    updateCounts();
    setStatus('');
    saveDraft();
    updatePeek();
  }

  function bind() {
    const single = $('#viewSingle');
    single.addEventListener('input', () => { saveDraftSoon(); if ($('.peek').open) updatePeek(); });
    single.addEventListener('change', () => { saveDraftSoon(); if ($('.peek').open) updatePeek(); });
    ['#keyPoints', '#contact'].forEach((s) => $(s).addEventListener('input', updateCounts));
    $('.peek').addEventListener('toggle', updatePeek);

    // 個別輔導：標籤
    $('#singleTagLib').addEventListener('click', (e) => {
      const b = e.target.closest('.chip-btn');
      if (!b) return;
      if (toggleChip(b)) {
        const cat = DETAIL_TO_CAT[b.dataset.tag];
        const box = $(`#categories input[value="${cat}"]`);
        if (box) box.checked = true;
      }
      refreshSingleTagState();
      saveDraftSoon();
      if ($('.peek').open) updatePeek();
    });
    $('#singleActions').addEventListener('click', (e) => {
      const b = e.target.closest('.chip-btn');
      if (!b) return;
      const on = toggleChip(b);
      if (on && b.dataset.action === '聯絡家長' && $('input[name=target]:checked').value === 'student') {
        $('input[name=target][value=both]').checked = true;
        toast('已勾「聯絡家長」，輔導對象自動改成「學生＋家長」');
      }
      saveDraftSoon();
      if ($('.peek').open) updatePeek();
    });

    $('#templates').addEventListener('click', (e) => {
      const b = e.target.closest('.tpl');
      if (b) applyTemplate(Number(b.dataset.index));
    });

    $('#btnGenerate').addEventListener('click', generate);
    $('#btnRegenerate').addEventListener('click', generate);
    $$('[data-rewrite]').forEach((b) => b.addEventListener('click', () => rewrite(b.dataset.rewrite)));
    $('#btnUndo').addEventListener('click', undo);
    $('#btnCopyPrompt').addEventListener('click', copyPrompt);
    $('#btnParse').addEventListener('click', parsePasted);
    $('#btnClear').addEventListener('click', clearAll);
    $('#btnSave').addEventListener('click', saveRecord);
    $('#btnPrint').addEventListener('click', printRecord);

    $$('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
      const v = $(`#${b.dataset.copy}`).value.trim();
      if (!v) { toast('內容是空的', 'error'); return; }
      toast((await copyText(v)) ? '已複製 ✓' : '複製失敗', '');
    }));
    $('#btnCopyAll').addEventListener('click', async () => {
      const kp = $('#keyPoints').value.trim();
      const ct = $('#contact').value.trim();
      if (!kp && !ct) { toast('內容是空的', 'error'); return; }
      toast((await copyText(`輔導內容重點：${kp}\n\n聯繫內容：${ct}`)) ? '已複製全部 ✓' : '複製失敗');
    });

    // 模式切換
    $$('.mode-tab').forEach((t) => t.addEventListener('click', () => switchView(t.dataset.view)));

    // 批次補登
    $('#seatGrid').addEventListener('click', onSeatClick);
    $('#btnRemoveSeat').addEventListener('click', removeActiveSeat);
    $('#batchTagLib').addEventListener('click', (e) => {
      const b = e.target.closest('.chip-btn');
      const s = batch.seats[batch.active];
      if (!b || !s) return;
      const on = toggleChip(b);
      s.details = on ? [...s.details, b.dataset.tag] : s.details.filter((d) => d !== b.dataset.tag);
      renderReportNotice($('#bReportNotice'), s.details);
      saveBatchSoon();
    });
    $('#batchActions').addEventListener('click', (e) => {
      const b = e.target.closest('.chip-btn');
      const s = batch.seats[batch.active];
      if (!b || !s) return;
      const on = toggleChip(b);
      s.actions = on ? [...s.actions, b.dataset.action] : s.actions.filter((a) => a !== b.dataset.action);
      saveBatchSoon();
    });
    $('#bNote').addEventListener('input', () => {
      const s = batch.seats[batch.active];
      if (s) { s.note = $('#bNote').value; saveBatchSoon(); }
    });
    ['#bDate', '#bGrade', '#bTarget', '#bMethod'].forEach((s) => $(s).addEventListener('change', readBatchCommon));
    $$('input[name=bLength], input[name=bTone]').forEach((r) => r.addEventListener('change', readBatchCommon));
    $('#btnBatchGenerate').addEventListener('click', batchGenerate);
    $('#btnBatchCopyPrompt').addEventListener('click', batchCopyPrompt);
    $('#btnBatchParse').addEventListener('click', batchParse);
    $('#btnBatchSaveAll').addEventListener('click', batchSaveAll);
    $('#btnBatchReset').addEventListener('click', batchReset);
    $('#batchResultList').addEventListener('click', onBatchResultClick);
    $('#batchResultList').addEventListener('input', (e) => {
      const ta = e.target.closest('textarea[data-field]');
      if (!ta) return;
      const k = ta.closest('.batch-card').dataset.seat;
      if (batch.results[k]) { batch.results[k][ta.dataset.field] = ta.value; saveBatchSoon(); }
    });

    // 設定
    $('#btnSettings').addEventListener('click', () => openSettings());
    $('#btnSaveKey').addEventListener('click', saveSettings);
    $('#btnFetchModels').addEventListener('click', refetchModels);
    $('#modelSelect').addEventListener('change', () => {
      if (getApiKey()) {
        setModel($('#modelSelect').value);
        renderKeyDot();
        setSettingsStatus(`已改用模型：${getModel()}`, 'ok');
      }
    });
    $('#btnToggleKey').addEventListener('click', () => {
      const show = $('#apiKey').type === 'password';
      $('#apiKey').type = show ? 'text' : 'password';
      $('#btnToggleKey').textContent = show ? '隱藏' : '顯示';
    });
    $('#btnClearKey').addEventListener('click', () => {
      setApiKey('');
      setModel('');
      $('#apiKey').value = '';
      $('#modelSelect').innerHTML = '<option value="">（儲存金鑰後自動抓取）</option>';
      renderKeyDot();
      setSettingsStatus('已清除金鑰', 'ok');
    });
    $('#settingsForm').addEventListener('submit', (e) => { e.preventDefault(); saveSettings(); });

    // 紀錄本
    $('#btnHistory').addEventListener('click', () => {
      $('#historySearch').value = '';
      renderHistory();
      renderBackupHint();
      $('#historyDialog').showModal();
    });
    $('#btnBackup').addEventListener('click', exportBackup);
    $('#btnRestore').addEventListener('click', () => $('#restoreFile').click());
    $('#restoreFile').addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) importBackup(f);
      e.target.value = '';
    });

    // 班級名冊
    $$('.btn-roster').forEach((b) => b.addEventListener('click', openRoster));
    $('#rosterText').addEventListener('input', previewRoster);
    $('#btnSaveRoster').addEventListener('click', saveRosterFromDialog);
    $('#btnClearRoster').addEventListener('click', () => {
      if (!$('#rosterText').value.trim() || confirm('確定清空名冊？')) { $('#rosterText').value = ''; previewRoster(); }
    });
    $('#btnNextEntry').addEventListener('click', gotoNextEntry);
    $('#historySearch').addEventListener('input', renderHistory);
    $('#historyList').addEventListener('click', onHistoryClick);
    $('#btnExportCsv').addEventListener('click', exportCsv);
    $('#btnClearHistory').addEventListener('click', () => {
      if (!loadHistory().length) return;
      if (!confirm('確定清除紀錄本裡的所有紀錄？這個動作無法復原，建議先匯出。')) return;
      saveHistory([]);
      renderHistory();
      renderHistoryCount();
    });

    // 對話框：關閉按鈕與點背景關閉
    $$('dialog').forEach((d) => {
      d.addEventListener('click', (e) => {
        if (e.target === d || e.target.closest('[data-close]')) d.close();
      });
    });
  }

  // ---------- 啟動 ----------
  renderStatic();
  if (!loadDraft()) fillForm({ date: todayStr() });
  if (!$('#date').value) $('#date').value = todayStr();
  updateCounts();
  renderKeyDot();
  renderHistoryCount();
  renderRosterList();
  fillBatchCommon();
  renderSeatGrid();
  renderSeatEditor();
  renderBatchResults();
  setupSpeech();
  bind();
  switchView(store.get('localStorage', KEYS.view) === 'batch' ? 'batch' : 'single');
})();
