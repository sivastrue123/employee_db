// src/services/attendanceAutoClose.service.js
import Attendance from "../model/attendance.model.js";
import { formatDateIST, nowIST, IST_TZ } from "../utils/attendanceUtils.js"

// Build a UTC Date for an IST Y-M-D at HH:MM (no DST in IST, so this is deterministic)
function istYmdTimeToUtc(ymdStr, hr = 0, min = 0) {
  // ymdStr is "YYYY-MM-DD" in IST semantics
  // Create a date string with explicit IST offset to avoid local TZ pitfalls
  const hh = String(hr).padStart(2, "0");
  const mm = String(min).padStart(2, "0");
  return new Date(`${ymdStr}T${hh}:${mm}:00+05:30`);
}

// Compute IST day bounds in UTC for "today" based on provided clock
function getIstDayBoundsUtc(base = nowIST()) {
  const todayIst = formatDateIST(base);                       // "YYYY-MM-DD" (IST)
  const startUtc = istYmdTimeToUtc(todayIst, 0, 0);           // 00:00 IST -> UTC
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);
  return { todayIst, startUtc, endUtc };
}

// Return "yesterday" (IST) date string
function getYesterdayIstStr(base = nowIST()) {
  const y = new Date(base.getTime() - 24 * 60 * 60 * 1000);
  return formatDateIST(y);
}

/**
 * When the *first* person clocks in for the IST day, auto-close any records from
 * yesterday (IST) that did not clock out by setting 19:00 IST (stored as UTC).
 *
 * Idempotent & safe to re-run; only updates open sessions or null clockOuts with
 * session.in <= cutoff.
 */
export async function autoCloseYesterdaysOpenAttendancesIST({ triggerAt = nowIST(), editedBy = "system" } = {}) {
  // 1) Determine whether this invocation is the first punch of the IST day.
  //    We check by *time* (clockIn range) to decouple from how the "date" field is stored.
  const { startUtc, endUtc } = getIstDayBoundsUtc(triggerAt);

  const countToday = await Attendance.countDocuments({
    clockIn: { $gte: startUtc, $lt: endUtc },
  });

  if (countToday > 0) {
    // Not first punch; nothing to do.
    return { ran: false, closed: 0 };
  }

  // 2) Compute yesterday@19:00 IST ➜ UTC (cutoff)
  const yesterdayIstStr = getYesterdayIstStr(triggerAt);
  const cutoffUtc = istYmdTimeToUtc(yesterdayIstStr, 19, 0); // 7:00 PM IST
  const now = new Date();

  // 3) Bulk close: match yesterday’s (IST) records that are still open
  //    - clockOut == null
  //    - OR sessions contain an open element (out == null) with in <= cutoff
  const bulk = await Attendance.updateMany(
    {
      date: yesterdayIstStr, // assuming your `date` stores IST YYYY-MM-DD; if not, we could fall back to a time-range query
      $or: [
        { clockOut: null },
        { sessions: { $elemMatch: { out: null, in: { $lte: cutoffUtc } } } },
      ],
    },
    {
      $set: {
        clockOut: cutoffUtc,
        "sessions.$[open].out": cutoffUtc,
        EditedBy: editedBy,
        EditedAt: now,
      },
    },
    {
      // Only close sessions that started before/equal to cutoff to avoid setting out < in
      arrayFilters: [{ "open.out": null, "open.in": { $lte: cutoffUtc } }],
    }
  );

  const closed = bulk?.modifiedCount || 0;
  if (closed) {
    console.log(
      `[attendance-auto-close] Closed ${closed} open records for ${yesterdayIstStr} at 19:00 IST (UTC ${cutoffUtc.toISOString()}).`
    );
  }
  return { ran: true, closed };
}
