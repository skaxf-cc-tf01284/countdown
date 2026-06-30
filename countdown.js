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

function activateTab(tabId) {
  for (const btn of tabButtons) {
    const isActive = btn.dataset.tab === tabId;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  }

  for (const panel of tabPanels) {
    panel.classList.toggle("active", panel.id === tabId);
  }
}

for (const btn of tabButtons) {
  btn.addEventListener("click", () => activateTab(btn.dataset.tab));
}

// ====== CẤU HÌNH ======
const TZ = "Asia/Ho_Chi_Minh"; // UTC+7
const BASE_TITLE = "Countdown Lương + Giờ Về (UTC+7)";
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

const WEEKDAYS = ["Chủ nhật","Thứ 2","Thứ 3","Thứ 4","Thứ 5","Thứ 6","Thứ 7"];

const pad2 = n => String(n).padStart(2, "0");
const isPastHour = (parts, hour) =>
  parts.hour > hour || (parts.hour === hour && (parts.minute > 0 || parts.second > 0));

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
  }
};

const segmentLabelMap = {
  segBefore: "Khúc hiện tại: Trước giờ làm (trước 08:00)",
  segGrace: "Khúc hiện tại: Thời gian đi muộn cho phép (08:00-08:15)",
  segMorning: "Khúc hiện tại: Làm buổi sáng (08:15-11:00)",
  segLunch: "Khúc hiện tại: Nghỉ trưa (11:00-12:00)",
  segAfternoon: "Khúc hiện tại: Làm buổi chiều (12:00-17:00)",
  segAfter: "Khúc hiện tại: Sau giờ làm (sau 17:00)"
};
const segmentIds = ["segBefore", "segGrace", "segMorning", "segLunch", "segAfternoon", "segAfter"];
const segmentEls = Object.fromEntries(segmentIds.map((id) => [id, document.getElementById(id)]));

function setActiveSegment(activeId) {
  for (const id of segmentIds) {
    const el = segmentEls[id];
    if (el) el.classList.toggle("active", id === activeId);
  }
  ui.work.currentSegment.textContent = segmentLabelMap[activeId] || "Không áp dụng do cuối tuần.";
}

// Lấy các thành phần thời gian theo UTC+7 (Asia/Ho_Chi_Minh)
function getTzParts(date = new Date(), timeZone = TZ) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short"
  });
  const parts = fmt.formatToParts(date);
  const map = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  // weekday en-GB short: Sun, Mon, Tue...
  const wdMap = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 };
  return {
    year: Number(map.year),
    month: Number(map.month), // 1-12
    day: Number(map.day),     // 1-31
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

function isoFromYmd(y,m,d){ return `${y}-${pad2(m)}-${pad2(d)}`; }

function formatVN(y,m,d,weekday){
  return `${WEEKDAYS[weekday]}, ${pad2(d)}/${pad2(m)}/${y}`;
}

function dayOfWeek(y,m,d){
  // tính weekday theo UTC+7 bằng cách lấy epoch local 12:00 để tránh biên ngày
  const ms = tzLocalToEpochMs(y,m,d,12,0,0);
  return new Date(ms).getUTCDay(); // 0..6
}

function daysInMonth(y,m){
  return new Date(Date.UTC(y, m, 0)).getUTCDate(); // m: 1..12
}

function isHolidayYMD(y,m,d){
  return HOLIDAYS.has(isoFromYmd(y,m,d));
}

function isWeekendYMD(y,m,d){
  const wd = dayOfWeek(y,m,d);
  return wd === 0 || wd === 6;
}

function isWorkingYMD(y,m,d){
  return !isWeekendYMD(y,m,d) && !isHolidayYMD(y,m,d);
}

function nextDay(y,m,d){
  d += 1;
  const dim = daysInMonth(y,m);
  if (d > dim) {
    d = 1; m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return { y,m,d };
}

function moveToNextWorkingDay(y,m,d){
  let cur = { y,m,d };
  while (!isWorkingYMD(cur.y, cur.m, cur.d)) {
    cur = nextDay(cur.y, cur.m, cur.d);
  }
  return cur;
}

function getSalaryDateForMonth(y,m){
  // m: 1..12
  return moveToNextWorkingDay(y, m, 19);
}

function compareYmd(a,b){
  if (a.y !== b.y) return a.y - b.y;
  if (a.m !== b.m) return a.m - b.m;
  return a.d - b.d;
}

function getNextSalaryDate(nowParts){
  const cur = { y: nowParts.year, m: nowParts.month, d: nowParts.day };
  const thisSalary = getSalaryDateForMonth(cur.y, cur.m);

  const isAfterSalaryTimeToday =
    compareYmd(cur, thisSalary) === 0 &&
    isPastHour(nowParts, SALARY_HOUR);

  if (compareYmd(cur, thisSalary) < 0) return thisSalary;
  if (compareYmd(cur, thisSalary) === 0 && !isAfterSalaryTimeToday) return thisSalary;

  let ny = cur.y, nm = cur.m + 1;
  if (nm > 12) { nm = 1; ny += 1; }
  return getSalaryDateForMonth(ny, nm);
}

function diffToParts(ms){
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return { days, hours, mins, secs };
}

function getNextMilestoneTarget(now, pNow) {
  const nowMs = now.getTime();
  const startMs = tzLocalToEpochMs(pNow.year, pNow.month, pNow.day, 8, 0, 0);
  const lateMs = tzLocalToEpochMs(pNow.year, pNow.month, pNow.day, 8, 15, 0);
  const lunchStartMs = tzLocalToEpochMs(pNow.year, pNow.month, pNow.day, 11, 0, 0);
  const lunchEndMs = tzLocalToEpochMs(pNow.year, pNow.month, pNow.day, 12, 0, 0);
  const endMs = tzLocalToEpochMs(pNow.year, pNow.month, pNow.day, 17, 0, 0);

  if (nowMs < startMs) return { targetMs: startMs, label: "Bắt đầu ca làm (08:00)", icon: "🚀" };
  if (nowMs < lateMs) return { targetMs: lateMs, label: "Hết thời gian đi muộn (08:15)", icon: "⏰" };
  if (nowMs < lunchStartMs) return { targetMs: lunchStartMs, label: "Bắt đầu nghỉ trưa (11:00)", icon: "🍽️" };
  if (nowMs < lunchEndMs) return { targetMs: lunchEndMs, label: "Kết thúc nghỉ trưa (12:00)", icon: "💪" };
  if (nowMs < endMs) return { targetMs: endMs, label: "Kết thúc ca làm (17:00)", icon: "🎯" };

  // Sau 17:00
  const nextDayStart = tzLocalToEpochMs(pNow.year, pNow.month, pNow.day + 1, 8, 0, 0);
  return { targetMs: nextDayStart, label: "Bắt đầu ca làm ngày mai (08:00)", icon: "🌅" };
}

function updateSalary(now, pNow){
  const thisMonthSalary = getSalaryDateForMonth(pNow.year, pNow.month);
  const isTodaySalaryDate =
    pNow.year === thisMonthSalary.y &&
    pNow.month === thisMonthSalary.m &&
    pNow.day === thisMonthSalary.d;
  const isSalaryReachedNow =
    isTodaySalaryDate &&
    isPastHour(pNow, SALARY_HOUR);

  const nextSalary = getNextSalaryDate(pNow);
  const targetMs = tzLocalToEpochMs(nextSalary.y, nextSalary.m, nextSalary.d, SALARY_HOUR, 0, 0);
  const diff = diffToParts(targetMs - now.getTime());

  ui.salary.d.textContent = diff.days;
  ui.salary.h.textContent = pad2(diff.hours);
  ui.salary.m.textContent = pad2(diff.mins);
  ui.salary.s.textContent = pad2(diff.secs);

  const base19 = { y: nextSalary.y, m: nextSalary.m, d: 19 };
  const moved = compareYmd(base19, nextSalary) !== 0;
  const wdSalary = dayOfWeek(nextSalary.y, nextSalary.m, nextSalary.d);

  ui.salary.nextPayInfo.innerHTML = `
    <div><b>Kỳ nhận lương kế tiếp:</b> <span class="ok">${formatVN(nextSalary.y,nextSalary.m,nextSalary.d,wdSalary)}</span></div>
    <div>Ngày chuẩn là 19/${pad2(nextSalary.m)}/${nextSalary.y}
      ${moved ? `→ <span class="warn">đã dời do cuối tuần/ngày lễ</span>` : ""}
    </div>
  `;

  const isTodayPayday =
    (pNow.year === nextSalary.y && pNow.month === nextSalary.m && pNow.day === nextSalary.d) ||
    isSalaryReachedNow;

  ui.salary.todayInfo.innerHTML = isTodayPayday
    ? `<span class="ok">🎉 Hôm nay là ngày nhận lương!</span>`
    : `Hôm nay: <b>${formatVN(pNow.year,pNow.month,pNow.day,pNow.weekday)}</b>`;
}

function updateWork(now, pNow){
  const monToFri = pNow.weekday >= 1 && pNow.weekday <= 5;
  if (!monToFri) {
    ui.work.wh.textContent = "--"; ui.work.wm.textContent = "--"; ui.work.ws.textContent = "--";
    ui.work.info.innerHTML = `Hôm nay ${formatVN(pNow.year,pNow.month,pNow.day,pNow.weekday)} · <span class="warn">Cuối tuần, không áp dụng countdown</span>`;
    setActiveSegment("");
    ui.work.scheduleInfo.innerHTML = `Không tính tiến độ ca làm vào cuối tuần. Thứ 2 bắt đầu từ <b>08:00</b>.`;
    ui.work.milestoneInfo.innerHTML = "";
    document.title = `Cuối tuần | ${BASE_TITLE}`;
    return;
  }

  const startMs = tzLocalToEpochMs(pNow.year, pNow.month, pNow.day, WORK_START_HOUR, 0, 0);
  const lunchStartMs = tzLocalToEpochMs(pNow.year, pNow.month, pNow.day, LUNCH_START_HOUR, 0, 0);
  const lunchEndMs = tzLocalToEpochMs(pNow.year, pNow.month, pNow.day, LUNCH_END_HOUR, 0, 0);
  const lateDeadlineMs = tzLocalToEpochMs(pNow.year, pNow.month, pNow.day, WORK_START_HOUR, LATE_ALLOW_MIN, 0);
  const endMs = tzLocalToEpochMs(pNow.year, pNow.month, pNow.day, WORK_END_HOUR, 0, 0);

  // Lấy mốc kế tiếp
  const milestone = getNextMilestoneTarget(now, pNow);
  const delta = milestone.targetMs - now.getTime();

  if (delta <= 0) {
    setActiveSegment("segAfter");
    ui.work.wh.textContent = "00"; ui.work.wm.textContent = "00"; ui.work.ws.textContent = "00";
    ui.work.info.innerHTML = `Hôm nay ${formatVN(pNow.year,pNow.month,pNow.day,pNow.weekday)} · <span class="ok">🎉 Đã tới giờ về!</span>`;
    ui.work.scheduleInfo.innerHTML = `Ca làm hôm nay đã hoàn thành. Khung chuẩn: <b>08:00-17:00</b>, nghỉ trưa <b>11:00-12:00</b>, đi muộn cho phép đến <b>08:15</b>.`;
    ui.work.milestoneInfo.innerHTML = `<b>Mốc kế tiếp:</b> ${milestone.icon} ${milestone.label}`;
    document.title = `Đã tới giờ về 🎉 | ${BASE_TITLE}`;
  } else {
    const t = diffToParts(delta);
    const hoursLeft = t.hours + t.days * 24;
    ui.work.wh.textContent = pad2(hoursLeft);
    ui.work.wm.textContent = pad2(t.mins);
    ui.work.ws.textContent = pad2(t.secs);

    if (now.getTime() < startMs) {
      setActiveSegment("segBefore");
      ui.work.info.innerHTML = `Hôm nay ${formatVN(pNow.year,pNow.month,pNow.day,pNow.weekday)} · <span class="warn">Chưa vào giờ làm</span>`;
      ui.work.scheduleInfo.innerHTML = `Khung chuẩn: <b>08:00-17:00</b>, nghỉ trưa <b>11:00-12:00</b>, đi muộn tối đa đến <b>08:15</b>.`;
    } else if (now.getTime() <= lateDeadlineMs) {
      setActiveSegment("segGrace");
      ui.work.info.innerHTML = `Hôm nay ${formatVN(pNow.year,pNow.month,pNow.day,pNow.weekday)} · <span class="ok">Đang trong thời gian đi muộn cho phép</span>`;
      ui.work.scheduleInfo.innerHTML = `Hành động nhanh: quá 08:15 sẽ bị tính đi muộn.`;
    } else if (now.getTime() < lunchStartMs) {
      setActiveSegment("segMorning");
      ui.work.info.innerHTML = `Hôm nay ${formatVN(pNow.year,pNow.month,pNow.day,pNow.weekday)} · <span class="ok">Đang làm buổi sáng</span>`;
      ui.work.scheduleInfo.innerHTML = `Khung hiện tại: <b>08:15-11:00</b>. Nghỉ trưa bắt đầu lúc <b>11:00</b>.`;
    } else if (now.getTime() >= lunchStartMs && now.getTime() < lunchEndMs) {
      setActiveSegment("segLunch");
      ui.work.info.innerHTML = `Hôm nay ${formatVN(pNow.year,pNow.month,pNow.day,pNow.weekday)} · <span class="ok">Đang nghỉ trưa</span>`;
      ui.work.scheduleInfo.innerHTML = `Thời gian nghỉ trưa: <b>11:00-12:00</b>. Tận hưởng thời gian nghỉ ngơi!`;
    } else {
      setActiveSegment("segAfternoon");
      ui.work.info.innerHTML = `Hôm nay ${formatVN(pNow.year,pNow.month,pNow.day,pNow.weekday)} · <span class="ok">Đang làm buổi chiều</span>`;
      ui.work.scheduleInfo.innerHTML = `Khung hiện tại: <b>12:00-17:00</b>. Kết thúc ca lúc <b>17:00</b>.`;
    }

    ui.work.milestoneInfo.innerHTML = `<b>Mốc kế tiếp:</b> ${milestone.icon} ${milestone.label}`;
    document.title = `${pad2(hoursLeft)}:${pad2(t.mins)}:${pad2(t.secs)} | ${milestone.icon} ${milestone.label} | ${BASE_TITLE}`;
  }
}

function tick(){
  const now = new Date();
  const pNow = getTzParts(now, TZ); // luôn theo UTC+7
  updateSalary(now, pNow);
  updateWork(now, pNow);
}

tick();
setInterval(tick, 1000);
