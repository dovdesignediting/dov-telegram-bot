const { Telegraf, Scenes, session } = require('telegraf');
const {
  getGroupData,
  sendFormattedMessage,
  sessionStore
} = require('../commands/utils');
const registerUsersCommands = require('../commands/users');
const registerContentCommands = require('../commands/content');
const registerProtectionCommands = require('../commands/protection');
const registerInfoCommands = require('../commands/info');
const registerSystemCommands = require('../commands/system');

const token = process.env.BOT_TOKEN;
const bot = token ? new Telegraf(token) : null;
const CREATOR_ID = 1773089386;

if (bot) {
  // הגדרת אשף הוספת פקודה (Wizard Scene)
  const requestCommandWizard = new Scenes.WizardScene(
    'request_command_wizard',
    // שלב 1: שאלת הפקודה המבוקשת
    async (ctx) => {
      await ctx.reply('איזו מילה או פקודה תרצה שתוסיף? (למשל: /rules)');
      return ctx.wizard.next();
    },
    // שלב 2: קליטת הפקודה ושאלת התשובה המבוקשת
    async (ctx) => {
      const requestedCommand = ctx.message?.text?.trim();
      if (!requestedCommand) {
        await ctx.reply('איזו מילה או פקודה תרצה שתוסיף? (למשל: /rules)');
        return;
      }
      ctx.wizard.state.requestedCommand = requestedCommand;
      await ctx.reply('מה הבוט צריך לענות כשמישהו יכתוב את זה?');
      return ctx.wizard.next();
    },
    // שלב 3: קליטת התשובה, שליחה ליוצר הבוט לאישור ועדכון המשתמש
    async (ctx) => {
      const requestedAnswer = ctx.message?.text?.trim();
      if (!requestedAnswer) {
        await ctx.reply('מה הבוט צריך לענות כשמישהו יכתוב את זה?');
        return;
      }

      const requestedCommand = ctx.wizard.state.requestedCommand;
      const userId = ctx.from.id;
      const userName = ctx.from.first_name || 'משתמש';
      const username = ctx.from.username ? `@${ctx.from.username}` : 'ללא שם משתמש';

      await ctx.telegram.sendMessage(
        CREATOR_ID,
        `📩 בקשה חדשה להוספת פקודה:\n\n` +
        `👤 משתמש: ${userName} (${username})\n` +
        `🆔 User ID: ${userId}\n` +
        `⌨️ פקודה מבוקשת: ${requestedCommand}\n` +
        `💬 תשובה מבוקשת:\n${requestedAnswer}`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ לאשר', callback_data: `reqcmd_approve_${userId}` },
                { text: '❌ לדחות', callback_data: `reqcmd_reject_${userId}` }
              ]
            ]
          }
        }
      );

      await ctx.reply('בקשתך נשלחה לאישור היוצר, נעדכן אותך בקרוב');
      return ctx.scene.leave();
    }
  );

  const stage = new Scenes.Stage([requestCommandWizard]);
  bot.use(session({ store: sessionStore }));
  bot.use(stage.middleware());

  // התחלת האשף בלחיצה על /request_command
  bot.command('request_command', async (ctx) => {
    await ctx.scene.enter('request_command_wizard');
  });

  // טיפול בלחיצה של היוצר על "✅ לאשר"
  bot.action(/^reqcmd_approve_(\d+)$/, async (ctx) => {
    if (Number(ctx.from.id) !== CREATOR_ID) {
      return ctx.answerCbQuery('רק יוצר הבוט יכול לאשר בקשות.', { show_alert: true });
    }
    const targetUserId = ctx.match[1];
    const originalText = ctx.callbackQuery?.message?.text || '';
    await ctx.answerCbQuery('אושר');
    await ctx.editMessageText(`אושר\n\n${originalText}`);
    await ctx.telegram.sendMessage(targetUserId, 'הפקודה אושרה ועובדת!').catch(() => {});
  });

  // טיפול בלחיצה של היוצר על "❌ לדחות"
  bot.action(/^reqcmd_reject_(\d+)$/, async (ctx) => {
    if (Number(ctx.from.id) !== CREATOR_ID) {
      return ctx.answerCbQuery('רק יוצר הבוט יכול לדחות בקשות.', { show_alert: true });
    }
    const targetUserId = ctx.match[1];
    const originalText = ctx.callbackQuery?.message?.text || '';
    await ctx.answerCbQuery('נדחה');
    await ctx.editMessageText(`נדחה\n\n${originalText}`);
    await ctx.telegram.sendMessage(targetUserId, 'הפקודה נדחתה עקב החלטת היוצר').catch(() => {});
  });

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
      'שלח /help כדי לפתוח את תפריט הפקודות המלא, או /request_command להצעת פקודה חדשה.'
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
