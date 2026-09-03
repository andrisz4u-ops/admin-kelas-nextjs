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
