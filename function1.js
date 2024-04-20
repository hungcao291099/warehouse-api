
let mssql;

function settingDb(mssqlConnect) {
    mssql = mssqlConnect;

}
module.exports.settingDb = settingDb;

async function empNo2Name(req, res) {
    try {
        const emp_no = decodeURIComponent(req.query.emp_no) || "";
        if (!emp_no) {
            res.status(400).json({ success: false, message: "emp_no must not be empty" });
            return; // Return early if emp_no is empty
        }
        const sqlQuery = `SELECT EMP_NAME FROM EMPLOYEE_TBL WHERE EMP_NO = '${emp_no}'`
        const result = await new mssql.Request().query(sqlQuery);
        const emp_nm = result.recordset[0];
        res.json({ success: true, message: "SUCCESS", data: emp_nm });
    } catch (err) {
        console.error("Error executing query:", err);
    }
}

module.exports.empNo2Name = empNo2Name;

async function login(req, res) {
    const emp_no = decodeURIComponent(req.body.emp_no) || "";
    const emp_pw = decodeURIComponent(req.body.emp_pw) || "";
    if (!emp_no || !emp_pw) {
        res.json({ success: false, message: "emp_no and emp_pw must not be empty" });
        return; // Return early if emp_no is empty
    }
    // Get SQL query from mybatis-mapper
    var sqlQuery = `SELECT PASS_WORD, COALESCE(PASS_SECU, 0) AS PASS_SECU FROM USR_TBL WHERE PASS_EMPL= '${emp_no}'`
    var result = await new mssql.Request().query(sqlQuery)
    var row = result.recordset[0]
    const password = row['PASS_WORD']
    const superUser = row['PASS_SECU']
    var js = {}
    js.PASS_SECU = superUser
    if (emp_pw == password) {
        res.json({ success: true, message: "SUCCESS", data: js });
    } else {
        res.json({ success: false, message: "Wrong emp_no or emp_pw" });
    }
}
module.exports.login = login

async function getFabricInfo(req, res) {
    const fabricNo = decodeURIComponent(req.query.fabric_no) || "";
    if (fabricNo.length == 0) {
        res.json({ success: false, message: "fabricNo must not be empty" });
        return; // Return early if emp_no is empty
    }
    var sqlQuery = `SELECT C.CUST_CODE, C.CUST_NAME, B.PRODUCT_CODE, D.PRD_NAME, A.STOCK_QTY, B.IMP_LOT_NO, B.DVR_LOT_NO, B.REMARK FROM FABRIC_STOCK_TBL A 
    LEFT JOIN FABRIC_IN_TBL B ON A.IN_NO = B.IN_NO 
    LEFT JOIN CUSTOMER_TBL C ON C.CUST_CODE = A.CUST_CODE 
    LEFT JOIN PRODUCT_TBL D ON D.PRODUCT_CODE = B.PRODUCT_CODE 
    WHERE A.IN_NO = '${fabricNo}'`
    var result = await new mssql.Request().query(sqlQuery)
    if (result.recordset.length == 0) {
        res.json({ success: false, message: "Empty data" });
    } else {
        var row = result.recordset[0]
        var js = {}
        js.CUST_CODE = row["CUST_CODE"]
        js.CUST_NAME = row["CUST_NAME"]
        js.PRODUCT_CODE = row["PRODUCT_CODE"]
        js.PRD_NAME = row["PRD_NAME"]
        js.STOCK_QTY = row["STOCK_QTY"]
        js.IMP_LOT_NO = row["IMP_LOT_NO"]
        js.DVR_LOT_NO = row["DVR_LOT_NO"]
        js.REMARK = row["REMARK"]
        res.json({ success: true, message: "SUCCESS", data: js });
    }

}
module.exports.getFabricInfo = getFabricInfo

async function getMID(req, res) {
    const LGR_CODE = 5 //Warehouse
    var sqlQuery = `SELECT CUST_MID_CODE,CUST_MID_NAME FROM CUST_MID_TBL WHERE CUST_LGR_CODE = '${LGR_CODE}'`
    var result = await new mssql.Request().query(sqlQuery);
    var data = [];

    for (let row of result.recordset) {
        var js = {};
        js.CODE = row["CUST_MID_CODE"];
        js.NAME = row["CUST_MID_NAME"];
        data.push(js);
    }

    res.json({ success: true, message: "SUCCESS", data: data });

}
module.exports.getMID = getMID

async function getSML(req, res) {
    const LGR_CODE = 5 //Warehouse
    const MID_CODE = decodeURIComponent(req.query.MID_CODE) || "";
    if (MID_CODE.length == 0) {
        res.json({ success: false, message: "MID_CODE must not be empty" });
        return;
    }
    var sqlQuery = `SELECT CUST_SML_CODE,CUST_SML_NAME FROM CUST_SML_TBL WHERE CUST_LGR_CODE = ${LGR_CODE} AND CUST_MID_CODE =${MID_CODE}`
    var result = await new mssql.Request().query(sqlQuery);
    var data = [];

    for (let row of result.recordset) {
        var js = {};
        js.CODE = row["CUST_SML_CODE"];
        js.NAME = row["CUST_SML_NAME"];
        data.push(js);
    }

    res.json({ success: true, message: "SUCCESS", data: data });

}
module.exports.getSML = getSML

async function getCUSTOMER(req, res) {
    const LGR_CODE = 5 //Warehouse
    const MID_CODE = decodeURIComponent(req.query.MID_CODE) || "";
    const SML_CODE = decodeURIComponent(req.query.SML_CODE) || "";
    if (MID_CODE.length == 0 || SML_CODE.length == 0) {
        res.json({ success: false, message: "MID_CODE and SML_CODE must not be empty" });
        return;
    }

    var sqlQuery = `SELECT CUST_CODE, CUST_NAME FROM CUSTOMER_TBL WHERE CUST_LGR_CODE = ${LGR_CODE} AND CUST_MID_CODE =${MID_CODE} AND CUST_SML_CODE=${SML_CODE}`
    var result = await new mssql.Request().query(sqlQuery);
    var data = [];

    for (let row of result.recordset) {
        var js = {};
        js.CODE = row["CUST_CODE"];
        js.NAME = row["CUST_NAME"];
        data.push(js);
    }

    res.json({ success: true, message: "SUCCESS", data: data });

}
module.exports.getCUSTOMER = getCUSTOMER

async function addSML(req, res) {
    const LGR_CODE = 5
    const MID_CODE = decodeURIComponent(req.body.MID_CODE) || "";
    const SML_NAME = decodeURIComponent(req.body.SML_NAME) || "";
    if (MID_CODE.length == 0 || SML_NAME.length == 0) {
        res.json({ success: false, message: "MID_CODE and SML_NAME must not be empty" });
        return;
    }
    try {
        const SML_CODE = await createSMLCode(LGR_CODE, MID_CODE)
        var sqlQuery = `INSERT INTO CUST_SML_TBL(CUST_LGR_CODE,CUST_MID_CODE,CUST_SML_CODE,CUST_SML_NAME,CUST_SML_NAME_ENG) VALUES('${LGR_CODE}','${MID_CODE}','${SML_CODE}','${SML_NAME}','')`
        await new mssql.Request().query(sqlQuery);
        res.json({ success: true, message: "SUCCESS" });
    } catch (error) {
        res.status(500).json({ success: false, message: "An error occurred while processing the request" });
    }
}
module.exports.addSML = addSML

async function createSMLCode(CUST_LGR_CODE, CUST_MID_CODE) {
    var sqlQuery = `SELECT CUST_SML_CODE FROM CUST_SML_TBL WHERE CUST_LGR_CODE = '${CUST_LGR_CODE}' AND CUST_MID_CODE = '${CUST_MID_CODE}'`
    var result = await new mssql.Request().query(sqlQuery)
    var rows = result.recordset

    if (rows.length == 0) {
        return "01"
    } else {
        var newIndex = parseInt(rows[rows.length - 1]["CUST_SML_CODE"]) + 1
        return String(newIndex).padStart(2, 0)
    }
}

async function updateSML(req, res) {
    const LGR_CODE = 5
    const MID_CODE = decodeURIComponent(req.body.MID_CODE) || "";
    const SML_CODE = decodeURIComponent(req.body.SML_CODE) || "";
    const SML_NAME = decodeURIComponent(req.body.SML_NAME) || "";

    if (MID_CODE.length == 0 || SML_CODE.length == 0 || SML_NAME.length == 0) {
        res.json({ success: false, message: "MID_CODE and SML_CODE and SML_NAME must not be empty" });
        return;
    }

    try {
        var sqlQuery = `UPDATE CUST_SML_TBL SET CUST_SML_NAME ='${SML_NAME}' 
        WHERE CUST_LGR_CODE = '${LGR_CODE}' AND CUST_MID_CODE ='${MID_CODE}' AND CUST_SML_CODE ='${SML_CODE}'`
        await new mssql.Request().query(sqlQuery)
        res.json({ success: true, message: "SUCCESS" });
    } catch (error) {
        res.status(500).json({ success: false, message: "An error occurred while processing the request" });
    }
}
module.exports.updateSML = updateSML

async function updateCustCode(req, res) {
    const CUST_CODE = decodeURIComponent(req.body.CUST_CODE) || "";
    const CUST_NAME = decodeURIComponent(req.body.CUST_NAME) || "";

    if (CUST_CODE.length == 0) {
        res.json({ success: false, message: "CUST_CODE and CUST_NAME must not be empty" });
        return;
    }

    try {
        var sqlQuery = `UPDATE CUSTOMER_TBL SET CUST_NAME = '${CUST_NAME}' WHERE CUST_CODE='${CUST_CODE}'`
        await new mssql.Request().query(sqlQuery)
        res.json({ success: true, message: "SUCCESS" });
    } catch (error) {
        res.status(500).json({ success: false, message: "An error occurred while processing the request" });
    }
}
module.exports.updateCustCode = updateCustCode

async function addCust(req, res) {
    const LGR_CODE = 5
    const MID_CODE = decodeURIComponent(req.body.MID_CODE) || "";
    const SML_CODE = decodeURIComponent(req.body.SML_CODE) || "";
    const CUST_NAME = decodeURIComponent(req.body.CUST_NAME) || "";
    const EMP_NO = decodeURIComponent(req.body.EMP_NO) || "";

    const currentDate = getCurrentDate(4)
    const currentTime = getCurrentTime()
    if (MID_CODE.length == 0 || SML_CODE.length == 0 || CUST_NAME.length == 0 || EMP_NO.length == 0) {
        res.json({ success: false, message: "MID_CODE and SML_CODE and CUST_NAME and EMP_NO must not be empty" });
        return;
    }
    const newCust = await getCustCode(MID_CODE, SML_CODE)
    try {
        var sqlQuery = `INSERT INTO CUSTOMER_TBL (CUST_CODE, CUST_NAME, CUST_NAME_ENG, CUST_LGR_CODE, CUST_MID_CODE, 
            CUST_SML_CODE, COUNTRY_CODE, CUST_TEL_NO, CUST_HP_NO, ADDR_MOD, 
            CUST_EMAIL, CUST_HOMEPAGE, CUST_FAX_NO, NOTE, USE_YN, 
            REG_DATE, REG_TIME, REG_EMP_NO, BANK_NAME, ACCOUNT_NO, 
            ACCOUNT_NAME, PRESIDENT_NAME, CORPORATION_NO, BUSS_NO, BUSS_NAME, CUST_PAY_TYPE, 
            TAX_CODE, STAFF_NAME, OPTIMUM_STOCK_YN, ACC_IN_CODE, ACC_OUT_CODE, 
            STOCK_WAREHOUSE_YN, WORK_YN) 
            VALUES ('${newCust}', '${CUST_NAME}', '', '${LGR_CODE}', '${MID_CODE}',
            '${SML_CODE}', 'A', '', '', '',
             '', '', '', '', 'Y',
            '${currentDate}', '${currentTime}', '${EMP_NO}', N'', '',
             N'', N'', '', '', N'', '1',
             '', N'', 'Y', 'N', 'N',
            'Y', 'Y')`
        await new mssql.Request().query(sqlQuery)
        res.json({ success: true, message: "SUCCESS" });
    } catch (error) {
        res.status(500).json({ success: false, message: "An error occurred while processing the request" });
    }

}
module.exports.addCust = addCust



async function getCustCode(MID_CODE, SML_CODE) {
    var tempCust = `W${MID_CODE}${SML_CODE}`
    var sqlQuery = `SELECT CUST_CODE FROM CUSTOMER_TBL WHERE CUST_CODE LIKE '${tempCust}%'`
    var result = await new mssql.Request().query(sqlQuery)
    var rows = result.recordset

    if (rows.length == 0) {
        tempCust += "0001"
    } else {
        var newIndex = parseInt(String(rows[rows.length - 1]["CUST_CODE"]).slice(-4)) + 1
        tempCust += String(newIndex).padStart(4, 0)
    }
    return tempCust
}

async function deleteSML(req, res) {
    const LGR_CODE = 5
    const MID_CODE = decodeURIComponent(req.body.MID_CODE) || "";
    const SML_CODE = decodeURIComponent(req.body.SML_CODE) || "";
    try {
        var sqlQuery = `DELETE CUST_SML_TBL WHERE CUST_LGR_CODE = '${LGR_CODE}' AND CUST_MID_CODE ='${MID_CODE}' AND CUST_SML_CODE ='${SML_CODE}'`
        await new mssql.Request().query(sqlQuery)
        res.json({ success: true, message: "SUCCESS" })
    } catch (error) {
        res.status(500).json({ success: false, message: "An error occurred while processing the request" });
    }
}
module.exports.deleteSML = deleteSML

async function deleteCust(req, res) {
    const CUST_CODE = decodeURIComponent(req.body.CUST_CODE) || "";
    try {
        var sqlQuery = `DELETE CUSTOMER_TBL WHERE CUST_CODE = '${CUST_CODE}'`
        await new mssql.Request().query(sqlQuery)
        res.json({ success: true, message: "SUCCESS" })
    } catch (error) {
        res.status(500).json({ success: false, message: "An error occurred while processing the request" });
    }
}
module.exports.deleteCust = deleteCust
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