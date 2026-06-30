// ============================================================
// 水分補給記録アプリ v2 - GAS（通知専用 + WBGT取得）
// データはFirestoreに保存。GASはFCM通知の送信のみ担当。
// ============================================================

const CONFIG = {
  FCM_PROJECT_ID: 'hydration-850bd',
  SERVICE_ACCOUNT: {
    client_email: 'firebase-adminsdk-fbsvc@hydration-850bd.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCycueYv++xRS0+\nS5aRYnps6GAZPm+c+TsCUW1M9Egs9KyiXxQcFa9T6lvXZYgjbMcmL6swbyxeW5uk\n610uGE+PwNdlVLRaBNjfZlnRzq6cWk1/wVO/XQ2TKLXOfOSwTDp2F8YM9nzXPbJl\nh6PEsN79A6dYWbBzekBlD/MaK3y1KkZ/GqAzmW3Yqr6RWbd6dHcag0W7xIUCEJrG\n6S37t4Y0qLYXavctZbop1HeHC3Ln3zsSpmxiO3WFikh6W8bL5mE2tESYLXl0mAHa\n5RNRFxbIsy5VlwC0ZKirsy3bzzOAgDXapMH6uniCD/aH0Bs6/dXJP7AUB/wTPCJj\nWX6KR0nhAgMBAAECggEABxVcJ7JJv/7ebtmRBd8eUTZQVzwvscVWZW8zmvaw6pZB\nR+DlOKqshvTCSxyY23V2T8fxYDbaMI+AxYUsEcKjCNz8p9qa3fO740f0rYkqNvhi\nLmhaDCTz/0kMyMrTc0M+swCaqtnPcZCoRShjKgaj1AW0uzifMkGdGViOsQr0Hwb4\nOe7qyLNsloqkh4JnLMWOG+p9jOVdNx92oAIw+rvMFVcuL7O32bsiw6eS9/TmX5qm\nwldRUCmsELvstVaCPl6bLUSX3LkIJkNj6ELANTQ47QsUxZRtRfEUcDJpxN2wGgb4\nL3yid9/a5evD6kADq90tlj2Avegx1V9qn5ge9wUOWQKBgQDZ2WYR6Who03cOpvjR\nAwQk9TK6NOOkKb4Mzdg1t7+Q02S4LpCpNHwgq7Fhj7V2aqJdE2808Sj93NQypzV5\nt2B1VpCmOUmrR2ZxH0bd6lWYxVuMNQYxCn30+ugyGg26X2nKUo4tkk4woDyYy7GE\nt7C+lp9xJxUnEPbVc40vsgzKuQKBgQDRsxyBPUaSJHn8x9DbMr++ED7yJrktQkF3\nApWtD853J/mwNGni9d4KmUBpPEMQWsbVgpfIemjujSNSa98NDNRUjSCXliBy1JyY\nHF1VTUJRZYOluDgQKVXgQPTXn1m/c8Q5yIVjweM7ONiLZeGoVRK7d2toT2oZ+yHU\nW/OIkydEaQKBgDFYgjtacJEWHWjPP5swoLayZ+wv4MSlw+vokKoSVi07BRyHR7Nc\nNSW9Xm+n+sW4/9Avf8gxPETMybAzmfRZKltJ4XgVj+9hO/4xxH6t/vec9NC8jgt7\nwe5FC2WV6zglNrRioNwHwPhYw4Ek2rAiX8G8Ip+h57OyrwbIptl/7k/ZAoGAHNA8\nkXGG+duzO02FYCkX+Zin3YP+m75n2l9ri40JdIv0ngaFqh7YdKJcHFmgaWXfvkSk\ncHKJaoXQHaoeyt9BaaC+orWJHd4i6i+zj13/R8noDeRDJ81WNGsYeWw227yfcMUh\ntvRUMbX84yKLoCKYYVPmWT3YOVutaU19J/34PkkCgYEAwY+uABal1IzwjQa6Ohka\nV4LMb5UaVvQ/CJv+Nq7SXZCkWYJ4tmd1AvVM7yUIW5l4RPg4E43IwnUD2xmk0xfk\nXCuWf0EPM1ukXT2xSiaPi87E2ivehZoSNhWS1LKxJpYh20SzZKvunfspP3rz2kF6\nkEab9HKbv4LSsxDOZZVT5f8=\n-----END PRIVATE KEY-----\n'
  }
};

// 全メンバー（部署別）
const DEPT_MEMBERS = {
  '技術チーム':    ['山本','細江','本城','林','四ツ木','横塚'],
  '品質保証チーム': ['堀江','吉村','南','東木谷'],
  '岩本班':        ['岩本A','岩本B','岩本C'],
  '生産管理チーム': ['平林','森﨑'],
  '管理者':        ['伊藤','有側']
};
const MEMBERS = Object.values(DEPT_MEMBERS).flat();
const QA_MEMBERS = DEPT_MEMBERS['品質保証チーム'];

// 通常通知スロット（品質保証チーム以外・2分前倒し済み）
const NOTIFY_SLOTS = {
  '0748': {title:'🌅 朝の水分補給チェック',  body:'おはよう！仕事始まる前に一杯飲もう',      onlyAdmin:false},
  '0958': {title:'☕ 午前休憩',              body:'水分補給のタイムだよ！しっかり飲んでね',   onlyAdmin:false},
  '1248': {title:'🌞 午後スタート',          body:'お昼休み明け、水分補給はしたかな？',       onlyAdmin:false},
  '1458': {title:'🌤 午後休憩',             body:'こまめに飲もう！熱中症に気をつけて',        onlyAdmin:false},
  '1648': {title:'🌇 夕方水分補給チェック',   body:'終業前にもう一杯！水分補給を忘れずに',     onlyAdmin:false},
  '1658': {title:'⚠️ 未記録メンバーがいるよ', body:'',                                      onlyAdmin:true}
};

// 品質保証チーム専用通知スロット
const QA_NOTIFY_SLOTS = {
  '0748': {title:'🌅 朝の水分補給チェック', body:'おはよう！仕事始まる前に一杯飲もう'},
  '0848': {title:'💧 水分補給チェック',     body:'こまめに飲もう！'},
  '0958': {title:'☕ 午前休憩',            body:'水分補給のタイムだよ！しっかり飲んでね'},
  '1058': {title:'💧 水分補給チェック',     body:'こまめに飲もう！'},
  '1158': {title:'🌞 昼前チェック',        body:'もうすぐお昼！水分補給を忘れずに'},
  '1248': {title:'🌞 午後スタート',        body:'お昼休み明け、水分補給はしたかな？'},
  '1348': {title:'💧 午後チェック',        body:'こまめに飲もう！'},
  '1458': {title:'🌤 午後休憩',           body:'熱中症に気をつけて！'},
  '1558': {title:'💧 夕方チェック',        body:'もう一踏ん張り、水分補給を'},
  '1648': {title:'🌇 終業前チェック',      body:'終業前にもう一杯！水分補給を忘れずに'}
};

// ===== Web API (GET) - WBGT のみ提供 =====
function doGet(e) {
  try {
    const p = e.parameter;
    let res;
    switch(p.action) {
      case 'getWbgt':     res = getWbgt(); break;
      case 'getWbgtMax':  res = getWbgtMax(p.date); break;
      case 'getWbgtWeek': res = getWbgtWeek(p.startDate, p.endDate); break;
      case 'getHolidays': res = getHolidaysStatic(p.startDate, p.endDate); break;
      default:            res = {error: 'unknown action'};
    }
    return jsonResponse(res);
  } catch(err) {
    return jsonResponse({error: err.message});
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== アクセストークン取得（FCM + Firestore 両方のスコープ） =====
function getAccessToken_() {
  const sa = CONFIG.SERVICE_ACCOUNT;
  const now = Math.floor(Date.now() / 1000);
  const header = Utilities.base64EncodeWebSafe(JSON.stringify({alg:'RS256', typ:'JWT'}));
  const claim  = Utilities.base64EncodeWebSafe(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600
  }));
  const sig = Utilities.base64EncodeWebSafe(
    Utilities.computeRsaSha256Signature(`${header}.${claim}`, sa.private_key)
  );
  const jwt = `${header}.${claim}.${sig}`;
  const res = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    payload: {grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt}
  });
  return JSON.parse(res.getContentText()).access_token;
}

// ===== Firestoreからトークン一覧を取得 =====
function getTokensFromFirestore_(accessToken, collection, memberNames) {
  const url = `https://firestore.googleapis.com/v1/projects/${CONFIG.FCM_PROJECT_ID}/databases/(default)/documents/${collection}`;
  const res = UrlFetchApp.fetch(url, {
    headers: {'Authorization': `Bearer ${accessToken}`},
    muteHttpExceptions: true
  });
  const data = JSON.parse(res.getContentText());
  if (!data.documents) return [];
  return data.documents
    .filter(doc => {
      if (!memberNames) return true;
      const name = doc.name.split('/').pop();
      return memberNames.includes(decodeURIComponent(name));
    })
    .map(doc => doc.fields?.token?.stringValue)
    .filter(Boolean);
}

// ===== Firestoreから今日の個人休メンバー取得 =====
function getPersonalLeaveNames_(accessToken, date) {
  const url = `https://firestore.googleapis.com/v1/projects/${CONFIG.FCM_PROJECT_ID}/databases/(default)/documents:runQuery`;
  const query = {
    structuredQuery: {
      from: [{collectionId: 'personalLeave'}],
      where: {
        fieldFilter: {
          field: {fieldPath: 'date'},
          op: 'EQUAL',
          value: {stringValue: date}
        }
      }
    }
  };
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: {'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json'},
    payload: JSON.stringify(query),
    muteHttpExceptions: true
  });
  const results = JSON.parse(res.getContentText());
  return results
    .filter(r => r.document)
    .map(r => r.document.fields?.name?.stringValue)
    .filter(Boolean);
}

// ===== Firestoreから今日の記録済みメンバー取得 =====
function getRecordedMemberNames_(accessToken, date) {
  const url = `https://firestore.googleapis.com/v1/projects/${CONFIG.FCM_PROJECT_ID}/databases/(default)/documents:runQuery`;
  const query = {
    structuredQuery: {
      from: [{collectionId: 'records'}],
      where: {
        fieldFilter: {
          field: {fieldPath: 'date'},
          op: 'EQUAL',
          value: {stringValue: date}
        }
      },
      select: {fields: [{fieldPath: 'name'}]}
    }
  };
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: {'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json'},
    payload: JSON.stringify(query),
    muteHttpExceptions: true
  });
  const results = JSON.parse(res.getContentText());
  return [...new Set(
    results.filter(r => r.document).map(r => r.document.fields?.name?.stringValue).filter(Boolean)
  )];
}

// ===== FCM通知送信 =====
function sendFCM_(tokens, title, body, accessToken) {
  if (!tokens || tokens.length === 0) return;
  const url = `https://fcm.googleapis.com/v1/projects/${CONFIG.FCM_PROJECT_ID}/messages:send`;
  tokens.forEach(token => {
    UrlFetchApp.fetch(url, {
      method: 'post',
      headers: {'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json'},
      payload: JSON.stringify({
        message: {
          token,
          webpush: {
            notification: {title, body, icon: '/hydration-app-v2/icons/icon-192.png', tag: 'hydration', renotify: true},
            fcm_options: {link: '/hydration-app-v2/'}
          }
        }
      }),
      muteHttpExceptions: true
    });
  });
}

// ===== 定時通知チェック（5分ごとトリガーで実行） =====
function checkAndNotify() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 3600 * 1000);
  const hhmm = jst.getUTCHours() * 100 + jst.getUTCMinutes();
  const today = Utilities.formatDate(jst, 'UTC', 'yyyy-MM-dd');

  // 土日チェック
  const dow = jst.getUTCDay();
  if (dow === 0 || dow === 6) return;

  const accessToken = getAccessToken_();
  const onLeave = getPersonalLeaveNames_(accessToken, today);
  const qaOnLeave = onLeave.filter(n => QA_MEMBERS.includes(n));

  // 通常スロット（品質保証チームを除外）
  for (const [slot, msg] of Object.entries(NOTIFY_SLOTS)) {
    const slotNum = parseInt(slot.slice(0,2)) * 100 + parseInt(slot.slice(2));
    if (Math.abs(hhmm - slotNum) > 2) continue;
    if (alreadySent_(today, slot)) continue;
    markSent_(today, slot);

    if (msg.onlyAdmin) {
      const recorded = getRecordedMemberNames_(accessToken, today);
      const noRecord = MEMBERS.filter(m => !recorded.includes(m) && !onLeave.includes(m));
      if (!noRecord.length) continue;
      const body = `未記録: ${noRecord.join('、')}`;
      const adminTokens = getTokensFromFirestore_(accessToken, 'adminTokens');
      sendFCM_(adminTokens, msg.title, body, accessToken);
    } else {
      const exclude = [...onLeave, ...QA_MEMBERS];
      const tokens = getTokensFromFirestore_(accessToken, 'tokens')
        .filter((_, idx) => {
          // exclude対象メンバーのトークンを除外（名前でフィルタ）
          return true; // 名前つき取得は下記で対応
        });
      // 名前つきで取得して除外
      const allMemberTokens = getTokensForNonQA_(accessToken, exclude);
      sendFCM_(allMemberTokens, msg.title, msg.body, accessToken);
    }
  }

  // 品質保証チーム専用スロット
  for (const [slot, msg] of Object.entries(QA_NOTIFY_SLOTS)) {
    const slotNum = parseInt(slot.slice(0,2)) * 100 + parseInt(slot.slice(2));
    if (Math.abs(hhmm - slotNum) > 2) continue;
    if (alreadySent_(today, 'qa_' + slot)) continue;
    markSent_(today, 'qa_' + slot);
    const qaActive = QA_MEMBERS.filter(m => !qaOnLeave.includes(m));
    const tokens = getTokensFromFirestore_(accessToken, 'tokens', qaActive);
    sendFCM_(tokens, msg.title, msg.body, accessToken);
  }
}

// QA以外のメンバートークンを取得（onLeave除外）
function getTokensForNonQA_(accessToken, excludeNames) {
  const targetMembers = MEMBERS.filter(m => !excludeNames.includes(m));
  return getTokensFromFirestore_(accessToken, 'tokens', targetMembers);
}

// ===== 送信済みチェック =====
function alreadySent_(date, slot) {
  return PropertiesService.getScriptProperties().getProperty(`sent_${date}_${slot}`) === '1';
}
function markSent_(date, slot) {
  PropertiesService.getScriptProperties().setProperty(`sent_${date}_${slot}`, '1');
}

// ===== WBGT取得 =====
const WBGT_CSV_URL = 'https://www.wbgt.env.go.jp/prev15WG/dl/yohou_fukui.csv';
const WBGT_STATION_ID = '57001';
const WBGT_CACHE_KEY = 'wbgt_cache_v2';
const WBGT_CACHE_MIN = 20;

function getWbgt() {
  const props = PropertiesService.getScriptProperties();
  const cached = props.getProperty(WBGT_CACHE_KEY);
  if (cached) {
    const obj = JSON.parse(cached);
    if ((Date.now() - obj.fetchedAt) / 60000 < WBGT_CACHE_MIN) return obj;
  }
  try {
    const csv = UrlFetchApp.fetch(WBGT_CSV_URL).getContentText();
    const lines = csv.trim().split('\n');
    const timeCols = lines[0].split(',').slice(2).map(h => h.trim());
    const row = lines.slice(1).find(l => l.split(',')[0].trim() === WBGT_STATION_ID);
    if (!row) return {error: '三国のデータなし'};
    const cols = row.split(',');
    const updatedAt = cols[1].trim();
    const forecasts = timeCols.map((t, i) => {
      const raw = parseInt(cols[i + 2]);
      if (isNaN(raw)) return null;
      let dateStr = t.slice(0,4) + '-' + t.slice(4,6) + '-' + t.slice(6,8);
      let hour = t.slice(8,10);
      if (hour === '24') {
        const d = new Date(dateStr + 'T00:00:00+09:00');
        d.setDate(d.getDate() + 1);
        dateStr = Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd');
        hour = '00';
      }
      return {date: dateStr, time: hour + ':00', wbgt: raw / 10};
    }).filter(Boolean);

    const jst = new Date(new Date().getTime() + 9 * 3600 * 1000);
    const nowYMDH = parseInt(Utilities.formatDate(jst, 'UTC', 'yyyyMMddHH'));
    let nearest = forecasts[0], minDiff = Infinity;
    forecasts.forEach(f => {
      const diff = Math.abs(parseInt(f.date.replace(/-/g,'') + f.time.slice(0,2)) - nowYMDH);
      if (diff < minDiff) { minDiff = diff; nearest = f; }
    });

    const lv = wbgtLevel_(nearest.wbgt);
    const result = {wbgt: nearest.wbgt, level: lv.label, color: lv.color, forecastTime: nearest.time, updatedAt, fetchedAt: Date.now()};
    props.setProperty(WBGT_CACHE_KEY, JSON.stringify(result));
    return result;
  } catch(e) {
    return {error: e.message};
  }
}

function getWbgtMax(date) {
  // Firestoreに保存されたWBGTデータから最大値を取得
  // ※ v2ではWBGTはGASが直接返す（キャッシュから）
  try {
    const props = PropertiesService.getScriptProperties();
    const cached = props.getProperty(WBGT_CACHE_KEY);
    if (!cached) return {max: null};
    const obj = JSON.parse(cached);
    return {max: obj.wbgt, level: obj.level, color: obj.color};
  } catch(e) {
    return {max: null};
  }
}

function getWbgtWeek(startDate, endDate) {
  return {dates: {}};
}

function getHolidaysStatic(startDate, endDate) {
  // 祝日マスター（ハードコード）
  const HOLIDAYS_2026 = [
    '2026-01-01','2026-01-12','2026-02-11','2026-03-20',
    '2026-04-29','2026-05-03','2026-05-04','2026-05-05',
    '2026-07-20','2026-08-11','2026-09-21','2026-09-23',
    '2026-10-12','2026-11-03','2026-11-23'
  ];
  const holidays = HOLIDAYS_2026.filter(d => d >= startDate && d <= endDate);
  return {holidays};
}

function wbgtLevel_(wbgt) {
  if (wbgt >= 35) return {label: '危険',     color: '#dc2626'};
  if (wbgt >= 31) return {label: '厳重警戒', color: '#ef4444'};
  if (wbgt >= 28) return {label: '警戒',     color: '#f97316'};
  if (wbgt >= 25) return {label: '注意',     color: '#eab308'};
  return             {label: 'ほぼ安全',   color: '#22c55e'};
}

function fetchWbgtScheduled() {
  PropertiesService.getScriptProperties().deleteProperty(WBGT_CACHE_KEY);
  getWbgt();
}

// ===== 【初回1回だけ実行】トリガーセットアップ =====
function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('checkAndNotify').timeBased().everyMinutes(5).create();
  [5, 7, 9, 12, 15, 17].forEach(h => {
    ScriptApp.newTrigger('fetchWbgtScheduled').timeBased().atHour(h).everyDays(1).create();
  });
  Logger.log('✅ トリガーセット完了');
}
