const { getGroupData, saveGroupData, requireAdmin } = require('./utils');

module.exports = function registerContentCommands(bot) {
  // 11. /del או /purge [מספר] - מחיקת הודעות
  bot.command(['del', 'purge'], async (ctx) => {
    if (!(await requireAdmin(ctx, '/del (בהשבה) או /purge [1-20]'))) return;
    try {
      const args = (ctx.message.text || '').trim().split(/\s+/).slice(1);
      const replyMsg = ctx.message.reply_to_message;

      if (replyMsg && !args[0]) {
        await ctx.telegram.deleteMessage(ctx.chat.id, replyMsg.message_id);
        await ctx.deleteMessage().catch(() => {});
        return;
      }

      const count = Math.min(Math.max(parseInt(args[0] || '1', 10), 1), 20);
      if (isNaN(count)) {
        return ctx.reply('⚠️ שימוש: השב להודעה עם `/del` או כתוב `/purge 5` (עד 20 הודעות אחרונות).\nלעזרה: /help', { parse_mode: 'Markdown' });
      }

      const currentId = ctx.message.message_id;
      let deleted = 0;
      for (let i = 0; i <= count; i++) {
        try {
          await ctx.telegram.deleteMessage(ctx.chat.id, currentId - i);
          deleted++;
        } catch (e) {}
      }
      const confirm = await ctx.reply(`🗑️ נמחקו ${Math.max(1, deleted - 1)} הודעות אחרונות.`);
      setTimeout(() => {
        ctx.telegram.deleteMessage(ctx.chat.id, confirm.message_id).catch(() => {});
      }, 3000);
    } catch (err) {
      await ctx.reply(`❌ המחיקה נכשלה: ${err.description || err.message}. לעזרה: /help`);
    }
  });

  // 12. /pin - נעיצת הודעה
  bot.command('pin', async (ctx) => {
    if (!(await requireAdmin(ctx, '/pin [בהשבה להודעה]'))) return;
    try {
      const replyMsg = ctx.message.reply_to_message;
      if (!replyMsg) return ctx.reply('⚠️ שימוש: השב להודעה שברצונך לנעוץ וכתוב `/pin`.\nלעזרה: /help', { parse_mode: 'Markdown' });
      await ctx.telegram.pinChatMessage(ctx.chat.id, replyMsg.message_id);
      await ctx.reply('📌 ההודעה ננעצה בהצלחה בראש הקבוצה.');
    } catch (err) {
      await ctx.reply(`❌ הנעיצה נכשלה: ${err.description || err.message}. לעזרה: /help`);
    }
  });

  // 13. /unpin - הסרת נעיצה
  bot.command('unpin', async (ctx) => {
    if (!(await requireAdmin(ctx, '/unpin [בהשבה להודעה או ללא פרמטר]'))) return;
    try {
      const replyMsg = ctx.message.reply_to_message;
      if (replyMsg) {
        await ctx.telegram.unpinChatMessage(ctx.chat.id, replyMsg.message_id);
      } else {
        await ctx.telegram.unpinChatMessage(ctx.chat.id);
      }
      await ctx.reply('📍 הנעיצה הוסרה בהצלחה.');
    } catch (err) {
      await ctx.reply(`❌ הסרת הנעיצה נכשלה: ${err.description || err.message}. לעזרה: /help`);
    }
  });

  // 14. /unpinall - הסרת כל ההודעות הנעוצות
  bot.command('unpinall', async (ctx) => {
    if (!(await requireAdmin(ctx, '/unpinall'))) return;
    try {
      await ctx.telegram.unpinAllChatMessages(ctx.chat.id);
      await ctx.reply('🧹 כל ההודעות הנעוצות בקבוצה הוסרו בהצלחה.');
    } catch (err) {
      await ctx.reply(`❌ הפעולה נכשלה: ${err.description || err.message}. לעזרה: /help`);
    }
  });

  // 15. /slowmode [שניות] - הגדרת מצב איטי בקבוצה
  bot.command('slowmode', async (ctx) => {
    if (!(await requireAdmin(ctx, '/slowmode [0 / 10 / 30 / 60 / 300]'))) return;
    try {
      const arg = (ctx.message.text || '').trim().split(/\s+/)[1];
      const allowed = [0, 10, 30, 60, 300, 900, 3600];
      const seconds = parseInt(arg, 10);
      if (isNaN(seconds) || !allowed.includes(seconds)) {
        return ctx.reply('⚠️ שימוש: `/slowmode [שניות]`\nערכים נתמכים בטלגרם: `0` (כיבוי), `10`, `30`, `60`, `300`, `900`, `3600`.\nלעזרה: /help', { parse_mode: 'Markdown' });
      }
      await ctx.telegram.callApi('setChatSlowModeDelay', {
        chat_id: ctx.chat.id,
        slow_mode_delay: seconds
      });
      await ctx.reply(seconds === 0 ? '⚡ מצב איטי כובה.' : `🐢 מצב איטי הופעל: הודעה אחת כל ${seconds} שניות.`);
    } catch (err) {
      await ctx.reply(`❌ הגדרת מצב איטי נכשלה (דורש Supergroup והרשאות ניהול): ${err.description || err.message}. לעזרה: /help`);
    }
  });

  // 16. /lock [סוג] - נעילת סוג תוכן (links, media, stickers, all)
  bot.command('lock', async (ctx) => {
    if (!(await requireAdmin(ctx, '/lock [links | media | stickers | all]'))) return;
    try {
      const type = ((ctx.message.text || '').trim().split(/\s+/)[1] || '').toLowerCase();
      const valid = ['links', 'media', 'stickers', 'all'];
      if (!valid.includes(type)) {
        return ctx.reply('⚠️ שימוש: `/lock [סוג]`\nסוגים זמינים: `links` (קישורים), `media` (תמונות/וידאו), `stickers` (סטיקרים), `all` (הכל).\nלעזרה: /help', { parse_mode: 'Markdown' });
      }
      const data = await getGroupData(ctx.chat.id);
      if (type === 'all') {
        data.locks = { links: true, media: true, stickers: true };
      } else {
        data.locks[type] = true;
      }
      await saveGroupData(ctx.chat.id, data);
      await ctx.reply(`🔒 נעילת תוכן הופעלה עבור: *${type}*`, { parse_mode: 'Markdown' });
    } catch (err) {
      await ctx.reply(`❌ הנעילה נכשלה. לעזרה: /help`);
    }
  });

  // 17. /unlock [סוג] - פתיחת נעילה
  bot.command('unlock', async (ctx) => {
    if (!(await requireAdmin(ctx, '/unlock [links | media | stickers | all]'))) return;
    try {
      const type = ((ctx.message.text || '').trim().split(/\s+/)[1] || '').toLowerCase();
      const valid = ['links', 'media', 'stickers', 'all'];
      if (!valid.includes(type)) {
        return ctx.reply('⚠️ שימוש: `/unlock [סוג]`\nסוגים זמינים: `links`, `media`, `stickers`, `all`.\nלעזרה: /help', { parse_mode: 'Markdown' });
      }
      const data = await getGroupData(ctx.chat.id);
      if (type === 'all') {
        data.locks = { links: false, media: false, stickers: false };
      } else {
        data.locks[type] = false;
      }
      await saveGroupData(ctx.chat.id, data);
      await ctx.reply(`🔓 נעילת תוכן בוטלה עבור: *${type}*`, { parse_mode: 'Markdown' });
    } catch (err) {
      await ctx.reply(`❌ פתיחת הנעילה נכשלה. לעזרה: /help`);
    }
  });

  // ניקוי הודעות שירות אוטומטי (/cleanservice on/off או /delservice on/off)
  bot.command(['cleanservice', 'delservice'], async (ctx) => {
    if (!(await requireAdmin(ctx, '/cleanservice [on | off]'))) return;
    try {
      const arg = ((ctx.message.text || '').trim().split(/\s+/)[1] || '').toLowerCase();
      if (!['on', 'off'].includes(arg)) {
        return ctx.reply(
          '⚠️ שימוש: `/cleanservice on` להפעלה או `/cleanservice off` לכיבוי.\n' +
          '(מוחק אוטומטית הודעות הצטרפות, עזיבה, נעיצה ושינויי קבוצה).\nלעזרה: /help',
          { parse_mode: 'Markdown' }
        );
      }
      const data = await getGroupData(ctx.chat.id);
      data.cleanService = arg === 'on';
      await saveGroupData(ctx.chat.id, data);
      await ctx.reply(
        `🧹 ניקוי הודעות שירות אוטומטי כעת: *${data.cleanService ? 'פעיל (ON)' : 'כבוי (OFF)'}*`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      await ctx.reply('❌ שגיאה בעדכון ניקוי הודעות שירות. לעזרה: /help');
    }
  });
};
