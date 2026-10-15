const TestsSheetName = 'Tests';
const ListsSheetName = 'Lists';
const FirstDataRow = 5;
const ColumnCount = 12;
const WrittenColumnCount = 5;
const AreaColumn = 7;
const PrefixColumn = 8;
const BuildsColumn = 12;
const NeedsCell = 'D5';
const BuildUnderTestCell = 'E1';
const StartedCell = 'H1';
const SummaryRange = 'A3:L3';
const LockWaitMilliseconds = 30000;

function doPost(event) {
  let request;
  try {
    request = JSON.parse(event.postData.contents);
  } catch (error) {
    return respond({ ok: false, error: 'The body is not JSON.' });
  }
  const properties = PropertiesService.getScriptProperties();
  const secret = properties.getProperty('SECRET');
  if (!secret || !request || request.secret !== secret) {
    return respond({ ok: false, error: 'Unauthorized.' });
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(LockWaitMilliseconds);
  try {
    if (request.action === 'ping') {
      return respond(ping(properties));
    }
    if (request.action === 'ensureVersion') {
      return respond(ensureVersion(properties, request));
    }
    if (request.action === 'appendTasks') {
      return respond(appendTasks(properties, request));
    }
    return respond({ ok: false, error: 'Unknown action.' });
  } catch (error) {
    return respond({ ok: false, error: String(error && error.message ? error.message : error) });
  } finally {
    lock.releaseLock();
  }
}

function respond(result) {
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function requireVersion(value) {
  const text = String(value || '');
  if (!/^\d+(\.\d+){2,3}$/.test(text)) {
    throw new Error('Missing or malformed version.');
  }
  return text;
}

function betaFolder(properties) {
  return DriveApp.getFolderById(properties.getProperty('BETA_FOLDER_ID'));
}

function versionFolderName(version) {
  return 'Version ' + version;
}

function testingName(version) {
  return 'Aetherphone ' + version + ' Testing';
}

function firstFolder(parent, name) {
  const folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : null;
}

function firstFile(parent, name) {
  const files = parent.getFilesByName(name);
  return files.hasNext() ? files.next() : null;
}

function findOrCopy(folder, name, templateId) {
  const existing = firstFile(folder, name);
  if (existing) {
    return { file: existing, created: false };
  }
  return { file: DriveApp.getFileById(templateId).makeCopy(name, folder), created: true };
}

function ping(properties) {
  const folder = betaFolder(properties);
  return {
    ok: true,
    folder: folder.getName(),
    testingTemplate: DriveApp.getFileById(properties.getProperty('TESTING_TEMPLATE_ID')).getName(),
  };
}

function addBuild(book, build) {
  const lists = book.getSheetByName(ListsSheetName);
  const rowCount = lists.getMaxRows() - 1;
  const values = lists.getRange(2, BuildsColumn, rowCount, 1).getDisplayValues();
  for (let index = 0; index < values.length; index++) {
    if (values[index][0] === build) {
      return;
    }
  }
  for (let index = 0; index < values.length; index++) {
    if (values[index][0] === '') {
      const cell = lists.getRange(index + 2, BuildsColumn);
      cell.setNumberFormat('@');
      cell.setValue(build);
      return;
    }
  }
  lists.insertRowAfter(lists.getMaxRows());
  const cell = lists.getRange(lists.getMaxRows(), BuildsColumn);
  cell.setNumberFormat('@');
  cell.setValue(build);
}

function readAreas(book) {
  const lists = book.getSheetByName(ListsSheetName);
  const values = lists.getRange(2, AreaColumn, lists.getMaxRows() - 1, 2).getDisplayValues();
  const areas = [];
  for (let index = 0; index < values.length; index++) {
    if (values[index][0] !== '') {
      areas.push({ name: values[index][0], prefix: values[index][1] });
    }
  }
  return areas;
}

function readNeeds(tests) {
  const validation = tests.getRange(NeedsCell).getDataValidation();
  if (!validation) {
    return [];
  }
  const criteria = validation.getCriteriaValues();
  return criteria.length > 0 && Array.isArray(criteria[0]) ? criteria[0].map(String) : [];
}

function lastDataRow(tests) {
  const maxRows = tests.getMaxRows();
  if (maxRows < FirstDataRow) {
    return FirstDataRow - 1;
  }
  const values = tests.getRange(FirstDataRow, 1, maxRows - FirstDataRow + 1, 3).getDisplayValues();
  for (let index = values.length - 1; index >= 0; index--) {
    if (values[index][0] !== '' || values[index][2] !== '') {
      return FirstDataRow + index;
    }
  }
  return FirstDataRow - 1;
}

function readRows(tests) {
  const last = lastDataRow(tests);
  if (last < FirstDataRow) {
    return [];
  }
  const values = tests.getRange(FirstDataRow, 1, last - FirstDataRow + 1, ColumnCount).getDisplayValues();
  const rows = [];
  for (let index = 0; index < values.length; index++) {
    const row = values[index];
    if (row[2] === '') {
      continue;
    }
    rows.push({ id: row[0], area: row[1], test: row[2], build: row[4], status: row[5], fixedIn: row[11] });
  }
  return rows;
}

function readSummary(tests) {
  const values = tests.getRange(SummaryRange).getDisplayValues()[0];
  return {
    items: values[0],
    notRun: values[1],
    readyToShip: values[2],
    go: values[3],
    noGo: values[4],
    blockers: values[5],
    majors: values[6],
    blocked: values[7],
    recheck: values[8],
    skipped: values[9],
    progress: values[11],
  };
}

function ensureVersion(properties, request) {
  const version = requireVersion(request.version);
  const build = requireVersion(request.build);
  const root = betaFolder(properties);
  const folderName = versionFolderName(version);
  const folder = firstFolder(root, folderName) || root.createFolder(folderName);
  const testing = findOrCopy(folder, testingName(version), properties.getProperty('TESTING_TEMPLATE_ID'));
  const testingBook = SpreadsheetApp.openById(testing.file.getId());
  addBuild(testingBook, build);
  const tests = testingBook.getSheetByName(TestsSheetName);
  if (testing.created) {
    const started = request.started ? new Date(request.started) : new Date();
    tests.getRange(StartedCell).setValue(started);
  }
  return {
    ok: true,
    created: testing.created,
    folderName: folderName,
    folderUrl: folder.getUrl(),
    testingName: testing.file.getName(),
    testingUrl: testing.file.getUrl(),
    areas: readAreas(testingBook),
    needs: readNeeds(tests),
    rows: readRows(tests),
  };
}

function appendTasks(properties, request) {
  const version = requireVersion(request.version);
  const build = requireVersion(request.build);
  const folder = firstFolder(betaFolder(properties), versionFolderName(version));
  if (!folder) {
    throw new Error('The version folder does not exist; run ensureVersion first.');
  }
  const file = firstFile(folder, testingName(version));
  if (!file) {
    throw new Error('The testing sheet does not exist; run ensureVersion first.');
  }
  const book = SpreadsheetApp.openById(file.getId());
  const tests = book.getSheetByName(TestsSheetName);
  const existingIds = {};
  const existing = readRows(tests);
  for (let index = 0; index < existing.length; index++) {
    existingIds[existing[index].id] = true;
  }
  const rows = Array.isArray(request.rows) ? request.rows : [];
  const added = [];
  const skipped = [];
  const values = [];
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    if (!row || !row.id || !row.test || existingIds[row.id]) {
      skipped.push(row && row.id ? row.id : '');
      continue;
    }
    existingIds[row.id] = true;
    added.push(row.id);
    values.push([row.id, row.area || '', row.test, row.needs || '', row.build || build]);
  }
  if (values.length > 0) {
    addBuild(book, build);
    const start = lastDataRow(tests) + 1;
    const end = start + values.length - 1;
    const maxRows = tests.getMaxRows();
    if (end > maxRows) {
      tests.insertRowsAfter(maxRows, end - maxRows);
      const pattern = tests.getRange(FirstDataRow, 1, 1, ColumnCount);
      const fresh = tests.getRange(maxRows + 1, 1, end - maxRows, ColumnCount);
      pattern.copyTo(fresh, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
      pattern.copyTo(fresh, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
    }
    const target = tests.getRange(start, 1, values.length, WrittenColumnCount);
    target.setNumberFormat('@');
    target.setValues(values);
  }
  if (request.current) {
    addBuild(book, build);
    tests.getRange(BuildUnderTestCell).setValue(build);
  }
  SpreadsheetApp.flush();
  return { ok: true, added: added, skipped: skipped, testingUrl: file.getUrl(), summary: readSummary(tests) };
}
