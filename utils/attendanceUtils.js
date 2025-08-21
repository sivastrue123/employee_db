export const IST_TZ = "Asia/Kolkata";
// Utility: compare if two datetimes fall on the same IST calendar date
export const isSameISTDate = (a, b) => {
  return formatDateIST(a) === formatDateIST(b);
};

// Utility: IST "now"
export const nowIST = () => {
  return new Date(); // minutesSinceMidnightIST() already interprets with IST via Intl
};

// Compute worked minutes from multi-session data with graceful fallback to legacy fields
export const computeWorkedMinutes = ({
  sessions = [],
  clockIn,
  clockOut,
  recordDate,
}) => {
  let total = 0;

  // Prefer sessions[] if present; otherwise fallback to legacy single-shot
  const hasSessions = Array.isArray(sessions) && sessions.length > 0;

  if (hasSessions) {
    // Only aggregate segments that belong to the same IST date as recordDate
    // and have valid 'in' and 'out'. If 'out' missing and it's today (IST), use "now".
    const todayIST = formatDateIST(nowIST());
    const recDateStr = formatDateIST(recordDate);

    for (const s of sessions) {
      if (!s?.in) continue;
      const inDt = new Date(s.in);
      if (!isSameISTDate(inDt, recordDate)) continue;

      let outDt = s?.out ? new Date(s.out) : null;

      // If open session and it's for today IST, treat "now" as out
      if (!outDt && recDateStr === todayIST) {
        outDt = nowIST();
        // Guardrail: if "now" rolled into next IST day (edge), still cap to same day by minutes only
      }

      if (!outDt) continue; // ignore open sessions for non-today records
     
      // Compute by IST minutes since midnight; this intentionally caps to same-day math
      const inMin = minutesSinceMidnightIST(inDt);
      const outMin = minutesSinceMidnightIST(outDt);
      const delta = Math.max(0, outMin - inMin);
      total += delta;
    }
    return total;
  }

  // Legacy fallback path
  if (
    clockIn &&
    clockOut &&
    isSameISTDate(clockIn, recordDate) &&
    isSameISTDate(clockOut, recordDate)
  ) {
    const inMin = minutesSinceMidnightIST(clockIn);
    const outMin = minutesSinceMidnightIST(clockOut);
    return Math.max(0, outMin - inMin);
  }

  return 0;
};

// Compute earliest "in" across sessions (fallback to legacy clockIn) for Late calc
export const earliestInMinutesIST = ({
  sessions = [],
  clockIn,
  recordDate,
}) => {
  const candidates = [];

  if (Array.isArray(sessions) && sessions.length > 0) {
    for (const s of sessions) {
      if (s?.in && isSameISTDate(new Date(s.in), recordDate)) {
        candidates.push(minutesSinceMidnightIST(new Date(s.in)));
      }
    }
  } else if (clockIn && isSameISTDate(clockIn, recordDate)) {
    candidates.push(minutesSinceMidnightIST(clockIn));
  }

  if (candidates.length === 0) return null;
  return Math.min(...candidates);
};
export const dtfDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: IST_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export const dtfTime12 = new Intl.DateTimeFormat("en-US", {
  timeZone: IST_TZ,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export const formatDateIST = (d) => {
  return dtfDate.format(new Date(d));
};
export const formatTimeIST12 = (d) => {
  if (!d) return "";
  return dtfTime12.format(new Date(d)).replace("AM", "am").replace("PM", "pm");
};
export const getISTParts = (d) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(d));
  const obj = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return { h: Number(obj.hour), m: Number(obj.minute) };
};
export const minutesSinceMidnightIST = (d) => {
  const { h, m } = getISTParts(d);
  return h * 60 + m;
};
export const humanizeMinutes = (mins) => {
  if (!mins || mins <= 0) return "0 hrs";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h} ${h === 1 ? "hr" : "hrs"}`;
  if (h === 0) return `${m} mins`;
  return `${h} ${h === 1 ? "hr" : "hrs"} ${m} mins`;
};
export const mapStatusToFront = (status, clockIn) => {
  if (status === "Absent" || status === "On Leave") return "Absent";
  if (!clockIn) return "Absent";
  return "Present";
};

// 9:30 AM cutoff for late
export const START_MIN = 9 * 60 + 30;
