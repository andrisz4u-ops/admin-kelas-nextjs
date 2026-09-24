/**
 * Date utility helpers configured for Asia/Jakarta (WIB - UTC+7)
 */

/**
 * Returns today's date in YYYY-MM-DD format based on WIB (UTC+7).
 * This prevents the date from shifting to yesterday if loaded before 07:00 AM WIB.
 */
export function getWIBDateString(date: Date = new Date()): string {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    })
    return formatter.format(date) // Returns "YYYY-MM-DD"
}

/**
 * Returns current month in YYYY-MM format based on WIB (UTC+7).
 */
export function getWIBMonthString(date: Date = new Date()): string {
    return getWIBDateString(date).substring(0, 7)
}

/**
 * Normalizes any date string (YYYY-MM-DD, ISO, etc.) or Date object into a pure UTC midnight Date.
 * This guarantees consistent querying and storage on PostgreSQL @db.Date fields,
 * avoiding timezone offset shifts (-7h into yesterday).
 */
export function parseToUTCMidnight(dateInput?: string | Date | null): Date {
    if (!dateInput) {
        const todayStr = getWIBDateString()
        const [y, m, d] = todayStr.split("-").map(Number)
        return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))
    }

    if (dateInput instanceof Date) {
        const y = dateInput.getUTCFullYear()
        const m = dateInput.getUTCMonth()
        const d = dateInput.getUTCDate()
        return new Date(Date.UTC(y, m, d, 0, 0, 0, 0))
    }

    // If string like "2026-09-24" or "2026-09-24T00:00:00.000Z"
    const datePart = String(dateInput).split("T")[0]
    const parts = datePart.split("-").map(Number)
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0))
    }

    const d = new Date(dateInput)
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0))
}
