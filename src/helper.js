const config = require('./config');
const nforce = require('nforce');
const https = require('https');

//nforce setup to connect Salesforce
const org = nforce.createConnection({
    clientId: config.salesforce.CONSUMER_KEY,
    clientSecret: config.salesforce.CONSUMER_SECRECT,
    redirectUri: config.heroku.URL,
    environment: 'production',
    mode: 'single'

});


module.exports = {
    conectOrg: org,

    formatDate(date) {
        let dd = date.getDate();
        if (dd < 10) dd = '0' + dd;
        let mm = date.getMonth() + 1;
        if (mm < 10) mm = '0' + mm;
        let yyyy = date.getFullYear();

        return yyyy + '-' + mm + '-' + dd;
    },
    getHttps() {
        https.get(config.heroku, (res) => {
            org.authenticate({ username: config.salesforce.SFUSER, password: config.salesforce.SFPASS, securityToken: config.salesforce.SECURITY_TOKEN }, function(err, resp){
                if(!err) {
                    console.log('Success connection');
                } else {
                    console.log('Error: ' + err.message);
                }
            });
        }).on('error', (e) => {
            console.error(e);
        });
    },
    getBalanceFromDB(id, year) {
        let query = `SELECT Id, MonthDate__c, SpentAmount__c, Balance__c, Keeper__c 
                            FROM MonthlyExpense__c 
                            WHERE CALENDAR_YEAR(MonthDate__c) = ${year} AND Keeper__c ='${id}'`;
        let income = 0;
        let amount = 0;
        org.query({ query: query }, async (err, resp) => {
            let listMonthlyExpenses = JSON.parse(JSON.stringify(resp.records));
            listMonthlyExpenses.forEach(function(monthlyExpense) {
                income += monthlyExpense.balance__c;
                amount += monthlyExpense.spentamount__c;
            });
        });
        return income - amount;
    }
}
