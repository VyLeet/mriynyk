let students = [];
const dataCache = new Map();
let teacherRequestToken = 0;
let studentRequestToken = 0;
let overviewRequestToken = 0;
let teacherScoreDates = [];
let teacherScoreDateIndex = 0;
let teacherScoreContextKey = "";
let activeTeacherView = "overview";

const STORAGE_MESSAGES = "ragMessages";
const STORAGE_ACTIVITY = "ragActivity";

const navLinks = Array.from(document.querySelectorAll(".nav-link"));
const modeButtons = Array.from(document.querySelectorAll(".mode-btn"));
const teacherMode = document.querySelector("#teacher-mode");
const studentMode = document.querySelector("#student-mode");
const heroSection = document.querySelector(".hero");
const heroEyebrow = document.querySelector("#hero-eyebrow");
const heroTitle = document.querySelector("#hero-title");
const heroSubtitle = document.querySelector("#hero-subtitle");
const heroPanels = Array.from(document.querySelectorAll("[data-hero-panel]"));
const heroPanelsContainer = document.querySelector("#hero-panels");

const overviewView = document.querySelector("#overview-view");
const studentsView = document.querySelector("#students-view");
const notesView = document.querySelector("#notes-view");

const yearSelect = document.querySelector("#year-select");
const teacherStudentSelect = document.querySelector("#teacher-student-select");
const studentSelfSelect = document.querySelector("#student-self-select");

const teacherMonthlyAbsences = document.querySelector("#teacher-monthly-absences");
const teacherMonthlyAverage = document.querySelector("#teacher-monthly-average");
const teacherStudentEyebrow = document.querySelector("#teacher-student-eyebrow");
const teacherAbsencesList = document.querySelector("#teacher-absences-list");
const teacherScoresList = document.querySelector("#teacher-scores-list");
const scoreTrend = document.querySelector("#score-trend");
const scoresPrev = document.querySelector("#scores-prev");
const scoresNext = document.querySelector("#scores-next");
const scoresDay = document.querySelector("#scores-day");

const overviewAverageChart = document.querySelector("#overview-average-chart");
const overviewAbsencesChart = document.querySelector("#overview-absences-chart");
const topStudentsList = document.querySelector("#top-students-list");
const bottomStudentsList = document.querySelector("#bottom-students-list");

const studentAbsencesCount = document.querySelector("#student-absences-count");
const studentAverageScore = document.querySelector("#student-average-score");
const studentMessages = document.querySelector("#student-messages");
const studentMessageCount = document.querySelector("#student-message-count");
const studentStatus = document.querySelector("#student-status");

const ragSubject = document.querySelector("#rag-subject");
const ragTopic = document.querySelector("#rag-topic");
const ragStudentInfo = document.querySelector("#rag-student-info");
const ragOutput = document.querySelector("#rag-output");
const ragStatus = document.querySelector("#rag-status");
const ragGenerate = document.querySelector("#rag-generate");
const ragSend = document.querySelector("#rag-send");
const ragClear = document.querySelector("#rag-clear");

const activityList = document.querySelector("#activity-list");
const activityClear = document.querySelector("#activity-clear");

const HERO_CONTENT_BY_VIEW = {
  overview: {
    eyebrow: "Огляд",
    title: "Основна статистика",
    subtitle:
      "Оцінюйте успішність, відвідуваність і прогрес класу.",
    panel: "overview",
  },
  students: {
    eyebrow: "Учні",
    title: "Профілі та статистика учнів",
    subtitle: "Переглядайте пропуски, оцінки й динаміку за обраним учнем.",
    panel: "students",
  },
  notes: {
    eyebrow: "Конспект",
    title: "Створюйте персоналізовані коспекти",
    subtitle: "Введіть тему, а ШІ-асистент допоможе створити конспект, підлаштований особисто під конкретного учня.",
    panel: null,
  },
};

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("uk-UA", { month: "short", day: "numeric" }).format(
    date
  );
};

const average = (values) => {
  const numeric = values.filter((value) => Number.isFinite(value));
  if (numeric.length === 0) {
    return 0;
  }
  const total = numeric.reduce((sum, value) => sum + value, 0);
  return Math.round((total / numeric.length) * 10) / 10;
};

const parseDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
};

const filterRecentItems = (items, days) => {
  const datedItems = items
    .map((item) => ({ item, date: parseDate(item.date) }))
    .filter((entry) => entry.date);
  if (datedItems.length === 0) {
    return [];
  }
  const maxTime = Math.max(...datedItems.map((entry) => entry.date.getTime()));
  const cutoff = maxTime - days * 24 * 60 * 60 * 1000;
  return datedItems.filter((entry) => entry.date.getTime() >= cutoff).map((entry) => entry.item);
};

const loadStorage = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch (error) {
    return fallback;
  }
};

const saveStorage = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const messagesByStudent = () => loadStorage(STORAGE_MESSAGES, {});
const activityLog = () => loadStorage(STORAGE_ACTIVITY, []);

const setListMessage = (container, message) => {
  container.innerHTML = "";
  const note = document.createElement("div");
  note.className = "muted";
  note.textContent = message;
  container.appendChild(note);
};

const buildOptions = (select, options, selectedId) => {
  select.innerHTML = "";
  if (options.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Немає учнів";
    option.disabled = true;
    option.selected = true;
    select.appendChild(option);
    return;
  }

  options.forEach((student) => {
    const option = document.createElement("option");
    option.value = String(student.id);
    option.textContent = student.label;
    select.appendChild(option);
  });

  if (selectedId && options.some((student) => String(student.id) === String(selectedId))) {
    select.value = String(selectedId);
  } else {
    select.value = String(options[0].id);
  }
};

const renderList = (container, items, emptyText, formatter) => {
  container.innerHTML = "";
  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }
  items.forEach((item) => container.appendChild(formatter(item)));
};

const updateHero = (view) => {
  if (!heroEyebrow || !heroTitle || !heroSubtitle) {
    return;
  }
  const content = HERO_CONTENT_BY_VIEW[view] ?? HERO_CONTENT_BY_VIEW.overview;
  heroEyebrow.textContent = content.eyebrow;
  heroTitle.textContent = content.title;
  heroSubtitle.textContent = content.subtitle;
  if (!heroPanelsContainer || heroPanels.length === 0) {
    return;
  }
  let hasPanel = false;
  heroPanels.forEach((panel) => {
    const matches = content.panel && panel.dataset.heroPanel === content.panel;
    panel.classList.toggle("is-hidden", !matches);
    if (matches) {
      hasPanel = true;
    }
  });
  heroPanelsContainer.classList.toggle("is-hidden", !hasPanel);
  if (heroSection) {
    heroSection.classList.toggle("is-single", !hasPanel);
  }
};

const buildAbsenceItem = (item) => {
  const row = document.createElement("div");
  row.className = "list-item";
  const left = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = item.subject || "—";
  const subtitle = document.createElement("span");
  subtitle.textContent = item.reason || "—";
  left.append(title, subtitle);
  const meta = document.createElement("span");
  meta.className = "list-meta";
  meta.textContent = item.date ? formatDate(item.date) : "—";
  row.append(left, meta);
  return row;
};

const buildScoreItem = (item) => {
  const row = document.createElement("div");
  row.className = "list-item";
  const left = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = item.subject || "—";
  const hasScore = Number.isFinite(item.score);
  const scoreValue = hasScore ? item.score : "—";
  left.append(title);
  const meta = document.createElement("span");
  meta.className = "list-meta list-meta--value";
  meta.textContent = hasScore ? `${scoreValue} балів` : "—";
  row.append(left, meta);
  return row;
};

const buildStudentItem = (item) => {
  const row = document.createElement("div");
  row.className = "list-item";
  const left = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = item.label;
  const subtitle = document.createElement("span");
  subtitle.textContent = `Середній бал: ${item.average}`;
  left.append(title, subtitle);
  const meta = document.createElement("span");
  meta.textContent = "Учень";
  row.append(left, meta);
  return row;
};

const computeTrend = (scores) => {
  if (scores.length < 4) {
    return 0;
  }
  const recent = average(scores.slice(0, 2));
  const previous = average(scores.slice(2, 4));
  if (previous === 0) {
    return 0;
  }
  return Math.round(((recent - previous) / previous) * 100);
};

const collectScoreDates = (scores) => {
  const dateState = new Map();
  const dateOrder = [];
  scores.forEach((item) => {
    if (!item.date) {
      return;
    }
    let state = dateState.get(item.date);
    if (!state) {
      state = { hasNumeric: false };
      dateState.set(item.date, state);
      dateOrder.push(item.date);
    }
    if (Number.isFinite(item.score)) {
      state.hasNumeric = true;
    }
  });
  return dateOrder.filter((date) => dateState.get(date)?.hasNumeric);
};

const updateScoreNavigation = (dates) => {
  teacherScoreDates = dates;
  if (teacherScoreDateIndex >= dates.length) {
    teacherScoreDateIndex = 0;
  }
  const selectedDate = dates[teacherScoreDateIndex];
  scoresDay.textContent = selectedDate ? formatDate(selectedDate) : "—";
  scoresPrev.disabled = !dates.length || teacherScoreDateIndex >= dates.length - 1;
  scoresNext.disabled = !dates.length || teacherScoreDateIndex <= 0;
  return selectedDate;
};

const buildQueryParams = (subject) => {
  const params = new URLSearchParams();
  const gradeValue = yearSelect.value;
  if (gradeValue) {
    params.set("grade", gradeValue);
  }
  if (subject && subject !== "all") {
    params.set("subject", subject);
  }
  return params;
};

const fetchStudents = async () => {
  const params = buildQueryParams();
  const response = await fetch(`/students?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
};

const fetchStudentData = async (studentId, subject) => {
  const params = buildQueryParams(subject);
  const cacheKey = `${studentId}|${params.toString()}`;
  if (dataCache.has(cacheKey)) {
    return dataCache.get(cacheKey);
  }
  const response = await fetch(`/students/${studentId}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const payload = await response.json();
  dataCache.set(cacheKey, payload);
  return payload;
};

const fetchOverview = async () => {
  const params = buildQueryParams();
  const response = await fetch(`/overview?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
};

const loadStudents = async () => {
  const currentTeacher = teacherStudentSelect.value;
  const currentStudent = studentSelfSelect.value;
  try {
    students = await fetchStudents();
    buildOptions(teacherStudentSelect, students, currentTeacher);
    buildOptions(studentSelfSelect, students, currentStudent);
  } catch (error) {
    students = [];
    buildOptions(teacherStudentSelect, [], null);
    buildOptions(studentSelfSelect, [], null);
  }
};

const renderBarChart = (container, items, valueKey, formatter, options = {}) => {
  container.innerHTML = "";
  if (!items.length) {
    setListMessage(container, "Немає даних для відображення.");
    return;
  }
  const values = items.map((item) => item[valueKey]);
  const resolvedMax =
    Number.isFinite(options.maxValue) && options.maxValue > 0
      ? options.maxValue
      : Math.max(...values, 1);
  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "bar-row";
    const label = document.createElement("div");
    label.className = "bar-label";
    label.textContent = item.subject;
    const track = document.createElement("div");
    track.className = "bar-track";
    const fill = document.createElement("div");
    fill.className = "bar-fill";
    const ratio = resolvedMax > 0 ? item[valueKey] / resolvedMax : 0;
    fill.style.width = `${Math.min(100, Math.round(ratio * 100))}%`;
    track.appendChild(fill);
    const value = document.createElement("div");
    value.className = "bar-value";
    value.textContent = formatter(item[valueKey]);
    row.append(label, track, value);
    container.appendChild(row);
  });
};

const updateOverviewView = async () => {
  const requestToken = (overviewRequestToken += 1);
  setListMessage(overviewAverageChart, "Завантаження...");
  setListMessage(overviewAbsencesChart, "Завантаження...");
  setListMessage(topStudentsList, "Завантаження...");
  setListMessage(bottomStudentsList, "Завантаження...");

  try {
    const data = await fetchOverview();
    if (requestToken !== overviewRequestToken) {
      return;
    }

    const averageScores = [...(data.average_scores ?? [])].sort(
      (a, b) => b.average - a.average
    );
    const absencesBySubject = [...(data.absences_by_subject ?? [])].sort(
      (a, b) => b.count - a.count
    );

    renderBarChart(
      overviewAverageChart,
      averageScores,
      "average",
      (value) => (Number.isFinite(value) ? value.toFixed(1) : "—"),
      { maxValue: 12 }
    );
    renderBarChart(overviewAbsencesChart, absencesBySubject, "count", (value) =>
      Number.isFinite(value) ? String(Math.round(value)) : "—"
    );

    renderList(
      topStudentsList,
      data.top_students ?? [],
      "Немає учнів для відображення.",
      buildStudentItem
    );
    renderList(
      bottomStudentsList,
      data.bottom_students ?? [],
      "Немає учнів для відображення.",
      buildStudentItem
    );
  } catch (error) {
    if (requestToken !== overviewRequestToken) {
      return;
    }
    setListMessage(overviewAverageChart, "Не вдалося завантажити дані.");
    setListMessage(overviewAbsencesChart, "Не вдалося завантажити дані.");
    setListMessage(topStudentsList, "Не вдалося завантажити дані.");
    setListMessage(bottomStudentsList, "Не вдалося завантажити дані.");
  }
};

const updateTeacherView = async () => {
  const studentId = teacherStudentSelect.value;
  const requestToken = (teacherRequestToken += 1);
  const contextKey = `${studentId}|${yearSelect.value}`;
  if (contextKey !== teacherScoreContextKey) {
    teacherScoreContextKey = contextKey;
    teacherScoreDateIndex = 0;
  }

  if (teacherStudentEyebrow) {
    const studentLabel =
      students.find((student) => String(student.id) === String(studentId))?.label ??
      (studentId ? `Учень ${studentId}` : "Учень");
    teacherStudentEyebrow.textContent = studentLabel;
  }
  teacherMonthlyAbsences.textContent = "—";
  teacherMonthlyAverage.textContent = "—";
  scoreTrend.textContent = "—";
  scoreTrend.classList.remove("success", "warning");
  scoresDay.textContent = "—";
  scoresPrev.disabled = true;
  scoresNext.disabled = true;
  setListMessage(teacherAbsencesList, "Завантаження...");
  setListMessage(teacherScoresList, "Завантаження...");

  if (!studentId) {
    setListMessage(teacherAbsencesList, "Немає учня для перегляду.");
    setListMessage(teacherScoresList, "Немає учня для перегляду.");
    return;
  }

  try {
    const data = await fetchStudentData(studentId, null);
    if (requestToken !== teacherRequestToken) {
      return;
    }

    const absences = data.absences ?? [];
    const scores = data.scores ?? [];
    const numericScores = scores
      .map((item) => item.score)
      .filter((score) => Number.isFinite(score));

    const recentAbsences = filterRecentItems(absences, 30);
    const recentScores = filterRecentItems(scores, 30);
    const recentNumericScores = recentScores
      .map((item) => item.score)
      .filter((score) => Number.isFinite(score));

    teacherMonthlyAbsences.textContent = recentAbsences.length;
    teacherMonthlyAverage.textContent = recentNumericScores.length
      ? average(recentNumericScores)
      : "—";

    const scoreDates = collectScoreDates(scores);
    const selectedDate = updateScoreNavigation(scoreDates);
    const scoresForDay = selectedDate
      ? scores.filter((item) => item.date === selectedDate)
      : [];

    const trend = computeTrend(numericScores);
    const showTrend = numericScores.length >= 4;
    scoreTrend.textContent = showTrend ? `${trend >= 0 ? "+" : ""}${trend}%` : "—";
    scoreTrend.classList.toggle("success", showTrend && trend >= 0);
    scoreTrend.classList.toggle("warning", showTrend && trend < 0);

    renderList(
      teacherAbsencesList,
      recentAbsences,
      "Немає пропусків.",
      buildAbsenceItem
    );
    renderList(
      teacherScoresList,
      scoresForDay,
      "Немає оцінок.",
      buildScoreItem
    );
  } catch (error) {
    if (requestToken !== teacherRequestToken) {
      return;
    }
    setListMessage(teacherAbsencesList, "Не вдалося завантажити пропуски.");
    setListMessage(teacherScoresList, "Не вдалося завантажити оцінки.");
    scoresDay.textContent = "—";
    scoresPrev.disabled = true;
    scoresNext.disabled = true;
  }
};

const updateStudentView = async () => {
  const studentId = studentSelfSelect.value;
  const requestToken = (studentRequestToken += 1);

  studentAbsencesCount.textContent = "—";
  studentAverageScore.textContent = "—";
  studentStatus.textContent = "Немає даних";
  studentStatus.classList.remove("warning");

  if (!studentId) {
    studentMessageCount.textContent = "0";
    setListMessage(studentMessages, "Оберіть учня, щоб переглянути повідомлення.");
    return;
  }

  try {
    const data = await fetchStudentData(studentId, null);
    if (requestToken !== studentRequestToken) {
      return;
    }

    const absences = data.absences ?? [];
    const scores = data.scores ?? [];
    const numericScores = scores
      .map((item) => item.score)
      .filter((score) => Number.isFinite(score));
    const scoreAverage = average(numericScores);
    const hasData = absences.length || scores.length;
    const riskLevel = absences.length >= 3 || (numericScores.length && scoreAverage < 7);

    studentAbsencesCount.textContent = absences.length;
    studentAverageScore.textContent = numericScores.length ? scoreAverage : "—";
    studentStatus.textContent = hasData ? (riskLevel ? "Пильність" : "Активний") : "Немає даних";
    studentStatus.classList.toggle("warning", hasData && riskLevel);

    const messageKey = String(studentId);
    const messages = messagesByStudent()[messageKey] ?? [];
    studentMessageCount.textContent = messages.length;

    renderList(studentMessages, messages, "Повідомлень поки немає.", (message) => {
      const card = document.createElement("div");
      card.className = "message-card";
      const title = document.createElement("strong");
      title.textContent = message.topic || "Тема без назви";
      const meta = document.createElement("div");
      meta.className = "message-meta";
      meta.textContent = `${message.subject} • ${formatDate(message.createdAt)}`;
      const body = document.createElement("div");
      body.textContent = message.output;
      card.append(title, meta, body);
      return card;
    });
  } catch (error) {
    if (requestToken !== studentRequestToken) {
      return;
    }
    studentMessageCount.textContent = "0";
    setListMessage(studentMessages, "Не вдалося завантажити дані.");
  }
};

const updateActivity = () => {
  if (!activityList) {
    return;
  }
  const items = activityLog();
  activityList.innerHTML = "";
  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "Активність ще не зафіксована.";
    activityList.appendChild(empty);
    return;
  }
  items.slice(0, 6).forEach((item) => {
    const row = document.createElement("div");
    row.className = "activity-item";
    const left = document.createElement("div");
    const title = document.createElement("div");
    title.className = "activity-title";
    title.textContent = item.title;
    const subtitle = document.createElement("div");
    subtitle.className = "muted";
    subtitle.textContent = item.subtitle;
    left.append(title, subtitle);
    const meta = document.createElement("div");
    meta.className = "activity-meta";
    meta.textContent = formatDate(item.createdAt);
    row.append(left, meta);
    activityList.appendChild(row);
  });
};

const addActivity = (title, subtitle) => {
  const items = activityLog();
  items.unshift({
    title,
    subtitle,
    createdAt: new Date().toISOString(),
  });
  saveStorage(STORAGE_ACTIVITY, items.slice(0, 12));
  if (activityList) {
    updateActivity();
  }
};

const sendRagOutput = () => {
  const studentId = teacherStudentSelect.value;
  const topic = ragTopic.value.trim();
  const output = ragOutput.value.trim();
  if (!output) {
    ragStatus.textContent = "Немає згенерованої відповіді для відправлення.";
    return;
  }

  const message = {
    topic,
    output,
    subject: ragSubject.value,
    createdAt: new Date().toISOString(),
  };

  const messages = messagesByStudent();
  const messageKey = String(studentId);
  const list = messages[messageKey] ?? [];
  list.unshift(message);
  messages[messageKey] = list.slice(0, 10);
  saveStorage(STORAGE_MESSAGES, messages);

  const studentLabel = students.find((student) => String(student.id) === String(studentId))?.label;
  addActivity("RAG-рекомендація надіслана", `${studentLabel ?? studentId}`);
  ragStatus.textContent = "Рекомендацію надіслано учню.";
  updateStudentView();
};

const clearRagForm = () => {
  ragTopic.value = "";
  ragStudentInfo.value = "";
  ragOutput.value = "";
  ragStatus.textContent = "Готові сформувати запит.";
};

const requestRag = async () => {
  const topic = ragTopic.value.trim();
  const studentInfo = ragStudentInfo.value.trim();
  if (!topic) {
    ragStatus.textContent = "Вкажіть тему перед запуском RAG.";
    return;
  }

  ragStatus.textContent = "Генеруємо відповідь...";
  ragGenerate.disabled = true;

  const payload = {
    year: Number(yearSelect.value),
    subject: ragSubject.value,
    topic,
    student_info: studentInfo,
  };

  try {
    const response = await fetch("/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    ragOutput.value = data.result ?? "";
    ragStatus.textContent = "Відповідь готова до перегляду.";
    addActivity("RAG відповідь згенеровано", `Тема: ${topic}`);
  } catch (error) {
    ragOutput.value = "";
    ragStatus.textContent = "Не вдалося звернутися до /answer. Перевірте API.";
  } finally {
    ragGenerate.disabled = false;
  }
};

const setTeacherView = (view) => {
  activeTeacherView = view;
  teacherMode.setAttribute("data-view", view);
  updateHero(view);
  const views = {
    overview: overviewView,
    students: studentsView,
    notes: notesView,
  };
  Object.entries(views).forEach(([key, section]) => {
    section.classList.toggle("is-hidden", key !== view);
  });
  navLinks.forEach((link) => {
    const isActive = link.dataset.view === view;
    link.classList.toggle("active", isActive);
  });
};

const setMode = (mode) => {
  const isTeacher = mode === "teacher";
  teacherMode.classList.toggle("is-hidden", !isTeacher);
  studentMode.classList.toggle("is-hidden", isTeacher);
  navLinks.forEach((link) => {
    link.classList.toggle("is-disabled", !isTeacher);
  });
  modeButtons.forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });
  if (isTeacher) {
    setTeacherView(activeTeacherView);
  }
};

navLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    if (teacherMode.classList.contains("is-hidden")) {
      return;
    }
    const view = link.dataset.view;
    if (view) {
      setTeacherView(view);
    }
  });
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

teacherStudentSelect.addEventListener("change", updateTeacherView);
studentSelfSelect.addEventListener("change", updateStudentView);
yearSelect.addEventListener("change", async () => {
  dataCache.clear();
  teacherScoreDateIndex = 0;
  await loadStudents();
  updateTeacherView();
  updateStudentView();
  updateOverviewView();
});
ragGenerate.addEventListener("click", requestRag);
ragSend.addEventListener("click", sendRagOutput);
ragClear.addEventListener("click", clearRagForm);
if (activityClear) {
  activityClear.addEventListener("click", () => {
    saveStorage(STORAGE_ACTIVITY, []);
    updateActivity();
  });
}

scoresPrev.addEventListener("click", () => {
  if (teacherScoreDateIndex < teacherScoreDates.length - 1) {
    teacherScoreDateIndex += 1;
    updateTeacherView();
  }
});

scoresNext.addEventListener("click", () => {
  if (teacherScoreDateIndex > 0) {
    teacherScoreDateIndex -= 1;
    updateTeacherView();
  }
});

const initialize = async () => {
  await loadStudents();
  setTeacherView(activeTeacherView);
  updateTeacherView();
  updateStudentView();
  updateOverviewView();
  if (activityList) {
    updateActivity();
  }
};

void initialize();
