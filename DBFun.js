var db = require("./DBProc.js");
var Var = require("./Var.js");
var NewLine = "\r\n"

let mssql;
function settingDb(mssqlConnect) {
    mssql = mssqlConnect;
}
module.exports.settingDb = settingDb;
async function GP_Stock_Move(_dvrNo, _dvrSeqNo, _inNo, _OutCustCode, _inCustCode, _date, _productCode, _moveQty) {
    try {
        let sSql = ""
        let lf_productCost = parseFloat(await productCode2productCost(_productCode));
        let lf_Tot_OutQty = _moveQty;
        let lf_Tot_Price = 0;

        let lf_Temp_Qty = 0;
        let lf_Temp_Cost = 0;
        sSql += "SELECT A.IN_NO, A.SEQ_NO, A.INOUT_DATE, A.INOUT_COST, A.INOUT_QTY AS IN_QTY," + NewLine;
        sSql += "      (SELECT SUM(INOUT_QTY) FROM PRD_STOCK_TBL WITH(NOLOCK) WHERE IN_NO = A.IN_NO AND SEQ_NO = A.SEQ_NO AND INOUT_SEQ > 0) AS OUT_QTY" + NewLine;
        sSql += "  FROM PRD_STOCK_TBL A WITH(NOLOCK)" + NewLine;
        sSql += " WHERE A.P_CUST_CODE = '" + _OutCustCode + "'" + NewLine;
        sSql += "   AND A.PRODUCT_CODE = '" + _productCode + "'" + NewLine;
        sSql += "   AND A.INOUT_SEQ = 0" + NewLine;
        sSql += "   AND A.END_YN <> 'Y'" + NewLine;
        sSql += " ORDER BY INOUT_DATE" + NewLine;
        let rs = await db.Sql2DataRecordset(sSql);

        if (rs.length == 0) {
            await StockTbl_DVR(_date, _OutCustCode, _productCode, _moveQty, lf_productCost, lf_productCost * _moveQty);
            // Receipt and handling
            await StockTbl_IN(_date, _inCustCode, _productCode, _moveQty, lf_productCost, lf_productCost * _moveQty);
            // first-in-first-out
            await PrdStockTbl_IN(_inNo, 0, _productCode, _inCustCode, _OutCustCode, _moveQty, lf_productCost, _moveQty * lf_productCost);

            lf_Tot_OutQty = 0;
        } else {
            for (i = 0; i < rs.length; i++) {
                if (lf_Tot_OutQty <= 0) break;

                lf_Temp_Qty = Math.round(Number(rs[i]["IN_QTY"]) - Number(rs[i]["OUT_QTY"]));
                lf_Temp_Cost = Number(rs[i]["INOUT_COST"]);

                if (lf_Tot_OutQty > lf_Temp_Qty || lf_Tot_OutQty == lf_Temp_Qty) {
                    await PrdStockTbl_Dvr(rs[i]["IN_NO"], parseInt(rs[i]["SEQ_NO"]), _dvrNo, _dvrSeqNo, _productCode, _OutCustCode, _inCustCode, lf_Temp_Qty, lf_Temp_Cost);
                    // First in, first out
                    await PrdStockTbl_IN(_inNo, 0, _productCode, _inCustCode, _OutCustCode, lf_Temp_Qty, lf_Temp_Cost, lf_Temp_Qty * lf_Temp_Cost);
                    // Delivery on receipt and delivery
                    await StockTbl_DVR(_date, _OutCustCode, _productCode, lf_Temp_Qty, lf_Temp_Cost, lf_Temp_Qty * lf_Temp_Cost);
                    // Pick up and pay
                    await StockTbl_IN(_date, _inCustCode, _productCode, lf_Temp_Qty, lf_Temp_Cost, lf_Temp_Qty * lf_Temp_Cost);

                    lf_Tot_Price += lf_Temp_Qty * lf_Temp_Cost;
                    lf_Tot_OutQty -= lf_Temp_Qty;
                }
                else if (lf_Tot_OutQty < lf_Temp_Qty) {
                    await PrdStockTbl_Dvr(rs[i]["IN_NO"], parseInt(rs[i]["SEQ_NO"]), _dvrNo, _dvrSeqNo, _productCode, _OutCustCode, _inCustCode, lf_Tot_OutQty, lf_Temp_Cost);
                    // First in, first out
                    await PrdStockTbl_IN(_inNo, 0, _productCode, _inCustCode, _OutCustCode, lf_Tot_OutQty, lf_Temp_Cost, lf_Tot_OutQty * lf_Temp_Cost);
                    // Delivery on receipt and delivery
                    await StockTbl_DVR(_date, _OutCustCode, _productCode, lf_Tot_OutQty, lf_Temp_Cost, lf_Tot_OutQty * lf_Temp_Cost);
                    // Pick up and pay
                    await StockTbl_IN(_date, _inCustCode, _productCode, lf_Tot_OutQty, lf_Temp_Cost, lf_Tot_OutQty * lf_Temp_Cost);

                    lf_Tot_Price += lf_Tot_OutQty * lf_Temp_Cost;
                    lf_Tot_OutQty -= lf_Tot_OutQty;
                }
            }
        }
        if (lf_Tot_OutQty > 0) {
            // First in, first out warehousing processing
            await PrdStockTbl_IN(_inNo, 0, _productCode, _inCustCode, _OutCustCode, lf_Tot_OutQty, lf_productCost, lf_Tot_OutQty * lf_Tot_OutQty);
            // Receipt/payment shipping processing
            await StockTbl_DVR(_date, _OutCustCode, _productCode, lf_Tot_OutQty, lf_productCost, lf_productCost * lf_Tot_OutQty);
            // Receipt/payment processing
            await StockTbl_IN(_date, _inCustCode, _productCode, lf_Tot_OutQty, lf_productCost, lf_productCost * lf_Tot_OutQty);
        }
    } catch (error) {
        throw error
    }
}
module.exports.GP_Stock_Move = GP_Stock_Move

async function productCode2productCost(_productCode) {
    try {
        let sSql = `SELECT PRODUCT_COST FROM PRODUCT_TBL WITH(NOLOCK) WHERE PRODUCT_CODE='${_productCode}'`
        let rs = await db.Sql2DataRecordset(sSql)
        return rs[0]["PRODUCT_COST"]
    } catch (error) {
        throw error
    }
}
module.exports.productCode2productCost = productCode2productCost

async function StockTbl_DVR(_dvrDate, _pCustCode, _productCode, _dvrQty, _cost, _dvrPrice) {
    try {
        let sSql = ""
        let ls_Stock_Tbl = "STOCK_TBL";
        let rs;
        let rsLoop;
        sSql += "SELECT " + NewLine
        sSql += "      (SELECT COUNT(*) FROM STOCK_TBL WITH(NOLOCK) WHERE CUST_CODE = '" + _pCustCode + "' AND PRODUCT_CODE = '" + _productCode + "') AS TOT_CNT," + NewLine
        sSql += "      (SELECT COUNT(*) FROM STOCK_TBL WITH(NOLOCK) WHERE CUST_CODE = '" + _pCustCode + "' AND PRODUCT_CODE = '" + _productCode + "' AND STOCK_DATE = '" + _dvrDate + "') AS DATE_CNT," + NewLine
        sSql += "      (SELECT COUNT(*) FROM STOCK_TBL WITH(NOLOCK) WHERE CUST_CODE = '" + _pCustCode + "' AND PRODUCT_CODE = '" + _productCode + "' AND STOCK_DATE > '" + _dvrDate + "') AS DATE_HIGH_CNT," + NewLine
        sSql += "      (SELECT COUNT(*) FROM STOCK_TBL WITH(NOLOCK) WHERE CUST_CODE = '" + _pCustCode + "' AND PRODUCT_CODE = '" + _productCode + "' AND STOCK_DATE < '" + _dvrDate + "') AS DATE_LOW_CNT" + NewLine

        rs = await db.Sql2DataRecordset(sSql);
        if (rs[0]["TOT_CNT"].toString() == "0") {
            sSql = "INSERT INTO " + ls_Stock_Tbl + " (CUST_CODE, PRODUCT_CODE, STOCK_DATE, " + NewLine;
            sSql += "          TRANS_QTY, TRANS_PRICE," + NewLine;
            sSql += "          IN_QTY, IN_PRICE," + NewLine;
            sSql += "          OUT_QTY, OUT_PRICE," + NewLine;
            sSql += "          STOCK_QTY, STOCK_PRICE)" + NewLine;
            sSql += "  VALUES ('" + _pCustCode + "', '" + _productCode + "', '00000000'," + NewLine;
            sSql += "          0,0," + NewLine;
            sSql += "          0,0," + NewLine;
            sSql += "          0,0," + NewLine;
            sSql += "          0,0)";

            await db.SqlExecute(sSql);
        }
        if (rs[0]["DATE_CNT"].toString() == "0" && rs[0]["DATE_HIGH_CNT"].toString() == "0") {
            if (rs[0]["DATE_LOW_CNT"].toString() == "0") {
                //Enter date
                sSql = "INSERT INTO " + ls_Stock_Tbl + " (CUST_CODE, PRODUCT_CODE, STOCK_DATE, " + NewLine;
                sSql += "          TRANS_QTY, TRANS_PRICE," + NewLine;
                sSql += "          IN_QTY, IN_PRICE," + NewLine;
                sSql += "          OUT_QTY, OUT_PRICE," + NewLine;
                sSql += "          STOCK_QTY, STOCK_PRICE)" + NewLine;
                sSql += "  VALUES ('" + _pCustCode + "', '" + _productCode + "', '" + _dvrDate + "'," + NewLine;
                sSql += "          0,0," + NewLine;
                sSql += "          0,0," + NewLine;
                sSql += "        " + _dvrQty + ", " + _dvrPrice + "," + NewLine;
                sSql += "        " + -(_dvrQty) + ", " + -(_dvrPrice) + ")";

                await db.SqlExecute(sSql)
            }
            else {
                //Enter date
                sSql = "INSERT INTO " + ls_Stock_Tbl + " (CUST_CODE, PRODUCT_CODE, STOCK_DATE," + NewLine;
                sSql += "                       TRANS_QTY, TRANS_PRICE," + NewLine;
                sSql += "                       IN_QTY, IN_PRICE," + NewLine;
                sSql += "                       OUT_QTY, OUT_PRICE," + NewLine;
                sSql += "                       STOCK_QTY, STOCK_PRICE)" + NewLine;
                sSql += "SELECT TOP 1 " + NewLine;
                sSql += "       CUST_CODE, PRODUCT_CODE, '" + _dvrDate + "'," + NewLine;
                sSql += "       STOCK_QTY, STOCK_PRICE," + NewLine;
                sSql += "       0, 0," + NewLine;
                sSql += "     " + _dvrQty + ", " + _dvrPrice + "," + NewLine;
                sSql += "       STOCK_QTY - " + _dvrQty + ", STOCK_PRICE - " + _dvrPrice + NewLine;
                sSql += "  FROM " + ls_Stock_Tbl + NewLine;
                sSql += " WHERE CUST_CODE = '" + _pCustCode + "'" + NewLine;
                sSql += "   AND PRODUCT_CODE = '" + _productCode + "'" + NewLine;
                sSql += "   AND STOCK_DATE < '" + _dvrDate + "'" + NewLine;
                sSql += " ORDER BY STOCK_DATE DESC";
                await db.SqlExecute(sSql);
            }
        }
        else if (rs[0]["DATE_CNT"].toString() != "0" && rs[0]["DATE_HIGH_CNT"].toString() == "0") {
            // Correction of the applicable date
            sSql = "UPDATE " + ls_Stock_Tbl + NewLine;
            sSql += "   SET OUT_QTY = OUT_QTY + " + _dvrQty + "," + NewLine;
            sSql += "       OUT_PRICE = OUT_PRICE + " + _dvrPrice + "," + NewLine;
            sSql += "       STOCK_QTY = STOCK_QTY - " + _dvrQty + "," + NewLine;
            sSql += "       STOCK_PRICE = STOCK_PRICE - " + _dvrPrice + NewLine;
            sSql += " WHERE CUST_CODE = '" + _pCustCode + "'" + NewLine;
            sSql += "   AND PRODUCT_CODE = '" + _productCode + "'" + NewLine;
            sSql += "   AND STOCK_DATE = '" + _dvrDate + "'";
            await db.SqlExecute(sSql);
        }
        else if (rs[0]["DATE_CNT"].toString() != "0" && rs[0]["DATE_HIGH_CNT"].toString() != "0") {
            sSql = "SELECT STOCK_DATE FROM STOCK_TBL WITH(NOLOCK)" + NewLine;
            sSql += " WHERE CUST_CODE = '" + _pCustCode + "'" + NewLine;
            sSql += "   AND PRODUCT_CODE = '" + _productCode + "'" + NewLine;
            sSql += "   AND STOCK_DATE >= '" + _dvrDate + "'" + NewLine;
            sSql += " ORDER BY STOCK_DATE";
            rsLoop = await db.Sql2DataRecordset(sSql);

            for (i = 0; i < rsLoop.length; i++) {
                if (_dvrDate == rsLoop[i]["STOCK_DATE"].toString()) {
                    sSql = "UPDATE " + ls_Stock_Tbl + NewLine;
                    sSql += "   SET OUT_QTY = OUT_QTY + " + _dvrQty + "," + NewLine;
                    sSql += "       OUT_PRICE = OUT_PRICE + " + _dvrPrice + "," + NewLine;
                    sSql += "       STOCK_QTY = STOCK_QTY - " + _dvrQty + "," + NewLine;
                    sSql += "       STOCK_PRICE = STOCK_PRICE - " + _dvrPrice + NewLine;
                    sSql += " WHERE CUST_CODE = '" + _pCustCode + "'" + NewLine;
                    sSql += "   AND PRODUCT_CODE = '" + _productCode + "'" + NewLine;
                    sSql += "   AND STOCK_DATE = '" + rsLoop[i]["STOCK_DATE"].toString() + "'";
                    await db.SqlExecute(sSql);
                }
                else {
                    sSql = "UPDATE " + ls_Stock_Tbl + NewLine;
                    sSql += "   SET TRANS_QTY = TRANS_QTY - " + _dvrQty + "," + NewLine;
                    sSql += "       TRANS_PRICE = TRANS_PRICE - " + _dvrPrice + "," + NewLine;
                    sSql += "       STOCK_QTY = STOCK_QTY - " + _dvrQty + "," + NewLine;
                    sSql += "       STOCK_PRICE = STOCK_PRICE - " + _dvrPrice + NewLine;
                    sSql += " WHERE CUST_CODE = '" + _pCustCode + "'" + NewLine;
                    sSql += "   AND PRODUCT_CODE = '" + _productCode + "'" + NewLine;
                    sSql += "   AND STOCK_DATE = '" + rsLoop[i]["STOCK_DATE"].toString() + "'";
                    await db.SqlExecute(sSql);
                }
            }
        }
        else if (rs[0]["DATE_CNT"].toString() == "0" && rs[0]["DATE_HIGH_CNT"].toString() != "0") {
            if (rs[0]["DATE_LOW_CNT"].toString() == "0") {
                sSql = "INSERT INTO " + ls_Stock_Tbl + " (CUST_CODE, PRODUCT_CODE, STOCK_DATE, " + NewLine;
                sSql += "          TRANS_QTY, TRANS_PRICE," + NewLine;
                sSql += "          IN_QTY, IN_PRICE," + NewLine;
                sSql += "          OUT_QTY, OUT_PRICE," + NewLine;
                sSql += "          STOCK_QTY, STOCK_PRICE)" + NewLine;
                sSql += "  VALUES ('" + _pCustCode + "', '" + _productCode + "', '" + _dvrDate + "'," + NewLine;
                sSql += "          0,0," + NewLine;
                sSql += "          0,0," + NewLine;
                sSql += "        " + _dvrQty + ", " + _dvrPrice + "," + NewLine;
                sSql += "        " + -(_dvrQty) + ", " + -(_dvrPrice) + ")";
                await db.SqlExecute(sSql);
            }
            else {
                sSql = "INSERT INTO " + ls_Stock_Tbl + " (CUST_CODE, PRODUCT_CODE, STOCK_DATE," + NewLine;
                sSql += "                       TRANS_QTY, TRANS_PRICE," + NewLine;
                sSql += "                       IN_QTY, IN_PRICE," + NewLine;
                sSql += "                       OUT_QTY, OUT_PRICE," + NewLine;
                sSql += "                       STOCK_QTY, STOCK_PRICE)" + NewLine;
                sSql += "SELECT TOP 1 " + NewLine;
                sSql += "       CUST_CODE, PRODUCT_CODE, '" + _dvrDate + "'," + NewLine;
                sSql += "       STOCK_QTY, STOCK_PRICE," + NewLine;
                sSql += "       0, 0," + NewLine;
                sSql += "     " + _dvrQty + ", " + _dvrPrice + "," + NewLine;
                sSql += "       STOCK_QTY - " + _dvrQty + ", STOCK_PRICE - " + _dvrPrice + NewLine;
                sSql += "  FROM " + ls_Stock_Tbl + NewLine;
                sSql += " WHERE CUST_CODE = '" + _pCustCode + "'" + NewLine;
                sSql += "   AND PRODUCT_CODE = '" + _productCode + "'" + NewLine;
                sSql += "   AND STOCK_DATE < '" + _dvrDate + "'" + NewLine;
                sSql += " ORDER BY STOCK_DATE DESC";
                await db.SqlExecute(sSql);
            }
        }
        // Customer inventory processing
        await StockCustTbl_Upd(_pCustCode, _productCode);
    } catch (error) {
        throw error
    }
}
module.exports.StockTbl_DVR = StockTbl_DVR

async function StockCustTbl_Upd(_CustCode, _productCode) {
    try {
        let rs;
        let rsLoop;

        let sSql = "";
        let lf_StockQty = 0;
        let lf_StockPrice = 0;

        sSql += "SELECT STOCK_QTY, STOCK_PRICE FROM STOCK_TBL WITH(NOLOCK)" + NewLine;
        sSql += " WHERE CUST_CODE = '" + _CustCode + "' AND PRODUCT_CODE = '" + _productCode + "'" + NewLine;
        sSql += "   AND STOCK_DATE = (SELECT MAX(STOCK_DATE) FROM STOCK_TBL WITH(NOLOCK) WHERE CUST_CODE = '" + _CustCode + "' AND PRODUCT_CODE = '" + _productCode + "')" + NewLine;

        rs = await db.Sql2DataRecordset(sSql);
        if (rs.length == 0) return;

        lf_StockQty = Number(rs[0]["STOCK_QTY"]);
        lf_StockPrice = Number(rs[0]["STOCK_PRICE"]);

        if (lf_StockQty == 0) {
            sSql = "DELETE FROM STOCK_CUST_TBL WHERE CUST_CODE = '" + _CustCode + "' AND PRODUCT_CODE = '" + _productCode + "'";
            await db.SqlExecute(sSql);
        }
        else {
            sSql = "SELECT COUNT(*) AS CNT FROM STOCK_CUST_TBL WITH(NOLOCK) WHERE CUST_CODE = '" + _CustCode + "' AND PRODUCT_CODE = '" + _productCode + "'" + NewLine;
            rsLoop = await db.Sql2DataRecordset(sSql);

            if (rsLoop[0]["CNT"].toString() == "0") {
                sSql = "INSERT INTO STOCK_CUST_TBL (CUST_CODE, PRODUCT_CODE, STOCK_QTY, STOCK_PRICE)" + NewLine;
                sSql += "VALUES ('" + _CustCode + "','" + _productCode + "'," + lf_StockQty + "," + lf_StockPrice + ")";
                await db.SqlExecute(sSql);
            }
            else {
                sSql = "UPDATE STOCK_CUST_TBL" + NewLine;
                sSql += "   SET STOCK_QTY = " + lf_StockQty + "," + NewLine;
                sSql += "       STOCK_PRICE = " + lf_StockPrice + NewLine;
                sSql += " WHERE CUST_CODE = '" + _CustCode + "' AND PRODUCT_CODE = '" + _productCode + "'";
                await db.SqlExecute(sSql);
            }
        }
    } catch (error) {
        throw error
    }
}
module.exports.StockCustTbl_Upd = StockCustTbl_Upd

async function StockTbl_IN(_inDate, _pCustCode, _productCode, _inQty, _cost, _inPrice) {
    try {
        let sSql = "";
        let ls_Stock_Tbl = "STOCK_TBL";

        let rs;
        let rsLoop;

        sSql += "SELECT " + NewLine;
        sSql += "       (SELECT COUNT(*) FROM STOCK_TBL WITH(NOLOCK) WHERE CUST_CODE = '" + _pCustCode + "' AND PRODUCT_CODE = '" + _productCode + "') AS TOT_CNT," + NewLine;
        sSql += "       (SELECT COUNT(*) FROM STOCK_TBL WITH(NOLOCK) WHERE CUST_CODE = '" + _pCustCode + "' AND PRODUCT_CODE = '" + _productCode + "' AND STOCK_DATE = '" + _inDate + "') AS DATE_CNT," + NewLine;
        sSql += "       (SELECT COUNT(*) FROM STOCK_TBL WITH(NOLOCK) WHERE CUST_CODE = '" + _pCustCode + "' AND PRODUCT_CODE = '" + _productCode + "' AND STOCK_DATE > '" + _inDate + "') AS DATE_HIGH_CNT," + NewLine;
        sSql += "       (SELECT COUNT(*) FROM STOCK_TBL WITH(NOLOCK) WHERE CUST_CODE = '" + _pCustCode + "' AND PRODUCT_CODE = '" + _productCode + "' AND STOCK_DATE < '" + _inDate + "') AS DATE_LOW_CNT" + NewLine;
        rs = await db.Sql2DataRecordset(sSql);

        // For the first time
        if (rs[0]["TOT_CNT"].toString() == "0") {
            sSql = "INSERT INTO " + ls_Stock_Tbl + " (CUST_CODE, PRODUCT_CODE, STOCK_DATE, " + NewLine;
            sSql += "          TRANS_QTY, TRANS_PRICE," + NewLine;
            sSql += "          IN_QTY, IN_PRICE," + NewLine;
            sSql += "          OUT_QTY, OUT_PRICE," + NewLine;
            sSql += "          STOCK_QTY, STOCK_PRICE)" + NewLine;
            sSql += "  VALUES ('" + _pCustCode + "', '" + _productCode + "', '00000000'," + NewLine;
            sSql += "          0,0," + NewLine;
            sSql += "          0,0," + NewLine;
            sSql += "          0,0," + NewLine;
            sSql += "          0,0)";
            await db.SqlExecute(sSql);
        }

        if (rs[0]["DATE_CNT"].toString() == "0" && rs[0]["DATE_HIGH_CNT"].toString() == "0") {
            if (rs[0]["DATE_LOW_CNT"].toString() == "0") {
                sSql = "INSERT INTO " + ls_Stock_Tbl + " (CUST_CODE, PRODUCT_CODE, STOCK_DATE, " + NewLine;
                sSql += "          TRANS_QTY, TRANS_PRICE," + NewLine;
                sSql += "          IN_QTY, IN_PRICE," + NewLine;
                sSql += "          OUT_QTY, OUT_PRICE," + NewLine;
                sSql += "          STOCK_QTY, STOCK_PRICE)" + NewLine;
                sSql += "  VALUES ('" + _pCustCode + "', '" + _productCode + "', '" + _inDate + "'," + NewLine;
                sSql += "          0,0," + NewLine;
                sSql += "        " + _inQty + ", " + _inPrice + "," + NewLine;
                sSql += "          0,0," + NewLine;
                sSql += "        " + _inQty + ", " + _inPrice + ")";
                await db.SqlExecute(sSql);
            }
            else {
                sSql = "INSERT INTO " + ls_Stock_Tbl + " (CUST_CODE, PRODUCT_CODE, STOCK_DATE," + NewLine;
                sSql += "                       TRANS_QTY, TRANS_PRICE," + NewLine;
                sSql += "                       IN_QTY, IN_PRICE," + NewLine;
                sSql += "                       OUT_QTY, OUT_PRICE," + NewLine;
                sSql += "                       STOCK_QTY, STOCK_PRICE)" + NewLine;
                sSql += "SELECT TOP 1 " + NewLine;
                sSql += "       CUST_CODE, PRODUCT_CODE, '" + _inDate + "'," + NewLine;
                sSql += "       STOCK_QTY, STOCK_PRICE," + NewLine;
                sSql += "     " + _inQty + ", " + _inPrice + "," + NewLine;
                sSql += "       0, 0," + NewLine;
                sSql += "       STOCK_QTY + " + _inQty + ", STOCK_PRICE + " + _inPrice + NewLine;
                sSql += "  FROM " + ls_Stock_Tbl + NewLine;
                sSql += " WHERE CUST_CODE = '" + _pCustCode + "'" + NewLine;
                sSql += "   AND PRODUCT_CODE = '" + _productCode + "'" + NewLine;
                sSql += "   AND STOCK_DATE < '" + _inDate + "'" + NewLine;
                sSql += " ORDER BY STOCK_DATE DESC";
                await db.SqlExecute(sSql);
            }
        }
        else if (rs[0]["DATE_CNT"].toString() != "0" && rs[0]["DATE_HIGH_CNT"].toString() != "0") {
            //Correction of the date
            sSql = "UPDATE " + ls_Stock_Tbl + NewLine;
            sSql += "   SET IN_QTY = IN_QTY + " + _inQty + "," + NewLine;
            sSql += "       IN_PRICE = IN_PRICE + " + _inPrice + "," + NewLine;
            sSql += "       STOCK_QTY = STOCK_QTY + " + _inQty + "," + NewLine;
            sSql += "       STOCK_PRICE = STOCK_PRICE + " + _inPrice + NewLine;
            sSql += " WHERE CUST_CODE = '" + _pCustCode + "'" + NewLine;
            sSql += "   AND PRODUCT_CODE = '" + _productCode + "'" + NewLine;
            sSql += "   AND STOCK_DATE = '" + _inDate + "'";
            await db.SqlExecute(sSql);
        }
        else if (rs[0]["DATE_CNT"].toString() != "0" && rs[0]["DATE_HIGH_CNT"].toString() != "0") {
            sSql = "SELECT STOCK_DATE FROM STOCK_TBL WITH(NOLOCK)" + NewLine;
            sSql += " WHERE CUST_CODE = '" + _pCustCode + "'" + NewLine;
            sSql += "   AND PRODUCT_CODE = '" + _productCode + "'" + NewLine;
            sSql += "   AND STOCK_DATE >= '" + _inDate + "'" + NewLine;
            sSql += " ORDER BY STOCK_DATE";
            rsLoop = await db.Sql2DataRecordset(sSql);

            for (i = 0; i < rsLoop.length; i++) {
                if (_inDate == rsLoop[i]["STOCK_DATE"].toString()) {
                    sSql = "UPDATE " + ls_Stock_Tbl + NewLine;
                    sSql += "   SET IN_QTY = IN_QTY + " + _inQty + "," + NewLine;
                    sSql += "       IN_PRICE = IN_PRICE + " + _inPrice + "," + NewLine;
                    sSql += "       STOCK_QTY = STOCK_QTY + " + _inQty + "," + NewLine;
                    sSql += "       STOCK_PRICE = STOCK_PRICE + " + _inPrice + NewLine;
                    sSql += " WHERE CUST_CODE = '" + _pCustCode + "'" + NewLine;
                    sSql += "   AND PRODUCT_CODE = '" + _productCode + "'" + NewLine;
                    sSql += "   AND STOCK_DATE = '" + rsLoop[i]["STOCK_DATE"].toString() + "'";
                    await db.SqlExecute(sSql);
                }
                else {
                    sSql = "UPDATE " + ls_Stock_Tbl + NewLine;
                    sSql += "   SET TRANS_QTY = TRANS_QTY + " + _inQty + "," + NewLine;
                    sSql += "       TRANS_PRICE = TRANS_PRICE + " + _inPrice + "," + NewLine;
                    sSql += "       STOCK_QTY = STOCK_QTY + " + _inQty + "," + NewLine;
                    sSql += "       STOCK_PRICE = STOCK_PRICE + " + _inPrice + NewLine;
                    sSql += " WHERE CUST_CODE = '" + _pCustCode + "'" + NewLine;
                    sSql += "   AND PRODUCT_CODE = '" + _productCode + "'" + NewLine;
                    sSql += "   AND STOCK_DATE = '" + rsLoop[i]["STOCK_DATE"].toString() + "'";
                    await db.SqlExecute(sSql);
                }
            }
        }
        else if (rs[0]["DATE_CNT"].toString() == "0" && rs[0]["DATE_HIGH_CNT"].toString() != "0") {
            sSql = "INSERT INTO " + ls_Stock_Tbl + " (CUST_CODE, PRODUCT_CODE, STOCK_DATE," + NewLine;
            sSql += "                       TRANS_QTY, TRANS_PRICE," + NewLine;
            sSql += "                       IN_QTY, IN_PRICE," + NewLine;
            sSql += "                       OUT_QTY, OUT_PRICE," + NewLine;
            sSql += "                       STOCK_QTY, STOCK_PRICE)" + NewLine;
            sSql += "SELECT TOP 1 " + NewLine;
            sSql += "       CUST_CODE, PRODUCT_CODE, '" + _inDate + "'," + NewLine;
            sSql += "       STOCK_QTY, STOCK_PRICE," + NewLine;
            sSql += "     " + _inQty + ", " + _inPrice + "," + NewLine;
            sSql += "       0, 0," + NewLine;
            sSql += "       STOCK_QTY + " + _inQty + ", STOCK_PRICE + " + _inPrice + NewLine;
            sSql += "  FROM " + ls_Stock_Tbl + NewLine;
            sSql += " WHERE CUST_CODE = '" + _pCustCode + "'" + NewLine;
            sSql += "   AND PRODUCT_CODE = '" + _productCode + "'" + NewLine;
            sSql += "   AND STOCK_DATE < '" + _inDate + "'" + NewLine;
            sSql += " ORDER BY STOCK_DATE DESC";
            await db.SqlExecute(sSql);

            sSql = "UPDATE " + ls_Stock_Tbl + NewLine;
            sSql += "   SET TRANS_QTY = TRANS_QTY + " + _inQty + "," + NewLine;
            sSql += "       TRANS_PRICE = TRANS_PRICE + " + _inPrice + "," + NewLine;
            sSql += "       STOCK_QTY = STOCK_QTY + " + _inQty + "," + NewLine;
            sSql += "       STOCK_PRICE = STOCK_PRICE + " + _inPrice + NewLine;
            sSql += " WHERE CUST_CODE = '" + _pCustCode + "'" + NewLine;
            sSql += "   AND PRODUCT_CODE = '" + _productCode + "'" + NewLine;
            sSql += "   AND STOCK_DATE > '" + _inDate + "'" + NewLine;
            await db.SqlExecute(sSql);
        }
        else if (rs[0]["DATE_CNT"].toString() != "0" && rs[0]["DATE_HIGH_CNT"].toString() == "0") {
            // Modify only that date
            sSql = "UPDATE " + ls_Stock_Tbl + NewLine;
            sSql += "   SET IN_QTY = IN_QTY + " + _inQty + "," + NewLine;
            sSql += "       IN_PRICE = IN_PRICE + " + _inPrice + "," + NewLine;
            sSql += "       STOCK_QTY = STOCK_QTY + " + _inQty + "," + NewLine;
            sSql += "       STOCK_PRICE = STOCK_PRICE + " + _inPrice + NewLine;
            sSql += " WHERE CUST_CODE = '" + _pCustCode + "'" + NewLine;
            sSql += "   AND PRODUCT_CODE = '" + _productCode + "'" + NewLine;
            sSql += "   AND STOCK_DATE = '" + _inDate + "'" + NewLine;
            await db.SqlExecute(sSql);
        }
        // Customer inventory processing
        await StockCustTbl_Upd(_pCustCode, _productCode);
    } catch (error) {
        throw error
    }
}
module.exports.StockTbl_IN = StockTbl_IN

async function PrdStockTbl_IN(_inNo, _seqNo, _productCode, _InCustCode, _OutCustCode, _qty, _cost, _price) {
    try {

        let sSql = "";

        if (_seqNo == 0) {
            sSql = "INSERT INTO PRD_STOCK_TBL (IN_NO, SEQ_NO, INOUT_SEQ, PRODUCT_CODE," + NewLine;
            sSql += "              INOUT_QTY, INOUT_COST," + NewLine;
            sSql += "              P_CUST_CODE, F_CUST_CODE, INOUT_DATE," + NewLine;
            sSql += "              DVR_NO, DVR_SEQ, END_YN)" + NewLine;
            sSql += "SELECT '" + _inNo + "', ISNULL(MAX(SEQ_NO),0) + 1, 0, '" + _productCode + "'," + NewLine;
            sSql += "       " + _qty + ", " + _cost + "," + NewLine;
            sSql += "       '" + _InCustCode + "','" + _OutCustCode + "', '" + Var.NowDate_yyyyMMdd() + "'," + NewLine;
            sSql += "       '', 0, 'N'" + NewLine;
            sSql += "  FROM PRD_STOCK_TBL WITH(NOLOCK)" + NewLine;
            sSql += " WHERE IN_NO = '" + _inNo + "'";
        }
        else {
            sSql = "INSERT INTO PRD_STOCK_TBL (IN_NO, SEQ_NO, INOUT_SEQ, PRODUCT_CODE," + NewLine;
            sSql += "              INOUT_QTY, INOUT_COST," + NewLine;
            sSql += "              P_CUST_CODE, F_CUST_CODE, INOUT_DATE," + NewLine;
            sSql += "              DVR_NO, DVR_SEQ, END_YN)" + NewLine;
            sSql += "VALUES ('" + _inNo + "', " + _seqNo + ", 0, '" + _productCode + "'," + NewLine;
            sSql += "        " + _qty + ", 0, " + _cost + "," + NewLine;
            sSql += "        '" + _InCustCode + "','" + _OutCustCode + "','" + Var.NowDate_yyyyMMdd() + "'," + NewLine;
            sSql += "        '', 0, 'N')";
        }
        await db.SqlExecute(sSql);
    } catch (error) {
        throw error
    }
}
module.exports.PrdStockTbl_IN = PrdStockTbl_IN

async function PrdStockTbl_Dvr(_inNo, _inNoSeqNo, _dvrNo, _dvrNoSeqNo, _productCode, _pCustCode, _fCustCode, _qty, _cost) {
    try {

        let sSql = ""

        sSql = "INSERT INTO PRD_STOCK_TBL (IN_NO, SEQ_NO, INOUT_SEQ, PRODUCT_CODE," + NewLine;
        sSql += "              INOUT_QTY, INOUT_COST," + NewLine;
        sSql += "              P_CUST_CODE, F_CUST_CODE, INOUT_DATE," + NewLine;
        sSql += "              DVR_NO, DVR_SEQ, END_YN)" + NewLine;
        sSql += "       SELECT '" + _inNo + "', " + _inNoSeqNo + ", ISNULL(MAX(INOUT_SEQ),0) + 1, '" + _productCode + "'," + NewLine;
        sSql += "              " + _qty + ", " + _cost + "," + NewLine;
        sSql += "             '" + _pCustCode + "', '" + _fCustCode + "', '" + Var.NowDate_yyyyMMdd() + "'," + NewLine;
        sSql += "             '" + _dvrNo + "', " + _dvrNoSeqNo + ", 'N'" + NewLine;
        sSql += "         FROM PRD_STOCK_TBL WITH(NOLOCK)" + NewLine;
        sSql += "        WHERE IN_NO = '" + _inNo + "' AND SEQ_NO = " + _inNoSeqNo;
        await db.SqlExecute(sSql);

        sSql = "SELECT" + NewLine;
        sSql += "(SELECT INOUT_QTY FROM PRD_STOCK_TBL WITH(NOLOCK)" + NewLine;
        sSql += "  WHERE IN_NO = '" + _inNo + "' AND SEQ_NO = " + _inNoSeqNo + " AND PRODUCT_CODE = '" + _productCode + "' AND INOUT_SEQ = 0) AS IN_QTY," + NewLine;
        sSql += "(SELECT SUM(INOUT_QTY) FROM PRD_STOCK_TBL WITH(NOLOCK)" + NewLine;
        sSql += "  WHERE IN_NO = '" + _inNo + "' AND SEQ_NO = " + _inNoSeqNo + " AND PRODUCT_CODE = '" + _productCode + "' AND INOUT_SEQ > 0) AS OUT_QTY" + NewLine;

        let rs = await db.Sql2DataRecordset(sSql);

        if (Number(rs[0]["IN_QTY"]) <= Number(rs[0]["OUT_QTY"])) {
            sSql = "UPDATE PRD_STOCK_TBL SET END_YN = 'Y'" + NewLine;
            sSql += "WHERE IN_NO = '" + _inNo + "' AND SEQ_NO = " + _inNoSeqNo;

            await db.SqlExecute(sSql);
        }
    } catch (error) {
        throw error
    }
}

async function InHTbl_INS_And_InNo(_payCode, _pCustCode, _fCustCode, _inHnote, _empNo = "") {
    try {

        let sSql = "";
        let ls_InNo = "";

        sSql = "SELECT ISNULL(MAX(IN_NO),'') IN_NO FROM IN_H_TBL WHERE IN_NO LIKE '" + _pCustCode + Var.NowDate_yyMMdd() + "%'";
        let rs = await db.Sql2DataRecordset(sSql);
        if (String(rs[0]["IN_NO"]).trim() == "") {
            ls_InNo = _pCustCode + Var.NowDate_yyMMdd() + "0001";
        }
        else {
            ls_InNo = _pCustCode + Var.NowDate_yyMMdd() + String(parseInt(String(rs[0]["IN_NO"]).slice(-4)) + 1).padStart(4, 0);
        }
        sSql = "INSERT INTO IN_H_TBL (IN_NO, IN_DATE, IN_TIME, PAY_CODE, EMP_NO," + NewLine;
        sSql += "                     P_CUST_CODE, F_CUST_CODE)" + NewLine;
        sSql += " VALUES ('" + ls_InNo + "', '" + Var.NowDate_yyyyMMdd() + "', '" + Var.NowDate_HHmm() + "', '" + _payCode + "', '" + _empNo + "'," + NewLine;
        sSql += "         '" + _pCustCode + "', '" + _fCustCode + "')";
        await db.SqlExecute(sSql);

        sSql = "INSERT INTO IN_H_REMARK_TBL (IN_NO, REMARK) VALUES ('" + ls_InNo + "', '" + String(_inHnote).replace("'", "''") + "')";
        await db.SqlExecute(sSql);

        return ls_InNo;
    } catch (error) {
        throw error
    }
}
module.exports.InHTbl_INS_And_InNo = InHTbl_INS_And_InNo
async function DeliveryHTbl_INS_Ret_DvrNo(_payCode, _pCustCode, _fCustCode, _dvrHremark, _empNo, _recEmpNo = "") {
    try {

        let sSql = "";
        let ls_DvrNo = "";

        sSql = "SELECT ISNULL(MAX(DVR_NO),'') DVR_NO FROM DELIVERY_H_TBL WHERE DVR_NO LIKE '" + _pCustCode + Var.NowDate_yyMMdd() + "%'";
        let rs = await db.Sql2DataRecordset(sSql);
        if (String(rs[0]["DVR_NO"]).trim() == "") {
            ls_DvrNo = _pCustCode + Var.NowDate_yyMMdd() + "0001";
        }
        else {
            ls_DvrNo = _pCustCode + Var.NowDate_yyMMdd() + String(parseInt(String(rs[0]["DVR_NO"]).slice(-4)) + 1).padStart(4, 0);
        }

        sSql = "INSERT INTO DELIVERY_H_TBL (DVR_NO, DVR_DATE, DVR_TIME, PAY_CODE, EMP_NO," + NewLine;
        sSql += "                           P_CUST_CODE, F_CUST_CODE, REC_EMP_NO)" + NewLine;
        sSql += "VALUES ('" + ls_DvrNo + "', '" + Var.NowDate_yyyyMMdd() + "', '" + Var.NowDate_HHmm() + "', '" + _payCode + "', '" + _empNo + "'," + NewLine;
        sSql += "        '" + _pCustCode + "', '" + _fCustCode + "', '" + _recEmpNo + "')";
        await db.SqlExecute(sSql);

        sSql = "INSERT INTO DELIVERY_H_REMARK_TBL (DVR_NO, REMARK) VALUES ('" + ls_DvrNo + "', N'" + String(_dvrHremark).replace("'", "''") + "')";
        await db.SqlExecute(sSql);

        return ls_DvrNo;
    } catch (error) {
        throw error
    }
}
module.exports.DeliveryHTbl_INS_Ret_DvrNo = DeliveryHTbl_INS_Ret_DvrNo

async function DeliveryDTbl_SeqNo_INS(_dvrNo, _seqNo, _productCode, _dvrQty, _dvrCost, _dvrPrice, _dvrDremark) {
    try {

        let sSql = "";

        sSql = "INSERT INTO DELIVERY_D_TBL (DVR_NO, SEQ_NO, PRODUCT_CODE, DVR_QTY, DVR_COST," + NewLine;
        sSql += "                           DVR_PRICE, DVR_D_REMARK)" + NewLine;
        sSql += "VALUES ('" + _dvrNo + "', " + _seqNo + ", '" + _productCode + "', " + _dvrQty + ", " + _dvrCost + "," + NewLine;
        sSql += "        " + _dvrPrice + ", '" + _dvrDremark + "')";
        await db.SqlExecute(sSql);
    } catch (error) {
        throw error
    }
}
module.exports.DeliveryDTbl_SeqNo_INS = DeliveryDTbl_SeqNo_INS

async function InDTbl_SeqNo_INS(_inNo, _seqNo, _productCode, _inQty, _inCost, _inPrice, _inHnote, _productCost) {
    try {

        let sSql = "";
        sSql = "INSERT INTO IN_D_TBL (IN_NO, SEQ_NO, PRODUCT_CODE, IN_QTY, IN_COST," + NewLine;
        sSql += "                     IN_PRICE, IN_D_REMARK, PRODUCT_COST)" + NewLine;
        sSql += "VALUES ('" + _inNo + "', " + _seqNo + ", '" + _productCode + "', " + _inQty + ", " + _inCost + "," + NewLine;
        sSql += "        " + _inPrice + ", N'" + _inHnote + "', " + _productCost + ")";
        await db.SqlExecute(sSql);
    } catch (error) {
        error
    }
}
module.exports.InDTbl_SeqNo_INS = InDTbl_SeqNo_INS

async function FabricOut_PROC(_custCode, _inNo, _dvrQty, _remark, _empNo) {
    try {

        let sSql = "";
        let lf_StockQty = 0;

        sSql = "SELECT STOCK_QTY FROM FABRIC_STOCK_TBL WITH(NOLOCK) WHERE CUST_CODE = '" + _custCode + "' AND IN_NO = '" + _inNo + "'";
        let rs = await db.Sql2DataRecordset(sSql);

        if (rs.length == 0) lf_StockQty = 0;
        else lf_StockQty = parseInt(rs[0]["STOCK_QTY"].toString());

        if (_dvrQty >= lf_StockQty) {
            // Inventory deletion
            sSql = "DELETE FROM FABRIC_STOCK_TBL WHERE CUST_CODE = '" + _custCode + "' AND IN_NO = '" + _inNo + "'" + NewLine;
        }
        else {
            // Inventory modification
            sSql = "UPDATE FABRIC_STOCK_TBL SET STOCK_QTY = " + (lf_StockQty - _dvrQty) + " WHERE CUST_CODE = '" + _custCode + "'  AND IN_NO = '" + _inNo + "'" + NewLine;
        }

        // Incoming/Delivery History
        sSql += "INSERT INTO FABRIC_INOUT_TBL (IN_NO, SEQ_NO, INOUT_DIV, INOUT_QTY, REG_DATE, REG_TIME, EMP_NO, REMARK)" + NewLine;
        sSql += "SELECT '" + _inNo + "', ISNULL(MAX(SEQ_NO), 0) + 1, '2', " + _dvrQty + ", '" + Var.NowDate_yyyyMMdd() + "', '" + Var.NowDate_HHmm() + "', '" + _empNo + "', '" + _remark + "'" + NewLine;
        sSql += "  FROM FABRIC_INOUT_TBL WITH(NOLOCK)" + NewLine;
        sSql += " WHERE IN_NO = '" + _inNo + "'";
        await db.SqlExecute(sSql);
    } catch (error) {
        throw error
    }
}
module.exports.FabricOut_PROC = FabricOut_PROC

async function FabricInTbl_INS(_custCode, _productCode, _inQty, _remark, _impLotNo, _dvrLotNo, _empNo) {
    try {

        let sSql = "";
        let ls_InNo = Var.NowDate_yyyyMMdd();

        let rs;

        sSql = "SELECT ISNULL(MAX(IN_NO),'') IN_NO FROM FABRIC_IN_TBL WITH(NOLOCK) WHERE IN_NO LIKE '" + ls_InNo + "%'";
        rs = await db.Sql2DataRecordset(sSql);

        if (rs[0]["IN_NO"].toString().Trim() == "") {
            ls_InNo += "0001";
        }
        else {
            ls_InNo = ls_InNo + String(parseInt(String(rs[0]["IN_NO"]).slice(-4)) + 1).padStart(4, 0);
        }

        // Receipt registration
        sSql = "INSERT INTO FABRIC_IN_TBL (IN_NO, PRODUCT_CODE, IN_QTY, IN_DATE, IN_TIME, EMP_NO, REMARK, IMP_LOT_NO, DVR_LOT_NO)" + NewLine;
        sSql += "VALUES ('" + ls_InNo + "', '" + _productCode + "', " + _inQty + ", '" + Var.NowDate_yyyyMMdd() + "', '" + Var.NowDate_HHmm() + "', '" + _empNo + "', '" + _remark + "', '" + _impLotNo + "', '" + _dvrLotNo + "')" + NewLine;
        await db.SqlExecute(sSql);

        // Incoming/Delivery History
        sSql = "INSERT INTO FABRIC_INOUT_TBL (IN_NO, SEQ_NO, INOUT_DIV, INOUT_QTY, REG_DATE, REG_TIME, EMP_NO, REMARK)" + NewLine;
        sSql += "VALUES ('" + ls_InNo + "', 1, '1', " + _inQty + ", '" + Var.NowDate_yyyyMMdd() + "', '" + Var.NowDate_HHmm() + "', '" + _empNo + "', '" + _remark + "')" + NewLine;
        await db.SqlExecute(sSql);

        // Inventory registration
        sSql = "INSERT INTO FABRIC_STOCK_TBL (CUST_CODE, IN_NO, STOCK_QTY) VALUES ('" + _custCode + "', '" + ls_InNo + "', " + _inQty + ")";
        await db.SqlExecute(sSql);

        return ls_InNo;
    } catch (error) {
        throw error
    }
}
module.exports.FabricInTbl_INS = FabricInTbl_INS

async function getWorkshopTempCustCode() {
    try {
        let sSql = "SELECT B.CUST_CODE, B.CUST_NAME FROM PMS_COMMON_CUST_D_TBL A WITH(NOLOCK) LEFT JOIN CUSTOMER_TBL B WITH(NOLOCK) ON A.CUST_CODE = B.CUST_CODE WHERE A.H_CODE = 37"
        let rs = await db.Sql2DataRecordset(sSql)
        return rs[0]["CUST_CODE"]
    } catch (error) {
        throw error
    }
}
module.exports.getWorkshopTempCustCode = getWorkshopTempCustCode

async function getWorkshopCustCode() {
    try {
        let sSql = "SELECT B.CUST_CODE, B.CUST_NAME FROM PMS_COMMON_CUST_D_TBL A WITH(NOLOCK) LEFT JOIN CUSTOMER_TBL B WITH(NOLOCK) ON A.CUST_CODE = B.CUST_CODE WHERE A.H_CODE = 2"
        let rs = await db.Sql2DataRecordset(sSql)
        return rs[0]["CUST_CODE"]
    } catch (error) {
        throw error
    }
}
module.exports.getWorkshopCustCode = getWorkshopCustCode

async function FabricMove_PROC(_fromCustCode, _toCustCode, _productCode, _qty, _inNo, _remark, _empNo) {
    try {

        let sSql = "";

        //OUT - Must All Move
        sSql = "DELETE FROM FABRIC_STOCK_TBL WHERE CUST_CODE = '" + _fromCustCode + "' AND IN_NO = '" + _inNo + "'" + NewLine;
        sSql += "INSERT INTO FABRIC_STOCK_TBL (CUST_CODE, IN_NO, STOCK_QTY) VALUES ('" + _toCustCode + "', '" + _inNo + "', " + _qty + ")";
        //OUT TO WORKSHOP[TEMP]
        sSql += "INSERT INTO FABRIC_INOUT_TBL (IN_NO, SEQ_NO, INOUT_DIV, INOUT_QTY, REG_DATE, REG_TIME, EMP_NO, REMARK)" + NewLine;
        sSql += "SELECT '" + _inNo + "', ISNULL(MAX(SEQ_NO), 0) + 1, '2', " + _qty + ", '" + Var.NowDate_yyyyMMdd() + "', '" + Var.NowDate_HHmm() + "', '" + _empNo + "', '" + _remark + "'" + NewLine;
        sSql += "  FROM FABRIC_INOUT_TBL WITH(NOLOCK)" + NewLine;
        sSql += " WHERE IN_NO = '" + _inNo + "'";
        //IN TO WORKSHOP[TEMP]
        sSql += "INSERT INTO FABRIC_INOUT_TBL (IN_NO, SEQ_NO, INOUT_DIV, INOUT_QTY, REG_DATE, REG_TIME, EMP_NO, REMARK)" + NewLine;
        sSql += "SELECT '" + _inNo + "', ISNULL(MAX(SEQ_NO), 0) + 1, '1', " + _qty + ", '" + Var.NowDate_yyyyMMdd() + "', '" + Var.NowDate_HHmm() + "', '" + _empNo + "', '" + _remark + "'" + NewLine;
        sSql += "  FROM FABRIC_INOUT_TBL WITH(NOLOCK)" + NewLine;
        sSql += " WHERE IN_NO = '" + _inNo + "'";

        await db.SqlExecute(sSql);
    } catch (error) {
        throw error
    }
}
module.exports.FabricMove_PROC = FabricMove_PROC