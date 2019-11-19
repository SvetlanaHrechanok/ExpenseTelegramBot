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

const login = new Scene('login');
const password = new Scene('password');

// Create scene manager
stage.register(login);
stage.register(password);

bot.start((ctx) => {
    ctx.reply(`Welcome`);
    ctx.scene.enter('login');
});
bot.catch((err, ctx) => {
    console.log(`Ooops, ecountered an error for ${ctx.updateType}`, err)
});

//Login scene
login.enter((ctx) => {
    ctx.reply(`${ctx.from.first_name}, enter your login: `);
});
login.on('text', (ctx) => {
    ctx.session.login = ctx.message.text;
    ctx.scene.enter('password');
});

//password scene
password.enter((ctx) => {
    ctx.reply(`${ctx.session.login}, enter your password: `);
});
password.on('text',async (ctx) => {
    ctx.session.password = ctx.message.text;
    let query = `SELECT Id, Name, Email FROM Contact WHERE Email =` + `'` + `${ctx.session.login}` + `'` + ` AND Password__c =` + `'` + `${ctx.session.password}` + `'`;
    org.query({ query: query }, async (err, resp) => {
        if (!err && resp.records) {
            let contact = JSON.parse(JSON.stringify(resp.records[0]));
            ctx.session.userId = contact.Id;
            ctx.session.userName = contact.Name;
            ctx.reply(`Success!`).then(()=>ctx.scene.enter('login'));
        } else {
            ctx.reply('Invalid login or password!!!\nTry again!').then(()=>ctx.scene.enter('login'));
        }
    });
});
bot.help((ctx) => ctx.reply('Send me a sticker'));
bot.on('sticker', (ctx) => ctx.reply('👍'));
bot.hears('hi', (ctx) => ctx.reply('Hey there'));
bot.launch();


