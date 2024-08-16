let mssql;
let mysql
function settingDb(mssqlConnect, mysqlConnect) {
    mssql = mssqlConnect;
    mysql = mysqlConnect
}
module.exports.settingDb = settingDb;

async function Sql2DataRecordset(_sqlString) {
    let dt = await new mssql.Request().query(_sqlString)
    let dr = dt.recordset
    return dr
}
module.exports.Sql2DataRecordset = Sql2DataRecordset

async function SqlExecute(_sqlString) {
    await new mssql.Request().query(_sqlString)
}
module.exports.SqlExecute = SqlExecute
