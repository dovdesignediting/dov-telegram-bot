const {
  getGroupData,
  saveGroupData,
  sendFormattedMessage,
  requireAdmin,
  getTarget
} = require('./utils');

const CREATOR_ID = 1773089386;
const isCreator = (ctx) => Number(ctx.from?.id) === CREATOR_ID;
const creatorDevWait = {};

// ניקוי אוטומטי של טקסט החוקים מפקודות /setrules כפולות, תווי כיוון נסתרים וכותרות כפולות
function cleanRulesText(raw) {
  let txt = String(raw || '').trim();
  txt = txt.replace(/^[\s\u200B-\u200F\u202A-\u202E\u2060-\u206F]+/, '');
  while (/^\/setrules(@\S+)?(\s|$)/i.test(txt)) {
    txt = txt.replace(/^\/setrules(@\S+)?\s*/i, '').trim();
    txt = txt.replace(/^[\s\u200B-\u200F\u202A-\u202E\u2060-\u206F]+/, '');
  }
  txt = txt.replace(/^📜\s*\*?חוקי הקבוצה[^:\n]*:\*?\s*/i, '').trim();
  while (/^\/setrules(@\S+)?(\s|$)/i.test(txt)) {
    txt = txt.replace(/^\/setrules(@\S+)?\s*/i, '').trim();
  }
  return txt;
}

async function isGroupAdminCb(ctx) {
  if (!ctx.chat || ctx.chat.type === 'private' || !ctx.from) return false;
  try {
    const m = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
    return Boolean(m && ['creator', 'administrator'].includes(m.status));
  } catch (e) {
    return false;
  }
}

async function loadDevBoard() {
  const s = await getGroupData('owner_global');
  s.devBoard = s.devBoard || { inDev: [], inFix: [] };
  s.devBoard.inDev = Array.isArray(s.devBoard.inDev) ? s.devBoard.inDev : [];
  s.devBoard.inFix = Array.isArray(s.devBoard.inFix) ? s.devBoard.inFix : [];
  return { s, board: s.devBoard };
}

function buildDevBoardView(board, creatorViewer) {
  const devList = board.inDev.length
    ? board.inDev.map((item, i) => `${i + 1}. 🚀 ${item}`).join('\n')
    : '• אין כרגע פקודות חדשות ברשימת הפיתוח.';
  const fixList = board.inFix.length
    ? board.inFix.map((item, i) => `${i + 1}. 🔧 ${item}`).join('\n')
    : '• אין כרגע פקודות בתיקונים – כל המערכות פועלות תקין! ✅';

  const text =
    `🛠️ *לוח מצב פיתוח ותיקונים – וולטיק מוד*\n\n` +
    `🚀 *פקודות ומערכות בפיתוח כרגע (${board.inDev.length}):*\n${devList}\n\n` +
    `🔧 *פקודות ומערכות בתיקונים/שדרוג (${board.inFix.length}):*\n${fixList}` +
    (creatorViewer
      ? `\n\n👑 *פאנל עריכה ליוצר הבוט:*\nלחץ על הכפתורים למטה כדי להוסיף או להסיר פקודות מרשימת הפיתוח והתיקונים:`
      : `\n\n💡 יש לכם רעיון לפקודה או מצאתם באג? לחצו על "💡 הצעה לשיפור" או "❓ שאלה ליוצר" בתפריט הראשי!`);

  const rows = [];
  if (creatorViewer) {
    rows.push([
      { text: '➕ הוסף לפיתוח 🚀', callback_data: 'devb_add_dev' },
      { text: '➕ הוסף לתיקונים 🔧', callback_data: 'devb_add_fix' }
    ]);
    board.inDev.forEach((item, idx) => {
      const shortTxt = item.length > 18 ? `${item.slice(0, 18)}…` : item;
      rows.push([{ text: `🗑️ הסר מפיתוח #${idx + 1}: ${shortTxt}`, callback_data: `devb_del_dev_${idx}` }]);
    });
    board.inFix.forEach((item, idx) => {
      const shortTxt = item.length > 18 ? `${item.slice(0, 18)}…` : item;
      rows.push([{ text: `🗑️ הסר מתיקונים #${idx + 1}: ${shortTxt}`, callback_data: `devb_del_fix_${idx}` }]);
    });
    if (board.inDev.length || board.inFix.length) {
      rows.push([{ text: '🧹 נקה את כל הלוח', callback_data: 'devb_clear_all' }]);
    }
    rows.push([{ text: '👑 חזרה לפאנל היוצר', callback_data: 'own_panel' }]);
  }
  rows.push([{ text: '🔙 חזרה לתפריט הראשי', callback_data: 'help_main' }]);

  return { text, reply_markup: { inline_keyboard: rows } };
}

module.exports = function registerInfoCommands(bot) {
  // הזרקת כפתור "🛠️ מה בפיתוח ובתיקונים" לתפריט הראשי ולפאנל /owner + ניקוי /setrules מחוקי הקבוצה
  if (bot && bot.telegram && !bot.telegram._rulesCleanWrapped) {
    bot.telegram._rulesCleanWrapped = true;
    const origCall = bot.telegram.callApi.bind(bot.telegram);
    bot.telegram.callApi = async function (method, payload, ...rest) {
      try {
        if ((method === 'sendMessage' || method === 'editMessageText') && payload && typeof payload.text === 'string') {
          if (payload.text.includes('חוקי הקבוצה') && /\/setrules(@\S+)?/i.test(payload.text)) {
            payload.text = payload.text.replace(/\/setrules(@\S+)?\s*/gi, '');
          }
          const kb = payload.reply_markup?.inline_keyboard;
          if (Array.isArray(kb)) {
            const hasDevBtn = kb.some((r) => r.some((b) => b.callback_data === 'devboard_open'));
            if (!hasDevBtn && payload.text.includes('תפריט הפקודות הראשי')) {
              kb.splice(kb.length - 1, 0, [{ text: '🛠️ מה בפיתוח ובתיקונים', callback_data: 'devboard_open' }]);
            }
            if (!hasDevBtn && payload.text.startsWith('👑 פאנל שליטה ראשי – יוצר הבוט')) {
              kb.unshift([{ text: '🛠️ ניהול פקודות בפיתוח ובתיקונים', callback_data: 'devboard_open' }]);
            }
          }
        }
      } catch (e) {}
      return origCall(method, payload, ...rest);
    };
  }

  // קליטת טקסט מיוצר הבוט אחרי לחיצה על "➕ הוסף לפיתוח" או "➕ הוסף לתיקונים"
  bot.use(async (ctx, next) => {
    if (isCreator(ctx) && ctx.message?.text) {
      const waitMode = creatorDevWait[String(ctx.from.id)];
      const txt = ctx.message.text.trim();
      if (waitMode && txt.startsWith('/')) {
        delete creatorDevWait[String(ctx.from.id)];
      } else if (waitMode && txt) {
        delete creatorDevWait[String(ctx.from.id)];
        const { s, board } = await loadDevBoard();
        if (waitMode === 'dev') board.inDev.push(txt);
        else board.inFix.push(txt);
        await saveGroupData('owner_global', s);
        const view = buildDevBoardView(board, true);
        return await ctx.reply(
          `✅ נוסף בהצלחה לרשימת *${waitMode === 'dev' ? 'בפיתוח 🚀' : 'בתיקונים 🔧'}*!\n\n${view.text}`,
          { parse_mode: 'Markdown', reply_markup: view.reply_markup }
        );
      }
    }
    return next();
  });

  // פקודות וכפתורים ללוח פיתוח ותיקונים (/dev, /status, /roadmap)
  bot.command(['dev', 'status', 'roadmap', 'in_dev'], async (ctx) => {
    const { board } = await loadDevBoard();
    const view = buildDevBoardView(board, isCreator(ctx));
    await ctx.reply(view.text, { parse_mode: 'Markdown', reply_markup: view.reply_markup });
  });

  bot.command('add_dev', async (ctx) => {
    if (!isCreator(ctx)) return;
    const item = (ctx.message.text || '').replace(/^\/add_dev(@\S+)?\s*/i, '').trim();
    if (!item) return ctx.reply('שימוש ליוצר: `/add_dev [שם הפקודה או הפיצ׳ר שבפיתוח]`', { parse_mode: 'Markdown' });
    const { s, board } = await loadDevBoard();
    board.inDev.push(item);
    await saveGroupData('owner_global', s);
    const view = buildDevBoardView(board, true);
    await ctx.reply(`🚀 נוסף לרשימת הפיתוח!\n\n${view.text}`, { parse_mode: 'Markdown', reply_markup: view.reply_markup });
  });

  bot.command('add_fix', async (ctx) => {
    if (!isCreator(ctx)) return;
    const item = (ctx.message.text || '').replace(/^\/add_fix(@\S+)?\s*/i, '').trim();
    if (!item) return ctx.reply('שימוש ליוצר: `/add_fix [שם הפקודה או התקלה שבתיקונים]`', { parse_mode: 'Markdown' });
    const { s, board } = await loadDevBoard();
    board.inFix.push(item);
    await saveGroupData('owner_global', s);
    const view = buildDevBoardView(board, true);
    await ctx.reply(`🔧 נוסף לרשימת התיקונים!\n\n${view.text}`, { parse_mode: 'Markdown', reply_markup: view.reply_markup });
  });

  bot.command('del_dev', async (ctx) => {
    if (!isCreator(ctx)) return;
    const idx = parseInt(((ctx.message.text || '').trim().split(/\s+/)[1] || ''), 10) - 1;
    const { s, board } = await loadDevBoard();
    if (isNaN(idx) || idx < 0 || idx >= board.inDev.length) {
      return ctx.reply('⚠️ ציין מספר תקין להסרה מרשימת הפיתוח, למשל: `/del_dev 1`', { parse_mode: 'Markdown' });
    }
    const removed = board.inDev.splice(idx, 1)[0];
    await saveGroupData('owner_global', s);
    await ctx.reply(`🗑️ הוסר מרשימת הפיתוח: *"${removed}"*`, { parse_mode: 'Markdown' });
  });

  bot.command('del_fix', async (ctx) => {
    if (!isCreator(ctx)) return;
    const idx = parseInt(((ctx.message.text || '').trim().split(/\s+/)[1] || ''), 10) - 1;
    const { s, board } = await loadDevBoard();
    if (isNaN(idx) || idx < 0 || idx >= board.inFix.length) {
      return ctx.reply('⚠️ ציין מספר תקין להסרה מרשימת התיקונים, למשל: `/del_fix 1`', { parse_mode: 'Markdown' });
    }
    const removed = board.inFix.splice(idx, 1)[0];
    await saveGroupData('owner_global', s);
    await ctx.reply(`🗑️ הוסר מרשימת התיקונים: *"${removed}"*`, { parse_mode: 'Markdown' });
  });

  bot.action('devboard_open', async (ctx) => {
    delete creatorDevWait[String(ctx.from?.id)];
    await ctx.answerCbQuery().catch(() => {});
    const { board } = await loadDevBoard();
    const view = buildDevBoardView(board, isCreator(ctx));
    await ctx.editMessageText(view.text, { parse_mode: 'Markdown', reply_markup: view.reply_markup })
      .catch(() => ctx.reply(view.text, { parse_mode: 'Markdown', reply_markup: view.reply_markup }));
  });

  bot.action(/^devb_add_(dev|fix)$/, async (ctx) => {
    if (!isCreator(ctx)) return ctx.answerCbQuery('⛔ ליוצר הבוט בלבד!', { show_alert: true }).catch(() => {});
    const type = ctx.match[1];
    creatorDevWait[String(ctx.from.id)] = type;
    await ctx.answerCbQuery().catch(() => {});
    const promptTxt = type === 'dev'
      ? '🚀 *הוספת פקודה/מערכת לרשימת הפיתוח*\n\nכתוב עכשיו בהודעה את שם הפקודה והתיאור הקצר (למשל: `/ lottery - הגרלת כרטיסים אוטומטית`):'
      : '🔧 *הוספת פקודה/מערכת לרשימת התיקונים*\n\nכתוב עכשיו בהודעה איזו פקודה נמצאת בתיקון או שדרוג (למשל: `/setrules - שדרוג מצב שקט ופומבי`):';
    await ctx.editMessageText(promptTxt, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '❌ ביטול וחזרה ללוח', callback_data: 'devboard_open' }]] }
    }).catch(() => {});
  });

  bot.action(/^devb_del_(dev|fix)_(\d+)$/, async (ctx) => {
    if (!isCreator(ctx)) return ctx.answerCbQuery('⛔ ליוצר הבוט בלבד!', { show_alert: true }).catch(() => {});
    const type = ctx.match[1];
    const idx = parseInt(ctx.match[2], 10);
    const { s, board } = await loadDevBoard();
    const arr = type === 'dev' ? board.inDev : board.inFix;
    if (idx < 0 || idx >= arr.length) return ctx.answerCbQuery('כבר הוסר').catch(() => {});
    const removed = arr.splice(idx, 1)[0];
    await saveGroupData('owner_global', s);
    await ctx.answerCbQuery(`🗑️ הוסר: ${removed.slice(0, 25)}`).catch(() => {});
    const view = buildDevBoardView(board, true);
    await ctx.editMessageText(view.text, { parse_mode: 'Markdown', reply_markup: view.reply_markup }).catch(() => {});
  });

  bot.action('devb_clear_all', async (ctx) => {
    if (!isCreator(ctx)) return ctx.answerCbQuery('⛔ ליוצר הבוט בלבד!', { show_alert: true }).catch(() => {});
    const { s, board } = await loadDevBoard();
    board.inDev = [];
    board.inFix = [];
    await saveGroupData('owner_global', s);
    await ctx.answerCbQuery('🧹 הלוח נוקה!').catch(() => {});
    const view = buildDevBoardView(board, true);
    await ctx.editMessageText(view.text, { parse_mode: 'Markdown', reply_markup: view.reply_markup }).catch(() => {});
  });

  // 24. /rules + /setrules - הצגת והגדרת חוקי הקבוצה (במצב שקט או פומבי + מחיקה אוטומטית של הודעות ההגדרה)
  bot.command('rules', async (ctx) => {
    if (!ctx.chat || ctx.chat.type === 'private') {
      return ctx.reply('⚠️ פקודה זו פועלת בקבוצות בלבד.');
    }
    try {
      const data = await getGroupData(ctx.chat.id);
      const cleaned = cleanRulesText(data.rules);
      if (cleaned !== data.rules) {
        data.rules = cleaned;
        await saveGroupData(ctx.chat.id, data);
      }

      const mode = data.rulesMode || 'public';
      const botUsername = ctx.botInfo?.username || (await ctx.telegram.getMe()).username;
      const rulesUrl = `https://t.me/${botUsername}?start=rules_${ctx.chat.id}`;
      const btnText = data.rulesButtonText || '📖 לחץ כאן לצפייה בחוקי הקבוצה';

      if (mode === 'silent') {
        await ctx.deleteMessage().catch(() => {});
        return await ctx.reply('📜 *חוקי הקבוצה זמינים לקריאה בפרטי:*', {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: btnText, url: rulesUrl }]]
          }
        });
      }

      await sendFormattedMessage(ctx, `📜 *חוקי הקבוצה:*\n\n${cleaned}`, {
        name: ctx.from?.first_name || 'חבר'
      });
    } catch (err) {
      await ctx.reply('❌ שגיאה בהצגת חוקי הקבוצה. לעזרה: /help');
    }
  });

  bot.command('setrules', async (ctx) => {
    if (!(await requireAdmin(ctx, '/setrules [טקסט החוקים + כפתורים]'))) return;
    try {
      const adminMsgId = ctx.message?.message_id;
      const replyMsg = ctx.message?.reply_to_message;
      let rawInput = (ctx.message?.text || '').replace(/^[\s\u200B-\u200F]*\/setrules(@\S+)?\s*/i, '');
      if (!rawInput.trim() && replyMsg && (replyMsg.text || replyMsg.caption)) {
        rawInput = replyMsg.text || replyMsg.caption;
      }

      // בדיקה אם המנהל ציין מראש "שקט" או "פומבי" בתחילת הפקודה
      let explicitMode = null;
      if (/^(שקט|silent)(\s+|\n|$)/i.test(rawInput.trim())) {
        explicitMode = 'silent';
        rawInput = rawInput.trim().replace(/^(שקט|silent)\s*/i, '');
      } else if (/^(פומבי|public)(\s+|\n|$)/i.test(rawInput.trim())) {
        explicitMode = 'public';
        rawInput = rawInput.trim().replace(/^(פומבי|public)\s*/i, '');
      }

      const text = cleanRulesText(rawInput);
      if (!text) {
        return ctx.reply(
          '⚠️ *שימוש בפקודה /setrules:*\n' +
          '`/setrules *חוקי הקבוצה:*\n1. שיח מכבד\n{{לערוץ הראשי}{https://t.me/telegram}}`\n\n' +
          '💡 הבוט ימחק מיד את הודעת ההגדרה ויאפשר לך לבחור בין *מצב שקט* ל*מצב פומבי*.',
          { parse_mode: 'Markdown' }
        );
      }

      // בדיקת תקינות העיצוב ושליחת הודעת בדיקה זמנית שנמחקת מיד
      const preview = await sendFormattedMessage(ctx, text, { name: ctx.from.first_name || 'חבר' });
      if (!preview) return;

      // 1. מחיקה מיידית של הודעת המגדיר ושל הודעת החוקים של הבוט מהקבוצה!
      if (adminMsgId) {
        await ctx.telegram.deleteMessage(ctx.chat.id, adminMsgId).catch(() => {});
      }
      if (preview && preview.message_id) {
        await ctx.telegram.deleteMessage(ctx.chat.id, preview.message_id).catch(() => {});
      }

      const data = await getGroupData(ctx.chat.id);
      data.rules = text;
      data.groupTitle = ctx.chat.title || data.groupTitle || '';
      if (explicitMode) data.rulesMode = explicitMode;
      await saveGroupData(ctx.chat.id, data);

      if (explicitMode === 'silent') {
        const tempMsg = await ctx.reply('🤫 חוקי הקבוצה הוגדרו ונשמרו באופן שקט.');
        setTimeout(() => {
          ctx.telegram.deleteMessage(ctx.chat.id, tempMsg.message_id).catch(() => {});
        }, 3000);
        return;
      }

      if (explicitMode === 'public') {
        const botUsername = ctx.botInfo?.username || (await ctx.telegram.getMe()).username;
        const rulesUrl = `https://t.me/${botUsername}?start=rules_${ctx.chat.id}`;
        const btnText = data.rulesButtonText || '📖 לחץ כאן לצפייה בחוקי הקבוצה';
        return await ctx.reply('📢 *חוקי הקבוצה עודכנו!* לחצו על הכפתור למטה לקריאת החוקים:', {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: btnText, url: rulesUrl }]] }
        });
      }

      // 2. שליחת כפתורי בחירה למנהל: הגדרת החוקים באופן שקט או פומבי
      await ctx.reply(
        '✅ *חוקי הקבוצה נשמרו והודעות הטקסט נמחקו מהצ׳אט!*\n\n' +
        'איך תרצה להגדיר את חוקי הקבוצה כעת?',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🤫 באופן שקט', callback_data: 'setrules_mode_silent' },
                { text: '📢 באופן פומבי', callback_data: 'setrules_mode_public' }
              ]
            ]
          }
        }
      );
    } catch (err) {
      await ctx.reply('❌ שגיאה בעדכון חוקי הקבוצה. לעזרה: /help');
    }
  });

  bot.action(/^setrules_mode_(silent|public)$/, async (ctx) => {
    if (!(await isGroupAdminCb(ctx))) {
      return ctx.answerCbQuery('⛔ פעולה זו מיועדת למנהלי הקבוצה בלבד!', { show_alert: true }).catch(() => {});
    }
    const mode = ctx.match[1];
    const data = await getGroupData(ctx.chat.id);
    data.rulesMode = mode;
    data.rules = cleanRulesText(data.rules);
    await saveGroupData(ctx.chat.id, data);

    if (mode === 'silent') {
      await ctx.answerCbQuery('🤫 חוקי הקבוצה הוגדרו באופן שקט!').catch(() => {});
      await ctx.deleteMessage().catch(() => {});
      return;
    }

    await ctx.answerCbQuery('📢 חוקי הקבוצה הוגדרו באופן פומבי!').catch(() => {});
    const botUsername = ctx.botInfo?.username || (await ctx.telegram.getMe()).username;
    const rulesUrl = `https://t.me/${botUsername}?start=rules_${ctx.chat.id}`;
    const btnText = data.rulesButtonText || '📖 לחץ כאן לצפייה בחוקי הקבוצה';
    await ctx.editMessageText(
      '📢 *חוקי הקבוצה עודכנו והוגדרו באופן פומבי!*\nלצפייה בחוקי הקבוצה לחצו על הכפתור למטה או שלחו `/rules`:',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: btnText, url: rulesUrl }]]
        }
      }
    ).catch(() => {});
  });

  // פקודות מותאמות אישית לקבוצה (/addcmd, /delcmd, /cmds) עם תמיכה בעיצוב וכפתורים
  bot.command('addcmd', async (ctx) => {
    if (!(await requireAdmin(ctx, '/addcmd [שם פקודה] [תוכן מעוצב + כפתורים]'))) return;
    try {
      const raw = (ctx.message.text || '').replace(/^\/addcmd(@\S+)?\s*/i, '');
      const firstSpace = raw.search(/\s/);
      if (firstSpace === -1) {
        return ctx.reply(
          '⚠️ שימוש: `/addcmd שם_פקודה תוכן ההודעה המעוצבת`\nלדוגמה:\n`/addcmd site *האתר שלנו:*\n{{כניסה לאתר}{https://google.com}}`',
          { parse_mode: 'Markdown' }
        );
      }
      const cmdName = raw.slice(0, firstSpace).replace(/^\//, '').toLowerCase();
      const cmdContent = raw.slice(firstSpace + 1).trim();
      const preview = await sendFormattedMessage(ctx, cmdContent, { name: ctx.from.first_name || 'חבר' });
      if (!preview) return;

      const data = await getGroupData(ctx.chat.id);
      data.customCommands = data.customCommands || {};
      data.customCommands[cmdName] = cmdContent;
      await saveGroupData(ctx.chat.id, data);
      await ctx.reply(`✅ הפקודה המותאמת \`/${cmdName}\` נשמרה! (מעל מופיעה תצוגה מקדימה)`, { parse_mode: 'Markdown' });
    } catch (err) {
      await ctx.reply('❌ שגיאה בשמירת פקודה מותאמת אישית.');
    }
  });

  bot.command('delcmd', async (ctx) => {
    if (!(await requireAdmin(ctx, '/delcmd [שם פקודה]'))) return;
    const cmdName = ((ctx.message.text || '').trim().split(/\s+/)[1] || '').replace(/^\//, '').toLowerCase();
    if (!cmdName) return ctx.reply('⚠️ שימוש: `/delcmd [שם פקודה]`', { parse_mode: 'Markdown' });
    const data = await getGroupData(ctx.chat.id);
    if (!data.customCommands || !data.customCommands[cmdName]) {
      return ctx.reply(`⚠️ הפקודה \`/${cmdName}\` לא קיימת בקבוצה.`, { parse_mode: 'Markdown' });
    }
    delete data.customCommands[cmdName];
    await saveGroupData(ctx.chat.id, data);
    await ctx.reply(`🗑️ הפקודה המותאמת \`/${cmdName}\` נמחקה.`, { parse_mode: 'Markdown' });
  });

  bot.command('cmds', async (ctx) => {
    if (!ctx.chat || ctx.chat.type === 'private') return ctx.reply('⚠️ פקודה זו פועלת בקבוצות בלבד.');
    const data = await getGroupData(ctx.chat.id);
    const keys = Object.keys(data.customCommands || {});
    if (!keys.length) return ctx.reply('📋 אין כרגע פקודות מותאמות אישית בקבוצה. להוספה: `/addcmd`', { parse_mode: 'Markdown' });
    await ctx.reply(`📌 *פקודות מותאמות אישית בקבוצה:*\n• /${keys.join('\n• /')}`, { parse_mode: 'Markdown' });
  });

  // 25. /admins - תיוג והצגת כל האדמינים בקבוצה
  bot.command('admins', async (ctx) => {
    if (!(await requireAdmin(ctx, '/admins'))) return;
    try {
      const admins = await ctx.telegram.getChatAdministrators(ctx.chat.id);
      const list = admins
        .filter((a) => !a.user.is_bot)
        .map((a) => `${a.status === 'creator' ? '👑 בעלים' : '🛡️ אדמין'}: ${a.user.username ? `@${a.user.username}` : a.user.first_name}`);
      await ctx.reply(`👥 *צוות הניהול של הקבוצה (${list.length}):*\n${list.join('\n')}`);
    } catch (err) {
      await ctx.reply(`❌ שגיאה בשליפת רשימת האדמינים. לעזרה: /help`);
    }
  });

  // 26. /id או /userinfo - מידע על משתמש
  bot.command(['id', 'userinfo'], async (ctx) => {
    if (!(await requireAdmin(ctx, '/userinfo [בהשבה להודעה או ללא פרמטר]'))) return;
    try {
      const target = getTarget(ctx) || {
        id: ctx.from.id,
        name: ctx.from.first_name || 'משתמש',
        username: ctx.from.username ? `@${ctx.from.username}` : 'ללא'
      };
      const member = await ctx.telegram.getChatMember(ctx.chat.id, target.id).catch(() => ({ status: 'לא ידוע' }));
      const data = await getGroupData(ctx.chat.id);
      const warns = (data.warns[target.id] || []).length;
      await ctx.reply(
        `👤 *מידע על משתמש:*\n• שם: ${target.name}\n• מזהה: \`${target.id}\`\n• מעמד: ${member.status}\n• אזהרות: ${warns}/3\n• מזהה קבוצה: \`${ctx.chat.id}\``,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      await ctx.reply('❌ שגיאה בשליפת פרטי משתמש. לעזרה: /help');
    }
  });

  // 27. /stats - סטטיסטיקות קבוצה
  bot.command('stats', async (ctx) => {
    if (!(await requireAdmin(ctx, '/stats'))) return;
    try {
      const count = await ctx.telegram.getChatMembersCount(ctx.chat.id);
      const data = await getGroupData(ctx.chat.id);
      await ctx.reply(
        `📊 *סטטיסטיקות קבוצה:*\n• חברים: ${count}\n• הודעות שנוטרו: ${data.stats.messages || 0}\n• אזהרות: ${data.stats.warnsCount || 0}\n• חסימות: ${data.stats.bans || 0}\n• פילטרים: ${data.filters.length}`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      await ctx.reply(`❌ שגיאה בשליפת סטטיסטיקות. לעזרה: /help`);
    }
  });
};
