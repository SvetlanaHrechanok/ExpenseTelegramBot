const nforce = require('nforce');
const Telegraf = require('telegraf');
const helper = require('./helper');
const config = require('./config');
const session = require('telegraf/session');
const Stage = require('telegraf/stage');
const Scene = require('telegraf/scenes/base');
const { leave } = Stage;
const stage = new Stage();

//nforce setup to connect Salesforce
const org = nforce.createConnection({
    clientId: config.salesforce.CONSUMER_KEY,
    clientSecret: config.salesforce.CONSUMER_SECRECT,
    redirectUri: config.heroku.URL,
    environment: 'production',
    mode: 'single'

});
let oauth,
    port = config.http || config.https;
org.authenticate({ username: config.salesforce.SFUSER, password: config.salesforce.SFPASS, securityToken: config.salesforce.SECURITY_TOKEN }, function(err, resp){
    if(!err) {
        oauth = resp;
        console.log('Connection is completed');
    } else {
        console.log('Error: ' + err.message);
    }
});

const bot = new Telegraf(config.bot.TOKEN);
bot.telegram.setWebhook(`${config.heroku.URL}bot${config.bot.TOKEN}`);
bot.startWebhook(`/bot${config.bot.TOKEN}`, null, port);
bot.use(session());
bot.use(stage.middleware());

bot.start((ctx) => ctx.reply('Welcome'));
bot.help((ctx) => ctx.reply('Send me a sticker'));
bot.on('sticker', (ctx) => ctx.reply('👍'));
bot.hears('hi', (ctx) => ctx.reply('Hey there'));
bot.launch();


