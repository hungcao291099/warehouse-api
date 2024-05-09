var express = require('express');
var cors = require("cors")
var mssql = require("mssql");
var bodyParser = require('body-parser');
var path = require('path');
var app = express();
app.use(cors())
app.listen(3012, function () {
    console.log('Server started: ' + (3012));
})
app.use(express.static(path.join(__dirname, 'html')));
app.use(bodyParser.urlencoded({ limit: '100mb', extended: false }));
app.use(bodyParser.json({ limit: '100mb' }));
var config = {
    "user": "sa", // Database username
    "password": "@pyungan_pass_sa!@21323", // Database password
    "server": "192.168.80.3", // Server IP address
    "database": "PMS_VIETNAM_DB", // Database name
    "options": {
        "encrypt": false // Disable encryption
    }
}
async function keepAlive() {
    try {
        await mssql.connect(config);
        await new mssql.Request().query`SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED`;
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
app.get('/main/test', function (req, res) {
    console.log("/main/test - GET");
    func2.test(req, res)
})
app.post('/main/production_move', function (req, res) {
    console.log("/main/production_move - GET");
    func2.ProductionMove(req, res)
})

