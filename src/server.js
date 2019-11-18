const nforce = require('nforce');
const config = require('./config');

//nforce setup to connect Salesforce
const org = nforce.createConnection({
    clientId: config.CONSUMER_KEY,
    clientSecret: config.CONSUMER_SECRECT,
    redirectUri: 'at https://expensecardapplication.herokuapp.com/oauth/_callback',
    environment: "production",
    mode: "single"

});
module.exports = {
    org: org
};
