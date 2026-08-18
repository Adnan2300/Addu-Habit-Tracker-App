document.addEventListener('DOMContentLoaded', () => {
  const currentDateEl = document.getElementById('current-date');
  const habitForm = document.getElementById('add-habit-form');
  const habitInput = document.getElementById('habit-input');
  const habitList = document.getElementById('habit-list');

  const today = new Date().toISOString().split('T')[0];
  currentDateEl.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  let habits = JSON.parse(localStorage.getItem('my_habits')) || [];

  function saveHabits() {
    localStorage.setItem('my_habits', JSON.stringify(habits));
    renderHabits();
  }

  function calculateStreak(habit) {
    if (!habit.completedDates.length) return 0;
    
    const sorted = [...habit.completedDates].sort().reverse();
    let streak = 0;
    let checkDate = new Date();

    // Check if done today or yesterday to keep streak alive
    const todayStr = checkDate.toISOString().split('T')[0];
    checkDate.setDate(checkDate.getDate() - 1);
    const yesterdayStr = checkDate.toISOString().split('T')[0];

    if (!sorted.includes(todayStr) && !sorted.includes(yesterdayStr)) {
      return 0;
    }

    let cursor = new Date(sorted.includes(todayStr) ? todayStr : yesterdayStr);
    while (true) {
      const dateStr = cursor.toISOString().split('T')[0];
      if (sorted.includes(dateStr)) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }

  function renderHabits() {
    habitList.innerHTML = '';
    
    habits.forEach((habit, index) => {
      const isCompletedToday = habit.completedDates.includes(today);
      const streak = calculateStreak(habit);

      const card = document.createElement('div');
      card.className = 'habit-card';
      card.innerHTML = `
        <div class="habit-info">
          <h3>${habit.name}</h3>
          <p>🔥 ${streak} day streak</p>
        </div>
        <div class="habit-actions">
          <button class="check-btn ${isCompletedToday ? 'completed' : ''}" onclick="toggleHabit(${index})">✓</button>
          <button class="delete-btn" onclick="deleteHabit(${index})">✕</button>
        </div>
      `;
      habitList.appendChild(card);
    });
  }

  window.toggleHabit = (index) => {
    const habit = habits[index];
    const dateIndex = habit.completedDates.indexOf(today);

    if (dateIndex > -1) {
      habit.completedDates.splice(dateIndex, 1);
    } else {
      habit.completedDates.push(today);
    }
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
      habits.push({ name, completedDates: [] });
      habitInput.value = '';
      saveHabits();
    }
  });

  renderHabits();
});