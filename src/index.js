const helper = require('./helper');
const config = require('./config');
const Telegraf = require('telegraf');
const server = require('./server');

// const bot = new Telegraf(config.TOKEN);
const bot = new Telegraf('971500404:AAFNDLpv3OjhngQPNgJJkR2nALaw2LVWXNg');
bot.start((ctx) => ctx.reply('Welcome'));
bot.help((ctx) => ctx.reply('Send me a sticker'));
bot.on('sticker', (ctx) => ctx.reply('👍'));
bot.hears('hi', (ctx) => ctx.reply('Hey there'));
bot.launch();