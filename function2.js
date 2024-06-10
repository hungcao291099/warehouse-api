let mssql;
function settingDb(mssqlConnect) {
    mssql = mssqlConnect;
}
module.exports.settingDb = settingDb;

async function updateFabricLocation(req, res) {
    const ls_fCustCode = decodeURIComponent(req.body.FROM_CUST) || "";
    const ls_pCustCode = decodeURIComponent(req.body.TO_CUST) || "";
    const ls_empNo = decodeURIComponent(req.body.EMP_NO) || "";
    const ls_productCode = decodeURIComponent(req.body.PRODUCT_CODE) || "";
    const li_prdQty = decodeURIComponent(req.body.PRODUCT_QTY) || "";
    const ls_fabricNo = decodeURIComponent(req.body.FABRIC_NO) || "";
    const ls_fabricImpNo = decodeURIComponent(req.body.IMP_NO) || "";
    const ls_fabricDvrNo = decodeURIComponent(req.body.DVR_NO) || "";
    const ls_fabricRemark = decodeURIComponent(req.body.REMARK) || "";
    const ls_OutpayCode = "20" // Move OUT
    const ls_InpayCode = "10" // Move IN
    const ls_dvrRemark = "Location Update"
    const ls_inHNote = ls_dvrRemark + "/Auto In Reg after Out Reg"
    const lf_productCost = await getProductCost(ls_productCode)

    try {
        const ls_date_YYYYMMdd = getCurrentDate(4)
        const ls_date_YYMMdd = getCurrentDate(2)
        const ls_time_HHmm = getCurrentTime()
        const lf_deliveryCost = 0 // Move to local warehouse, it have no cost
        const lf_deliveryQty = parseFloat(li_prdQty)
        const lf_deliveryPrice = lf_deliveryCost * lf_deliveryQty
        const ls_deliveryNo = await insertDeliveryHTable(ls_OutpayCode, ls_fCustCode, ls_pCustCode, ls_inHNote, ls_empNo, ls_date_YYYYMMdd, ls_time_HHmm, ls_date_YYMMdd)
        const ls_inNo = await insertInHTable(ls_InpayCode, ls_fCustCode, ls_pCustCode, ls_inHNote, ls_empNo, ls_date_YYYYMMdd, ls_time_HHmm, ls_date_YYMMdd)

        await insert2DelevryDTable(ls_deliveryNo, ls_productCode, lf_deliveryQty, lf_productCost, lf_deliveryPrice)
        await insert2InDTable(ls_inNo, ls_productCode, lf_deliveryQty, lf_deliveryCost, lf_deliveryPrice, "", lf_productCost)
        await stockMove(ls_deliveryNo, ls_inNo, ls_fCustCode, ls_pCustCode, ls_date_YYYYMMdd, ls_productCode, lf_deliveryQty, lf_productCost)
        await fabricOut(ls_fCustCode, ls_fabricNo, lf_deliveryQty, ls_date_YYYYMMdd, ls_time_HHmm, ls_empNo)
        await fabricIn(ls_fabricNo, ls_pCustCode, ls_productCode, lf_deliveryQty, ls_date_YYYYMMdd, ls_time_HHmm, ls_empNo, ls_fabricImpNo, ls_fabricDvrNo, ls_fabricRemark, ls_date_YYMMdd)
        return res.json({ success: true, message: "SUCCESS" });
    } catch (error) {
        console.error(`Error executing query: `, error);
        res.status(500).json({ success: false, message: "An error occurred while processing the request ", error: error.message });

    }



}
module.exports.updateFabricLocation = updateFabricLocation

function getCurrentDate(_yearLength) {
    const now = new Date();
    let ls_year
    if (_yearLength == 2) {
        ls_year = String(now.getFullYear()).slice(-2);
    } else {
        ls_year = now.getFullYear()
    }
    const ls_month = String(now.getMonth() + 1).padStart(2, '0'); // Adding 1 because getMonth() returns zero-based month
    const ls_day = String(now.getDate()).padStart(2, '0');
    return `${ls_year}${ls_month}${ls_day}`; //yyMMdd
}

function getCurrentTime() {
    const now = new Date();
    const ls_hour = String(now.getHours()).padStart(2, '0');
    const ls_minute = String(now.getMinutes()).padStart(2, '0');
    return `${ls_hour}${ls_minute}`; //HHmm

}
async function getProductCost(_productCode) {
    //  console.log("getProductCost - pending");
    let ls_sqlQuery = `SELECT PRODUCT_COST FROM PRODUCT_TBL WITH(NOLOCK) WHERE PRODUCT_CODE='${_productCode}'`
    let dt = await new mssql.Request().query(ls_sqlQuery)
    let dr = dt.recordset
    if (dr.length == 0) {
        return -1; // If the cost is -1, the user will recheck.
    }
    else {
        // console.log("getProductCost - pending - done");
        return dr[0]["PRODUCT_COST"]
    }
}

//async function insertDeliveryHTable(PAY_CODE, _fCustCode, TO_CUST, dvrRemark, EMP_NO, currentDate, currentTime, currentDate2) {
async function insertDeliveryHTable(_payCode, _fCustCode, _pCustCode, _hRemark, _empNo, _dateYYYY, _timeHHmm, _dateYY) {
    const ls_DeliveryNo = await createDvrNo(_pCustCode, _dateYY)
    try {
        let ls_sqlQuery = `
        INSERT INTO DELIVERY_H_TBL (DVR_NO, DVR_DATE, DVR_TIME, PAY_CODE, EMP_NO,
                                    P_CUST_CODE, F_CUST_CODE, REC_EMP_NO)
        VALUES ('${ls_DeliveryNo}', '${_dateYYYY}', '${_timeHHmm}', '${_payCode}', '${_empNo}',
                '${_pCustCode}', '${_fCustCode}', '');

        INSERT INTO DELIVERY_H_REMARK_TBL (DVR_NO, REMARK) VALUES ('${ls_DeliveryNo}', '${_hRemark}');`

        await new mssql.Request().query(ls_sqlQuery)

    } catch (error) {
        // console.log(error);
        throw error


    }
    return ls_DeliveryNo
}

async function insertInHTable(_payCode, _fCustCode, _pCustCode, _hRemark, _empNo, _dateYYYY, _timeHHmm, _dateYY) {
    const ls_InNo = await createInNo(_pCustCode, _dateYY)
    try {
        let ls_sqlQuery = `
        INSERT INTO IN_H_TBL (IN_NO, IN_DATE, IN_TIME, PAY_CODE, EMP_NO, 
                              P_CUST_CODE, F_CUST_CODE)
        VALUES ('${ls_InNo}', '${_dateYYYY}', '${_timeHHmm}', '${_payCode}', '${_empNo}', 
                '${_pCustCode}', '${_fCustCode}');

        INSERT INTO IN_H_REMARK_TBL (IN_NO, REMARK) VALUES('${ls_InNo}', '${_hRemark}')`
        await new mssql.Request().query(ls_sqlQuery)

    } catch (error) {
        // console.log(error);
        throw error


    }
    return ls_InNo
}

async function createDvrNo(_fCustCode, _dateYY) {
    let ls_tempDvrNo = _fCustCode + _dateYY
    let ls_sqlQuery = `SELECT DVR_NO FROM DELIVERY_H_TBL WHERE DVR_NO LIKE '${ls_tempDvrNo}%'`
    let dt = await new mssql.Request().query(ls_sqlQuery)
    let dr = dt.recordset
    if (dr.length == 0) {
        ls_tempDvrNo += "0001"
    } else {
        let newIndex = parseInt(String(dr[dr.length - 1]["DVR_NO"]).slice(-4)) + 1
        ls_tempDvrNo += String(newIndex).padStart(4, 0)
    }
    return ls_tempDvrNo
}

async function createInNo(_pCustCode, _dateYY) {
    let ls_tempInNo = _pCustCode + _dateYY
    let ls_sqlQuery = `SELECT IN_NO FROM IN_H_TBL WHERE IN_NO LIKE '${ls_tempInNo}%'`
    let dt = await new mssql.Request().query(ls_sqlQuery)
    let dr = dt.recordset
    if (dr.length == 0) {
        ls_tempInNo += "0001"
    } else {
        let newIndex = parseInt(String(dr[dr.length - 1]["IN_NO"]).slice(-4)) + 1
        ls_tempInNo += String(newIndex).padStart(4, 0)
    }
    return ls_tempInNo
}

async function insert2DelevryDTable(_dvrNo, _prdCode, _dvrQty, _dvrCost, _dvrPrice) {
    try {
        let ls_sqlQuery = `
        INSERT INTO DELIVERY_D_TBL (DVR_NO, SEQ_NO, PRODUCT_CODE, DVR_QTY, DVR_COST, 
                                    DVR_PRICE, DVR_D_REMARK)
        VALUES ('${_dvrNo}', 1, '${_prdCode}', ${_dvrQty}, ${_dvrCost}, 
                ${_dvrPrice}, '')`
        await new mssql.Request().query(ls_sqlQuery)
    } catch (error) {
        // console.log(error);
        throw error


    }

}

async function insert2InDTable(_inNo, _prdCode, _inQty, _inCost, _inPrice, _inHNote, _prdCost) {
    try {
        let ls_sqlQuery = `
        INSERT INTO IN_D_TBL (IN_NO, SEQ_NO, PRODUCT_CODE, IN_QTY, IN_COST,
                              IN_PRICE, IN_D_REMARK, PRODUCT_COST)
        VALUES ('${_inNo}', 1, '${_prdCode}', ${_inQty}, ${_inCost}, 
                ${_inPrice}, 'h', ${_prdCost})`
        await new mssql.Request().query(ls_sqlQuery)
    } catch (error) {
        // throw error
    }
}

async function stockMove(_dvrNo, _inNo, _fCustCode, _pCustCode, _dateYYYY, _prdCode, _dvrQty) {
    let lf_totalOutQty = parseFloat(_dvrQty)
    let lf_totalPrice = 0
    let ls_dvrSeqNo = 1
    const lf_productCost = await getProductCost(ls_productCode)
    try {
        let ls_sqlQuery = `
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
        let dt = await new mssql.Request().query(ls_sqlQuery)
        let dr = dt.recordset
        if (dr.length == 0) {
            await stockTabelDelivery(_fCustCode, _prdCode, _dvrQty, lf_productCost, _dateYYYY)
            await stockTableIn(_pCustCode, _prdCode, _dvrQty, lf_productCost, _dateYYYY)
            await productStockIn(_inNo, _prdCode, _pCustCode, _fCustCode, _dvrQty, lf_productCost, _dateYYYY)
            lf_totalOutQty = 0
        } else {
            for (const row of dr) {
                if (lf_totalOutQty <= 0) break

                let lf_tempQty = Math.round(parseFloat(row["IN_QTY"]) - parseFloat(row["OUT_QTY"]), 3)
                let lf_tempCost = parseFloat(row["INOUT_COST"])

                if (lf_totalOutQty >= lf_tempQty) {
                    await productStockTableDelivery(row["IN_NO"], parseInt(row["SEQ_NO"]), _dvrNo, ls_dvrSeqNo, _prdCode, _fCustCode, _pCustCode, lf_tempQty, lf_tempCost, _dateYYYY)
                    await productStockIn(_inNo, _prdCode, _pCustCode, _fCustCode, lf_tempQty, lf_tempCost, _dateYYYY)
                    await stockTabelDelivery(_fCustCode, _prdCode, lf_tempQty, lf_tempCost, _dateYYYY)
                    await stockTableIn(_pCustCode, _prdCode, lf_tempQty, lf_tempCost, _dateYYYY)
                    lf_totalPrice += lf_tempQty * lf_tempCost
                    lf_totalOutQty -= lf_tempQty
                } else {
                    await productStockTableDelivery(row["IN_NO"], row["SEQ_NO"], _dvrNo, ls_dvrSeqNo, _prdCode, _fCustCode, _pCustCode, lf_totalOutQty, lf_tempCost, _dateYYYY)
                    await productStockIn(_inNo, _prdCode, _pCustCode, _fCustCode, lf_totalOutQty, lf_tempCost, _dateYYYY)
                    await stockTabelDelivery(_fCustCode, _prdCode, lf_totalOutQty, lf_tempCost, _dateYYYY)
                    await stockTableIn(_pCustCode, _prdCode, lf_totalOutQty, lf_tempCost, _dateYYYY)
                    lf_totalPrice += lf_tempQty * lf_tempCost
                    lf_totalOutQty -= lf_tempQty
                }
            }
        }
        if (lf_totalOutQty > 0) {
            await productStockIn(_inNo, _prdCode, _pCustCode, _fCustCode, lf_totalOutQty, _prdCode, _dateYYYY)
            await stockTabelDelivery(_dateYYYY, _inNo, _prdCode, _fCustCode, lf_totalOutQty, _prdCode)
            await stockTableIn(_pCustCode, _prdCode, lf_totalOutQty, lf_tempCost, _dateYYYY)
        }
    } catch (error) {
        console.log("Error checking..", error);
        throw error


    }
}

async function stockTabelDelivery(_fCustCode, _prdCode, _dvrQty, _prdCost, _dateYYYY) {
    let lf_deliveryPrice = parseFloat(_dvrQty) * parseFloat(_prdCost)
    try {
        let ls_sqlQuery = `
        SELECT (SELECT COUNT(*) FROM STOCK_TBL WITH(NOLOCK) WHERE CUST_CODE = '${_fCustCode}' AND PRODUCT_CODE = '${_prdCode}') AS TOT_CNT,
               (SELECT COUNT(*) FROM STOCK_TBL WITH(NOLOCK) WHERE CUST_CODE = '${_fCustCode}' AND PRODUCT_CODE = '${_prdCode}' AND STOCK_DATE = '${_dateYYYY}') AS DATE_CNT,
               (SELECT COUNT(*) FROM STOCK_TBL WITH(NOLOCK) WHERE CUST_CODE = '${_fCustCode}' AND PRODUCT_CODE = '${_prdCode}' AND STOCK_DATE > '${_dateYYYY}') AS DATE_HIGH_CNT,
               (SELECT COUNT(*) FROM STOCK_TBL WITH(NOLOCK) WHERE CUST_CODE = '${_fCustCode}' AND PRODUCT_CODE = '${_prdCode}' AND STOCK_DATE < '${_dateYYYY}') AS DATE_LOW_CNT`

        let dt = await new mssql.Request().query(ls_sqlQuery)
        let dr = dt.recordset

        const li_totalCount = dr[0]["TOT_CNT"]
        const li_dateCount = dr[0]["DATE_CNT"]
        const li_dateHighCount = dr[0]["DATE_HIGH_CNT"]
        const li_dateLowCount = dr[0]["DATE_LOW_CNT"]
        if (li_totalCount == 0) {
            let ls_sqlQuery = `
            INSERT INTO STOCK_TBL (CUST_CODE, PRODUCT_CODE, STOCK_DATE, TRANS_QTY, TRANS_PRICE,
                                   IN_QTY, IN_PRICE, OUT_QTY, OUT_PRICE,STOCK_QTY, STOCK_PRICE)
            VALUES ('${_fCustCode}', '${_prdCode}', '00000000', 0, 0,
                    0, 0, 0, 0, 0, 0 )`
            await new mssql.Request().query(ls_sqlQuery)
        }

        if (li_dateCount == 0 && li_dateHighCount == 0) {
            if (li_dateLowCount == 0) {
                let ls_sqlQuery = `
                INSERT INTO STOCK_TBL (CUST_CODE, PRODUCT_CODE, STOCK_DATE, TRANS_QTY, TRANS_PRICE,
                                       IN_QTY, IN_PRICE, OUT_QTY, OUT_PRICE, STOCK_QTY, STOCK_PRICE)
                VALUES ('${_fCustCode}', '${_prdCode}', '${_dateYYYY}', 0, 0,
                        0,0, ${_dvrQty}, ${lf_deliveryPrice}, -${_dvrQty}, -${lf_deliveryPrice})`

                await new mssql.Request().query(ls_sqlQuery)
            } else {

                let ls_sqlQuery = `
                INSERT INTO STOCK_TBL (CUST_CODE, PRODUCT_CODE, STOCK_DATE, TRANS_QTY, TRANS_PRICE,
                                    IN_QTY, IN_PRICE, OUT_QTY, OUT_PRICE, STOCK_QTY, STOCK_PRICE)
                SELECT TOP 1 CUST_CODE, PRODUCT_CODE, '${_dateYYYY}', STOCK_QTY, STOCK_PRICE,
                            0, 0, ${_dvrQty}, ${lf_deliveryPrice}, STOCK_QTY - ${_dvrQty}, STOCK_PRICE - ${lf_deliveryPrice}
                 FROM STOCK_TBL
                WHERE CUST_CODE = '${_fCustCode}'
                  AND PRODUCT_CODE = '${_prdCode}'
                  AND STOCK_DATE < '${_dateYYYY}'
                ORDER BY STOCK_DATE DESC`
                await new mssql.Request().query(ls_sqlQuery)
            }
        } else if (li_dateCount != 0 && li_dateHighCount == 0) {

            let ls_sqlQuery = `
            UPDATE STOCK_TBL SET OUT_QTY = OUT_QTY + ${_dvrQty},
                                 OUT_PRICE = OUT_PRICE + ${lf_deliveryPrice},
                                 STOCK_QTY = STOCK_QTY - ${_dvrQty},
                                 STOCK_PRICE = STOCK_PRICE - ${lf_deliveryPrice}
             WHERE CUST_CODE = '${_fCustCode}'
               AND PRODUCT_CODE = '${_prdCode}'
               AND STOCK_DATE = '${_dateYYYY}'`

            await new mssql.Request().query(ls_sqlQuery)
        } else if (li_dateCount != 0 && li_dateHighCount != 0) {

            let ls_sqlQuery = `
            SELECT STOCK_DATE 
              FROM STOCK_TBL WITH(NOLOCK)
             WHERE CUST_CODE = '${_fCustCode}'
               AND PRODUCT_CODE = '${_prdCode}'
               AND STOCK_DATE >= '${_dateYYYY}'
             ORDER BY STOCK_DATE`

            let dt = await new mssql.Request().query(ls_sqlQuery)
            let dr = dt.recordset

            for (const row of dr) {
                let ls_stockDate = row["STOCK_DATE"]
                if (_dateYYYY == ls_stockDate) {
                    let ls_sqlQuery = `
                    UPDATE STOCK_TBL SET OUT_QTY = OUT_QTY + ${_dvrQty},
                                         OUT_PRICE = OUT_PRICE + ${lf_deliveryPrice},
                                         STOCK_QTY = STOCK_QTY - ${_dvrQty},
                                         STOCK_PRICE = STOCK_PRICE - ${lf_deliveryPrice}
                     WHERE CUST_CODE = '${_fCustCode}'
                       AND PRODUCT_CODE = '${_prdCode}'
                       AND STOCK_DATE = '${ls_stockDate}'`

                    await new mssql.Request().query(ls_sqlQuery)
                } else {
                    let ls_sqlQuery = `
                    UPDATE STOCK_TBL SET TRANS_QTY = TRANS_QTY - ${_dvrQty},
                                         TRANS_PRICE = TRANS_PRICE - ${lf_deliveryPrice},
                                         STOCK_QTY = STOCK_QTY - ${_dvrQty},
                                         STOCK_PRICE = STOCK_PRICE - ${lf_deliveryPrice}
                     WHERE CUST_CODE = '${_fCustCode}'
                       AND PRODUCT_CODE = '${_prdCode}'
                       AND STOCK_DATE = '${ls_stockDate}'`

                    await new mssql.Request().query(ls_sqlQuery)
                }
            }
        } else if (li_dateCount == 0 && li_dateHighCount != 0) {
            if (li_dateLowCount == 0) {
                ls_sqlQuery = `
                INSERT INTO STOCK_TBL (CUST_CODE, PRODUCT_CODE, STOCK_DATE, TRANS_QTY, TRANS_PRICE,
                                       IN_QTY, IN_PRICE, OUT_QTY, OUT_PRICE, STOCK_QTY, STOCK_PRICE)
                VALUES ('${_fCustCode}', '${_prdCode}', '${_dateYYYY}', 0, 0,
                        0,0, ${_dvrQty}, ${lf_deliveryPrice}, -${_dvrQty}, -${lf_deliveryPrice})`

                await new mssql.Request().query(ls_sqlQuery)
            } else {
                ls_sqlQuery = `
                INSERT INTO STOCK_TBL (CUST_CODE, PRODUCT_CODE, STOCK_DATE, TRANS_QTY, TRANS_PRICE,
                                       IN_QTY, IN_PRICE, OUT_QTY, OUT_PRICE, STOCK_QTY, STOCK_PRICE)
                SELECT TOP 1 CUST_CODE, PRODUCT_CODE, '${_dateYYYY}', STOCK_QTY, STOCK_PRICE,
                             0, 0, ${_dvrQty}, ${lf_deliveryPrice}, STOCK_QTY - ${_dvrQty}, STOCK_PRICE - ${lf_deliveryPrice}
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
        // console.log(error);
        throw error


    }
}

async function stockTableIn(_pCustCode, _prdCode, _inQty, _prdCost, _inDate) {
    let lf_inPrice = parseFloat(_inQty) * parseFloat(_prdCost)
    try {
        let ls_sqlQuery = `SELECT 
        (SELECT COUNT(*) FROM STOCK_TBL WITH(NOLOCK) WHERE CUST_CODE = '${_pCustCode}' AND PRODUCT_CODE = '${_prdCode}') AS TOT_CNT,
        (SELECT COUNT(*) FROM STOCK_TBL WITH(NOLOCK) WHERE CUST_CODE = '${_pCustCode}' AND PRODUCT_CODE = '${_prdCode}' AND STOCK_DATE = '${_inDate}') AS DATE_CNT,
        (SELECT COUNT(*) FROM STOCK_TBL WITH(NOLOCK) WHERE CUST_CODE = '${_pCustCode}' AND PRODUCT_CODE = '${_prdCode}' AND STOCK_DATE > '${_inDate}') AS DATE_HIGH_CNT,
        (SELECT COUNT(*) FROM STOCK_TBL WITH(NOLOCK) WHERE CUST_CODE = '${_pCustCode}' AND PRODUCT_CODE = '${_prdCode}' AND STOCK_DATE < '${_inDate}') AS DATE_LOW_CNT`
        console.log(ls_sqlQuery);
        let dt = await new mssql.Request().query(ls_sqlQuery)
        let dr = dt.recordset
        const li_totalCount = dr[0]["TOT_CNT"]
        const li_dateCount = dr[0]["DATE_CNT"]
        const li_dateHighCount = dr[0]["DATE_HIGH_CNT"]
        const li_dateLowCount = dr[0]["DATE_LOW_CNT"]
        if (li_totalCount == 0) {
            let ls_sqlQuery = `
            INSERT INTO STOCK_TBL (CUST_CODE, PRODUCT_CODE, STOCK_DATE, TRANS_QTY, TRANS_PRICE,
                                   IN_QTY, IN_PRICE, OUT_QTY, OUT_PRICE,STOCK_QTY, STOCK_PRICE)
            VALUES ('${_pCustCode}', '${_prdCode}', '00000000', 0, 0,
                    0, 0, 0, 0, 0, 0 )`
            console.log(ls_sqlQuery);
            await new mssql.Request().query(ls_sqlQuery)
        }
        if (li_dateCount == 0 && li_dateHighCount == 0) {
            if (li_dateLowCount == 0) {

                let ls_sqlQuery = `
                INSERT INTO STOCK_TBL (CUST_CODE, PRODUCT_CODE, STOCK_DATE, TRANS_QTY, TRANS_PRICE,
                                       IN_QTY, IN_PRICE, OUT_QTY, OUT_PRICE, STOCK_QTY, STOCK_PRICE)
                VALUES ('${_pCustCode}', '${_prdCode}', '${_inDate}', 0, 0,
                        ${_inQty}, ${lf_inPrice}, 0, 0, ${_inQty}, ${lf_inPrice})`

                console.log(ls_sqlQuery);
                await new mssql.Request().query(ls_sqlQuery)
            } else {
                ls_sqlQuery = `
                INSERT INTO STOCK_TBL (CUST_CODE, PRODUCT_CODE, STOCK_DATE, TRANS_QTY, TRANS_PRICE,
                                       IN_QTY, IN_PRICE, OUT_QTY, OUT_PRICE, STOCK_QTY, STOCK_PRICE)
                SELECT TOP 1 CUST_CODE, PRODUCT_CODE, '${_inDate}', STOCK_QTY, STOCK_PRICE,
                             ${_inQty}, ${lf_inPrice}, 0, 0, STOCK_QTY + ${_inQty}, STOCK_PRICE + ${lf_inPrice}
                  FROM STOCK_TBL
                 WHERE CUST_CODE = '${_pCustCode}'
                   AND PRODUCT_CODE = '${_prdCode}'
                   AND STOCK_DATE < '${_inDate}'
                 ORDER BY STOCK_DATE DESC`
                console.log(ls_sqlQuery);
                await new mssql.Request().query(ls_sqlQuery)
            }
        } else if (li_dateCount != 0 && li_dateHighCount != 0) {
            let ls_sqlQuery = `
            UPDATE STOCK_TBL SET IN_QTY = IN_QTY + ${_inQty},
                                 IN_PRICE = IN_PRICE + ${lf_inPrice},
                                 STOCK_QTY = STOCK_QTY + ${_inQty},
                                 STOCK_PRICE = STOCK_PRICE + ${lf_inPrice}
             WHERE CUST_CODE = '${_pCustCode}'
               AND PRODUCT_CODE = '${_prdCode}'
               AND STOCK_DATE = '${_inDate}'`
            console.log(ls_sqlQuery);
            await new mssql.Request().query(ls_sqlQuery)
        } else if (li_dateCount != 0 && li_dateHighCount != 0) {
            let ls_sqlQuery = `
            SELECT STOCK_DATE FROM STOCK_TBL WITH(NOLOCK)
             WHERE CUST_CODE = '${_pCustCode}'
               AND PRODUCT_CODE = '${_prdCode}'
               AND STOCK_DATE >= '${_inDate}'
             ORDER BY STOCK_DATE`
            console.log(ls_sqlQuery);
            let dtLoop = await new mssql.Request().query(ls_sqlQuery)
            let drLoop = dtLoop.recordset

            for (const row of drLoop) {
                let ls_stockDate = row["STOCK_DATE"].toString()
                if (_inDate == ls_stockDate) {
                    ls_sqlQuery = `
                    UPDATE STOCK_TBL SET IN_QTY = IN_QTY + ${_inQty},
                                         IN_PRICE = IN_PRICE + ${lf_inPrice},
                                         STOCK_QTY = STOCK_QTY + ${_inQty},
                                         STOCK_PRICE = STOCK_PRICE + ${lf_inPrice}
                     WHERE CUST_CODE = '${_pCustCode}'
                       AND PRODUCT_CODE = '${_prdCode}'
                       AND STOCK_DATE = '${ls_stockDate}'`
                    console.log(ls_sqlQuery);
                    await new mssql.Request().query(ls_sqlQuery)
                } else {
                    let ls_sqlQuery = `
                    UPDATE STOCK_TBL SET TRANS_QTY = TRANS_QTY + ${_inQty},
                                        TRANS_PRICE = TRANS_PRICE + ${lf_inPrice},
                                        STOCK_QTY = STOCK_QTY + ${_inQty},
                                        STOCK_PRICE = STOCK_PRICE + ${lf_inPrice}
                     WHERE CUST_CODE = '${_pCustCode}'
                       AND PRODUCT_CODE = '${_prdCode}'
                       AND STOCK_DATE = '${ls_stockDate}'`
                    console.log(ls_sqlQuery);
                    await new mssql.Request().query(ls_sqlQuery)
                }
            }
        } else if (li_dateCount == 0 && li_dateHighCount != 0) {
            let ls_sqlQuery = `
            INSERT INTO STOCK_TBL (CUST_CODE, PRODUCT_CODE, STOCK_DATE, TRANS_QTY, TRANS_PRICE,
                                   IN_QTY, IN_PRICE, OUT_QTY, OUT_PRICE, STOCK_QTY, STOCK_PRICE)
            SELECT TOP 1 CUST_CODE, PRODUCT_CODE, '${_inDate}', STOCK_QTY, STOCK_PRICE,
                        ${_inQty}, ${lf_inPrice}, 0, 0, STOCK_QTY + ${_inQty}, STOCK_PRICE + ${lf_inPrice}
              FROM STOCK_TBL
             WHERE CUST_CODE = '${_pCustCode}'
               AND PRODUCT_CODE = '${_prdCode}'
               AND STOCK_DATE < '${_inDate}'
             ORDER BY STOCK_DATE DESC;
 
            UPDATE STOCK_TBL SET TRANS_QTY = TRANS_QTY + ${_inQty},
                                 TRANS_PRICE = TRANS_PRICE + ${lf_inPrice},
                                 STOCK_QTY = STOCK_QTY + ${_inQty},
                                 STOCK_PRICE = STOCK_PRICE + ${lf_inPrice}
            WHERE CUST_CODE = '${_pCustCode}'
              AND PRODUCT_CODE = '${_prdCode}'
              AND STOCK_DATE > '${_inDate}'`
            console.log(ls_sqlQuery);
            await new mssql.Request().query(ls_sqlQuery)

        } else if (li_dateCount != 0 && li_dateHighCount == 0) {
            let ls_sqlQuery = `
            UPDATE STOCK_TBL SET IN_QTY = IN_QTY + ${_inQty},
                                 IN_PRICE = IN_PRICE + ${lf_inPrice},
                                 STOCK_QTY = STOCK_QTY + ${_inQty},
                                 STOCK_PRICE = STOCK_PRICE + ${lf_inPrice}
            WHERE CUST_CODE = '${_pCustCode}'
              AND PRODUCT_CODE = '${_prdCode}'
              AND STOCK_DATE = '${_inDate}'`
            console.log(ls_sqlQuery);
            await new mssql.Request().query(ls_sqlQuery)
        }
        await stockCustTableUpload(_pCustCode, _prdCode)
    }
    catch (error) {
        // console.log(error);
        throw error


    }
}

async function productStockIn(_inNo, _prdCode, _pCustCode, _fCustCode, _dvrQty, _prdCost, _dateYYYY) {

    try {
        let ls_sqlQuery = `
        INSERT INTO PRD_STOCK_TBL (IN_NO, SEQ_NO, INOUT_SEQ, PRODUCT_CODE, INOUT_QTY, INOUT_COST,
                                   P_CUST_CODE, F_CUST_CODE, INOUT_DATE, DVR_NO, DVR_SEQ, END_YN)
        SELECT '${_inNo}', ISNULL(MAX(SEQ_NO),0) + 1, 0, '${_prdCode}', ${_dvrQty}, ${_prdCost},
               '${_pCustCode}', '${_fCustCode}', '${_dateYYYY}', '', 0, 'N'
          FROM PRD_STOCK_TBL WITH(NOLOCK)
         WHERE IN_NO = '${_inNo}' `
        console.log(ls_sqlQuery);
        await new mssql.Request().query(ls_sqlQuery)
    } catch (error) {
        // console.log(error);
        throw error


    }
}

async function productStockTableDelivery(_inNo, _inSeqNo, _dvrNo, _dvrSeqNo, _prdCode, _fCustCode, _pCustCode, _qty, _cost, _dateYYYY) {

    try {
        let ls_sqlQuery = `
        INSERT INTO PRD_STOCK_TBL (IN_NO, SEQ_NO, INOUT_SEQ, PRODUCT_CODE, INOUT_QTY, 
                                   INOUT_COST, P_CUST_CODE, F_CUST_CODE, INOUT_DATE, DVR_NO,
                                   DVR_SEQ, END_YN)
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
        let dt = await new mssql.Request().query(ls_sqlQuery)
        let dr = dt.recordset
        let lf_inQty = parseFloat(dr[0]["IN_QTY"])
        let lf_outQty = parseFloat(dr[0]["OUT_QTY"])

        if (lf_inQty <= lf_outQty) {
            ls_sqlQuery = `
            UPDATE PRD_STOCK_TBL SET  END_YN = 'Y' 
             WHERE IN_NO = '${_inNo}' 
               AND SEQ_NO = ${_inSeqNo}`
            await new mssql.Request().query(ls_sqlQuery)
        }

    } catch (error) {
        // console.log(error);
        throw error


    }
}

async function stockCustTableUpload(_custCode, _prdCode) {
    let ls_sqlQuery = `
    SELECT STOCK_QTY, STOCK_PRICE 
      FROM STOCK_TBL WITH(NOLOCK)
     WHERE CUST_CODE = '${_custCode}' 
       AND PRODUCT_CODE = '${_prdCode}'
       AND STOCK_DATE = (SELECT MAX(STOCK_DATE) 
                           FROM STOCK_TBL WITH(NOLOCK) 
                          WHERE CUST_CODE ='${_custCode}' 
                            AND PRODUCT_CODE = '${_prdCode}')`
    try {
        let dt = await new mssql.Request().query(ls_sqlQuery)
        let dr = dt.recordset
        if (dr.length == 0) return

        let lf_stockQty = parseFloat(dr[0]["STOCK_QTY"])
        let lf_stockPrice = parseFloat(dr[0]["STOCK_PRICE"])

        if (lf_stockQty == 0) {
            let ls_sqlQuery = `DELETE FROM STOCK_CUST_TBL WHERE CUST_CODE = '${_custCode}' AND PRODUCT_CODE = '${_prdCode}'`
            await new mssql.Request().query(ls_sqlQuery)
        } else {
            ls_sqlQuery = `
            SELECT COUNT(*) AS CNT 
              FROM STOCK_CUST_TBL WITH(NOLOCK) 
             WHERE CUST_CODE = '${_custCode}' 
               AND PRODUCT_CODE = '${_prdCode}'`
            let dtLoop = await new mssql.Request().query(ls_sqlQuery)
            let drLoop = dtLoop.recordset

            if (drLoop[0]["CNT"].toString() == "0") {
                let ls_sqlQuery = `
                INSERT INTO STOCK_CUST_TBL (CUST_CODE, PRODUCT_CODE, STOCK_QTY, STOCK_PRICE)
                VALUES ('${_custCode}','${_prdCode}',${lf_stockQty},${lf_stockPrice})`
                await new mssql.Request().query(ls_sqlQuery)
            } else {
                let ls_sqlQuery = `
                UPDATE STOCK_CUST_TBL SET STOCK_QTY = ${lf_stockQty},
                                          STOCK_PRICE = ${lf_stockPrice}
                 WHERE CUST_CODE = '${_custCode}' 
                   AND PRODUCT_CODE = '${_prdCode}'`
                await new mssql.Request().query(ls_sqlQuery)
            }
        }
    } catch (error) {
        // console.log(error);
        throw error

    }

}
async function fabricOut(_fCustCode, _fabricNo, _dvrQty, _dateYYYY, _timeHHmm, _empNo) {
    var ls_remark = "Update location"
    try {
        let ls_sqlQuery = `
        DELETE FROM FABRIC_STOCK_TBL WHERE CUST_CODE = '${_fCustCode}' AND IN_NO = '${_fabricNo}';
        
        INSERT INTO FABRIC_INOUT_TBL (IN_NO, SEQ_NO, INOUT_DIV, INOUT_QTY, REG_DATE,
                                      REG_TIME, EMP_NO, REMARK)
        SELECT '${_fabricNo}', ISNULL(MAX(SEQ_NO), 0) + 1, '2', ${_dvrQty}, '${_dateYYYY}', 
               '${_timeHHmm}', '${_empNo}', '${ls_remark}'
         FROM FABRIC_INOUT_TBL WITH(NOLOCK)
        WHERE IN_NO = '${_fabricNo}'`
        await new mssql.Request().query(ls_sqlQuery)
    } catch (error) {
        // console.log(error);
        throw error

    }

}

async function fabricIn(_fabricNo, _pCustCode, _prdCode, _dvrQty, _dateYYYY, _timeHHmm, _empNo, _impNp, _dvrNo, _remark, _dateYY) {

    let li_seqNo = 1
    let li_inOutDiv = 1
    try {
        let ls_sqlQuery = `
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
    } catch (error) {
        // console.log(error);
        throw error

    }


}

async function getFabricNo(req, res) {
    const ls_productCode = decodeURIComponent(req.query.PRODUCT_CODE) || "";
    if (ls_productCode.length == 0) {

        return res.json({ success: false, message: "PRODUCT_CODE must not be empty" });
    }
    try {
        let ls_sqlQuery = `
        SELECT C.CUST_NAME,A.IN_NO,A.STOCK_QTY 
         FROM FABRIC_STOCK_TBL A LEFT JOIN FABRIC_IN_TBL B ON A.IN_NO = B.IN_NO 
                                 LEFT JOIN CUSTOMER_TBL C ON C.CUST_CODE = A.CUST_CODE 
        WHERE B.PRODUCT_CODE='${ls_productCode}'`
        let dt = await new mssql.Request().query(ls_sqlQuery);
        let dr = dt.recordset
        let data = []
        if (dr.length == 0) return res.json({ success: true, message: "empty Data", data });
        for (const row of dr) {
            let js = {}
            js.CUST_NAME = row["CUST_NAME"]
            js.IN_NO = row["IN_NO"]
            js.STOCK_QTY = row["STOCK_QTY"]
            data.push(js)
        }
        res.json({ success: true, message: "SUCCESS", li_totalCount: dr.length, data });
    } catch (error) {
        // console.log(error);
        throw error

    }
}
module.exports.getFabricNo = getFabricNo


async function getCurrentFabricLocation(req, res) {
    const ls_fabricNo = decodeURIComponent(req.query.FABRIC_NO) || "";
    if (ls_fabricNo.length == 0) {

        return res.json({ success: false, message: "FABRIC_NO must not be empty" });
    }
    let ls_sqlQuery = `
    SELECT B.CUST_LGR_CODE, B.CUST_MID_CODE, B.CUST_SML_CODE, B.CUST_CODE, 
           C.CUST_LGR_NAME, D.CUST_MID_NAME, E.CUST_SML_NAME, B.CUST_NAME 
      FROM FABRIC_STOCK_TBL A LEFT JOIN CUSTOMER_TBL B ON A.CUST_CODE = B.CUST_CODE
                              LEFT JOIN CUST_LGR_TBL C ON B.CUST_LGR_CODE = C.CUST_LGR_CODE
                              LEFT JOIN CUST_MID_TBL D ON B.CUST_MID_CODE = D.CUST_MID_CODE AND D.CUST_LGR_CODE = B.CUST_LGR_CODE
                              LEFT JOIN CUST_SML_TBL E ON B.CUST_SML_CODE = E.CUST_SML_CODE AND E.CUST_MID_CODE = D.CUST_MID_CODE AND E.CUST_LGR_CODE = B.CUST_LGR_CODE
     WHERE A.IN_NO = '${ls_fabricNo}'`
    let dt = await new mssql.Request().query(ls_sqlQuery);
    let dr = dt.recordset
    if (dr.length == 0) {
        return res.json({ success: false, message: "Can not find location of this fabric roll" });
    }
    res.json({ success: true, message: "SUCCESS", data: dr[0] });
}
module.exports.getCurrentFabricLocation = getCurrentFabricLocation

async function ProductionMove(req, res) {
    const ls_fCustCode = decodeURIComponent(req.body.FROM_CUST) || "";
    const ls_pCustCode = decodeURIComponent(req.body.TO_CUST) || "";
    const ls_empNo = decodeURIComponent(req.body.EMP_NO) || "";
    const ls_productCode = decodeURIComponent(req.body.PRODUCT_CODE) || "";
    const li_Qty = decodeURIComponent(req.body.PRODUCT_QTY) || "";
    const ls_OutPayCode = "20" // Move OUT
    const ls_InPayCode = "10" // Move OUT
    const ls_dvrRemark = "Location Update"
    const ls_inHNote = ls_dvrRemark + "/Auto In Reg after Out Reg"
    try {
        const ls_date_YYYYMMdd = getCurrentDate(4)
        const ls_date_YYMMdd = getCurrentDate(2)
        const ls_time_HHmm = getCurrentTime()
        const lf_deliveryCost = 0 // Move to local warehouse, it have no cost
        const lf_deliveryQty = parseFloat(li_Qty)
        const lf_deliveryPrice = lf_deliveryCost * lf_deliveryQty
        const lf_productCost = await getProductCost(ls_productCode)
        const ls_deliveryNo = await insertDeliveryHTable(ls_OutPayCode, ls_fCustCode, ls_pCustCode, ls_inHNote, ls_empNo, ls_date_YYYYMMdd, ls_time_HHmm, ls_date_YYMMdd)
        const ls_inNo = await insertInHTable(ls_InPayCode, ls_fCustCode, ls_pCustCode, ls_inHNote, ls_empNo, ls_date_YYYYMMdd, ls_time_HHmm, ls_date_YYMMdd)

        await insert2DelevryDTable(ls_deliveryNo, ls_productCode, lf_deliveryQty, lf_productCost, lf_deliveryPrice)
        await insert2InDTable(ls_inNo, ls_productCode, lf_deliveryQty, lf_deliveryCost, lf_deliveryPrice, "", lf_productCost)
        await stockMove(ls_deliveryNo, ls_inNo, ls_fCustCode, ls_pCustCode, ls_date_YYYYMMdd, ls_productCode, lf_deliveryQty, lf_productCost)

        return res.json({ success: true, message: "SUCCESS" });
    } catch (error) {
        // console.log(error);
        console.error(`Error executing query: `, error);
        res.status(500).json({ success: false, message: "An error occurred while processing the request ", error: error.message });

    }
}
module.exports.ProductionMove = ProductionMove

async function getProductStockInfo(req, res) {
    const ls_productCode = decodeURIComponent(req.query.PRODUCT_CODE) || "";
    if (ls_productCode == "") {
        return res.json({ success: false, message: "PRODUCT_CODE must not be empty" });
    }
    const li_HCode = 23 //Product Stock
    var ls_tempCondition = ""
    if (isNaN(parseInt(ls_productCode.charAt(8)))) {
        ls_tempCondition = "D.BARCODE"
    } else {
        ls_tempCondition = "A.PRODUCT_CODE"
    }

    let ls_sqlQuery = `
    SELECT A.CUST_CODE, B.CUST_NAME, A.PRODUCT_CODE, A.STOCK_QTY, D.PRD_NAME, D.BARCODE, D.PRODUCT_COST, E.LGR_NAME, F.MID_NAME, G.DGN_NAME, H.COLOR_NAME 
      FROM STOCK_CUST_TBL A LEFT JOIN CUSTOMER_TBL B ON A.CUST_CODE = B.CUST_CODE
                            LEFT JOIN PMS_COMMON_CUST_D_TBL C ON A.CUST_CODE = C.CUST_CODE
                            LEFT JOIN PRODUCT_TBL D ON D.PRODUCT_CODE = A.PRODUCT_CODE
                            LEFT JOIN LGR_TBL E ON E.LGR_CODE = D.LGR_CODE
                            LEFT JOIN MID_TBL F ON F.MID_CODE = D.MID_CODE AND F.LGR_CODE = D.LGR_CODE
                            LEFT JOIN DESIGN_TBL G ON G.DGN_CODE = D.DGN_CODE
                            LEFT JOIN COLOR_TBL H ON H.COLOR_CODE = D.COLOR_CODE
    WHERE ${ls_tempCondition} ='${ls_productCode}' 
      AND (C.H_CODE='${li_HCode}' OR B.CUST_LGR_CODE ='5')`
    let dt = await new mssql.Request().query(ls_sqlQuery)
    let dr = dt.recordset
    if (dr.length == 0) {
        return res.json({ success: false, message: "Just only finished product in stock" });
    }
    let data = []
    for (const row of dr) {
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
    var ls_tempCondition = ""
    const li_HCode = 23 //Product Stock
    if (ls_prdName == "") ls_tempCondition = `1=1`
    else ls_tempCondition = `B.PRD_NAME LIKE '%${ls_prdName}%'`
    let ls_sqlQuery = `
    SELECT A.PRODUCT_CODE, B.PRD_NAME 
      FROM STOCK_CUST_TBL A LEFT JOIN PRODUCT_TBL B ON A.PRODUCT_CODE = B.PRODUCT_CODE
                            LEFT JOIN PMS_COMMON_CUST_D_TBL E ON A.CUST_CODE = E.CUST_CODE
                            LEFT JOIN CUSTOMER_TBL C ON A.CUST_CODE = C.CUST_CODE
     WHERE ${ls_tempCondition}
       AND (E.H_CODE='${li_HCode}' OR C.CUST_LGR_CODE ='5')
     GROUP BY A.PRODUCT_CODE, B.PRD_NAME`
    let dt = await new mssql.Request().query(ls_sqlQuery)
    let dr = dt.recordset
    if (dr.length == 0) {
        return res.json({ success: false, message: "Can not find any product with that name" });
    }
    let data = []
    for (const row of dr) {
        let js = {}
        js.PRODUCT_CODE = row["PRODUCT_CODE"]
        js.PRD_NAME = row["PRD_NAME"]
        data.push(js)
    }
    res.json({ success: true, message: "SUCCESS", data });

}
module.exports.findProductByName = findProductByName

async function getWorkOrdList(req, res) {
    const ls_DateFrom = decodeURIComponent(req.query.DATE_FROM) || "";
    const ls_DateTo = decodeURIComponent(req.query.DATE_TO) || "";
    const ls_WorkOrdNo = decodeURIComponent(req.query.WORK_ORD_NO) || "";
    let data = []
    let ls_sqlQuery = `
    SELECT A.WORK_ORD_NO, B.PRD_NAME
     FROM WORK_ORD_TBL A LEFT JOIN PRODUCT_TBL B ON A.PRODUCT_CODE = B.PRODUCT_CODE  
    WHERE A.REG_DATE BETWEEN '${ls_DateFrom}' AND '${ls_DateTo}'`

    if (ls_WorkOrdNo != "") ls_sqlQuery += ` AND A.WORK_ORD_NO = '${ls_WorkOrdNo}'`
    let dt = await new mssql.Request().query(ls_sqlQuery)
    let dr = dt.recordset
    for (const row of dr) {
        let js = {}
        js.WorkOrdNo = row['WORK_ORD_NO']
        js.ProductName = row['PRD_NAME']
        data.push(js)
    }
    res.json({ success: true, message: "SUCCESS", data });

}
module.exports.getWorkOrdList = getWorkOrdList

async function getWorkOrdBOMMove(req, res) {
    const ls_DateFrom = decodeURIComponent(req.query.DATE_FROM) || "";
    const ls_DateTo = decodeURIComponent(req.query.DATE_TO) || "";
    const ls_WorkOrdNo = decodeURIComponent(req.query.WORK_ORD_NO) || "";

    let ls_sqlQuery = `
    SELECT A.WORK_ORD_NO, A.PRODUCT_CODE, A.FABRIC_NO, C.PRD_NAME, A.TEMP_MOVE_DATE, 
	       A.IN_QTY, A.REQ_QTY, A.TOT_MAKE_QTY
     FROM WORK_ORD_BOM_MOVE_TBL A LEFT JOIN FABRIC_IN_TBL B ON A.FABRIC_NO = B.IN_NO
							      LEFT JOIN PRODUCT_TBL C ON B.PRODUCT_CODE = C.PRODUCT_CODE
    WHERE A.TEMP_MOVE_DATE BETWEEN '${ls_DateFrom}' AND '${ls_DateTo}'`

    if (ls_WorkOrdNo != "") ls_sqlQuery += ` AND A.WORK_ORD_NO = '${ls_WorkOrdNo}'`
    let dt = await new mssql.Request().query(ls_sqlQuery)
    let dr = dt.recordset
    let data = []
    for (const row of dr) {
        let js = {}
        js.WORK_ORD_NO = row['WORK_ORD_NO']
        js.PRODUCT_CODE = row['PRODUCT_CODE']
        js.FABRIC_NO = row['FABRIC_NO']
        js.PRD_NAME = row['PRD_NAME']
        js.TEMP_MOVE_DATE = row['TEMP_MOVE_DATE']
        js.IN_QTY = row['IN_QTY']
        js.REQ_QTY = row['REQ_QTY']
        js.TOT_MAKE_QTY = row['TOT_MAKE_QTY']
        data.push(js)
    }
    res.json({ success: true, message: "SUCCESS", data });
}
module.exports.getWorkOrdBOMMove = getWorkOrdBOMMove

async function move2Workshop(req, res) {
    const ls_InoutCode_In = "10"
    const ls_InoutCode_Dvr = "20"
    const ls_workShopCustCode = "A10116003"
    const ls_workShopTempCustCode = "A10116003" //Change this to new tempWorkshop
    const ITEMS = req.body.ITEM || "";
    const ls_empNo = decodeURIComponent(req.body.EMP_NO) || "";
    try {
        for (const item of JSON.parse(ITEMS)) {
            const ls_fabricNo = item.FABRIC_NO
            const ls_productCode = item.PRODUCT_CODE
            const lf_productQty = item.PRODUCT_QTY
            const ls_workOrdNo = item.WORK_ORD_NO
            console.log(ls_fabricNo);
            await new Promise(resolve => setTimeout(resolve, 500));
            //const ls_Move_InNo = insertInHTable(ls_InoutCode_In, ls_workShopTempCustCode, ls_workShopCustCode, `W/O No: ${ls_workOrdNo} Output Warehouse From Order`, ls_empNo, getCurrentDate(4), getCurrentTime())
            //const ls_Move_DvrNo = insertDeliveryHTable(ls_InoutCode_Dvr, ls_workShopTempCustCode, ls_workShopCustCode, `W/O No: ${ls_workOrdNo} Output Warehouse From Order`, ls_empNo, getCurrentDate(4), getCurrentTime())
            // insert2DelevryDTable(ls_Move_DvrNo, ls_productCode, lf_productQty, 0)
            // insert2InDTable(ls_Move_InNo, ls_productCode, lf_productQty, 0)
            // stockMove(ls_Move_DvrNo, ls_Move_InNo, ls_workShopTempCustCode, ls_workShopCustCode, getCurrentDate(4), ls_productCode, lf_productQty)
            // fabricOut(ls_workShopTempCustCode, ls_fabricNo, lf_productQty, getCurrentDate(4), getCurrentTime(), ls_empNo)
            // insertCutInOutTable(ls_workOrdNo, ls_fabricNo, ls_productCode, lf_productQty, ls_empNo, getCurrentDate(4), getCurrentTime(), ls_Move_DvrNo, ls_Move_InNo)
        }
        res.json({ success: true, message: "SUCCESS" });
    }
    catch (error) {
        console.error(`Error executing query: `, error);
        res.status(500).json({ success: false, message: "An error occurred while processing the request ", error: error.message });
    }
}
module.exports.move2Workshop = move2Workshop


async function insertCutInOutTable(_workOrdNo, _fabricNo, _productCode, _outQty, _empNo, _dateYYYY, _timeHHmm, _moveDvrNo, _moveInNo) {
    let ls_SeqNo_CutInout = await getSeqNoCutInOut(_workOrdNo)
    let ls_sqlQuery = `
    INSERT INTO CUT_INOUT_H_TBL (WORK_ORD_NO, SEQ_NO, PRODUCT_CODE, OUT_QTY, RET_QTY,
                                REG_EMP_NO, REG_DATE, REG_TIME, IN_DVR_NO, IN_IN_NO,
                                RET_DVR_NO, RET_IN_NO, REMARK)
    VALUES ('${_workOrdNo}',${ls_SeqNo_CutInout},'${_productCode}',${_outQty},0,
    '${_empNo}','${_dateYYYY}','${_timeHHmm}','${_moveDvrNo}','${_moveInNo}',
    '','','Output Warehouse From Order')
    
    INSERT INTO CUT_INOUT_D_TBL (WORK_ORD_NO, SEQ_NO, FABRIC_IN_NO, IN_QTY, RET_QTY)
    VALUES ('${_workOrdNo}',${ls_SeqNo_CutInout},'${_fabricNo}',${_outQty},0)`
    try {
        await new mssql.Request().query(ls_sqlQuery)
    } catch (error) {
        throw error
    }
}
async function getSeqNoCutInOut(_workOrdNo) {
    let ls_sqlQuery = `SELECT ISNULL(MAX(SEQ_NO),0) + 1 FROM CUT_INOUT_H_TBL WITH(NOLOCK) WHERE WORK_ORD_NO = '${_workOrdNo}'`
    try {
        let dt = await new mssql.Request().query(ls_sqlQuery)
        let dr = dt.recordset
    } catch (error) {
        throw error
    }
    return dr[0][0].toString()
}