// ====== THEME TOGGLE ======
const themeToggle = document.getElementById("themeToggle");
const htmlElement = document.documentElement;
const savedTheme = localStorage.getItem("theme") || "dark";

function setTheme(theme) {
  if (theme === "light") {
    htmlElement.classList.add("light-theme");
    themeToggle.textContent = "🌙";
    localStorage.setItem("theme", "light");
  } else {
    htmlElement.classList.remove("light-theme");
    themeToggle.textContent = "☀️";
    localStorage.setItem("theme", "dark");
  }
}

setTheme(savedTheme);

themeToggle.addEventListener("click", () => {
  const currentTheme = htmlElement.classList.contains("light-theme") ? "light" : "dark";
  setTheme(currentTheme === "light" ? "dark" : "light");
});

// ====== TABS ======
const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
const tabPanels = Array.from(document.querySelectorAll(".tab-panel"));

const TAB_QUERY_KEY = "tab";
const LANG_QUERY_KEY = "lang";
const SUPPORTED_LANGS = new Set(["vi", "en"]);
const defaultTabId = tabButtons.find((btn) => btn.classList.contains("active"))?.dataset.tab || tabPanels[0]?.id;
const validTabIds = new Set(tabPanels.map((panel) => panel.id));

function normalizeTabId(tabId) {
  if (typeof tabId !== "string") return defaultTabId;
  return validTabIds.has(tabId) ? tabId : defaultTabId;
}

function normalizeLang(lang) {
  if (typeof lang !== "string") return "vi";
  const normalized = lang.toLowerCase();
  return SUPPORTED_LANGS.has(normalized) ? normalized : "vi";
}

function getTabIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return normalizeTabId(params.get(TAB_QUERY_KEY));
}

function getLangFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return normalizeLang(params.get(LANG_QUERY_KEY));
}

let currentLang = "vi";

function updateUrlState({ tabId, lang }, mode = "replace") {
  const normalizedTabId = normalizeTabId(tabId ?? getTabIdFromUrl());
  const normalizedLang = normalizeLang(lang ?? currentLang);
  const current = new URL(window.location.href);
  const oldTab = current.searchParams.get(TAB_QUERY_KEY);
  const oldLang = current.searchParams.get(LANG_QUERY_KEY);

  current.searchParams.set(TAB_QUERY_KEY, normalizedTabId);
  current.searchParams.set(LANG_QUERY_KEY, normalizedLang);

  if (oldTab === normalizedTabId && oldLang === normalizedLang) return;

  const nextUrl = `${current.pathname}${current.search}${current.hash}`;
  const state = { tab: normalizedTabId, lang: normalizedLang };

  if (mode === "push") {
    history.pushState(state, "", nextUrl);
  } else {
    history.replaceState(state, "", nextUrl);
  }
}

function activateTab(tabId) {
  const normalizedTabId = normalizeTabId(tabId);

  for (const btn of tabButtons) {
    const isActive = btn.dataset.tab === normalizedTabId;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  }

  for (const panel of tabPanels) {
    panel.classList.toggle("active", panel.id === normalizedTabId);
  }

  return normalizedTabId;
}

for (const btn of tabButtons) {
  btn.addEventListener("click", () => {
    const activeTabId = activateTab(btn.dataset.tab);
    updateUrlState({ tabId: activeTabId }, "push");
  });
}

// ====== I18N ======
const I18N = window.COUNTDOWN_I18N;
if (!I18N) {
  throw new Error("Missing i18n data. Please load i18n.js before countdown.js");
}

const savedLang = normalizeLang(localStorage.getItem("lang") || "");
const browserLang = normalizeLang(navigator.language?.slice(0, 2) || "vi");

function getInitialLanguage() {
  const params = new URLSearchParams(window.location.search);
  if (params.has(LANG_QUERY_KEY)) return getLangFromUrl();
  return savedLang || browserLang || "vi";
}

const TZ = "Asia/Ho_Chi_Minh"; // UTC+7
const SALARY_HOUR = 15; // Giờ nhận lương (15:00)
const WORK_START_HOUR = 8;
const WORK_END_HOUR = 17;
const LUNCH_START_HOUR = 11;
const LUNCH_END_HOUR = 12;
const LATE_ALLOW_MIN = 15;
const HOLIDAYS = new Set([
  "2025-01-01", "2025-04-30", "2025-05-01", "2025-09-02",
  "2026-01-01", "2026-04-30", "2026-05-01", "2026-09-02",
  "2027-01-01", "2027-04-30", "2027-05-01", "2027-09-02"
]);

const pad2 = (n) => String(n).padStart(2, "0");
const isPastHour = (parts, hour) =>
  parts.hour > hour || (parts.hour === hour && (parts.minute > 0 || parts.second > 0));

function setText(el, value) {
  const nextValue = String(value);
  if (el.textContent !== nextValue) el.textContent = nextValue;
}

function setHTML(el, value) {
  if (el.innerHTML !== value) el.innerHTML = value;
}

function setCountdown(elDays, elHours, elMinutes, elSeconds, { days, hours, mins, secs }, { padHours = true } = {}) {
  setText(elDays, days);
  setText(elHours, padHours ? pad2(hours) : hours);
  setText(elMinutes, pad2(mins));
  setText(elSeconds, pad2(secs));
}

const ui = {
  salary: {
    d: document.getElementById("d"),
    h: document.getElementById("h"),
    m: document.getElementById("m"),
    s: document.getElementById("s"),
    nextPayInfo: document.getElementById("nextPayInfo"),
    todayInfo: document.getElementById("todayInfo")
  },
  work: {
    wh: document.getElementById("wh"),
    wm: document.getElementById("wm"),
    ws: document.getElementById("ws"),
    info: document.getElementById("workInfo"),
    scheduleInfo: document.getElementById("workScheduleInfo"),
    currentSegment: document.getElementById("workCurrentSegment"),
    milestoneInfo: document.getElementById("workMilestoneInfo")
  },
  static: {
    langLabel: document.getElementById("langLabel"),
    langSelect: document.getElementById("langSelect"),
    tabsRoot: document.getElementById("tabsRoot"),
    pageTitle: document.getElementById("pageTitle"),
    pageSubtitle: document.getElementById("pageSubtitle"),
    workTabBtn: document.getElementById("workTabBtn"),
    salaryTabBtn: document.getElementById("salaryTabBtn"),
    workHeading: document.getElementById("workHeading"),
    segmentTitle: document.getElementById("segmentTitle"),
    legendBefore: document.getElementById("legendBefore"),
    legendGrace: document.getElementById("legendGrace"),
    legendMorning: document.getElementById("legendMorning"),
    legendLunch: document.getElementById("legendLunch"),
    legendAfternoon: document.getElementById("legendAfternoon"),
    legendAfter: document.getElementById("legendAfter"),
    salaryHeading: document.getElementById("salaryHeading"),
    salarySub: document.getElementById("salarySub"),
    footerText: document.getElementById("footerText"),
    workHourLabel: document.getElementById("workHourLabel"),
    workMinuteLabel: document.getElementById("workMinuteLabel"),
    workSecondLabel: document.getElementById("workSecondLabel"),
    salaryDayLabel: document.getElementById("salaryDayLabel"),
    salaryHourLabel: document.getElementById("salaryHourLabel"),
    salaryMinuteLabel: document.getElementById("salaryMinuteLabel"),
    salarySecondLabel: document.getElementById("salarySecondLabel"),
    segBefore: document.getElementById("segBefore"),
    segGrace: document.getElementById("segGrace"),
    segMorning: document.getElementById("segMorning"),
    segLunch: document.getElementById("segLunch"),
    segAfternoon: document.getElementById("segAfternoon"),
    segAfter: document.getElementById("segAfter")
  }
};

const segmentIds = ["segBefore", "segGrace", "segMorning", "segLunch", "segAfternoon", "segAfter"];
const segmentEls = Object.fromEntries(segmentIds.map((id) => [id, document.getElementById(id)]));

function t() {
  return I18N[currentLang];
}

function formatLocalDate(y, m, d, weekday) {
  return `${t().weekdays[weekday]}, ${pad2(d)}/${pad2(m)}/${y}`;
}

function applyStaticTranslations() {
  const tr = t();

  document.documentElement.lang = currentLang;
  document.title = tr.baseTitle;

  themeToggle.title = tr.themeToggleTitle;
  ui.static.langLabel.textContent = tr.langLabel;
  ui.static.langSelect.setAttribute("aria-label", tr.langAria);
  ui.static.langSelect.value = currentLang;

  ui.static.pageTitle.textContent = tr.pageTitle;
  ui.static.pageSubtitle.textContent = tr.pageSubtitle;
  ui.static.tabsRoot.setAttribute("aria-label", tr.tabsAriaLabel);
  ui.static.workTabBtn.textContent = tr.tabWork;
  ui.static.salaryTabBtn.textContent = tr.tabSalary;

  ui.static.workHeading.textContent = tr.workHeading;
  ui.work.milestoneInfo.textContent = tr.workMilestonePlaceholder;

  ui.static.segmentTitle.textContent = tr.segmentTitle;
  ui.static.legendBefore.textContent = tr.segmentLegendBefore;
  ui.static.legendGrace.textContent = tr.segmentLegendGrace;
  ui.static.legendMorning.textContent = tr.segmentLegendMorning;
  ui.static.legendLunch.textContent = tr.segmentLegendLunch;
  ui.static.legendAfternoon.textContent = tr.segmentLegendAfternoon;
  ui.static.legendAfter.textContent = tr.segmentLegendAfter;
  ui.work.currentSegment.textContent = tr.segmentCurrentPlaceholder;
  ui.work.scheduleInfo.textContent = tr.segmentNoteDefault;

  ui.static.segBefore.title = tr.segmentTitles.segBefore;
  ui.static.segGrace.title = tr.segmentTitles.segGrace;
  ui.static.segMorning.title = tr.segmentTitles.segMorning;
  ui.static.segLunch.title = tr.segmentTitles.segLunch;
  ui.static.segAfternoon.title = tr.segmentTitles.segAfternoon;
  ui.static.segAfter.title = tr.segmentTitles.segAfter;

  ui.static.salaryHeading.textContent = tr.salaryHeading;
  ui.static.salarySub.innerHTML = tr.salarySubHtml;

  ui.static.workHourLabel.textContent = tr.hourLabel;
  ui.static.workMinuteLabel.textContent = tr.minuteLabel;
  ui.static.workSecondLabel.textContent = tr.secondLabel;
  ui.static.salaryDayLabel.textContent = tr.dayLabel;
  ui.static.salaryHourLabel.textContent = tr.hourLabel;
  ui.static.salaryMinuteLabel.textContent = tr.minuteLabel;
  ui.static.salarySecondLabel.textContent = tr.secondLabel;

  ui.static.footerText.innerHTML = tr.footerHtml;
}

function setLanguage(lang, { syncUrl = true, rerender = true } = {}) {
  currentLang = normalizeLang(lang);
  localStorage.setItem("lang", currentLang);
  applyStaticTranslations();

  if (syncUrl) {
    updateUrlState({ lang: currentLang }, "replace");
  }

  if (rerender) {
    tick();
  }
}

ui.static.langSelect.addEventListener("change", () => {
  setLanguage(ui.static.langSelect.value, { syncUrl: true, rerender: true });
});

window.addEventListener("popstate", () => {
  const urlLang = getLangFromUrl();
  if (urlLang !== currentLang) {
    setLanguage(urlLang, { syncUrl: false, rerender: false });
  }
  activateTab(getTabIdFromUrl());
  tick();
});

// Lấy các thành phần thời gian theo UTC+7 (Asia/Ho_Chi_Minh)
const formatterCache = new Map();

function getFormatter(timeZone) {
  if (!formatterCache.has(timeZone)) {
    formatterCache.set(
      timeZone,
      new Intl.DateTimeFormat("en-GB", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
        weekday: "short"
      })
    );
  }
  return formatterCache.get(timeZone);
}

function getTzParts(date = new Date(), timeZone = TZ) {
  const fmt = getFormatter(timeZone);
  const parts = fmt.formatToParts(date);
  const map = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  // weekday en-GB short: Sun, Mon, Tue...
  const wdMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(map.year),
    month: Number(map.month), // 1-12
    day: Number(map.day), // 1-31
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
    weekday: wdMap[map.weekday]
  };
}

// Epoch UTC cho một mốc local UTC+7 (không DST)
function tzLocalToEpochMs(y, m, d, hh = 0, mm = 0, ss = 0) {
  // local UTC+7 => UTC = local - 7h
  return Date.UTC(y, m - 1, d, hh - 7, mm, ss, 0);
}

function isoFromYmd(y, m, d) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function dayOfWeek(y, m, d) {
  // Tính weekday theo UTC+7 bằng cách lấy epoch local 12:00 để tránh biên ngày
  const ms = tzLocalToEpochMs(y, m, d, 12, 0, 0);
  return new Date(ms).getUTCDay(); // 0..6
}

function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate(); // m: 1..12
}

function isHolidayYMD(y, m, d) {
  return HOLIDAYS.has(isoFromYmd(y, m, d));
}

function isWeekendYMD(y, m, d) {
  const wd = dayOfWeek(y, m, d);
  return wd === 0 || wd === 6;
}

function isWorkingYMD(y, m, d) {
  return !isWeekendYMD(y, m, d) && !isHolidayYMD(y, m, d);
}

function nextDay(y, m, d) {
  d += 1;
  const dim = daysInMonth(y, m);
  if (d > dim) {
    d = 1;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return { y, m, d };
}

function moveToNextWorkingDay(y, m, d) {
  let cur = { y, m, d };
  while (!isWorkingYMD(cur.y, cur.m, cur.d)) {
    cur = nextDay(cur.y, cur.m, cur.d);
  }
  return cur;
}

function getSalaryDateForMonth(y, m) {
  // m: 1..12
  return moveToNextWorkingDay(y, m, 19);
}

function compareYmd(a, b) {
  if (a.y !== b.y) return a.y - b.y;
  if (a.m !== b.m) return a.m - b.m;
  return a.d - b.d;
}

function getNextSalaryDate(nowParts) {
  const cur = { y: nowParts.year, m: nowParts.month, d: nowParts.day };
  const thisSalary = getSalaryDateForMonth(cur.y, cur.m);

  const isAfterSalaryTimeToday = compareYmd(cur, thisSalary) === 0 && isPastHour(nowParts, SALARY_HOUR);

  if (compareYmd(cur, thisSalary) < 0) return thisSalary;
  if (compareYmd(cur, thisSalary) === 0 && !isAfterSalaryTimeToday) return thisSalary;

  let ny = cur.y;
  let nm = cur.m + 1;
  if (nm > 12) {
    nm = 1;
    ny += 1;
  }
  return getSalaryDateForMonth(ny, nm);
}

function diffToParts(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return { days, hours, mins, secs };
}

function setActiveSegment(activeId) {
  const tr = t();
  for (const id of segmentIds) {
    const el = segmentEls[id];
    if (el) el.classList.toggle("active", id === activeId);
  }
  ui.work.currentSegment.textContent = tr.segmentLabels[activeId] || tr.segmentNotApplicable;
}

function getNextMilestoneTarget(now, pNow) {
  const nowMs = now.getTime();
  const startMs = tzLocalToEpochMs(pNow.year, pNow.month, pNow.day, 8, 0, 0);
  const lateMs = tzLocalToEpochMs(pNow.year, pNow.month, pNow.day, 8, 15, 0);
  const lunchStartMs = tzLocalToEpochMs(pNow.year, pNow.month, pNow.day, 11, 0, 0);
  const lunchEndMs = tzLocalToEpochMs(pNow.year, pNow.month, pNow.day, 12, 0, 0);
  const endMs = tzLocalToEpochMs(pNow.year, pNow.month, pNow.day, 17, 0, 0);

  if (nowMs < startMs) return { targetMs: startMs, label: t().milestones.startWork, icon: "🚀" };
  if (nowMs < lateMs) return { targetMs: lateMs, label: t().milestones.lateDeadline, icon: "⏰" };
  if (nowMs < lunchStartMs) return { targetMs: lunchStartMs, label: t().milestones.lunchStart, icon: "🍽️" };
  if (nowMs < lunchEndMs) return { targetMs: lunchEndMs, label: t().milestones.lunchEnd, icon: "💪" };
  if (nowMs < endMs) return { targetMs: endMs, label: t().milestones.endWork, icon: "🎯" };

  const nextDayStart = tzLocalToEpochMs(pNow.year, pNow.month, pNow.day + 1, 8, 0, 0);
  return { targetMs: nextDayStart, label: t().milestones.startTomorrow, icon: "🌅" };
}

function updateSalary(now, pNow) {
  const tr = t();
  const thisMonthSalary = getSalaryDateForMonth(pNow.year, pNow.month);
  const isTodaySalaryDate = pNow.year === thisMonthSalary.y && pNow.month === thisMonthSalary.m && pNow.day === thisMonthSalary.d;
  const isSalaryReachedNow = isTodaySalaryDate && isPastHour(pNow, SALARY_HOUR);

  const nextSalary = getNextSalaryDate(pNow);
  const targetMs = tzLocalToEpochMs(nextSalary.y, nextSalary.m, nextSalary.d, SALARY_HOUR, 0, 0);
  const diff = diffToParts(targetMs - now.getTime());

  setCountdown(ui.salary.d, ui.salary.h, ui.salary.m, ui.salary.s, diff);

  const base19 = { y: nextSalary.y, m: nextSalary.m, d: 19 };
  const moved = compareYmd(base19, nextSalary) !== 0;
  const wdSalary = dayOfWeek(nextSalary.y, nextSalary.m, nextSalary.d);

  setHTML(ui.salary.nextPayInfo, `
    <div><b>${tr.nextSalaryTitle}</b> <span class="ok">${formatLocalDate(nextSalary.y, nextSalary.m, nextSalary.d, wdSalary)}</span></div>
    <div>${tr.standardDayPrefix} 19/${pad2(nextSalary.m)}/${nextSalary.y}
      ${moved ? `→ <span class="warn">${tr.movedReason}</span>` : ""}
    </div>
  `);

  const isTodayPayday =
    (pNow.year === nextSalary.y && pNow.month === nextSalary.m && pNow.day === nextSalary.d) || isSalaryReachedNow;

  setHTML(ui.salary.todayInfo, isTodayPayday
    ? `<span class="ok">${tr.todaySalaryText}</span>`
    : `${tr.todayPrefix}: <b>${formatLocalDate(pNow.year, pNow.month, pNow.day, pNow.weekday)}</b>`);
}

function renderWorkStatus(tr, pNow, tone, statusText, scheduleHtml, segmentId) {
  const toneClass = tone === "warn" ? "warn" : "ok";
  setActiveSegment(segmentId);
  setHTML(
    ui.work.info,
    `${tr.todayPrefix} ${formatLocalDate(pNow.year, pNow.month, pNow.day, pNow.weekday)} · <span class="${toneClass}">${statusText}</span>`
  );
  setHTML(ui.work.scheduleInfo, scheduleHtml);
}

function updateWork(now, pNow) {
  const tr = t();
  const nowMs = now.getTime();
  const monToFri = pNow.weekday >= 1 && pNow.weekday <= 5;
  if (!monToFri) {
    setText(ui.work.wh, "--");
    setText(ui.work.wm, "--");
    setText(ui.work.ws, "--");
    setHTML(
      ui.work.info,
      `${tr.todayPrefix} ${formatLocalDate(pNow.year, pNow.month, pNow.day, pNow.weekday)} · <span class="warn">${tr.weekendNoCountdown}</span>`
    );
    setActiveSegment("");
    setHTML(ui.work.scheduleInfo, tr.weekendSchedule);
    setHTML(ui.work.milestoneInfo, "");
    document.title = `${tr.weekendTitle} | ${tr.baseTitle}`;
    return;
  }

  const startMs = tzLocalToEpochMs(pNow.year, pNow.month, pNow.day, WORK_START_HOUR, 0, 0);
  const lunchStartMs = tzLocalToEpochMs(pNow.year, pNow.month, pNow.day, LUNCH_START_HOUR, 0, 0);
  const lunchEndMs = tzLocalToEpochMs(pNow.year, pNow.month, pNow.day, LUNCH_END_HOUR, 0, 0);
  const lateDeadlineMs = tzLocalToEpochMs(pNow.year, pNow.month, pNow.day, WORK_START_HOUR, LATE_ALLOW_MIN, 0);

  const milestone = getNextMilestoneTarget(now, pNow);
  const delta = milestone.targetMs - nowMs;

  if (delta <= 0) {
    setActiveSegment("segAfter");
    setText(ui.work.wh, "00");
    setText(ui.work.wm, "00");
    setText(ui.work.ws, "00");
    renderWorkStatus(tr, pNow, "ok", tr.reachedHomeText, tr.workDoneSchedule, "segAfter");
    setHTML(ui.work.milestoneInfo, `<b>${tr.milestonePrefix}</b> ${milestone.icon} ${milestone.label}`);
    document.title = `${tr.reachedHomeText} | ${tr.baseTitle}`;
  } else {
    const countdown = diffToParts(delta);
    const hoursLeft = countdown.hours + countdown.days * 24;
    setText(ui.work.wh, pad2(hoursLeft));
    setText(ui.work.wm, pad2(countdown.mins));
    setText(ui.work.ws, pad2(countdown.secs));

    if (nowMs < startMs) {
      renderWorkStatus(tr, pNow, "warn", tr.workBeforeStart, tr.workBeforeStartSchedule, "segBefore");
    } else if (nowMs <= lateDeadlineMs) {
      renderWorkStatus(tr, pNow, "ok", tr.workGrace, tr.workGraceSchedule, "segGrace");
    } else if (nowMs < lunchStartMs) {
      renderWorkStatus(tr, pNow, "ok", tr.workMorning, tr.workMorningSchedule, "segMorning");
    } else if (nowMs < lunchEndMs) {
      renderWorkStatus(tr, pNow, "ok", tr.workLunch, tr.workLunchSchedule, "segLunch");
    } else {
      renderWorkStatus(tr, pNow, "ok", tr.workAfternoon, tr.workAfternoonSchedule, "segAfternoon");
    }

    setHTML(ui.work.milestoneInfo, `<b>${tr.milestonePrefix}</b> ${milestone.icon} ${milestone.label}`);
    document.title = `${pad2(hoursLeft)}:${pad2(countdown.mins)}:${pad2(countdown.secs)} | ${milestone.icon} ${milestone.label} | ${tr.baseTitle}`;
  }
}

function tick() {
  const now = new Date();
  const pNow = getTzParts(now, TZ); // luôn theo UTC+7
  updateSalary(now, pNow);
  updateWork(now, pNow);
}

const initialLang = getInitialLanguage();
setLanguage(initialLang, { syncUrl: false, rerender: false });

const activeTabFromUrl = getTabIdFromUrl();
activateTab(activeTabFromUrl);
updateUrlState({ tabId: activeTabFromUrl, lang: currentLang }, "replace");

tick();
setInterval(tick, 1000);
