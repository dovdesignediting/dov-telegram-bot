const https = require('https');
const { getGroupData, saveGroupData } = require('./utils');

const CREATOR_ID = 1773089386;
const VALID_LANGS = new Set(['he', 'en', 'es']);
const LANG_STATE_KEY = 'lang_global_state';
const WEBAPP_BASE = 'https://dov-telegram-bot.vercel.app/webapp.html';

const txCache = new Map();
const recentGroupWelcome = new Map();

function normalizeLang(lang) {
  const l = String(lang || '').trim().toLowerCase();
  return VALID_LANGS.has(l) ? l : null;
}

async function getLangState() {
  const s = await getGroupData(LANG_STATE_KEY);
  s.users = s.users && typeof s.users === 'object' ? s.users : {};
  return s;
}

async function getUserLang(uid) {
  if (!uid) return null;
  const s = await getLangState();
  return normalizeLang(s.users[String(uid)]);
}

async function setUserLang(uid, lang) {
  const clean = normalizeLang(lang);
  if (!uid || !clean) return null;
  const s = await getLangState();
  s.users[String(uid)] = clean;
  await saveGroupData(LANG_STATE_KEY, s);
  return clean;
}

async function getGroupLang(chatId) {
  if (!chatId) return null;
  const g = await getGroupData(chatId);
  return normalizeLang(g.lang);
}

async function setGroupLang(chatId, lang) {
  const clean = normalizeLang(lang);
  if (!chatId || !clean) return null;
  const g = await getGroupData(chatId);
  g.lang = clean;
  await saveGroupData(chatId, g);
  return clean;
}

function getLangPickerKeyboard(isGroup = false, currentLang = null) {
  const mark = (code) => (currentLang === code ? '✅ ' : '');
  const rows = [
    [
      { text: `${mark('he')}🇮🇱 עברית`, callback_data: 'lang_set_he' },
      { text: `${mark('en')}🇺🇸 English`, callback_data: 'lang_set_en' },
      { text: `${mark('es')}🇪🇸 Español`, callback_data: 'lang_set_es' }
    ]
  ];
  if (!isGroup && currentLang) {
    const backLbl =
      currentLang === 'en' ? '🔙 Back to Main Menu' :
      currentLang === 'es' ? '🔙 Volver al menú principal' :
      '🔙 חזרה לתפריט הראשי';
    rows.push([{ text: backLbl, callback_data: 'help_main' }]);
  }
  return { inline_keyboard: rows };
}

function getOnboardingText(isGroup = false) {
  if (isGroup) {
    return (
      `🌐 *בחירת שפת הבוט לקבוצה | Choose Group Language | Elige el idioma del grupo*\n\n` +
      `🇮🇱 שלום! תודה שהוספתם את *וולטיק מוד* לקבוצה. מנהל קבוצה, בחר באיזו שפה הבוט והמיני-אפליקציה יעבדו:\n` +
      `🇺🇸 Hello! Thanks for adding *VolticMod* to the group. Group admin, please choose the language for the bot & Mini App:\n` +
      `🇪🇸 ¡Hola! Gracias por añadir *VolticMod* al grupo. Administrador del grupo, elige el idioma del bot y la Mini App:\n\n` +
      `🛡️ _רק מנהל קבוצה יכול לבחור או לשנות את השפה • Only group admins can choose • Solo los administradores pueden elegir_`
    );
  }
  return (
    `🌐 *בחר את שפת הבוט | Choose Bot Language | Elige el idioma del bot*\n\n` +
    `🇮🇱 שלום! באיזו שפה תרצה שהבוט והמיני-אפליקציה יעבדו?\n` +
    `🇺🇸 Hello! Which language would you like the bot and Mini App to use?\n` +
    `🇪🇸 ¡Hola! ¿En qué idioma quieres que funcionen el bot y la Mini App?`
  );
}

function getLangChangedText(lang, isGroup = false) {
  if (lang === 'en') {
    return isGroup
      ? '✅ *Group language set to English!*\nThe bot and the Mini App will now work in English for this group.'
      : '✅ *Language set to English!*\nThe bot and the Mini App will now work in English.';
  }
  if (lang === 'es') {
    return isGroup
      ? '✅ *¡Idioma del grupo configurado en Español!*\nEl bot y la Mini App ahora funcionarán en español en este grupo.'
      : '✅ *¡Idioma configurado en Español!*\nEl bot y la Mini App ahora funcionarán en español.';
  }
  return isGroup
    ? '✅ *שפת הבוט בקבוצה הוגדרה לעברית!*\nהבוט והמיני-אפליקציה יעבדו מעכשיו בעברית בקבוצה זו.'
    : '✅ *שפת הבוט הוגדרה לעברית!*\nהבוט והמיני-אפליקציה יעבדו מעכשיו בעברית.';
}

function getAdminOnlyLangAlert(lang) {
  if (lang === 'en') return '⛔ Only a group admin can choose or change the bot language!';
  if (lang === 'es') return '⛔ ¡Solo un administrador del grupo puede elegir o cambiar el idioma del bot!';
  return '⛔ רק מנהל קבוצה יכול לבחור או לשנות את שפת הבוט! | Only group admins can change the language.';
}

function getLangButtonLabel(lang) {
  if (lang === 'en') return '🌐 Change Language (English)';
  if (lang === 'es') return '🌐 Cambiar idioma (Español)';
  return '🌐 שינוי שפה (עברית)';
}

// מילון מהיר ומדויק ללחצנים ותפריטים עיקריים (0ms, ללא טעויות תרגום)
const EXACT_BUTTON_MAP = {
  en: {
    '📱 מיני-אפליקציה לניהול קבוצות': '📱 Group Management Mini App',
    '📱 פתח עכשיו את המיני-אפליקציה': '📱 Open Mini App Now',
    '📱 פתח מיני-אפליקציה לניהול קבוצות': '📱 Open Group Management Mini App',
    '📱 פתח מיני-אפליקציה לניהול הקבוצה': '📱 Open Group Mini App',
    '📱 פתח עכשיו מיני-אפליקציה לניהול הקבוצה': '📱 Open Group Mini App Now',
    '👑 קבוצת התמיכה של הבוט – צוות המייסדים': '👑 Support Group – Founders Team',
    '👮 ניהול משתמשים': '👮 User Management',
    '🧹 תוכן וניקוי': '🧹 Content & Cleanup',
    '🛡️ אוטומציה והגנה': '🛡️ Automation & Protection',
    'ℹ️ קהילה ופעילויות': 'ℹ️ Community & Activities',
    '⚙️ מערכת וגיבוי': '⚙️ System & Backup',
    '🎨 מדריך כפתורים ועיצוב': '🎨 Formatting & Buttons Guide',
    '🌐 תרגום קובץ לעברית': '🌐 Translate File',
    '❓ שאלה ליוצר': '❓ Ask the Creator',
    '💡 הצעה לשיפור': '💡 Suggest a Feature',
    '💡 שלח הצעה לשיפור': '💡 Send a Suggestion',
    '⭐ דירוג הבוט': '⭐ Rate the Bot',
    '📘 מדריך ותיעוד הבוט': '📘 Bot Guide & Docs',
    '🛠️ מה בפיתוח ובתיקונים': '🛠️ Roadmap & Fixes',
    '♻️עדכון גרסת הבוט♻️': '♻️ Update Bot Version ♻️',
    '🔙 חזרה לתפריט הראשי': '🔙 Back to Main Menu',
    '🔙 חזרה': '🔙 Back',
    '❌ ביטול': '❌ Cancel',
    '➕ הוסף את הבוט לקבוצה': '➕ Add Bot to Group',
    '➕ הוסף את וולטיק מוד לקבוצה חדשה': '➕ Add VolticMod to a New Group',
    '💬 לחץ כאן למעבר לפרטי של הבוט': '💬 Open Private Chat with Bot',
    '📖 לחץ כאן לצפייה בחוקי הקבוצה': '📖 Click to View Group Rules',
    '⏭️ דילוג (שלח דירוג ללא פידבק)': '⏭️ Skip (Send Rating Only)',
    '📚 מעבר לתפריט הפקודות המעודכן': '📚 Open Updated Command Menu',
    '📚 פתיחת תפריט הבוט': '📚 Open Bot Menu'
  },
  es: {
    '📱 מיני-אפליקציה לניהול קבוצות': '📱 Mini App de gestión de grupos',
    '📱 פתח עכשיו את המיני-אפליקציה': '📱 Abrir Mini App ahora',
    '📱 פתח מיני-אפליקציה לניהול קבוצות': '📱 Abrir Mini App de grupos',
    '📱 פתח מיני-אפליקציה לניהול הקבוצה': '📱 Abrir Mini App del grupo',
    '📱 פתח עכשיו מיני-אפליקציה לניהול הקבוצה': '📱 Abrir Mini App del grupo ahora',
    '👑 קבוצת התמיכה של הבוט – צוות המייסדים': '👑 Grupo de soporte – Fundadores',
    '👮 ניהול משתמשים': '👮 Gestión de usuarios',
    '🧹 תוכן וניקוי': '🧹 Contenido y limpieza',
    '🛡️ אוטומציה והגנה': '🛡️ Automatización y protección',
    'ℹ️ קהילה ופעילויות': 'ℹ️ Comunidad y actividades',
    '⚙️ מערכת וגיבוי': '⚙️ Sistema y respaldo',
    '🎨 מדריך כפתורים ועיצוב': '🎨 Guía de formato y botones',
    '🌐 תרגום קובץ לעברית': '🌐 Traducir archivo',
    '❓ שאלה ליוצר': '❓ Preguntar al creador',
    '💡 הצעה לשיפור': '💡 Sugerir mejora',
    '💡 שלח הצעה לשיפור': '💡 Enviar sugerencia',
    '⭐ דירוג הבוט': '⭐ Calificar el bot',
    '📘 מדריך ותיעוד הבוט': '📘 Guía y documentación',
    '🛠️ מה בפיתוח ובתיקונים': '🛠️ En desarrollo y mejoras',
    '♻️עדכון גרסת הבוט♻️': '♻️ Actualizar versión del bot ♻️',
    '🔙 חזרה לתפריט הראשי': '🔙 Volver al menú principal',
    '🔙 חזרה': '🔙 Volver',
    '❌ ביטול': '❌ Cancelar',
    '➕ הוסף את הבוט לקבוצה': '➕ Añadir bot a un grupo',
    '➕ הוסף את וולטיק מוד לקבוצה חדשה': '➕ Añadir VolticMod a un grupo',
    '💬 לחץ כאן למעבר לפרטי של הבוט': '💬 Ir al chat privado del bot',
    '📖 לחץ כאן לצפייה בחוקי הקבוצה': '📖 Ver reglas del grupo',
    '⏭️ דילוג (שלח דירוג ללא פידבק)': '⏭️ Omitir (solo enviar calificación)',
    '📚 מעבר לתפריט הפקודות המעודכן': '📚 Ir al menú actualizado',
    '📚 פתיחת תפריט הבוט': '📚 Abrir menú del bot'
  }
};

function hasHebrew(str) {
  return /[\u0590-\u05FF]/.test(String(str || ''));
}

function googleTranslateRaw(text, targetLang) {
  return new Promise((resolve) => {
    const clean = String(text || '');
    if (!clean.trim() || !hasHebrew(clean)) return resolve(clean);
    const url =
      'https://translate.googleapis.com/translate_a/single?client=gtx&sl=iw&tl=' +
      encodeURIComponent(targetLang) +
      '&dt=t&q=' +
      encodeURIComponent(clean.slice(0, 3500));

    const req = https.get(url, { timeout: 3500 }, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (Array.isArray(parsed?.[0])) {
            return resolve(parsed[0].map((x) => x?.[0] || '').join(''));
          }
        } catch (e) {}
        resolve(clean);
      });
    });
    req.on('timeout', () => { req.destroy(); resolve(clean); });
    req.on('error', () => resolve(clean));
  });
}

async function translateTextCached(rawText, lang) {
  const txt = String(rawText || '');
  if (!txt || lang === 'he' || !VALID_LANGS.has(lang) || !hasHebrew(txt)) return txt;

  const exact = EXACT_BUTTON_MAP[lang]?.[txt.trim()];
  if (exact) return exact;

  // תרגום מהיר לכפתור מספר עדכון
  const verBtnMatch = txt.trim().match(/^🆕\s*עדכון מספר\s+([0-9.]+v?)(.*)$/i);
  if (verBtnMatch) {
    const verNum = verBtnMatch[1];
    return lang === 'en' ? `🆕 Update ${verNum}` : `🆕 Actualización ${verNum}`;
  }

  // תרגום מהיר לתפריט הראשי (שומר על עיצוב Markdown מלא)
  if (txt.includes('תפריט הפקודות הראשי') && txt.includes('גרסה נוכחית')) {
    const verM = txt.match(/עדכון(?:\s+מספר)?\s+([0-9.]+v?)/i);
    const verStr = verM ? verM[1] : '1.2.2.1v';
    if (lang === 'en') {
      return (
        `Hello! 👋\nI am an advanced group management and protection bot.\n` +
        `🔖 *Current version:* Update ${verStr}\n` +
        `👑 *Bot Support Group:* [Founders Team](https://t.me/+v4Hrdnpg0rI3MTk0)\n\n` +
        `📚 *Main Command Menu – Choose a category below:*`
      );
    }
    if (lang === 'es') {
      return (
        `¡Hola! 👋\nSoy un bot avanzado para la gestión y protección de grupos.\n` +
        `🔖 *Versión actual:* Actualización ${verStr}\n` +
        `👑 *Grupo de soporte:* [Equipo de Fundadores](https://t.me/+v4Hrdnpg0rI3MTk0)\n\n` +
        `📚 *Menú principal de comandos – Elige una categoría abajo:*`
      );
    }
  }

  const cacheKey = `${lang}:${txt}`;
  if (txCache.has(cacheKey)) return txCache.get(cacheKey);

  // הגנה על פקודות (/cmd), קישורים, שמות משתמש וסימני קוד מפני שיבוש בתרגום
  const tokens = [];
  const masked = txt.replace(/(https?:\/\/[^\s)\]]+|`[^`\n]+`|\/[a-zA-Z0-9_]+|@[a-zA-Z0-9_]+|\{[a-zA-Z0-9_]+\})/g, (m) => {
    const idx = tokens.length;
    tokens.push(m);
    return `[[T${idx}]]`;
  });

  let translated = await googleTranslateRaw(masked, lang);
  translated = translated.replace(/\[\[\s*T(\d+)\s*\]\]/gi, (_, idxStr) => tokens[Number(idxStr)] ?? '');

  if (txCache.size > 600) {
    const firstKey = txCache.keys().next().value;
    txCache.delete(firstKey);
  }
  txCache.set(cacheKey, translated);
  return translated;
}

async function translateInlineKeyboard(kb, lang) {
  if (!Array.isArray(kb)) return kb;
  const out = [];
  for (const row of kb) {
    if (!Array.isArray(row)) continue;
    const newRow = [];
    for (const btn of row) {
      if (!btn || typeof btn !== 'object') continue;
      const copy = { ...btn };
      if (copy.web_app && typeof copy.web_app.url === 'string' && copy.web_app.url.includes('webapp.html')) {
        try {
          const u = new URL(copy.web_app.url);
          u.searchParams.set('lang', lang || 'he');
          copy.web_app = { ...copy.web_app, url: u.toString() };
        } catch (e) {}
      }
      if (lang && lang !== 'he' && typeof copy.text === 'string' && !copy.callback_data?.startsWith('lang_set_')) {
        copy.text = await translateTextCached(copy.text, lang);
      }
      newRow.push(copy);
    }
    out.push(newRow);
  }
  return out;
}

function appendLangToWebAppButtons(kb, lang) {
  if (!Array.isArray(kb)) return;
  for (const row of kb) {
    if (!Array.isArray(row)) continue;
    for (const btn of row) {
      if (btn?.web_app && typeof btn.web_app.url === 'string' && btn.web_app.url.includes('webapp.html')) {
        try {
          const u = new URL(btn.web_app.url);
          u.searchParams.set('lang', lang || 'he');
          btn.web_app.url = u.toString();
        } catch (e) {}
      }
    }
  }
}

async function isGroupAdminUser(telegram, chatId, userId) {
  if (Number(userId) === CREATOR_ID) return true;
  try {
    const m = await telegram.getChatMember(chatId, userId);
    return Boolean(m && ['creator', 'administrator'].includes(m.status));
  } catch (e) {
    return false;
  }
}

async function resolveActiveLang(chat, uid) {
  if (chat && ['group', 'supergroup'].includes(chat.type)) {
    return (await getGroupLang(chat.id)) || 'he';
  }
  if (uid) {
    return (await getUserLang(uid)) || 'he';
  }
  return 'he';
}

function wrapUpdates(bot) {
  if (!bot || bot._i18nUpdatesWrapped) return;
  bot._i18nUpdatesWrapped = true;

  // 1. עטיפת handleUpdate (שכבה חיצונית): קליטת שפה פעילה, בחירת שפה ראשונית ב-/start, והוספת הבוט לקבוצה
  const origHandleUpdate = bot.handleUpdate.bind(bot);
  bot.handleUpdate = async function (update, ...rest) {
    try {
      const msg = update?.message;
      const cb = update?.callback_query;
      const myMember = update?.my_chat_member;

      // זיהוי הוספת הבוט לקבוצה חדשה (my_chat_member)
      if (myMember && myMember.chat && ['group', 'supergroup'].includes(myMember.chat.type)) {
        const oldSt = myMember.old_chat_member?.status;
        const newSt = myMember.new_chat_member?.status;
        if (['left', 'kicked'].includes(oldSt) && ['member', 'administrator'].includes(newSt)) {
          const gid = String(myMember.chat.id);
          const lastT = recentGroupWelcome.get(gid) || 0;
          if (Date.now() - lastT > 15000) {
            recentGroupWelcome.set(gid, Date.now());
            const curLang = await getGroupLang(gid);
            await bot.telegram.callApi('sendMessage', {
              chat_id: myMember.chat.id,
              text: getOnboardingText(true),
              parse_mode: 'Markdown',
              reply_markup: getLangPickerKeyboard(true, curLang),
              _skipI18n: true
            }).catch(() => {});
          }
        }
      }

      // זיהוי הוספת הבוט לקבוצה גם דרך new_chat_members
      if (msg && msg.chat && ['group', 'supergroup'].includes(msg.chat.type) && Array.isArray(msg.new_chat_members)) {
        const botId = bot.botInfo?.id;
        const botAdded = msg.new_chat_members.some((m) => m.is_bot && (botId ? m.id === botId : m.username === 'VolticMod_bot'));
        if (botAdded) {
          const gid = String(msg.chat.id);
          const lastT = recentGroupWelcome.get(gid) || 0;
          if (Date.now() - lastT > 15000) {
            recentGroupWelcome.set(gid, Date.now());
            const curLang = await getGroupLang(gid);
            await bot.telegram.callApi('sendMessage', {
              chat_id: msg.chat.id,
              text: getOnboardingText(true),
              parse_mode: 'Markdown',
              reply_markup: getLangPickerKeyboard(true, curLang),
              _skipI18n: true
            }).catch(() => {});
          }
        }
      }

      const chat = msg?.chat || cb?.message?.chat;
      const from = msg?.from || cb?.from;
      const uid = from?.id ? String(from.id) : '';
      const isGroup = Boolean(chat && ['group', 'supergroup'].includes(chat.type));
      const isPrivate = Boolean(chat && chat.type === 'private');

      // הגדרת שפה פעילה לבקשה הנוכחית
      bot._activeLang = await resolveActiveLang(chat, uid);

      // פקודת /lang או /language בכל מקום (בקבוצה רק למנהל)
      const rawText = String(msg?.text || '').trim();
      if (rawText.startsWith('/')) {
        const cmd = rawText.split(/\s+/)[0].replace(/^\//, '').split('@')[0].toLowerCase();
        const cmdArg = rawText.split(/\s+/).slice(1).join(' ').trim();

        if (cmd === 'lang' || cmd === 'language') {
          if (isGroup && !(await isGroupAdminUser(bot.telegram, chat.id, uid))) {
            await bot.telegram.callApi('sendMessage', {
              chat_id: chat.id,
              text: getAdminOnlyLangAlert(bot._activeLang),
              _skipI18n: true
            }).catch(() => {});
            return;
          }
          const curLang = isGroup ? await getGroupLang(chat.id) : await getUserLang(uid);
          await bot.telegram.callApi('sendMessage', {
            chat_id: chat.id,
            text: getOnboardingText(isGroup),
            parse_mode: 'Markdown',
            reply_markup: getLangPickerKeyboard(isGroup, curLang),
            _skipI18n: true
          }).catch(() => {});
          return;
        }

        // הפעלה ראשונה בפרטי (/start ללא פרמטר מיוחד): אם המשתמש עדיין לא בחר שפה – מבקש לבחור שפה קודם
        if (isPrivate && cmd === 'start' && !cmdArg) {
          const savedLang = await getUserLang(uid);
          if (!savedLang) {
            await bot.telegram.callApi('sendMessage', {
              chat_id: chat.id,
              text: getOnboardingText(false),
              parse_mode: 'Markdown',
              reply_markup: getLangPickerKeyboard(false, null),
              _skipI18n: true
            }).catch(() => {});
            return;
          }
        }
      }

      // טיפול בלחיצה על כפתור שינוי שפה מהתפריט הראשי (lang_open)
      if (cb && cb.data === 'lang_open') {
        if (isGroup && !(await isGroupAdminUser(bot.telegram, chat.id, uid))) {
          await bot.telegram.callApi('answerCallbackQuery', {
            callback_query_id: cb.id,
            text: getAdminOnlyLangAlert(bot._activeLang),
            show_alert: true,
            _skipI18n: true
          }).catch(() => {});
          return;
        }
        await bot.telegram.callApi('answerCallbackQuery', { callback_query_id: cb.id, _skipI18n: true }).catch(() => {});
        const curLang = isGroup ? await getGroupLang(chat.id) : await getUserLang(uid);
        await bot.telegram.callApi('editMessageText', {
          chat_id: chat.id,
          message_id: cb.message?.message_id,
          text: getOnboardingText(isGroup),
          parse_mode: 'Markdown',
          reply_markup: getLangPickerKeyboard(isGroup, curLang),
          _skipI18n: true
        }).catch(() =>
          bot.telegram.callApi('sendMessage', {
            chat_id: chat.id,
            text: getOnboardingText(isGroup),
            parse_mode: 'Markdown',
            reply_markup: getLangPickerKeyboard(isGroup, curLang),
            _skipI18n: true
          }).catch(() => {})
        );
        return;
      }

      // טיפול בבחירת שפה (lang_set_he / lang_set_en / lang_set_es)
      if (cb && /^lang_set_(he|en|es)$/.test(cb.data || '')) {
        const chosen = cb.data.replace('lang_set_', '');
        if (isGroup && !(await isGroupAdminUser(bot.telegram, chat.id, uid))) {
          await bot.telegram.callApi('answerCallbackQuery', {
            callback_query_id: cb.id,
            text: getAdminOnlyLangAlert(bot._activeLang),
            show_alert: true,
            _skipI18n: true
          }).catch(() => {});
          return;
        }

        if (isGroup) {
          await setGroupLang(chat.id, chosen);
        } else if (uid) {
          await setUserLang(uid, chosen);
        }
        bot._activeLang = chosen;

        const toast =
          chosen === 'en' ? '✅ Language set to English!' :
          chosen === 'es' ? '✅ ¡Idioma cambiado a Español!' :
          '✅ השפה עודכנה לעברית!';

        await bot.telegram.callApi('answerCallbackQuery', {
          callback_query_id: cb.id,
          text: toast,
          _skipI18n: true
        }).catch(() => {});

        const openMenuBtn =
          chosen === 'en' ? '📚 Open Main Menu' :
          chosen === 'es' ? '📚 Abrir menú principal' :
          '📚 פתח את התפריט הראשי';

        const appBtnText =
          chosen === 'en' ? '📱 Group Management Mini App' :
          chosen === 'es' ? '📱 Mini App de gestión de grupos' :
          '📱 מיני-אפליקציה לניהול קבוצות';

        const nextKb = isGroup
          ? { inline_keyboard: [[{ text: openMenuBtn, callback_data: 'help_main' }]] }
          : {
              inline_keyboard: [
                [{ text: appBtnText, web_app: { url: `${WEBAPP_BASE}?lang=${chosen}` } }],
                [{ text: openMenuBtn, callback_data: 'help_main' }]
              ]
            };

        await bot.telegram.callApi('editMessageText', {
          chat_id: chat.id,
          message_id: cb.message?.message_id,
          text: getLangChangedText(chosen, isGroup),
          parse_mode: 'Markdown',
          reply_markup: nextKb,
          _skipI18n: true
        }).catch(() =>
          bot.telegram.callApi('sendMessage', {
            chat_id: chat.id,
            text: getLangChangedText(chosen, isGroup),
            parse_mode: 'Markdown',
            reply_markup: nextKb,
            _skipI18n: true
          }).catch(() => {})
        );
        return;
      }
    } catch (e) {}

    return origHandleUpdate(update, ...rest);
  };
}

function registerI18n(bot) {
  if (!bot || bot._i18nCallWrapped) return;
  bot._i18nCallWrapped = true;

  // 2. עטיפת callApi (שכבה פנימית): רצה אחרי info.js -> מזריקה כפתור שפה בתפריט הראשי + ?lang + מתרגמת
  const origCall = bot.telegram.callApi.bind(bot.telegram);
  const i18nCallApi = async function (method, payload, ...rest) {
    if (payload && payload._skipI18n) {
      const cleanPayload = { ...payload };
      delete cleanPayload._skipI18n;
      return origCall(method, cleanPayload, ...rest);
    }

    try {
      const lang = bot._activeLang || 'he';

      if ((method === 'sendMessage' || method === 'editMessageText') && payload && typeof payload.text === 'string') {
        const kb = payload.reply_markup?.inline_keyboard;

        // הזרקת כפתור שינוי שפה ישירות בתפריט הראשי (ולא בתת-תפריט!)
        if (Array.isArray(kb) && payload.text.includes('תפריט הפקודות הראשי')) {
          if (!kb.some((r) => Array.isArray(r) && r.some((b) => b?.callback_data === 'lang_open'))) {
            kb.push([{ text: getLangButtonLabel(lang), callback_data: 'lang_open' }]);
          }
        }

        // הוספת ?lang= לכתובת המיני-אפליקציה בכל כפתור web_app
        if (Array.isArray(kb)) {
          appendLangToWebAppButtons(kb, lang);
        }

        // תרגום ההודעה והכפתורים אם השפה היא אנגלית או ספרדית
        if (lang !== 'he') {
          payload.text = await translateTextCached(payload.text, lang);
          if (Array.isArray(kb)) {
            payload.reply_markup.inline_keyboard = await translateInlineKeyboard(kb, lang);
          }
        }
      } else if (method === 'answerCallbackQuery' && payload && typeof payload.text === 'string') {
        const lang = bot._activeLang || 'he';
        if (lang !== 'he') {
          payload.text = await translateTextCached(payload.text, lang);
        }
      } else if (['sendPhoto', 'sendVideo', 'sendDocument'].includes(method) && payload) {
        const lang = bot._activeLang || 'he';
        if (lang !== 'he' && typeof payload.caption === 'string') {
          payload.caption = await translateTextCached(payload.caption, lang);
        }
        if (Array.isArray(payload.reply_markup?.inline_keyboard)) {
          appendLangToWebAppButtons(payload.reply_markup.inline_keyboard, lang);
          if (lang !== 'he') {
            payload.reply_markup.inline_keyboard = await translateInlineKeyboard(payload.reply_markup.inline_keyboard, lang);
          }
        }
      }
    } catch (e) {}

    return origCall(method, payload, ...rest);
  };

  bot.telegram.callApi = i18nCallApi;
  const tgProto = Object.getPrototypeOf(bot.telegram);
  if (tgProto) {
    tgProto.callApi = i18nCallApi;
  }
}

registerI18n.wrapUpdates = wrapUpdates;
registerI18n.getUserLang = getUserLang;
registerI18n.setUserLang = setUserLang;
registerI18n.getGroupLang = getGroupLang;
registerI18n.setGroupLang = setGroupLang;

module.exports = registerI18n;
