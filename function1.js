
let mssql;

function settingDb(mssqlConnect) {
    mssql = mssqlConnect;

}
module.exports.settingDb = settingDb;

async function empNo2Name(req, res) {
    try {
        const ls_emp_no = decodeURIComponent(req.query.emp_no) || "";
        if (!ls_emp_no) {
            res.status(400).json({ success: false, message: "emp_no must not be empty" });
            return; // Return early if emp_no is empty
        }
        const ls_sqlQuery = `SELECT EMP_NAME FROM EMPLOYEE_TBL WHERE EMP_NO = '${ls_emp_no}'`
        const dt = await new mssql.Request().query(ls_sqlQuery);
        const ls_emp_nm = dt.recordset[0];
        res.json({ success: true, message: "SUCCESS", data: ls_emp_nm });
    } catch (err) {
        console.error("Error executing query:", err);
    }
}

module.exports.empNo2Name = empNo2Name;

async function login(req, res) {
    const ls_emp_no = decodeURIComponent(req.body.emp_no) || "";
    const ls_emp_pw = decodeURIComponent(req.body.emp_pw) || "";
    if (!ls_emp_no || !ls_emp_pw) {
        res.json({ success: false, message: "emp_no and emp_pw must not be empty" });
        return; // Return early if emp_no is empty
    }
    let ls_sqlQuery = `SELECT PASS_WORD, COALESCE(PASS_SECU, 0) AS PASS_SECU FROM USR_TBL WHERE PASS_EMPL= '${ls_emp_no}'`
    let dt = await new mssql.Request().query(ls_sqlQuery)
    let dr = dt.recordset
    const ls_password = dr[0]['PASS_WORD']
    const ls_superUser = dr[0]['PASS_SECU']
    let js = {}
    js.PASS_SECU = ls_superUser
    if (ls_emp_pw == ls_password) {
        res.json({ success: true, message: "SUCCESS", data: js });
    } else {
        res.json({ success: false, message: "Wrong emp_no or emp_pw" });
    }
}
module.exports.login = login

async function getFabricInfo(req, res) {
    const ls_fabricNo = decodeURIComponent(req.query.fabric_no) || "";
    if (ls_fabricNo.length == 0) {
        res.json({ success: false, message: "fabricNo must not be empty" });
        return; // Return early if emp_no is empty
    }
    let ls_sqlQuery = `
    SELECT C.CUST_CODE, C.CUST_NAME, B.PRODUCT_CODE, D.PRD_NAME, A.STOCK_QTY, B.IMP_LOT_NO, B.DVR_LOT_NO, B.REMARK 
      FROM FABRIC_STOCK_TBL A LEFT JOIN FABRIC_IN_TBL B ON A.IN_NO = B.IN_NO 
                              LEFT JOIN CUSTOMER_TBL C ON C.CUST_CODE = A.CUST_CODE 
                              LEFT JOIN PRODUCT_TBL D ON D.PRODUCT_CODE = B.PRODUCT_CODE 
     WHERE A.IN_NO = '${ls_fabricNo}'`
    let dt = await new mssql.Request().query(ls_sqlQuery)
    let dr = dt.recordset
    if (dr.length == 0) {
        res.json({ success: false, message: "Empty data" });
    } else {
        let js = {}
        js.CUST_CODE = dr[0]["CUST_CODE"]
        js.CUST_NAME = dr[0]["CUST_NAME"]
        js.PRODUCT_CODE = dr[0]["PRODUCT_CODE"]
        js.PRD_NAME = dr[0]["PRD_NAME"]
        js.STOCK_QTY = dr[0]["STOCK_QTY"]
        js.IMP_LOT_NO = dr[0]["IMP_LOT_NO"]
        js.DVR_LOT_NO = dr[0]["DVR_LOT_NO"]
        js.REMARK = dr[0]["REMARK"]
        res.json({ success: true, message: "SUCCESS", data: js });
    }

}
module.exports.getFabricInfo = getFabricInfo

async function getMID(req, res) {
    const ls_lgrCode = 5 //Warehouse
    let ls_sqlQuery = `SELECT CUST_MID_CODE,CUST_MID_NAME FROM CUST_MID_TBL WHERE CUST_LGR_CODE = '${ls_lgrCode}'`
    let dt = await new mssql.Request().query(ls_sqlQuery);
    let dr = dt.recordset
    let data = [];

    for (let row of dr) {
        let js = {};
        js.CODE = row["CUST_MID_CODE"];
        js.NAME = row["CUST_MID_NAME"];
        data.push(js);
    }

    res.json({ success: true, message: "SUCCESS", data: data });

}
module.exports.getMID = getMID

async function getSML(req, res) {
    const ls_lgrCode = 5 //Warehouse
    const ls_midCode = decodeURIComponent(req.query.MID_CODE) || "";
    if (ls_midCode.length == 0) {
        res.json({ success: false, message: "MID_CODE must not be empty" });
        return;
    }
    let ls_sqlQuery = `
    SELECT CUST_SML_CODE, CUST_SML_NAME 
      FROM CUST_SML_TBL 
     WHERE CUST_LGR_CODE = ${ls_lgrCode} 
       AND CUST_MID_CODE =${ls_midCode}`
    let dt = await new mssql.Request().query(ls_sqlQuery);
    let dr = dt.recordset
    let data = [];

    for (let row of dr) {
        let js = {};
        js.CODE = row["CUST_SML_CODE"];
        js.NAME = row["CUST_SML_NAME"];
        data.push(js);
    }

    res.json({ success: true, message: "SUCCESS", data: data });

}
module.exports.getSML = getSML

async function getCUSTOMER(req, res) {
    const ls_lgrCode = 5 //Warehouse
    const ls_midCode = decodeURIComponent(req.query.MID_CODE) || "";
    const ls_smlCode = decodeURIComponent(req.query.SML_CODE) || "";
    if (ls_midCode.length == 0 || ls_smlCode.length == 0) {
        res.json({ success: false, message: "MID_CODE and SML_CODE must not be empty" });
        return;
    }

    let ls_sqlQuery = `
    SELECT CUST_CODE, CUST_NAME 
      FROM CUSTOMER_TBL 
     WHERE CUST_LGR_CODE = ${ls_lgrCode} 
       AND CUST_MID_CODE =${ls_midCode} 
       AND CUST_SML_CODE=${ls_smlCode}`
    let dt = await new mssql.Request().query(ls_sqlQuery);
    let dr = dt.recordset
    let data = [];

    for (let row of dr) {
        let js = {};
        js.CODE = row["CUST_CODE"];
        js.NAME = row["CUST_NAME"];
        data.push(js);
    }

    res.json({ success: true, message: "SUCCESS", data: data });

}
module.exports.getCUSTOMER = getCUSTOMER

async function addSML(req, res) {
    const ls_lgrCode = 5
    const ls_midCode = decodeURIComponent(req.body.MID_CODE) || "";
    const ls_smlName = decodeURIComponent(req.body.SML_NAME) || "";
    if (ls_midCode.length == 0 || ls_smlName.length == 0) {
        res.json({ success: false, message: "MID_CODE and SML_NAME must not be empty" });
        return;
    }
    try {
        const ls_smlCode = await createSMLCode(ls_lgrCode, ls_midCode)
        let ls_sqlQuery = `
        INSERT INTO CUST_SML_TBL(CUST_LGR_CODE,CUST_MID_CODE,CUST_SML_CODE,CUST_SML_NAME,CUST_SML_NAME_ENG) 
        VALUES('${ls_lgrCode}','${ls_midCode}','${ls_smlCode}','${ls_smlName}','')`
        await new mssql.Request().query(ls_sqlQuery);
        res.json({ success: true, message: "SUCCESS" });
    } catch (error) {
        res.status(500).json({ success: false, message: "An error occurred while processing the request" });
    }
}
module.exports.addSML = addSML

async function createSMLCode(_custLgrCode, _custMidCode) {
    let ls_sqlQuery = `
    SELECT CUST_SML_CODE 
      FROM CUST_SML_TBL 
     WHERE CUST_LGR_CODE = '${_custLgrCode}' 
       AND CUST_MID_CODE = '${_custMidCode}'`
    let dt = await new mssql.Request().query(ls_sqlQuery)
    let dr = dt.recordset

    if (dr.length == 0) {
        return "01"
    } else {
        let li_newIndex = parseInt(dr[dr.length - 1]["CUST_SML_CODE"]) + 1
        return String(li_newIndex).padStart(2, 0)
    }
}

async function updateSML(req, res) {
    const ls_lgrCode = 5
    const ls_midCode = decodeURIComponent(req.body.MID_CODE) || "";
    const ls_smlCode = decodeURIComponent(req.body.SML_CODE) || "";
    const ls_smlName = decodeURIComponent(req.body.SML_NAME) || "";

    if (ls_midCode.length == 0 || ls_smlCode.length == 0 || ls_smlName.length == 0) {
        res.json({ success: false, message: "MID_CODE and SML_CODE and SML_NAME must not be empty" });
        return;
    }

    try {
        let ls_sqlQuery = `
        UPDATE CUST_SML_TBL SET CUST_SML_NAME ='${ls_smlName}' 
         WHERE CUST_LGR_CODE = '${ls_lgrCode}' 
           AND CUST_MID_CODE ='${ls_midCode}' 
           AND CUST_SML_CODE ='${ls_smlCode}'`
        await new mssql.Request().query(ls_sqlQuery)
        res.json({ success: true, message: "SUCCESS" });
    } catch (error) {
        res.status(500).json({ success: false, message: "An error occurred while processing the request" });
    }
}
module.exports.updateSML = updateSML

async function updateCustCode(req, res) {
    const ls_custCode = decodeURIComponent(req.body.CUST_CODE) || "";
    const ls_custName = decodeURIComponent(req.body.CUST_NAME) || "";

    if (ls_custCode.length == 0) {
        res.json({ success: false, message: "CUST_CODE and CUST_NAME must not be empty" });
        return;
    }

    try {
        let ls_sqlQuery = `UPDATE CUSTOMER_TBL SET CUST_NAME = '${ls_custName}' WHERE CUST_CODE='${ls_custCode}'`
        await new mssql.Request().query(ls_sqlQuery)
        res.json({ success: true, message: "SUCCESS" });
    } catch (error) {
        res.status(500).json({ success: false, message: "An error occurred while processing the request" });
    }
}
module.exports.updateCustCode = updateCustCode

async function addCust(req, res) {
    const ls_lgrCode = 5
    const ls_midCode = decodeURIComponent(req.body.MID_CODE) || "";
    const ls_smlCode = decodeURIComponent(req.body.SML_CODE) || "";
    const ls_custName = decodeURIComponent(req.body.CUST_NAME) || "";
    const ls_empNo = decodeURIComponent(req.body.EMP_NO) || "";

    const currentDateYYYY = getCurrentDate(4)
    const currentTimeHHmm = getCurrentTime()
    if (ls_midCode.length == 0 || ls_smlCode.length == 0 || ls_custName.length == 0 || ls_empNo.length == 0) {
        res.json({ success: false, message: "MID_CODE and SML_CODE and CUST_NAME and EMP_NO must not be empty" });
        return;
    }
    const ls_newCust = await getCustCode(MID_CODE, SML_CODE)
    try {
        let ls_sqlQuery = `
            INSERT INTO CUSTOMER_TBL (CUST_CODE, CUST_NAME, CUST_NAME_ENG, CUST_LGR_CODE, CUST_MID_CODE, 
                                      CUST_SML_CODE, COUNTRY_CODE, CUST_TEL_NO, CUST_HP_NO, ADDR_MOD, 
                                      CUST_EMAIL, CUST_HOMEPAGE, CUST_FAX_NO, NOTE, USE_YN, 
                                      REG_DATE, REG_TIME, REG_EMP_NO, BANK_NAME, ACCOUNT_NO, 
                                      ACCOUNT_NAME, PRESIDENT_NAME, CORPORATION_NO, BUSS_NO, BUSS_NAME, CUST_PAY_TYPE, 
                                      TAX_CODE, STAFF_NAME, OPTIMUM_STOCK_YN, ACC_IN_CODE, ACC_OUT_CODE, 
                                      STOCK_WAREHOUSE_YN, WORK_YN) 
            VALUES ('${ls_newCust}', '${ls_custName}', '', '${ls_lgrCode}', '${ls_midCode}',
            '${ls_smlCode}', 'A', '', '', '',
             '', '', '', '', 'Y',
            '${currentDateYYYY}', '${currentTimeHHmm}', '${ls_empNo}', N'', '',
             N'', N'', '', '', N'', '1',
             '', N'', 'Y', 'N', 'N',
            'Y', 'Y')`
        await new mssql.Request().query(ls_sqlQuery)
        res.json({ success: true, message: "SUCCESS" });
    } catch (error) {
        res.status(500).json({ success: false, message: "An error occurred while processing the request" });
    }

}
module.exports.addCust = addCust



async function getCustCode(ls_midCode, ls_smlCode) {
    let ls_tempCust = `W${ls_midCode}${ls_smlCode}`
    let ls_sqlQuery = `SELECT CUST_CODE FROM CUSTOMER_TBL WHERE CUST_CODE LIKE '${ls_tempCust}%'`
    let dt = await new mssql.Request().query(ls_sqlQuery)
    let dr = dt.recordset

    if (dr.length == 0) {
        ls_tempCust += "0001"
    } else {
        let li_newIndex = parseInt(String(dr[dr.length - 1]["CUST_CODE"]).slice(-4)) + 1
        ls_tempCust += String(li_newIndex).padStart(4, 0)
    }
    return ls_tempCust
}

async function deleteSML(req, res) {
    const ls_lgrCode = 5
    const ls_midCode = decodeURIComponent(req.body.MID_CODE) || "";
    const ls_smlCode = decodeURIComponent(req.body.SML_CODE) || "";
    try {
        let ls_sqlQuery = `
        DELETE CUST_SML_TBL 
         WHERE CUST_LGR_CODE = '${ls_lgrCode}' 
           AND CUST_MID_CODE ='${ls_midCode}' 
           AND CUST_SML_CODE ='${ls_smlCode}'`
        await new mssql.Request().query(ls_sqlQuery)
        res.json({ success: true, message: "SUCCESS" })
    } catch (error) {
        res.status(500).json({ success: false, message: "An error occurred while processing the request" });
    }
}
module.exports.deleteSML = deleteSML

async function deleteCust(req, res) {
    const ls_custCode = decodeURIComponent(req.body.CUST_CODE) || "";
    try {
        let ls_sqlQuery = `DELETE CUSTOMER_TBL WHERE CUST_CODE = '${ls_custCode}'`
        await new mssql.Request().query(ls_sqlQuery)
        res.json({ success: true, message: "SUCCESS" })
    } catch (error) {
        res.status(500).json({ success: false, message: "An error occurred while processing the request" });
    }
}
module.exports.deleteCust = deleteCust
function getCurrentDate(yearLength) {
    const now = new Date();
    let ls_year
    if (yearLength == 2) {
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