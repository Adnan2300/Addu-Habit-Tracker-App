// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.log('SW registration failed:', err));
}

// Initial State from localStorage
let habits = JSON.parse(localStorage.getItem('habits')) || [];
let categories = JSON.parse(localStorage.getItem('categories')) || ['Health', 'Fitness', 'Productivity', 'Mindfulness'];
let habitCharts = {};
let categoryChart = null;
let editingHabitId = null;
let dragState = null;
let viewYear = new Date().getFullYear();

// Dark mode is the default; remember the last choice
if (localStorage.getItem('habit_theme') === 'light') document.body.classList.remove('dark-mode');

// Clock & Full Date Display
function updateClockAndDate() {
    const now = new Date();
    
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    document.getElementById('clock').innerText = `${hours}:${minutes}:${seconds}`;

    const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    document.getElementById('dateDisplay').innerText = now.toLocaleDateString('en-US', options);
}
updateClockAndDate();
setInterval(updateClockAndDate, 1000);

function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-mode');
    try { localStorage.setItem('habit_theme', isDark ? 'dark' : 'light'); } catch (e) {}
}

// Year navigation
function getMinYear() {
    let min = new Date().getFullYear();
    habits.forEach(h => h.logs.forEach(d => {
        const y = parseInt(d.slice(0, 4), 10);
        if (y && y < min) min = y;
    }));
    return min;
}

function updateYearControls() {
    document.getElementById('yearLabel').innerText = viewYear;
    document.getElementById('nextYearBtn').disabled = viewYear >= new Date().getFullYear();
    document.getElementById('prevYearBtn').disabled = viewYear <= getMinYear();
}

function changeYear(delta) {
    const next = viewYear + delta;
    if (next > new Date().getFullYear() || next < getMinYear()) return;
    viewYear = next;
    updateYearControls();
    renderHabits(true);
}

function saveData() {
    localStorage.setItem('habits', JSON.stringify(habits));
    localStorage.setItem('categories', JSON.stringify(categories));
}

function populateCategories() {
    const datalist = document.getElementById('categoryOptions');
    const editDatalist = document.getElementById('editCategoryOptions');
    const filterSelect = document.getElementById('categoryFilter');

    const catOptionsHtml = categories.map(c => `<option value="${c}">`).join('');
    datalist.innerHTML = catOptionsHtml;
    if (editDatalist) editDatalist.innerHTML = catOptionsHtml;

    filterSelect.innerHTML = '<option value="All">All Categories</option>' + 
        categories.map(c => `<option value="${c}">${c}</option>`).join('');
}

// Modal Controls
function openAddModal() {
    document.getElementById('addModal').classList.add('active');
}

function closeAddModal() {
    document.getElementById('addModal').classList.remove('active');
}

function openEditModal(habitId) {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    editingHabitId = habitId;
    document.getElementById('editHabitName').value = habit.name;
    document.getElementById('editCategoryInput').value = habit.category;
    document.getElementById('editHabitColor').value = habit.color;

    document.getElementById('editModal').classList.add('active');
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('active');
    editingHabitId = null;
}

function openAnalyticsModal() {
    document.getElementById('analyticsModal').classList.add('active');
    renderDetailedAnalytics();
}

function closeAnalyticsModal() {
    document.getElementById('analyticsModal').classList.remove('active');
}

// CRUD Actions
function addHabit() {
    const name = document.getElementById('newHabitName').value.trim();
    const category = document.getElementById('newCategoryInput').value.trim() || 'General';
    const color = document.getElementById('habitColor').value;

    if (!name) return alert('Please enter a habit name.');

    if (!categories.includes(category)) {
        categories.push(category);
    }

    const newHabit = {
        id: Date.now(),
        name,
        category,
        color,
        logs: []
    };

    habits.push(newHabit);
    saveData();

    document.getElementById('newHabitName').value = '';
    document.getElementById('newCategoryInput').value = '';

    closeAddModal();
    populateCategories();
    renderAll();
}

function saveEditHabit() {
    if (!editingHabitId) return;

    const habit = habits.find(h => h.id === editingHabitId);
    if (!habit) return;

    const newName = document.getElementById('editHabitName').value.trim();
    const newCategory = document.getElementById('editCategoryInput').value.trim() || 'General';
    const newColor = document.getElementById('editHabitColor').value;

    if (!newName) return alert('Habit name cannot be empty.');

    if (!categories.includes(newCategory)) {
        categories.push(newCategory);
    }

    habit.name = newName;
    habit.category = newCategory;
    habit.color = newColor;

    saveData();
    closeEditModal();
    populateCategories();
    renderAll();
}

function toggleHabitDay(habitId, dateStr, isFuture) {
    if (isFuture) return;

    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    const index = habit.logs.indexOf(dateStr);
    if (index > -1) {
        habit.logs.splice(index, 1);
    } else {
        habit.logs.push(dateStr);
    }

    saveData();
    renderAll();
}

function deleteHabit(habitId) {
    if (!confirm('Are you sure you want to delete this habit track?')) return;
    habits = habits.filter(h => h.id !== habitId);
    saveData();
    renderAll();
}

// Touch + mouse reordering (hold the ⋮⋮ handle and drag)
function startHandleDrag(e, index) {
    e.preventDefault();
    const card = e.currentTarget.closest('.habit-card');
    dragState = { index, target: index, card };
    card.classList.add('dragging');
    e.currentTarget.setPointerCapture(e.pointerId);
}

function moveHandleDrag(e) {
    if (!dragState) return;
    e.preventDefault();
    document.querySelectorAll('.habit-card.drag-over').forEach(c => c.classList.remove('drag-over'));
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const over = el && el.closest('.habit-card');
    if (over && over !== dragState.card) {
        over.classList.add('drag-over');
        dragState.target = Number(over.dataset.index);
    }
    if (e.clientY < 100) window.scrollBy(0, -14);
    else if (e.clientY > window.innerHeight - 100) window.scrollBy(0, 14);
}

function endHandleDrag() {
    if (!dragState) return;
    const { index, target } = dragState;
    dragState = null;
    if (target !== index) {
        const item = habits.splice(index, 1)[0];
        habits.splice(target, 0, item);
        saveData();
    }
    renderHabits();
}

// Streak Calculations
function calculateStreakStats(logs) {
    if (!logs || logs.length === 0) return { currentStreak: 0, longestStreak: 0 };

    const sortedDatesAsc = [...new Set(logs)]
        .map(d => new Date(d))
        .sort((a, b) => a - b);

    let maxStreak = 0;
    let tempStreak = 0;

    for (let i = 0; i < sortedDatesAsc.length; i++) {
        if (i === 0) {
            tempStreak = 1;
        } else {
            const diffDays = Math.round((sortedDatesAsc[i] - sortedDatesAsc[i - 1]) / (1000 * 60 * 60 * 24));
            if (diffDays === 1) {
                tempStreak++;
            } else if (diffDays > 1) {
                tempStreak = 1;
            }
        }
        if (tempStreak > maxStreak) {
            maxStreak = tempStreak;
        }
    }

    const sortedDatesDesc = [...new Set(logs)]
        .map(d => new Date(d))
        .sort((a, b) => b - a);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const mostRecent = new Date(sortedDatesDesc[0]);
    mostRecent.setHours(0, 0, 0, 0);

    let currentStreak = 0;
    if (mostRecent >= yesterday) {
        let checkDate = mostRecent;
        for (let i = 0; i < sortedDatesDesc.length; i++) {
            const currentDate = new Date(sortedDatesDesc[i]);
            currentDate.setHours(0, 0, 0, 0);

            if (currentDate.getTime() === checkDate.getTime()) {
                currentStreak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }
    }

    return { currentStreak, longestStreak: maxStreak };
}

function renderHabits(resetScroll = false) {
    const search = document.getElementById('searchFilter').value.toLowerCase();
    const category = document.getElementById('categoryFilter').value;

    const container = document.getElementById('habitsList');
    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth();
    const todayStr = `${thisYear}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const isFiltered = search !== '' || category !== 'All';

    // Remember each card's sideways scroll so tapping a day doesn't make it jump
    const savedScroll = {};
    container.querySelectorAll('.habit-card').forEach(card => {
        const grid = card.querySelector('.year-grid');
        if (grid) savedScroll[card.dataset.id] = grid.scrollLeft;
    });

    container.innerHTML = habits.map((h, index) => {
        const matchesSearch = h.name.toLowerCase().includes(search);
        const matchesCat = category === 'All' || h.category === category;
        if (!matchesSearch || !matchesCat) return '';

        let monthColumnsHtml = '';
        const streakStats = calculateStreakStats(h.logs);
        const totalCompletions = h.logs.length;

        months.forEach((mName, mIdx) => {
            const daysInMonth = new Date(viewYear, mIdx + 1, 0).getDate();
            const isCurrent = viewYear === thisYear && mIdx === thisMonth;
            let dayBoxesHtml = '';

            for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${viewYear}-${String(mIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const isDone = h.logs.includes(dateStr);
                const isFuture = dateStr > todayStr;

                dayBoxesHtml += `<div class="day-box ${isDone ? 'active' : ''} ${isFuture ? 'future-disabled' : ''} ${dateStr === todayStr ? 'today' : ''}"
                    style="${isDone ? `background:${h.color} !important;` : ''}"
                    title="${isFuture ? dateStr + ' (Future date - locked)' : dateStr}"
                    onclick="toggleHabitDay(${h.id}, '${dateStr}', ${isFuture})"><span>${d}</span></div>`;
            }

            monthColumnsHtml += `
                <div class="month-column ${isCurrent ? 'current-month' : ''}">
                    <div class="month-name">${mName}</div>
                    <div class="days-flex">${dayBoxesHtml}</div>
                </div>
            `;
        });

        return `
            <div class="habit-card" data-id="${h.id}" data-index="${index}">
                <div class="habit-header">
                    <div class="habit-title-wrapper">
                        ${!isFiltered ? `<span class="drag-handle" title="Hold and drag to reorder"
                            onpointerdown="startHandleDrag(event, ${index})"
                            onpointermove="moveHandleDrag(event)"
                            onpointerup="endHandleDrag(event)"
                            onpointercancel="endHandleDrag(event)">⋮⋮</span>` : ''}
                        <strong style="font-size:1.1rem; margin-right:4px;">${h.name}</strong>
                        <span class="tag-badge">${h.category}</span>
                        <span class="count-badge" title="Total Completions">✔ ${totalCompletions} total</span>
                        <span class="streak-badge ${streakStats.currentStreak > 0 ? 'active-streak' : ''}" title="Current Consecutive Streak">🔥 ${streakStats.currentStreak}d current</span>
                        <span class="streak-badge longest-streak" title="Longest Historical Streak">🏆 ${streakStats.longestStreak}d best</span>
                    </div>
                    <div class="action-buttons">
                        <button onclick="openEditModal(${h.id})" class="action-icon-btn" title="Edit Habit">✏️</button>
                        <button onclick="deleteHabit(${h.id})" class="action-icon-btn delete-btn" title="Delete Habit">🗑</button>
                    </div>
                </div>
                <div class="year-grid">${monthColumnsHtml}</div>
            </div>
        `;
    }).join('');

    // Open each card on the current month (or keep the previous scroll position)
    container.querySelectorAll('.habit-card').forEach(card => {
        const grid = card.querySelector('.year-grid');
        if (!grid) return;
        const saved = resetScroll ? undefined : savedScroll[card.dataset.id];
        if (saved !== undefined) { grid.scrollLeft = saved; return; }
        const target = grid.querySelector('.current-month');
        if (target) grid.scrollLeft = Math.max(0, target.offsetLeft - 4);
    });
}

function renderMetrics() {
    let total = 0;
    habits.forEach(h => total += h.logs.length);

    document.getElementById('totalCompletions').innerText = total;
    document.getElementById('activeHabitsCount').innerText = habits.length;
}

// ===== Analytics =====
let trendChart = null, weekdayChart = null;
const DAY_MS = 86400000;
const p2 = n => String(n).padStart(2, '0');

function yearLogs(h) { return h.logs.filter(d => d.startsWith(viewYear + '-')); }

// Days a habit has existed inside [from, to] (never counts days before it was created / first logged)
function trackedDays(h, from, to) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let start = new Date(h.id);
    if (isNaN(start)) start = new Date(0);
    start.setHours(0, 0, 0, 0);
    h.logs.forEach(d => { const x = new Date(d + 'T00:00:00'); if (x < start) start = x; });
    const f = start > from ? start : from;
    const t = today < to ? today : to;
    return t < f ? 0 : Math.round((t - f) / DAY_MS) + 1;
}

function pct(n, d) { return d ? Math.min(100, Math.round(100 * n / d)) : 0; }

function renderDetailedAnalytics() {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const thisYear = now.getFullYear(), thisMonth = now.getMonth();
    const todayStr = `${thisYear}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}`;
    const cs = getComputedStyle(document.body);
    Chart.defaults.color = cs.getPropertyValue('--text-muted').trim() || '#888';
    Chart.defaults.borderColor = 'rgba(128,128,128,0.2)';
    const accent = cs.getPropertyValue('--accent-purple').trim() || '#8b5cf6';
    const yStart = new Date(viewYear, 0, 1), yEnd = new Date(viewYear, 11, 31);
    document.getElementById('analyticsTitle').innerText = `Analytics · ${viewYear}`;

    const stats = habits.map(h => {
        const logs = yearLogs(h);
        const tracked = trackedDays(h, yStart, yEnd);
        const st = calculateStreakStats(h.logs);
        return { h, logs, count: logs.length, tracked, rate: pct(logs.length, tracked), cur: st.currentStreak, best: st.longestStreak };
    });
    const totalYear = stats.reduce((a, s) => a + s.count, 0);
    const yearRate = pct(totalYear, stats.reduce((a, s) => a + s.tracked, 0));

    const monthCounts = new Array(12).fill(0);
    stats.forEach(s => s.logs.forEach(d => monthCounts[parseInt(d.slice(5, 7), 10) - 1]++));

    let monthLabel, monthValue;
    if (viewYear === thisYear) {
        const mS = new Date(thisYear, thisMonth, 1), mE = new Date(thisYear, thisMonth + 1, 0);
        monthLabel = 'This month';
        monthValue = pct(monthCounts[thisMonth], habits.reduce((a, h) => a + trackedDays(h, mS, mE), 0)) + '%';
    } else {
        monthLabel = 'Best month';
        monthValue = totalYear ? months[monthCounts.indexOf(Math.max(...monthCounts))] : '–';
    }
    const bestCur = stats.reduce((a, s) => s.cur > (a ? a.cur : 0) ? s : a, null);
    const bestEver = stats.reduce((a, s) => s.best > (a ? a.best : 0) ? s : a, null);
    const consistent = stats.filter(s => s.tracked > 0).sort((a, b) => b.rate - a.rate)[0];

    const cards = [
        [totalYear, `Completions in ${viewYear}`, ''],
        [yearRate + '%', 'Overall completion rate', ''],
        [monthValue, monthLabel, ''],
        [(bestCur ? bestCur.cur : 0) + 'd', 'Best current streak', bestCur ? bestCur.h.name : ''],
        [(bestEver ? bestEver.best : 0) + 'd', 'Longest streak ever', bestEver ? bestEver.h.name : ''],
        [consistent ? consistent.rate + '%' : '–', 'Most consistent', consistent ? consistent.h.name : '']
    ];
    document.getElementById('statCards').innerHTML = cards.map(c =>
        `<div class="stat-card"><div class="stat-value">${c[0]}</div><div class="stat-label">${c[1]}</div><div class="stat-sub">${c[2]}</div></div>`
    ).join('');

    // Year heatmap (all habits combined)
    const dayCounts = {};
    habits.forEach(h => yearLogs(h).forEach(d => dayCounts[d] = (dayCounts[d] || 0) + 1));
    let cells = '<div class="heat-cell empty"></div>'.repeat(yStart.getDay());
    for (let t = new Date(yStart); t <= yEnd; t.setDate(t.getDate() + 1)) {
        const ds = `${t.getFullYear()}-${p2(t.getMonth() + 1)}-${p2(t.getDate())}`;
        const n = dayCounts[ds] || 0;
        const lvl = ds > todayStr ? 'future' : n === 0 ? '0' : Math.min(4, Math.ceil(4 * n / habits.length));
        cells += `<div class="heat-cell l${lvl}" title="${ds}: ${n}/${habits.length} habits"></div>`;
    }
    const heatWrap = document.getElementById('heatmapWrap');
    heatWrap.innerHTML = `<div class="heat-grid">${cells}</div>`;
    if (viewYear === thisYear) {
        const col = Math.floor((yStart.getDay() + Math.round((new Date(thisYear, thisMonth, now.getDate()) - yStart) / DAY_MS)) / 7);
        heatWrap.scrollLeft = Math.max(0, col * 16 - heatWrap.clientWidth + 60);
    } else heatWrap.scrollLeft = 0;

    // Monthly trend (+ previous year for comparison)
    const prev = new Array(12).fill(0);
    habits.forEach(h => h.logs.forEach(d => { if (d.startsWith((viewYear - 1) + '-')) prev[parseInt(d.slice(5, 7), 10) - 1]++; }));
    const datasets = [{
        label: String(viewYear), tension: 0.35, fill: true, borderColor: accent,
        backgroundColor: 'rgba(139,92,246,0.18)', pointRadius: 3,
        data: monthCounts.map((v, i) => viewYear === thisYear && i > thisMonth ? null : v)
    }];
    if (prev.some(v => v > 0)) datasets.push({
        label: String(viewYear - 1), tension: 0.35, borderColor: '#94a3b8',
        borderDash: [5, 5], pointRadius: 0, data: prev
    });
    if (trendChart) trendChart.destroy();
    trendChart = new Chart(document.getElementById('trendChart').getContext('2d'), {
        type: 'line', data: { labels: months, datasets },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { display: datasets.length > 1 } } }
    });

    // Weekday breakdown
    const wd = new Array(7).fill(0);
    stats.forEach(s => s.logs.forEach(d => wd[new Date(d + 'T00:00:00').getDay()]++));
    const order = [1, 2, 3, 4, 5, 6, 0];
    if (weekdayChart) weekdayChart.destroy();
    weekdayChart = new Chart(document.getElementById('weekdayChart').getContext('2d'), {
        type: 'bar',
        data: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], datasets: [{ data: order.map(i => wd[i]), backgroundColor: accent, borderRadius: 6 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });

    // Category split
    const catTotals = {};
    stats.forEach(s => catTotals[s.h.category] = (catTotals[s.h.category] || 0) + s.count);
    if (categoryChart) categoryChart.destroy();
    categoryChart = new Chart(document.getElementById('categoryPieChart').getContext('2d'), {
        type: 'doughnut',
        data: { labels: Object.keys(catTotals), datasets: [{ data: Object.values(catTotals), backgroundColor: ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#14b8a6', '#f43f5e'], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });

    // Per-habit cards
    document.getElementById('individualHabitAnalytics').innerHTML = stats.map(s => `
        <div class="individual-chart-card">
            <div class="individual-chart-title">
                <strong style="color:${s.h.color}">${s.h.name}</strong>
                <span class="tag-badge">${s.h.category}</span>
            </div>
            <div class="habit-chips">
                <span class="count-badge">${s.count} in ${viewYear}</span>
                <span class="count-badge">${s.rate}% rate</span>
                <span class="streak-badge active-streak">🔥 ${s.cur}d</span>
                <span class="streak-badge longest-streak">🏆 ${s.best}d</span>
            </div>
            <div class="individual-chart-wrapper"><canvas id="chart-habit-${s.h.id}"></canvas></div>
        </div>`).join('');

    stats.forEach(s => {
        const counts = new Array(12).fill(0);
        s.logs.forEach(d => counts[parseInt(d.slice(5, 7), 10) - 1]++);
        if (habitCharts[s.h.id]) habitCharts[s.h.id].destroy();
        habitCharts[s.h.id] = new Chart(document.getElementById(`chart-habit-${s.h.id}`).getContext('2d'), {
            type: 'bar',
            data: { labels: months, datasets: [{ data: counts, backgroundColor: s.h.color, borderRadius: 4 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
        });
    });
}

function renderAll() {
    renderMetrics();
    renderHabits();
}

// ===== Backup & Restore =====
function openBackupModal() {
    const totalLogs = habits.reduce((sum, h) => sum + h.logs.length, 0);
    document.getElementById('backupStatus').innerText =
        `Currently stored in this app: ${habits.length} habits, ${totalLogs} completions.`;
    document.getElementById('backupModal').classList.add('active');
}

function closeBackupModal() {
    document.getElementById('backupModal').classList.remove('active');
}

function buildBackupObject() {
    return {
        app: 'habit-tracker',
        version: 1,
        exportedAt: new Date().toISOString(),
        habits,
        categories,
        // Raw copy of everything stored by this app, as an extra safety net
        rawStorage: Object.fromEntries(
            Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])
        )
    };
}

async function exportBackup() {
    const json = JSON.stringify(buildBackupObject(), null, 2);
    const stamp = new Date().toISOString().slice(0, 10);
    const fileName = `habit-tracker-backup-${stamp}.json`;

    // Preferred on iPhone: share sheet -> "Save to Files"
    try {
        const file = new File([json], fileName, { type: 'application/json' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: fileName });
            return;
        }
    } catch (err) {
        if (err && err.name === 'AbortError') return; // user closed the share sheet
        console.log('Share failed, falling back to download:', err);
    }

    // Fallback: normal file download
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyBackupToClipboard() {
    try {
        await navigator.clipboard.writeText(JSON.stringify(buildBackupObject(), null, 2));
        alert('Backup copied. Paste it into Notes or a message to yourself and keep it safe.');
    } catch (err) {
        alert('Could not copy automatically. Please use "Export backup file" instead.');
    }
}

function importBackupFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        try {
            const data = JSON.parse(reader.result);
            if (!data || !Array.isArray(data.habits)) throw new Error('No habits found');
            const valid = data.habits.every(h =>
                h && typeof h.name === 'string' && Array.isArray(h.logs) && h.id !== undefined);
            if (!valid) throw new Error('Habit entries are malformed');

            const importedCats = Array.isArray(data.categories) ? data.categories : [];
            const totalLogs = data.habits.reduce((sum, h) => sum + h.logs.length, 0);

            const ok = confirm(
                `This backup contains ${data.habits.length} habits and ${totalLogs} completions.\n\n` +
                `Importing will REPLACE the data currently in the app. ` +
                `A safety copy of the current data is saved automatically.\n\nContinue?`
            );
            if (!ok) return;

            localStorage.setItem('habits_before_import', JSON.stringify({
                savedAt: new Date().toISOString(),
                habits,
                categories
            }));

            habits = data.habits;
            categories = importedCats.length ? importedCats : categories;
            habits.forEach(h => {
                if (h.category && !categories.includes(h.category)) categories.push(h.category);
            });

            saveData();
            populateCategories();
            renderAll();
            closeBackupModal();
            alert('Import complete.');
        } catch (err) {
            alert('That file is not a valid backup. Nothing was changed.');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// Ask the browser to protect stored data from automatic cleanup
if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
}

// Initial Setup
updateYearControls();
populateCategories();
renderAll();
