const { getGroupData, saveGroupData, parseRichMessage, requireAdmin, getTarget, parseDurationSeconds } = require('./utils');

const joinTracker = {};
const recentUserMsgs = {};
const verifyTimers = {};

// קבלת השעה הנוכחית לפי שעון ישראל (Asia/Jerusalem) במדויק (כולל שעון קיץ/חורף)
function getIsraelTimeMinutes() {
  const ilStr = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Jerusalem', hour12: false, hour: '2-digit', minute: '2-digit' });
  const [h, m] = ilStr.split(':').map((n) => parseInt(n, 10));
  return { timeStr: ilStr, totalMinutes: h * 60 + m };
}

function parseTimeMinutes(str) {
  const m = String(str || '').trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
}

function isNowInWindow(nowMin, startMin, endMin) {
  if (startMin === endMin) return false;
  return startMin < endMin ? (nowMin >= startMin && nowMin < endMin) : (nowMin >= startMin || nowMin < endMin);
}

function getIsraelDateKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
}

async function isGroupAdminCb(ctx) {
  if (!ctx.chat || ctx.chat.type === 'private' || !ctx.from) return false;
  try {
    const m = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
    return m && ['creator', 'administrator'].includes(m.status);
  } catch (e) { return false; }
}

function ensureAdv(data) {
  data.adv = data.adv || {};
  const a = data.adv;
  if (typeof a.raidAuto !== 'boolean') a.raidAuto = true;
  if (typeof a.raidUntil !== 'number') a.raidUntil = 0;
  if (typeof a.verifyEnabled !== 'boolean') a.verifyEnabled = false;
  if (typeof a.verifySeconds !== 'number') a.verifySeconds = 0;
  if (typeof a.antiforward !== 'boolean') a.antiforward = false;
  a.foreignLangs = a.foreignLangs || { ar: false, ru: false, zh: false, hi: false };
  a.autoReplies = a.autoReplies || {};
  if (typeof a.votebanLimit !== 'number') a.votebanLimit = 0;
  a.votebans = a.votebans || {};
  if (typeof a.appealEnabled !== 'boolean') a.appealEnabled = false;
  a.quotas = a.quotas || {};
  a.quotaUsage = a.quotaUsage || {};
  if (typeof a.cleanuserEnabled !== 'boolean') a.cleanuserEnabled = false;
  a.giveaway = a.giveaway || null;
  a.userStats = a.userStats || {};
  a.fastclick = a.fastclick || null;
  if (typeof a.duelEnabled !== 'boolean') a.duelEnabled = false;
  a.duels = a.duels || {};
  a.nightmode = a.nightmode || { enabled: false, start: '00:00', end: '07:00' };
  if (typeof a.newbieWaitSeconds !== 'number') a.newbieWaitSeconds = 0;
  if (typeof a.honeypotEnabled !== 'boolean') a.honeypotEnabled = false;
  if (typeof a.tagallEnabled !== 'boolean') a.tagallEnabled = false;
  a.secrets = a.secrets || {};
  return a;
}

const PRESET_AUTOREPLIES = [
  { key: 'שלום', val: 'שלום וברוך הבא! 👋 איך אפשר לעזור?' },
  { key: 'חוקים', val: '📜 לצפייה בחוקי הקבוצה שלחו /rules' },
  { key: 'מנהל', val: '👑 לתיוג מנהלי הקבוצה שלחו /admins' },
  { key: 'קישור', val: '🔗 הקישור הרשמי נמצא בהודעה הנעוצה בראש הקבוצה 📌' }
];

function buildForeignLangsKb(langs) {
  const st = (v) => (v ? '✅ חסום' : '❌ מותר');
  return {
    inline_keyboard: [
      [{ text: `ערבית: ${st(langs.ar)}`, callback_data: 'adv_flang_ar' }, { text: `רוסית: ${st(langs.ru)}`, callback_data: 'adv_flang_ru' }],
      [{ text: `סינית/יפנית: ${st(langs.zh)}`, callback_data: 'adv_flang_zh' }, { text: `הודית/תאילנדית: ${st(langs.hi)}`, callback_data: 'adv_flang_hi' }]
    ]
  };
}

function buildAutoReplyPanel(autoReplies) {
  const entries = Object.entries(autoReplies || {});
  const rows = PRESET_AUTOREPLIES.map((p, idx) => [{ text: `${autoReplies[p.key] ? '✅' : '➕'} תבנית: "${p.key}"`, callback_data: `adv_ar_preset_${idx}` }]);
  entries.slice(0, 15).forEach(([k]) => rows.push([{ text: `🗑️ מחק תגובה ל-"${k}"`, callback_data: `adv_ar_del_${k}` }]));
  const listTxt = entries.length ? entries.map(([k, v], i) => `${i + 1}. *"${k}"* ⬅️ ${v}`).join('\n') : 'אין כרגע תגובות אוטומטיות פעילות.';
  const text = `🤖 *ניהול מענה אוטומטי (/autoreply)*\n\n${listTxt}\n\n💡 *בחר מילה מתוך הרשימה למטה או הוסף ידנית:*\n\`/autoreply מילה | תשובת הבוט\``;
  return { text, reply_markup: { inline_keyboard: rows } };
}

module.exports = function registerAdvancedCommands(bot) {
  // 1. /raidmode - מצב חירום נגד מתקפת בוטים (ידני + זיהוי אוטומטי)
  bot.command('raidmode', async (ctx) => {
    if (!(await requireAdmin(ctx, '/raidmode [on | off | auto]'))) return;
    const arg = ((ctx.message.text || '').trim().split(/\s+/)[1] || '').toLowerCase();
    const data = await getGroupData(ctx.chat.id);
    const a = ensureAdv(data);
    if (arg === 'on') {
      a.raidUntil = Date.now() + 30 * 60 * 1000;
      await saveGroupData(ctx.chat.id, data);
      return ctx.reply('🚨 *מצב חירום (Raid Mode) הופעל ל-30 דקות!*\nכניסת חשבונות חדשים, קישורים ומדיה נחסמו אוטומטית.', { parse_mode: 'Markdown' });
    }
    if (arg === 'off') {
      a.raidUntil = 0;
      await saveGroupData(ctx.chat.id, data);
      return ctx.reply('🟢 *מצב חירום (Raid Mode) כובה.* הקבוצה חזרה לפעילות רגילה.', { parse_mode: 'Markdown' });
    }
    if (arg === 'auto') {
      a.raidAuto = !a.raidAuto;
      await saveGroupData(ctx.chat.id, data);
      return ctx.reply(`🤖 זיהוי אוטומטי של מתקפת בוטים כעת: *${a.raidAuto ? 'פעיל ✅' : 'כבוי ❌'}*`, { parse_mode: 'Markdown' });
    }
    const active = a.raidUntil > Date.now();
    await ctx.reply(`🛡️ *הגדרות מצב חירום (Raid Mode):*\n• מצב חירום כרגע: *${active ? 'פעיל 🔴' : 'כבוי 🟢'}*\n• זיהוי מתקפת בוטים אוטומטי: *${a.raidAuto ? 'פעיל ✅' : 'כבוי ❌'}*\n\nפקודות: \`/raidmode on\` | \`/raidmode off\` | \`/raidmode auto\``, { parse_mode: 'Markdown' });
  });

  // 2. /verify - אימות מצטרפים בכפתור עם בחירת זמן או ללא הגבלת זמן בכלל
  bot.command('verify', async (ctx) => {
    if (!(await requireAdmin(ctx, '/verify [off | none | 60s | 5m | 1h]'))) return;
    const arg = ((ctx.message.text || '').trim().split(/\s+/)[1] || '').toLowerCase();
    const data = await getGroupData(ctx.chat.id);
    const a = ensureAdv(data);
    if (arg === 'off') {
      a.verifyEnabled = false;
      await saveGroupData(ctx.chat.id, data);
      return ctx.reply('🔓 אימות מצטרפים חדשים כובה.');
    }
    if (['none', 'on', 'unlimited', '0'].includes(arg)) {
      a.verifyEnabled = true;
      a.verifySeconds = 0;
      await saveGroupData(ctx.chat.id, data);
      return ctx.reply('🔐 אימות מצטרפים הופעל *ללא הגבלת זמן* (המשתמש יישאר מושתק עד שילחץ על כפתור האימות).', { parse_mode: 'Markdown' });
    }
    if (arg) {
      const secs = parseDurationSeconds(arg);
      if (!secs) return ctx.reply('⚠️ זמן לא תקין. דוגמאות: `/verify 60s`, `/verify 5m`, `/verify none` (ללא זמן), או `/verify off`.', { parse_mode: 'Markdown' });
      a.verifyEnabled = true;
      a.verifySeconds = secs;
      await saveGroupData(ctx.chat.id, data);
      return ctx.reply(`🔐 אימות מצטרפים הופעל עם הגבלת זמן של *${secs} שניות*.`, { parse_mode: 'Markdown' });
    }
    await ctx.reply(
      `🔐 *אימות אנושי למצטרפים (/verify):*\n• מצב: *${a.verifyEnabled ? 'פעיל ✅' : 'כבוי ❌'}*\n• זמן לאימות: *${a.verifySeconds > 0 ? `${a.verifySeconds} שניות` : 'ללא הגבלת זמן'}*\n\nבחר אפשרות מהכפתורים למטה או שלח \`/verify [זמן]\`:`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '♾️ הפעל ללא הגבלת זמן', callback_data: 'adv_ver_0' }, { text: '⏱️ הפעל (60 שניות)', callback_data: 'adv_ver_60' }],
            [{ text: '⏱️ הפעל (5 דקות)', callback_data: 'adv_ver_300' }, { text: '🔴 כבה אימות', callback_data: 'adv_ver_off' }]
          ]
        }
      }
    );
  });

  bot.action(/^adv_ver_(.+)$/, async (ctx) => {
    if (!(await isGroupAdminCb(ctx))) return ctx.answerCbQuery('⛔ לאדמינים בלבד', { show_alert: true }).catch(() => {});
    const val = ctx.match[1];
    const data = await getGroupData(ctx.chat.id);
    const a = ensureAdv(data);
    if (val === 'off') a.verifyEnabled = false;
    else { a.verifyEnabled = true; a.verifySeconds = parseInt(val, 10) || 0; }
    await saveGroupData(ctx.chat.id, data);
    await ctx.answerCbQuery('עודכן!').catch(() => {});
    await ctx.editMessageText(`✅ הגדרות האימות עודכנו:\n• מצב: *${a.verifyEnabled ? 'פעיל' : 'כבוי'}*\n• זמן: *${a.verifySeconds ? `${a.verifySeconds} שניות` : 'ללא הגבלת זמן'}*`, { parse_mode: 'Markdown' }).catch(() => {});
  });

  // איחוד הודעת האימות והודעת הברוכים הבאים להודעה אחת יחידה עם כפתור חוקי הקבוצה!
  bot.action(/^ver_ok_(\d+)_(\d+)$/, async (ctx) => {
    const targetId = Number(ctx.match[1]);
    const isCorrect = ctx.match[2] === '1';
    if (ctx.from.id !== targetId) return ctx.answerCbQuery('⚠️ כפתור אימות זה מיועד למצטרף החדש בלבד!', { show_alert: true }).catch(() => {});
    if (!isCorrect) return ctx.answerCbQuery('❌ בחירה שגויה! לחץ על סמל המפתח 🔑 כדי להתאמת.', { show_alert: true }).catch(() => {});
    const key = `${ctx.chat.id}:${targetId}`;
    if (verifyTimers[key]) { clearTimeout(verifyTimers[key]); delete verifyTimers[key]; }
    await ctx.telegram.restrictChatMember(ctx.chat.id, targetId, {
      permissions: { can_send_messages: true, can_send_audios: true, can_send_documents: true, can_send_photos: true, can_send_videos: true, can_send_other_messages: true, can_add_web_page_previews: true }
    }).catch(() => {});
    await ctx.answerCbQuery('✅ אומתת בהצלחה! ברוך הבא!').catch(() => {});

    const memberName = ctx.from.first_name || 'חבר';
    const data = await getGroupData(ctx.chat.id);
    if (data.welcomeEnabled !== false) {
      const botUsername = ctx.botInfo?.username || (await ctx.telegram.getMe()).username;
      const rulesUrl = `https://t.me/${botUsername}?start=rules_${ctx.chat.id}`;
      const cleanWelcome = String(data.welcomeText || 'ברוך הבא לקבוצה, *{name}*! נשמח שתקרא את חוקי הקבוצה.').replace(/\s*\(\/rules\)/g, '');
      const unifiedRaw =
        `✅ תודה *${memberName}*! אומתת בהצלחה וכעת באפשרותך לכתוב בקבוצה.\n\n` +
        (cleanWelcome.includes('start=rules_')
          ? cleanWelcome
          : `${cleanWelcome}\n{{📖 לחץ כאן לצפייה בחוקי הקבוצה}{${rulesUrl}}}`);
      const parsed = parseRichMessage(unifiedRaw, { name: memberName });
      await ctx.editMessageText(parsed.text, parsed.extra).catch(async () => {
        await ctx.editMessageText(parsed.text, {
          disable_web_page_preview: true,
          ...(parsed.extra.reply_markup ? { reply_markup: parsed.extra.reply_markup } : {})
        }).catch(() => {});
      });
    } else {
      await ctx.editMessageText(`✅ תודה *${memberName}*! אומתת בהצלחה וכעת באפשרותך לכתוב בקבוצה.`, { parse_mode: 'Markdown' }).catch(() => {});
    }
  });

  // 3. /antiforward - חסימת הודעות מועברות (כבוי ברירת מחדל)
  bot.command('antiforward', async (ctx) => {
    if (!(await requireAdmin(ctx, '/antiforward [on | off]'))) return;
    const arg = ((ctx.message.text || '').trim().split(/\s+/)[1] || '').toLowerCase();
    const data = await getGroupData(ctx.chat.id);
    const a = ensureAdv(data);
    if (['on', 'off'].includes(arg)) {
      a.antiforward = arg === 'on';
      await saveGroupData(ctx.chat.id, data);
      return ctx.reply(`🔄 חסימת העברת הודעות (Forward) כעת: *${a.antiforward ? 'פעילה ✅' : 'כבויה ❌'}*`, { parse_mode: 'Markdown' });
    }
    await ctx.reply(`🔄 *חסימת הודעות מועברות (Anti-Forward):*\nמצב נוכחי: *${a.antiforward ? 'פעיל ✅' : 'כבוי ❌'}*`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '🟢 הפעל חסימת העברות', callback_data: 'adv_afwd_on' }, { text: '🔴 כבה חסימת העברות', callback_data: 'adv_afwd_off' }]] }
    });
  });

  bot.action(/^adv_afwd_(on|off)$/, async (ctx) => {
    if (!(await isGroupAdminCb(ctx))) return ctx.answerCbQuery('⛔ לאדמינים בלבד', { show_alert: true }).catch(() => {});
    const data = await getGroupData(ctx.chat.id);
    const a = ensureAdv(data);
    a.antiforward = ctx.match[1] === 'on';
    await saveGroupData(ctx.chat.id, data);
    await ctx.answerCbQuery('עודכן!').catch(() => {});
    await ctx.editMessageText(`🔄 חסימת הודעות מועברות כעת: *${a.antiforward ? 'פעילה ✅' : 'כבויה ❌'}*`, { parse_mode: 'Markdown' }).catch(() => {});
  });
  // 4. /antiforeign - בחירת שפות זרות לחסימה
  bot.command('antiforeign', async (ctx) => {
    if (!(await requireAdmin(ctx, '/antiforeign'))) return;
    const data = await getGroupData(ctx.chat.id);
    const a = ensureAdv(data);
    await ctx.reply('🌍 *חסימת שפות זרות ובוטים זרים (/antiforeign):*\nלחץ על שפה כדי להפעיל או לכבות את חסימתה בקבוצה:', { parse_mode: 'Markdown', reply_markup: buildForeignLangsKb(a.foreignLangs) });
  });

  bot.action(/^adv_flang_(ar|ru|zh|hi)$/, async (ctx) => {
    if (!(await isGroupAdminCb(ctx))) return ctx.answerCbQuery('⛔ לאדמינים בלבד', { show_alert: true }).catch(() => {});
    const lang = ctx.match[1];
    const data = await getGroupData(ctx.chat.id);
    const a = ensureAdv(data);
    a.foreignLangs[lang] = !a.foreignLangs[lang];
    await saveGroupData(ctx.chat.id, data);
    await ctx.answerCbQuery('עודכן!').catch(() => {});
    await ctx.editMessageReplyMarkup(buildForeignLangsKb(a.foreignLangs)).catch(() => {});
  });

  // 5. /secret - לחישה סודית בקבוצה + כפתור ביטול שנשלח ישירות לפרטי של השולח!
  bot.command(['secret', 'whisper'], async (ctx) => {
    if (!ctx.chat || ctx.chat.type === 'private') {
      return ctx.reply('⚠️ פקודת `/secret` מיועדת לשליחת לחישה סודית בתוך קבוצה!\nכתוב בקבוצה: `/secret @username הודעה סודית` (או השב להודעה של חבר).', { parse_mode: 'Markdown' });
    }
    const raw = (ctx.message.text || '').replace(/^\/(secret|whisper)(@\S+)?\s*/i, '').trim();
    const replyUser = ctx.message.reply_to_message?.from;
    let targetUsername = '';
    let targetId = null;
    let secretMsg = raw;

    if (replyUser && !replyUser.is_bot) {
      targetId = replyUser.id;
      targetUsername = replyUser.username ? `@${replyUser.username}` : (replyUser.first_name || 'חבר');
    } else if (raw.startsWith('@')) {
      const parts = raw.split(/\s+/);
      targetUsername = parts[0];
      secretMsg = parts.slice(1).join(' ').trim();
    } else {
      return ctx.reply('⚠️ שימוש: השב להודעה של חבר וכתוב `/secret [הודעה סודית]` או כתוב `/secret @username [הודעה סודית]`.', { parse_mode: 'Markdown' });
    }
    if (!secretMsg) return ctx.reply('⚠️ שכחת לכתוב את תוכן ההודעה הסודית!');

    await ctx.deleteMessage().catch(() => {});
    const sid = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const data = await getGroupData(ctx.chat.id);
    const a = ensureAdv(data);

    const sent = await ctx.reply(`🔒 *נשלחה הודעה סודית בקבוצה!*\n👤 מאת: *${ctx.from.first_name}*\n🎯 מיועדת רק עבור: *${targetUsername}*`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '🔐 לחץ לקריאת ההודעה הסודית', callback_data: `sec_read_${sid}` }]] }
    });

    a.secrets[sid] = { senderId: ctx.from.id, senderName: ctx.from.first_name || 'חבר', targetId, targetUsername: targetUsername.replace(/^@/, '').toLowerCase(), text: secretMsg.slice(0, 190), chatId: ctx.chat.id, messageId: sent.message_id };
    await saveGroupData(ctx.chat.id, data);

    await ctx.telegram.sendMessage(
      ctx.from.id,
      `🔒 *שלחת הודעה סודית בקבוצה "${ctx.chat.title || ''}"*\n🎯 אל: ${targetUsername}\n💬 תוכן: "${secretMsg}"\n\nלביטול ומחיקת ההודעה הסודית מהקבוצה לחץ על הכפתור למטה:`,
      { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🗑️ בטל ומחק את ההודעה הסודית מהקבוצה', callback_data: `sec_cancel_${ctx.chat.id}_${sid}` }]] } }
    ).catch(() => {});
  });

  bot.action(/^sec_read_(.+)$/, async (ctx) => {
    const sid = ctx.match[1];
    const data = await getGroupData(ctx.chat.id);
    const a = ensureAdv(data);
    const sec = a.secrets[sid];
    if (!sec) return ctx.answerCbQuery('❌ ההודעה הסודית הזו כבר בוטלה או נמחקה.', { show_alert: true }).catch(() => {});
    const clickerUsername = (ctx.from.username || '').toLowerCase();
    const isAllowed = ctx.from.id === sec.senderId || (sec.targetId && ctx.from.id === sec.targetId) || (sec.targetUsername && clickerUsername === sec.targetUsername);
    if (!isAllowed) return ctx.answerCbQuery('סקרן אה? ההודעה הסודית הזו לא מיועדת לך 😉', { show_alert: true }).catch(() => {});
    return ctx.answerCbQuery(`🔒 הודעה סודית מ-${sec.senderName}:\n\n${sec.text}`, { show_alert: true }).catch(() => {});
  });

  bot.action(/^sec_cancel_(-?\d+)_(.+)$/, async (ctx) => {
    const chatId = ctx.match[1];
    const sid = ctx.match[2];
    const data = await getGroupData(chatId);
    const a = ensureAdv(data);
    const sec = a.secrets[sid];
    if (!sec) {
      await ctx.answerCbQuery('כבר נמחקה').catch(() => {});
      return ctx.editMessageText('🗑️ ההודעה הסודית כבר בוטלה ונמחקה מהקבוצה.').catch(() => {});
    }
    if (ctx.from.id !== sec.senderId) return ctx.answerCbQuery('רק שולח ההודעה יכול לבטל אותה.', { show_alert: true }).catch(() => {});
    await ctx.telegram.deleteMessage(chatId, sec.messageId).catch(() => {});
    delete a.secrets[sid];
    await saveGroupData(chatId, data);
    await ctx.answerCbQuery('✅ ההודעה הסודית נמחקה מהקבוצה!').catch(() => {});
    await ctx.editMessageText('✅ ההודעה הסודית בוטלה ונמחקה מהקבוצה בהצלחה!').catch(() => {});
  });

  // 6. /autoreply - מענה אוטומטי מתוך רשימת אפשרויות + הוספה חופשית + מחיקה
  bot.command('autoreply', async (ctx) => {
    if (!(await requireAdmin(ctx, '/autoreply [מילה | תשובה]'))) return;
    const raw = (ctx.message.text || '').replace(/^\/autoreply(@\S+)?\s*/i, '').trim();
    const data = await getGroupData(ctx.chat.id);
    const a = ensureAdv(data);
    if (raw.includes('|')) {
      const [trigger, ...rest] = raw.split('|');
      const key = trigger.trim().toLowerCase();
      const val = rest.join('|').trim();
      if (key && val) { a.autoReplies[key] = val; await saveGroupData(ctx.chat.id, data); }
    }
    const panel = buildAutoReplyPanel(a.autoReplies);
    await ctx.reply(panel.text, { parse_mode: 'Markdown', reply_markup: panel.reply_markup });
  });

  bot.action(/^adv_ar_preset_(\d+)$/, async (ctx) => {
    if (!(await isGroupAdminCb(ctx))) return ctx.answerCbQuery('⛔ לאדמינים בלבד', { show_alert: true }).catch(() => {});
    const preset = PRESET_AUTOREPLIES[parseInt(ctx.match[1], 10)];
    if (!preset) return;
    const data = await getGroupData(ctx.chat.id);
    const a = ensureAdv(data);
    if (a.autoReplies[preset.key]) delete a.autoReplies[preset.key];
    else a.autoReplies[preset.key] = preset.val;
    await saveGroupData(ctx.chat.id, data);
    await ctx.answerCbQuery('עודכן!').catch(() => {});
    const panel = buildAutoReplyPanel(a.autoReplies);
    await ctx.editMessageText(panel.text, { parse_mode: 'Markdown', reply_markup: panel.reply_markup }).catch(() => {});
  });

  bot.action(/^adv_ar_del_(.+)$/, async (ctx) => {
    if (!(await isGroupAdminCb(ctx))) return ctx.answerCbQuery('⛔ לאדמינים בלבד', { show_alert: true }).catch(() => {});
    const data = await getGroupData(ctx.chat.id);
    const a = ensureAdv(data);
    delete a.autoReplies[ctx.match[1]];
    await saveGroupData(ctx.chat.id, data);
    await ctx.answerCbQuery('נמחק!').catch(() => {});
    const panel = buildAutoReplyPanel(a.autoReplies);
    await ctx.editMessageText(panel.text, { parse_mode: 'Markdown', reply_markup: panel.reply_markup }).catch(() => {});
  });

  // 7. /voteban - הצבעת הדחה (כבוי ברירת מחדל, מנהל בוחר כמה קולות נדרשים)
  bot.command('voteban', async (ctx) => {
    if (!ctx.chat || ctx.chat.type === 'private') return ctx.reply('⚠️ פקודה זו פועלת בקבוצות בלבד.');
    const arg = ((ctx.message.text || '').trim().split(/\s+/)[1] || '').toLowerCase();
    const data = await getGroupData(ctx.chat.id);
    const a = ensureAdv(data);
    if (arg) {
      if (!(await requireAdmin(ctx, '/voteban [מספר קולות או off]'))) return;
      if (arg === 'off' || arg === '0') {
        a.votebanLimit = 0;
        await saveGroupData(ctx.chat.id, data);
        return ctx.reply('⚖️ הצבעת הדחה (/voteban) כובתה בקבוצה.');
      }
      const num = parseInt(arg, 10);
      if (isNaN(num) || num < 2 || num > 50) return ctx.reply('⚠️ שימוש למנהל: `/voteban 5` (קביעת מספר מצביעים להדחה) או `/voteban off` לכיבוי.', { parse_mode: 'Markdown' });
      a.votebanLimit = num;
      await saveGroupData(ctx.chat.id, data);
      return ctx.reply(`⚖️ הצבעת הדחה הופעלה! נדרשים *${num} קולות* של חברי הקבוצה כדי להרחיק משתמש.`, { parse_mode: 'Markdown' });
    }
    if (!a.votebanLimit || a.votebanLimit <= 0) return ctx.reply('⚠️ פקודת `/voteban` כבויה בקבוצה זו. מנהל יכול להפעיל אותה ולהגדיר כמה מצביעים נדרשים בעזרת `/voteban 5`.', { parse_mode: 'Markdown' });
    const target = getTarget(ctx);
    if (!target) return ctx.reply(`⚖️ כדי לפתוח הצבעת הרחקה (נדרשים ${a.votebanLimit} קולות), השב להודעה של המשתמש וכתוב \`/voteban\`.`, { parse_mode: 'Markdown' });
    const m = await ctx.telegram.getChatMember(ctx.chat.id, target.id).catch(() => null);
    if (m && ['creator', 'administrator'].includes(m.status)) return ctx.reply('⛔ לא ניתן לפתוח הצבעת הדחה נגד אדמין בקבוצה.');
    a.votebans[target.id] = [ctx.from.id];
    await saveGroupData(ctx.chat.id, data);
    await ctx.reply(`⚖️ *נפתחה הצבעת הרחקה נגד ${target.name}!*\nנדרשים *${a.votebanLimit}* חברים שילחצו בעד כדי להרחיק אותו מהקבוצה:`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: `👟 בעד הרחקה (1/${a.votebanLimit})`, callback_data: `vban_${target.id}` }]] }
    });
  });

  bot.action(/^vban_(\d+)$/, async (ctx) => {
    const targetId = Number(ctx.match[1]);
    const data = await getGroupData(ctx.chat.id);
    const a = ensureAdv(data);
    if (!a.votebanLimit) return ctx.answerCbQuery('הצבעות הדחה כבויות בקבוצה זו.').catch(() => {});
    const voters = a.votebans[targetId] || [];
    if (voters.includes(ctx.from.id)) return ctx.answerCbQuery('כבר הצבעת!').catch(() => {});
    voters.push(ctx.from.id);
    a.votebans[targetId] = voters;
    await saveGroupData(ctx.chat.id, data);
    if (voters.length >= a.votebanLimit) {
      delete a.votebans[targetId];
      await saveGroupData(ctx.chat.id, data);
      await ctx.telegram.banChatMember(ctx.chat.id, targetId).catch(() => {});
      await ctx.answerCbQuery('המשתמש הורחק!').catch(() => {});
      return ctx.editMessageText(`🔨 הקהילה החליטה! המשתמש הורחק מהקבוצה ברוב של ${voters.length} קולות.`).catch(() => {});
    }
    await ctx.answerCbQuery('קולך נספר!').catch(() => {});
    await ctx.editMessageReplyMarkup({ inline_keyboard: [[{ text: `👟 בעד הרחקה (${voters.length}/${a.votebanLimit})`, callback_data: `vban_${targetId}` }]] }).catch(() => {});
  });

  // 8. /appeal - ערעור על אזהרה/חסימה (כבוי ברירת מחדל)
  bot.command('appeal', async (ctx) => {
    if (!ctx.chat || ctx.chat.type === 'private') return ctx.reply('📩 להגשת ערעור, כתוב בקבוצה `/appeal [סיבת הערעור]` במידה ואופציית הערעורים מופעלת.');
    const arg = ((ctx.message.text || '').trim().split(/\s+/)[1] || '').toLowerCase();
    const data = await getGroupData(ctx.chat.id);
    const a = ensureAdv(data);
    if (['on', 'off'].includes(arg)) {
      if (!(await requireAdmin(ctx, '/appeal [on | off]'))) return;
      a.appealEnabled = arg === 'on';
      await saveGroupData(ctx.chat.id, data);
      return ctx.reply(`📩 מערכת הערעורים (/appeal) כעת: *${a.appealEnabled ? 'פעילה ✅' : 'כבויה ❌'}*`, { parse_mode: 'Markdown' });
    }
    if (!a.appealEnabled) return ctx.reply('⚠️ מערכת הערעורים כבויה בקבוצה זו. (מנהל יכול להפעיל עם `/appeal on`).', { parse_mode: 'Markdown' });
    const reason = (ctx.message.text || '').replace(/^\/appeal(@\S+)?\s*/i, '').trim();
    if (!reason) return ctx.reply('✍️ לערעור על אזהרה/הגבלה כתוב: `/appeal [סיבת הערעור שלך]`', { parse_mode: 'Markdown' });
    await ctx.reply(`📩 *בקשת ערעור חדשה מאת ${ctx.from.first_name}:*\n"${reason}"\n\nמנהלים – האם לאשר ולנקות את האזהרות שלו?`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '✅ אשר ערעור ואפס אזהרות', callback_data: `app_ok_${ctx.from.id}` }, { text: '❌ דחה ערעור', callback_data: `app_no_${ctx.from.id}` }]] }
    });
  });

  bot.action(/^app_(ok|no)_(\d+)$/, async (ctx) => {
    if (!(await isGroupAdminCb(ctx))) return ctx.answerCbQuery('⛔ לאדמינים בלבד', { show_alert: true }).catch(() => {});
    if (ctx.match[1] === 'ok') {
      const data = await getGroupData(ctx.chat.id);
      data.warns[ctx.match[2]] = [];
      await saveGroupData(ctx.chat.id, data);
      await ctx.editMessageText(`✅ הערעור אושר ע"י ${ctx.from.first_name} והאזהרות אופסו!`).catch(() => {});
    } else {
      await ctx.editMessageText(`❌ הערעור נדחה ע"י ${ctx.from.first_name}.`).catch(() => {});
    }
  });
  // 9. /msgquota - הגבלת מכסת הודעות יומית למשתמש (כבוי ברירת מחדל)
  bot.command('msgquota', async (ctx) => {
    if (!(await requireAdmin(ctx, '/msgquota [מספר הודעות ליום או off] (בהשבה למשתמש)'))) return;
    const target = getTarget(ctx);
    if (!target) return ctx.reply('⚠️ שימוש: השב להודעה של המשתמש שתרצה להגביל וכתוב `/msgquota 15` (או `/msgquota off` לביטול ההגבלה עליו).', { parse_mode: 'Markdown' });
    const arg = (target.args[0] || '').toLowerCase();
    const data = await getGroupData(ctx.chat.id);
    const a = ensureAdv(data);
    if (arg === 'off' || arg === '0') {
      delete a.quotas[target.id];
      await saveGroupData(ctx.chat.id, data);
      return ctx.reply(`✅ הגבלת ההודעות היומית של ${target.name} הוסרה.`);
    }
    const limit = parseInt(arg, 10);
    if (isNaN(limit) || limit < 1 || limit > 1000) return ctx.reply('⚠️ ציין מספר הודעות יומי (למשל `/msgquota 10` או `/msgquota off`).', { parse_mode: 'Markdown' });
    a.quotas[target.id] = limit;
    await saveGroupData(ctx.chat.id, data);
    await ctx.reply(`📊 הוגדרה מכסה יומית ל-*${target.name}*: עד *${limit} הודעות ביום*.`, { parse_mode: 'Markdown' });
  });

  // 10. /cleanuser - מחיקת X הודעות של משתמש ספציפי (כבוי ברירת מחדל, מנהל בוחר כמה למחוק)
  bot.command('cleanuser', async (ctx) => {
    if (!(await requireAdmin(ctx, '/cleanuser [on | off | מספר הודעות בהשבה]'))) return;
    const rawArgs = (ctx.message.text || '').trim().split(/\s+/).slice(1);
    const firstArg = (rawArgs[0] || '').toLowerCase();
    const data = await getGroupData(ctx.chat.id);
    const a = ensureAdv(data);
    if (['on', 'off'].includes(firstArg) && !ctx.message.reply_to_message) {
      a.cleanuserEnabled = firstArg === 'on';
      await saveGroupData(ctx.chat.id, data);
      return ctx.reply(`🧹 פקודת מחיקת הודעות משתמש (/cleanuser) כעת: *${a.cleanuserEnabled ? 'פעילה ✅' : 'כבויה ❌'}*`, { parse_mode: 'Markdown' });
    }
    if (!a.cleanuserEnabled) return ctx.reply('⚠️ פקודת `/cleanuser` כבויה כרגע. להפעלה שלח קודם: `/cleanuser on`', { parse_mode: 'Markdown' });
    const target = getTarget(ctx);
    if (!target) return ctx.reply('⚠️ שימוש: השב להודעה של המשתמש וכתוב כמה הודעות אחרונות שלו למחוק, למשל: `/cleanuser 10`', { parse_mode: 'Markdown' });
    const count = Math.min(Math.max(parseInt(target.args[0] || '10', 10) || 10, 1), 100);
    const key = `${ctx.chat.id}:${target.id}`;
    const msgIds = (recentUserMsgs[key] || []).slice(-count);
    if (ctx.message.reply_to_message && !msgIds.includes(ctx.message.reply_to_message.message_id)) msgIds.push(ctx.message.reply_to_message.message_id);
    let deleted = 0;
    for (const mid of msgIds) {
      if (await ctx.telegram.deleteMessage(ctx.chat.id, mid).then(() => true).catch(() => false)) deleted++;
    }
    recentUserMsgs[key] = [];
    await ctx.deleteMessage().catch(() => {});
    const conf = await ctx.reply(`🧹 נמחקו ${deleted} הודעות של ${target.name}.`);
    setTimeout(() => ctx.telegram.deleteMessage(ctx.chat.id, conf.message_id).catch(() => {}), 4000);
  });

  // 11. /giveaway - מערכת הגרלות (מנהל הקבוצה מפעיל תחילה)
  bot.command('giveaway', async (ctx) => {
    if (!(await requireAdmin(ctx, '/giveaway [פרס ההגרלה]'))) return;
    const prize = (ctx.message.text || '').replace(/^\/giveaway(@\S+)?\s*/i, '').trim() || 'פרס מיוחד 🎁';
    const data = await getGroupData(ctx.chat.id);
    const a = ensureAdv(data);
    a.giveaway = { prize, participants: {} };
    await saveGroupData(ctx.chat.id, data);
    await ctx.reply(`🎉 *הגרלה חדשה נפתחה בקבוצה!*\n\n🎁 *הפרס:* ${prize}\n👥 *משתתפים כרגע:* 0\n\nלחצו על הכפתור למטה כדי להיכנס להגרלה!`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '🎉 השתתף בהגרלה (0)', callback_data: 'gway_join' }], [{ text: '🎲 הגרל זוכה (למנהל)', callback_data: 'gway_draw' }, { text: '🛑 בטל הגרלה', callback_data: 'gway_stop' }]] }
    });
  });

  bot.action('gway_join', async (ctx) => {
    const data = await getGroupData(ctx.chat.id);
    const a = ensureAdv(data);
    if (!a.giveaway) return ctx.answerCbQuery('ההגרלה כבר הסתיימה.').catch(() => {});
    const uid = String(ctx.from.id);
    if (a.giveaway.participants[uid]) return ctx.answerCbQuery('אתה כבר רשום להגרלה! 🍀', { show_alert: true }).catch(() => {});
    a.giveaway.participants[uid] = ctx.from.first_name || 'חבר';
    const total = Object.keys(a.giveaway.participants).length;
    await saveGroupData(ctx.chat.id, data);
    await ctx.answerCbQuery('🎉 נרשמת להגרלה בהצלחה!').catch(() => {});
    await ctx.editMessageText(`🎉 *הגרלה פעילה בקבוצה!*\n\n🎁 *הפרס:* ${a.giveaway.prize}\n👥 *משתתפים כרגע:* ${total}\n\nלחצו על הכפתור למטה כדי להיכנס להגרלה!`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: `🎉 השתתף בהגרלה (${total})`, callback_data: 'gway_join' }], [{ text: '🎲 הגרל זוכה (למנהל)', callback_data: 'gway_draw' }, { text: '🛑 בטל הגרלה', callback_data: 'gway_stop' }]] }
    }).catch(() => {});
  });

  bot.action('gway_draw', async (ctx) => {
    if (!(await isGroupAdminCb(ctx))) return ctx.answerCbQuery('⛔ רק מנהל יכול להגריל זוכה!', { show_alert: true }).catch(() => {});
    const data = await getGroupData(ctx.chat.id);
    const a = ensureAdv(data);
    if (!a.giveaway) return ctx.answerCbQuery('אין הגרלה פעילה.').catch(() => {});
    const entries = Object.entries(a.giveaway.participants);
    if (!entries.length) return ctx.answerCbQuery('אף אחד עדיין לא נרשם להגרלה!', { show_alert: true }).catch(() => {});
    const [winId, winName] = entries[Math.floor(Math.random() * entries.length)];
    const prize = a.giveaway.prize;
    a.giveaway = null;
    await saveGroupData(ctx.chat.id, data);
    await ctx.answerCbQuery('🎉 יש לנו זוכה!').catch(() => {});
    await ctx.editMessageText(`🏆 *תוצאות ההגרלה!*\n\n🎁 *הפרס:* ${prize}\n👑 *הזוכה המאושר:* [${winName}](tg://user?id=${winId}) (מתוך ${entries.length} משתתפים)!\nמזל טוב! 🥳`, { parse_mode: 'Markdown' }).catch(() => {});
  });

  bot.action('gway_stop', async (ctx) => {
    if (!(await isGroupAdminCb(ctx))) return ctx.answerCbQuery('⛔ לאדמינים בלבד', { show_alert: true }).catch(() => {});
    const data = await getGroupData(ctx.chat.id);
    ensureAdv(data).giveaway = null;
    await saveGroupData(ctx.chat.id, data);
    await ctx.answerCbQuery('בוטל').catch(() => {});
    await ctx.editMessageText('🛑 ההגרלה בוטלה על ידי מנהל הקבוצה.').catch(() => {});
  });

  // 12. /top - טבלת 10 הפעילים ביותר בקבוצה
  bot.command('top', async (ctx) => {
    if (!ctx.chat || ctx.chat.type === 'private') return ctx.reply('⚠️ פקודה זו פועלת בקבוצות בלבד.');
    const data = await getGroupData(ctx.chat.id);
    const a = ensureAdv(data);
    const list = Object.values(a.userStats).sort((x, y) => (y.count || 0) - (x.count || 0)).slice(0, 10);
    if (!list.length) return ctx.reply('📊 עדיין לא נאספו מספיק נתוני הודעות לטבלת הפעילים.');
    const medals = ['🥇', '🥈', '🥉'];
    const rows = list.map((u, i) => `${medals[i] || `${i + 1}.`} *${u.name}* – ${u.count} הודעות`).join('\n');
    await ctx.reply(`🏆 *טבלת 10 הפעילים ביותר בקבוצה:*\n\n${rows}`, { parse_mode: 'Markdown' });
  });

  // 13. /fastclick - אתגר הראשון שלוחץ (מנהל מפעיל ובוחר מתי להפסיק)
  bot.command('fastclick', async (ctx) => {
    if (!(await requireAdmin(ctx, '/fastclick [start | stop]'))) return;
    const arg = ((ctx.message.text || '').trim().split(/\s+/)[1] || 'start').toLowerCase();
    const data = await getGroupData(ctx.chat.id);
    const a = ensureAdv(data);
    if (arg === 'stop' || arg === 'off') {
      a.fastclick = null;
      await saveGroupData(ctx.chat.id, data);
      return ctx.reply('🛑 פעילות "הראשון שלוחץ" הופסקה על ידי המנהל.');
    }
    a.fastclick = { active: true, startedAt: Date.now() };
    await saveGroupData(ctx.chat.id, data);
    await ctx.reply('⚡ *אתגר המהירות התחיל!*\nהראשון שלוחץ על הכפתור למטה מנצח בסיבוב!', {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '⚡ לחץ כאן הכי מהר! ⚡', callback_data: 'fclick_win' }], [{ text: '🛑 הפסק פעילות (למנהל)', callback_data: 'fclick_stop' }]] }
    });
  });

  bot.action('fclick_win', async (ctx) => {
    const data = await getGroupData(ctx.chat.id);
    const a = ensureAdv(data);
    if (!a.fastclick || !a.fastclick.active) return ctx.answerCbQuery('הסיבוב כבר הסתיים!', { show_alert: true }).catch(() => {});
    const ms = Date.now() - a.fastclick.startedAt;
    a.fastclick.active = false;
    await saveGroupData(ctx.chat.id, data);
    await ctx.answerCbQuery('🏆 ניצחת!').catch(() => {});
    await ctx.editMessageText(`🏆 *יש לנו מנצח באתגר המהירות!*\n⚡ *${ctx.from.first_name}* לחץ ראשון תוך *${(ms / 1000).toFixed(2)} שניות*!`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '🔄 סיבוב נוסף (למנהל)', callback_data: 'fclick_again' }], [{ text: '🛑 הפסק פעילות (למנהל)', callback_data: 'fclick_stop' }]] }
    }).catch(() => {});
  });

  bot.action('fclick_again', async (ctx) => {
    if (!(await isGroupAdminCb(ctx))) return ctx.answerCbQuery('⛔ לאדמינים בלבד', { show_alert: true }).catch(() => {});
    const data = await getGroupData(ctx.chat.id);
    ensureAdv(data).fastclick = { active: true, startedAt: Date.now() };
    await saveGroupData(ctx.chat.id, data);
    await ctx.answerCbQuery('סיבוב חדש!').catch(() => {});
    await ctx.editMessageText('⚡ *סיבוב חדש של אתגר המהירות התחיל!*\nהראשון שלוחץ על הכפתור למטה מנצח!', {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '⚡ לחץ כאן הכי מהר! ⚡', callback_data: 'fclick_win' }], [{ text: '🛑 הפסק פעילות (למנהל)', callback_data: 'fclick_stop' }]] }
    }).catch(() => {});
  });

  bot.action('fclick_stop', async (ctx) => {
    if (!(await isGroupAdminCb(ctx))) return ctx.answerCbQuery('⛔ לאדמינים בלבד', { show_alert: true }).catch(() => {});
    const data = await getGroupData(ctx.chat.id);
    ensureAdv(data).fastclick = null;
    await saveGroupData(ctx.chat.id, data);
    await ctx.answerCbQuery('הופסק').catch(() => {});
    await ctx.editMessageText('🛑 פעילות "הראשון שלוחץ" הופסקה על ידי מנהל הקבוצה.').catch(() => {});
  });

  // 14. /duel - דו-קרב בכפתורים (מנהל הקבוצה מפעיל תחילה בקבוצה ויש לו אפשרות לבטל)
  bot.command('duel', async (ctx) => {
    if (!ctx.chat || ctx.chat.type === 'private') return ctx.reply('⚠️ פקודה זו פועלת בקבוצות בלבד.');
    const arg = ((ctx.message.text || '').trim().split(/\s+/)[1] || '').toLowerCase();
    const data = await getGroupData(ctx.chat.id);
    const a = ensureAdv(data);
    if (['on', 'off'].includes(arg)) {
      if (!(await requireAdmin(ctx, '/duel [on | off]'))) return;
      a.duelEnabled = arg === 'on';
      if (!a.duelEnabled) a.duels = {};
      await saveGroupData(ctx.chat.id, data);
      return ctx.reply(`⚔️ משחקי דו-קרב (/duel) בקבוצה כעת: *${a.duelEnabled ? 'פעילים ✅' : 'כבויים ❌'}*`, { parse_mode: 'Markdown' });
    }
    if (!a.duelEnabled) return ctx.reply('⚠️ משחק הדו-קרב כבוי כרגע בקבוצה. מנהל הקבוצה יכול להפעיל אותו בעזרת `/duel on` (ולכבות עם `/duel off`).', { parse_mode: 'Markdown' });
    const did = Date.now().toString(36);
    a.duels[did] = { p1: ctx.from.id, p1Name: ctx.from.first_name || 'שחקן 1' };
    await saveGroupData(ctx.chat.id, data);
    await ctx.reply(`⚔️ *${ctx.from.first_name}* פתח הזמנה לדו-קרב קובייה!\nמי אמיץ מספיק ללחוץ למטה ולהתמודד מולו?`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '🎲 קבל הזמנה לדו-קרב!', callback_data: `duel_go_${did}` }], [{ text: '🛑 בטל דו-קרב (למנהל/פותח)', callback_data: `duel_cancel_${did}` }]] }
    });
  });

  bot.action(/^duel_go_(.+)$/, async (ctx) => {
    const did = ctx.match[1];
    const data = await getGroupData(ctx.chat.id);
    const a = ensureAdv(data);
    const d = a.duels[did];
    if (!a.duelEnabled || !d) return ctx.answerCbQuery('הדו-קרב כבר הסתיים או בוטל.').catch(() => {});
    if (ctx.from.id === d.p1) return ctx.answerCbQuery('חכה שחבר אחר בקבוצה ילחץ להתמודד מולך!', { show_alert: true }).catch(() => {});
    delete a.duels[did];
    await saveGroupData(ctx.chat.id, data);
    const r1 = Math.floor(Math.random() * 6) + 1;
    const r2 = Math.floor(Math.random() * 6) + 1;
    const p2Name = ctx.from.first_name || 'שחקן 2';
    const winner = r1 > r2 ? `🏆 המנצח: *${d.p1Name}*!` : r2 > r1 ? `🏆 המנצח: *${p2Name}*!` : '🤝 תיקו מטורף!';
    await ctx.editMessageText(`⚔️ *תוצאות הדו-קרב:*\n• ${d.p1Name} הטיל: 🎲 *${r1}*\n• ${p2Name} הטיל: 🎲 *${r2}*\n\n${winner}`, { parse_mode: 'Markdown' }).catch(() => {});
  });

  bot.action(/^duel_cancel_(.+)$/, async (ctx) => {
    const did = ctx.match[1];
    const data = await getGroupData(ctx.chat.id);
    const a = ensureAdv(data);
    const d = a.duels[did];
    const isAdmin = await isGroupAdminCb(ctx);
    if (!isAdmin && (!d || ctx.from.id !== d.p1)) return ctx.answerCbQuery('⛔ רק מנהל או פותח הדו-קרב יכולים לבטל אותו.', { show_alert: true }).catch(() => {});
    delete a.duels[did];
    await saveGroupData(ctx.chat.id, data);
    await ctx.editMessageText('🛑 הדו-קרב בוטל.').catch(() => {});
  });
  // 15. /nightmode - נעילת לילה אוטומטית לפי שעון ישראל (Asia/Jerusalem)
  bot.command('nightmode', async (ctx) => {
    if (!(await requireAdmin(ctx, '/nightmode [HH:MM HH:MM | off]'))) return;
    const args = (ctx.message.text || '').trim().split(/\s+/).slice(1);
    const data = await getGroupData(ctx.chat.id);
    const a = ensureAdv(data);
    const ilNow = getIsraelTimeMinutes();
    if ((args[0] || '').toLowerCase() === 'off') {
      a.nightmode.enabled = false;
      await saveGroupData(ctx.chat.id, data);
      return ctx.reply(`☀️ מצב לילה אוטומטי כובה. (שעון ישראל כעת: ${ilNow.timeStr})`);
    }
    if (args.length >= 2 && parseTimeMinutes(args[0]) !== null && parseTimeMinutes(args[1]) !== null) {
      a.nightmode = { enabled: true, start: args[0], end: args[1] };
      await saveGroupData(ctx.chat.id, data);
      return ctx.reply(`🌙 *מצב לילה אוטומטי הופעל לפי שעון ישראל!*\n• שעת נעילה: *${args[0]}*\n• שעת פתיחה: *${args[1]}*\n• שעון ישראל כעת: *${ilNow.timeStr}*`, { parse_mode: 'Markdown' });
    }
    await ctx.reply(`🌙 *מצב לילה אוטומטי (לפי שעון ישראל – כעת ${ilNow.timeStr}):*\n• מצב: *${a.nightmode.enabled ? `פעיל (${a.nightmode.start} עד ${a.nightmode.end}) ✅` : 'כבוי ❌'}*\n\nלהגדרה שלח למשל: \`/nightmode 00:00 07:00\`\nלכיבוי שלח: \`/nightmode off\``, { parse_mode: 'Markdown' });
  });

  // 16. /newbiemode - הגבלת מדיה וקישורים למשתמשים חדשים לפי זמן וותק שבוחר המנהל
  bot.command('newbiemode', async (ctx) => {
    if (!(await requireAdmin(ctx, '/newbiemode [10m | 1h | 24h | off]'))) return;
    const arg = ((ctx.message.text || '').trim().split(/\s+/)[1] || '').toLowerCase();
    const data = await getGroupData(ctx.chat.id);
    const a = ensureAdv(data);
    if (arg === 'off' || arg === '0') {
      a.newbieWaitSeconds = 0;
      await saveGroupData(ctx.chat.id, data);
      return ctx.reply('🟢 הגבלת וותק למשתמשים חדשים (/newbiemode) כובתה.');
    }
    if (arg) {
      const secs = parseDurationSeconds(arg);
      if (!secs) return ctx.reply('⚠️ ציין זמן וותק תקין, למשל: `/newbiemode 1h`, `/newbiemode 24h` או `/newbiemode off`.', { parse_mode: 'Markdown' });
      a.newbieWaitSeconds = secs;
      await saveGroupData(ctx.chat.id, data);
      return ctx.reply(`🛡️ הגבלת חדשים הופעלה: משתמש חדש יוכל לשלוח מדיה וקישורים רק אחרי צבירת וותק של *${arg}* בקבוצה.`, { parse_mode: 'Markdown' });
    }
    await ctx.reply(`👶 *הגבלת מדיה למשתמשים חדשים (/newbiemode):*\nמצב נוכחי: *${a.newbieWaitSeconds ? `נדרש וותק של ${Math.round(a.newbieWaitSeconds / 60)} דקות` : 'כבוי ❌'}*\nבחר כמה זמן וותק משתמש צריך לצבור כדי לשלוח מדיה/קישורים:`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '⏱️ 10 דקות', callback_data: 'adv_newb_600' }, { text: '⏱️ שעה אחת', callback_data: 'adv_newb_3600' }], [{ text: '⏱️ 24 שעות', callback_data: 'adv_newb_86400' }, { text: '🔴 כבוי', callback_data: 'adv_newb_0' }]] }
    });
  });

  bot.action(/^adv_newb_(\d+)$/, async (ctx) => {
    if (!(await isGroupAdminCb(ctx))) return ctx.answerCbQuery('⛔ לאדמינים בלבד', { show_alert: true }).catch(() => {});
    const secs = parseInt(ctx.match[1], 10);
    const data = await getGroupData(ctx.chat.id);
    ensureAdv(data).newbieWaitSeconds = secs;
    await saveGroupData(ctx.chat.id, data);
    await ctx.answerCbQuery('עודכן!').catch(() => {});
    await ctx.editMessageText(secs ? `🛡️ הגבלת חדשים הופעלה: נדרש וותק של *${Math.round(secs / 60)} דקות* לשליחת מדיה וקישורים.` : '🟢 הגבלת חדשים כובתה.', { parse_mode: 'Markdown' }).catch(() => {});
  });

  // 17. /honeypot - מלכודת דבש נגד בוטים אוטומטיים
  bot.command('honeypot', async (ctx) => {
    if (!(await requireAdmin(ctx, '/honeypot'))) return;
    await ctx.deleteMessage().catch(() => {});
    await ctx.reply('⚠️ *אזהרת אבטחה לחברי הקבוצה:*\nהכפתור למטה הוא מלכודת אוטומטית ללכידת בוטים של ספאם.\n*אל תלחצו עליו!* כל לחיצה עליו גורמת לחסימה מיידית מהקבוצה.', {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '🤖 Claim Free Crypto Bonus (מלכודת בוטים - לא ללחוץ!)', callback_data: 'hpot_trap' }]] }
    });
  });

  bot.action('hpot_trap', async (ctx) => {
    if (await isGroupAdminCb(ctx)) return ctx.answerCbQuery('👑 אתה אדמין בקבוצה ולכן מלכודת הדבש לא חוסמת אותך.', { show_alert: true }).catch(() => {});
    await ctx.telegram.banChatMember(ctx.chat.id, ctx.from.id).catch(() => {});
    await ctx.answerCbQuery('נחסמת ע"י מלכודת בוטים!').catch(() => {});
    await ctx.reply(`🍯 מלכודת הדבש תפסה וחסמה את ${ctx.from.first_name}!`);
  });

  // 18. /trust - בדיקת מדד אמינות של משתמש בקבוצה
  bot.command('trust', async (ctx) => {
    if (!ctx.chat || ctx.chat.type === 'private') return ctx.reply('⚠️ פקודה זו פועלת בקבוצות בלבד.');
    const target = getTarget(ctx) || { id: ctx.from.id, name: ctx.from.first_name || 'משתמש' };
    const data = await getGroupData(ctx.chat.id);
    const a = ensureAdv(data);
    const st = a.userStats[target.id] || { count: 0, firstSeen: Date.now() };
    const warns = (data.warns[target.id] || []).length;
    const days = Math.max(0, Math.floor((Date.now() - (st.firstSeen || Date.now())) / 86400000));
    const score = Math.max(0, Math.min(100, 50 + Math.min(35, st.count * 2) + Math.min(15, days * 3) - warns * 30));
    await ctx.reply(`🕵️ *מדד אמינות משתמש – ${target.name}:*\n• ציון אמינות משוקלל: *${score}%*\n• הודעות בקבוצה: *${st.count}*\n• וותק מתועד: *${days} ימים*\n• אזהרות פעילות: *${warns}/3*`, { parse_mode: 'Markdown' });
  });

  // 19. /tagall - קריאת התפקדות לחברי הקבוצה (מנהל הקבוצה מפעיל תחילה)
  bot.command('tagall', async (ctx) => {
    if (!(await requireAdmin(ctx, '/tagall [on | off | הודעה לתיוג]'))) return;
    const raw = (ctx.message.text || '').replace(/^\/tagall(@\S+)?\s*/i, '').trim();
    const data = await getGroupData(ctx.chat.id);
    const a = ensureAdv(data);
    if (['on', 'off'].includes(raw.toLowerCase())) {
      a.tagallEnabled = raw.toLowerCase() === 'on';
      await saveGroupData(ctx.chat.id, data);
      return ctx.reply(`📣 פקודת תיוג כולם (/tagall) כעת: *${a.tagallEnabled ? 'פעילה ✅' : 'כבויה ❌'}*`, { parse_mode: 'Markdown' });
    }
    if (!a.tagallEnabled) return ctx.reply('⚠️ פקודת `/tagall` כבויה כרגע. להפעלה שלח תחילה: `/tagall on`', { parse_mode: 'Markdown' });
    const users = Object.entries(a.userStats).slice(-30);
    if (!users.length) return ctx.reply('📭 עדיין אין מספיק חברים פעילים מתועדים לתיוג.');
    const mentions = users.map(([uid, u]) => `[${u.name || 'חבר'}](tg://user?id=${uid})`).join(', ');
    await ctx.reply(`📣 *קריאת מנהל הקבוצה:* ${raw || 'שימו לב!'}\n\n${mentions}`, { parse_mode: 'Markdown' });
  });

  // 20. /backup ו-/restore - גיבוי ושחזור מלא של הגדרות הקבוצה
  bot.command('backup', async (ctx) => {
    if (!(await requireAdmin(ctx, '/backup'))) return;
    const data = await getGroupData(ctx.chat.id);
    const payload = { rules: data.rules, welcomeEnabled: data.welcomeEnabled, welcomeText: data.welcomeText, filters: data.filters, customCommands: data.customCommands, cleanService: data.cleanService, antispam: data.antispam, antilink: data.antilink, antiflood: data.antiflood, locks: data.locks };
    const code = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
    await ctx.reply(`💾 *גיבוי הגדרות הקבוצה מוכן!*\nשמור את קוד הגיבוי הבא. לשחזור בכל קבוצה שלח \`/restore\` ואחריו את הקוד:\n\n\`${code}\``, { parse_mode: 'Markdown' });
  });

  bot.command('restore', async (ctx) => {
    if (!(await requireAdmin(ctx, '/restore [קוד גיבוי]'))) return;
    const code = (ctx.message.text || '').trim().split(/\s+/)[1];
    if (!code) return ctx.reply('⚠️ שימוש: `/restore [קוד הגיבוי שקיבלת ב-/backup]`', { parse_mode: 'Markdown' });
    try {
      const parsed = JSON.parse(Buffer.from(code, 'base64').toString('utf8'));
      const data = await getGroupData(ctx.chat.id);
      Object.assign(data, parsed);
      await saveGroupData(ctx.chat.id, data);
      await ctx.reply('✅ כל הגדרות הקבוצה, החוקים, הפילטרים והפקודות המותאמות שוחזרו בהצלחה!');
    } catch (e) { await ctx.reply('❌ קוד הגיבוי אינו תקין.'); }
  });

  // ניטור אוטומטי של כל 20 הפיצ'רים החדשים בקבוצה
  bot.use(async (ctx, next) => {
    if (!ctx.chat || ctx.chat.type === 'private' || !ctx.message || !ctx.from) return next();
    try {
      const chatId = ctx.chat.id;
      const userId = ctx.from.id;
      const msg = ctx.message;
      const data = await getGroupData(chatId);
      const a = ensureAdv(data);
      let changed = false;

      if (!ctx.from.is_bot) {
        const uKey = `${chatId}:${userId}`;
        recentUserMsgs[uKey] = recentUserMsgs[uKey] || [];
        recentUserMsgs[uKey].push(msg.message_id);
        if (recentUserMsgs[uKey].length > 60) recentUserMsgs[uKey].shift();

        if (!a.userStats[userId]) {
          a.userStats[userId] = { name: ctx.from.first_name || 'חבר', count: 0, firstSeen: Date.now() };
          changed = true;
        }
        if (msg.text && !msg.text.startsWith('/')) {
          a.userStats[userId].name = ctx.from.first_name || a.userStats[userId].name;
          a.userStats[userId].count = (a.userStats[userId].count || 0) + 1;
          changed = true;
        }
      }

      if (msg.new_chat_members && msg.new_chat_members.length) {
        const now = Date.now();
        joinTracker[chatId] = (joinTracker[chatId] || []).filter((t) => now - t < 15000);
        joinTracker[chatId].push(now);

        if (a.raidAuto && joinTracker[chatId].length >= 5 && a.raidUntil < now) {
          a.raidUntil = now + 30 * 60 * 1000;
          changed = true;
          await ctx.reply('🚨 *זוהתה מתקפת בוטים אוטומטית!* מצב חירום (Raid Mode) הופעל ל-30 דקות.');
        }

        for (const member of msg.new_chat_members) {
          if (member.is_bot) continue;
          if (a.raidUntil > now) {
            await ctx.telegram.banChatMember(chatId, member.id).catch(() => {});
            continue;
          }
          if (a.verifyEnabled) {
            await ctx.telegram.restrictChatMember(chatId, member.id, { permissions: { can_send_messages: false } }).catch(() => {});
            const vMsg = await ctx.reply(
              `🔐 שלום *${member.first_name}*! כדי לוודא שאינך בוט ולקבל הרשאת כתיבה בקבוצה, לחץ על סמל **המפתח 🔑** למטה${a.verifySeconds > 0 ? ` תוך ${a.verifySeconds} שניות` : ''}:`,
              { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🎈', callback_data: `ver_ok_${member.id}_0` }, { text: '🔑', callback_data: `ver_ok_${member.id}_1` }, { text: '🍎', callback_data: `ver_ok_${member.id}_0` }]] } }
            );
            if (a.verifySeconds > 0) {
              const tKey = `${chatId}:${member.id}`;
              verifyTimers[tKey] = setTimeout(async () => {
                delete verifyTimers[tKey];
                await ctx.telegram.banChatMember(chatId, member.id).catch(() => {});
                await ctx.telegram.unbanChatMember(chatId, member.id).catch(() => {});
                await ctx.telegram.deleteMessage(chatId, vMsg.message_id).catch(() => {});
              }, a.verifySeconds * 1000);
            }
          }
        }
      }

      if (changed) await saveGroupData(chatId, data);

      const rawText = (msg.text || msg.caption || '').trim();
      if (rawText.startsWith('/')) return next();

      const lowerText = rawText.toLowerCase();
      if (lowerText && a.autoReplies) {
        for (const [trigger, response] of Object.entries(a.autoReplies)) {
          if (trigger && lowerText.includes(trigger.toLowerCase())) {
            await ctx.reply(response, { reply_to_message_id: msg.message_id }).catch(() => {});
            break;
          }
        }
      }

      const member = await ctx.telegram.getChatMember(chatId, userId).catch(() => null);
      if (member && ['creator', 'administrator'].includes(member.status)) return next();

      if (a.nightmode && a.nightmode.enabled) {
        const { totalMinutes } = getIsraelTimeMinutes();
        const sMin = parseTimeMinutes(a.nightmode.start);
        const eMin = parseTimeMinutes(a.nightmode.end);
        if (sMin !== null && eMin !== null && isNowInWindow(totalMinutes, sMin, eMin)) {
          await ctx.deleteMessage().catch(() => {});
          return;
        }
      }

      if (a.antiforward && (msg.forward_date || msg.forward_from || msg.forward_from_chat)) {
        await ctx.deleteMessage().catch(() => {});
        return;
      }

      if (rawText && a.foreignLangs) {
        if (a.foreignLangs.ar && /[\u0600-\u06FF]/.test(rawText)) return ctx.deleteMessage().catch(() => {});
        if (a.foreignLangs.ru && /[\u0400-\u04FF]/.test(rawText)) return ctx.deleteMessage().catch(() => {});
        if (a.foreignLangs.zh && /[\u4E00-\u9FFF\u3040-\u30FF]/.test(rawText)) return ctx.deleteMessage().catch(() => {});
        if (a.foreignLangs.hi && /[\u0900-\u097F\u0E00-\u0E7F]/.test(rawText)) return ctx.deleteMessage().catch(() => {});
      }

      if (a.newbieWaitSeconds > 0) {
        const firstSeen = a.userStats[userId]?.firstSeen || Date.now();
        const hasMediaOrLink = Boolean(msg.photo || msg.video || msg.document || msg.sticker || /(https?:\/\/|t\.me\/|www\.)/i.test(rawText));
        if (hasMediaOrLink && (Date.now() - firstSeen) < a.newbieWaitSeconds * 1000) {
          await ctx.deleteMessage().catch(() => {});
          return;
        }
      }

      if (a.quotas && a.quotas[userId]) {
        const dayKey = `${getIsraelDateKey()}:${userId}`;
        a.quotaUsage[dayKey] = (a.quotaUsage[dayKey] || 0) + 1;
        await saveGroupData(chatId, data);
        if (a.quotaUsage[dayKey] > a.quotas[userId]) {
          await ctx.deleteMessage().catch(() => {});
          return;
        }
      }
    } catch (e) {}
    return next();
  });
};
