const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const tableBody = document.getElementById('tableBody');
const lastUpdate = document.getElementById('lastUpdate');
const resultCount = document.getElementById('resultCount');
const downloadReportBtn = document.getElementById('downloadReportBtn');
const adminPanel = document.getElementById('adminPanel');
const adminLogoutBtn = document.getElementById('adminLogoutBtn');
const addRowBtn = document.getElementById('addRowBtn');
const resetDataBtn = document.getElementById('resetDataBtn');
const actionCol = document.getElementById('actionCol');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const saveGitHubBtn = document.getElementById('saveGitHubBtn');

const GOLD_CERTIFICATE_HOURS = 100;
const SILVER_CERTIFICATE_HOURS = 50;
const SOON_SILVER_MIN = 45;
const SOON_SILVER_MAX = 49;
const SOON_GOLD_MIN = 95;
const SOON_GOLD_MAX = 99;
const LS_KEY = 'njupt_volunteer_data';
const GITHUB_TOKEN_STORAGE_KEY = 'gh_admin_token';
const GITHUB_OWNER = 'Muntasir-Mamun7';
const GITHUB_REPO = 'Online-Volunteer-Portal';
const GITHUB_FILE_PATH = 'data.json';

let rows = [];
let nextId = 1;
let sortCol = 'rank';
let sortDir = 'asc';

// ===== Undo / Redo =====
let undoStack = [];
let redoStack = [];
let preEditSnapshot = null;

function isAdminOnLoad() {
  const params = new URLSearchParams(window.location.search);
  return params.get('admin') === '1' || params.get('admin') === 'true';
}
let isAdmin = isAdminOnLoad();

function maskStudentId(studentId) {
  const id = String(studentId);
  if (id.length <= 4) return '*'.repeat(id.length);
  if (id.length <= 6) return `${id.slice(0, 1)}${'*'.repeat(id.length - 2)}${id.slice(-1)}`;
  return `${id.slice(0, 3)}${'*'.repeat(id.length - 5)}${id.slice(-2)}`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getAchievement(hours) {
  if (hours >= GOLD_CERTIFICATE_HOURS) {
    return {
      text: '100h Gold Certificate',
      html: '<span class="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">100h Gold Certificate</span>'
    };
  }
  if (hours >= SILVER_CERTIFICATE_HOURS) {
    return {
      text: '50h Silver Certificate',
      html: '<span class="inline-flex rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-800">50h Silver Certificate</span>'
    };
  }
  if ((hours >= SOON_SILVER_MIN && hours <= SOON_SILVER_MAX) || (hours >= SOON_GOLD_MIN && hours <= SOON_GOLD_MAX)) {
    return {
      text: 'Soon: Outstanding Volunteer',
      html: '<span class="inline-flex rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-medium text-yellow-800">Soon: Outstanding Volunteer</span>'
    };
  }
  return {
    text: '—',
    html: '<span class="text-slate-400">—</span>'
  };
}

function reRankRows() {
  rows.sort((a, b) => b.totalHours - a.totalHours);
  rows.forEach((r, i) => { r.rank = i + 1; });
}

function saveToLocalStorage() {
  const data = {
    students: rows.map(({ _id, rank, ...rest }) => rest),
    lastUpdated: new Date().toISOString(),
    _savedAt: Date.now()
  };
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

function getSortedRows(rowsToSort) {
  return [...rowsToSort].sort((a, b) => {
    let va = a[sortCol];
    let vb = b[sortCol];
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });
}

function updateSortIndicators() {
  document.querySelectorAll('th[data-col] .sort-icon').forEach((icon) => {
    const th = icon.closest('th');
    icon.textContent = th.dataset.col === sortCol ? (sortDir === 'asc' ? '▲' : '▼') : '';
  });
}

// ===== Undo / Redo helpers =====
function snapshotRows() {
  return rows.map(r => ({ ...r }));
}

function updateUndoRedoBtns() {
  undoBtn.disabled = undoStack.length === 0;
  redoBtn.disabled = redoStack.length === 0;
}

// Call after a confirmed edit: pushes snapshot to undoStack and resets redo.
function commitEdit(snapshot) {
  if (snapshot === null) return;
  undoStack.push(snapshot);
  redoStack = [];
  updateUndoRedoBtns();
}

function applySnapshot(snapshot) {
  rows = snapshot.map(r => ({ ...r }));
  nextId = rows.reduce((max, r) => Math.max(max, r._id), 0) + 1;
  rows.sort((a, b) => b.totalHours - a.totalHours);
  rows.forEach((r, i) => { r.rank = i + 1; });
  saveToLocalStorage();
  filterRows();
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshotRows());
  applySnapshot(undoStack.pop());
  updateUndoRedoBtns();
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshotRows());
  applySnapshot(redoStack.pop());
  updateUndoRedoBtns();
}

// ===== Cell editing =====
// Returns true if the value actually changed.
function handleCellEdit(input, row, field) {
  const rawVal = input.value.trim();
  let changed = false;

  if (field === 'totalHours') {
    const num = Number(rawVal);
    if (!isNaN(num) && num >= 0 && num !== row.totalHours) {
      row.totalHours = num;
      reRankRows();
      changed = true;
    } else {
      input.value = row.totalHours;
    }
  } else {
    if (rawVal && rawVal !== String(row[field])) {
      row[field] = rawVal;
      changed = true;
    } else if (!rawVal) {
      input.value = row[field];
    }
  }

  if (changed) {
    saveToLocalStorage();
    filterRows();
  }
  return changed;
}

function renderTable(filteredRows) {
  tableBody.innerHTML = '';
  const colSpan = isAdmin ? 6 : 5;

  if (!filteredRows.length) {
    tableBody.innerHTML = `<tr><td colspan="${colSpan}" class="px-4 py-6 text-center text-sm text-slate-500 md:px-6">No student found.</td></tr>`;
    resultCount.textContent = '0 records';
    return;
  }

  const inputClass = 'w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-slate-300 focus:border-blue-400 focus:bg-white focus:outline-none';

  getSortedRows(filteredRows).forEach((row) => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50';

    if (isAdmin) {
      tr.innerHTML = `
        <td class="px-4 py-3 text-slate-500 md:px-6">${row.rank}</td>
        <td class="px-4 py-3 md:px-6"><input type="text" value="${escapeHtml(row.name)}" class="${inputClass} min-w-[8rem] font-medium text-slate-900" /></td>
        <td class="px-4 py-3 md:px-6"><input type="text" value="${escapeHtml(String(row.studentId))}" class="${inputClass} min-w-[7rem]" /></td>
        <td class="px-4 py-3 md:px-6"><input type="number" min="0" value="${row.totalHours}" class="${inputClass} w-20" /></td>
        <td class="px-4 py-3 md:px-6">${getAchievement(row.totalHours).html}</td>
        <td class="px-4 py-3 md:px-6"><button class="delete-btn text-xs font-medium text-red-500 hover:text-red-700">Delete</button></td>
      `;

      const [, nameTd, idTd, hoursTd] = tr.querySelectorAll('td');
      const nameEl = nameTd.querySelector('input');
      const idEl = idTd.querySelector('input');
      const hoursEl = hoursTd.querySelector('input');

      // Capture state before the edit begins so undo restores to pre-edit values.
      nameEl.addEventListener('focus', () => { preEditSnapshot = snapshotRows(); });
      nameEl.addEventListener('blur', () => {
        if (handleCellEdit(nameEl, row, 'name')) commitEdit(preEditSnapshot);
        preEditSnapshot = null;
      });
      nameEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameEl.blur(); });

      idEl.addEventListener('focus', () => { preEditSnapshot = snapshotRows(); });
      idEl.addEventListener('blur', () => {
        if (handleCellEdit(idEl, row, 'studentId')) commitEdit(preEditSnapshot);
        preEditSnapshot = null;
      });
      idEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') idEl.blur(); });

      hoursEl.addEventListener('focus', () => { preEditSnapshot = snapshotRows(); });
      hoursEl.addEventListener('blur', () => {
        if (handleCellEdit(hoursEl, row, 'totalHours')) commitEdit(preEditSnapshot);
        preEditSnapshot = null;
      });
      hoursEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') hoursEl.blur(); });

      tr.querySelector('.delete-btn').addEventListener('click', () => {
        commitEdit(snapshotRows());
        rows = rows.filter((r) => r._id !== row._id);
        reRankRows();
        saveToLocalStorage();
        filterRows();
      });
    } else {
      tr.innerHTML = `
        <td class="px-4 py-3 md:px-6">${row.rank}</td>
        <td class="px-4 py-3 font-medium text-slate-900 md:px-6">${escapeHtml(row.name)}</td>
        <td class="px-4 py-3 md:px-6">${maskStudentId(row.studentId)}</td>
        <td class="px-4 py-3 md:px-6">${row.totalHours}</td>
        <td class="px-4 py-3 md:px-6">${getAchievement(row.totalHours).html}</td>
      `;
    }

    tableBody.appendChild(tr);
  });

  resultCount.textContent = `${filteredRows.length} record${filteredRows.length === 1 ? '' : 's'}`;
}

function filterRows() {
  const term = searchInput.value.trim().toLowerCase();
  if (!term) {
    renderTable(rows);
    return;
  }
  const filtered = rows.filter(
    (row) => row.name.toLowerCase().includes(term) || String(row.studentId).includes(term)
  );
  renderTable(filtered);
}

function toCsv(data) {
  const header = ['Rank', 'Name', 'Student ID', 'Total Hours', 'Achievement'];
  const lines = data.map((row) => {
    const achievement = getAchievement(row.totalHours).text;
    return [row.rank, row.name, row.studentId, row.totalHours, achievement]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(',');
  });
  return [header.join(','), ...lines].join('\n');
}

function downloadReportCsv() {
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'njupt-student-volunteer-report.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function applyAdminState() {
  adminPanel.classList.toggle('hidden', !isAdmin);
  actionCol.classList.toggle('hidden', !isAdmin);
  if (rows.length > 0) {
    filterRows();
  }
}

function initRows(students) {
  rows = [...students]
    .sort((a, b) => b.totalHours - a.totalHours)
    .map((student) => ({ ...student, _id: nextId++, rank: 0 }));
  rows.forEach((r, i) => { r.rank = i + 1; });
}

async function loadData() {
  try {
    const response = await fetch('data.json', { cache: 'no-cache' });
    const jsonData = await response.json();

    let data = jsonData;
    const localRaw = localStorage.getItem(LS_KEY);
    if (localRaw) {
      try {
        const local = JSON.parse(localRaw);
        if (local._savedAt > new Date(jsonData.lastUpdated).getTime()) {
          data = local;
        }
      } catch (e) { console.warn('Failed to parse cached data, falling back to data.json', e); }
    }

    nextId = 1;
    initRows(data.students);
    filterRows();

    const parsedDate = data.lastUpdated ? new Date(data.lastUpdated) : null;
    const updatedAt = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : new Date();
    lastUpdate.textContent = `Last Update: ${updatedAt.toLocaleString()}`;
  } catch (error) {
    tableBody.innerHTML =
      '<tr><td colspan="5" class="px-4 py-6 text-center text-sm text-red-600 md:px-6">Failed to load data.</td></tr>';
    resultCount.textContent = '0 records';
    lastUpdate.textContent = 'Last Update: --';
  }
}

// ===== Save to GitHub via Contents API =====
function getGitHubToken() {
  const token = window.GITHUB_TOKEN ||
    localStorage.getItem(GITHUB_TOKEN_STORAGE_KEY) ||
    sessionStorage.getItem(GITHUB_TOKEN_STORAGE_KEY);
  return token ? token.trim() : '';
}

function clearGitHubToken() {
  localStorage.removeItem(GITHUB_TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(GITHUB_TOKEN_STORAGE_KEY);
}

async function saveToGitHub() {
  const token = getGitHubToken();
  if (!token) {
    alert('Missing GitHub token. Save requires a token stored in your browser (key: gh_admin_token).');
    return;
  }

  const originalText = saveGitHubBtn.textContent;
  saveGitHubBtn.textContent = 'Saving…';
  saveGitHubBtn.disabled = true;

  try {
    // Fetch the current file SHA (required by the GitHub API to update a file).
    const getRes = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    );

    if (!getRes.ok) {
      if (getRes.status === 401 || getRes.status === 403) {
        clearGitHubToken();
        alert('GitHub token is invalid or lacks write permission. Token cleared — please try again.');
      } else {
        alert(`GitHub API error fetching file: ${getRes.status} ${getRes.statusText}`);
      }
      saveGitHubBtn.textContent = originalText;
      saveGitHubBtn.disabled = false;
      return;
    }

    const fileInfo = await getRes.json();
    const sha = fileInfo.sha;

    const now = new Date().toISOString();
    const payload = {
      lastUpdated: now,
      students: rows.map(({ _id, rank, ...rest }) => rest)
    };
    // Encode UTF-8 content to base64 using TextEncoder for full Unicode support.
    const contentBase64 = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(payload, null, 2) + '\n')));

    const putRes = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: 'Update volunteer data via admin portal',
          content: contentBase64,
          sha
        })
      }
    );

    if (putRes.ok) {
      lastUpdate.textContent = `Last Update: ${new Date(now).toLocaleString()}`;
      localStorage.removeItem(LS_KEY); // repo is now authoritative; drop the local draft
      saveGitHubBtn.textContent = '✓ Saved!';
      setTimeout(() => {
        saveGitHubBtn.textContent = '💾 Save to GitHub';
        saveGitHubBtn.disabled = false;
      }, 2500);
    } else {
      const err = await putRes.json().catch(() => ({}));
      alert(`Failed to save to GitHub: ${err.message || putRes.statusText}`);
      saveGitHubBtn.textContent = originalText;
      saveGitHubBtn.disabled = false;
    }
  } catch (err) {
    alert(`Error saving to GitHub: ${err.message}`);
    saveGitHubBtn.textContent = originalText;
    saveGitHubBtn.disabled = false;
  }
}

// Sort column headers
document.querySelectorAll('th[data-col]').forEach((th) => {
  th.addEventListener('click', () => {
    const col = th.dataset.col;
    if (sortCol === col) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortCol = col;
      sortDir = 'asc';
    }
    updateSortIndicators();
    filterRows();
  });
});

searchInput.addEventListener('input', filterRows);
clearSearchBtn.addEventListener('click', () => {
  searchInput.value = '';
  searchInput.focus();
  filterRows();
});
downloadReportBtn.addEventListener('click', downloadReportCsv);

adminLogoutBtn.addEventListener('click', () => {
  isAdmin = false;
  undoStack = [];
  redoStack = [];
  preEditSnapshot = null;
  updateUndoRedoBtns();
  applyAdminState();
});

addRowBtn.addEventListener('click', () => {
  commitEdit(snapshotRows());
  const newRow = { _id: nextId++, name: 'New Student', studentId: '', totalHours: 0, rank: 0 };
  rows.push(newRow);
  reRankRows();
  saveToLocalStorage();
  filterRows();
});

resetDataBtn.addEventListener('click', () => {
  if (confirm('Reset all data to original? This will clear any admin edits.')) {
    localStorage.removeItem(LS_KEY);
    undoStack = [];
    redoStack = [];
    preEditSnapshot = null;
    updateUndoRedoBtns();
    nextId = 1;
    loadData();
  }
});

undoBtn.addEventListener('click', undo);
redoBtn.addEventListener('click', redo);
saveGitHubBtn.addEventListener('click', saveToGitHub);

// Keyboard shortcuts: Ctrl+Z = undo, Ctrl+Y or Ctrl+Shift+Z = redo
document.addEventListener('keydown', (e) => {
  if (!isAdmin) return;
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    undo();
  } else if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault();
    redo();
  }
});

updateSortIndicators();
applyAdminState();
loadData();
