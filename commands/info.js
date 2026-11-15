const {
  getGroupData,
  saveGroupData,
  parseRichMessage,
  sendFormattedMessage,
  requireAdmin,
  getTarget
} = require('./utils');

const CREATOR_ID = 1773089386;
const isCreator = (ctx) => Number(ctx.from?.id) === CREATOR_ID;
const creatorWaitState = {};

// שליחה בטוחה עם תמיכה בעיצוב וכפתורים לשידור לקבוצות
async function safeSendGroupRich(telegram, chatId, rawText) {
  const fixedText = String(rawText || '').replace(/([/@][a-zA-Z0-9_]+)/g, (m) => m.replace(/\\?_/g, '\\_'));
  const p = parseRichMessage(fixedText);
  try {
    return await telegram.sendMessage(chatId, p.text, p.extra);
  } catch (err) {
    const plain = parseRichMessage(rawText);
    const fallbackExtra = { disable_web_page_preview: true };
    if (plain.extra.reply_markup) fallbackExtra.reply_markup = plain.extra.reply_markup;
    return await telegram.sendMessage(chatId, plain.text, fallbackExtra);
  }
}

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
  s.devBoard = s.devBoard || { items: [] };
  if (!Array.isArray(s.devBoard.items)) {
    const migrated = [];
    if (Array.isArray(s.devBoard.inDev)) {
      for (const t of s.devBoard.inDev) migrated.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), type: 'dev', text: String(t), uid: '' });
    }
    if (Array.isArray(s.devBoard.inFix)) {
      for (const t of s.devBoard.inFix) migrated.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), type: 'fix', text: String(t), uid: '' });
    }
    s.devBoard.items = migrated;
  }
  return { s, items: s.devBoard.items };
}

function parseSuggestionCardText(rawText) {
  const lines = String(rawText || '').split('\n');
  let uid = '', cmd = '', desc = '';
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i].trim();
    if (ln.startsWith('🆔 ID:')) uid = ln.replace('🆔 ID:', '').trim();
    else if (ln.startsWith('⌨️ פקודה/נושא:')) cmd = ln.replace('⌨️ פקודה/נושא:', '').trim();
    else if (ln.startsWith('💬 תוכן ההצעה:')) {
      desc = lines.slice(i + 1).join(' ').trim();
      break;
    }
  }
  const combined = desc ? `${cmd} - ${desc}` : cmd;
  const isFix = /(תיקון|באג|תקלה|שגיאה|לתקן|לסדר|בעיה|bug|fix)/i.test(`${cmd} ${desc}`);
  return { uid, cmd, desc, combined: combined.slice(0, 120), type: isFix ? 'fix' : 'dev' };
}

function buildDevBoardView(items, creatorViewer) {
  const inDev = items.filter((x) => x.type !== 'fix');
  const inFix = items.filter((x) => x.type === 'fix');

  const devList = inDev.length
    ? inDev.map((item, i) => `${i + 1}. 🚀 ${item.text}`).join('\n')
    : '• אין כרגע פקודות חדשות ברשימת הפיתוח.';
  const fixList = inFix.length
    ? inFix.map((item, i) => `${i + 1}. 🔧 ${item.text}`).join('\n')
    : '• אין כרגע פקודות בתיקונים – כל המערכות פועלות תקין! ✅';

  const text =
    `🛠️ *לוח מצב פיתוח ותיקונים – וולטיק מוד*\n\n` +
    `🚀 *פקודות ומערכות בפיתוח כרגע (${inDev.length}):*\n${devList}\n\n` +
    `🔧 *פקודות ומערכות בתיקונים/שדרוג (${inFix.length}):*\n${fixList}\n\n` +
    `💡 *איך פקודה נכנסת לכאן?* כל הצעה שנשלחת דרך כפתור **"💡 הצעה לשיפור"** בתפריט הראשי מתווספת לכאן אוטומטית עד שיוצר הבוט מאשר או דוחה אותה!`;

  const rows = [];
  if (creatorViewer) {
    items.forEach((item, idx) => {
      const shortTxt = item.text.length > 16 ? `${item.text.slice(0, 16)}…` : item.text;
      const switchLabel = item.type === 'fix' ? '🚀 העבר לפיתוח' : '🔧 העבר לתיקונים';
      rows.push([
        { text: switchLabel, callback_data: `devb_flip_${idx}` },
        { text: `🗑️ מחק: ${shortTxt}`, callback_data: `devb_del_${idx}` }
      ]);
    });
    if (items.length) {
      rows.push([{ text: '🧹 נקה את כל הלוח', callback_data: 'devb_clear_all' }]);
    }
    rows.push([{ text: '👑 חזרה לפאנל היוצר', callback_data: 'own_panel' }]);
  }
  rows.push([{ text: '💡 שלח הצעה לשיפור', callback_data: 'reqcmd_start' }]);
  rows.push([{ text: '🔙 חזרה לתפריט הראשי', callback_data: 'help_main' }]);

  return { text, reply_markup: { inline_keyboard: rows } };
}

function buildCleanJoinPanel(mode) {
  const curMode = mode || 'off';
  const labels = {
    off: '❌ לא מוחק הודעות קודמות',
    welcome: '👋 מוחק הודעת ברוך הבא קודמת בלבד',
    verify: '🔐 מוחק הודעת אימות משתמש קודמת בלבד',
    both: '🧹 מוחק גם וגם (ברוך הבא + אימות קודמים)'
  };
  const text =
    `🧹 *מחיקת הודעות קודמות בכניסת משתמש חדש לקבוצה*\n` +
    `📌 *מצב נוכחי בקבוצה:* ${labels[curMode] || labels.off}\n\n` +
    `בחר מה הבוט ימחק אוטומטית מהצ׳אט בכל פעם שמשתמש חדש נכנס לקבוצה:`;

  const kb = {
    inline_keyboard: [
      [{ text: `${curMode === 'welcome' ? '✅ ' : ''}👋 מחק הודעת ברוך הבא קודמת בלבד`, callback_data: 'clnjoin_set_welcome' }],
      [{ text: `${curMode === 'verify' ? '✅ ' : ''}🔐 מחק הודעת אימות משתמש קודמת בלבד`, callback_data: 'clnjoin_set_verify' }],
      [{ text: `${curMode === 'both' ? '✅ ' : ''}🧹 מחק גם וגם (ברוך הבא + אימות קודמים)`, callback_data: 'clnjoin_set_both' }],
      [{ text: `${curMode === 'off' ? '✅ ' : ''}❌ אל תמחק הודעות קודמות`, callback_data: 'clnjoin_set_off' }]
    ]
  };
  return { text, reply_markup: kb };
}

function isVerifyMessagePayload(payload) {
  if (!payload || typeof payload.text !== 'string') return false;
  const kbStr = JSON.stringify(payload.reply_markup || '');
  return kbStr.includes('ver_ok_') || kbStr.includes('fcnt_verifyme_') || payload.text.includes('כדי לוודא שאינך בוט') || payload.text.includes('לאימות קידומת הטלפון');
}

function isWelcomeMessagePayload(payload) {
  if (!payload || typeof payload.text !== 'string') return false;
  if (isVerifyMessagePayload(payload)) return false;
  if (payload.text.startsWith('📜 *חוקי הקבוצה') || payload.text.startsWith('📢 *חוקי הקבוצה') || payload.text.startsWith('✅ הטקסט שעל כפתור החוקים')) return false;
  const kbStr = JSON.stringify(payload.reply_markup || '');
  return kbStr.includes('?start=rules_') || payload.text.includes('אומתת בהצלחה וכעת באפשרותך לכתוב בקבוצה');
}

module.exports = function registerInfoCommands(bot) {
  if (bot && bot.telegram && !bot.telegram._rulesCleanWrapped) {
    bot.telegram._rulesCleanWrapped = true;
    const origCall = bot.telegram.callApi.bind(bot.telegram);
    bot.telegram.callApi = async function (method, payload, ...rest) {
      let detectedWelcome = false;
      let detectedVerify = false;

      try {
        if ((method === 'sendMessage' || method === 'editMessageText') && payload && typeof payload.text === 'string') {
          // ניקוי /setrules מתוך הודעות חוקי קבוצה
          if (payload.text.includes('חוקי הקבוצה') && /\/setrules(@\S+)?/i.test(payload.text)) {
            payload.text = payload.text.replace(/\/setrules(@\S+)?\s*/gi, '');
          }

          // 1א. כשמשתמש שולח "הצעה לשיפור" -> נכנס אוטומטית ללוח פיתוח/תיקונים!
          if (method === 'sendMessage' && String(payload.chat_id) === String(CREATOR_ID) && payload.text.startsWith('📩 הצעה חדשה לשיפור / פקודה:')) {
            const parsed = parseSuggestionCardText(payload.text);
            if (parsed.cmd) {
              const { s, items } = await loadDevBoard();
              items.push({ id: Date.now().toString(36), uid: parsed.uid, cmd: parsed.cmd, text: parsed.combined, type: parsed.type });
              await saveGroupData('owner_global', s);
            }
          }

          // 1ב. כשיוצר הבוט לוחץ על "אישור" או "דחייה" -> ההצעה נמחקת אוטומטית מלוח הפיתוח/תיקונים!
          if (method === 'editMessageText' && (payload.text.startsWith('אושר\n\n📩 הצעה חדשה לשיפור') || payload.text.startsWith('נדחה\n\n📩 הצעה חדשה לשיפור'))) {
            const parsed = parseSuggestionCardText(payload.text);
            const { s, items } = await loadDevBoard();
            const beforeLen = items.length;
            s.devBoard.items = items.filter((x) => {
              if (parsed.cmd && (x.cmd === parsed.cmd || x.text === parsed.combined || x.text.startsWith(parsed.cmd))) return false;
              if (parsed.uid && x.uid === parsed.uid) return false;
              return true;
            });
            if (s.devBoard.items.length === beforeLen && s.devBoard.items.length > 0) {
              s.devBoard.items.pop();
            }
            await saveGroupData('owner_global', s);
          }

          // הזרקת כפתורים לתפריט הראשי, לפאנל היוצר (/owner), ולפקודות /welcome ו-/verify
          const kb = payload.reply_markup?.inline_keyboard;
          if (Array.isArray(kb)) {
            const hasDevBtn = kb.some((r) => r.some((b) => b.callback_data === 'devboard_open'));
            if (!hasDevBtn && payload.text.includes('תפריט הפקודות הראשי')) {
              kb.splice(kb.length - 1, 0, [{ text: '🛠️ מה בפיתוח ובתיקונים', callback_data: 'devboard_open' }]);
            }
            if (payload.text.startsWith('👑 פאנל שליטה ראשי – יוצר הבוט')) {
              if (!hasDevBtn) {
                kb.unshift([{ text: '🛠️ לוח פקודות בפיתוח ובתיקונים', callback_data: 'devboard_open' }]);
              }
              const hasBcastGroups = kb.some((r) => r.some((b) => b.callback_data === 'bcast_groups_only'));
              if (!hasBcastGroups) {
                const bcastIdx = kb.findIndex((r) => r.some((b) => b.callback_data === 'own_bcast_users'));
                const newBtnRow = [{ text: '🏢 שליחת הודעה לכל הקבוצות (ללא שליחה למשתמשים)', callback_data: 'bcast_groups_only' }];
                if (bcastIdx >= 0) kb.splice(bcastIdx + 1, 0, newBtnRow);
                else kb.push(newBtnRow);
              }
            }
            if (payload.text.startsWith('🔐 *אימות אנושי למצטרפים') || payload.text.startsWith('⚙️ *פאנל הגדרות קבוצה')) {
              const hasClnJoin = kb.some((r) => r.some((b) => b.callback_data === 'clnjoin_open'));
              if (!hasClnJoin) {
                kb.push([{ text: '🧹 מחיקת ברוך הבא / אימות קודמים בכניסה', callback_data: 'clnjoin_open' }]);
              }
            }
          }

          // 3. מחיקת הודעת ברוך הבא / אימות קודמת בכניסת משתמש חדש לפי בחירת מנהל הקבוצה
          if (payload.chat_id && String(payload.chat_id).startsWith('-')) {
            detectedVerify = method === 'sendMessage' && isVerifyMessagePayload(payload);
            detectedWelcome = isWelcomeMessagePayload(payload);
            if (detectedVerify || detectedWelcome) {
              const gData = await getGroupData(payload.chat_id);
              const mode = gData.cleanPrevJoinMode || 'off';
              if (detectedWelcome && (mode === 'welcome' || mode === 'both') && gData.lastWelcomeMsgId && gData.lastWelcomeMsgId !== payload.message_id) {
                await origCall('deleteMessage', { chat_id: payload.chat_id, message_id: gData.lastWelcomeMsgId }).catch(() => {});
                gData.lastWelcomeMsgId = null;
                await saveGroupData(payload.chat_id, gData);
              }
              if (detectedVerify && (mode === 'verify' || mode === 'both') && gData.lastVerifyMsgId) {
                await origCall('deleteMessage', { chat_id: payload.chat_id, message_id: gData.lastVerifyMsgId }).catch(() => {});
                gData.lastVerifyMsgId = null;
                await saveGroupData(payload.chat_id, gData);
              }
            }
          }
        }
      } catch (e) {}

      const res = await origCall(method, payload, ...rest);

      try {
        if (res?.message_id && payload?.chat_id && String(payload.chat_id).startsWith('-')) {
          if (detectedVerify || detectedWelcome) {
            const gData = await getGroupData(payload.chat_id);
            if (detectedVerify) gData.lastVerifyMsgId = res.message_id;
            if (detectedWelcome) {
              gData.lastWelcomeMsgId = res.message_id;
              if (gData.lastVerifyMsgId === res.message_id) gData.lastVerifyMsgId = null;
            }
            await saveGroupData(payload.chat_id, gData);
          }
        }
      } catch (e) {}

      return res;
    };
  }

  // קליטת הודעה מיוצר הבוט לשידור לכל הקבוצות בלבד (ללא משתמשים)
  bot.use(async (ctx, next) => {
    if (isCreator(ctx) && ctx.chat?.type === 'private' && ctx.message?.text) {
      const uid = String(ctx.from.id);
      const waitMode = creatorWaitState[uid];
      const txt = ctx.message.text.trim();
      if (waitMode && txt.startsWith('/')) {
        delete creatorWaitState[uid];
      } else if (waitMode === 'bcast_groups_only' && txt) {
        delete creatorWaitState[uid];
        const s = await getGroupData('owner_global');
        const gIds = Object.keys(s.groups || {});
        let gc = 0;
        for (const gid of gIds) {
          try {
            await safeSendGroupRich(ctx.telegram, gid, txt);
            gc++;
          } catch (e) {}
        }
        return await ctx.reply(
          `🏢 ההודעה נשלחה בהצלחה ל-*${gc} קבוצות בלבד* (ללא שליחה למשתמשים בפרטי)!`,
          {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '👑 חזרה לפאנל היוצר', callback_data: 'own_panel' }]] }
          }
        );
      }
    }
    return next();
  });

  // כפתור ופקודה לשליחת הודעה לכל הקבוצות בלבד (ללא שליחה למשתמשים)
  bot.action('bcast_groups_only', async (ctx) => {
    if (!isCreator(ctx)) return ctx.answerCbQuery('⛔ ליוצר הבוט בלבד!', { show_alert: true }).catch(() => {});
    creatorWaitState[String(ctx.from.id)] = 'bcast_groups_only';
    await ctx.answerCbQuery().catch(() => {});
    const txt =
      '🏢 *שליחת הודעה לכל הקבוצות (ללא שליחה למשתמשים)*\n\n' +
      'כתוב עכשיו את ההודעה שתרצה לשלוח לכל הקבוצות שבהן הבוט נמצא (תומך בעיצוב וכפתורים):';
    const kb = { inline_keyboard: [[{ text: '❌ ביטול וחזרה לפאנל היוצר', callback_data: 'bcast_groups_cancel' }]] };
    await ctx.editMessageText(txt, { parse_mode: 'Markdown', reply_markup: kb })
      .catch(() => ctx.reply(txt, { parse_mode: 'Markdown', reply_markup: kb }));
  });

  bot.action('bcast_groups_cancel', async (ctx) => {
    if (!isCreator(ctx)) return;
    delete creatorWaitState[String(ctx.from.id)];
    await ctx.answerCbQuery('בוטל').catch(() => {});
    await ctx.editMessageText('❌ השליחה לקבוצות בוטלה.', {
      reply_markup: { inline_keyboard: [[{ text: '👑 חזרה לפאנל היוצר', callback_data: 'own_panel' }]] }
    }).catch(() => {});
  });

  bot.command(['broadcast_groups', 'owner_sendgroups'], async (ctx) => {
    if (!isCreator(ctx)) return;
    const msg = (ctx.message.text || '').replace(/^\/(broadcast_groups|owner_sendgroups)(@\S+)?\s*/i, '').trim();
    if (!msg) {
      return ctx.reply('שימוש: `/broadcast_groups [הודעה לכל הקבוצות בלבד ללא משתמשים]`', { parse_mode: 'Markdown' });
    }
    const s = await getGroupData('owner_global');
    let gc = 0;
    for (const gid of Object.keys(s.groups || {})) {
      try { await safeSendGroupRich(ctx.telegram, gid, msg); gc++; } catch (e) {}
    }
    await ctx.reply(`🏢 שודר בהצלחה ל-${gc} קבוצות בלבד (ללא שליחה למשתמשים).`);
  });

  // פקודה וכפתורים למנהל קבוצה: בחירה אם למחוק הודעת ברוך הבא / אימות קודמת בכניסת משתמש חדש
  bot.command(['clean_welcome', 'welcome_clean', 'clean_join'], async (ctx) => {
    if (!(await requireAdmin(ctx, '/clean_welcome'))) return;
    const data = await getGroupData(ctx.chat.id);
    const view = buildCleanJoinPanel(data.cleanPrevJoinMode || 'off');
    await ctx.reply(view.text, { parse_mode: 'Markdown', reply_markup: view.reply_markup });
  });

  bot.action('clnjoin_open', async (ctx) => {
    if (!(await isGroupAdminCb(ctx))) {
      return ctx.answerCbQuery('⛔ למנהלי הקבוצה בלבד!', { show_alert: true }).catch(() => {});
    }
    await ctx.answerCbQuery().catch(() => {});
    const data = await getGroupData(ctx.chat.id);
    const view = buildCleanJoinPanel(data.cleanPrevJoinMode || 'off');
    await ctx.editMessageText(view.text, { parse_mode: 'Markdown', reply_markup: view.reply_markup })
      .catch(() => ctx.reply(view.text, { parse_mode: 'Markdown', reply_markup: view.reply_markup }));
  });

  bot.action(/^clnjoin_set_(welcome|verify|both|off)$/, async (ctx) => {
    if (!(await isGroupAdminCb(ctx))) {
      return ctx.answerCbQuery('⛔ למנהלי הקבוצה בלבד!', { show_alert: true }).catch(() => {});
    }
    const mode = ctx.match[1];
    const data = await getGroupData(ctx.chat.id);
    data.cleanPrevJoinMode = mode;
    await saveGroupData(ctx.chat.id, data);
    await ctx.answerCbQuery('✅ ההגדרה נשמרה!').catch(() => {});
    const view = buildCleanJoinPanel(mode);
    await ctx.editMessageText(view.text, { parse_mode: 'Markdown', reply_markup: view.reply_markup }).catch(() => {});
  });

  // פקודות וכפתורים ללוח פיתוח ותיקונים (/dev, /status, /roadmap)
  bot.command(['dev', 'status', 'roadmap', 'in_dev'], async (ctx) => {
    const { items } = await loadDevBoard();
    const view = buildDevBoardView(items, isCreator(ctx));
    await ctx.reply(view.text, { parse_mode: 'Markdown', reply_markup: view.reply_markup });
  });

  bot.action('devboard_open', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const { items } = await loadDevBoard();
    const view = buildDevBoardView(items, isCreator(ctx));
    await ctx.editMessageText(view.text, { parse_mode: 'Markdown', reply_markup: view.reply_markup })
      .catch(() => ctx.reply(view.text, { parse_mode: 'Markdown', reply_markup: view.reply_markup }));
  });

  bot.action(/^devb_flip_(\d+)$/, async (ctx) => {
    if (!isCreator(ctx)) return ctx.answerCbQuery('⛔ ליוצר הבוט בלבד!', { show_alert: true }).catch(() => {});
    const idx = parseInt(ctx.match[1], 10);
    const { s, items } = await loadDevBoard();
    if (!items[idx]) return ctx.answerCbQuery('לא נמצא').catch(() => {});
    items[idx].type = items[idx].type === 'fix' ? 'dev' : 'fix';
    await saveGroupData('owner_global', s);
    await ctx.answerCbQuery('🔄 הועבר!').catch(() => {});
    const view = buildDevBoardView(items, true);
    await ctx.editMessageText(view.text, { parse_mode: 'Markdown', reply_markup: view.reply_markup }).catch(() => {});
  });

  bot.action(/^devb_del_(\d+)$/, async (ctx) => {
    if (!isCreator(ctx)) return ctx.answerCbQuery('⛔ ליוצר הבוט בלבד!', { show_alert: true }).catch(() => {});
    const idx = parseInt(ctx.match[1], 10);
    const { s, items } = await loadDevBoard();
    if (idx < 0 || idx >= items.length) return ctx.answerCbQuery('כבר הוסר').catch(() => {});
    const removed = items.splice(idx, 1)[0];
    await saveGroupData('owner_global', s);
    await ctx.answerCbQuery(`🗑️ הוסר: ${removed.text.slice(0, 25)}`).catch(() => {});
    const view = buildDevBoardView(items, true);
    await ctx.editMessageText(view.text, { parse_mode: 'Markdown', reply_markup: view.reply_markup }).catch(() => {});
  });

  bot.action('devb_clear_all', async (ctx) => {
    if (!isCreator(ctx)) return ctx.answerCbQuery('⛔ ליוצר הבוט בלבד!', { show_alert: true }).catch(() => {});
    const { s } = await loadDevBoard();
    s.devBoard.items = [];
    await saveGroupData('owner_global', s);
    await ctx.answerCbQuery('🧹 הלוח נוקה!').catch(() => {});
    const view = buildDevBoardView([], true);
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

      const preview = await sendFormattedMessage(ctx, text, { name: ctx.from.first_name || 'חבר' });
      if (!preview) return;

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
