// 輔導紀錄小幫手：自動回歸測試
// Gemini API 全部以模擬回應取代：不需要金鑰、不花額度，並可檢查送出的內容有沒有外洩姓名。
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const API = 'https://generativelanguage.googleapis.com/**';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const DEFAULT_REPLY = { key_points: '甲生與乙生發生衝突。', contact: '甲生與乙生在走廊搶球，教師引導甲生向乙生道歉。' };

// 模擬 Gemini：回傳 calls 陣列（每次 generateContent 的請求內容）
async function mockGemini(page, reply) {
  const calls = [];
  await page.route(API, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (req.method() === 'GET') {
      return route.fulfill({ headers: CORS, json: { models: [{ name: 'models/gemini-3.5-flash-lite', displayName: 'Flash Lite', supportedGenerationMethods: ['generateContent'] }] } });
    }
    const body = req.postDataJSON();
    calls.push({ system: body.systemInstruction.parts[0].text, user: body.contents[0].parts[0].text });
    const r = typeof reply === 'function' ? reply(calls.at(-1), calls.length) : (reply || DEFAULT_REPLY);
    if (r.status) return route.fulfill({ status: r.status, headers: CORS, json: { error: { message: r.message || 'error' } } });
    return route.fulfill({ headers: CORS, json: { candidates: [{ content: { parts: [{ text: JSON.stringify(r) }] } }] } });
  });
  return calls;
}

// 已看過說明、已設定（假的）金鑰
async function ready(page, { key = true, onboarded = true, storage = {} } = {}) {
  await page.addInitScript(({ key, onboarded, storage }) => {
    if (sessionStorage.getItem('__init')) return; // 只在第一次載入時設定，重新整理不覆蓋
    sessionStorage.setItem('__init', '1');
    if (onboarded) localStorage.setItem('crh.onboarded', '1');
    if (key) { sessionStorage.setItem('crh.apiKey', 'TEST-KEY'); localStorage.setItem('crh.model', 'gemini-3.5-flash-lite'); }
    Object.entries(storage).forEach(([k, v]) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)));
  }, { key, onboarded, storage });
}

async function generate(page) {
  await page.click('#btnGenerate');
  try {
    await expect(page.locator('#status')).toContainText(/完成|失敗/, { timeout: 10000 });
  } catch (e) {
    console.log('DEBUG', JSON.stringify(await page.evaluate(() => ({ status: document.querySelector('#status').textContent, toast: document.querySelector('#toast').textContent, dialogs: [...document.querySelectorAll('dialog[open]')].map((d) => d.id), key: sessionStorage.getItem('crh.apiKey'), ev: document.querySelector('#event').value, busy: document.querySelector('#btnGenerate').disabled }))));
    throw e;
  }
}

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}

// ---------------------------------------------------------------------------
test('載入沒有錯誤，四處版本號一致，頁尾署名正確', async ({ page }) => {
  const errors = trackErrors(page);
  await ready(page);
  await page.goto('/');
  const ver = JSON.parse(readFileSync('version.json', 'utf8')).version;
  await expect(page.locator('#appVersion')).toHaveText(`v${ver}`);
  expect(readFileSync('sw.js', 'utf8')).toContain(`const BUILD_VERSION = '${ver}'`);
  const html = readFileSync('index.html', 'utf8');
  const vs = [...html.matchAll(/\?v=([0-9.\-]+)/g)].map((m) => m[1]);
  expect(vs.length).toBeGreaterThanOrEqual(5);
  expect(new Set(vs)).toEqual(new Set([ver]));
  const credit = page.locator('.site-credit__author');
  await expect(credit).toHaveText('阿凱老師');
  await expect(credit).toHaveAttribute('href', 'https://www.smes.tyc.edu.tw/modules/school/index.php?department_id=2&zone_id=0&page_id=2&content_id=11&type=news&from_op=all_news#a5');
  await expect(page.locator('.footer-school')).toContainText('石門國民小學');
  expect(html).not.toContain('新明');
  expect(errors).toEqual([]);
});

test('第一次開啟顯示使用說明，第二次不再自動跳出', async ({ page }) => {
  await ready(page, { onboarded: false });
  await page.goto('/');
  await expect(page.locator('#helpDialog')).toBeVisible();
  await page.click('#helpDialog .btn.primary[data-close]');
  await page.reload();
  await page.waitForTimeout(800);
  await expect(page.locator('#helpDialog')).toBeHidden();
  await page.click('#btnHelp');
  await expect(page.locator('#helpDialog')).toBeVisible();
});

test('個別產生：姓名、電話、名冊同學都去識別化，輸出用「該生」並可還原同學姓名', async ({ page }) => {
  const calls = await mockGemini(page);
  await ready(page, { storage: { 'crh.roster': { 1: '王小明', 2: '李大同', 3: '陳美美' } } });
  await page.goto('/');
  await page.fill('#studentName', '王小明');
  await page.fill('#event', '小明跟李大同搶球推人，陳美美在旁邊哭了，媽媽電話0912-345-678，身分證A123456789。');
  await page.check('#restoreNames');
  await generate(page);
  const sent = calls[0].system + calls[0].user;
  for (const leak of ['王小明', '小明', '李大同', '大同', '陳美美', '美美', '0912', 'A123456789']) expect(sent).not.toContain(leak);
  expect(calls[0].user).toContain('甲生跟乙生搶球推人，丙生在旁邊哭了');
  expect(calls[0].user).toContain('[電話已遮蔽]');
  await expect(page.locator('#keyPoints')).toHaveValue('該生與李大同發生衝突。');
  await expect(page.locator('#contact')).toHaveValue(/該生向李大同道歉/);
});

test('一鍵改寫會重新去識別化，並可復原', async ({ page }) => {
  const calls = await mockGemini(page, (c, n) => ({ key_points: `版本${n}：甲生與乙生衝突。`, contact: `版本${n}：甲生向乙生道歉。` }));
  await ready(page);
  await page.goto('/');
  await page.fill('#studentName', '王小明');
  await page.fill('#otherNames', '李大同');
  await page.fill('#event', '小明推了李大同');
  await page.check('#restoreNames');
  await generate(page);
  await page.click('[data-rewrite="gentle"]');
  await expect(page.locator('#keyPoints')).toHaveValue(/版本2/);
  expect(calls[1].user).toContain('改寫');
  expect(calls[1].user).not.toContain('李大同');
  await page.click('#btnUndo');
  await expect(page.locator('#keyPoints')).toHaveValue(/版本1/);
});

test('標籤：點狀況自動勾類別、勾聯絡家長自動改對象、敏感標籤顯示通報提醒', async ({ page }) => {
  await ready(page);
  await page.goto('/');
  await page.click('#singleTagLib [data-tag="同儕衝突"]');
  await expect(page.locator('#categories input[value="人際關係"]')).toBeChecked();
  await expect(page.locator('#eventReq')).toHaveText('可只寫補充');
  await page.click('#singleTagLib [data-tag="疑似霸凌"]');
  await expect(page.locator('#reportNotice')).toBeVisible();
  await page.click('#singleActions [data-action="聯絡家長"]');
  await expect(page.locator('input[name=target][value=both]')).toBeChecked();
});

test('品質檢查：標出診斷字眼、補造細節、內部用語，並可選取該段文字', async ({ page }) => {
  await mockGemini(page, { key_points: '該生疑似過動，上課干擾。', contact: '教師透過電話聯繫家長，家長表示會配合，該生未說明原因。' });
  await ready(page);
  await page.goto('/');
  await page.fill('#event', '上課一直講話干擾同學');
  await generate(page);
  const panel = page.locator('#qcPanel');
  await expect(panel).toHaveClass(/has-issues/);
  await expect(page.locator('#qcList li')).toHaveCount(4); // 過動、電話、家長表示、未說明
  await expect(page.locator('#qcList')).toContainText('過動');
  await expect(page.locator('#qcList')).toContainText('電話');
  await page.locator('#qcList [data-qc]').nth(1).click();
  const sel = await page.evaluate(() => { const t = document.querySelector('#contact'); return t.value.slice(t.selectionStart, t.selectionEnd); });
  expect(sel).toBe('電話');
  // 老師自己寫了「電話」就不算補造
  await page.fill('#handling', '打電話給家長');
  await page.locator('#contact').press('End');
  await page.locator('#contact').pressSequentially(' ');
  await expect(page.locator('#qcList')).not.toContainText('「電話」沒有出現');
  // 改成乾淨的內容 → 通過
  await page.fill('#keyPoints', '該生上課時常與同學講話。');
  await page.fill('#contact', '教師與該生個別晤談，約定上課專心聽講。');
  await expect(panel).not.toHaveClass(/has-issues/);
  await expect(page.locator('#qcTitle')).toContainText('沒有發現常見問題');
});

test('學校格式：自訂欄位名稱與字數上限，提示詞、計數、貼回拆段都跟著改', async ({ page }) => {
  const calls = await mockGemini(page);
  await ready(page);
  await page.goto('/');
  await page.click('#btnSettings');
  await page.fill('#fmtKpLabel', '輔導概要'); await page.locator('#fmtKpLabel').press('Tab');
  await page.fill('#fmtKpMax', '20'); await page.locator('#fmtKpMax').press('Tab');
  await page.fill('#fmtCtLabel', '處理情形'); await page.locator('#fmtCtLabel').press('Tab');
  await page.click('#settingsDialog [data-close]');
  await expect(page.locator('label[for="keyPoints"]')).toHaveText('輔導概要');
  await expect(page.locator('label[for="contact"]')).toHaveText('處理情形');
  await page.fill('#event', '搶球推人');
  await generate(page);
  expect(calls[0].system).toContain('「輔導概要」');
  expect(calls[0].system).toContain('不超過 20 字');
  await page.fill('#keyPoints', '一二三四五六七八九十一二三四五六七八九十多');
  await expect(page.locator('#kpCount')).toHaveClass(/over/);
  await page.click('#pasteBack summary');
  await page.fill('#pasteText', '輔導概要：該生與同學爭執。\n處理情形：教師個別晤談。');
  await page.click('#btnParse');
  await expect(page.locator('#keyPoints')).toHaveValue('該生與同學爭執。');
  await expect(page.locator('#contact')).toHaveValue('教師個別晤談。');
});

test('追蹤輔導：有過去紀錄時可勾選，並把前次紀錄（去識別化）一起送出', async ({ page }) => {
  const calls = await mockGemini(page);
  const prev = { id: 'p1', savedAt: '2026-09-15T08:00:00.000Z', form: { studentName: '王小明', otherNames: '李大同', date: '2026-09-15', method: '個別晤談', categories: ['人際關係'], details: [], actions: [] }, keyPoints: '該生與李大同搶球推人。', contact: '教師引導該生道歉，約定生氣時先深呼吸。' };
  await ready(page, { storage: { 'crh.history': [prev] } });
  await page.goto('/');
  await page.fill('#studentName', '林小華');
  await expect(page.locator('#followupBox')).toBeHidden();
  await page.fill('#studentName', '王小明');
  await expect(page.locator('#followupTitle')).toContainText('1 筆過去紀錄');
  await page.check('#followupOn');
  await page.fill('#event', '這次和大同起衝突，但有先深呼吸');
  await generate(page);
  expect(calls[0].user).toContain('前次輔導紀錄');
  expect(calls[0].user).toContain('約定生氣時先深呼吸');
  expect(calls[0].system).toContain('本次為追蹤輔導');
  expect(calls[0].user).not.toMatch(/李大同|大同/);
});

test('班級名冊：支援 Excel 貼上，看不懂的行會提示', async ({ page }) => {
  await ready(page);
  await page.goto('/');
  await page.click('.btn-roster >> nth=0');
  await page.fill('#rosterText', '1\t王小明\t男\n2\t李大同\t男\n05. 林小華\n12號,張志明\n亂打一行123');
  await expect(page.locator('#rosterPreview')).toContainText('已辨識 4 位');
  await expect(page.locator('#rosterPreview')).toContainText('1 行看不懂');
  page.once('dialog', (d) => d.accept());
  await page.click('#btnSaveRoster');
  const roster = await page.evaluate(() => JSON.parse(localStorage.getItem('crh.roster')));
  expect(roster).toEqual({ 1: '王小明', 2: '李大同', 5: '林小華', 12: '張志明' });
  await expect(page.locator('#rosterList option')).toHaveCount(4);
});

test('批次補登：產生、顯示名冊姓名、品質檢查、標記已登錄與下一位', async ({ page }) => {
  const calls = await mockGemini(page);
  await ready(page, { storage: { 'crh.roster': { 1: '王小明', 2: '李大同' } } });
  await page.goto('/');
  await page.click('#tabBatch');
  await page.click('.seat[data-seat="1"]');
  await page.click('#batchTagLib [data-tag="同儕衝突"]');
  await page.fill('#bNote', '王小明下課和李大同搶球');
  await page.click('.seat[data-seat="2"]');
  await page.click('#batchTagLib [data-tag="遲到"]');
  await page.click('#btnBatchGenerate');
  await expect(page.locator('#batchProgressText')).toContainText('全部完成（2 位');
  expect(calls).toHaveLength(2);
  expect(calls.map((c) => c.user).join()).not.toMatch(/王小明|李大同|小明|大同/);
  await expect(page.locator('.batch-card[data-seat="1"] .seat-name')).toHaveText('王小明');
  await expect(page.locator('.batch-card[data-seat="1"] .qc-mini')).toBeVisible();
  await expect(page.locator('#enteredCount')).toHaveText('已登錄 0 / 2 位');
  await page.click('#btnNextEntry');
  await expect(page.locator('.batch-card[data-seat="1"]')).toHaveClass(/flash/);
  await page.click('.batch-card[data-seat="1"] [data-bact="entered"]');
  await expect(page.locator('#enteredCount')).toHaveText('已登錄 1 / 2 位');
  await expect(page.locator('.seat[data-seat="1"]')).toHaveClass(/entered/);
  await page.click('.batch-card[data-seat="2"] [data-bact="entered"]');
  await expect(page.locator('#btnNextEntry')).toBeHidden();
  await page.click('#btnBatchSaveAll');
  const names = await page.evaluate(() => JSON.parse(localStorage.getItem('crh.history')).map((r) => r.form.studentName));
  expect(names.sort()).toEqual(['1 號 王小明', '2 號 李大同']);
});

test('備份與還原：下載備份檔，清空後可完整還原紀錄與名冊，重複的會略過', async ({ page }) => {
  const rec = (id) => ({ id, savedAt: '2026-10-01T08:00:00.000Z', form: { studentName: '王小明', date: '2026-10-01' }, keyPoints: '重點', contact: '內容' });
  await ready(page, { storage: { 'crh.history': [rec('a'), rec('b')], 'crh.roster': { 1: '王小明' } } });
  await page.goto('/');
  await page.click('#btnHistory');
  await expect(page.locator('#backupHint')).toContainText('還沒備份過');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#btnBackup')]);
  const path = await download.path();
  const data = JSON.parse(readFileSync(path, 'utf8'));
  expect(data.type).toBe('counseling-record-helper-backup');
  expect(data.records).toHaveLength(2);
  await expect(page.locator('#backupHint')).toContainText('目前都已備份');
  await page.evaluate(() => { localStorage.removeItem('crh.history'); localStorage.removeItem('crh.roster'); });
  await page.reload();
  await page.click('#btnHistory');
  await page.setInputFiles('#restoreFile', path);
  await expect(page.locator('#toast')).toContainText('已還原 2 筆紀錄，並還原班級名冊');
  await page.setInputFiles('#restoreFile', path);
  await expect(page.locator('#toast')).toContainText('略過 2 筆');
  await page.setInputFiles('#restoreFile', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"a":1}') });
  await expect(page.locator('#toast')).toContainText('不是輔導紀錄小幫手的備份檔');
});

test('紀錄本：依學生彙整成時間軸、日期篩選、匯出目前篩選的 CSV', async ({ page }) => {
  const mk = (id, name, date, cat) => ({ id, savedAt: `${date}T08:00:00.000Z`, form: { studentName: name, date, method: '個別晤談', categories: [cat] }, keyPoints: `${name}${date}`, contact: '內容' });
  await ready(page, { storage: { 'crh.history': [mk('1', '王小明', '2026-10-06', '學習適應'), mk('2', '3 號 陳美美', '2026-10-10', '情緒困擾'), mk('3', '王小明', '2026-09-15', '人際關係'), mk('4', '陳美美', '2026-08-30', '情緒困擾')] } });
  await page.goto('/');
  await page.click('#btnHistory');
  await expect(page.locator('#historyStudent option')).toHaveCount(3); // 全部＋王小明＋陳美美（座號前綴合併）
  await page.selectOption('#historyStudent', '王小明');
  await expect(page.locator('#historySummary')).toContainText('王小明：共 2 筆，2026-09-15 ～ 2026-10-06');
  await expect(page.locator('.history-item .tl-no').first()).toHaveText('第 1 次');
  await expect(page.locator('.history-preview').first()).toHaveText('王小明2026-09-15');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btnExportCsv')]);
  const csv = readFileSync(await dl.path(), 'utf8');
  expect(csv.charCodeAt(0)).toBe(0xfeff); // Excel 開啟中文不亂碼
  expect(csv.trim().split('\r\n')).toHaveLength(3);
  await page.click('#btnClearFilter');
  await page.fill('#historyFrom', '2026-10-01');
  await page.locator('#historyFrom').dispatchEvent('change');
  await expect(page.locator('#historySummary')).toHaveText('符合條件：2 筆');
});

test('公用電腦模式：資料只存在分頁，新分頁看不到；關閉後資料搬回', async ({ page, context }) => {
  await ready(page, { storage: { 'crh.history': [{ id: 'a', savedAt: '2026-10-01T00:00:00Z', form: { studentName: '王小明' }, keyPoints: 'k', contact: 'c' }] } });
  await page.goto('/');
  await page.click('#btnSettings');
  page.once('dialog', (d) => d.accept());
  await page.check('#publicMode');
  await expect(page.locator('#publicBanner')).toBeVisible();
  expect(await page.evaluate(() => [localStorage.getItem('crh.history'), !!sessionStorage.getItem('crh.history')])).toEqual([null, true]);
  await expect(page.locator('#rememberKey')).toBeDisabled();
  const other = await context.newPage();
  await other.goto('/');
  await expect(other.locator('#historyCount')).toHaveText('0');
  await expect(other.locator('#publicBanner')).toBeVisible();
  await page.click('#settingsDialog [data-close]');
  page.once('dialog', (d) => d.accept());
  await page.click('#btnPublicOff');
  await expect(page.locator('#publicBanner')).toBeHidden();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('crh.history')).length)).toBe(1);
});

test('不用金鑰：複製提示詞並開啟 Gemini，貼回回覆可自動拆段', async ({ page, context }) => {
  await ready(page, { key: false });
  await context.route('https://gemini.google.com/**', (r) => r.fulfill({ body: 'gemini' }));
  await page.goto('/');
  await page.fill('#studentName', '王小明');
  await page.fill('#event', '小明下課推人');
  const [popup] = await Promise.all([context.waitForEvent('page'), page.click('#btnCopyPrompt')]);
  expect(popup.url()).toContain('gemini.google.com');
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain('### 輔導資料');
  expect(clip).not.toContain('小明');
  await page.fill('#pasteText', '**輔導內容重點：** 甲生下課推人。\n\n**聯繫內容：** 教師引導甲生道歉。');
  await page.click('#btnParse');
  await expect(page.locator('#keyPoints')).toHaveValue('該生下課推人。');
});

test('錯誤處理：金鑰無效顯示中文說明；伺服器忙碌會自動重試成功', async ({ page }) => {
  let mode = 'bad';
  await mockGemini(page, (c, n) => {
    if (mode === 'bad') return { status: 400, message: 'API key not valid. Please pass a valid API key.' };
    return n === 2 ? { status: 503, message: 'busy' } : DEFAULT_REPLY;
  });
  await ready(page);
  await page.goto('/');
  await page.fill('#event', '推人');
  await generate(page);
  await expect(page.locator('#toast')).toContainText('金鑰無效');
  mode = 'busy';
  await page.click('#btnGenerate');
  await expect(page.locator('#status')).toContainText('完成', { timeout: 15000 });
});

test('列印：只印出紀錄內容並套用欄位名稱', async ({ page }) => {
  await ready(page);
  await page.goto('/');
  await page.evaluate(() => { window.print = () => { window.__printed = document.querySelector('#printArea').innerText; }; });
  await page.fill('#studentName', '王小明');
  await page.fill('#keyPoints', '重點內容');
  await page.fill('#contact', '聯繫內容文字');
  await page.click('#btnPrint');
  const printed = await page.evaluate(() => window.__printed);
  expect(printed).toContain('學生輔導紀錄');
  expect(printed).toContain('王小明');
  expect(printed).toContain('聯繫內容文字');
});

test('本機開發不註冊 Service Worker（避免快取干擾修改）', async ({ page }) => {
  await ready(page);
  await page.goto('/');
  await page.waitForTimeout(800);
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
});

for (const vp of [{ name: '手機', width: 375, height: 812, minFont: 14 }, { name: '電腦', width: 1440, height: 900, minFont: 15 }]) {
  test(`版面（${vp.name} ${vp.width}）：無水平捲動、頁首不重疊、最小字級達標`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await ready(page, { storage: { 'crh.history': Array.from({ length: 12 }, (_, i) => ({ id: `r${i}`, savedAt: '2026-10-01T00:00:00Z', form: { studentName: 'x' }, keyPoints: 'k', contact: 'c' })) } });
    await page.goto('/');
    for (const tab of ['#tabSingle', '#tabBatch']) {
      await page.click(tab);
      const m = await page.evaluate(() => {
        const els = [...document.querySelectorAll('body *')].filter((el) => !el.closest('dialog,#printArea') && el.getBoundingClientRect().width
          && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
        const h1 = document.querySelector('.brand h1').getBoundingClientRect();
        const act = document.querySelector('.top-actions').getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          overlap: h1.right > act.left,
          minFont: Math.min(...els.map((el) => parseFloat(getComputedStyle(el).fontSize))),
        };
      });
      expect(m.overflow, `${tab} 水平溢出`).toBeLessThanOrEqual(0);
      expect(m.overlap, `${tab} 頁首重疊`).toBe(false);
      expect(m.minFont, `${tab} 最小字級`).toBeGreaterThanOrEqual(vp.minFont);
    }
  });
}
