const config = require('./config');
const nforce = require('nforce');
let http = require('http');

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
        let yy = date.getFullYear() % 100;
        if (yy < 10) yy = '0' + yy;

        return dd + '.' + mm + '.' + yy;
    },
    getHttp() {
        http.get('http://psk-tgbot.herokuapp.com/');
        org.authenticate({ username: config.salesforce.SFUSER, password: config.salesforce.SFPASS, securityToken: config.salesforce.SECURITY_TOKEN }, function(err, resp){
            if(!err) {
                oauth = resp;
                console.log('Connection is completed');
            } else {
                console.log('Error: ' + err.message);
            }
        });
    }
}
