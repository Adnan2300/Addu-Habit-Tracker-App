let habits = JSON.parse(localStorage.getItem('habits_data')) || [];
let activeFilter = 'All';

// Elements
const habitList = document.getElementById('habit-list');
const habitForm = document.getElementById('add-habit-form');
const calendarBtn = document.getElementById('calendar-btn');
const themeBtn = document.getElementById('theme-btn');
const calendarModal = document.getElementById('calendar-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const calendarGrid = document.getElementById('calendar-grid');

const frequencySelect = document.getElementById('habit-frequency');
const customFrequencyInput = document.getElementById('custom-frequency-input');

// Toggle Custom Frequency Input visibility
frequencySelect.addEventListener('change', () => {
  if (frequencySelect.value === 'Custom') {
    customFrequencyInput.classList.remove('hidden-field');
    customFrequencyInput.required = true;
    customFrequencyInput.focus();
  } else {
    customFrequencyInput.classList.add('hidden-field');
    customFrequencyInput.required = false;
    customFrequencyInput.value = '';
  }
});

// Format date string as YYYY-MM-DD
function getFormattedDate(dateObj = new Date()) {
  return dateObj.toISOString().split('T')[0];
}

const todayStr = getFormattedDate();

// Initialize App
document.getElementById('current-date').innerText = new Date().toLocaleDateString('en-US', {
  weekday: 'long', month: 'short', day: 'numeric'
});

// Add Habit
habitForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = document.getElementById('habit-input').value.trim();
  const category = document.getElementById('habit-category').value.trim() || 'General';
  
  let frequency = frequencySelect.value;
  if (frequency === 'Custom') {
    frequency = customFrequencyInput.value.trim() || 'Custom';
  }

  if (!title) return;

  const newHabit = {
    id: Date.now(),
    title,
    category,
    frequency,
    history: {}
  };

  habits.push(newHabit);
  saveAndRender();
  
  habitForm.reset();
  customFrequencyInput.classList.add('hidden-field');
  customFrequencyInput.required = false;
});

// Toggle Habit Completion
function toggleHabit(id) {
  habits = habits.map(h => {
    if (h.id === id) {
      const updatedHistory = { ...h.history };
      if (updatedHistory[todayStr]) {
        delete updatedHistory[todayStr];
      } else {
        updatedHistory[todayStr] = true;
      }
      return { ...h, history: updatedHistory };
    }
    return h;
  });
  saveAndRender();
}

// Delete Habit
function deleteHabit(id) {
  habits = habits.filter(h => h.id !== id);
  saveAndRender();
}

// Calculate Streaks
function getStreak(history) {
  let streak = 0;
  let checkDate = new Date();
  
  while (true) {
    const dateKey = getFormattedDate(checkDate);
    if (history[dateKey]) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

// Save & Render
function saveAndRender() {
  localStorage.setItem('habits_data', JSON.stringify(habits));
  renderAnalytics();
  renderHabits();
}

function renderAnalytics() {
  document.getElementById('stat-total').innerText = habits.length;
  const completedToday = habits.filter(h => h.history[todayStr]).length;
  document.getElementById('stat-completed').innerText = completedToday;

  let maxStreak = 0;
  habits.forEach(h => {
    const s = getStreak(h.history);
    if (s > maxStreak) maxStreak = s;
  });
  document.getElementById('stat-streak').innerText = maxStreak;
}

function renderHabits() {
  habitList.innerHTML = '';
  const filtered = activeFilter === 'All' ? habits : habits.filter(h => h.category === activeFilter);

  filtered.forEach(habit => {
    const isDone = !!habit.history[todayStr];
    const streak = getStreak(habit.history);

    const card = document.createElement('div');
    card.className = 'habit-card';
    card.innerHTML = `
      <div class="card-header">
        <div>
          <div class="habit-title">${habit.title}</div>
          <div class="badges">
            <span class="badge">${habit.category}</span>
            <span class="badge">${habit.frequency}</span>
            <span class="badge">🔥 ${streak}d streak</span>
          </div>
        </div>
        <div class="card-actions">
          <button class="check-btn ${isDone ? 'completed' : ''}" onclick="toggleHabit(${habit.id})">
            ${isDone ? '✓' : ''}
          </button>
          <button class="delete-btn" onclick="deleteHabit(${habit.id})">✕</button>
        </div>
      </div>
    `;
    habitList.appendChild(card);
  });
}

// Streak Calendar Logic
calendarBtn.addEventListener('click', () => {
  renderCalendar();
  calendarModal.classList.add('active');
});

closeModalBtn.addEventListener('click', () => {
  calendarModal.classList.remove('active');
});

function renderCalendar() {
  calendarGrid.innerHTML = '';
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  document.getElementById('calendar-month-title').innerText = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  dayNames.forEach(d => {
    const header = document.createElement('div');
    header.className = 'cal-day-header';
    header.innerText = d;
    calendarGrid.appendChild(header);
  });

  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(year, month, day);
    const dateStr = getFormattedDate(dateObj);
    const isToday = dateStr === todayStr;

    let totalHabits = habits.length;
    let completedCount = 0;
    habits.forEach(h => {
      if (h.history[dateStr]) completedCount++;
    });

    const cell = document.createElement('div');
    cell.className = `cal-cell ${isToday ? 'today' : ''}`;
    cell.innerText = day;

    if (totalHabits > 0 && completedCount > 0) {
      const statusDot = document.createElement('div');
      statusDot.className = `status-dot ${completedCount === totalHabits ? 'full' : 'partial'}`;
      cell.appendChild(statusDot);
    }

    cell.addEventListener('click', () => {
      document.querySelectorAll('.cal-cell').forEach(c => c.classList.remove('selected'));
      cell.classList.add('selected');
      document.getElementById('selected-date-text').innerText = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      document.getElementById('selected-stats-text').innerText = `Completed ${completedCount} out of ${totalHabits} total habit${totalHabits === 1 ? '' : 's'}.`;
    });

    calendarGrid.appendChild(cell);
  }
}

// Theme Toggle
themeBtn.addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
  themeBtn.innerText = document.body.classList.contains('dark-mode') ? '☀️' : '🌙';
});

saveAndRender();
