// ============================================================
// v1スプレッドシート → Firestore v2 データ移行スクリプト
// v1のGASエディタに貼り付けて migrateAll() を1回だけ実行
// ============================================================

const MIGRATE_CONFIG = {
  SS_ID: '18rKrnh7fFlhRlA57N1iKL15nnT9kmNNrFNBdfNG1o0A',
  FIRESTORE_PROJECT: 'hydration-v2',
  FIRESTORE_API_KEY: 'AIzaSyD2rPXVNfX-Rr4ggmjds9pLm2aWk8A52zg',
  SHEET_RECORDS:  '記録',        // シート名を必要に応じて変更
  SHEET_HOLIDAYS: '休日マスター', // シート名を必要に応じて変更
  SHEET_WBGT:     'WBGT記録'     // シート名を必要に応じて変更
};

// ===== メイン実行関数 =====
function migrateAll() {
  Logger.log('=== 移行開始 ===');
  const r = migrateRecords();
  const h = migrateHolidays();
  const w = migrateWbgt();
  Logger.log(`=== 移行完了 records:${r} holidays:${h} wbgt:${w} ===`);
}

// ===== WBGT履歴移行 =====
// ヘッダー: 日付 | 時刻 | WBGT | CSV更新日時
function migrateWbgt() {
  const ss = SpreadsheetApp.openById(MIGRATE_CONFIG.SS_ID);
  const sheet = ss.getSheetByName(MIGRATE_CONFIG.SHEET_WBGT);
  if (!sheet) { Logger.log('シート「WBGT記録」が見つかりません'); return 0; }

  const rows = sheet.getDataRange().getValues();
  let count = 0;

  for (let i = 1; i < rows.length; i++) {
    const [date, time, wbgt, csvUpdatedAt] = rows[i];
    if (!date || wbgt === '' || wbgt == null) continue;

    const dateStr = formatDate_(date);
    const timeStr = formatTime_(time);
    if (!dateStr || !timeStr) continue;

    const docId = `${dateStr}_${timeStr.replace(':', '')}`;
    const updatedAt = csvUpdatedAt instanceof Date
      ? Utilities.formatDate(csvUpdatedAt, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm')
      : String(csvUpdatedAt || '');

    const doc = {
      fields: {
        date:      { stringValue: dateStr },
        time:      { stringValue: timeStr },
        wbgt:      { doubleValue: Number(wbgt) },
        updatedAt: { stringValue: updatedAt }
      }
    };

    const url = `https://firestore.googleapis.com/v1/projects/${MIGRATE_CONFIG.FIRESTORE_PROJECT}/databases/(default)/documents/wbgtRecords/${docId}?key=${MIGRATE_CONFIG.FIRESTORE_API_KEY}`;
    const res = UrlFetchApp.fetch(url, {
      method: 'PATCH',
      contentType: 'application/json',
      payload: JSON.stringify(doc),
      muteHttpExceptions: true
    });

    if (res.getResponseCode() === 200) {
      count++;
    } else {
      Logger.log(`WBGT行${i+1} エラー: ${res.getContentText().substring(0, 200)}`);
    }

    if (i % 50 === 0) {
      Logger.log(`WBGT ${i}/${rows.length - 1} 件処理中...`);
      Utilities.sleep(500);
    }
  }
  Logger.log(`WBGT移行完了: ${count}件`);
  return count;
}

// ===== 前回の移行データ（migratedFromV1=true）を削除してからやり直す =====
function redoMigration() {
  const deleted = deleteMigratedRecords_();
  Logger.log(`削除: ${deleted}件`);
  migrateAll();
}

function deleteMigratedRecords_() {
  const query = {
    structuredQuery: {
      from: [{ collectionId: 'records' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'migratedFromV1' },
          op: 'EQUAL',
          value: { booleanValue: true }
        }
      }
    }
  };
  const queryUrl = `https://firestore.googleapis.com/v1/projects/${MIGRATE_CONFIG.FIRESTORE_PROJECT}/databases/(default)/documents:runQuery?key=${MIGRATE_CONFIG.FIRESTORE_API_KEY}`;
  const res = UrlFetchApp.fetch(queryUrl, {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify(query),
    muteHttpExceptions: true
  });
  const results = JSON.parse(res.getContentText());
  const docNames = results.filter(r => r.document).map(r => r.document.name);

  let count = 0;
  docNames.forEach(name => {
    const url = `https://firestore.googleapis.com/v1/${name}?key=${MIGRATE_CONFIG.FIRESTORE_API_KEY}`;
    const delRes = UrlFetchApp.fetch(url, { method: 'DELETE', muteHttpExceptions: true });
    if (delRes.getResponseCode() === 200) count++;
  });
  return count;
}

// ===== 記録データ移行 =====
// ヘッダー: 日付 | 時刻 | 名前 | 体調 | コメント | 登録日時 | チーム | 塩分補給
function migrateRecords() {
  const ss = SpreadsheetApp.openById(MIGRATE_CONFIG.SS_ID);
  const sheet = ss.getSheetByName(MIGRATE_CONFIG.SHEET_RECORDS);
  if (!sheet) { Logger.log('シート「記録」が見つかりません'); return 0; }

  const rows = sheet.getDataRange().getValues();
  let count = 0;

  for (let i = 1; i < rows.length; i++) {
    const [date, time, name, condition, comment, createdAt, team, salt] = rows[i];
    if (!date || !name) continue;

    const dateStr = formatDate_(date);
    if (!dateStr) continue;

    const doc = {
      fields: {
        date:      { stringValue: dateStr },
        time:      { stringValue: formatTime_(time) },
        name:      { stringValue: String(name) },
        dept:      { stringValue: String(team || '') },
        condition: { stringValue: String(condition || '未選択') },
        salt:      { stringValue: String(salt || 'なし') },
        comment:   { stringValue: String(comment || '') },
        createdAt: { stringValue: createdAt ? new Date(createdAt).toISOString() : new Date().toISOString() },
        migratedFromV1: { booleanValue: true }
      }
    };

    const url = `https://firestore.googleapis.com/v1/projects/${MIGRATE_CONFIG.FIRESTORE_PROJECT}/databases/(default)/documents/records?key=${MIGRATE_CONFIG.FIRESTORE_API_KEY}`;
    const res = UrlFetchApp.fetch(url, {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify(doc),
      muteHttpExceptions: true
    });

    if (res.getResponseCode() === 200) {
      count++;
    } else {
      Logger.log(`行${i+1} エラー: ${res.getContentText().substring(0, 200)}`);
    }

    if (i % 50 === 0) {
      Logger.log(`記録 ${i}/${rows.length - 1} 件処理中...`);
      Utilities.sleep(500); // レート制限対策
    }
  }
  Logger.log(`記録移行完了: ${count}件`);
  return count;
}

// ===== 休日マスター移行 =====
// ヘッダー: 日付 | 区分 | メモ
function migrateHolidays() {
  const ss = SpreadsheetApp.openById(MIGRATE_CONFIG.SS_ID);
  const sheet = ss.getSheetByName(MIGRATE_CONFIG.SHEET_HOLIDAYS);
  if (!sheet) { Logger.log('シート「休日マスター」が見つかりません'); return 0; }

  const rows = sheet.getDataRange().getValues();
  let count = 0;

  for (let i = 1; i < rows.length; i++) {
    const [date, type, memo] = rows[i];
    if (!date) continue;

    const dateStr = formatDate_(date);
    if (!dateStr) continue;

    const doc = {
      fields: {
        date: { stringValue: dateStr },
        type: { stringValue: String(type || '休日') },
        memo: { stringValue: String(memo || '') }
      }
    };

    // ドキュメントIDを日付にする（重複防止）
    const url = `https://firestore.googleapis.com/v1/projects/${MIGRATE_CONFIG.FIRESTORE_PROJECT}/databases/(default)/documents/holidays/${dateStr}?key=${MIGRATE_CONFIG.FIRESTORE_API_KEY}`;
    const res = UrlFetchApp.fetch(url, {
      method: 'PATCH',
      contentType: 'application/json',
      payload: JSON.stringify(doc),
      muteHttpExceptions: true
    });

    if (res.getResponseCode() === 200) {
      count++;
    } else {
      Logger.log(`行${i+1} エラー: ${res.getContentText().substring(0, 200)}`);
    }
  }
  Logger.log(`休日移行完了: ${count}件`);
  return count;
}

// ===== 時刻フォーマット =====
function formatTime_(val) {
  if (!val) return '';
  if (val instanceof Date) return Utilities.formatDate(val, 'Asia/Tokyo', 'HH:mm');
  return String(val).substring(0, 5);
}

// ===== 日付フォーマット =====
function formatDate_(val) {
  if (!val) return null;
  let d = (val instanceof Date) ? val : new Date(val);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
