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

const GOLD_CERTIFICATE_HOURS = 100;
const SILVER_CERTIFICATE_HOURS = 50;
const SOON_SILVER_MIN = 45;
const SOON_SILVER_MAX = 49;
const SOON_GOLD_MIN = 95;
const SOON_GOLD_MAX = 99;
const LS_KEY = 'njupt_volunteer_data';

let rows = [];
let nextId = 1;
let sortCol = 'rank';
let sortDir = 'asc';

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

      nameEl.addEventListener('blur', () => handleCellEdit(nameEl, row, 'name'));
      nameEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameEl.blur(); });

      idEl.addEventListener('blur', () => handleCellEdit(idEl, row, 'studentId'));
      idEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') idEl.blur(); });

      hoursEl.addEventListener('blur', () => handleCellEdit(hoursEl, row, 'totalHours'));
      hoursEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') hoursEl.blur(); });

      tr.querySelector('.delete-btn').addEventListener('click', () => {
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
      } catch (_) { /* ignore corrupt cache */ }
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
  applyAdminState();
});

addRowBtn.addEventListener('click', () => {
  const newRow = { _id: nextId++, name: 'New Student', studentId: '', totalHours: 0, rank: 0 };
  rows.push(newRow);
  reRankRows();
  saveToLocalStorage();
  filterRows();
});

resetDataBtn.addEventListener('click', () => {
  if (confirm('Reset all data to original? This will clear any admin edits.')) {
    localStorage.removeItem(LS_KEY);
    nextId = 1;
    loadData();
  }
});

updateSortIndicators();
applyAdminState();
loadData();
