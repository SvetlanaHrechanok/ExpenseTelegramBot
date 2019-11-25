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
const newIncome = new Scene('newIncome');

const bot = new Telegraf(config.bot.TOKEN, {webhookReply: false});

let port = process.env.PORT || config.http || config.https,
    state = {},
    conectOrgSF = helper.conectOrg;

conectOrgSF.authenticate({ username: config.salesforce.SFUSER, password: config.salesforce.SFPASS, securityToken: config.salesforce.SECURITY_TOKEN }, function(err, resp){
    if(!err) {
        console.log('Success connection');
    } else {
        console.log('Error: ' + err.message);
    }
});

//userLogin scene
userLogin.enter(async (ctx) => {
    return ctx.reply(`Enter your login: `);
});
userLogin.on('text', (ctx) => {
    state[ctx.from.id] = { id : ctx.from.id };
    state[ctx.from.id].login = ctx.message.text;
    ctx.scene.enter('userPassword');
});

//userPassword scene
userPassword.enter((ctx) => {
    return ctx.reply(`Enter your password: `);
});
userPassword.on('text', async (ctx) => {
    state[ctx.from.id].password = ctx.message.text;
    let query = `SELECT Id, Name, Email FROM Contact 
                    WHERE Email = '${state[ctx.from.id].login}' AND Password__c = '${state[ctx.from.id].password}'`;
    conectOrgSF.query({ query: query }, async (err, resp) => {
        if (!err && resp.records.length != 0) {
            let contact = JSON.parse(JSON.stringify(resp.records[0]));
            state[ctx.from.id].contactId = contact.id;
            state[ctx.from.id].name = contact.name;
            return ctx.reply(`Authorization was successful!`)
                .then(() => ctx.scene.enter('mainMenu'));
        } else {
            return ctx.reply('Invalid login or password!!!\nTry again!')
                .then(() => ctx.scene.enter('userLogin'));
        }
    });
});

//mainMenu scene
mainMenu.enter(async (ctx) => {
    return ctx.reply(`${state[ctx.from.id].name}, select action:`,
        Markup.inlineKeyboard([
            Markup.callbackButton(`Current Balance`,  `Balance`),
            Markup.callbackButton(`Create Card`, `Card`),
            Markup.callbackButton(`Create Income`, `Income`)
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
            state[ctx.from.id].newevent = 'Expense Card';
            ctx.scene.enter('subMenu');
            break;
        case 'Income':
            state[ctx.from.id].newevent = 'Income';
            ctx.scene.enter('subMenu');
            break;
    }
});

//Calendar
const calendar = new Calendar(bot, {
    startWeekDay: 0,
    weekDayNames: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    monthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    minDate: new Date(2017, 0, 1),
    maxDate: new Date()
});
calendar.setDateListener(async (ctx, date) => {
    state[ctx.from.id].date = new Date(date);
    return ctx.reply(`${date}`)
        .then(() => state[ctx.from.id].newevent == 'Expense Card' ? ctx.scene.enter('expenseCardDesc') : ctx.scene.enter('newIncome'));
});

//sumMenu scene
subMenu.enter(async (ctx) => {
    return ctx.reply(`${state[ctx.from.id].name}, Create ${state[ctx.from.id].newevent}:`,
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
            state[ctx.from.id].newevent == 'Expense Card' ? ctx.scene.enter('expenseCardDesc') : ctx.scene.enter('newIncome');
            break;
        case 'Date':
            return ctx.reply(`Select date from the calendar:`, calendar.getCalendar());
            break;
        case 'Back':
            ctx.scene.enter('mainMenu');
            break;
    }
});

//expenseCardDesc scene
expenseCardDesc.enter(async (ctx) => {
    return ctx.reply(`Enter description for this expense card:`);
});
expenseCardDesc.on('message', (ctx) => {
    state[ctx.from.id].description = ctx.message.text;
    ctx.scene.enter('newExpenseCard');
});

//newExpenseCard scene
newExpenseCard.enter(async (ctx) => {
    return ctx.reply(`Enter amount for this expense card:`);
});
newExpenseCard.hears(/^\d*([.,]\d*)?$/, async (ctx) => {
    let amount = parseFloat(ctx.message.text.replace(/,/, '.')).toFixed(2);
    let expenseCard = nforce.createSObject('ExpenseCard__c',{
        cardDate__c: state[ctx.from.id].date,
        amount__c: amount,
        description__c: state[ctx.from.id].description,
        cardKeeper__c: state[ctx.from.id].contactId,
        name: `${helper.formatDate(state[ctx.from.id].date)}_${state[ctx.from.id].name}`
    });

    conectOrgSF.insert({sobject: expenseCard},async function(err, resp) {
        if (!err) {
            return ctx.reply(`Expense Card was created!\nDate: ${helper.formatDate(state[ctx.from.id].date)}, amount: ${amount}, description: ${state[ctx.from.id].description}`)
                .then(ctx.scene.enter('mainMenu'));
        } else {
            return ctx.reply('Error: ' + err.message);
        }
    });
});
newExpenseCard.on('message', async (ctx) => {
    return ctx.reply(`Enter number for amount:`);
});

//newIncome scene
newIncome.enter( async (ctx) => {
    return ctx.reply(`Enter balance:`);
});
newIncome.hears(/^\d*([.,]\d*)?$/, async (ctx) => {
    let balance = parseFloat(ctx.message.text.replace(/,/, '.')).toFixed(2);
    let query = `SELECT Id, Balance__c, SpentAmount__c, MonthDate__c, Keeper__c, Reminder__c
                    FROM MonthlyExpense__c WHERE Keeper__c = '${state[ctx.from.id].contactId}'
                    AND CALENDAR_YEAR(MonthDate__c) = ${state[ctx.from.id].date.getFullYear()} 
                    AND CALENDAR_MONTH(MonthDate__c) = ${state[ctx.from.id].date.getMonth()+1} ORDER BY MonthDate__c ASC`;
    conectOrgSF.query({ query: query }, async (err, resp) => {
        let listMonthlyExpenses = JSON.parse(JSON.stringify(resp.records));
        if (listMonthlyExpenses.length == 0) {
            let monthlyExpense = nforce.createSObject('MonthlyExpense__c',{
                name: helper.formatDate(state[ctx.from.id].date) + '_' + state[ctx.from.id].name,
                balance__c: balance,
                monthDate__c: state[ctx.from.id].date,
                keeper__c: state[ctx.from.id].contactId
            });
            conectOrgSF.insert({sobject: monthlyExpense}, async function (err, resp) {
                if (!err) {
                    return ctx.reply(`Income was created!\nDate: ${helper.formatDate(state[ctx.from.id].date)}, balance: ${balance}`)
                        .then(ctx.scene.enter('mainMenu'));
                } else {
                    return ctx.reply('Error: ' + err.message);
                }
            });
        } else {
            let newBalance = listMonthlyExpenses[0].balance__c + (+balance); //+before string parse to number
            let monthlyExpense = nforce.createSObject('MonthlyExpense__c',{
                id: listMonthlyExpenses[0].id,
                name: listMonthlyExpenses[0].name,
                balance__c: newBalance,
                monthDate__c: listMonthlyExpenses[0].monthDate__c,
                keeper__c: listMonthlyExpenses[0].keeper__c
            });
            conectOrgSF.update({sobject: monthlyExpense}, async function (err, resp) {
                if (!err) {
                    return ctx.reply(`Income was updated!\nBalance: ${newBalance}`)
                        .then(ctx.scene.enter('mainMenu'));
                } else {
                    return ctx.reply('Error: ' + err.message);
                }
            });
        }
    });
});
newIncome.on('message', async (ctx) => {
    return ctx.reply(`Enter number for balance:`);
});

// Create scene manager
stage.register(userLogin);
stage.register(userPassword);
stage.register(mainMenu);
stage.register(subMenu);
stage.register(expenseCardDesc);
stage.register(newExpenseCard);
stage.register(newIncome);

stage.command('start', async (ctx) => {
    leave();
    return ctx.reply(`Welcome, ${ctx.from.first_name}`)
        .then(() => ctx.scene.enter('userLogin'));
});

stage.command('exit', async (ctx) => {
    return ctx.reply(`Good bay, ${ctx.from.first_name}`)
        .then(() => leave());
});

//bot
bot.telegram.setWebhook(`${config.heroku.URL}bot${config.bot.TOKEN}`);
bot.startWebhook(`/bot${config.bot.TOKEN}`, null, port);
bot.use(session());
bot.use(stage.middleware());
bot.start(async (ctx) => {
    return ctx.reply(`Welcome, ${ctx.from.first_name}`)
        .then(() => ctx.scene.enter('userLogin'));
});
bot.command('exit', async (ctx) => {
    return ctx.reply(`Good bay, ${ctx.from.first_name}`)
        .then(() => leave());
});
bot.catch((err, ctx) => {
    console.log(`Ooops, ecountered an error for ${ctx.updateType}`, err)
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