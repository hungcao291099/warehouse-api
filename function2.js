let mssql;
function settingDb(mssqlConnect) {
    mssql = mssqlConnect;
}
module.exports.settingDb = settingDb;
var NewLine = "\r\n"
var DBFun = require("./DBFun.js");
var db = require("./DBProc.js");
var Var = require("./Var.js");
async function updateFabricLocation(req, res) {
    const ls_fromCustCode = decodeURIComponent(req.body.FROM_CUST) || "";
    const ls_toCustCode = decodeURIComponent(req.body.TO_CUST) || "";
    const ls_empNo = decodeURIComponent(req.body.EMP_NO) || "";
    const ls_productCode = decodeURIComponent(req.body.PRODUCT_CODE) || "";
    const li_Qty = decodeURIComponent(req.body.PRODUCT_QTY) || "";
    const ls_fabricNo = decodeURIComponent(req.body.FABRIC_NO) || "";
    const ls_fabricRemark = decodeURIComponent(req.body.REMARK) || "";
    const ls_InoutCode_Dvr = "20" // Move OUT
    const ls_InoutCode_In = "10" // Move IN
    const ls_dvrRemark = "Location Update"
    const ls_inHNote = ls_dvrRemark + "/Auto In Reg after Out Reg"

    try {
        const lf_productCost = await DBFun.productCode2productCost(ls_productCode)
        const ls_inNo = await DBFun.InHTbl_INS_And_InNo(ls_InoutCode_In, ls_toCustCode, ls_fromCustCode, ls_inHNote)
        const ls_deliveryNo = await DBFun.DeliveryHTbl_INS_Ret_DvrNo(ls_InoutCode_Dvr, ls_fromCustCode, ls_toCustCode, ls_dvrRemark, ls_empNo)

        await DBFun.DeliveryDTbl_SeqNo_INS(ls_deliveryNo, 1, ls_productCode, li_Qty, 0, 0, "")
        await DBFun.InDTbl_SeqNo_INS(ls_inNo, 1, ls_productCode, li_Qty, 0, 0, "", lf_productCost)
        await DBFun.GP_Stock_Move(ls_deliveryNo, 1, ls_inNo, ls_fromCustCode, ls_toCustCode, Var.NowDate_yyyyMMdd, ls_productCode, li_Qty)
        await DBFun.FabricMove_PROC(ls_fromCustCode, ls_toCustCode, ls_productCode, li_Qty, ls_fabricNo, ls_fabricRemark, ls_empNo)
        return res.json({ success: true, message: "SUCCESS" });
    } catch (error) {
        console.error(`Error executing query: `, error);
        res.status(500).json({ success: false, message: "An error occurred while processing the request ", error: error.message });

    }

}
module.exports.updateFabricLocation = updateFabricLocation

async function getFabricNo(req, res) {
    let sSql = ""
    const ls_productCode = decodeURIComponent(req.query.PRODUCT_CODE) || "";
    const li_qty = decodeURIComponent(req.query.PRODUCT_QTY) || "";
    if (ls_productCode.length == 0) {

        return res.json({ success: false, message: "PRODUCT_CODE must not be empty" });
    }
    try {
        sSql += "SELECT C.CUST_NAME,A.IN_NO,A.STOCK_QTY "
        sSql += "  FROM FABRIC_STOCK_TBL A LEFT JOIN FABRIC_IN_TBL B ON A.IN_NO = B.IN_NO "
        sSql += "                          LEFT JOIN CUSTOMER_TBL C ON C.CUST_CODE = A.CUST_CODE "
        sSql += " WHERE B.PRODUCT_CODE='" + ls_productCode + "'"
        sSql += "   AND A.STOCK_QTY LIKE '" + li_qty + "%'"
        let rs = await db.Sql2DataRecordset(sSql)
        let data = []
        if (rs.length == 0) return res.json({ success: true, message: "empty Data", data });
        for (const row of rs) {
            let js = {}
            js.CUST_NAME = row["CUST_NAME"]
            js.IN_NO = row["IN_NO"]
            js.STOCK_QTY = row["STOCK_QTY"]
            data.push(js)
        }
        res.json({ success: true, message: "SUCCESS", totalCount: rs.length, data });
    } catch (error) {
        // console.log(error);
        throw error

    }
}
module.exports.getFabricNo = getFabricNo


async function getCurrentFabricLocation(req, res) {
    let sSql = ""
    const ls_fabricNo = decodeURIComponent(req.query.FABRIC_NO) || "";
    if (ls_fabricNo.length == 0) {

        return res.json({ success: false, message: "FABRIC_NO must not be empty" });
    }
    sSql += "SELECT B.CUST_LGR_CODE, B.CUST_MID_CODE, B.CUST_SML_CODE, B.CUST_CODE, " + NewLine
    sSql += "       C.CUST_LGR_NAME, D.CUST_MID_NAME, E.CUST_SML_NAME, B.CUST_NAME " + NewLine
    sSql += "  FROM FABRIC_STOCK_TBL A LEFT JOIN CUSTOMER_TBL B ON A.CUST_CODE = B.CUST_CODE" + NewLine
    sSql += "                          LEFT JOIN CUST_LGR_TBL C ON B.CUST_LGR_CODE = C.CUST_LGR_CODE" + NewLine
    sSql += "                          LEFT JOIN CUST_MID_TBL D ON B.CUST_MID_CODE = D.CUST_MID_CODE AND D.CUST_LGR_CODE = B.CUST_LGR_CODE" + NewLine
    sSql += "                          LEFT JOIN CUST_SML_TBL E ON B.CUST_SML_CODE = E.CUST_SML_CODE AND E.CUST_MID_CODE = D.CUST_MID_CODE AND E.CUST_LGR_CODE = B.CUST_LGR_CODE" + NewLine
    sSql += " WHERE A.IN_NO = '" + ls_fabricNo + "'" + NewLine
    let rs = await db.Sql2DataRecordset(sSql)
    if (rs.length == 0) {
        return res.json({ success: false, message: "Can not find location of this fabric roll" });
    }
    res.json({ success: true, message: "SUCCESS", data: dr[0] });
}
module.exports.getCurrentFabricLocation = getCurrentFabricLocation

async function ProductionMove(req, res) {
    const ls_fromCustCode = decodeURIComponent(req.body.FROM_CUST) || "";
    const ls_toCustCode = decodeURIComponent(req.body.TO_CUST) || "";
    const ls_empNo = decodeURIComponent(req.body.EMP_NO) || "";
    const ls_productCode = decodeURIComponent(req.body.PRODUCT_CODE) || "";
    const li_Qty = decodeURIComponent(req.body.PRODUCT_QTY) || "";
    const ls_InoutCode_In = "10" // Move IN
    const ls_InoutCode_Dvr = "20" // Move OUT
    const ls_dvrRemark = "Location Update"
    const ls_inHNote = ls_dvrRemark + "/Auto In Reg after Out Reg"
    try {
        const lf_productCost = await DBFun.productCode2productCost(ls_productCode)
        const ls_inNo = await DBFun.InHTbl_INS_And_InNo(ls_InoutCode_In, ls_toCustCode, ls_fromCustCode, ls_inHNote)
        const ls_deliveryNo = await DBFun.DeliveryHTbl_INS_Ret_DvrNo(ls_InoutCode_Dvr, ls_fromCustCode, ls_toCustCode, ls_dvrRemark, ls_empNo)

        await DBFun.DeliveryDTbl_SeqNo_INS(ls_deliveryNo, 1, ls_productCode, li_Qty, 0, 0, "")
        await DBFun.InDTbl_SeqNo_INS(ls_inNo, 1, ls_productCode, li_Qty, 0, 0, "", lf_productCost)
        await DBFun.GP_Stock_Move(ls_deliveryNo, 1, ls_inNo, ls_fromCustCode, ls_toCustCode, Var.NowDate_yyyyMMdd, ls_productCode, li_Qty)

        return res.json({ success: true, message: "SUCCESS" });
    } catch (error) {
        // console.log(error);
        console.error(`Error executing query: `, error);
        res.status(500).json({ success: false, message: "An error occurred while processing the request ", error: error.message });

    }
}
module.exports.ProductionMove = ProductionMove

async function getProductStockInfo(req, res) {
    let sSql = ""
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

    sSql += "SELECT A.CUST_CODE, B.CUST_NAME, A.PRODUCT_CODE, A.STOCK_QTY, D.PRD_NAME, D.BARCODE, D.PRODUCT_COST, E.LGR_NAME, F.MID_NAME, G.DGN_NAME, H.COLOR_NAME " + NewLine
    sSql += "  FROM STOCK_CUST_TBL A LEFT JOIN CUSTOMER_TBL B ON A.CUST_CODE = B.CUST_CODE" + NewLine
    sSql += "                        LEFT JOIN PMS_COMMON_CUST_D_TBL C ON A.CUST_CODE = C.CUST_CODE" + NewLine
    sSql += "                        LEFT JOIN PRODUCT_TBL D ON D.PRODUCT_CODE = A.PRODUCT_CODE" + NewLine
    sSql += "                        LEFT JOIN LGR_TBL E ON E.LGR_CODE = D.LGR_CODE" + NewLine
    sSql += "                        LEFT JOIN MID_TBL F ON F.MID_CODE = D.MID_CODE AND F.LGR_CODE = D.LGR_CODE" + NewLine
    sSql += "                        LEFT JOIN DESIGN_TBL G ON G.DGN_CODE = D.DGN_CODE" + NewLine
    sSql += "                        LEFT JOIN COLOR_TBL H ON H.COLOR_CODE = D.COLOR_CODE" + NewLine
    sSql += " WHERE " + ls_tempCondition + " ='" + ls_productCode + "' " + NewLine
    sSql += "   AND (C.H_CODE='" + li_HCode + "' OR B.CUST_LGR_CODE ='5')" + NewLine
    let rs = await db.Sql2DataRecordset(sSql)
    if (rs.length == 0) {
        return res.json({ success: false, message: "Just only finished product in stock" });
    }
    let data = []
    for (const row of rs) {
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
    let sSql = ""
    const ls_prdName = decodeURIComponent(req.query.PRODUCT_NAME) || "";
    var ls_tempCondition = ""
    const li_HCode = 23 //Product Stock
    if (ls_prdName == "") ls_tempCondition = `1=1`
    else ls_tempCondition = `B.PRD_NAME LIKE '%${ls_prdName}%'`
    sSql += "SELECT A.PRODUCT_CODE, B.PRD_NAME " + NewLine
    sSql += "  FROM STOCK_CUST_TBL A LEFT JOIN PRODUCT_TBL B ON A.PRODUCT_CODE = B.PRODUCT_CODE" + NewLine
    sSql += "                        LEFT JOIN PMS_COMMON_CUST_D_TBL E ON A.CUST_CODE = E.CUST_CODE" + NewLine
    sSql += "                        LEFT JOIN CUSTOMER_TBL C ON A.CUST_CODE = C.CUST_CODE" + NewLine
    sSql += " WHERE " + ls_tempCondition + NewLine
    sSql += "   AND (E.H_CODE='" + li_HCode + "' OR C.CUST_LGR_CODE ='5')" + NewLine
    sSql += " GROUP BY A.PRODUCT_CODE, B.PRD_NAME" + NewLine
    let rs = await db.Sql2DataRecordset(sSql)
    if (rs.length == 0) {
        return res.json({ success: false, message: "Can not find any product with that name" });
    }
    let data = []
    for (const row of rs) {
        let js = {}
        js.PRODUCT_CODE = row["PRODUCT_CODE"]
        js.PRD_NAME = row["PRD_NAME"]
        data.push(js)
    }
    res.json({ success: true, message: "SUCCESS", data });

}
module.exports.findProductByName = findProductByName

async function getWorkOrdList(req, res) {
    let sSql = ""
    const ls_DateFrom = decodeURIComponent(req.query.DATE_FROM) || "";
    const ls_DateTo = decodeURIComponent(req.query.DATE_TO) || "";
    const ls_WorkOrdNo = decodeURIComponent(req.query.WORK_ORD_NO) || "";
    let data = []
    sSql = "SELECT A.WORK_ORD_NO, B.PRD_NAME" + NewLine
    sSql += "  FROM WORK_ORD_TBL A LEFT JOIN PRODUCT_TBL B ON A.PRODUCT_CODE = B.PRODUCT_CODE" + NewLine
    sSql += " WHERE A.REG_DATE BETWEEN '" + ls_DateFrom + "' AND '" + ls_DateTo + "'" + NewLine

    if (ls_WorkOrdNo != "") sSql += "  AND A.WORK_ORD_NO = '" + ls_WorkOrdNo + "'"
    let rs = await db.Sql2DataRecordset(sSql)
    for (const row of rs) {
        let js = {}
        js.WorkOrdNo = row['WORK_ORD_NO']
        js.ProductName = row['PRD_NAME']
        data.push(js)
    }
    res.json({ success: true, message: "SUCCESS", data });

}
module.exports.getWorkOrdList = getWorkOrdList



async function getWorkOrdBOMMove(req, res) {
    let sSql = ""
    const ls_workShopTempCustCode = await DBFun.getWorkshopTempCustCode()
    const ls_DateFrom = decodeURIComponent(req.query.DATE_FROM) || "";
    const ls_DateTo = decodeURIComponent(req.query.DATE_TO) || "";
    const ls_WorkOrdNo = decodeURIComponent(req.query.WORK_ORD_NO) || "";

    sSql = "SELECT A.WORK_ORD_NO, A.PRODUCT_CODE, A.SEQ_NO, A.FABRIC_NO, A.TEMP_MOVE_DATE, A.IN_QTY, B.PRD_NAME " + NewLine
    sSql += "  FROM WORK_ORD_BOM_MOVE_TBL A LEFT JOIN PRODUCT_TBL B ON A.PRODUCT_CODE = B.PRODUCT_CODE" + NewLine
    sSql += " WHERE A.CUT_INOUT_SEQ = 0" + NewLine
    sSql += "   AND A.TEMP_MOVE_DATE BETWEEN '" + ls_DateFrom + "' AND '" + ls_DateTo + "'" + NewLine
    if (ls_WorkOrdNo != "") sSql += "AND A.WORK_ORD_NO = '" + ls_WorkOrdNo + "'"
    sSql += " ORDER BY A.WORK_ORD_NO"
    let rs = await db.Sql2DataRecordset(sSql)
    let data = []
    for (const row of rs) {
        let js = {}
        js.WORK_ORD_NO = row['WORK_ORD_NO']
        js.SEQ_NO = row['SEQ_NO']
        js.FABRIC_NO = row['FABRIC_NO']
        js.PRD_NAME = row['PRD_NAME']
        js.PRODUCT_CODE = row['PRODUCT_CODE']
        js.TEMP_MOVE_DATE = row['TEMP_MOVE_DATE']
        js.IN_QTY = row['IN_QTY']
        data.push(js)
    }
    res.json({ success: true, message: "SUCCESS", data });
}
module.exports.getWorkOrdBOMMove = getWorkOrdBOMMove

async function move2Workshop(req, res) {
    const ls_empNo = decodeURIComponent(req.body.EMP_NO) || "";
    const ITEMS = JSON.parse(req.body.ITEM) || "";
    const ls_InoutCode_In = "10"
    const ls_InoutCode_Dvr = "20"
    const ls_workOrdNo = ITEMS[0].WORK_ORD_NO
    let ls_workShopCustCode = await DBFun.getWorkshopCustCode()
    let ls_workShopTempCustCode = await DBFun.getWorkshopTempCustCode()
    let ls_Move_InNo = await DBFun.InHTbl_INS_And_InNo(ls_InoutCode_In, ls_workShopCustCode, ls_workShopTempCustCode, `W/O No: ${ls_workOrdNo} Output Warehouse From Order`, ls_empNo)
    let ls_Move_DvrNo = await DBFun.DeliveryHTbl_INS_Ret_DvrNo(ls_InoutCode_Dvr, ls_workShopTempCustCode, ls_workShopCustCode, `W/O No: ${ls_workOrdNo} Output Warehouse From Order`, ls_empNo)
    let li_InOut_SeqNo = 1
    try {
        for (let item of ITEMS) {
            const ls_fabricNo = item.FABRIC_NO
            const ls_productCode = item.PRODUCT_CODE
            const lf_productQty = item.IN_QTY
            const li_SeqNo = item.SEQ_NO
            const lf_productCost = await DBFun.productCode2productCost(ls_productCode)

            li_InOut_SeqNo++

            await DBFun.DeliveryDTbl_SeqNo_INS(ls_Move_DvrNo, li_InOut_SeqNo, ls_productCode, lf_productQty, 0, 0, "")
            await DBFun.InDTbl_SeqNo_INS(ls_Move_InNo, li_InOut_SeqNo, ls_productCode, lf_productQty, 0, 0, "", lf_productCost)
            await DBFun.GP_Stock_Move(ls_Move_DvrNo, li_InOut_SeqNo, ls_Move_InNo, ls_workShopTempCustCode, ls_workShopCustCode, Var.NowDate_yyyyMMdd(), ls_productCode, lf_productQty)
            await DBFun.FabricOut_PROC(ls_workShopTempCustCode, ls_fabricNo, lf_productQty, `W/O No:${ls_workOrdNo} Workshop[temp] -> Workshop[product]`, ls_empNo)
            let li_CutInOutSeq = await insertCutInOutTable(ls_workOrdNo, ls_fabricNo, ls_productCode, lf_productQty, ls_empNo, ls_Move_DvrNo, ls_Move_InNo)
            await updateWorkOrdBOMMoveTbl(ls_workOrdNo, li_SeqNo, li_CutInOutSeq)
        }
        res.json({ success: true, message: "SUCCESS" });
    }
    catch (error) {
        console.error(`Error executing query: `, error);
        res.status(500).json({ success: false, message: "An error occurred while processing the request ", error: error.message });
    }
}
module.exports.move2Workshop = move2Workshop


async function insertCutInOutTable(_workOrdNo, _fabricNo, _productCode, _outQty, _empNo, _moveDvrNo, _moveInNo) {
    let sSql = "";
    let li_cutInOutSeq = await createCutInOutSeq(_workOrdNo)
    try {
        sSql = "INSERT INTO CUT_INOUT_H_TBL (WORK_ORD_NO, SEQ_NO, PRODUCT_CODE, OUT_QTY, RET_QTY," + NewLine
        sSql += "                             REG_EMP_NO, REG_DATE, REG_TIME, IN_DVR_NO, IN_IN_NO," + NewLine
        sSql += "                             RET_DVR_NO, RET_IN_NO, REMARK)" + NewLine
        sSql += "VALUES ('" + _workOrdNo + "'," + li_cutInOutSeq + ",'" + _productCode + "'," + _outQty + ",0," + NewLine
        sSql += "'" + _empNo + "','" + Var.NowDate_yyyyMMdd() + "','" + Var.NowDate_HHmm() + "','" + _moveDvrNo + "','" + _moveInNo + "'," + NewLine
        sSql += "'','','Output Warehouse From Order');" + NewLine

        sSql += "INSERT INTO CUT_INOUT_D_TBL (WORK_ORD_NO, SEQ_NO, FABRIC_IN_NO, IN_QTY, RET_QTY)" + NewLine
        sSql += "VALUES ('" + _workOrdNo + "'," + li_cutInOutSeq + ",'" + _fabricNo + "'," + _outQty + ", 0)" + NewLine
        await db.SqlExecute(sSql)
        return li_cutInOutSeq
    } catch (error) {
        throw error
    }
}
async function updateWorkOrdBOMMoveTbl(_workOrdNo, _seqNo, _cutInOutSeq) {
    let sSql = "";
    try {
        sSql = "UPDATE WORK_ORD_BOM_MOVE_TBL SET WORKSHOP_MOVE_DATE = '" + Var.NowDate_yyyyMMdd() + "'," + NewLine
        sSql += "                                 CUT_INOUT_SEQ = " + _cutInOutSeq + NewLine
        sSql += " WHERE WORK_ORD_NO = '" + _workOrdNo + "'" + NewLine
        sSql += "   AND SEQ_NO = " + _seqNo + NewLine
        await db.SqlExecute(sSql)
    } catch (error) {
        throw error
    }
}

async function createCutInOutSeq(_workOrdNo) {
    let sSql = "";
    let li_cutInOutSeq = 0
    try {
        sSql = "SELECT ISNULL(MAX(SEQ_NO),0) + 1 SEQ_NO FROM CUT_INOUT_H_TBL WITH(NOLOCK) WHERE WORK_ORD_NO = '" + _workOrdNo + "'"
        let rs = await db.Sql2DataRecordset(sSql)
        li_cutInOutSeq = rs[0]["SEQ_NO"]
        return li_cutInOutSeq
    } catch (error) {
        throw error
    }
}

