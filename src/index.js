const nforce = require('nforce');
const Telegraf = require('telegraf');
const helper = require('./helper');
const config = require('./config');

//nforce setup to connect Salesforce
const org = nforce.createConnection({
    clientId: config.CONSUMER_KEY,
    clientSecret: config.CONSUMER_SECRECT,
    redirectUri: 'https://stormy-wave-90920.herokuapp.com/',
    environment: "production",
    mode: "single"

});

const bot = new Telegraf(config.TOKEN);
bot.start((ctx) => ctx.reply('Welcome'));
bot.help((ctx) => ctx.reply('Send me a sticker'));
bot.on('sticker', (ctx) => ctx.reply('👍'));
bot.hears('hi', (ctx) => ctx.reply('Hey there'));
bot.launch();