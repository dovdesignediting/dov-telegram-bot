const { Telegraf } = require('telegraf');
const { getGroupData, sendFormattedMessage } = require('../commands/utils');
const registerUsersCommands = require('../commands/users');
const registerContentCommands = require('../commands/content');
const registerProtectionCommands = require('../commands/protection');
const registerInfoCommands = require('../commands/info');
const registerSystemCommands = require('../commands/system');

const token = process.env.BOT_TOKEN;
const bot = token ? new Telegraf(token) : null;

if (bot) {
  // פקודת /start: אם המשתמש הגיע מכפתור חוקי הקבוצה (rules_CHATID), מציג לו בפרטי את חוקי אותה קבוצה
  bot.start(async (ctx) => {
    const payload = ctx.startPayload || (ctx.message?.text || '').split(/\s+/)[1] || '';

    if (payload.startsWith('rules_')) {
      const groupChatId = payload.replace('rules_', '');
      const data = await getGroupData(groupChatId);
      const groupTitle = data.groupTitle ? ` (${data.groupTitle})` : '';
      return await sendFormattedMessage(
        ctx,
        `📜 *חוקי הקבוצה${groupTitle}:*\n\n${data.rules}`,
        { name: ctx.from?.first_name || 'חבר' }
      );
    }

    await ctx.reply(
      'שלום! הבוט שלך באוויר ועובד מעולה! 🚀\n' +
      'אני בוט מתקדם לניהול קבוצות עם 30 פקודות ניהול והגנה.\n' +
      'שלח /help כדי לפתוח את תפריט הפקודות המלא.'
    );
  });

  // טעינת כל 5 הקטגוריות בצורה מודולרית
  registerSystemCommands(bot);
  registerUsersCommands(bot);
  registerContentCommands(bot);
  registerInfoCommands(bot);
  registerProtectionCommands(bot);

  // תפיסת שגיאות גלובלית בבוט
  bot.catch((err, ctx) => {
    console.error(`Bot error in update ${ctx.update.update_id}:`, err);
  });
}

module.exports = async (req, res) => {
  try {
    if (!bot) {
      return res.status(500).send('שגיאה: חסר משתנה סביבה BOT_TOKEN ב-Vercel');
    }

    // הגדרת Webhook אוטומטית בגלישה לכתובת עם ?setWebhook=1
    if (req.method === 'GET') {
      if (req.query && req.query.setWebhook === '1') {
        const host = process.env.WEBHOOK_URL || `https://${req.headers.host}/api/bot`;
        await bot.telegram.setWebhook(host);
        return res.status(200).json({
          ok: true,
          message: 'Webhook הוגדר בהצלחה!',
          webhookUrl: host,
        });
      }
      return res.status(200).send('הבוט פעיל ומוכן לקבל הודעות! (30 פקודות ניהול קבוצה טעונות)');
    }

    // טיפול בהודעות שמגיעות מטלגרם דרך ה-Webhook
    if (req.method === 'POST') {
      await bot.handleUpdate(req.body);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).send('Method Not Allowed');
  } catch (error) {
    console.error('Webhook Error:', error);
    return res.status(200).json({ ok: false, error: error.message });
  }
};
