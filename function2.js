var mssql;
function settingDb(mssqlConnect) {
    mssql = mssqlConnect;
}
module.exports.settingDb = settingDb;

async function updateFabricLocation(req, res) {
    const ls_fCustCode = decodeURIComponent(req.body.FROM_CUST) || "";
    const ls_pCustCode = decodeURIComponent(req.body.TO_CUST) || "";
    const ls_empNo = decodeURIComponent(req.body.EMP_NO) || "";
    const ls_prdCode = decodeURIComponent(req.body.PRODUCT_CODE) || "";
    const li_prdQty = decodeURIComponent(req.body.PRODUCT_QTY) || "";
    const ls_fabricNo = decodeURIComponent(req.body.FABRIC_NO) || "";
    const ls_fabricImpNo = decodeURIComponent(req.body.IMP_NO) || "";
    const ls_fabricDvrNo = decodeURIComponent(req.body.DVR_NO) || "";
    const ls_fabricRemark = decodeURIComponent(req.body.REMARK) || "";
    const li_payCode = 20 // Move OUT
    const ls_dvrRemark = "Location Update"
    const ls_inHNote = ls_dvrRemark + "/Auto In Reg after Out Reg"

    try {
        const ls_dateYYYY = getCurrentDate(4)
        const ls_dateYY = getCurrentDate(2)
        const ls_timeHHmm = getCurrentTime()
        const lf_dvrCost = 0 // Move to local warehouse, it have no cost
        const lf_dvrQty = parseFloat(li_prdQty)
        const lf_dvrPrice = lf_dvrCost * lf_dvrQty
        const lf_prdCost = await getProductCost(ls_prdCode)
        const ls_dvrNo = await insertDeliveryHTable(li_payCode, ls_fCustCode, ls_pCustCode, ls_inHNote, ls_empNo, ls_dateYYYY, ls_timeHHmm, ls_dateYY)
        const ls_inNo = await insertInHTable(li_payCode, ls_fCustCode, ls_pCustCode, ls_inHNote, ls_empNo, ls_dateYYYY, ls_timeHHmm, ls_dateYY)

        await insert2DelevryDTable(ls_dvrNo, ls_prdCode, lf_dvrQty, lf_prdCost, lf_dvrPrice)
        await insert2InDTable(ls_inNo, ls_prdCode, lf_dvrQty, lf_dvrCost, lf_dvrPrice, ls_inHNote, lf_prdCost)
        await stockMove(ls_dvrNo, ls_inNo, ls_fCustCode, ls_pCustCode, ls_dateYYYY, ls_prdCode, lf_dvrQty, lf_prdCost)
        await fabricOut(ls_fCustCode, ls_fabricNo, lf_dvrQty, ls_dateYYYY, ls_timeHHmm, ls_empNo)
        await fabricIn(ls_fabricNo, ls_pCustCode, ls_prdCode, lf_dvrQty, ls_dateYYYY, ls_timeHHmm, ls_empNo, ls_fabricImpNo, ls_fabricDvrNo, ls_fabricRemark, ls_dateYY)
        return res.json({ success: true, message: "SUCCESS" });
    } catch (error) {
        console.error(`Error executing query: `, error);
        res.status(500).json({ success: false, message: "An error occurred while processing the request" });

    }



}
module.exports.updateFabricLocation = updateFabricLocation

function getCurrentDate(yearLength) {
    const now = new Date();
    var year
    if (yearLength == 2) {
        year = String(now.getFullYear()).slice(-2);
    } else {
        year = now.getFullYear()
    }
    const month = String(now.getMonth() + 1).padStart(2, '0'); // Adding 1 because getMonth() returns zero-based month
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}${month}${day}`; //yyMMdd
}

function getCurrentTime() {
    const now = new Date();
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    return `${hour}${minute}`; //HHmm

}
async function getProductCost(_prdCode) {
    var loading = "getProductCost "
    loading += "- pending"
    // console.log(loading);
    var ls_sqlQuery = `SELECT PRODUCT_COST FROM PRODUCT_TBL WITH(NOLOCK) WHERE PRODUCT_CODE='${_prdCode}'`
    var result = await new mssql.Request().query(ls_sqlQuery)
    var row = result.recordset[0]
    loading += " - done"
    // console.log(loading);
    return row["PRODUCT_COST"]
}

//async function insertDeliveryHTable(PAY_CODE, _fCustCode, TO_CUST, dvrRemark, EMP_NO, currentDate, currentTime, currentDate2) {
async function insertDeliveryHTable(_payCode, _fCustCode, _pCustCode, _hRemark, _empNo, _dateYYYY, _timeHHmm, _dateYY) {
    var loading = "insertDeliveryHTable "
    loading += "- pending"
    // console.log(loading);
    //const DVR_NO = await createDvrNo(TO_CUST, _dvrDate2)
    const ls_DvrNo = await createDvrNo(_pCustCode, _dateYY)
    try {
        var ls_sqlQuery = `
INSERT INTO DELIVERY_H_TBL (DVR_NO, DVR_DATE, DVR_TIME, PAY_CODE, EMP_NO,
                            P_CUST_CODE, F_CUST_CODE, REC_EMP_NO)
  VALUES ('${ls_DvrNo}', '${_dateYYYY}', '${_timeHHmm}', '${_payCode}', '${_empNo}',
          '${_pCustCode}', '${_fCustCode}', '');
INSERT INTO DELIVERY_H_REMARK_TBL (DVR_NO, REMARK) VALUES ('${ls_DvrNo}', '${_hRemark}');`

        await new mssql.Request().query(ls_sqlQuery)

    } catch (error) {
        console.error(`Error executing query: ${loading}`, error);

    }
    loading += " - done"
    // console.log(loading);
    return ls_DvrNo
}

async function insertInHTable(_payCode, _fCustCode, _pCustCode, _hRemark, _empNo, _dateYYYY, _timeHHmm, _dateYY) {
    var loading = "insertInHTable "
    loading += "- pending"
    // console.log(loading);
    const ls_InNo = await createInNo(_pCustCode, _dateYY)
    try {
        var ls_sqlQuery = `
INSERT INTO IN_H_TBL (IN_NO, IN_DATE, IN_TIME, PAY_CODE, EMP_NO, 
                     P_CUST_CODE, F_CUST_CODE)
  VALUES ('${ls_InNo}', '${_dateYYYY}', '${_timeHHmm}', '${_payCode}', '${_empNo}', 
          '${_pCustCode}', '${_fCustCode}');
INSERT INTO IN_H_REMARK_TBL (IN_NO, REMARK) VALUES('${ls_InNo}', '${_hRemark}')`
        await new mssql.Request().query(ls_sqlQuery)

    } catch (error) {
        console.error(`Error executing query: ${loading}`, error);

    }
    loading += " - done"
    // console.log(loading);
    return ls_InNo
}

async function createDvrNo(_fCustCode, _dateYY) {
    var loading = "createDvrNo "
    loading += "- pending"
    // console.log(loading);
    var tempDvrNo = _fCustCode + _dateYY
    var ls_sqlQuery = `SELECT DVR_NO FROM DELIVERY_H_TBL WHERE DVR_NO LIKE '${tempDvrNo}%'`
    var result = await new mssql.Request().query(ls_sqlQuery)
    var rows = result.recordset
    if (rows.length == 0) {
        tempDvrNo += "0001"
    } else {
        var newIndex = parseInt(String(rows[rows.length - 1]["DVR_NO"]).slice(-4)) + 1
        tempDvrNo += String(newIndex).padStart(4, 0)
    }
    loading += " - done"
    // console.log(loading);
    return tempDvrNo
}

async function createInNo(_pCustCode, _dateYY) {
    var loading = "createInNo "
    loading += "- pending"
    // console.log(loading);
    var tempInNo = _pCustCode + _dateYY
    var ls_sqlQuery = `SELECT IN_NO FROM IN_H_TBL WHERE IN_NO LIKE '${tempInNo}%'`
    var result = await new mssql.Request().query(ls_sqlQuery)
    var rows = result.recordset
    if (rows.length == 0) {
        tempInNo += "0001"
    } else {
        var newIndex = parseInt(String(rows[rows.length - 1]["IN_NO"]).slice(-4)) + 1
        tempInNo += String(newIndex).padStart(4, 0)
    }
    loading += " - done"
    // console.log(loading);
    return tempInNo
}

async function insert2DelevryDTable(_dvrNo, _prdCode, _dvrQty, _dvrCost, _dvrPrice) {
    var loading = "insert2DelevryDTable "
    loading += "- pending"
    // console.log(loading);
    try {
        var ls_sqlQuery = `
INSERT INTO DELIVERY_D_TBL (DVR_NO, SEQ_NO, PRODUCT_CODE, DVR_QTY, DVR_COST, 
                            DVR_PRICE, DVR_D_REMARK)
VALUES ('${_dvrNo}', 1, '${_prdCode}', ${_dvrQty}, ${_dvrCost}, 
          ${_dvrPrice}, '')`

        await new mssql.Request().query(ls_sqlQuery)
    } catch (error) {
        console.error(`Error executing query: ${loading}`, error);

    }
    loading += " - done"
    // console.log(loading);

}

async function insert2InDTable(_inNo, _prdCode, _inQty, _inCost, _inPrice, _inHNote, _prdCost) {
    var loading = "insert2InDTable "
    loading += "- pending"
    // console.log(loading);
    try {
        var ls_sqlQuery = `
INSERT INTO IN_D_TBL (IN_NO, SEQ_NO, PRODUCT_CODE, IN_QTY, IN_COST,
                      IN_PRICE, IN_D_REMARK, PRODUCT_COST)
  VALUES ('${_inNo}', 1, '${_prdCode}', ${_inQty}, ${_inCost}, 
          ${_inPrice}, '${_inHNote}', ${_prdCost})`
        console.log(ls_sqlQuery);
        await new mssql.Request().query(ls_sqlQuery)
    } catch (error) {
        console.error(`Error executing query: ${loading}`, error);

    }
    loading += " - done"
    // console.log(loading);
}

async function stockMove(_dvrNo, _inNo, _fCustCode, _pCustCode, _dateYYYY, _prdCode, _dvrQty, _prdCost) {
    var loading = "stockMove "
    loading += "- pending"
    // console.log(loading);
    var totalOutQty = parseFloat(_dvrQty)
    var totalPrice = 0
    var dvrSeqNo = 0
    try {
        var ls_sqlQuery = `
SELECT A.IN_NO, A.SEQ_NO, A.INOUT_DATE, A.INOUT_COST, A.INOUT_QTY AS IN_QTY,
         ISNULL((SELECT SUM(INOUT_QTY) 
         FROM PRD_STOCK_TBL WITH(NOLOCK) 
         WHERE IN_NO = A.IN_NO AND SEQ_NO = A.SEQ_NO AND INOUT_SEQ > 0),0) AS OUT_QTY
 FROM PRD_STOCK_TBL A WITH(NOLOCK)
WHERE A.P_CUST_CODE = '${_fCustCode}'
  AND A.PRODUCT_CODE = '${_prdCode}'
  AND A.INOUT_SEQ = 0
  AND A.END_YN <> 'Y'
ORDER BY INOUT_DATE`
        var result = await new mssql.Request().query(ls_sqlQuery)
        var rows = result.recordset
        if (rows.length == 0) {
            await stockTabelDelivery(_fCustCode, _prdCode, _dvrQty, _prdCost, _dateYYYY)
            await stockTableIn(_pCustCode, _prdCode, _dvrQty, _prdCost, _dateYYYY)
            await productStockIn(_inNo, _prdCode, _pCustCode, _fCustCode, _dvrQty, _prdCost, _dateYYYY)
            totalOutQty = 0
        } else {
            for (const row of rows) {
                if (totalOutQty <= 0) break
                var tempQty = Math.round(parseFloat(row["IN_QTY"]) - parseFloat(row["OUT_QTY"]), 3)
                var tempCost = parseFloat(row["INOUT_COST"])
                console.log(row["IN_QTY"], row["OUT_QTY"]);
                if (totalOutQty >= tempQty) {
                    await productStockTableDelivery(row["IN_NO"], parseInt(row["SEQ_NO"]), _dvrNo, dvrSeqNo, _prdCode, _fCustCode, _pCustCode, tempQty, tempCost, _dateYYYY)
                    await productStockIn(_inNo, _prdCode, _pCustCode, _fCustCode, tempQty, tempCost, _dateYYYY)
                    await stockTabelDelivery(_fCustCode, _prdCode, tempQty, tempCost, _dateYYYY)
                    await stockTableIn(_pCustCode, _prdCode, tempQty, tempCost, _dateYYYY)
                    totalPrice += tempQty * tempCost
                    totalOutQty -= tempQty
                } else {
                    await productStockTableDelivery(row["IN_NO"], row["SEQ_NO"], _dvrNo, dvrSeqNo, _prdCode, _fCustCode, _pCustCode, totalOutQty, tempCost, _dateYYYY)
                    await productStockIn(_inNo, _prdCode, _pCustCode, _fCustCode, totalOutQty, tempCost, _dateYYYY)
                    await stockTabelDelivery(_fCustCode, _prdCode, totalOutQty, tempCost, _dateYYYY)
                    await stockTableIn(_pCustCode, _prdCode, totalOutQty, tempCost, _dateYYYY)
                    totalPrice += tempQty * tempCost
                    totalOutQty -= tempQty
                }
            }
        }
        if (totalOutQty > 0) {
            await productStockIn(_inNo, _prdCode, _pCustCode, _fCustCode, totalOutQty, _prdCode, _dateYYYY)
            await stockTabelDelivery(_dateYYYY, _inNo, _prdCode, _fCustCode, totalOutQty, _prdCode)
            await stockTableIn(_pCustCode, _prdCode, totalOutQty, tempCost, _dateYYYY)
        }
    } catch (error) {
        console.error(`Error executing query: ${loading}`, error);

    }
    loading += " - done"
    // console.log(loading);
}

async function stockTabelDelivery(_fCustCode, _prdCode, _dvrQty, _prdCost, _dateYYYY) {
    var loading = "stockTabelDelivery "
    loading += "- pending"
    // console.log(loading);
    var dvrPrice = parseFloat(_dvrQty) * parseFloat(_prdCost)
    try {
        var ls_sqlQuery = `
        SELECT (SELECT COUNT(*) FROM STOCK_TBL WITH(NOLOCK) WHERE CUST_CODE = '${_fCustCode}' AND PRODUCT_CODE = '${_prdCode}') AS TOT_CNT,
               (SELECT COUNT(*) FROM STOCK_TBL WITH(NOLOCK) WHERE CUST_CODE = '${_fCustCode}' AND PRODUCT_CODE = '${_prdCode}' AND STOCK_DATE = '${_dateYYYY}') AS DATE_CNT,
               (SELECT COUNT(*) FROM STOCK_TBL WITH(NOLOCK) WHERE CUST_CODE = '${_fCustCode}' AND PRODUCT_CODE = '${_prdCode}' AND STOCK_DATE > '${_dateYYYY}') AS DATE_HIGH_CNT,
               (SELECT COUNT(*) FROM STOCK_TBL WITH(NOLOCK) WHERE CUST_CODE = '${_fCustCode}' AND PRODUCT_CODE = '${_prdCode}' AND STOCK_DATE < '${_dateYYYY}') AS DATE_LOW_CNT`

        var result = await new mssql.Request().query(ls_sqlQuery)
        var row = result.recordset[0]

        const totalCount = row["TOT_CNT"]
        const dateCount = row["DATE_CNT"]
        const dateHighCount = row["DATE_HIGH_CNT"]
        const dateLowCount = row["DATE_LOW_CNT"]
        if (totalCount == "0") {
            var ls_sqlQuery = `
INSERT INTO STOCK_TBL (CUST_CODE, PRODUCT_CODE, STOCK_DATE, TRANS_QTY, TRANS_PRICE,
                       IN_QTY, IN_PRICE, OUT_QTY, OUT_PRICE,STOCK_QTY, STOCK_PRICE
                      )
 VALUES ('${_fCustCode}', '${_prdCode}', '00000000', 0, 0,
         0, 0, 0, 0, 0, 0 )`
            await new mssql.Request().query(ls_sqlQuery)
        }

        if (dateCount == "0" && dateHighCount == "0") {
            if (dateLowCount == "0") {
                var ls_sqlQuery = `
INSERT INTO STOCK_TBL (CUST_CODE, PRODUCT_CODE, STOCK_DATE, TRANS_QTY, TRANS_PRICE,
                       IN_QTY, IN_PRICE, OUT_QTY, OUT_PRICE, STOCK_QTY, STOCK_PRICE)
 VALUES ('${_fCustCode}', '${_prdCode}', '${_dateYYYY}', 0, 0,
         0,0, ${_dvrQty}, ${dvrPrice}, -${_dvrQty}, -${dvrPrice})`

                await new mssql.Request().query(ls_sqlQuery)
            } else {

                var ls_sqlQuery = `
INSERT INTO STOCK_TBL (CUST_CODE, PRODUCT_CODE, STOCK_DATE, TRANS_QTY, TRANS_PRICE,
                       IN_QTY, IN_PRICE, OUT_QTY, OUT_PRICE, STOCK_QTY, STOCK_PRICE)
SELECT TOP 1 CUST_CODE, PRODUCT_CODE, '${_dateYYYY}', STOCK_QTY, STOCK_PRICE,
            0, 0, ${_dvrQty}, ${dvrPrice}, STOCK_QTY - ${_dvrQty}, STOCK_PRICE - ${dvrPrice}
   FROM STOCK_TBL
  WHERE CUST_CODE = '${_fCustCode}'
    AND PRODUCT_CODE = '${_prdCode}'
    AND STOCK_DATE < '${_dateYYYY}'
  ORDER BY STOCK_DATE DESC`
                await new mssql.Request().query(ls_sqlQuery)
            }
        } else if (dateCount != "0" && dateHighCount == "0") {

            var ls_sqlQuery = `
UPDATE STOCK_TBL SET OUT_QTY = OUT_QTY + ${_dvrQty},
                     OUT_PRICE = OUT_PRICE + ${dvrPrice},
                     STOCK_QTY = STOCK_QTY - ${_dvrQty},
                     STOCK_PRICE = STOCK_PRICE - ${dvrPrice}
WHERE CUST_CODE = '${_fCustCode}'
  AND PRODUCT_CODE = '${_prdCode}'
  AND STOCK_DATE = '${_dateYYYY}'`

            await new mssql.Request().query(ls_sqlQuery)
        } else if (dateCount != "0" && dateHighCount != "0") {

            var ls_sqlQuery = `
SELECT STOCK_DATE 
  FROM STOCK_TBL WITH(NOLOCK)
 WHERE CUST_CODE = '${_fCustCode}'
   AND PRODUCT_CODE = '${_prdCode}'
   AND STOCK_DATE >= '${_dateYYYY}'
 ORDER BY STOCK_DATE`

            var result = await new mssql.Request().query(ls_sqlQuery)
            var rows = result.recordset

            for (const row of rows) {
                var stockDate = row["STOCK_DATE"]
                if (_dateYYYY == stockDate) {
                    var ls_sqlQuery = `
UPDATE STOCK_TBL SET OUT_QTY = OUT_QTY + ${_dvrQty},
                     OUT_PRICE = OUT_PRICE + ${dvrPrice},
                     STOCK_QTY = STOCK_QTY - ${_dvrQty},
                     STOCK_PRICE = STOCK_PRICE - ${dvrPrice}
 WHERE CUST_CODE = '${_fCustCode}'
   AND PRODUCT_CODE = '${_prdCode}'
   AND STOCK_DATE = '${stockDate}'`

                    await new mssql.Request().query(ls_sqlQuery)
                } else {
                    var ls_sqlQuery = `
UPDATE STOCK_TBL SET TRANS_QTY = TRANS_QTY - ${_dvrQty},
                     TRANS_PRICE = TRANS_PRICE - ${dvrPrice},
                     STOCK_QTY = STOCK_QTY - ${_dvrQty},
                     STOCK_PRICE = STOCK_PRICE - ${dvrPrice}
 WHERE CUST_CODE = '${_fCustCode}'
   AND PRODUCT_CODE = '${_prdCode}'
   AND STOCK_DATE = '${stockDate}'`

                    await new mssql.Request().query(ls_sqlQuery)
                }
            }
        } else if (dateCount == "0" && dateHighCount != "0") {
            if (dateCount == "0") {
                var ls_sqlQuery = `
INSERT INTO STOCK_TBL (CUST_CODE, PRODUCT_CODE, STOCK_DATE, TRANS_QTY, TRANS_PRICE,
                       IN_QTY, IN_PRICE, OUT_QTY, OUT_PRICE, STOCK_QTY, STOCK_PRICE)
VALUES ('${_fCustCode}', '${_prdCode}', '${_dateYYYY}', 0, 0,
        0,0, ${_dvrQty}, ${dvrPrice}, -${_dvrQty}, -${dvrPrice})`

                await new mssql.Request().query(ls_sqlQuery)
            } else {
                var ls_sqlQuery = `
INSERT INTO STOCK_TBL (CUST_CODE, PRODUCT_CODE, STOCK_DATE, TRANS_QTY, TRANS_PRICE,
                       IN_QTY, IN_PRICE, OUT_QTY, OUT_PRICE, STOCK_QTY, STOCK_PRICE)
SELECT TOP 1 CUST_CODE, PRODUCT_CODE, '${_dateYYYY}', STOCK_QTY, STOCK_PRICE,
             0, 0, ${_dvrQty}, ${dvrPrice}, STOCK_QTY - ${_dvrQty}, STOCK_PRICE - ${dvrPrice}
 FROM STOCK_TBL
WHERE CUST_CODE = '${_fCustCode}'
  AND PRODUCT_CODE = '${_prdCode}'
  AND STOCK_DATE < '${_dateYYYY}'
ORDER BY STOCK_DATE DESC`
                await new mssql.Request().query(ls_sqlQuery)
            }
        }
        await stockCustTableUpload(_fCustCode, _prdCode)
    } catch (error) {
        console.error(`Error executing query: ${loading}`, error);

    }
    loading += " - done"
    // console.log(loading);
}

async function stockTableIn(_pCustCode, _prdCode, _dvrQty, _prdCost, _dateYYYY) {
    var loading = "stockTableIn "
    loading += "- pending"
    // console.log(loading);
    var inPrice = parseFloat(_dvrQty) * parseFloat(_prdCost)
    try {
        var ls_sqlQuery = `SELECT 
        (SELECT COUNT(*) FROM STOCK_TBL WITH(NOLOCK) WHERE CUST_CODE = '${_pCustCode}' AND PRODUCT_CODE = '${_prdCode}') AS TOT_CNT,
        (SELECT COUNT(*) FROM STOCK_TBL WITH(NOLOCK) WHERE CUST_CODE = '${_pCustCode}' AND PRODUCT_CODE = '${_prdCode}' AND STOCK_DATE = '${_dateYYYY}') AS DATE_CNT,
        (SELECT COUNT(*) FROM STOCK_TBL WITH(NOLOCK) WHERE CUST_CODE = '${_pCustCode}' AND PRODUCT_CODE = '${_prdCode}' AND STOCK_DATE > '${_dateYYYY}') AS DATE_HIGH_CNT,
        (SELECT COUNT(*) FROM STOCK_TBL WITH(NOLOCK) WHERE CUST_CODE = '${_pCustCode}' AND PRODUCT_CODE = '${_prdCode}' AND STOCK_DATE < '${_dateYYYY}') AS DATE_LOW_CNT`
        var result = await new mssql.Request().query(ls_sqlQuery)
        var row = result.recordset[0]

        const totalCount = row["TOT_CNT"]
        const dateCount = row["DATE_CNT"]
        const dateHighCount = row["DATE_HIGH_CNT"]
        const dateLowCount = row["DATE_LOW_CNT"]
        console.log(`totalCount: ${totalCount}  dateCount: ${dateCount} dateHighCount: ${dateHighCount} dateLowCount: ${dateLowCount}`);
        if (totalCount == "0") {
            var ls_sqlQuery = `
INSERT INTO STOCK_TBL (CUST_CODE, PRODUCT_CODE, STOCK_DATE, TRANS_QTY, TRANS_PRICE,
                       IN_QTY, IN_PRICE, OUT_QTY, OUT_PRICE, STOCK_QTY, STOCK_PRICE)
VALUES ('${_pCustCode}', '${_prdCode}', '${_dateYYYY}', 0, 0,
        ${_dvrQty}, ${inPrice}, 0, 0, ${_dvrQty}, ${inPrice})`

            await new mssql.Request().query(ls_sqlQuery)
        }
        if (dateCount == "0" && dateHighCount == "0") {
            if (dateLowCount == "0") {
                var ls_sqlQuery = `
INSERT INTO STOCK_TBL (CUST_CODE, PRODUCT_CODE, STOCK_DATE, TRANS_QTY, TRANS_PRICE,
                       IN_QTY, IN_PRICE, OUT_QTY, OUT_PRICE, STOCK_QTY, STOCK_PRICE)
VALUES ('${_pCustCode}', '${_prdCode}', '${_dateYYYY}', 0, 0,
        ${_dvrQty}, ${inPrice}, 0, 0, ${_dvrQty}, ${inPrice})`
                console.log(ls_sqlQuery);
                await new mssql.Request().query(ls_sqlQuery)
            } else {
                var ls_sqlQuery = `
INSERT INTO STOCK_TBL (CUST_CODE, PRODUCT_CODE, STOCK_DATE, TRANS_QTY, TRANS_PRICE,
                       IN_QTY, IN_PRICE, OUT_QTY, OUT_PRICE, STOCK_QTY, STOCK_PRICE)
SELECT TOP 1 CUST_CODE, PRODUCT_CODE, '${_dateYYYY}', STOCK_QTY, STOCK_PRICE,
                    ${_dvrQty}, ${inPrice}, 0, 0, STOCK_QTY + ${_dvrQty}, STOCK_PRICE + ${inPrice}
  FROM STOCK_TBL
 WHERE CUST_CODE = '${_pCustCode}'
   AND PRODUCT_CODE = '${_prdCode}'
   AND STOCK_DATE < '${_dateYYYY}'
 ORDER BY STOCK_DATE DESC`
                console.log(ls_sqlQuery);
                await new mssql.Request().query(ls_sqlQuery)
            }
        } else if (dateCount != "0" && dateHighCount != "0") {
            var ls_sqlQuery = `
UPDATE STOCK_TBL SET IN_QTY = IN_QTY + ${_dvrQty},
                    IN_PRICE = IN_PRICE + ${inPrice},
                    STOCK_QTY = STOCK_QTY + ${_dvrQty},
                    STOCK_PRICE = STOCK_PRICE + ${inPrice}
WHERE CUST_CODE = '${_pCustCode}'
  AND PRODUCT_CODE = '${_prdCode}'
  AND STOCK_DATE = '${_dateYYYY}'`
            console.log(ls_sqlQuery);
            await new mssql.Request().query(ls_sqlQuery)
        } else if (dateCount != "0" && dateHighCount != "0") {
            var ls_sqlQuery = `
SELECT STOCK_DATE FROM STOCK_TBL WITH(NOLOCK)
 WHERE CUST_CODE = '${_pCustCode}'
   AND PRODUCT_CODE = '${_prdCode}'
   AND STOCK_DATE >= '${_dateYYYY}'
 ORDER BY STOCK_DATE`
            console.log(ls_sqlQuery);
            var result = await new mssql.Request().query(ls_sqlQuery)
            var rows = result.recordset

            for (const row of rows) {
                var stockDate = row["STOCK_DATE"]
                if (_dateYYYY == stockDate) {
                    var ls_sqlQuery = `
UPDATE STOCK_TBL SET IN_QTY = IN_QTY + ${_dvrQty},
                     IN_PRICE = IN_PRICE + ${inPrice},
                     STOCK_QTY = STOCK_QTY + ${_dvrQty},
                     STOCK_PRICE = STOCK_PRICE + ${inPrice}
 WHERE CUST_CODE = '${_pCustCode}'
   AND PRODUCT_CODE = '${_prdCode}'
   AND STOCK_DATE = '${stockDate}'`
                    console.log(ls_sqlQuery);
                    await new mssql.Request().query(ls_sqlQuery)
                } else {
                    var ls_sqlQuery = `
UPDATE STOCK_TBL SET TRANS_QTY = TRANS_QTY + ${_dvrQty},
                     TRANS_PRICE = TRANS_PRICE + ${inPrice},
                     STOCK_QTY = STOCK_QTY + ${_dvrQty},
                     STOCK_PRICE = STOCK_PRICE + ${inPrice}
 WHERE CUST_CODE = '${_pCustCode}'
   AND PRODUCT_CODE = '${_prdCode}'
   AND STOCK_DATE = '${stockDate}'`
                    console.log(ls_sqlQuery);
                    await new mssql.Request().query(ls_sqlQuery)
                }
            }
        } else if (dateCount == "0" && dateHighCount != "0") {
            var ls_sqlQuery = `
INSERT INTO STOCK_TBL (CUST_CODE, PRODUCT_CODE, STOCK_DATE, TRANS_QTY, TRANS_PRICE,
                       IN_QTY, IN_PRICE, OUT_QTY, OUT_PRICE, STOCK_QTY, STOCK_PRICE)
SELECT TOP 1 CUST_CODE, PRODUCT_CODE, '${_dateYYYY}', STOCK_QTY, STOCK_PRICE,
            ${_dvrQty}, ${inPrice}, 0, 0, STOCK_QTY + ${_dvrQty}, STOCK_PRICE + ${inPrice}
  FROM STOCK_TBL
 WHERE CUST_CODE = '${_pCustCode}'
   AND PRODUCT_CODE = '${_prdCode}'
   AND STOCK_DATE < '${_dateYYYY}'
 ORDER BY STOCK_DATE DESC`
            console.log(ls_sqlQuery);
            await new mssql.Request().query(ls_sqlQuery)

            var ls_sqlQuery = `
UPDATE STOCK_TBL SET TRANS_QTY = TRANS_QTY + ${_dvrQty},
                     TRANS_PRICE = TRANS_PRICE + ${inPrice},
                     STOCK_QTY = STOCK_QTY + ${_dvrQty},
                     STOCK_PRICE = STOCK_PRICE + ${inPrice}
 WHERE CUST_CODE = '${_pCustCode}'
   AND PRODUCT_CODE = '${_prdCode}'
   AND STOCK_DATE > '${_dateYYYY}'`
            console.log(ls_sqlQuery);
            await new mssql.Request().query(ls_sqlQuery)
        } else if (dateCount != "0" && dateHighCount == "0") {
            var ls_sqlQuery = `
UPDATE STOCK_TBL SET IN_QTY = IN_QTY + ${_dvrQty},
                     IN_PRICE = IN_PRICE + ${inPrice},
                     STOCK_QTY = STOCK_QTY + ${_dvrQty},
                     STOCK_PRICE = STOCK_PRICE + ${inPrice}
 WHERE CUST_CODE = '${_pCustCode}'
   AND PRODUCT_CODE = '${_prdCode}'
   AND STOCK_DATE = '${_dateYYYY}'`
            console.log(ls_sqlQuery);
            await new mssql.Request().query(ls_sqlQuery)
        }
        await stockCustTableUpload(_pCustCode, _prdCode)
    }
    catch (error) {
        console.error(`Error executing query: ${loading}`, error);

    }
    loading += " - done"
    // console.log(loading);
}

async function productStockIn(_inNo, _prdCode, _pCustCode, _fCustCode, _dvrQty, _prdCost, _dateYYYY) {
    var loading = "productStockIn "
    loading += "- pending"
    // console.log(loading);

    try {
        var ls_sqlQuery = `
INSERT INTO PRD_STOCK_TBL (IN_NO, SEQ_NO, INOUT_SEQ, PRODUCT_CODE, INOUT_QTY, INOUT_COST,
                           P_CUST_CODE, F_CUST_CODE, INOUT_DATE, DVR_NO, DVR_SEQ, END_YN)
SELECT '${_inNo}', ISNULL(MAX(SEQ_NO),0) + 1, 0, '${_prdCode}', ${_dvrQty}, ${_prdCost},
       '${_pCustCode}', '${_fCustCode}', '${_dateYYYY}', '', 0, 'N'
  FROM PRD_STOCK_TBL WITH(NOLOCK)
 WHERE IN_NO = '${_inNo}' `
        console.log(ls_sqlQuery);
        await new mssql.Request().query(ls_sqlQuery)
    } catch (error) {
        console.error(`Error executing query: ${loading}`, error);

    }
    loading += " - done"
    // console.log(loading);
}

async function productStockTableDelivery(_inNo, _inSeqNo, _dvrNo, _dvrSeqNo, _prdCode, _fCustCode, _pCustCode, _qty, _cost, _dateYYYY) {
    var loading = "productStockTableDelivery "
    loading += "- pending"
    // console.log(loading);

    try {
        var ls_sqlQuery = `
INSERT INTO PRD_STOCK_TBL (IN_NO, SEQ_NO, INOUT_SEQ, PRODUCT_CODE, INOUT_QTY, 
                           INOUT_COST, P_CUST_CODE, F_CUST_CODE, INOUT_DATE, DVR_NO,
                           DVR_SEQ, END_YN
                          )
SELECT '${_inNo}',${_inSeqNo}, ISNULL(MAX(INOUT_SEQ),0) + 1,  '${_prdCode}', ${_qty}, 
       ${_cost}, '${_pCustCode}', '${_fCustCode}', '${_dateYYYY}', '${_dvrNo}', 
       ${_dvrSeqNo}, 'N'
  FROM PRD_STOCK_TBL WITH(NOLOCK)
 WHERE IN_NO = '${_inNo}' 
   AND SEQ_NO = ${_inSeqNo}`
        await new mssql.Request().query(ls_sqlQuery)

        ls_sqlQuery = `
SELECT (SELECT INOUT_QTY 
          FROM PRD_STOCK_TBL WITH(NOLOCK)
         WHERE IN_NO = '${_inNo}' 
           AND SEQ_NO = ${_inSeqNo} 
           AND PRODUCT_CODE = '${_prdCode}' 
           AND INOUT_SEQ = 0
       ) AS IN_QTY,
       (SELECT SUM(INOUT_QTY) 
          FROM PRD_STOCK_TBL WITH(NOLOCK)
         WHERE IN_NO = '${_inNo}' 
           AND SEQ_NO = ${_inSeqNo} 
           AND PRODUCT_CODE = '${_prdCode}' 
           AND INOUT_SEQ > 0
       ) AS OUT_QTY`
        var result = await new mssql.Request().query(ls_sqlQuery)
        var row = result.recordset[0]
        var inQty = parseFloat(row["IN_QTY"])
        var outQty = parseFloat(row["OUT_QTY"])

        if (inQty <= outQty) {
            var ls_sqlQuery = `
UPDATE PRD_STOCK_TBL SET  END_YN = 'Y' 
 WHERE IN_NO = '${_inNo}' 
   AND SEQ_NO = ${_inSeqNo}`
            await new mssql.Request().query(ls_sqlQuery)
        }

    } catch (error) {
        console.error(`Error executing query: ${loading}`, error);

    }
    loading += " - done"
    // console.log(loading);
}

async function stockCustTableUpload(_custCode, _prdCode) {
    var loading = "stockCustTableUpload "
    loading += "- pending"
    // console.log(loading);
    ls_sqlQuery = `
SELECT STOCK_QTY, STOCK_PRICE 
  FROM STOCK_TBL WITH(NOLOCK)
 WHERE CUST_CODE = '${_custCode}' 
   AND PRODUCT_CODE = '${_prdCode}'
   AND STOCK_DATE = (SELECT MAX(STOCK_DATE) 
                       FROM STOCK_TBL WITH(NOLOCK) 
                      WHERE CUST_CODE ='${_custCode}' 
                        AND PRODUCT_CODE = '${_prdCode}')`
    var result = await new mssql.Request().query(ls_sqlQuery)
    var rows = result.recordset

    if (rows.length == 0) return

    var stockQty = parseFloat(rows[0]["STOCK_QTY"])
    var stockPrice = parseFloat(rows[0]["STOCK_PRICE"])

    if (stockQty == 0) {
        var ls_sqlQuery = `DELETE FROM STOCK_CUST_TBL WHERE CUST_CODE = '${_custCode}' AND PRODUCT_CODE = '${_prdCode}'`
        await new mssql.Request().query(ls_sqlQuery)
    } else {
        ls_sqlQuery = `
        SELECT COUNT(*) AS CNT 
          FROM STOCK_CUST_TBL WITH(NOLOCK) 
         WHERE CUST_CODE = '${_custCode}' 
           AND PRODUCT_CODE = '${_prdCode}'`
        var result = await new mssql.Request().query(ls_sqlQuery)
        var row = result.recordset[0]
        var count = row["CNT"]

        if (count == "0") {
            var ls_sqlQuery = `
INSERT INTO STOCK_CUST_TBL (CUST_CODE, PRODUCT_CODE, STOCK_QTY, STOCK_PRICE)
VALUES ('${_custCode}','${_prdCode}',${stockQty},${stockPrice})`
            await new mssql.Request().query(ls_sqlQuery)
        } else {
            var ls_sqlQuery = `
UPDATE STOCK_CUST_TBL SET STOCK_QTY = ${stockQty},
                          STOCK_PRICE = ${stockPrice}
 WHERE CUST_CODE = '${_custCode}' 
   AND PRODUCT_CODE = '${_prdCode}'`
            await new mssql.Request().query(ls_sqlQuery)
        }
    }
    loading += " - done"
    // console.log(loading);
}
async function fabricOut(_fCustCode, _fabricNo, _dvrQty, _dateYYYY, _timeHHmm, _empNo) {
    var loading = "fabricOut "
    loading += "- pending"
    // console.log(loading);
    var remark = "Update location"

    var ls_sqlQuery = `
DELETE FROM FABRIC_STOCK_TBL WHERE CUST_CODE = '${_fCustCode}' AND IN_NO = '${_fabricNo}';

INSERT INTO FABRIC_INOUT_TBL (IN_NO, SEQ_NO, INOUT_DIV, INOUT_QTY, REG_DATE,
                              REG_TIME, EMP_NO, REMARK)
SELECT '${_fabricNo}', ISNULL(MAX(SEQ_NO), 0) + 1, '2', ${_dvrQty}, '${_dateYYYY}', 
       '${_timeHHmm}', '${_empNo}', '${remark}'
 FROM FABRIC_INOUT_TBL WITH(NOLOCK)
WHERE IN_NO = '${_fabricNo}'`
    await new mssql.Request().query(ls_sqlQuery)
    var ls_sqlQuery = `
`
    await new mssql.Request().query(ls_sqlQuery)
    loading += " - done"
    // console.log(loading);
}

async function fabricIn(_fabricNo, _pCustCode, _prdCode, _dvrQty, _dateYYYY, _timeHHmm, _empNo, _impNp, _dvrNo, _remark, _dateYY) {
    var loading = "fabricIn "
    loading += "- pending"
    // console.log(loading);

    var li_seqNo = 1
    var li_inOutDiv = 1

    var ls_sqlQuery = `
UPDATE FABRIC_IN_TBL SET IN_DATE='${_dateYY}', 
                         IN_TIME='${_timeHHmm}', 
                         EMP_NO='${_empNo}' 
 WHERE IN_NO = '${_fabricNo}';


 UPDATE FABRIC_INOUT_TBL SET INOUT_QTY=${_dvrQty}, 
                            REG_DATE='${_dateYYYY}', 
                            REG_TIME='${_timeHHmm}', 
                            REMARK='${_remark}' 
 WHERE SEQ_NO=${li_seqNo} 
   AND INOUT_DIV=${li_inOutDiv};
  

INSERT INTO FABRIC_STOCK_TBL (CUST_CODE, IN_NO, STOCK_QTY) 
VALUES ('${_pCustCode}', '${_fabricNo}', ${_dvrQty})`
    await new mssql.Request().query(ls_sqlQuery)

    loading += " - done"
    // console.log(loading);
}

async function getFabricNo(req, res) {
    const prdCode = decodeURIComponent(req.query.PRODUCT_CODE) || "";
    if (prdCode.length == 0) {

        return res.json({ success: false, message: "PRODUCT_CODE must not be empty" });
    }
    try {
        var ls_sqlQuery = `
SELECT C.CUST_NAME,A.IN_NO,A.STOCK_QTY 
  FROM FABRIC_STOCK_TBL A LEFT JOIN FABRIC_IN_TBL B ON A.IN_NO = B.IN_NO 
                         LEFT JOIN CUSTOMER_TBL C ON C.CUST_CODE = A.CUST_CODE 
 WHERE B.PRODUCT_CODE='${prdCode}'`
        var result = await new mssql.Request().query(ls_sqlQuery);
        var rows = result.recordset
        var data = []
        if (rows.length == 0) return res.json({ success: true, message: "empty Data", data });
        for (const row of rows) {
            var js = {}
            js.CUST_NAME = row["CUST_NAME"]
            js.IN_NO = row["IN_NO"]
            js.STOCK_QTY = row["STOCK_QTY"]
            data.push(js)
        }
        res.json({ success: true, message: "SUCCESS", totalCount: rows.length, data });
    } catch (error) {
    }
}
module.exports.getFabricNo = getFabricNo


async function getCurrentFabricLocation(req, res) {
    const ls_fabricNo = decodeURIComponent(req.query.FABRIC_NO) || "";
    if (ls_fabricNo.length == 0) {

        return res.json({ success: false, message: "FABRIC_NO must not be empty" });
    }
    var ls_sqlQuery = `
    SELECT B.CUST_LGR_CODE, B.CUST_MID_CODE, B.CUST_SML_CODE, B.CUST_CODE, 
           C.CUST_LGR_NAME, D.CUST_MID_NAME, E.CUST_SML_NAME, B.CUST_NAME 
      FROM FABRIC_STOCK_TBL A LEFT JOIN CUSTOMER_TBL B ON A.CUST_CODE = B.CUST_CODE
                              LEFT JOIN CUST_LGR_TBL C ON B.CUST_LGR_CODE = C.CUST_LGR_CODE
                              LEFT JOIN CUST_MID_TBL D ON B.CUST_MID_CODE = D.CUST_MID_CODE AND D.CUST_LGR_CODE = B.CUST_LGR_CODE
                              LEFT JOIN CUST_SML_TBL E ON B.CUST_SML_CODE = E.CUST_SML_CODE AND E.CUST_MID_CODE = D.CUST_MID_CODE AND E.CUST_LGR_CODE = B.CUST_LGR_CODE
     WHERE A.IN_NO = '${ls_fabricNo}'`
    var result = await new mssql.Request().query(ls_sqlQuery);
    if (result.recordset.length == 0) {
        return res.json({ success: false, message: "Can not find location of this fabric roll" });
    }
    var row = result.recordset[0]
    res.json({ success: true, message: "SUCCESS", data: row });
}
module.exports.getCurrentFabricLocation = getCurrentFabricLocation

async function ProductionMove(req, res) {
    const ls_fCustCode = decodeURIComponent(req.body.FROM_CUST) || "";
    const ls_pCustCode = decodeURIComponent(req.body.TO_CUST) || "";
    const ls_empNo = decodeURIComponent(req.body.EMP_NO) || "";
    const ls_prdCode = decodeURIComponent(req.body.PRODUCT_CODE) || "";
    const li_prdQty = decodeURIComponent(req.body.PRODUCT_QTY) || "";
    const li_payCode = 20 // Move OUT
    const ls_dvrRemark = "Location Update"
    const ls_inHNote = ls_dvrRemark + "/Auto In Reg after Out Reg"
    try {
        const ls_dateYYYY = getCurrentDate(4)
        const ls_dateYY = getCurrentDate(2)
        const ls_timeHHmm = getCurrentTime()
        const lf_dvrCost = 0 // Move to local warehouse, it have no cost
        const lf_dvrQty = parseFloat(li_prdQty)
        const lf_dvrPrice = lf_dvrCost * lf_dvrQty
        const lf_prdCost = await getProductCost(ls_prdCode)
        const ls_dvrNo = await insertDeliveryHTable(li_payCode, ls_fCustCode, ls_pCustCode, ls_inHNote, ls_empNo, ls_dateYYYY, ls_timeHHmm, ls_dateYY)
        const ls_inNo = await insertInHTable(li_payCode, ls_fCustCode, ls_pCustCode, ls_inHNote, ls_empNo, ls_dateYYYY, ls_timeHHmm, ls_dateYY)

        await insert2DelevryDTable(ls_dvrNo, ls_prdCode, lf_dvrQty, lf_prdCost, lf_dvrPrice)
        await insert2InDTable(ls_inNo, ls_prdCode, lf_dvrQty, lf_dvrCost, lf_dvrPrice, ls_inHNote, lf_prdCost)
        await stockMove(ls_dvrNo, ls_inNo, ls_fCustCode, ls_pCustCode, ls_dateYYYY, ls_prdCode, lf_dvrQty, lf_prdCost)

        return res.json({ success: true, message: "SUCCESS" });
    } catch (error) {
        console.error(`Error executing query: `, error);
        res.status(500).json({ success: false, message: "An error occurred while processing the request" });

    }
}
module.exports.ProductionMove = ProductionMove

async function getProductStockInfo(req, res) {
    const ls_prdCode = decodeURIComponent(req.query.PRODUCT_CODE) || "";
    if (ls_prdCode == "") {
        return res.json({ success: false, message: "PRODUCT_CODE must not be empty" });
    }
    const H_CODE = 23 //Product Stock
    var ls_tempCondition = ""
    if (isNaN(parseInt(ls_prdCode.charAt(8)))) {
        ls_tempCondition = "D.BARCODE"
    } else {
        ls_tempCondition = "A.PRODUCT_CODE"
    }

    var ls_sqlQuery = `
    SELECT A.CUST_CODE, B.CUST_NAME, A.PRODUCT_CODE, A.STOCK_QTY, D.PRD_NAME, D.BARCODE, D.PRODUCT_COST, E.LGR_NAME, F.MID_NAME, G.DGN_NAME, H.COLOR_NAME 
      FROM STOCK_CUST_TBL A LEFT JOIN CUSTOMER_TBL B ON A.CUST_CODE = B.CUST_CODE
                            LEFT JOIN PMS_COMMON_CUST_D_TBL C ON A.CUST_CODE = C.CUST_CODE
                            LEFT JOIN PRODUCT_TBL D ON D.PRODUCT_CODE = A.PRODUCT_CODE
                            LEFT JOIN LGR_TBL E ON E.LGR_CODE = D.LGR_CODE
                            LEFT JOIN MID_TBL F ON F.MID_CODE = D.MID_CODE AND F.LGR_CODE = D.LGR_CODE
                            LEFT JOIN DESIGN_TBL G ON G.DGN_CODE = D.DGN_CODE
                            LEFT JOIN COLOR_TBL H ON H.COLOR_CODE = D.COLOR_CODE
    WHERE ${ls_tempCondition} ='${ls_prdCode}' 
      AND C.H_CODE='${H_CODE}'`
    var result = await new mssql.Request().query(ls_sqlQuery)
    var rows = result.recordset
    if (rows.length == 0) {
        return res.json({ success: false, message: "Just only finished product in stock" });
    }
    var data = []
    for (const row of rows) {
        var js = {}
        js.CUST_CODE = row["CUST_CODE"]
        js.CUST_NAME = row["CUST_NAME"]
        js.PRODUCT_CODE = row["PRODUCT_CODE"]
        js.STOCK_QTY = row["STOCK_QTY"]
        js.PRD_NAME = row["PRD_NAME"]
        js.PRODUCT_COST = row["PRODUCT_COST"]
        js.CATEGORY = row["LGR_NAME"] + " / " + row["MID_NAME"]
        js.DGN_NAME = row["DGN_NAME"]
        js.COLOR_NAME = row["COLOR_NAME"]
        js.BARCODE = row["BARCODE"]
        data.push(js)
    }
    res.json({ success: true, message: "SUCCESS", data });

}
module.exports.getProductStockInfo = getProductStockInfo

async function findProductByName(req, res) {
    const ls_prdName = decodeURIComponent(req.query.PRODUCT_NAME) || "";
    const H_CODE = 23 //Product Stock
    if (ls_prdName == "") {
        return res.json({ success: false, message: "PRODUCT_NAME must not be empty" });
    }
    var ls_sqlQuery = `
    SELECT A.PRODUCT_CODE, B.PRD_NAME 
      FROM STOCK_CUST_TBL A LEFT JOIN PRODUCT_TBL B ON A.PRODUCT_CODE = B.PRODUCT_CODE
                            LEFT JOIN PMS_COMMON_CUST_D_TBL E ON A.CUST_CODE = E.CUST_CODE
                            LEFT JOIN CUSTOMER_TBL C ON A.CUST_CODE = C.CUST_CODE
     WHERE B.PRD_NAME LIKE '%${ls_prdName}%'
       AND E.H_CODE='${H_CODE}'
     GROUP BY A.PRODUCT_CODE, B.PRD_NAME`
    var result = await new mssql.Request().query(ls_sqlQuery)
    var rows = result.recordset
    if (rows.length == 0) {
        return res.json({ success: false, message: "Can not find any product with that name" });
    }
    var data = []
    for (const row of rows) {
        var js = {}
        js.PRODUCT_CODE = row["PRODUCT_CODE"]
        js.PRD_NAME = row["PRD_NAME"]
        data.push(js)
    }
    res.json({ success: true, message: "SUCCESS", data });

}
module.exports.findProductByName = findProductByName