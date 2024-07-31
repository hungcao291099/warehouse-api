var express = require('express');
var cors = require("cors")
var mssql = require("mssql");
var bodyParser = require('body-parser');
var path = require('path');
var fs = require('fs');
var app = express();
let port = 3012
const configFile = fs.readFileSync('./config.json', 'utf8');
const config = JSON.parse(configFile);
app.use(cors())
app.listen(port, function () {
    console.log('Server started: ' + (port));
})
app.use(express.static(path.join(__dirname, 'html')));
app.use(bodyParser.urlencoded({ limit: '100mb', extended: false }));
app.use(bodyParser.json({ limit: '100mb' }));

async function keepAlive() {
    try {
        await mssql.connect(config.dbSetting);
    } catch (err) {
        console.error("DB connect ERROR:", err);
    }
}

// Call keepAlive once during application startup
keepAlive();
setInterval(keepAlive, 30000);

var func1 = require("./function1.js");
func1.settingDb(mssql);

var func2 = require("./function2.js");
func2.settingDb(mssql);

var DBFun = require("./DBFun.js");
DBFun.settingDb(mssql);

var DBProc = require("./DBProc.js");
DBProc.settingDb(mssql);

app.get('/get_db_config', function (req, res) {
    console.log("/get_db_config - GET");
    res.json({ config: config.dbSetting })
})

app.get('/test', function (req, res) {
    let data = {}
    data.API_IP = req.hostname
    data.API_PORT = port.toString()
    data.DB_IP = config.server
    data.err = ""
    try {
        new mssql.Request().query('SELECT 1 AS number')
        data.DB_connected = true
    } catch (error) {
        data.DB_connected = false
        data.err = error
    }
    res.json({ data })
})
app.get('/main/get_emp_nm', function (req, res) {
    console.log("/main/get_emp_nm - GET");
    func1.empNo2Name(req, res)
})
app.post('/main/login', function (req, res) {
    console.log("/main/login - POST");
    func1.login(req, res)
})
app.get('/main/get_fabric_info', function (req, res) {
    console.log("/main/get_fabric_info - GET");
    func1.getFabricInfo(req, res)
})
app.get('/main/get_MID', function (req, res) {
    console.log("/main/get_MID - GET");
    func1.getMID(req, res)
})
app.post('/main/add_mid', function (req, res) {
    console.log("/main/add_mid - POST");
    func1.addMID(req, res)
})
app.post('/main/update_mid', function (req, res) {
    console.log("/main/update_mid - POST");
    func1.updateMID(req, res)
})
app.post('/main/delete_mid', function (req, res) {
    console.log("/main/delete_mid - POST");
    func1.deleteMID(req, res)
})
app.get('/main/get_SML', function (req, res) {
    console.log("/main/get_SML - GET");
    func1.getSML(req, res)
})
app.get('/main/get_CUSTOMER', function (req, res) {
    console.log("/main/get_CUSTOMER - GET");
    func1.getCUSTOMER(req, res)
})
app.post('/main/add_sml', function (req, res) {
    console.log("/main/add_sml - POST");
    func1.addSML(req, res)
})
app.post('/main/add_cust', function (req, res) {
    console.log("/main/add_cust - POST");
    func1.addCust(req, res)
})
app.post('/main/update_sml', function (req, res) {
    console.log("/main/update_sml - POST");
    func1.updateSML(req, res)
})
app.post('/main/update_cust', function (req, res) {
    console.log("/main/update_cust - POST");
    func1.updateCustCode(req, res)
})
app.post('/main/delete_sml', function (req, res) {
    console.log("/main/delete_sml - POST");
    func1.deleteSML(req, res)
})
app.post('/main/delete_cust', function (req, res) {
    console.log("/main/delete_cust - POST");
    func1.deleteCust(req, res)
})
app.post('/main/update_fabric_location', function (req, res) {
    console.log("/main/update_fabric_location - POST");
    func2.updateFabricLocation(req, res)
})
app.get('/main/get_fabric_no', function (req, res) {
    console.log("/main/get_fabric_no - GET");
    func2.getFabricNo(req, res)
})
app.get('/main/get_current_fabric_location', function (req, res) {
    console.log("/main/get_current_fabric_location - GET");
    func2.getCurrentFabricLocation(req, res)
})
app.get('/main/get_product_stock_info', function (req, res) {
    console.log("/main/get_product_stock_info - GET");
    func2.getProductStockInfo(req, res)
})
app.get('/main/find_product_by_name', function (req, res) {
    console.log("/main/find_product_by_name - GET");
    func2.findProductByName(req, res)
})
app.get('/main/find_fabric_by_name', function (req, res) {
    console.log("/main/find_fabric_by_name - GET");
    func2.findFabrictByName(req, res)
})

app.post('/main/production_move', function (req, res) {
    console.log("/main/production_move - GET");
    func2.ProductionMove(req, res)
})
app.get('/main/get_LGR', function (req, res) {
    console.log("/main/get_LGR - GET");
    func1.getLGR(req, res)
})
app.post('/main/add_lgr', function (req, res) {
    console.log("/main/add_lgr - POST");
    func1.addLGR(req, res)
})
app.post('/main/update_lgr', function (req, res) {
    console.log("/main/update_lgr - POST");
    func1.updateLGR(req, res)
})
app.post('/main/delete_lgr', function (req, res) {
    console.log("/main/delete_lgr - POST");
    func1.deleteLGR(req, res)
})
app.get('/main/get_fabric_out_list', function (req, res) {
    console.log("/main/get_fabric_out_list - GET");
    func2.getWorkOrdBOMMove(req, res)
})
app.post('/main/move_to_workshop', function (req, res) {
    console.log("/main/move_to_workshop - POST");
    func2.move2Workshop(req, res)
})
app.get('/main/get_pending_fabric_list', function (req, res) {
    console.log("/main/get_pending_fabric_list - GET");
    func2.getPendingFabricList(req, res)
})
app.post('/main/set_checked_fabric', function (req, res) {
    console.log("/main/set_checked_fabric - POST");
    func2.setCheckedFabric(req, res)
})
app.get('/main/get_fabric_check_out_list', function (req, res) {
    console.log("/main/get_fabric_check_out_list - GET");
    func2.getFabricCheckOutList(req, res)
})