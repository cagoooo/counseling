'use strict';

(() => {
  const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
  const KEYS = {
    apiKey: 'crh.apiKey',
    model: 'crh.model',
    history: 'crh.history',
    draft: 'crh.draft',
  };

  const CATEGORIES = ['人際關係', '情緒困擾', '學習適應', '生活常規', '行為偏差', '家庭關係', '身心健康', '校園安全', '生涯興趣', '其他'];
  const OTHER_CODES = ['乙生', '丙生', '丁生', '戊生', '己生', '庚生', '辛生', '壬生', '癸生'];
  const TARGET_LABEL = {
    student: '學生本人（教師未聯繫家長）',
    parent: '家長',
    both: '學生本人及家長',
    teacher: '其他教師／輔導室',
  };
  const TARGET_RULE = {
    student: '本次為教師與學生本人晤談，教師「沒有」聯繫家長。內容不得提及聯繫家長、家長回應或請家長配合等事項。',
    parent: '本次為教師與家長聯繫。請描述聯繫的緣由、與家長溝通的內容、家長的回應，以及親師之間的共識與後續合作方式。',
    both: '本次教師先與學生本人晤談，並另外聯繫家長。請依序描述與學生的晤談，以及與家長溝通的內容與親師共識。',
    teacher: '本次為教師與其他教師或輔導室討論學生狀況。請描述討論的內容、彼此的觀察與後續分工。',
  };
  const LENGTH_SPEC = {
    short: { kp: '20～40 字', ct: '80～150 字' },
    normal: { kp: '30～60 字', ct: '150～250 字' },
    long: { kp: '40～80 字', ct: '250～400 字' },
  };

  const TEMPLATES = [
    {
      label: '同儕衝突', cats: ['人際關係', '生活常規'],
      event: '下課時他和同學在走廊搶球，一生氣推了同學一把，同學跌倒膝蓋擦傷。他一開始覺得是對方先搶球，不覺得自己有錯。',
      handling: '先確認受傷的同學到保健室處理，再分別聽兩人說明經過。引導他說出當下生氣的感受，討論推人可能造成的危險，一起想下次生氣時可以先深呼吸、用說的或請老師幫忙。',
      response: '他冷靜後承認推人不對，主動向同學道歉，說下次會先用說的。',
    },
    {
      label: '上課分心', cats: ['學習適應'],
      event: '最近數學課常玩橡皮擦、和隔壁同學講話，提醒後很快又分心，習作也常寫不完。',
      handling: '下課找他個別聊聊，了解是聽不懂還是覺得無聊。他說分數的部分聽不太懂。和他約定上課不懂就舉手，並把座位調到靠近老師，下課利用十分鐘一起複習。',
      response: '他願意試試看，說會先把習作完成再去玩。',
    },
    {
      label: '作業缺交', cats: ['學習適應', '生活常規'],
      event: '這兩週作業缺交五次，問他都說忘記帶或沒寫。',
      handling: '和他一起檢查聯絡簿的登記習慣，教他回家先看聯絡簿、寫完一項就打勾，並約定每天放學前由小老師提醒他。',
      response: '他說回家常常先看電視就忘了，答應會先寫完作業再看電視。',
    },
    {
      label: '情緒低落', cats: ['情緒困擾', '人際關係'],
      event: '這幾天看起來悶悶不樂，下課都一個人坐在位子上，問他也只說沒事。',
      handling: '利用午休個別陪伴聊天，先聊他喜歡的事，再慢慢問近況。他說好朋友最近都跟別人玩，覺得被冷落。老師同理他的感受，和他討論可以主動邀請同學一起玩，也可以多認識其他同學。',
      response: '他說明天想試著邀好朋友一起打躲避球，也知道有心事可以找老師說。',
    },
    {
      label: '危險行為', cats: ['校園安全', '生活常規'],
      event: '美勞課時拿著剪刀在教室裡揮來揮去玩鬧，差點刺到旁邊的同學。',
      handling: '立刻請他放下剪刀，課後個別說明剪刀的正確使用方式和可能造成的傷害，請他想想如果被刺到的是自己會有什麼感覺。',
      response: '他了解這樣很危險，向同學道歉，答應之後會正確使用剪刀。',
    },
    {
      label: '遲到常規', cats: ['生活常規'],
      event: '這個月已經遲到六次，常錯過早自習。他說早上爸媽很早出門，自己起不來。',
      handling: '和他討論前一晚的作息，建議早點睡並自己設定鬧鐘，同時說明準時到校的重要。',
      response: '他答應今晚十點前睡覺，並試著用鬧鐘自己起床。',
    },
  ];

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

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

  // ---------- 表單 ----------
  function renderStatic() {
    $('#categories').innerHTML = CATEGORIES.map((c) => `<label><input type="checkbox" value="${c}"><span>${c}</span></label>`).join('');
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

  function readForm() {
    return {
      studentName: $('#studentName').value.trim(),
      otherNames: $('#otherNames').value.trim(),
      grade: $('#grade').value,
      date: $('#date').value,
      target: ($('input[name=target]:checked') || {}).value || 'student',
      method: $('#method').value,
      categories: $$('#categories input:checked').map((i) => i.value),
      event: $('#event').value.trim(),
      handling: $('#handling').value.trim(),
      response: $('#response').value.trim(),
      length: ($('input[name=length]:checked') || {}).value || 'normal',
      tone: ($('input[name=tone]:checked') || {}).value || 'neutral',
      restoreNames: $('#restoreNames').checked,
    };
  }

  function fillForm(f) {
    if (!f) return;
    $('#studentName').value = f.studentName || '';
    $('#otherNames').value = f.otherNames || '';
    $('#grade').value = f.grade || '';
    $('#date').value = f.date || todayStr();
    $$('input[name=target]').forEach((r) => { r.checked = r.value === (f.target || 'student'); });
    $('#method').value = f.method || '個別晤談';
    $$('#categories input').forEach((c) => { c.checked = (f.categories || []).includes(c.value); });
    $('#event').value = f.event || '';
    $('#handling').value = f.handling || '';
    $('#response').value = f.response || '';
    $$('input[name=length]').forEach((r) => { r.checked = r.value === (f.length || 'normal'); });
    $$('input[name=tone]').forEach((r) => { r.checked = r.value === (f.tone || 'neutral'); });
    $('#restoreNames').checked = !!f.restoreNames;
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

  // ---------- 去識別化 ----------
  const splitNames = (s) => s.split(/[,，、;；\s]+/).map((x) => x.trim()).filter((x) => x.length >= 2);

  function buildAliases(form) {
    const list = [];
    splitNames(form.studentName).forEach((n) => list.push({ real: n, code: '甲生' }));
    splitNames(form.otherNames).forEach((n, i) => list.push({ real: n, code: OTHER_CODES[i] || `同學${i + 1}` }));
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
  function buildMessages(form, mode) {
    const aliases = buildAliases(form);
    const len = LENGTH_SPEC[form.length] || LENGTH_SPEC.normal;
    const tone = form.tone === 'warm'
      ? '語氣溫暖、正向、具同理心，肯定學生的努力，但仍維持專業書面用語。'
      : '語氣客觀、中性、專業，避免情緒性字眼。';

    const system = [
      '### 角色',
      '你是一位經驗豐富的臺灣國小導師，熟悉學校「學生輔導資料紀錄表」的撰寫方式。你的任務是把老師口語、零散的描述，整理成可以直接登錄到校務系統的正式輔導紀錄。',
      '',
      '### 輸出內容',
      `1.「輔導內容重點」：用一段話簡要說明發生了什麼事（約 ${len.kp}）。`,
      `2.「聯繫內容」：用一段話詳細描述事件經過、教師如何處理與引導學生，以及學生未來可以怎麼做（約 ${len.ct}）。`,
      '',
      '### 撰寫規則',
      '- 一律使用繁體中文與臺灣慣用語，採書面語、第三人稱。',
      '- 兩個部分各自只能是「一個段落」，不要條列、不要換行、不要另加標題。',
      '- 主角學生在資料中以「甲生」代稱，輸出時一律稱為「該生」；其他人物保留資料中的代稱（如乙生、丙生），不得自行編造姓名。',
      `- ${TARGET_RULE[form.target] || TARGET_RULE.student}`,
      '- 只根據老師提供的資訊撰寫，不得捏造未提及的事件、對話、診斷或結果；資訊不足時用概括的方式描述，不要自行補細節。',
      '- 把口語轉為專業描述（例如「他說好」→「該生表示願意嘗試」、「很兇」→「情緒較為激動」），避免標籤化或貶抑字眼，不做醫療或心理診斷。',
      '- 「聯繫內容」依序包含：事件經過 → 教師的處理與引導 → 學生的反應或承諾 → 後續可行的做法或教師將持續觀察的重點。',
      `- ${tone}`,
    ];
    if (mode === 'json') {
      system.push('', '### 輸出格式', '以 JSON 輸出，欄位 key_points 為「輔導內容重點」，contact 為「聯繫內容」。');
    } else {
      system.push('', '### 輸出格式', '只輸出以下兩段，不要有其他說明：', '輔導內容重點：（一段文字）', '', '聯繫內容：（一段文字）');
    }

    const di = (s) => deidentify(s, aliases);
    const user = [
      '### 輔導資料',
      `- 日期：${form.date ? rocDate(form.date) : '未提供'}`,
      `- 年級：${form.grade || '未提供'}`,
      `- 輔導對象：${TARGET_LABEL[form.target]}`,
      `- 輔導方式：${form.method}`,
      `- 輔導類別：${form.categories.length ? form.categories.join('、') : '未指定'}`,
      `- 事件經過：${di(form.event)}`,
      `- 教師的處理與引導：${form.handling ? di(form.handling) : '（老師未填寫，請依事件性質以一般合宜的輔導方式概括描述，不要捏造具體對話）'}`,
      `- 學生的回應與後續：${form.response ? di(form.response) : '（老師未填寫，請勿捏造學生的具體承諾，可寫教師將持續觀察）'}`,
    ];

    return { system: system.join('\n'), user: user.join('\n'), aliases };
  }

  function updatePeek() {
    const form = readForm();
    if (!form.event) {
      $('#peek').textContent = '（先填寫事件經過）';
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
      if (/API key not valid|API_KEY_INVALID/i.test(m)) return '金鑰無效，請到「AI 設定」確認有沒有貼完整。';
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

  async function callGemini(system, user) {
    const key = getApiKey();
    const model = getModel();
    const body = {
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
    };
    let res;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      res = await fetch(`${API_BASE}/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(body),
      });
      if (res.status !== 503) break;
      await new Promise((r) => setTimeout(r, 1500));
    }
    if (!res.ok) throw await toApiError(res);
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

  // ---------- 產生 ----------
  let busy = false;
  function setBusy(on) {
    busy = on;
    $('#btnGenerate').classList.toggle('loading', on);
    $('#btnGenerate').disabled = on;
    $('#btnRegenerate').disabled = on;
    $('#outputCard').classList.toggle('busy', on);
  }

  async function generate() {
    if (busy) return;
    const form = readForm();
    if (!form.event) {
      toast('請先填寫「事件經過」', 'error');
      $('#event').focus();
      return;
    }
    if (!getApiKey()) {
      openSettings('先設定 Gemini API 金鑰；或關掉這個視窗，改用「不用金鑰：複製提示詞到 Gemini」。');
      return;
    }
    const { system, user, aliases } = buildMessages(form, 'json');
    setBusy(true);
    setStatus('AI 整理中…');
    try {
      const model = await ensureModel();
      const r = await callGemini(system, user);
      $('#keyPoints').value = postProcess(r.key_points, aliases, form.restoreNames);
      $('#contact').value = postProcess(r.contact, aliases, form.restoreNames);
      updateCounts();
      saveDraft();
      setStatus(`完成 ✓（${model}）`, 'ok');
      if (window.matchMedia('(max-width: 1080px)').matches) {
        $('#outputCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (e) {
      const msg = friendlyError(e);
      if (e instanceof ApiError && e.status === 404) setModel('');
      setStatus('產生失敗', 'err');
      toast(msg, 'error', 6000);
    } finally {
      setBusy(false);
    }
  }

  let lastChatAliases = [];
  async function copyPrompt() {
    const form = readForm();
    if (!form.event) {
      toast('請先填寫「事件經過」', 'error');
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
    $('#keyPoints').value = postProcess(r.key_points, aliases, restore);
    $('#contact').value = postProcess(r.contact, aliases, restore);
    $('#pasteText').value = '';
    updateCounts();
    saveDraft();
    setStatus('已從貼上內容拆段 ✓', 'ok');
  }

  // ---------- 紀錄本 ----------
  function saveRecord() {
    const keyPoints = $('#keyPoints').value.trim();
    const contact = $('#contact').value.trim();
    if (!keyPoints && !contact) { toast('結果是空的，先產生紀錄吧', 'error'); return; }
    const form = readForm();
    const list = loadHistory();
    list.unshift({
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      savedAt: new Date().toISOString(),
      form,
      keyPoints,
      contact,
    });
    saveHistory(list);
    renderHistoryCount();
    toast('已存入紀錄本 💾');
  }

  function renderHistoryCount() {
    $('#historyCount').textContent = loadHistory().length;
  }

  function renderHistory() {
    const q = $('#historySearch').value.trim();
    const list = loadHistory().filter((r) => {
      if (!q) return true;
      const f = r.form || {};
      return [f.studentName, f.date, f.grade, (f.categories || []).join(' '), r.keyPoints, r.contact].join(' ').includes(q);
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
    const rows = [['日期', '年級', '學生', '輔導對象', '輔導方式', '輔導類別', '輔導內容重點', '聯繫內容']];
    list.forEach((r) => {
      const f = r.form || {};
      rows.push([f.date, f.grade, f.studentName, TARGET_LABEL[f.target] || '', f.method, (f.categories || []).join('、'), r.keyPoints, r.contact]);
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
        <tr><th>日期</th><td>${escapeHtml(rocDate(f.date))}</td><th>輔導方式</th><td>${escapeHtml(f.method)}</td></tr>
        <tr><th>輔導對象</th><td>${escapeHtml(TARGET_LABEL[f.target])}</td><th>輔導類別</th><td>${escapeHtml(f.categories.join('、'))}</td></tr>
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

  // ---------- 綁定 ----------
  function applyTemplate(i) {
    const t = TEMPLATES[i];
    const hasText = ['#event', '#handling', '#response'].some((s) => $(s).value.trim());
    if (hasText && !confirm(`要用「${t.label}」範例取代目前填寫的內容嗎？`)) return;
    $('#event').value = t.event;
    $('#handling').value = t.handling;
    $('#response').value = t.response;
    $$('#categories input').forEach((c) => { c.checked = t.cats.includes(c.value); });
    saveDraftSoon();
    updatePeek();
  }

  function clearAll() {
    if (!confirm('確定清空所有填寫內容與結果？（紀錄本不受影響）')) return;
    fillForm({ date: todayStr() });
    $('#keyPoints').value = '';
    $('#contact').value = '';
    updateCounts();
    setStatus('');
    saveDraft();
    updatePeek();
  }

  function bind() {
    document.querySelector('main').addEventListener('input', () => { saveDraftSoon(); });
    document.querySelector('main').addEventListener('change', () => { saveDraftSoon(); });
    ['#keyPoints', '#contact'].forEach((s) => $(s).addEventListener('input', updateCounts));
    $('.peek').addEventListener('toggle', updatePeek);
    $('main').addEventListener('input', () => { if ($('.peek').open) updatePeek(); });

    $('#templates').addEventListener('click', (e) => {
      const b = e.target.closest('.tpl');
      if (b) applyTemplate(Number(b.dataset.index));
    });

    $('#btnGenerate').addEventListener('click', generate);
    $('#btnRegenerate').addEventListener('click', generate);
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
      $('#historyDialog').showModal();
    });
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
  setupSpeech();
  bind();
})();
