function NowDate_yyMMdd() {
    const now = new Date();
    const ls_year = String(now.getFullYear()).slice(-2);
    const ls_month = String(now.getMonth() + 1).padStart(2, '0'); // Adding 1 because getMonth() returns zero-based month
    const ls_day = String(now.getDate()).padStart(2, '0');
    return `${ls_year}${ls_month}${ls_day}`;
}
module.exports.NowDate_yyMMdd = NowDate_yyMMdd;

function NowDate_yyyyMMdd() {
    const now = new Date();
    let ls_year = now.getFullYear()
    const ls_month = String(now.getMonth() + 1).padStart(2, '0'); // Adding 1 because getMonth() returns zero-based month
    const ls_day = String(now.getDate()).padStart(2, '0');
    return `${ls_year}${ls_month}${ls_day}`;
}
module.exports.NowDate_yyyyMMdd = NowDate_yyyyMMdd;

function NowDate_HHmm() {
    const now = new Date();
    const ls_hour = String(now.getHours()).padStart(2, '0');
    const ls_minute = String(now.getMinutes()).padStart(2, '0');
    return `${ls_hour}${ls_minute}`; //HHmm
}
module.exports.NowDate_HHmm = NowDate_HHmm;