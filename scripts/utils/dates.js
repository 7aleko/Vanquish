/**
 * Local date helpers (ISO formatting, Monday-of-week).
 */

function formatIsoDateLocal(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function getMondayForDate(d) {
    const dow = d.getDay();
    const diff = (dow === 0) ? -6 : (1 - dow);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
}

// A timestamp as a local clock time: "6:48 AM"
function formatClockTime(timestamp) {
    const d = new Date(timestamp);
    if (Number.isNaN(d.getTime())) return '';
    const h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0');
    return `${h % 12 || 12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
}
