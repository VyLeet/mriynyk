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
const STORAGE_QUIZ = "ragQuizQuestions";

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
let ragOutputValue = "";
const quizCard = document.querySelector("#quiz-card");
let quizQuestions = [];
let quizAttemptIndex = 0;

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
const quizByStudent = () => loadStorage(STORAGE_QUIZ, {});

const setListMessage = (container, message) => {
  container.innerHTML = "";
  const note = document.createElement("div");
  note.className = "muted";
  note.textContent = message;
  container.appendChild(note);
};

const escapeHtml = (value) =>
  value.replace(/[&<>"']/g, (char) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[char] ?? char;
  });

const formatInlineMarkdown = (value) => {
  let text = escapeHtml(value);
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  text = text.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  return text;
};

const buildMarkdownBlocks = (input) => {
  const raw = String(input ?? "");
  if (!raw.trim()) {
    return [];
  }

  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const output = [];
  let paragraph = [];
  let listType = null;
  let codeBlock = null;
  let codeLang = "";

  const flushParagraph = () => {
    if (!paragraph.length) {
      return;
    }
    const text = paragraph.map((line) => formatInlineMarkdown(line)).join("<br />");
    output.push(`<p>${text}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!listType) {
      return;
    }
    output.push(`</${listType}>`);
    listType = null;
  };

  const openList = (type) => {
    if (listType === type) {
      return;
    }
    flushList();
    listType = type;
    output.push(`<${type}>`);
  };

  const closeCodeBlock = () => {
    const codeText = escapeHtml(codeBlock.join("\n"));
    const langClass = codeLang ? ` class="language-${escapeHtml(codeLang)}"` : "";
    output.push(`<pre><code${langClass}>${codeText}</code></pre>`);
    codeBlock = null;
    codeLang = "";
  };

  lines.forEach((line) => {
    if (codeBlock) {
      if (line.trim().startsWith("```")) {
        closeCodeBlock();
        return;
      }
      codeBlock.push(line);
      return;
    }

    if (line.trim().startsWith("```")) {
      flushParagraph();
      flushList();
      codeBlock = [];
      codeLang = line.trim().slice(3).trim();
      return;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      return;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      output.push(`<h${level}>${formatInlineMarkdown(heading[2])}</h${level}>`);
      return;
    }

    const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ordered) {
      flushParagraph();
      openList("ol");
      output.push(`<li>${formatInlineMarkdown(ordered[1])}</li>`);
      return;
    }

    const unordered = line.match(/^\s*[-*]\s+(.*)$/);
    if (unordered) {
      flushParagraph();
      openList("ul");
      output.push(`<li>${formatInlineMarkdown(unordered[1])}</li>`);
      return;
    }

    if (listType) {
      flushList();
    }
    paragraph.push(line);
  });

  if (codeBlock) {
    closeCodeBlock();
  }

  flushParagraph();
  flushList();

  return output;
};

const renderMarkdown = (input) => buildMarkdownBlocks(input).join("");

const stripHtml = (value) =>
  String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&[^;]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const buildPagedBlocks = (blocks, minChars = 100) => {
  const pages = [];
  let current = [];
  let currentLength = 0;

  blocks.forEach((block) => {
    const blockLength = stripHtml(block).length;
    if (current.length === 0 && blockLength >= minChars) {
      pages.push(block);
      current = [];
      currentLength = 0;
      return;
    }
    current.push(block);
    currentLength += blockLength;
    if (currentLength >= minChars) {
      pages.push(current.join('<div class="workbook-break"></div>'));
      current = [];
      currentLength = 0;
    }
  });

  if (current.length) {
    pages.push(current.join('<div class="workbook-break"></div>'));
  }

  return pages;
};

const createModePicker = () => {
  const picker = document.createElement("div");
  picker.className = "mode-picker";
  picker.setAttribute("role", "group");
  picker.setAttribute("aria-label", "Режим читання");

  const modes = [
    {
      id: "full",
      label: "Повний текст",
      icon: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6h12M6 10h12M6 14h8M6 18h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        </svg>
      `,
    },
    {
      id: "single",
      label: "По абзацу",
      icon: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6h12M6 10h6M6 14h12M6 18h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          <rect x="12.5" y="9" width="5" height="4" rx="1.2" fill="currentColor" />
        </svg>
      `,
    },
    {
      id: "tiktok",
      label: "TikTok режим",
      icon: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="7" y="4" width="10" height="16" rx="2.5" stroke="currentColor" stroke-width="1.6" fill="none" />
          <path d="M10 10.5l4 2-4 2z" fill="currentColor" />
        </svg>
      `,
    },
  ];

  const buttons = new Map();

  modes.forEach((mode) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mode-btn";
    button.dataset.mode = mode.id;
    button.setAttribute("aria-label", mode.label);
    button.setAttribute("aria-pressed", "false");
    button.innerHTML = mode.icon;
    picker.appendChild(button);
    buttons.set(mode.id, button);
  });

  const rsvpToggleLabel = document.createElement("label");
  rsvpToggleLabel.className = "rsvp-toggle-label";
  rsvpToggleLabel.textContent = "RSVP";
  const rsvpToggle = document.createElement("input");
  rsvpToggle.type = "checkbox";
  rsvpToggle.id = "rsvp-toggle";
  rsvpToggleLabel.appendChild(rsvpToggle);
  picker.appendChild(rsvpToggleLabel);

  return { picker, buttons, rsvpToggle };
};

const clampIndex = (index, total) =>
  Math.max(0, Math.min(index, Math.max(0, total - 1)));

const createSingleParagraphView = (pages) => {
  const container = document.createElement("div");
  container.className = "workbook-mode workbook-mode--single is-hidden";

  const nav = document.createElement("div");
  nav.className = "workbook-nav";
  const prev = document.createElement("button");
  prev.type = "button";
  prev.className = "workbook-nav-btn";
  prev.textContent = "<";
  prev.setAttribute("aria-label", "Попередній абзац");
  const next = document.createElement("button");
  next.type = "button";
  next.className = "workbook-nav-btn";
  next.textContent = ">";
  next.setAttribute("aria-label", "Наступний абзац");
  nav.append(prev, next);

  const content = document.createElement("div");
  content.className = "workbook-paragraph markdown-body";
  container.append(nav, content);

  let activeIndex = 0;
  const update = () => {
    if (!pages.length) {
      content.innerHTML = "<p>Текст поки відсутній.</p>";
      prev.disabled = true;
      next.disabled = true;
      return;
    }
    activeIndex = clampIndex(activeIndex, pages.length);
    content.innerHTML = pages[activeIndex];
    prev.disabled = activeIndex === 0;
    next.disabled = activeIndex >= pages.length - 1;
  };

  prev.addEventListener("click", () => {
    activeIndex = clampIndex(activeIndex - 1, pages.length);
    update();
  });
  next.addEventListener("click", () => {
    activeIndex = clampIndex(activeIndex + 1, pages.length);
    update();
  });

  update();

  return { element: container, update, setIndex: (index) => {
    activeIndex = clampIndex(index, pages.length);
    update();
  } };
};

const createTikTokView = (pages, meta) => {
  const container = document.createElement("div");
  container.className = "workbook-mode workbook-mode--tiktok is-hidden";

  const shell = document.createElement("div");
  shell.className = "tiktok-shell";
  shell.setAttribute("role", "region");
  shell.setAttribute("aria-label", "TikTok режим читання");

  const screen = document.createElement("div");
  screen.className = "tiktok-screen";

  const content = document.createElement("div");
  content.className = "tiktok-content markdown-body";

  const description = document.createElement("div");
  description.className = "tiktok-description";
  const descTitle = document.createElement("div");
  descTitle.className = "tiktok-title";
  descTitle.textContent = meta.title || "Персоналізований конспект";
  const descMeta = document.createElement("div");
  descMeta.className = "tiktok-meta";
  descMeta.textContent = meta.subtitle || "";
  description.append(descTitle, descMeta);

  const actions = document.createElement("div");
  actions.className = "tiktok-actions";
  actions.innerHTML = `
    <button class="tiktok-action" type="button" aria-label="Лайк">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20.5l-7.2-7.1a4.5 4.5 0 0 1 6.4-6.4l.8.8.8-.8a4.5 4.5 0 0 1 6.4 6.4z" fill="currentColor" />
      </svg>
    </button>
    <button class="tiktok-action" type="button" aria-label="Коментар">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 6h14v9H9l-4 3z" fill="currentColor" />
      </svg>
    </button>
    <button class="tiktok-action" type="button" aria-label="Поділитися">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14 5l5 5-5 5v-3H8v-4h6z" fill="currentColor" />
      </svg>
    </button>
  `;

  screen.append(content, description, actions);

  const tabbar = document.createElement("div");
  tabbar.className = "tiktok-tabbar";
  tabbar.innerHTML = `
    <button type="button" class="tiktok-tab is-active">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 11.5l8-6 8 6v7H4z" fill="currentColor" />
      </svg>
      <span>Головна</span>
    </button>
    <button type="button" class="tiktok-tab">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="6" stroke="currentColor" stroke-width="2" fill="none" />
        <path d="M16.5 16.5l3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
      <span>Пошук</span>
    </button>
    <button type="button" class="tiktok-tab tiktok-upload">
      <span>+</span>
    </button>
    <button type="button" class="tiktok-tab">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 6h12v8H9l-3 3z" fill="currentColor" />
      </svg>
      <span>Вхідні</span>
    </button>
    <button type="button" class="tiktok-tab">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="9" r="4" fill="currentColor" />
        <path d="M5 20a7 7 0 0 1 14 0z" fill="currentColor" />
      </svg>
      <span>Я</span>
    </button>
  `;

  shell.append(screen, tabbar);
  container.appendChild(shell);

  let activeIndex = 0;
  let lastSwipe = 0;
  const swipeCooldown = 450;

  const update = () => {
    if (!pages.length) {
      content.innerHTML = "<p>Текст поки відсутній.</p>";
      return;
    }
    activeIndex = clampIndex(activeIndex, pages.length);
    content.innerHTML = pages[activeIndex];
    shell.dataset.edgeTop = activeIndex === 0 ? "true" : "false";
    shell.dataset.edgeBottom = activeIndex >= pages.length - 1 ? "true" : "false";
  };

  const step = (direction) => {
    if (direction === 0 || !pages.length) {
      return;
    }
    const nextIndex = clampIndex(activeIndex + direction, pages.length);
    if (nextIndex === activeIndex) {
      return;
    }
    activeIndex = nextIndex;
    update();
  };

  const onWheel = (event) => {
    const now = Date.now();
    if (now - lastSwipe < swipeCooldown) {
      return;
    }
    if (Math.abs(event.deltaY) < 18) {
      return;
    }
    event.preventDefault();
    lastSwipe = now;
    step(event.deltaY > 0 ? 1 : -1);
  };

  let touchStartY = null;
  const onTouchStart = (event) => {
    touchStartY = event.touches[0]?.clientY ?? null;
  };
  const onTouchEnd = (event) => {
    if (touchStartY === null) {
      return;
    }
    const endY = event.changedTouches[0]?.clientY ?? touchStartY;
    const delta = touchStartY - endY;
    if (Math.abs(delta) < 40) {
      touchStartY = null;
      return;
    }
    step(delta > 0 ? 1 : -1);
    touchStartY = null;
  };

  shell.addEventListener("wheel", onWheel, { passive: false });
  shell.addEventListener("touchstart", onTouchStart, { passive: true });
  shell.addEventListener("touchend", onTouchEnd);

  update();

  return { element: container, update, setIndex: (index) => {
    activeIndex = clampIndex(index, pages.length);
    update();
  } };
};

const shuffleArray = (items) => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
};

const selectQuizStartIndex = (total, attemptIndex) => {
  if (attemptIndex === 0) {
    return 0;
  }
  if (total <= 5) {
    return 0;
  }
  if (total >= 10) {
    return 5;
  }
  return Math.max(0, total - 5);
};

const renderQuizCard = (attemptIndex) => {
  if (!quizCard) {
    return;
  }
  const questions = Array.isArray(quizQuestions) ? quizQuestions : [];
  quizCard.innerHTML = "";
  quizCard.dataset.quizMode = "true";

  const head = document.createElement("div");
  head.className = "card-head";
  const headInfo = document.createElement("div");
  const eyebrow = document.createElement("div");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Вправи";
  const title = document.createElement("h3");
  title.textContent = "Закріплення теми";
  headInfo.append(eyebrow, title);
  head.appendChild(headInfo);
  quizCard.appendChild(head);

  if (questions.length === 0) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "Питання до останнього конспекту не збережені. Надішліть його ще раз.";
    quizCard.appendChild(empty);
    return;
  }

  const startIndex = selectQuizStartIndex(questions.length, attemptIndex);
  const selected = questions.slice(startIndex, startIndex + 5);
  const stack = document.createElement("div");
  stack.className = "quiz-stack";

  selected.forEach((question, index) => {
    const block = document.createElement("div");
    block.className = "quiz-question";
    const questionTitle = document.createElement("div");
    questionTitle.className = "quiz-question-title";
    questionTitle.textContent = `${startIndex + index + 1}. ${question.text ?? ""}`;
    block.appendChild(questionTitle);

    const options = Array.isArray(question.options) ? question.options : [];
    const optionsWrap = document.createElement("div");
    optionsWrap.className = "quiz-options";
    const shuffledOptions = shuffleArray(
      options.map((text, optionIndex) => ({
        text,
        isCorrect: optionIndex === 0,
      }))
    );

    shuffledOptions.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "quiz-option";
      button.textContent = option.text ?? "";
      button.dataset.correct = option.isCorrect ? "true" : "false";
      button.addEventListener("click", () => {
        if (block.dataset.answered === "true") {
          return;
        }
        block.dataset.answered = "true";
        const buttons = optionsWrap.querySelectorAll(".quiz-option");
        buttons.forEach((btn) => {
          const isCorrect = btn.dataset.correct === "true";
          if (isCorrect) {
            btn.classList.add("is-correct");
          }
          btn.disabled = true;
        });
        if (button.dataset.correct !== "true") {
          button.classList.add("is-wrong");
        }
      });
      optionsWrap.appendChild(button);
    });

    block.appendChild(optionsWrap);
    stack.appendChild(block);
  });

  quizCard.appendChild(stack);

  const actions = document.createElement("div");
  actions.className = "card-actions";
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "btn ghost";
  retry.textContent = "Перепройти";
  retry.addEventListener("click", () => {
    quizAttemptIndex = quizAttemptIndex === 0 ? 1 : 0;
    renderQuizCard(quizAttemptIndex);
  });
  actions.appendChild(retry);
  quizCard.appendChild(actions);
};

const startQuiz = () => {
  quizAttemptIndex = 0;
  renderQuizCard(quizAttemptIndex);
};

const setMarkdownContent = (container, value) => {
  const text = String(value ?? "");
  container.innerHTML = renderMarkdown(text);
  container.classList.toggle("is-empty", !text.trim());
  return text;
};

const setRagOutput = (value) => {
  ragOutputValue = setMarkdownContent(ragOutput, value);
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
    quizQuestions = [];
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
    const quizzes = quizByStudent();
    studentMessageCount.textContent = messages.length;
    quizQuestions = quizzes[messageKey] ?? messages[0]?.quizQuestions ?? [];
    if (quizCard?.dataset.quizMode === "true") {
      renderQuizCard(quizAttemptIndex);
    }

    renderList(studentMessages, messages, "Повідомлень поки немає.", (message) => {
      const card = document.createElement("div");
      card.className = "message-card";
      const title = document.createElement("strong");
      title.textContent = message.topic || "Тема без назви";
      const meta = document.createElement("div");
      meta.className = "message-meta";
      const metaText = [message.subject, formatDate(message.createdAt)].filter(Boolean).join(" • ");
      meta.textContent = metaText;

      const blocks = buildMarkdownBlocks(message.output ?? "");
      const pages = buildPagedBlocks(blocks, 100);
      const { picker, buttons, rsvpToggle } = createModePicker();

      const workbook = document.createElement("div");
      workbook.className = "workbook";

      const fullView = document.createElement("div");
      fullView.className = "workbook-mode workbook-mode--full markdown-body";
      fullView.innerHTML = blocks.join("");

      const singleView = createSingleParagraphView(pages);
      const tiktokView = createTikTokView(pages, {
        title: message.topic || "Персоналізований конспект",
        subtitle: metaText,
      });

      const views = {
        full: fullView,
        single: singleView.element.querySelector(".workbook-paragraph"),
        tiktok: tiktokView.element.querySelector(".tiktok-content"),
      };

      let rsvpState = {
        intervalId: null,
        wordPositions: [],
        highlighter: null,
        container: null,
      };

      const createRsvpHighlighter = (container) => {
        let highlighter = container.querySelector('.rsvp-highlighter');
        if (!highlighter) {
          highlighter = document.createElement('div');
          highlighter.className = 'rsvp-highlighter';
          // Ensure container is a positioning context
          const containerPosition = window.getComputedStyle(container).position;
          if (containerPosition === 'static') {
            container.style.position = 'relative';
          }
          container.appendChild(highlighter);
        }
        return highlighter;
      };

      const calculateWordPositions = (element) => {
        const positions = [];
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while (node = walker.nextNode()) {
          const words = node.textContent.split(/(\s+)/);
          let offset = 0;
          words.forEach(word => {
            if (word.trim() !== '') {
              const range = document.createRange();
              range.setStart(node, offset);
              range.setEnd(node, offset + word.length);
              const rect = range.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                positions.push(rect);
              }
            }
            offset += word.length;
          });
        }
        return positions;
      };

      const getCurrentMode = () => {
        const activeButton = [...buttons].find(([, button]) => button.classList.contains("is-active"));
        return activeButton ? activeButton[0] : "full";
      };

      const stopRsvp = () => {
        if (rsvpState.intervalId) {
          clearInterval(rsvpState.intervalId);
          rsvpState.intervalId = null;
        }
        if (rsvpState.highlighter) {
          rsvpState.highlighter.style.display = 'none';
        }
      };

      const runRsvp = (mode) => {
        stopRsvp(); 

        const view = views[mode];
        if (!view) {
          return;
        }

        rsvpState.container = view;
        rsvpState.wordPositions = calculateWordPositions(view);
        if (rsvpState.wordPositions.length === 0) {
          return;
        }

        rsvpState.highlighter = createRsvpHighlighter(rsvpState.container);
        
        rsvpState.highlighter.style.display = 'block';
        let currentIndex = 0;
        const containerRect = rsvpState.container.getBoundingClientRect();

        rsvpState.intervalId = setInterval(() => {
          if (currentIndex < rsvpState.wordPositions.length) {
            const rect = rsvpState.wordPositions[currentIndex];
            // Position relative to the container
            const top = rect.top - containerRect.top + rsvpState.container.scrollTop;
            const left = rect.left - containerRect.left + rsvpState.container.scrollLeft;

            rsvpState.highlighter.style.top = `${top}px`;
            rsvpState.highlighter.style.left = `${left}px`;
            rsvpState.highlighter.style.width = `${rect.width}px`;
            rsvpState.highlighter.style.height = `${rect.height}px`;
            currentIndex++;
          } else {
            stopRsvp();
            rsvpToggle.checked = false;
          }
        }, 200);
      };

      const setMode = (mode) => {
        const wasRsvpActive = rsvpToggle.checked;
        if (wasRsvpActive) {
          stopRsvp();
        }

        ["full", "single", "tiktok"].forEach((key) => {
          const button = buttons.get(key);
          if (!button) {
            return;
          }
          const isActive = key === mode;
          button.classList.toggle("is-active", isActive);
          button.setAttribute("aria-pressed", String(isActive));
        });
        fullView.classList.toggle("is-hidden", mode !== "full");
        singleView.element.classList.toggle("is-hidden", mode !== "single");
        tiktokView.element.classList.toggle("is-hidden", mode !== "tiktok");
        if (mode === "single") {
          singleView.update();
        }
        if (mode === "tiktok") {
          tiktokView.update();
        }
        
        if (wasRsvpActive) {
          rsvpToggle.checked = true;
          runRsvp(mode);
        }
      };

      buttons.forEach((button) => {
        button.addEventListener("click", () => {
          setMode(button.dataset.mode);
        });
      });

      rsvpToggle.addEventListener("change", () => {
        if (rsvpToggle.checked) {
          runRsvp(getCurrentMode());
        } else {
          stopRsvp();
        }
      });

      // Handle window resize
      window.addEventListener('resize', () => {
        if (rsvpToggle.checked) {
          stopRsvp();
          rsvpToggle.checked = false;
        }
      });
      
      setMode("full");

      workbook.append(picker, fullView, singleView.element, tiktokView.element);
      card.append(title, meta, workbook);
      return card;
    });
  } catch (error) {
    if (requestToken !== studentRequestToken) {
      return;
    }
    studentMessageCount.textContent = "0";
    setListMessage(studentMessages, "Не вдалося завантажити дані.");
    quizQuestions = [];
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
  const output = ragOutputValue.trim();
  if (!output) {
    ragStatus.textContent = "Немає згенерованої відповіді для відправлення.";
    return;
  }

  const message = {
    topic,
    output,
    subject: ragSubject.value,
    quizQuestions: Array.isArray(quizQuestions) ? quizQuestions : [],
    createdAt: new Date().toISOString(),
  };

  const messages = messagesByStudent();
  const messageKey = String(studentId);
  const list = messages[messageKey] ?? [];
  list.unshift(message);
  messages[messageKey] = list.slice(0, 10);
  saveStorage(STORAGE_MESSAGES, messages);
  const quizzes = quizByStudent();
  quizzes[messageKey] = message.quizQuestions;
  saveStorage(STORAGE_QUIZ, quizzes);

  const studentLabel = students.find((student) => String(student.id) === String(studentId))?.label;
  addActivity("RAG-конспект надіслано", `${studentLabel ?? studentId}`);
  ragStatus.textContent = "Конспект надіслано учню.";
  updateStudentView();
};

const clearRagForm = () => {
  ragTopic.value = "";
  ragStudentInfo.value = "";
  setRagOutput("");
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
    setRagOutput(data.result ?? "");
    quizQuestions = data.quiz_questions ?? [];
    ragStatus.textContent = "Відповідь готова до перегляду.";
    addActivity("RAG відповідь згенеровано", `Тема: ${topic}`);
  } catch (error) {
    setRagOutput("");
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
document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const button = target.closest("#quiz-start");
  if (button) {
    startQuiz();
  }
});
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
