// ============================================================
// 水分補給記録アプリ v2 - GAS（通知専用 + WBGT取得）
// データはFirestoreに保存。GASはFCM通知の送信のみ担当。
// ============================================================

const CONFIG = {
  FCM_PROJECT_ID: 'hydration-v2',
  SERVICE_ACCOUNT: {
    client_email: 'firebase-adminsdk@hydration-v2.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQD0umQ49AwytYnj\nBJo4lqeKnoJAjnZ9WweAoOutzP/f6mB4CqWgvsKchS9xQXq+jay0EpBudxhFcfaK\n1Oj3GByv1mna1VbTWjZ8PSWg4gxTJuuGFLZnx5AGKz7trN53jWlLhJGZAJK3HBxf\nq4evgLjNKYu7JL/UuB/dlVJ1sHfndHTzL1NkTZLItmCX1uoVVrMTTALC0ondw4Ew\nNhEc8MlsisXBU6QZ/uruI63+qTVhY1aKfek5JyuihCSpH2HhZBePwCU8L7P1LVPb\njtl3T7NbdtBUl0K8V6y/3JrfPXSpsSaJXy/T3OYu6J9ICM9eh9HwhkuRpFBbYAvN\n18MaF2O5AgMBAAECggEAEySza0sX2y2dNB9riuqp/2tnx/H87dBdlV/BH87N4y+b\nzTgT/a9+XK0EaYkUN2ywqkNbffCd+uyvuuttr8p4j/6nOCGBEbZYVb6Yv21/Rk/g\nk5PyMssHBpyCZygjHNn4dxpPI1dKor01sPwjeISKsC3ESubUhKjEgVpJYYBk2Lt5\nsbYG2l7+Xb6VFX6yo/hfRUOhKZt69SB4emf/HEBBWLMNYlxzAvUt3ZJH9EkzbAX8\n+wAS9adt/ITK0gEVLpVJn+tUVETr7eu5EJA5dNZNkB4eGKUfu0tjJ/Y9faAzYE7e\np2PWnW3s6gwzj1jeGx2o/yk6Er9RXwkFE6qcJR3CSwKBgQD/aRG0NGj48pm3/5PO\nBOuYj84gPr6B47aCqNXJOEIpFC3FqjOCWAU9FM7oyDCEtdG7FtNg0LsIaqrPac7m\nXKazSvWV92ZnwzVOoh42DPSbqwkFglNJPRlTN1Jm9ViAIqP0xI7gJW4NtbhTQbVI\nv5nK7mlaU58rgagRCXmfu2FfawKBgQD1SwKAx+H3p8X6KZBHpoCQdQPeTzaVhEdj\nzm/pAFqNnwdUdmmx4SBQWujH+x0yJQTivKVRBE4X/CkqKYWbEfZIt+W82xuiGBGw\nRJYdYe22HfSvcWcJR/Ux8PAAPGewaeBUCY1FZ/IJcAT/HrLunVfv8kwFV9FakIrB\noVpT0ngGawKBgQC5xH8G9fO/1hwuMysa9oMxRK8kzt4bdTeDEy/jmhKs9CtSkLfE\nPycYRTE1KJ35eJEiJbj6uva+aW7xS0EcVhk9YPD88aO/JsF3/vxATe3/50e5hQ/0\nvgbUevFpR1vmXsuntOtCZpcES77Ud39WeV1vtzZTZ2zm5PgL5DtdDZoGHwKBgDOw\nNLzSYel/7xYCACc5DMpj/gawhn4HO8vqSma87lf9dNv1f9w95kNIhNjvL33LkzX8\nLpHd6F7hggMicMb2iAFWzxB202Ha1I9iRIe4hRDlSxRVPzMTeLWnYcuK7wabqOvM\nf3pqpvQaKNNhsq7ZdRhY5HATy0fcQYD/8TrMlQI1AoGBAIupXn93V7dBSZHtkENl\nvauG3tP5ib+E/mFgmHrFybXdi2ElfYBFHAruzllO9Clm2dINKZS+hrILFjf3gWJz\nmwmqJ+sA4PHwIQ7R4PZ7K1dZ66peTIFAP7FJuxjQeHFQPTB6QdeDQoYuTOti0V7I\nTpwniYaJdN+Qx7B1jK6Dim48\n-----END PRIVATE KEY-----\n'
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
    upsertWbgtForecasts_(forecasts, updatedAt);
    return result;
  } catch(e) {
    return {error: e.message};
  }
}

// ===== 予測データをFirestoreにupsert（ドキュメントID = 日付_時刻） =====
function upsertWbgtForecasts_(forecasts, updatedAt) {
  const accessToken = getAccessToken_();
  forecasts.forEach(f => {
    const docId = `${f.date}_${f.time.replace(':', '')}`;
    const url = `https://firestore.googleapis.com/v1/projects/${CONFIG.FCM_PROJECT_ID}/databases/(default)/documents/wbgtRecords/${docId}`;
    const doc = {
      fields: {
        date: {stringValue: f.date},
        time: {stringValue: f.time},
        wbgt: {doubleValue: f.wbgt},
        updatedAt: {stringValue: updatedAt}
      }
    };
    UrlFetchApp.fetch(url, {
      method: 'patch',
      headers: {'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json'},
      payload: JSON.stringify(doc),
      muteHttpExceptions: true
    });
  });
}

function getWbgtMax(date) {
  try {
    const accessToken = getAccessToken_();
    const rows = queryWbgtRange_(accessToken, date, date);
    if (!rows.length) return {max: null};
    const max = Math.round(Math.max(...rows.map(r => r.wbgt)) * 10) / 10;
    const lv = wbgtLevel_(max);
    return {max, level: lv.label, color: lv.color};
  } catch(e) {
    return {max: null, error: e.message};
  }
}

function getWbgtWeek(startDate, endDate) {
  try {
    const accessToken = getAccessToken_();
    const rows = queryWbgtRange_(accessToken, startDate, endDate);
    const result = {};
    rows.forEach(r => {
      if (!result[r.date] || r.wbgt > result[r.date].wbgt) {
        const lv = wbgtLevel_(r.wbgt);
        result[r.date] = {wbgt: Math.round(r.wbgt * 10) / 10, level: lv.label, color: lv.color};
      }
    });
    return {dates: result};
  } catch(e) {
    return {dates: {}, error: e.message};
  }
}

// ===== Firestoreから期間内のWBGTレコードを取得 =====
function queryWbgtRange_(accessToken, startDate, endDate) {
  const url = `https://firestore.googleapis.com/v1/projects/${CONFIG.FCM_PROJECT_ID}/databases/(default)/documents:runQuery`;
  const query = {
    structuredQuery: {
      from: [{collectionId: 'wbgtRecords'}],
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            {fieldFilter: {field: {fieldPath: 'date'}, op: 'GREATER_THAN_OR_EQUAL', value: {stringValue: startDate}}},
            {fieldFilter: {field: {fieldPath: 'date'}, op: 'LESS_THAN_OR_EQUAL', value: {stringValue: endDate}}}
          ]
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
    .map(r => ({
      date: r.document.fields?.date?.stringValue,
      wbgt: Number(r.document.fields?.wbgt?.doubleValue ?? r.document.fields?.wbgt?.integerValue ?? 0)
    }))
    .filter(r => r.date);
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
