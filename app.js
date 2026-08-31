// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.log('SW registration failed:', err));
}

// Initial State from localStorage
let habits = JSON.parse(localStorage.getItem('habits')) || [];
let categories = JSON.parse(localStorage.getItem('categories')) || ['Health', 'Fitness', 'Productivity', 'Mindfulness'];
let habitCharts = {};
let categoryChart = null;

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
    const filterSelect = document.getElementById('categoryFilter');

    datalist.innerHTML = categories.map(c => `<option value="${c}">`).join('');
    filterSelect.innerHTML = '<option value="All">All Categories</option>' + 
        categories.map(c => `<option value="${c}">${c}</option>`).join('');
}

// Modal Control
function openAddModal() {
    document.getElementById('addModal').classList.add('active');
}

function closeAddModal() {
    document.getElementById('addModal').classList.remove('active');
}

function openAnalyticsModal() {
    document.getElementById('analyticsModal').classList.add('active');
    renderDetailedAnalytics();
}

function closeAnalyticsModal() {
    document.getElementById('analyticsModal').classList.remove('active');
}

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

function toggleHabitDay(habitId, dateStr, isFuture) {
    if (isFuture) return; // Prevent checking future dates

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

// Streak Calculations: Returns { currentStreak, longestStreak }
function calculateStreakStats(logs) {
    if (!logs || logs.length === 0) return { currentStreak: 0, longestStreak: 0 };

    // Unique sorted dates in ascending order
    const sortedDatesAsc = [...new Set(logs)]
        .map(d => new Date(d))
        .sort((a, b) => a - b);

    let maxStreak = 0;
    let tempStreak = 0;

    // Calculate Longest Streak anywhere in history
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

    // Calculate Current Active Streak
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

    return {
        currentStreak,
        longestStreak: maxStreak
    };
}

function renderHabits() {
    const search = document.getElementById('searchFilter').value.toLowerCase();
    const category = document.getElementById('categoryFilter').value;

    const filtered = habits.filter(h => {
        const matchesSearch = h.name.toLowerCase().includes(search);
        const matchesCat = category === 'All' || h.category === category;
        return matchesSearch && matchesCat;
    });

    const container = document.getElementById('habitsList');
    const now = new Date();
    const currentYear = now.getFullYear();
    const todayStr = `${currentYear}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    container.innerHTML = filtered.map(h => {
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
            <div class="habit-card">
                <div class="habit-header">
                    <div class="habit-title-wrapper">
                        <strong style="font-size:1rem; margin-right:4px;">${h.name}</strong>
                        <span class="tag-badge">${h.category}</span>
                        <span class="count-badge" title="Total Completions">✔ ${totalCompletions} total</span>
                        <span class="streak-badge ${streakStats.currentStreak > 0 ? 'active-streak' : ''}" title="Current Consecutive Streak">🔥 ${streakStats.currentStreak}d current</span>
                        <span class="streak-badge longest-streak" title="Longest Historical Streak">🏆 ${streakStats.longestStreak}d best</span>
                    </div>
                    <button onclick="deleteHabit(${h.id})" class="delete-icon-btn">🗑</button>
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

// Detailed Data Visualizations (Modal View)
function renderDetailedAnalytics() {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();

    // Tag / Category Breakdown (Pie Chart)
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

    // Individual Habit Visualizations
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

    // Render Each Habit's Monthly Chart
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
                scales: {
                    y: { beginAtZero: true, ticks: { precision: 0 } }
                }
            }
        });
    });
}

function renderAll() {
    renderMetrics();
    renderHabits();
}

// Initial Setup
populateCategories();
renderAll();