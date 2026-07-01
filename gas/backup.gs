// ============================================================
// Firestore(hydration-v2) → v1スプレッドシートへの週次バックアップ
// v1のGASエディタ（migrate.gsと同じプロジェクト）に貼り付けて
// setupBackupTrigger() を1回だけ実行すればOK
// ============================================================

const BACKUP_CONFIG = {
  SS_ID: '18rKrnh7fFlhRlA57N1iKL15nnT9kmNNrFNBdfNG1o0A',
  FIRESTORE_PROJECT: 'hydration-v2',
  FIRESTORE_API_KEY: 'AIzaSyD2rPXVNfX-Rr4ggmjds9pLm2aWk8A52zg',
  COLLECTIONS: {
    records:     { sheet: 'Backup_records',     fields: ['date','time','name','dept','condition','salt','comment','createdAt'] },
    holidays:    { sheet: 'Backup_holidays',    fields: ['date','type','memo'] },
    wbgtRecords: { sheet: 'Backup_wbgtRecords', fields: ['date','time','wbgt','updatedAt'] }
  }
};

// ===== 初回1回だけ実行：毎週月曜2時にバックアップするトリガーを設定 =====
function setupBackupTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'backupAll')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('backupAll')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(2)
    .create();
  Logger.log('✅ 毎週月曜2時のバックアップトリガーを設定したよ');
}

// ===== バックアップ本体 =====
function backupAll() {
  Logger.log('=== バックアップ開始 ===');
  Object.keys(BACKUP_CONFIG.COLLECTIONS).forEach(collection => {
    const count = backupCollection_(collection);
    Logger.log(`${collection}: ${count}件`);
  });
  Logger.log('=== バックアップ完了 ===');
}

function backupCollection_(collectionId) {
  const conf = BACKUP_CONFIG.COLLECTIONS[collectionId];
  const docs = fetchAllDocs_(collectionId);
  const ss = SpreadsheetApp.openById(BACKUP_CONFIG.SS_ID);
  let sheet = ss.getSheetByName(conf.sheet);
  if (!sheet) sheet = ss.insertSheet(conf.sheet);
  sheet.clear();

  const header = ['更新日時', ...conf.fields];
  const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
  const rows = docs.map(doc => {
    const f = doc.fields || {};
    return [now, ...conf.fields.map(key => extractValue_(f[key]))];
  });

  sheet.getRange(1, 1, 1, header.length).setValues([header]);
  if (rows.length) sheet.getRange(2, 1, rows.length, header.length).setValues(rows);
  return rows.length;
}

// ===== Firestoreから全ドキュメントをページング取得 =====
function fetchAllDocs_(collectionId) {
  const docs = [];
  let pageToken = '';
  do {
    const url = `https://firestore.googleapis.com/v1/projects/${BACKUP_CONFIG.FIRESTORE_PROJECT}/databases/(default)/documents/${collectionId}?pageSize=300${pageToken ? '&pageToken=' + pageToken : ''}&key=${BACKUP_CONFIG.FIRESTORE_API_KEY}`;
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const data = JSON.parse(res.getContentText());
    if (data.documents) docs.push(...data.documents);
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return docs;
}

// ===== Firestoreのフィールド値を素の値に変換 =====
function extractValue_(field) {
  if (!field) return '';
  if ('stringValue' in field) return field.stringValue;
  if ('doubleValue' in field) return field.doubleValue;
  if ('integerValue' in field) return Number(field.integerValue);
  if ('booleanValue' in field) return field.booleanValue;
  return '';
}
