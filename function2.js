let mssql;
function settingDb(mssqlConnect) {
    mssql = mssqlConnect;

}
module.exports.settingDb = settingDb;
async function updateFabricLocation(req, res) {
    const FROM_CUST = decodeURIComponent(req.body.FROM_CUST) || "";
    const TO_CUST = decodeURIComponent(req.body.TO_CUST) || "";
    const EMP_NO = decodeURIComponent(req.body.EMP_NO) || "";
    const PRODUCT_CODE = decodeURIComponent(req.body.PRODUCT_CODE) || "";
    const PRODUCT_QTY = decodeURIComponent(req.body.PRODUCT_QTY) || "";
    const FABRIC_NO = decodeURIComponent(req.body.FABRIC_NO) || "";
    const IMP_NO = decodeURIComponent(req.body.IMP_NO) || "";
    const DVR_NO = decodeURIComponent(req.body.DVR_NO) || "";
    const REMARK = decodeURIComponent(req.body.REMARK) || "";
    const PAY_CODE = 20 // Move to another local warehouse
    const dvrRemark = "Location Update"
    const inHNote = dvrRemark + "/Auto In Reg after Out Reg"
    try {
        const currentDate = getCurrentDate(4)
        const currentDate2 = getCurrentDate(2)
        const currentTime = getCurrentTime()
        const PRODUCT_COST = await getProductCost(PRODUCT_CODE)
        const OUT_NO = await insertDeliveryHTabel(PAY_CODE, FROM_CUST, TO_CUST, dvrRemark, EMP_NO, currentDate, currentTime)
        const IN_NO = await insertInHTable(PAY_CODE, FROM_CUST, TO_CUST, inHNote, EMP_NO, currentDate, currentTime)

        await insert2DelevryDTable(OUT_NO, PRODUCT_CODE, PRODUCT_QTY, PRODUCT_COST)
        await insert2InDTable(IN_NO, PRODUCT_CODE, PRODUCT_QTY, PRODUCT_COST)
        await stockMove(OUT_NO, IN_NO, FROM_CUST, TO_CUST, currentDate, PRODUCT_CODE, PRODUCT_QTY, PRODUCT_COST)
        await fabricOut(FROM_CUST, FABRIC_NO, PRODUCT_QTY, currentDate, currentTime, EMP_NO)
        await fabricIn(FABRIC_NO, TO_CUST, PRODUCT_CODE, PRODUCT_QTY, currentDate, currentTime, EMP_NO, IMP_NO, DVR_NO, REMARK, currentDate2)
        res.json({ success: true, message: "SUCCESS" });
    } catch (error) {
        console.error("Error executing query:", error);

        res.status(500).json({ success: false, message: "An error occurred while processing the request" });
    }



}
module.exports.updateFabricLocation = updateFabricLocation

function getCurrentDate(yearLength) {
    const now = new Date();
    var year
    if (yearLength = 2) {
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
async function getProductCost(PRODUCT_CODE) {
    var loading = "getProductCost "
    loading += "- pending"
    // console.log(loading);
    var sqlQuery = `SELECT PRODUCT_COST FROM PRODUCT_TBL WHERE PRODUCT_CODE='${PRODUCT_CODE}'`
    var result = await new mssql.Request().query(sqlQuery)
    var rows = result.recordset
    loading += " - done"
    // console.log(loading);
    return rows[0]["PRODUCT_COST"]
}

async function insertDeliveryHTabel(PAY_CODE, FROM_CUST, TO_CUST, dvrRemark, EMP_NO, currentDate, currentTime) {
    var loading = "insertDeliveryHTabel "
    loading += "- pending"
    // console.log(loading);
    const DVR_NO = await createDvrNo(TO_CUST, currentDate)
    try {
        var sqlQuery = `INSERT INTO DELIVERY_H_TBL (DVR_NO, DVR_DATE, DVR_TIME, PAY_CODE, EMP_NO,
            P_CUST_CODE, F_CUST_CODE, REC_EMP_NO)
            VALUES ('${DVR_NO}', '${currentDate}', '${currentTime}', '${PAY_CODE}', '${EMP_NO}',
            '${TO_CUST}', '${FROM_CUST}', '')`

        await new mssql.Request().query(sqlQuery)

        var sqlQuery1 = `INSERT INTO DELIVERY_H_REMARK_TBL (DVR_NO, REMARK) VALUES ('${DVR_NO}', '${dvrRemark}')`
        await new mssql.Request().query(sqlQuery1)

    } catch (error) {
        console.error("Error executing query:", error);

    }
    loading += " - done"
    // console.log(loading);
    return DVR_NO
}

async function insertInHTable(PAY_CODE, FROM_CUST, TO_CUST, inHNote, EMP_NO, currentDate, currentTime) {
    var loading = "insertInHTable "
    loading += "- pending"
    // console.log(loading);
    const IN_NO = await createInNo(TO_CUST, currentDate)
    try {
        var sqlQuery = `INSERT INTO IN_H_TBL (IN_NO, IN_DATE, IN_TIME, PAY_CODE, EMP_NO, 
            P_CUST_CODE, F_CUST_CODE)
            VALUES ('${IN_NO}', '${currentDate}', '${currentTime}', '${PAY_CODE}', '${EMP_NO}', 
            '${TO_CUST}', '${FROM_CUST}')`
        await new mssql.Request().query(sqlQuery)


        var sqlQuery1 = `INSERT INTO IN_H_REMARK_TBL (IN_NO, REMARK) VALUES('${IN_NO}', '${inHNote}')`
        await new mssql.Request().query(sqlQuery1)

    } catch (error) {
        console.error("Error executing query:", error);

    }
    loading += " - done"
    // console.log(loading);
    return IN_NO
}

async function createDvrNo(FROM_CUST, currentDate) {
    var loading = "createDvrNo "
    loading += "- pending"
    // console.log(loading);
    var tempDvrNo = FROM_CUST + currentDate
    var sqlQuery = `SELECT DVR_NO FROM DELIVERY_H_TBL WHERE DVR_NO LIKE '${tempDvrNo}%'`
    var result = await new mssql.Request().query(sqlQuery)
    var rows = result.recordset
    if (rows.length == 0) {
        tempDvrNo += "0001"
    } else {
        var newIndex = parseInt(String(rows[rows.length - 1]["DVR_NO"]).slice(-4)) + 1
        tempDvrNo += String(newIndex).padStart(4, 0)
    }
    console.log(tempDvrNo);
    loading += " - done"
    // console.log(loading);
    return tempDvrNo
}

async function createInNo(TO_CUST, currentDate) {
    var loading = "createInNo "
    loading += "- pending"
    // console.log(loading);
    var tempInNo = TO_CUST + currentDate
    var sqlQuery = `SELECT IN_NO FROM IN_H_TBL WHERE IN_NO LIKE '${tempInNo}%'`
    var result = await new mssql.Request().query(sqlQuery)
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

async function insert2DelevryDTable(OUT_NO, PRODUCT_CODE, PRODUCT_QTY, PRODUCT_COST) {
    var loading = "insert2DelevryDTable "
    loading += "- pending"
    // console.log(loading);
    try {
        var sqlQuery = `INSERT INTO DELIVERY_D_TBL (DVR_NO, SEQ_NO, PRODUCT_CODE, DVR_QTY, DVR_COST, DVR_PRICE, DVR_D_REMARK)
        VALUES ('${OUT_NO}', 1, '${PRODUCT_CODE}', ${PRODUCT_QTY}, ${PRODUCT_COST}, 0, '')`

        await new mssql.Request().query(sqlQuery)
    } catch (error) {
        console.error("Error executing query:", error);

    }
    loading += " - done"
    // console.log(loading);

}

async function insert2InDTable(IN_NO, PRODUCT_CODE, PRODUCT_QTY, PRODUCT_COST) {
    var loading = "insert2InDTable "
    loading += "- pending"
    // console.log(loading);
    try {
        var sqlQuery = `INSERT INTO IN_D_TBL (IN_NO, SEQ_NO, PRODUCT_CODE, IN_QTY, IN_COST,IN_PRICE, IN_D_REMARK, PRODUCT_COST)
        VALUES ('${IN_NO}', 1, '${PRODUCT_CODE}', ${PRODUCT_QTY}, 0, 0, '', ${PRODUCT_COST})`
        await new mssql.Request().query(sqlQuery)
    } catch (error) {
        console.error("Error executing query:", error);

    }
    loading += " - done"
    // console.log(loading);
}

async function stockMove(OUT_NO, IN_NO, FROM_CUST, TO_CUST, currentDate, PRODUCT_CODE, PRODUCT_QTY, PRODUCT_COST) {
    var loading = "stockMove "
    loading += "- pending"
    // console.log(loading);
    var totalOutQty = parseFloat(PRODUCT_QTY)
    var totalPrice = 0
    var dvrSeqNo = 0
    try {
        var sqlQuery = ` SELECT A.IN_NO, A.SEQ_NO, A.INOUT_DATE, A.INOUT_COST, A.INOUT_QTY AS IN_QTY,
        ISNULL((SELECT SUM(INOUT_QTY) FROM PRD_STOCK_TBL WITH(NOLOCK) WHERE IN_NO = A.IN_NO AND SEQ_NO = A.SEQ_NO AND INOUT_SEQ > 0),0) AS OUT_QTY
        FROM PRD_STOCK_TBL A WITH(NOLOCK)
        WHERE A.P_CUST_CODE = '${FROM_CUST}'
        AND A.PRODUCT_CODE = '${PRODUCT_CODE}'
        AND A.INOUT_SEQ = 0
        AND A.END_YN <> 'Y'
        ORDER BY INOUT_DATE`
        var result = await new mssql.Request().query(sqlQuery)
        var rows = result.recordset
        if (rows.length == 0) {
            await stockTabelDelivery(currentDate, FROM_CUST, PRODUCT_CODE, PRODUCT_QTY, PRODUCT_COST)
            await stockTableIn(currentDate, TO_CUST, PRODUCT_CODE, PRODUCT_QTY, PRODUCT_COST)
            await productStockIn(IN_NO, PRODUCT_CODE, TO_CUST, FROM_CUST, PRODUCT_QTY, PRODUCT_COST, currentDate)
            totalOutQty = 0
        } else {
            for (const row of rows) {
                if (totalOutQty == 0) break
                var tempQty = Math.round(parseFloat(row["IN_QTY"]) - parseFloat(row["OUT_QTY"]), 3)
                var tempCost = parseFloat(row["INOUT_COST"])

                if (totalOutQty >= tempQty) {
                    await productStockTableDelivery(row["IN_NO"], parseInt(row["SEQ_NO"]), OUT_NO, dvrSeqNo, PRODUCT_CODE, FROM_CUST, TO_CUST, tempQty, tempCost, currentDate)
                    await stockTabelDelivery(FROM_CUST, PRODUCT_CODE, parseInt(tempQty).toString(), parseInt(tempCost).toString(), currentDate)
                    await stockTableIn(TO_CUST, PRODUCT_CODE, parseInt(tempQty).toString(), parseInt(tempCost).toString(), currentDate)
                    totalPrice += tempQty * tempCost
                    totalOutQty -= tempQty
                } else {
                    await productStockTableDelivery(row["IN_NO"], parseInt(row["SEQ_NO"]), OUT_NO, dvrSeqNo, PRODUCT_CODE, FROM_CUST, TO_CUST, totalOutQty, tempCost, currentDate)
                    await stockTabelDelivery(FROM_CUST, PRODUCT_CODE, parseInt(totalOutQty).toString(), parseInt(tempCost).toString(), currentDate)
                    await stockTableIn(TO_CUST, PRODUCT_CODE, parseInt(totalOutQty).toString(), parseInt(tempCost).toString(), currentDate)
                    totalPrice += tempQty * tempCost
                    totalOutQty -= tempQty
                }
            }
        }
        if (totalOutQty > 0) {
            await productStockIn(IN_NO, PRODUCT_CODE, TO_CUST, FROM_CUST, parseInt(totalOutQty).toString(), PRODUCT_CODE, currentDate)
            await stockTabelDelivery(currentDate, IN_NO, PRODUCT_CODE, FROM_CUST, parseInt(totalOutQty).toString(), PRODUCT_CODE)
            await stockTableIn(currentDate, IN_NO, PRODUCT_CODE, TO_CUST, parseInt(totalOutQty).toString(), PRODUCT_CODE, currentDate)
        }
    } catch (error) {
        console.error("Error executing query:", error);

    }
    loading += " - done"
    // console.log(loading);
}

async function stockTabelDelivery(FROM_CUST, PRODUCT_CODE, PRODUCT_QTY, PRODUCT_COST, currentDate) {
    var loading = "stockTabelDelivery "
    loading += "- pending"
    // console.log(loading);
    var dvrPrice = parseFloat(PRODUCT_QTY) * parseFloat(PRODUCT_COST)
    try {
        var sqlQuery = `SELECT 
        (SELECT COUNT(*) FROM STOCK_TBL WITH(NOLOCK) WHERE CUST_CODE = '${FROM_CUST}' AND PRODUCT_CODE = '${PRODUCT_CODE}') AS TOT_CNT,
        (SELECT COUNT(*) FROM STOCK_TBL WITH(NOLOCK) WHERE CUST_CODE = '${FROM_CUST}' AND PRODUCT_CODE = '${PRODUCT_CODE}' AND STOCK_DATE = '${currentDate}') AS DATE_CNT,
        (SELECT COUNT(*) FROM STOCK_TBL WITH(NOLOCK) WHERE CUST_CODE = '${FROM_CUST}' AND PRODUCT_CODE = '${PRODUCT_CODE}' AND STOCK_DATE > '${currentDate}') AS DATE_HIGH_CNT,
        (SELECT COUNT(*) FROM STOCK_TBL WITH(NOLOCK) WHERE CUST_CODE = '${FROM_CUST}' AND PRODUCT_CODE = '${PRODUCT_CODE}' AND STOCK_DATE < '${currentDate}') AS DATE_LOW_CNT`

        var result = await new mssql.Request().query(sqlQuery)
        var row = result.recordset[0]

        const totalCount = row["TOT_CNT"]
        const dateCount = row["DATE_CNT"]
        const dateHighCount = row["DATE_HIGH_CNT"]
        const dateLowCount = row["DATE_LOW_CNT"]
        if (totalCount == "0") {
            var sqlQuery = `INSERT INTO STOCK_TBL (CUST_CODE, PRODUCT_CODE, STOCK_DATE, 
                TRANS_QTY, TRANS_PRICE,
                IN_QTY, IN_PRICE,
                OUT_QTY, OUT_PRICE,
                STOCK_QTY, STOCK_PRICE)
                VALUES ('${FROM_CUST}', '${PRODUCT_CODE}', '00000000',
                0,0,
                0,0,
                0,0,
                0,0)`
            await new mssql.Request().query(sqlQuery)
        }

        if (dateCount == "0" && dateHighCount == "0") {
            if (dateLowCount == "0") {
                var sqlQuery = `INSERT INTO STOCK_TBL (CUST_CODE, PRODUCT_CODE, STOCK_DATE, 
                    TRANS_QTY, TRANS_PRICE,
                    IN_QTY, IN_PRICE,
                    OUT_QTY, OUT_PRICE,
                    STOCK_QTY, STOCK_PRICE)
            VALUES ('${FROM_CUST}', '${PRODUCT_CODE}', '${currentDate}',
                    0,0,
                    0,0,
                  ${PRODUCT_QTY}, ${dvrPrice},
                  -${PRODUCT_QTY}, -${dvrPrice})`
                await new mssql.Request().query(sqlQuery)
            } else {
                var sqlQuery = `INSERT INTO STOCK_TBL (CUST_CODE, PRODUCT_CODE, STOCK_DATE,
                    TRANS_QTY, TRANS_PRICE,
                    IN_QTY, IN_PRICE,
                    OUT_QTY, OUT_PRICE,
                    STOCK_QTY, STOCK_PRICE)
                    SELECT TOP 1 
                        CUST_CODE, PRODUCT_CODE, '${currentDate}',
                        STOCK_QTY, STOCK_PRICE,
                        0, 0,
                    ${PRODUCT_QTY}, ${dvrPrice},
                        STOCK_QTY - ${PRODUCT_QTY}, STOCK_PRICE - ${dvrPrice}
                    FROM STOCK_TBL
                    WHERE CUST_CODE = '${FROM_CUST}'
                    AND PRODUCT_CODE = '${PRODUCT_CODE}'
                    AND STOCK_DATE < '${currentDate}'
                    ORDER BY STOCK_DATE DESC`
                await new mssql.Request().query(sqlQuery)
            }
        } else if (dateCount != "0" && dateHighCount == "0") {
            var sqlQuery = `UPDATE STOCK_TBL
            SET OUT_QTY = OUT_QTY + ${PRODUCT_QTY},
                OUT_PRICE = OUT_PRICE + ${dvrPrice},
                STOCK_QTY = STOCK_QTY - ${PRODUCT_QTY},
                STOCK_PRICE = STOCK_PRICE - ${dvrPrice}
            WHERE CUST_CODE = '${FROM_CUST}'
            AND PRODUCT_CODE = '${PRODUCT_CODE}'
            AND STOCK_DATE = '${currentDate}'`
            await new mssql.Request().query(sqlQuery)
        } else if (dateCount != "0" && dateHighCount != "0") {
            var sqlQuery = `SELECT STOCK_DATE FROM STOCK_TBL WITH(NOLOCK)
            WHERE CUST_CODE = '${FROM_CUST}'
              AND PRODUCT_CODE = '${PRODUCT_CODE}'
              AND STOCK_DATE >= '${currentDate}'
            ORDER BY STOCK_DATE`
            var result = await new mssql.Request().query(sqlQuery)
            var rows = result.recordset

            for (const row of rows) {
                var stockDate = row["STOCK_DATE"]
                if (currentDate == stockDate) {
                    var sqlQuery = `UPDATE STOCK_TBL
                    SET OUT_QTY = OUT_QTY + ${PRODUCT_QTY},
                        OUT_PRICE = OUT_PRICE + ${dvrPrice},
                        STOCK_QTY = STOCK_QTY - ${PRODUCT_QTY},
                        STOCK_PRICE = STOCK_PRICE - ${dvrPrice}
                    WHERE CUST_CODE = '${FROM_CUST}'
                    AND PRODUCT_CODE = '${PRODUCT_CODE}'
                    AND STOCK_DATE = '${stockDate}'`
                    await new mssql.Request().query(sqlQuery)
                } else {
                    var sqlQuery = `UPDATE STOCK_TBL
                    SET TRANS_QTY = TRANS_QTY - ${PRODUCT_QTY},
                        TRANS_PRICE = TRANS_PRICE - ${dvrPrice},
                        STOCK_QTY = STOCK_QTY - ${PRODUCT_QTY},
                        STOCK_PRICE = STOCK_PRICE - ${dvrPrice}
                    WHERE CUST_CODE = '${FROM_CUST}'
                    AND PRODUCT_CODE = '${PRODUCT_CODE}'
                    AND STOCK_DATE = '${stockDate}'`
                    await new mssql.Request().query(sqlQuery)
                }
            }
        } else if (dateCount == "0" && dateHighCount != "0") {
            if (dateCount == "0") {
                var sqlQuery = `INSERT INTO STOCK_TBL (CUST_CODE, PRODUCT_CODE, STOCK_DATE, 
                    TRANS_QTY, TRANS_PRICE,
                    IN_QTY, IN_PRICE,
                    OUT_QTY, OUT_PRICE,
                    STOCK_QTY, STOCK_PRICE)
                    VALUES ('${FROM_CUST}', '${PRODUCT_CODE}', '${currentDate}',
                    0,0,
                    0,0,
                  ${PRODUCT_QTY}, ${dvrPrice},
                  -${PRODUCT_QTY}, -${dvrPrice})`
                await new mssql.Request().query(sqlQuery)
            } else {
                var sqlQuery = `INSERT INTO STOCK_TBL (CUST_CODE, PRODUCT_CODE, STOCK_DATE,
                    TRANS_QTY, TRANS_PRICE,
                    IN_QTY, IN_PRICE,
                    OUT_QTY, OUT_PRICE,
                    STOCK_QTY, STOCK_PRICE)
                    SELECT TOP 1 
                        CUST_CODE, PRODUCT_CODE, '${currentDate}',
                        STOCK_QTY, STOCK_PRICE,
                        0, 0,
                    ${PRODUCT_QTY}, ${dvrPrice},
                        STOCK_QTY - ${PRODUCT_QTY}, STOCK_PRICE - ${dvrPrice}
                    FROM STOCK_TBL
                    WHERE CUST_CODE = '${FROM_CUST}'
                    AND PRODUCT_CODE = '${PRODUCT_CODE}'
                    AND STOCK_DATE < '${currentDate}'
                    ORDER BY STOCK_DATE DESC`
                await new mssql.Request().query(sqlQuery)
            }
        }
        await stockCustTableUpload(FROM_CUST, PRODUCT_CODE)
    } catch (error) {
        console.error("Error executing query:", error);

    }
    loading += " - done"
    // console.log(loading);
}

async function stockTableIn(TO_CUST, PRODUCT_CODE, PRODUCT_QTY, PRODUCT_COST, currentDate) {
    var loading = "stockTableIn "
    loading += "- pending"
    // console.log(loading);
    var inPrice = parseFloat(PRODUCT_QTY) * parseFloat(PRODUCT_COST)
    try {
        var sqlQuery = `  SELECT 
        (SELECT COUNT(*) FROM STOCK_TBL WITH(NOLOCK) WHERE CUST_CODE = '${TO_CUST}' AND PRODUCT_CODE = '${PRODUCT_CODE}') AS TOT_CNT,
        (SELECT COUNT(*) FROM STOCK_TBL WITH(NOLOCK) WHERE CUST_CODE = '${TO_CUST}' AND PRODUCT_CODE = '${PRODUCT_CODE}' AND STOCK_DATE = '${currentDate}') AS DATE_CNT,
        (SELECT COUNT(*) FROM STOCK_TBL WITH(NOLOCK) WHERE CUST_CODE = '${TO_CUST}' AND PRODUCT_CODE = '${PRODUCT_CODE}' AND STOCK_DATE > '${currentDate}') AS DATE_HIGH_CNT,
        (SELECT COUNT(*) FROM STOCK_TBL WITH(NOLOCK) WHERE CUST_CODE = '${TO_CUST}' AND PRODUCT_CODE = '${PRODUCT_CODE}' AND STOCK_DATE < '${currentDate}') AS DATE_LOW_CNT`
        var result = await new mssql.Request().query(sqlQuery)
        var row = result.recordset[0]

        const totalCount = row["TOT_CNT"]
        const dateCount = row["DATE_CNT"]
        const dateHighCount = row["DATE_HIGH_CNT"]
        const dateLowCount = row["DATE_LOW_CNT"]

        if (totalCount == "0") {
            var sqlQuery = `INSERT INTO STOCK_TBL (CUST_CODE, PRODUCT_CODE, STOCK_DATE, 
                TRANS_QTY, TRANS_PRICE,
                IN_QTY, IN_PRICE,
                OUT_QTY, OUT_PRICE,
                STOCK_QTY, STOCK_PRICE)
                VALUES ('${TO_CUST}', '${PRODUCT_CODE}', '${currentDate}',
                0,0,
              ${PRODUCT_QTY}, ${inPrice},
                0,0,
              ${PRODUCT_QTY}, ${inPrice})`
            await new mssql.Request().query(sqlQuery)
        }
        if (dateCount == "0" && dateHighCount == "0") {
            if (dateLowCount == "0") {
                var sqlQuery = `INSERT INTO STOCK_TBL (CUST_CODE, PRODUCT_CODE, STOCK_DATE, 
                    TRANS_QTY, TRANS_PRICE,
                    IN_QTY, IN_PRICE,
                    OUT_QTY, OUT_PRICE,
                    STOCK_QTY, STOCK_PRICE)
                    VALUES ('${TO_CUST}', '${PRODUCT_CODE}', '${currentDate}',
                    0,0,
                  ${PRODUCT_QTY}, ${inPrice},
                    0,0,
                  ${PRODUCT_QTY}, ${inPrice})`
                await new mssql.Request().query(sqlQuery)
            } else {
                var sqlQuery = `INSERT INTO STOCK_TBL (CUST_CODE, PRODUCT_CODE, STOCK_DATE,
                    TRANS_QTY, TRANS_PRICE,
                    IN_QTY, IN_PRICE,
                    OUT_QTY, OUT_PRICE,
                    STOCK_QTY, STOCK_PRICE)
                    SELECT TOP 1 
                        CUST_CODE, PRODUCT_CODE, '${currentDate}',
                        STOCK_QTY, STOCK_PRICE,
                    ${PRODUCT_QTY}, ${inPrice},
                        0, 0,
                        STOCK_QTY + ${PRODUCT_QTY}, STOCK_PRICE + ${inPrice}
                    FROM STOCK_TBL
                    WHERE CUST_CODE = '${TO_CUST}'
                    AND PRODUCT_CODE = '${PRODUCT_CODE}'
                    AND STOCK_DATE < '${currentDate}'
                    ORDER BY STOCK_DATE DESC`
                await new mssql.Request().query(sqlQuery)
            }
        } else if (dateCount != "0" && dateHighCount != "0") {
            var sqlQuery = `UPDATE STOCK_TBL
            SET IN_QTY = IN_QTY + ${PRODUCT_QTY},
                IN_PRICE = IN_PRICE + ${inPrice},
                STOCK_QTY = STOCK_QTY + ${PRODUCT_QTY},
                STOCK_PRICE = STOCK_PRICE + ${inPrice}
            WHERE CUST_CODE = '${TO_CUST}'
            AND PRODUCT_CODE = '${PRODUCT_CODE}'
            AND STOCK_DATE = '${currentDate}'`
            await new mssql.Request().query(sqlQuery)
        } else if (dateCount != "0" && dateHighCount != "0") {
            var sqlQuery = `SELECT STOCK_DATE FROM STOCK_TBL WITH(NOLOCK)
            WHERE CUST_CODE = '${TO_CUST}'
              AND PRODUCT_CODE = '${PRODUCT_CODE}'
              AND STOCK_DATE >= '${currentDate}'
            ORDER BY STOCK_DATE`
            var result = await new mssql.Request().query(sqlQuery)
            var rows = result.recordset

            for (const row of rows) {
                var stockDate = row["STOCK_DATE"]
                if (currentDate == stockDate) {
                    var sqlQuery = `UPDATE STOCK_TBL
                    SET IN_QTY = IN_QTY + ${PRODUCT_QTY},
                        IN_PRICE = IN_PRICE + ${inPrice},
                        STOCK_QTY = STOCK_QTY + ${PRODUCT_QTY},
                        STOCK_PRICE = STOCK_PRICE + ${inPrice}
                    WHERE CUST_CODE = '${TO_CUST}'
                    AND PRODUCT_CODE = '${PRODUCT_CODE}'
                    AND STOCK_DATE = '${stockDate}'`
                    await new mssql.Request().query(sqlQuery)
                } else {
                    var sqlQuery = `UPDATE STOCK_TBL
                    SET TRANS_QTY = TRANS_QTY + ${PRODUCT_QTY},
                        TRANS_PRICE = TRANS_PRICE + ${inPrice},
                        STOCK_QTY = STOCK_QTY + ${PRODUCT_QTY},
                        STOCK_PRICE = STOCK_PRICE + ${inPrice}
                    WHERE CUST_CODE = '${TO_CUST}'
                    AND PRODUCT_CODE = '${PRODUCT_CODE}'
                    AND STOCK_DATE = '${stockDate}'`
                    await new mssql.Request().query(sqlQuery)
                }
            }
        } else if (dateCount == "0" && dateHighCount != "0") {
            var sqlQuery = `INSERT INTO STOCK_TBL (CUST_CODE, PRODUCT_CODE, STOCK_DATE,
                TRANS_QTY, TRANS_PRICE,
                IN_QTY, IN_PRICE,
                OUT_QTY, OUT_PRICE,
                STOCK_QTY, STOCK_PRICE)
                SELECT TOP 1 
                CUST_CODE, PRODUCT_CODE, '${currentDate}',
                STOCK_QTY, STOCK_PRICE,
                ${PRODUCT_QTY}, ${inPrice},
                0, 0,
                STOCK_QTY + ${PRODUCT_QTY}, STOCK_PRICE + ${inPrice}
                FROM STOCK_TBL
                WHERE CUST_CODE = '${TO_CUST}'
                AND PRODUCT_CODE = '${PRODUCT_CODE}'
                AND STOCK_DATE < '${currentDate}'
                ORDER BY STOCK_DATE DESC`
            await new mssql.Request().query(sqlQuery)

            var sqlQuery = `UPDATE STOCK_TBL
            SET TRANS_QTY = TRANS_QTY + ${PRODUCT_QTY},
                TRANS_PRICE = TRANS_PRICE + ${inPrice},
                STOCK_QTY = STOCK_QTY + ${PRODUCT_QTY},
                STOCK_PRICE = STOCK_PRICE + ${inPrice}
            WHERE CUST_CODE = '${TO_CUST}'
            AND PRODUCT_CODE = '${PRODUCT_CODE}'
            AND STOCK_DATE > '${currentDate}'`
            await new mssql.Request().query(sqlQuery)
        } else if (dateCount != "0" && dateHighCount == "0") {
            var sqlQuery = `UPDATE STOCK_TBL
            SET IN_QTY = IN_QTY + ${PRODUCT_QTY},
                IN_PRICE = IN_PRICE + ${inPrice},
                STOCK_QTY = STOCK_QTY + ${PRODUCT_QTY},
                STOCK_PRICE = STOCK_PRICE + ${inPrice}
            WHERE CUST_CODE = '${TO_CUST}'
            AND PRODUCT_CODE = '${PRODUCT_CODE}'
            AND STOCK_DATE = '${currentDate}'`
            await new mssql.Request().query(sqlQuery)
        }
        await stockCustTableUpload(TO_CUST, PRODUCT_CODE)
    }
    catch (error) {
        console.error("Error executing query:", error);

    }
    loading += " - done"
    // console.log(loading);
}

async function productStockIn(IN_NO, PRODUCT_CODE, TO_CUST, FROM_CUST, PRODUCT_QTY, PRODUCT_COST, currentDate) {
    var loading = "productStockIn "
    loading += "- pending"
    // console.log(loading);

    try {
        var sqlQuery = `INSERT INTO PRD_STOCK_TBL (IN_NO, SEQ_NO, INOUT_SEQ, PRODUCT_CODE,
            INOUT_QTY, INOUT_COST,
            P_CUST_CODE, F_CUST_CODE, INOUT_DATE,
            DVR_NO, DVR_SEQ, END_YN)
            SELECT '${IN_NO}', ISNULL(MAX(INOUT_SEQ),0) + 1, 0, '${PRODUCT_CODE}',
                    ${PRODUCT_QTY}, ${PRODUCT_COST},
                '${TO_CUST}', '${FROM_CUST}', '${currentDate}',
                '', 0, 'N'
            FROM PRD_STOCK_TBL WITH(NOLOCK)
            WHERE IN_NO = '${IN_NO}' `
        await new mssql.Request().query(sqlQuery)
    } catch (error) {
        console.error("Error executing query:", error);

    }
    loading += " - done"
    // console.log(loading);
}

async function productStockTableDelivery(IN_NO, SEQ_NO, OUT_NO, dvrSeqNo, PRODUCT_CODE, FROM_CUST, TO_CUST, Qty, Cost, currentDate) {
    var loading = "productStockTableDelivery "
    loading += "- pending"
    // console.log(loading);

    try {
        var sqlQuery = `INSERT INTO PRD_STOCK_TBL (IN_NO, SEQ_NO, INOUT_SEQ, PRODUCT_CODE,
            INOUT_QTY, INOUT_COST,
            P_CUST_CODE, F_CUST_CODE, INOUT_DATE,
            DVR_NO, DVR_SEQ, END_YN)
            SELECT '${IN_NO}',${SEQ_NO}, ISNULL(MAX(INOUT_SEQ),0) + 1,  '${PRODUCT_CODE}',
                    ${Qty}, ${Cost},
                '${TO_CUST}', '${FROM_CUST}', '${currentDate}',
                '${OUT_NO}', ${dvrSeqNo}, 'N'
            FROM PRD_STOCK_TBL WITH(NOLOCK)
            WHERE IN_NO = '${IN_NO}' AND SEQ_NO = ${SEQ_NO}`
        // console.log(sqlQuery);
        await new mssql.Request().query(sqlQuery)

        sqlQuery = `SELECT
        (SELECT INOUT_QTY FROM PRD_STOCK_TBL WITH(NOLOCK)
          WHERE IN_NO = '${IN_NO}' AND SEQ_NO = ${SEQ_NO} AND PRODUCT_CODE = '${PRODUCT_CODE}' AND INOUT_SEQ = 0) AS IN_QTY,
        (SELECT SUM(INOUT_QTY) FROM PRD_STOCK_TBL WITH(NOLOCK)
          WHERE IN_NO = '${IN_NO}' AND SEQ_NO = ${SEQ_NO} AND PRODUCT_CODE = '${PRODUCT_CODE}' AND INOUT_SEQ > 0) AS OUT_QTY`
        var result = await new mssql.Request().query(sqlQuery)
        var row = result.recordset[0]
        var inQty = parseFloat(row["IN_QTY"])
        var outQty = parseFloat(row["OUT_QTY"])

        if (inQty <= outQty) {
            var sqlQuery = `UPDATE PRD_STOCK_TBL SET END_YN = 'Y' 
            WHERE IN_NO = '${IN_NO}' AND SEQ_NO = ${SEQ_NO}`
            await new mssql.Request().query(sqlQuery)
        }
        await productStockIn(IN_NO, PRODUCT_CODE, TO_CUST, FROM_CUST, parseInt(Qty).toString(), parseInt(Cost).toString(), currentDate)
    } catch (error) {
        console.error("Error executing query:", error);

    }
    loading += " - done"
    // console.log(loading);
}

async function stockCustTableUpload(_CUST, PRODUCT_CODE) {
    var loading = "stockCustTableUpload "
    loading += "- pending"
    // console.log(loading);
    sqlQuery = `SELECT STOCK_QTY, STOCK_PRICE FROM STOCK_TBL WITH(NOLOCK)
    WHERE CUST_CODE = '${_CUST}' AND PRODUCT_CODE = '${PRODUCT_CODE}'
    AND STOCK_DATE = (SELECT MAX(STOCK_DATE) FROM STOCK_TBL WITH(NOLOCK) WHERE CUST_CODE ='${_CUST}' AND PRODUCT_CODE = '${PRODUCT_CODE}')`
    var result = await new mssql.Request().query(sqlQuery)
    var rows = result.recordset

    if (rows.length == 0) return

    var stockQty = parseFloat(rows[0]["STOCK_QTY"])
    var stockPrice = parseFloat(rows[0]["STOCK_PRICE"])

    if (stockQty == 0) {
        var sqlQuery = `DELETE FROM STOCK_CUST_TBL WHERE CUST_CODE = '${_CUST}' AND PRODUCT_CODE = '${PRODUCT_CODE}'`
        await new mssql.Request().query(sqlQuery)
    } else {
        sqlQuery = `SELECT COUNT(*) AS CNT FROM STOCK_CUST_TBL WITH(NOLOCK) WHERE CUST_CODE = '${_CUST}' AND PRODUCT_CODE = '${PRODUCT_CODE}'`
        var result = await new mssql.Request().query(sqlQuery)
        var row = result.recordset[0]
        var count = row["CNT"]

        if (count == "0") {
            var sqlQuery = `INSERT INTO STOCK_CUST_TBL (CUST_CODE, PRODUCT_CODE, STOCK_QTY, STOCK_PRICE)
            VALUES ('${_CUST}','${PRODUCT_CODE}',${stockQty},${stockPrice})`
            await new mssql.Request().query(sqlQuery)
        } else {
            var sqlQuery = `UPDATE STOCK_CUST_TBL
            SET STOCK_QTY = ${stockQty},
                STOCK_PRICE = ${stockPrice}
            WHERE CUST_CODE = '${_CUST}' AND PRODUCT_CODE = '${PRODUCT_CODE}'`
            await new mssql.Request().query(sqlQuery)
        }
    }
    loading += " - done"
    // console.log(loading);
}
async function fabricOut(FROM_CUST, FABRIC_NO, PRODUCT_QTY, currentDate, currentTime, EMP_NO) {
    var loading = "fabricOut "
    loading += "- pending"
    // console.log(loading);

    var stockQty = 0
    sqlQuery = `SELECT STOCK_QTY FROM FABRIC_STOCK_TBL WITH(NOLOCK) WHERE CUST_CODE = '${FROM_CUST}' AND IN_NO = '${FABRIC_NO}'`
    var result = await new mssql.Request().query(sqlQuery)
    var rows = result.recordset
    if (rows.length == 0) stockQty = 0
    else stockQty = rows[0]["STOCK_QTY"]
    if (PRODUCT_QTY >= stockQty) {
        var sqlQuery = `DELETE FROM FABRIC_STOCK_TBL WHERE CUST_CODE = '${FROM_CUST}' AND IN_NO = '${FABRIC_NO}'`
        await new mssql.Request().query(sqlQuery)
    } else {
        var newStockQty = stockQty - parseInt(PRODUCT_QTY)
        var sqlQuery = `UPDATE FABRIC_STOCK_TBL SET STOCK_QTY = ${newStockQty} WHERE CUST_CODE = '${FROM_CUST}'  AND IN_NO = '${FABRIC_NO}'`
        await new mssql.Request().query(sqlQuery)
    }
    var remark = "Update location"
    var sqlQuery = `INSERT INTO FABRIC_INOUT_TBL (IN_NO, SEQ_NO, INOUT_DIV, INOUT_QTY, REG_DATE, REG_TIME, EMP_NO, REMARK)
    SELECT '${FABRIC_NO}', ISNULL(MAX(SEQ_NO), 0) + 1, '2', ${PRODUCT_QTY}, '${currentDate}', '${currentTime}', '${EMP_NO}', '${remark}'
      FROM FABRIC_INOUT_TBL WITH(NOLOCK)
    WHERE IN_NO = '${FABRIC_NO}'`
    await new mssql.Request().query(sqlQuery)
    loading += " - done"
    // console.log(loading);
}

async function fabricIn(FABRIC_NO, TO_CUST, PRODUCT_CODE, PRODUCT_QTY, currentDate, currentTime, EMP_NO, IMP_NO, DVR_NO, REMARK, currentDate2) {
    var loading = "fabricIn "
    loading += "- pending"
    // console.log(loading);

    var SEQ_NO = 1
    var INOUT_DIV = 1

    var sqlQuery = `UPDATE FABRIC_IN_TBL SET IN_DATE='${currentDate2}', IN_TIME='${currentTime}', EMP_NO='${EMP_NO}' WHERE IN_NO = '${FABRIC_NO}'`
    await new mssql.Request().query(sqlQuery)

    var sqlQuery = `UPDATE FABRIC_INOUT_TBL SET INOUT_QTY=${PRODUCT_QTY}, REG_DATE='${currentDate}', REG_TIME='${currentTime}', REMARK='${REMARK}' WHERE SEQ_NO=${SEQ_NO} AND INOUT_DIV=${INOUT_DIV}`
    await new mssql.Request().query(sqlQuery)

    var sqlQuery = `INSERT INTO FABRIC_STOCK_TBL (CUST_CODE, IN_NO, STOCK_QTY) VALUES ('${TO_CUST}', '${FABRIC_NO}', ${PRODUCT_QTY})`
    await new mssql.Request().query(sqlQuery)
    loading += " - done"
    // console.log(loading);
}

async function getFabricNo(req, res) {
    const PRODUCT_CODE = decodeURIComponent(req.query.PRODUCT_CODE) || "";
    if (PRODUCT_CODE.length == 0) {
        res.json({ success: false, message: "PRODUCT_CODE must not be empty" });
        return; // Return early if emp_no is empty
    }
    try {
        var sqlQuery = `SELECT C.CUST_NAME,A.IN_NO,A.STOCK_QTY FROM FABRIC_STOCK_TBL A 
        LEFT JOIN FABRIC_IN_TBL B ON A.IN_NO = B.IN_NO 
        LEFT JOIN CUSTOMER_TBL C ON C.CUST_CODE = A.CUST_CODE 
        WHERE B.PRODUCT_CODE='${PRODUCT_CODE}'`
        var result = await new mssql.Request().query(sqlQuery);
        var rows = result.recordset
        var data = []
        if (rows.length == 0) res.json({ success: true, message: "empty Data", data });
        for (const row of rows) {
            var js = {}
            js.CUST_NAME = row["CUST_NAME"]
            js.IN_NO = row["IN_NO"]
            js.STOCK_QTY = row["STOCK_QTY"]
            data.push(js)
        }
        res.json({ success: true, message: "SUCCESS", data });
    } catch (error) {
        res.status(500).json({ success: false, message: "An error occurred while processing the request" });
    }
}
module.exports.getFabricNo = getFabricNo