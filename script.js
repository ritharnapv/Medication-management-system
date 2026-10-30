/* =============================================
   MEDICATION MANAGEMENT SYSTEM — SCRIPT.JS
   UPGRADED: Resident Management + Caretaker View
   ============================================= */

'use strict';

// ── CONSTANTS ──────────────────────────────────────────────────────────────────
const STORAGE_KEYS = {
  MEDICINES  : 'medcare_medicines',
  HISTORY    : 'medcare_history',
  RESET_DATE : 'medcare_reset_date',
  RESIDENTS  : 'medcare_residents',   // NEW
};

// ── STATE ─────────────────────────────────────────────────────────────────────
let medicines    = [];
let history      = [];
let residents    = [];
let filterMode   = 'all';
let ctFilterMode = 'all';
let ctResidentFilter = 'all';
let confirmCallback  = null;
let clockInterval    = null;
let reminderInterval = null;
let searchQuery      = '';
let residentSearchQ  = '';
let activeTab        = 'dashboard';

// ── DOM REFS ──────────────────────────────────────────────────────────────────
const dom = {
  // form
  form         : document.getElementById('addMedForm'),
  medResident  : document.getElementById('medResident'),
  medName      : document.getElementById('medName'),
  medDosage    : document.getElementById('medDosage'),
  medTime      : document.getElementById('medTime'),
  medFreq      : document.getElementById('medFreq'),
  medCategory  : document.getElementById('medCategory'),
  medNotes     : document.getElementById('medNotes'),
  addMedBtn    : document.getElementById('addMedBtn'),

  // lists
  medList      : document.getElementById('medList'),
  medSearch    : document.getElementById('medSearch'),

  // stats
  statResidents: document.getElementById('statResidents'),
  statTotal    : document.getElementById('statTotal'),
  statTaken    : document.getElementById('statTaken'),
  statMissed   : document.getElementById('statMissed'),
  statPending  : document.getElementById('statPending'),

  // progress
  progressBar    : document.getElementById('progressBar'),
  progressText   : document.getElementById('progressText'),
  progressBarWrap: document.getElementById('progressBarWrap'),

  // reminders
  reminderList : document.getElementById('reminderList'),
  refreshBtn   : document.getElementById('refreshReminders'),

  // history
  historyBody    : document.getElementById('historyBody'),
  filterBtns     : document.querySelectorAll('.filter-btn[data-filter]'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn'),

  // clock
  clockDisplay : document.getElementById('clockDisplay'),
  dateDisplay  : document.getElementById('dateDisplay'),

  // modal
  modalOverlay : document.getElementById('confirmModal'),
  modalTitle   : document.getElementById('modalTitle'),
  modalBody    : document.getElementById('modalBody'),
  modalConfirm : document.getElementById('modalConfirm'),
  modalCancel  : document.getElementById('modalCancel'),
  modalClose   : document.getElementById('modalClose'),

  // toast
  toastContainer: document.getElementById('toastContainer'),

  // tab navigation
  tabBtns      : document.querySelectorAll('.tab-btn'),
  tabPanels    : document.querySelectorAll('.tab-panel'),

  // resident form
  addResidentForm  : document.getElementById('addResidentForm'),
  residentIdInput  : document.getElementById('residentIdInput'),
  residentRoom     : document.getElementById('residentRoom'),
  residentName     : document.getElementById('residentName'),
  residentAge      : document.getElementById('residentAge'),
  residentGender   : document.getElementById('residentGender'),
  residentContact  : document.getElementById('residentContact'),
  residentList     : document.getElementById('residentList'),
  residentSearch   : document.getElementById('residentSearch'),

  // resident overview
  ovTotal    : document.getElementById('ovTotal'),
  ovMale     : document.getElementById('ovMale'),
  ovFemale   : document.getElementById('ovFemale'),
  ovWithMeds : document.getElementById('ovWithMeds'),

  // edit resident modal
  editResidentModal  : document.getElementById('editResidentModal'),
  editResidentForm   : document.getElementById('editResidentForm'),
  editResidentId     : document.getElementById('editResidentId'),
  editResidentIdDisp : document.getElementById('editResidentIdDisplay'),
  editResidentRoom   : document.getElementById('editResidentRoom'),
  editResidentName   : document.getElementById('editResidentName'),
  editResidentAge    : document.getElementById('editResidentAge'),
  editResidentGender : document.getElementById('editResidentGender'),
  editResidentContact: document.getElementById('editResidentContact'),
  editResidentClose  : document.getElementById('editResidentClose'),
  editResidentCancel : document.getElementById('editResidentCancel'),

  // caretaker view
  caretakerBody    : document.getElementById('caretakerBody'),
  ctResidentFilter : document.getElementById('ctResidentFilter'),
  ctFilterBtns     : document.querySelectorAll('.filter-btn[data-ctfilter]'),
  ctSumTotal       : document.getElementById('ctSumTotal'),
  ctSumPending     : document.getElementById('ctSumPending'),
  ctSumTaken       : document.getElementById('ctSumTaken'),
  ctSumMissed      : document.getElementById('ctSumMissed'),
};

// ═══════════════════════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function saveToStorage(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); }
  catch (e) { console.warn('localStorage save failed:', e); }
}

function loadFromStorage(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.warn('localStorage load failed:', e);
    return fallback;
  }
}

function formatTime(timeStr) {
  if (!timeStr) return '—';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatDateTime(dateObj) {
  if (!(dateObj instanceof Date)) dateObj = new Date(dateObj);
  const date = dateObj.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  const time = dateObj.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit',
  });
  return `${date}, ${time}`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Look up a resident by ID, return object or null */
function findResident(id) {
  return residents.find(r => r.id === id) || null;
}

/** Get display name for a medicine's resident */
function getResidentDisplay(med) {
  if (!med.residentId) return { name: 'Unassigned', room: '—' };
  const r = findResident(med.residentId);
  return r ? { name: r.name, room: r.room } : { name: med.residentName || 'Unknown', room: '—' };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TAB NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════════

function switchTab(tabName) {
  activeTab = tabName;
  dom.tabBtns.forEach(btn => {
    const isActive = btn.dataset.tab === tabName;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  dom.tabPanels.forEach(panel => {
    panel.classList.toggle('hidden', panel.id !== tabName + 'Panel');
  });

  // Re-render the panel that was just switched to
  if (tabName === 'caretaker') renderCaretakerView();
  if (tabName === 'residents') renderResidentList();
  if (tabName === 'dashboard') {
    renderMedList();
    renderStats();
  }
}

dom.tabBtns.forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ═══════════════════════════════════════════════════════════════════════════════
//  DAILY RESET
// ═══════════════════════════════════════════════════════════════════════════════

function checkDailyReset() {
  const lastReset = loadFromStorage(STORAGE_KEYS.RESET_DATE, '');
  const today = todayStr();

  if (lastReset !== today) {
    medicines.forEach(med => {
      if (med.status === 'taken' || med.status === 'missed') {
        addHistoryEntry(med, med.status, med.statusUpdatedAt);
      }
      med.status = 'pending';
      med.statusUpdatedAt = null;
    });
    saveToStorage(STORAGE_KEYS.MEDICINES, medicines);
    saveToStorage(STORAGE_KEYS.RESET_DATE, today);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CLOCK
// ═══════════════════════════════════════════════════════════════════════════════

function updateClock() {
  const now = new Date();
  const h    = now.getHours();
  const m    = String(now.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  dom.clockDisplay.textContent = `${hour}:${m} ${ampm}`;
  const dateOpts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  dom.dateDisplay.textContent = now.toLocaleDateString('en-IN', dateOpts);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

function showToast(title, message = '', type = 'info', duration = 3500) {
  const icons = { success: '✅', error: '❌', info: '💊', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <span class="toast-icon" aria-hidden="true">${icons[type] || 'ℹ️'}</span>
    <div class="toast-content">
      <div class="toast-title">${escHtml(title)}</div>
      ${message ? `<div class="toast-msg">${escHtml(message)}</div>` : ''}
    </div>
  `;
  dom.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('hide');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, duration);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CONFIRM MODAL
// ═══════════════════════════════════════════════════════════════════════════════

function openModal(title, bodyHtml, onConfirm, confirmText = 'Confirm', confirmClass = 'btn-danger') {
  dom.modalTitle.textContent = title;
  dom.modalBody.innerHTML = bodyHtml;
  dom.modalConfirm.textContent = confirmText;
  dom.modalConfirm.className = `btn ${confirmClass}`;
  confirmCallback = onConfirm;
  dom.modalOverlay.classList.add('open');
  dom.modalConfirm.focus();
}

function closeModal() {
  dom.modalOverlay.classList.remove('open');
  confirmCallback = null;
}

dom.modalConfirm.addEventListener('click', () => {
  if (typeof confirmCallback === 'function') confirmCallback();
  closeModal();
});

dom.modalCancel.addEventListener('click', closeModal);
dom.modalClose.addEventListener('click', closeModal);
dom.modalOverlay.addEventListener('click', e => { if (e.target === dom.modalOverlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); closeEditResidentModal(); } });

// ═══════════════════════════════════════════════════════════════════════════════
//  RESIDENT MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/** Add Resident Form Submit */
dom.addResidentForm.addEventListener('submit', e => {
  e.preventDefault();

  const resId   = dom.residentIdInput.value.trim().toUpperCase();
  const room    = dom.residentRoom.value.trim();
  const name    = dom.residentName.value.trim();
  const age     = parseInt(dom.residentAge.value, 10);
  const gender  = dom.residentGender.value;
  const contact = dom.residentContact.value.trim();

  if (!resId)  { showToast('Missing Field', 'Please enter a Resident ID.', 'warning'); dom.residentIdInput.focus(); return; }
  if (!room)   { showToast('Missing Field', 'Please enter a Room Number.', 'warning'); dom.residentRoom.focus(); return; }
  if (!name)   { showToast('Missing Field', 'Please enter the Full Name.', 'warning'); dom.residentName.focus(); return; }
  if (!age || age < 50 || age > 120) { showToast('Invalid Age', 'Age must be between 50 and 120.', 'warning'); dom.residentAge.focus(); return; }

  // Prevent duplicate Resident ID
  if (residents.some(r => r.id === resId)) {
    showToast('Duplicate ID', `Resident ID "${resId}" already exists.`, 'error');
    dom.residentIdInput.focus();
    return;
  }

  const resident = {
    id       : resId,
    room,
    name,
    age,
    gender,
    contact,
    createdAt: new Date().toISOString(),
  };

  residents.push(resident);
  saveToStorage(STORAGE_KEYS.RESIDENTS, residents);
  populateResidentDropdown();
  populateCaretakerResidentFilter();
  renderResidentList();
  renderResidentOverview();
  renderStats();

  dom.addResidentForm.reset();
  showToast('Resident Added!', `${name} has been registered.`, 'success');
});

/** Delete Resident */
function deleteResident(resId) {
  const res = findResident(resId);
  if (!res) return;

  const linkedCount = medicines.filter(m => m.residentId === resId).length;
  const extraMsg = linkedCount > 0
    ? `<p style="color:var(--danger);margin-top:8px;font-size:0.88rem;">⚠️ This will also remove <strong>${linkedCount}</strong> medicine(s) assigned to this resident.</p>`
    : '';

  openModal(
    'Remove Resident',
    `<p>Are you sure you want to remove resident <strong>${escHtml(res.name)}</strong> (${escHtml(res.id)})?</p>${extraMsg}<p style="color:var(--text-muted);margin-top:8px;font-size:0.85rem;">This action cannot be undone.</p>`,
    () => {
      // Remove linked medicines
      medicines = medicines.filter(m => m.residentId !== resId);
      saveToStorage(STORAGE_KEYS.MEDICINES, medicines);

      // Remove resident
      residents = residents.filter(r => r.id !== resId);
      saveToStorage(STORAGE_KEYS.RESIDENTS, residents);

      populateResidentDropdown();
      populateCaretakerResidentFilter();
      renderResidentList();
      renderResidentOverview();
      renderMedList();
      renderStats();
      renderReminders();
      renderCaretakerView();
      showToast('Removed', `${res.name} has been removed.`, 'info');
    },
    '🗑 Remove',
    'btn-danger'
  );
}

/** Open Edit Resident Modal */
function openEditResidentModal(resId) {
  const res = findResident(resId);
  if (!res) return;

  dom.editResidentId.value       = res.id;
  dom.editResidentIdDisp.value   = res.id;
  dom.editResidentRoom.value     = res.room;
  dom.editResidentName.value     = res.name;
  dom.editResidentAge.value      = res.age;
  dom.editResidentGender.value   = res.gender;
  dom.editResidentContact.value  = res.contact || '';

  dom.editResidentModal.classList.add('open');
  dom.editResidentName.focus();
}

function closeEditResidentModal() {
  dom.editResidentModal.classList.remove('open');
}

dom.editResidentClose.addEventListener('click', closeEditResidentModal);
dom.editResidentCancel.addEventListener('click', closeEditResidentModal);
dom.editResidentModal.addEventListener('click', e => {
  if (e.target === dom.editResidentModal) closeEditResidentModal();
});

/** Edit Resident Form Submit */
dom.editResidentForm.addEventListener('submit', e => {
  e.preventDefault();

  const resId   = dom.editResidentId.value;
  const room    = dom.editResidentRoom.value.trim();
  const name    = dom.editResidentName.value.trim();
  const age     = parseInt(dom.editResidentAge.value, 10);
  const gender  = dom.editResidentGender.value;
  const contact = dom.editResidentContact.value.trim();

  if (!room) { showToast('Missing Field', 'Please enter a Room Number.', 'warning'); return; }
  if (!name) { showToast('Missing Field', 'Please enter the Full Name.', 'warning'); return; }
  if (!age || age < 50 || age > 120) { showToast('Invalid Age', 'Age must be between 50 and 120.', 'warning'); return; }

  const idx = residents.findIndex(r => r.id === resId);
  if (idx === -1) return;

  const oldName = residents[idx].name;
  residents[idx] = { ...residents[idx], room, name, age, gender, contact };
  saveToStorage(STORAGE_KEYS.RESIDENTS, residents);

  // Update residentName on all linked medicines
  medicines.forEach(med => {
    if (med.residentId === resId) {
      med.residentName = name;
      med.residentRoom = room;
    }
  });
  saveToStorage(STORAGE_KEYS.MEDICINES, medicines);

  populateResidentDropdown();
  populateCaretakerResidentFilter();
  renderResidentList();
  renderResidentOverview();
  renderMedList();
  renderCaretakerView();
  closeEditResidentModal();
  showToast('Resident Updated!', `${name}'s details have been saved.`, 'success');
});

/** Render Resident Cards */
function renderResidentList() {
  const query = residentSearchQ.toLowerCase();
  const filtered = residents.filter(r =>
    r.name.toLowerCase().includes(query) ||
    r.id.toLowerCase().includes(query) ||
    r.room.toLowerCase().includes(query)
  );

  if (filtered.length === 0) {
    dom.residentList.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <span class="empty-icon">👥</span>
        <p>${query ? 'No residents match your search.' : 'No residents registered yet.<br/>Use the form above to add one.'}</p>
      </div>`;
    return;
  }

  dom.residentList.innerHTML = filtered.map(r => {
    const medCount = medicines.filter(m => m.residentId === r.id).length;
    return `
      <div class="resident-card" data-id="${escHtml(r.id)}">
        <div class="rc-header">
          <div class="rc-avatar" aria-hidden="true">${r.gender === 'Female' ? '👩' : r.gender === 'Male' ? '👴' : '🧑'}</div>
          <div class="rc-id-badge">${escHtml(r.id)}</div>
        </div>
        <div class="rc-body">
          <div class="rc-name">${escHtml(r.name)}</div>
          <div class="rc-meta">
            <span class="meta-tag tag-room">🚪 Room ${escHtml(r.room)}</span>
            <span class="meta-tag tag-age">🎂 Age ${escHtml(String(r.age))}</span>
            <span class="meta-tag tag-gender">${r.gender === 'Female' ? '♀' : r.gender === 'Male' ? '♂' : '⚧'} ${escHtml(r.gender)}</span>
          </div>
          ${r.contact ? `<div class="rc-contact">📞 ${escHtml(r.contact)}</div>` : ''}
          <div class="rc-med-count">${medCount === 0 ? 'No medicines assigned' : `${medCount} medicine${medCount > 1 ? 's' : ''} scheduled`}</div>
        </div>
        <div class="rc-actions">
          <button class="btn btn-ghost btn-sm" onclick="openEditResidentModal('${escHtml(r.id)}')" aria-label="Edit ${escHtml(r.name)}">✏️ Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteResident('${escHtml(r.id)}')" aria-label="Delete ${escHtml(r.name)}">🗑 Delete</button>
        </div>
      </div>`;
  }).join('');
}

/** Render Resident Overview Stats */
function renderResidentOverview() {
  const total   = residents.length;
  const male    = residents.filter(r => r.gender === 'Male').length;
  const female  = residents.filter(r => r.gender === 'Female').length;
  const withMed = residents.filter(r => medicines.some(m => m.residentId === r.id)).length;

  dom.ovTotal.textContent   = total;
  dom.ovMale.textContent    = male;
  dom.ovFemale.textContent  = female;
  dom.ovWithMeds.textContent = withMed;
}

/** Populate resident dropdown in Add Medicine form */
function populateResidentDropdown() {
  const current = dom.medResident.value;
  dom.medResident.innerHTML = '<option value="">— Select Resident —</option>';
  residents.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = `${r.name} (${r.id}) — Room ${r.room}`;
    if (r.id === current) opt.selected = true;
    dom.medResident.appendChild(opt);
  });
}

/** Populate caretaker resident filter dropdown */
function populateCaretakerResidentFilter() {
  const current = dom.ctResidentFilter.value;
  dom.ctResidentFilter.innerHTML = '<option value="all">All Residents</option>';
  residents.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = `${r.name} — Room ${r.room}`;
    if (r.id === current) opt.selected = true;
    dom.ctResidentFilter.appendChild(opt);
  });
}

/** Search residents */
dom.residentSearch.addEventListener('input', e => {
  residentSearchQ = e.target.value.trim();
  renderResidentList();
});

// ═══════════════════════════════════════════════════════════════════════════════
//  MEDICINES — CRUD
// ═══════════════════════════════════════════════════════════════════════════════

dom.form.addEventListener('submit', e => {
  e.preventDefault();

  const residentId = dom.medResident.value;
  const name       = dom.medName.value.trim();
  const dosage     = dom.medDosage.value.trim();
  const time       = dom.medTime.value;
  const freq       = dom.medFreq.value;
  const category   = dom.medCategory.value;
  const notes      = dom.medNotes.value.trim();

  // Validation
  if (!residentId) {
    showToast('Missing Field', 'Please select a resident.', 'warning');
    dom.medResident.focus();
    return;
  }
  // Verify resident still exists
  const resident = findResident(residentId);
  if (!resident) {
    showToast('Invalid Resident', 'Selected resident not found. Please refresh.', 'error');
    populateResidentDropdown();
    return;
  }
  if (!name)   { showToast('Missing Field', 'Please enter a medicine name.', 'warning'); dom.medName.focus(); return; }
  if (!dosage) { showToast('Missing Field', 'Please enter the dosage.', 'warning'); dom.medDosage.focus(); return; }
  if (!time)   { showToast('Missing Field', 'Please select a time.', 'warning'); dom.medTime.focus(); return; }

  const med = {
    id             : uid(),
    residentId     : resident.id,
    residentName   : resident.name,
    residentRoom   : resident.room,
    name,
    dosage,
    time,
    freq,
    category,
    notes,
    status         : 'pending',
    createdAt      : new Date().toISOString(),
    statusUpdatedAt: null,
  };

  medicines.push(med);
  saveToStorage(STORAGE_KEYS.MEDICINES, medicines);

  dom.form.reset();
  // Restore resident dropdown options after reset
  populateResidentDropdown();
  renderMedList();
  renderStats();
  renderReminders();
  renderResidentOverview();
  renderCaretakerView();
  showToast('Medicine Added!', `${name} scheduled for ${resident.name}.`, 'success');
});

/** Mark medicine as taken or missed */
function updateMedStatus(id, status) {
  const med = medicines.find(m => m.id === id);
  if (!med) return;

  med.status = status;
  med.statusUpdatedAt = new Date().toISOString();

  saveToStorage(STORAGE_KEYS.MEDICINES, medicines);
  addHistoryEntry(med, status);
  renderMedList();
  renderStats();
  renderReminders();
  renderCaretakerView();

  const emoji = status === 'taken' ? '✅' : '❌';
  const resInfo = med.residentName ? ` (${med.residentName})` : '';
  showToast(`${emoji} Updated`, `${med.name}${resInfo} marked as ${status}.`, status === 'taken' ? 'success' : 'error');
}

/** Delete a medicine */
function deleteMedicine(id) {
  const med = medicines.find(m => m.id === id);
  if (!med) return;

  openModal(
    'Remove Medicine',
    `<p>Remove <strong>${escHtml(med.name)}</strong> from the schedule?</p><p style="color:var(--text-muted);margin-top:8px;font-size:0.88rem;">This action cannot be undone.</p>`,
    () => {
      medicines = medicines.filter(m => m.id !== id);
      saveToStorage(STORAGE_KEYS.MEDICINES, medicines);
      renderMedList();
      renderStats();
      renderReminders();
      renderResidentOverview();
      renderCaretakerView();
      showToast('Removed', `${med.name} has been removed.`, 'info');
    },
    '🗑 Remove',
    'btn-danger'
  );
}

/** Reset a medicine back to pending */
function resetMedStatus(id) {
  const med = medicines.find(m => m.id === id);
  if (!med) return;
  med.status = 'pending';
  med.statusUpdatedAt = null;
  saveToStorage(STORAGE_KEYS.MEDICINES, medicines);
  renderMedList();
  renderStats();
  renderReminders();
  renderCaretakerView();
  showToast('Reset', `${med.name} reset to pending.`, 'info');
}

// ═══════════════════════════════════════════════════════════════════════════════
//  RENDER — MEDICINE LIST (Dashboard)
// ═══════════════════════════════════════════════════════════════════════════════

function renderMedList() {
  const query = searchQuery.toLowerCase();
  const filtered = medicines.filter(m =>
    m.name.toLowerCase().includes(query) ||
    m.dosage.toLowerCase().includes(query) ||
    (m.category || '').toLowerCase().includes(query) ||
    (m.residentName || '').toLowerCase().includes(query) ||
    (m.residentRoom || '').toLowerCase().includes(query)
  );

  if (filtered.length === 0) {
    dom.medList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">💊</span>
        <p>${query ? 'No medicines match your search.' : 'No medicines scheduled yet.<br/>Use the form above to add one.'}</p>
      </div>`;
    return;
  }

  const sorted = [...filtered].sort((a, b) => {
    const statusOrder = { pending: 0, taken: 1, missed: 2 };
    if (statusOrder[a.status] !== statusOrder[b.status])
      return statusOrder[a.status] - statusOrder[b.status];
    return a.time.localeCompare(b.time);
  });

  dom.medList.innerHTML = sorted.map(med => {
    const statusClass = `status-${med.status}`;
    const badgeClass  = `badge-${med.status}`;
    const statusLabel = med.status.charAt(0).toUpperCase() + med.status.slice(1);
    const isPending   = med.status === 'pending';
    const rd          = getResidentDisplay(med);

    const actionBtns = isPending
      ? `<button class="btn btn-success btn-sm" onclick="updateMedStatus('${med.id}','taken')" aria-label="Mark ${escHtml(med.name)} as taken">✅ Taken</button>
         <button class="btn btn-danger btn-sm" onclick="updateMedStatus('${med.id}','missed')" aria-label="Mark ${escHtml(med.name)} as missed">❌ Missed</button>`
      : `<button class="btn btn-ghost btn-sm" onclick="resetMedStatus('${med.id}')" aria-label="Reset ${escHtml(med.name)} to pending">↩ Reset</button>`;

    return `
      <article class="med-item ${statusClass}" data-id="${med.id}">
        <div class="med-info">
          <div class="med-name">${escHtml(med.name)}</div>
          <div class="med-meta">
            <span class="meta-tag tag-resident">👤 ${escHtml(rd.name)}${rd.room !== '—' ? ` · 🚪${escHtml(rd.room)}` : ''}</span>
            <span class="meta-tag tag-dosage">💊 ${escHtml(med.dosage)}</span>
            <span class="meta-tag tag-time">🕐 ${formatTime(med.time)}</span>
            <span class="meta-tag tag-freq">🔁 ${escHtml(med.freq)}</span>
            <span class="status-badge ${badgeClass}">${statusLabel}</span>
          </div>
          ${med.notes ? `<div style="font-size:0.78rem;color:var(--text-muted);margin-top:5px;">📝 ${escHtml(med.notes)}</div>` : ''}
        </div>
        <div class="med-actions">
          ${actionBtns}
          <button class="btn btn-ghost btn-sm" onclick="deleteMedicine('${med.id}')" aria-label="Delete ${escHtml(med.name)}">🗑</button>
        </div>
      </article>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════════════════
//  RENDER — STATS
// ═══════════════════════════════════════════════════════════════════════════════

function renderStats() {
  const total   = medicines.length;
  const taken   = medicines.filter(m => m.status === 'taken').length;
  const missed  = medicines.filter(m => m.status === 'missed').length;
  const pending = medicines.filter(m => m.status === 'pending').length;

  dom.statResidents.textContent = residents.length;
  dom.statTotal.textContent     = total;
  dom.statTaken.textContent     = taken;
  dom.statMissed.textContent    = missed;
  dom.statPending.textContent   = pending;

  const pct = total > 0 ? Math.round((taken / total) * 100) : 0;
  dom.progressBar.style.width = `${pct}%`;
  dom.progressBarWrap.setAttribute('aria-valuenow', pct);
  dom.progressText.textContent = `${taken} / ${total} taken (${pct}%)`;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  RENDER — REMINDERS
// ═══════════════════════════════════════════════════════════════════════════════

function renderReminders() {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const pending = medicines
    .filter(m => m.status === 'pending')
    .map(m => {
      const [h, min] = m.time.split(':').map(Number);
      const medMinutes = h * 60 + min;
      const diff = medMinutes - currentMinutes;
      return { ...m, medMinutes, diff };
    })
    .sort((a, b) => a.diff - b.diff)
    .slice(0, 8);

  if (pending.length === 0) {
    dom.reminderList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">🎉</span>
        <p>All medicines for now are handled.<br/>Great job!</p>
      </div>`;
    return;
  }

  dom.reminderList.innerHTML = pending.map(m => {
    const isOverdue  = m.diff < 0;
    const isDueNow   = Math.abs(m.diff) <= 15;
    const rd         = getResidentDisplay(m);

    let itemClass      = 'reminder-item';
    let dotClass       = 'reminder-dot dot-warning';
    let countdownClass = 'countdown-warning';
    let countdownText  = '';

    if (isOverdue) {
      itemClass      += ' due-now';
      dotClass        = 'reminder-dot dot-danger';
      countdownClass  = 'countdown-danger';
      const overdueMins = Math.abs(m.diff);
      countdownText = overdueMins < 60
        ? `${overdueMins}m overdue`
        : `${Math.floor(overdueMins / 60)}h ${overdueMins % 60}m overdue`;
    } else if (isDueNow) {
      itemClass      += ' due-now';
      dotClass        = 'reminder-dot dot-danger';
      countdownClass  = 'countdown-danger';
      countdownText   = m.diff === 0 ? 'Due now!' : `In ${m.diff}m`;
    } else {
      itemClass += ' upcoming';
      const hrs  = Math.floor(m.diff / 60);
      const mins = m.diff % 60;
      countdownText = hrs > 0 ? `In ${hrs}h ${mins}m` : `In ${mins}m`;
    }

    return `
      <div class="${itemClass}" role="listitem">
        <div class="${dotClass}" aria-hidden="true"></div>
        <div class="reminder-text">
          <div class="reminder-med-name">${escHtml(m.name)}</div>
          <div class="reminder-time-text">👤 ${escHtml(rd.name)} · ${escHtml(m.dosage)} · ${formatTime(m.time)} · ${escHtml(m.freq)}</div>
        </div>
        <span class="reminder-countdown ${countdownClass}" aria-label="${countdownText}">${escHtml(countdownText)}</span>
      </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════════════════
//  RENDER — CARETAKER VIEW
// ═══════════════════════════════════════════════════════════════════════════════

function renderCaretakerView() {
  let filtered = [...medicines];

  // Filter by resident
  if (ctResidentFilter !== 'all') {
    filtered = filtered.filter(m => m.residentId === ctResidentFilter);
  }

  // Filter by status
  if (ctFilterMode !== 'all') {
    filtered = filtered.filter(m => m.status === ctFilterMode);
  }

  // Sort: by resident name, then by time
  filtered.sort((a, b) => {
    const ra = (a.residentName || 'Unassigned').localeCompare(b.residentName || 'Unassigned');
    return ra !== 0 ? ra : a.time.localeCompare(b.time);
  });

  // Summary numbers (from full filtered by resident only, not status)
  let base = ctResidentFilter !== 'all'
    ? medicines.filter(m => m.residentId === ctResidentFilter)
    : medicines;

  dom.ctSumTotal.textContent   = base.length;
  dom.ctSumPending.textContent = base.filter(m => m.status === 'pending').length;
  dom.ctSumTaken.textContent   = base.filter(m => m.status === 'taken').length;
  dom.ctSumMissed.textContent  = base.filter(m => m.status === 'missed').length;

  if (filtered.length === 0) {
    dom.caretakerBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center;padding:36px;color:var(--text-muted);">
          <span style="font-size:2rem;display:block;margin-bottom:8px;">🩺</span>
          No medicines found for the selected filter.
        </td>
      </tr>`;
    return;
  }

  dom.caretakerBody.innerHTML = filtered.map(med => {
    const badgeClass  = `badge-${med.status}`;
    const statusLabel = med.status.charAt(0).toUpperCase() + med.status.slice(1);
    const statusEmoji = med.status === 'taken' ? '✅' : med.status === 'missed' ? '❌' : '⏳';
    const rd          = getResidentDisplay(med);

    const actionCell = med.status === 'pending'
      ? `<button class="btn btn-success btn-sm" onclick="updateMedStatus('${med.id}','taken')" aria-label="Mark taken">✅</button>
         <button class="btn btn-danger btn-sm" onclick="updateMedStatus('${med.id}','missed')" aria-label="Mark missed">❌</button>`
      : `<button class="btn btn-ghost btn-sm" onclick="resetMedStatus('${med.id}')" aria-label="Reset to pending">↩</button>`;

    return `
      <tr>
        <td><strong>${escHtml(rd.name)}</strong></td>
        <td><span class="meta-tag tag-room">🚪 ${escHtml(rd.room)}</span></td>
        <td>${escHtml(med.name)}${med.notes ? `<br/><span style="font-size:0.73rem;color:var(--text-muted);">📝 ${escHtml(med.notes)}</span>` : ''}</td>
        <td>${escHtml(med.dosage)}</td>
        <td>${formatTime(med.time)}</td>
        <td>${escHtml(med.freq)}</td>
        <td><span class="status-badge ${badgeClass}">${statusEmoji} ${statusLabel}</span></td>
        <td>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${actionCell}
          </div>
        </td>
      </tr>`;
  }).join('');
}

// Caretaker filter buttons
dom.ctFilterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    ctFilterMode = btn.dataset.ctfilter;
    dom.ctFilterBtns.forEach(b => {
      b.classList.toggle('active', b === btn);
      b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
    });
    renderCaretakerView();
  });
});

// Caretaker resident dropdown
dom.ctResidentFilter.addEventListener('change', () => {
  ctResidentFilter = dom.ctResidentFilter.value;
  renderCaretakerView();
});

// ═══════════════════════════════════════════════════════════════════════════════
//  HISTORY
// ═══════════════════════════════════════════════════════════════════════════════

function addHistoryEntry(med, status, timestamp) {
  const rd = getResidentDisplay(med);
  const entry = {
    id           : uid(),
    medId        : med.id,
    residentId   : med.residentId || null,
    residentName : med.residentName || rd.name,
    residentRoom : med.residentRoom || rd.room,
    name         : med.name,
    dosage       : med.dosage,
    time         : med.time,
    category     : med.category,
    status,
    timestamp    : timestamp || new Date().toISOString(),
  };

  const duplicate = history.find(h =>
    h.medId === med.id &&
    h.status === status &&
    Math.abs(new Date(h.timestamp) - new Date(entry.timestamp)) < 5000
  );
  if (!duplicate) {
    history.unshift(entry);
    if (history.length > 200) history = history.slice(0, 200);
    saveToStorage(STORAGE_KEYS.HISTORY, history);
    renderHistory();
  }
}

function renderHistory() {
  const filtered = filterMode === 'all'
    ? history
    : history.filter(h => h.status === filterMode);

  if (filtered.length === 0) {
    dom.historyBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted);">
          <span style="font-size:2rem;display:block;margin-bottom:8px;">📜</span>
          No ${filterMode === 'all' ? '' : filterMode + ' '}history found.
        </td>
      </tr>`;
    return;
  }

  dom.historyBody.innerHTML = filtered.map(h => {
    const badgeClass  = `badge-${h.status}`;
    const statusLabel = h.status.charAt(0).toUpperCase() + h.status.slice(1);
    const emoji       = h.status === 'taken' ? '✅' : '❌';
    const resName     = h.residentName || 'Unassigned';
    const resRoom     = h.residentRoom || '—';
    return `
      <tr>
        <td>
          <strong>${escHtml(resName)}</strong>
          ${resRoom !== '—' ? `<br/><span style="font-size:0.73rem;color:var(--text-muted);">🚪 Room ${escHtml(resRoom)}</span>` : ''}
        </td>
        <td>
          <strong>${escHtml(h.name)}</strong>
          ${h.category ? `<br/><span style="font-size:0.73rem;color:var(--text-muted);">${escHtml(h.category)}</span>` : ''}
        </td>
        <td>${escHtml(h.dosage)}</td>
        <td>${formatTime(h.time)}</td>
        <td><span class="status-badge ${badgeClass}">${emoji} ${statusLabel}</span></td>
        <td style="color:var(--text-secondary);font-size:0.83rem;">${formatDateTime(new Date(h.timestamp))}</td>
      </tr>`;
  }).join('');
}

dom.filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterMode = btn.dataset.filter;
    dom.filterBtns.forEach(b => {
      b.classList.toggle('active', b === btn);
      b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
    });
    renderHistory();
  });
});

dom.clearHistoryBtn.addEventListener('click', () => {
  if (history.length === 0) { showToast('Nothing to Clear', 'History is already empty.', 'info'); return; }
  openModal(
    'Clear History',
    '<p>Are you sure you want to clear all medication history?</p><p style="color:var(--text-muted);margin-top:8px;font-size:0.88rem;">This cannot be undone.</p>',
    () => {
      history = [];
      saveToStorage(STORAGE_KEYS.HISTORY, history);
      renderHistory();
      showToast('History Cleared', 'All medication history has been removed.', 'info');
    },
    '🗑 Clear All',
    'btn-danger'
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SEARCH
// ═══════════════════════════════════════════════════════════════════════════════

dom.medSearch.addEventListener('input', e => {
  searchQuery = e.target.value.trim();
  renderMedList();
});

dom.refreshBtn.addEventListener('click', () => {
  renderReminders();
  showToast('Reminders Refreshed', 'Reminder list has been updated.', 'info', 2000);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  BROWSER NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function sendBrowserNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '' });
  }
}

function checkDueNow() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  medicines.forEach(med => {
    if (med.status !== 'pending') return;
    const [mh, mm] = med.time.split(':').map(Number);
    if (mh === h && mm === m) {
      const resName = med.residentName ? `for ${med.residentName}` : '';
      sendBrowserNotification('💊 Medication Reminder', `Time to take ${med.name} ${resName} — ${med.dosage}`);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  BACKWARDS COMPATIBILITY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Ensure old medicines (without residentId) work gracefully.
 * They will display as "Unassigned" and still function normally.
 */
function migrateOldMedicines() {
  let changed = false;
  medicines.forEach(med => {
    if (!('residentId' in med)) {
      med.residentId   = null;
      med.residentName = 'Unassigned';
      med.residentRoom = '—';
      changed = true;
    }
  });
  if (changed) saveToStorage(STORAGE_KEYS.MEDICINES, medicines);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════════════════════

function init() {
  // Load from storage
  medicines = loadFromStorage(STORAGE_KEYS.MEDICINES, []);
  history   = loadFromStorage(STORAGE_KEYS.HISTORY, []);
  residents = loadFromStorage(STORAGE_KEYS.RESIDENTS, []);

  // Migrate old medicines to new schema
  migrateOldMedicines();

  // Daily reset
  checkDailyReset();

  // Populate dropdowns
  populateResidentDropdown();
  populateCaretakerResidentFilter();

  // Clock
  updateClock();
  clockInterval = setInterval(updateClock, 1000);

  // Render everything
  renderMedList();
  renderStats();
  renderReminders();
  renderHistory();
  renderResidentList();
  renderResidentOverview();
  renderCaretakerView();

  // Auto-refresh reminders every minute + due-now check
  reminderInterval = setInterval(() => {
    renderReminders();
    checkDueNow();
  }, 60_000);

  requestNotificationPermission();

  // Welcome toast
  const isFirst = !localStorage.getItem('medcare_welcomed');
  if (isFirst) {
    localStorage.setItem('medcare_welcomed', '1');
    setTimeout(() => {
      showToast('Welcome to MedCare! 👋', 'Start by adding residents, then assign medicines.', 'info', 5000);
    }, 800);
  }
}

// ── GLOBAL FUNCTION EXPOSURE (for inline onclick attributes) ──
window.updateMedStatus         = updateMedStatus;
window.deleteMedicine          = deleteMedicine;
window.resetMedStatus          = resetMedStatus;
window.deleteResident          = deleteResident;
window.openEditResidentModal   = openEditResidentModal;

// Start the app
document.addEventListener('DOMContentLoaded', init);
