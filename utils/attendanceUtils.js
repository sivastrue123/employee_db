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

  const hasSessions = Array.isArray(sessions) && sessions.length > 0;
  const recDate = recordDate ? new Date(recordDate) : null;
  const isRecordToday =
    typeof nowIST === "function" && typeof isSameISTDate === "function"
      ? isSameISTDate(nowIST(), recDate)
      : false;

  if (hasSessions) {
    // Aggregate full span per session that STARTS on recordDate (IST).
    // If a session crosses midnight, we count the ENTIRE diff (no 24h wrap).
    for (const s of sessions) {
      if (!s?.in) continue;
      const start = new Date(s.in);

      if (typeof isSameISTDate === "function" && recDate) {
        if (!isSameISTDate(start, recDate)) continue; // only sessions that start on recordDate
      }

      let end = s?.out ? new Date(s.out) : null;
      if (!end && isRecordToday) {
        end = typeof nowIST === "function" ? nowIST() : new Date();
      }
      if (!end || end <= start) continue;

      total += Math.round((end - start) / 60000); // minutes across days OK
    }
    return total;
  }

  // Legacy single-shot path (supports cross-midnight)
  if (clockIn) {
    const start = new Date(clockIn);
    let end = clockOut ? new Date(clockOut) : null;

    if (!end && isRecordToday) {
      end = typeof nowIST === "function" ? nowIST() : new Date();
    }

    if (end && end > start) {
      return Math.round((end - start) / 60000);
    }
  }

  return 0;
};

export const humanizeMinutes = (mins) => {
  if (!Number.isFinite(mins) || mins <= 0) return "0 hrs";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h} ${h === 1 ? "hr" : "hrs"}`;
  if (h === 0) return `${m} mins`;
  return `${h} ${h === 1 ? "hr" : "hrs"} ${m} mins`;
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

export const mapStatusToFront = (status, clockIn) => {
  if (status === "Absent" || status === "On Leave") return "Absent";
  if (!clockIn) return "Absent";
  return "Present";
};

// 9:30 AM cutoff for late
export const START_MIN = 9 * 60 + 30;
