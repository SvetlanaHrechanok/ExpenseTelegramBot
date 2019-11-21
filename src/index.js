const nforce = require('nforce');
const helper = require('./helper');
const config = require('./config');
const session = require('telegraf/session');
const Telegraf = require('telegraf');
const Markup = require('telegraf/markup');
const Calendar = require('telegraf-calendar-telegram');
//Scene
const Stage = require('telegraf/stage');
const Scene = require('telegraf/scenes/base');
const { leave } = Stage;
const stage = new Stage();
const userLogin = new Scene('userLogin');
const userPassword = new Scene('userPassword');
const mainMenu = new Scene('mainMenu');
const subMenu = new Scene('subMenu');
const expenseCardDesc = new Scene('expenseCardDesc');
const newExpenseCard = new Scene('newExpenseCard');
//bot
const bot = new Telegraf(config.bot.TOKEN);

let port = config.http || config.https,
    state = {},
    conectOrgSF = helper.conectOrg;

conectOrgSF.authenticate({ username: config.salesforce.SFUSER, password: config.salesforce.SFPASS, securityToken: config.salesforce.SECURITY_TOKEN }, function(err, resp){
    if(!err) {
        console.log('Success connection');
    } else {
        console.log('Error: ' + err.message);
    }
});


bot.telegram.setWebhook(`${config.heroku.URL}bot${config.bot.TOKEN}`);
bot.startWebhook(`/bot${config.bot.TOKEN}`, null, port);
bot.use(session());
bot.use(stage.middleware());

// Create scene manager
stage.register(userLogin);
stage.register(userPassword);
stage.register(mainMenu);
stage.register(subMenu);
stage.register(expenseCardDesc);
stage.register(newExpenseCard);

bot.start(async (ctx) => {
    return ctx.reply(`Welcome, ${ctx.from.first_name}`)
        .then(() => ctx.scene.enter('userLogin'));
});
bot.command('exit', async (ctx) => {
    return ctx.reply(`Good bay, ${ctx.from.first_name}`)
        .then(() => leave());
});

stage.command('start', (ctx) => {
    leave()
        .then(() => ctx.scene.enter('userLogin'));
});

bot.catch((err, ctx) => {
    console.log(`Ooops, ecountered an error for ${ctx.updateType}`, err)
});

//userLogin scene
userLogin.enter((ctx) => {
    ctx.reply(`Enter your login: `);
});
userLogin.on('text', (ctx) => {
    ctx.session.login = ctx.message.text;
    ctx.scene.enter('userPassword');
});

//userPassword scene
userPassword.enter((ctx) => {
    ctx.reply(`Enter your password: `);
});
userPassword.on('text', async (ctx) => {
    ctx.session.password = ctx.message.text;
    const userId = ctx.message.from.id;
    let query = `SELECT Id, Name, Email FROM Contact 
                    WHERE Email = '${ctx.session.login}' AND Password__c = '${ctx.session.password}'`;
    conectOrgSF.query({ query: query }, async (err, resp) => {
        if (!err && resp.records.length != 0) {
            let contact = JSON.parse(JSON.stringify(resp.records[0]));
            state[userId] = { id : userId };
            state[userId].contactId = contact.id;
            state[userId].name = contact.name;
            return ctx.reply(`Authorization was successful!`)
                .then(() => ctx.scene.enter('mainMenu'));
        } else {
            return ctx.reply('Invalid login or password!!!\nTry again!')
                .then(() => ctx.scene.enter('userLogin'));
        }
    });
});

//mainMenu scene
mainMenu.enter((ctx) => {
    ctx.reply(`${state[ctx.from.id].name}, select action:`,
        Markup.inlineKeyboard([
            Markup.callbackButton(`Current Balance`,  `Balance`),
            Markup.callbackButton(`Create Card`, `Card`)
        ]).extra());
});
mainMenu.on('callback_query', async (ctx) => {
    let button = ctx.callbackQuery.data;
    switch (button) {
        case 'Balance':
            let current_date = new Date();
            let query = `SELECT Id, MonthDate__c, SpentAmount__c, Balance__c, Keeper__c 
                            FROM MonthlyExpense__c 
                            WHERE CALENDAR_YEAR(MonthDate__c) = ${current_date.getFullYear()} AND Keeper__c ='${state[ctx.from.id].contactId}'`;
            conectOrgSF.query({ query: query }, async (err, resp) => {
                let listMonthlyExpenses = JSON.parse(JSON.stringify(resp.records));
                let income = 0;
                let amount = 0;
                listMonthlyExpenses.forEach(function(monthlyExpense) {
                    income += monthlyExpense.balance__c;
                    amount += monthlyExpense.spentamount__c;
                });
                let balance = income - amount;
                return ctx.reply('Your current balance: $' + balance.toFixed(2) + '. Today ' + helper.formatDate(current_date))
                    .then(() => ctx.scene.enter('mainMenu'));
            });
            break;
        case 'Card':
            ctx.scene.enter('subMenu');
            break;
    }
});

//sumMenu scene
subMenu.enter((ctx) => {
    ctx.reply(`${state[ctx.from.id].name}, Create expense card:`,
        Markup.inlineKeyboard([
            Markup.callbackButton(`for today`,  `Today`),
            Markup.callbackButton(`for date`, `Date`),
            Markup.callbackButton(`↩ Back`, `Back`)
        ]).extra());
});
subMenu.on('callback_query', async (ctx) => {
    let button = ctx.callbackQuery.data;
    switch (button) {
        case 'Today':
            state[ctx.from.id].date = new Date();
            ctx.scene.enter('expenseCardDesc');
            break;
        case 'Date':
            const calendar = new Calendar(bot, {
                startWeekDay: 0,
                weekDayNames: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
                monthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
                minDate: new Date(2017, 0, 1),
                maxDate: new Date()
            });
            ctx.reply(`Select date from the calendar:`, calendar.getCalendar());
            calendar.setDateListener((ctx, date) => {
                state[ctx.from.id].date = date;
                ctx.scene.enter('expenseCardDesc');
            });
            break;
        case 'Back':
            ctx.scene.enter('mainMenu');
            break;
    }
});

//expenseCardDesc scene
expenseCardDesc.enter((ctx) => {
    ctx.reply(`Enter description for this expense card:`);
});
expenseCardDesc.on('message', (ctx) => {
    state[ctx.from.id].description = ctx.message.text;
    ctx.scene.enter('newExpenseCard');
});

//newExpenseCard scene
newExpenseCard.enter((ctx) => {
    ctx.reply(`Enter amount for this expense card:`);
});
newExpenseCard.hears(/^\d*([.,]\d*)?$/, async (ctx) => {
    let amount = parseFloat(ctx.message.text.replace(/,/, '.')).toFixed(2);
    let expenseCard = nforce.createSObject('ExpenseCard__c');
        expenseCard.set('CardDate__c', state[ctx.from.id].date);
        expenseCard.set('Amount__c', amount);
        expenseCard.set('Description__c', state[ctx.from.id].description);
        expenseCard.set('CardKeeper__c', state[ctx.from.id].contactId);
        expenseCard.set('Name', `${helper.formatDate(state[ctx.from.id].date)}_${state[ctx.from.id].name}`);
    conectOrgSF.insert({sobject: expenseCard},async function (err, resp) {
        if (!err) {
            return ctx.reply(`Expense Card was created!\nDate: ${helper.formatDate(state[ctx.from.id].date)}, amount: ${amount}, description: ${state[ctx.from.id].description}`)
                .then(ctx.scene.enter('mainMenu'));
        } else {
            return ctx.reply('Error: ' + err.message);
        }
    });
});
newExpenseCard.on('message', (ctx) => {
    ctx.reply(`Enter number for amount:`);
});

bot.help((ctx) => ctx.reply('Send me a sticker'));
bot.on('sticker', (ctx) => ctx.reply('👍'));
bot.hears('hi', (ctx) => ctx.reply('Hey there'));

async function startup() {
    await bot.launch();
    console.log(new Date(), 'Bot started as', bot.options.username);
};

startup();


setInterval(helper.getHttp, 900000);