const nforce = require('nforce');
const Telegraf = require('telegraf');
const Markup = require('telegraf/markup');
const helper = require('./helper');
const config = require('./config');
const session = require('telegraf/session');
const Stage = require('telegraf/stage');
const Scene = require('telegraf/scenes/base');
const { leave } = Stage;
const stage = new Stage();

let oauth,
    port = config.http || config.https,
    state = {},
    conectOrgSF = helper.conectOrg;

conectOrgSF.authenticate({ username: config.salesforce.SFUSER, password: config.salesforce.SFPASS, securityToken: config.salesforce.SECURITY_TOKEN }, function(err, resp){
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

//Scene
const login = new Scene('login');
const password = new Scene('password');
const mainMenu = new Scene('mainMenu');

// Create scene manager
stage.register(login);
stage.register(password);
stage.register(password);
stage.register(mainMenu);

bot.start((ctx) => {
    ctx.reply(`Welcome, ${ctx.from.first_name}`).then(()=>ctx.scene.enter('login'));
});

bot.catch((err, ctx) => {
    console.log(`Ooops, ecountered an error for ${ctx.updateType}`, err)
});

//Login scene
login.enter((ctx) => {
    ctx.reply(`Enter your login: `);
});
login.on('text', (ctx) => {
    ctx.session.login = ctx.message.text;
    ctx.scene.enter('password');
});

//password scene
password.enter((ctx) => {
    ctx.reply(`Enter your password: `);
});
password.on('text',async (ctx) => {
    ctx.session.password = ctx.message.text;
    const userId = ctx.message.from.id;
    let query = `SELECT Id, Name, Email FROM Contact WHERE Email = '${ctx.session.login}' AND Password__c = '${ctx.session.password}'`;
    conectOrgSF.query({ query: query }, async (err, resp) => {
        if (!err && resp.records.length != 0) {
            let contact = JSON.parse(JSON.stringify(resp.records[0]));
            state[userId] = { id : userId };
            state[userId].contactId = contact.id;
            state[userId].name = contact.name;
            ctx.reply(`Authorization was successful!`).then(()=>ctx.scene.enter('mainMenu'));
        } else {
            ctx.reply('Invalid login or password!!!\nTry again!').then(()=>ctx.scene.enter('login'));
        }
    });
});

//mainMenu scene
mainMenu.enter((ctx) => {
    ctx.reply(`${state[ctx.message.from.id].name}, select action:`,
        Markup.inlineKeyboard([
            Markup.callbackButton(`Current Balance`,  `Balance`),
            Markup.callbackButton(`Create Card`, `Card`)
        ]).extra());
});

mainMenu.on('callback_query', (ctx) => {
    let button = ctx.callbackQuery.data;
    switch (button) {
        case 'Balance':
            let current_date = new Date();
            let query = `SELECT Id, MonthDate__c, SpentAmount__c, Balance__c, Keeper__c 
                            FROM MonthlyExpense__c 
                            WHERE CALENDAR_YEAR(Month_Date__c) = ${current_date.getFullYear()} AND Keeper__c ='${state[ctx.from.id].id}'`;
            conectOrgSF.query({ query: query }, async (err, resp) => {
                let monthlyExpenseList = JSON.parse(JSON.stringify(resp.records));
                let totalIncome = 0;
                let totalAmount = 0;
                for (let i = 0; i < monthlyExpenseList.length; i++) {
                    if (monthlyExpenseList[i].balance__c !== undefined) {
                        totalIncome += monthlyExpenseList[i].balance__c * 100;
                    }
                    if (monthlyExpenseList[i].spent_amount__c !== undefined && monthlyExpenseList[i].spent_amount__c != null) {
                        totalAmount += monthlyExpenseList[i].spent_amount__c * 100;
                    }
                }
                let totalBalance = (totalIncome - totalAmount) / 100;
                ctx.reply('Your balance: ' + totalBalance + '. Today ' + formatDate).then(()=>mainDialog(ctx, data.userId));
            });
            break;
        case 'Card':

            break;
    }
});



bot.help((ctx) => ctx.reply('Send me a sticker'));
bot.on('sticker', (ctx) => ctx.reply('👍'));
bot.hears('hi', (ctx) => ctx.reply('Hey there'));

async function startup() {
    await bot.launch();
    console.log(new Date(), 'Bot started as', bot.options.username);
};

startup();


setInterval(helper.getHttp(), 900000);