document.addEventListener('DOMContentLoaded', () => {
  const currentDateEl = document.getElementById('current-date');
  const habitForm = document.getElementById('add-habit-form');
  const habitInput = document.getElementById('habit-input');
  const habitCategory = document.getElementById('habit-category');
  const habitFrequency = document.getElementById('habit-frequency');
  const habitList = document.getElementById('habit-list');
  const themeToggle = document.getElementById('theme-toggle');
  const filterBar = document.getElementById('filter-bar');
  const exportBtn = document.getElementById('export-btn');
  const importFile = document.getElementById('import-file');

  const today = new Date().toISOString().split('T')[0];
  currentDateEl.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  let habits = JSON.parse(localStorage.getItem('my_habits')) || [];
  let activeCategory = 'All';

  // Theme Init
  if (localStorage.getItem('theme') === 'light') {
    document.body.classList.add('light-mode');
    themeToggle.textContent = '☀️';
  }

  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    themeToggle.textContent = isLight ? '☀️' : '🌙';
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
  });

  function saveHabits() {
    localStorage.setItem('my_habits', JSON.stringify(habits));
    render();
  }

  function calculateStreak(habit) {
    if (!habit.completedDates.length) return 0;
    const sorted = [...habit.completedDates].sort().reverse();
    let streak = 0;
    let checkDate = new Date();

    const todayStr = checkDate.toISOString().split('T')[0];
    checkDate.setDate(checkDate.getDate() - 1);
    const yesterdayStr = checkDate.toISOString().split('T')[0];

    if (!sorted.includes(todayStr) && !sorted.includes(yesterdayStr)) return 0;

    let cursor = new Date(sorted.includes(todayStr) ? todayStr : yesterdayStr);
    while (true) {
      const dateStr = cursor.toISOString().split('T')[0];
      if (sorted.includes(dateStr)) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else break;
    }
    return streak;
  }

  function updateAnalytics() {
    document.getElementById('stat-total').textContent = habits.length;
    const completedToday = habits.filter(h => h.completedDates.includes(today)).length;
    const rate = habits.length ? Math.round((completedToday / habits.length) * 100) : 0;
    document.getElementById('stat-rate').textContent = `${rate}%`;

    const bestStreak = habits.reduce((max, h) => Math.max(max, calculateStreak(h)), 0);
    document.getElementById('stat-best').textContent = bestStreak;
  }

  function renderHeatmap(habit) {
    let html = '<div class="heatmap">';
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'narrow' });
      const isFilled = habit.completedDates.includes(dateStr);

      html += `
        <div class="day-box">
          <span class="day-label">${dayName}</span>
          <div class="dot ${isFilled ? 'filled' : ''}"></div>
        </div>
      `;
    }
    html += '</div>';
    return html;
  }

  function render() {
    updateAnalytics();
    habitList.innerHTML = '';

    const filtered = activeCategory === 'All' 
      ? habits 
      : habits.filter(h => h.category === activeCategory);

    filtered.forEach((habit, index) => {
      const realIndex = habits.indexOf(habit);
      const isCompletedToday = habit.completedDates.includes(today);
      const streak = calculateStreak(habit);

      const card = document.createElement('div');
      card.className = 'habit-card';
      card.innerHTML = `
        <div class="card-header">
          <div>
            <span class="habit-title">${habit.name}</span>
            <div class="badges">
              <span class="badge cat-${habit.category}">${habit.category}</span>
              <span class="badge freq-badge">${habit.frequency || 'Daily'}</span>
            </div>
          </div>
          <div class="card-actions">
            <button class="check-btn ${isCompletedToday ? 'completed' : ''}" onclick="toggleHabit(${realIndex})">✓</button>
            <button class="delete-btn" onclick="deleteHabit(${realIndex})">✕</button>
          </div>
        </div>
        <div style="font-size: 12px; color: var(--text-sub);">🔥 ${streak} day streak</div>
        ${renderHeatmap(habit)}
      `;
      habitList.appendChild(card);
    });
  }

  // Filter Bar Buttons
  filterBar.addEventListener('click', (e) => {
    if (e.target.classList.contains('filter-btn')) {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      activeCategory = e.target.dataset.category;
      render();
    }
  });

  // Export Data
  exportBtn.addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(habits));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `habits_backup_${today}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  });

  // Import Data
  importFile.addEventListener('change', (e) => {
    const fileReader = new FileReader();
    fileReader.onload = (event) => {
      try {
        const importedHabits = JSON.parse(event.target.result);
        if (Array.isArray(importedHabits)) {
          habits = importedHabits;
          saveHabits();
          alert('Data restored successfully!');
        }
      } catch (err) {
        alert('Invalid backup file format.');
      }
    };
    if (e.target.files[0]) fileReader.readAsText(e.target.files[0]);
  });

  window.toggleHabit = (index) => {
    const habit = habits[index];
    const dateIdx = habit.completedDates.indexOf(today);
    if (dateIdx > -1) habit.completedDates.splice(dateIdx, 1);
    else habit.completedDates.push(today);
    saveHabits();
  };

  window.deleteHabit = (index) => {
    habits.splice(index, 1);
    saveHabits();
  };

  habitForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = habitInput.value.trim();
    if (name) {
      habits.push({
        name,
        category: habitCategory.value,
        frequency: habitFrequency.value,
        completedDates: []
      });
      habitInput.value = '';
      saveHabits();
    }
  });

  render();
});