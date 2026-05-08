const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const tableBody = document.getElementById('tableBody');
const lastUpdate = document.getElementById('lastUpdate');
const resultCount = document.getElementById('resultCount');
const downloadReportBtn = document.getElementById('downloadReportBtn');
const totalStudents = document.getElementById('totalStudents');
const totalHours = document.getElementById('totalHours');
const certificateCount = document.getElementById('certificateCount');
const enableAdminBtn = document.getElementById('enableAdminBtn');
const adminLogoutBtn = document.getElementById('adminLogoutBtn');
const adminStatus = document.getElementById('adminStatus');

const GOLD_CERTIFICATE_HOURS = 100;
const SILVER_CERTIFICATE_HOURS = 50;
const SOON_SILVER_MIN = 45;
const SOON_SILVER_MAX = 49;
const SOON_GOLD_MIN = 95;
const SOON_GOLD_MAX = 99;

let rows = [];
function getInitialAdminState() {
  const params = new URLSearchParams(window.location.search);
  return params.get('admin') === '1' || params.get('admin') === 'true' || localStorage.getItem('portalAdmin') === 'true';
}
let isAdmin = getInitialAdminState();

function maskStudentId(studentId) {
  const id = String(studentId);
  if (id.length <= 4) return '*'.repeat(id.length);
  if (id.length <= 6) return `${id.slice(0, 1)}${'*'.repeat(id.length - 2)}${id.slice(-1)}`;
  return `${id.slice(0, 3)}${'*'.repeat(id.length - 5)}${id.slice(-2)}`;
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

function renderTable(filteredRows) {
  tableBody.innerHTML = '';

  if (!filteredRows.length) {
    tableBody.innerHTML =
      '<tr><td colspan="5" class="px-4 py-6 text-center text-sm text-slate-500 md:px-6">No student found.</td></tr>';
    resultCount.textContent = '0 records';
    return;
  }

  filteredRows.forEach((row) => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50';
    tr.innerHTML = `
      <td class="px-4 py-3 md:px-6">${row.rank}</td>
      <td class="px-4 py-3 md:px-6 font-medium text-slate-900">${row.name}</td>
      <td class="px-4 py-3 md:px-6">${isAdmin ? row.studentId : maskStudentId(row.studentId)}</td>
      <td class="px-4 py-3 md:px-6">${row.totalHours}</td>
      <td class="px-4 py-3 md:px-6">${getAchievement(row.totalHours).html}</td>
    `;
    tableBody.appendChild(tr);
  });

  resultCount.textContent = `${filteredRows.length} record${filteredRows.length === 1 ? '' : 's'}`;
}

function updateStats() {
  totalStudents.textContent = rows.length;
  totalHours.textContent = rows.reduce((sum, row) => sum + Number(row.totalHours || 0), 0);
  certificateCount.textContent = rows.filter((row) => row.totalHours >= SILVER_CERTIFICATE_HOURS).length;
}

function filterRows() {
  const term = searchInput.value.trim().toLowerCase();
  if (!term) {
    renderTable(rows);
    return;
  }

  const filtered = rows.filter((row) => {
    return row.name.toLowerCase().includes(term) || String(row.studentId).includes(term);
  });

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
  enableAdminBtn.classList.toggle('hidden', isAdmin);
  adminLogoutBtn.classList.toggle('hidden', !isAdmin);
  adminStatus.textContent = isAdmin
    ? 'Admin mode is enabled (full IDs are visible).'
    : 'Viewing as guest (IDs are masked). Add ?admin=1 to URL or use button to enable admin mode on this device.';
  if (rows.length > 0) {
    filterRows();
  }
}

async function loadData() {
  try {
    const response = await fetch('data.json', { cache: 'no-cache' });
    const data = await response.json();

    rows = [...data.students]
      .sort((a, b) => b.totalHours - a.totalHours)
      .map((student, index) => ({ ...student, rank: index + 1 }));

    updateStats();
    renderTable(rows);
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

searchInput.addEventListener('input', filterRows);
clearSearchBtn.addEventListener('click', () => {
  searchInput.value = '';
  searchInput.focus();
  filterRows();
});
downloadReportBtn.addEventListener('click', downloadReportCsv);
enableAdminBtn.addEventListener('click', () => {
  isAdmin = true;
  localStorage.setItem('portalAdmin', 'true');
  applyAdminState();
});
adminLogoutBtn.addEventListener('click', () => {
  isAdmin = false;
  localStorage.removeItem('portalAdmin');
  applyAdminState();
});
applyAdminState();
loadData();
