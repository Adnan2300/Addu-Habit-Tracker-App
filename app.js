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
let draggedItemIndex = null;

// Clock & Full Date Display
function updateClockAndDate() {
    const now = new Date();
    
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    document.getElementById('clock').innerText = `${hours}:${minutes}:${seconds}.${ms}`;

    const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    document.getElementById('dateDisplay').innerText = now.toLocaleDateString('en-US', options);
}
setInterval(updateClockAndDate, 30);

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
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

// Drag & Drop Reordering Handlers
function handleDragStart(e, index) {
    draggedItemIndex = index;
    e.dataTransfer.effectAllowed = 'move';
    e.target.classList.add('dragging');
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
    const card = e.target.closest('.habit-card');
    if (card) card.classList.add('drag-over');
}

function handleDragLeave(e) {
    const card = e.target.closest('.habit-card');
    if (card) card.classList.remove('drag-over');
}

function handleDrop(e, targetIndex) {
    e.preventDefault();
    e.stopPropagation();

    if (draggedItemIndex === null || draggedItemIndex === targetIndex) return;

    // Reorder habits array
    const draggedItem = habits.splice(draggedItemIndex, 1)[0];
    habits.splice(targetIndex, 0, draggedItem);

    draggedItemIndex = null;
    saveData();
    renderHabits();
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    document.querySelectorAll('.habit-card').forEach(card => card.classList.remove('drag-over'));
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

function renderHabits() {
    const search = document.getElementById('searchFilter').value.toLowerCase();
    const category = document.getElementById('categoryFilter').value;

    const container = document.getElementById('habitsList');
    const now = new Date();
    const currentYear = now.getFullYear();
    const todayStr = `${currentYear}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Check if filtering is active (disable reordering UI when filtered)
    const isFiltered = search !== '' || category !== 'All';

    container.innerHTML = habits.map((h, index) => {
        const matchesSearch = h.name.toLowerCase().includes(search);
        const matchesCat = category === 'All' || h.category === category;

        if (!matchesSearch || !matchesCat) return '';

        let monthColumnsHtml = '';
        const streakStats = calculateStreakStats(h.logs);
        const totalCompletions = h.logs.length;
        
        months.forEach((mName, mIdx) => {
            const daysInMonth = new Date(currentYear, mIdx + 1, 0).getDate();
            let dayBoxesHtml = '';

            for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${currentYear}-${String(mIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const isDone = h.logs.includes(dateStr);
                const isFuture = dateStr > todayStr;

                dayBoxesHtml += `<div class="day-box ${isDone ? 'active' : ''} ${isFuture ? 'future-disabled' : ''}" 
                    style="${isDone ? `background:${h.color} !important;` : ''}"
                    title="${isFuture ? dateStr + ' (Future date - locked)' : dateStr}" 
                    onclick="toggleHabitDay(${h.id}, '${dateStr}', ${isFuture})"></div>`;
            }

            monthColumnsHtml += `
                <div class="month-column">
                    <div class="month-name">${mName}</div>
                    <div class="days-flex">${dayBoxesHtml}</div>
                </div>
            `;
        });

        return `
            <div class="habit-card" 
                draggable="${!isFiltered}" 
                ondragstart="handleDragStart(event, ${index})"
                ondragover="handleDragOver(event)"
                ondragenter="handleDragEnter(event)"
                ondragleave="handleDragLeave(event)"
                ondrop="handleDrop(event, ${index})"
                ondragend="handleDragEnd(event)">
                <div class="habit-header">
                    <div class="habit-title-wrapper">
                        ${!isFiltered ? `<span class="drag-handle" title="Drag to reorder">⋮⋮</span>` : ''}
                        <strong style="font-size:1rem; margin-right:4px;">${h.name}</strong>
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
}

function renderMetrics() {
    let total = 0;
    habits.forEach(h => total += h.logs.length);

    document.getElementById('totalCompletions').innerText = total;
    document.getElementById('activeHabitsCount').innerText = habits.length;
}

// Detailed Data Visualizations Modal
function renderDetailedAnalytics() {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();

    const categoryTotals = {};
    habits.forEach(h => {
        categoryTotals[h.category] = (categoryTotals[h.category] || 0) + h.logs.length;
    });

    const catCtx = document.getElementById('categoryPieChart').getContext('2d');
    if (categoryChart) categoryChart.destroy();
    
    categoryChart = new Chart(catCtx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(categoryTotals),
            datasets: [{
                data: Object.values(categoryTotals),
                backgroundColor: ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#6366f1']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } }
        }
    });

    const habitsContainer = document.getElementById('individualHabitAnalytics');
    habitsContainer.innerHTML = habits.map(h => `
        <div class="individual-chart-card">
            <div class="individual-chart-title">
                <strong style="color:${h.color}">${h.name}</strong>
                <span class="tag-badge">${h.category}</span>
            </div>
            <div class="individual-chart-wrapper">
                <canvas id="chart-habit-${h.id}"></canvas>
            </div>
        </div>
    `).join('');

    habits.forEach(h => {
        const monthlyCounts = new Array(12).fill(0);
        h.logs.forEach(dateStr => {
            const parts = dateStr.split('-');
            if (parseInt(parts[0]) === currentYear) {
                const monthIndex = parseInt(parts[1]) - 1;
                monthlyCounts[monthIndex]++;
            }
        });

        const canvas = document.getElementById(`chart-habit-${h.id}`);
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (habitCharts[h.id]) habitCharts[h.id].destroy();

        habitCharts[h.id] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: months,
                datasets: [{
                    label: 'Completions',
                    data: monthlyCounts,
                    backgroundColor: h.color,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
            }
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
populateCategories();
renderAll();