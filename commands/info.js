const crypto=require('crypto');const https=require('https');const {getGroupData,saveGroupData,parseRichMessage,sendFormattedMessage,requireAdmin,getTarget}=require('./utils');
const CREATOR_ID=1773089386;const FOUNDERS_CHAT_ID='-1004417781995';const LATEST_VERSION='1.2.2.1v';const PREV_VER='1.2.1.0v';
const isCrId=(id)=>Number(id)===CREATOR_ID;const isCreator=(ctx)=>isCrId(ctx.from?.id);const isFoundersChatId=(cid)=>{const s=String(cid||'');
return s===FOUNDERS_CHAT_ID||s==='-4417781995'||s.endsWith('4417781995');};const noop=()=>{};const PM='Markdown';
const cbBtn=(text,callback_data)=>({text,callback_data});
const urlBtn=(text,url)=>({text,url});const mdKb=(inline_keyboard)=>({parse_mode:PM,reply_markup:{inline_keyboard}});
const getGD=getGroupData,saveGD=saveGroupData,getInfoSt=()=>getGD('info_global_state'),saveInfoSt=(s)=>saveGD('info_global_state',s);
const ack=(ctx,t,a)=>ctx.answerCbQuery(t,a?{show_alert:true}:undefined).catch(noop);const editMd=(ctx,t,rm)=>ctx.editMessageText(t,{parse_mode:PM,...(rm?{reply_markup:rm}:{})}).catch(()=>ctx.reply(t,{parse_mode:PM,...(rm?{reply_markup:rm}:{})}));
const sendApi=(b,chat_id,text,kb)=>callTg(b,'sendMessage',{chat_id,text,parse_mode:PM,...(kb?{reply_markup:rmKb(kb)}:{})}).catch(noop);
const ackApi=(b,cb,text,show_alert)=>callTg(b,'answerCbQuery',{callback_query_id:cb.id,text,...(show_alert?{show_alert:true}:{})}).catch(noop);
const rmKb=(inline_keyboard)=>({inline_keyboard});const repMd=(ctx,t,kb)=>ctx.reply(t,{parse_mode:PM,...(kb?{reply_markup:rmKb(kb)}:{})});
const callTg=(b,m,p)=>b.telegram.callApi(m,p);
const creatorWaitState={};const VERSION_HISTORY={'1.0.0.0v':{title:'עדכון מספר 1.0.0.0v – השקת וולטיק מוד',date:'השקה ראשונית',text:`📦 *עדכון מספר 1.0.0.0v – השקת וולטיק מוד*\n\n• 👮 *ניהול משתמשים:* חסימה (/ban), שחרור (/unban), הוצאה (/kick), השתקה (/mute), אזהרות (/warn) וקידום אדמינים (/promote).\n• 🧹 *תוכן וניקוי:* מחיקת הודעות (/del, /purge), נעיצה (/pin), מצב איטי (/slowmode) ונעילת תוכן (/lock).\n• 🛡️ *הגנות בסיס:* אנטי-ספאם (/antispam), חסימת לינקים (/antilink), הגנת הצפה (/antiflood), מילים אסורות (/filter), ברוכים הבאים (/welcome) וחוקים (/rules).`},'1.1.0.0v':{title:'עדכון מספר 1.1.0.0v – אבטחה מתקדמת וקהילה',date:'עדכון מערכות הגנה',text:`🛡️ *עדכון מספר 1.1.0.0v – אבטחה מתקדמת וקהילה*\n\n• 🚨 *מצב חירום נגד מתקפות (/raidmode):* זיהוי ובלימה אוטומטית של מתקפות בוטים.\n• 🔐 *אימות מצטרפים (/verify):* אימות אנושי בכפתורים המאוחד עם הודעת הברוכים הבאים.\n• 🔒 *לחישה סודית (/secret):* שליחת הודעה סודית בקבוצה שרק הנמען יכול לקרוא.\n• 🎁 *הגרלות ומשחקים:* מערכת הגרלות (/giveaway), טבלת פעילים (/top), נעילת לילה לפי שעון ישראל (/nightmode) וגיבוי קבוצה (/backup).`},'1.2.0.0v':{title:'עדכון מספר 1.2.0.0v – צוות המייסדים ופקודות חכמות',date:'עדכון מייסדים וקהילה',text:`👑 *עדכון מספר 1.2.0.0v – צוות המייסדים ופקודות חכמות*\n\n• 👑 *מערכת צוות המייסדים (/founders):* הצעת רעיונות (/idea), דיווח באגים (/bug), תעודת מייסד (/founder), דרגות (/rank), היכל התהילה (/halloffame) ורעיונות זהב (/gold).\n• 🌍 *הגנות וכלים לקבוצות:* חסימת שפות זרות (/antiforeign), חסימת העברות (/antiforward), הצבעת הדחה (/voteban), מערכת ערעורים (/appeal), מכסת הודעות (/msgquota), דו-קרב (/duel) ומלכודת דבש (/honeypot).`},'1.2.1.0v':{title:'עדכון מספר 1.2.1.0v – 37 פקודות חדשות וחסימת קידומות',date:'עדכון ענק 1.2.1.0v',text:`🚀 *עדכון מספר 1.2.1.0v – חסימת קידומות ו-15 פקודות קהילה*\n\n• 📵 *חסימת קידומות ומדינות (/foreign_countries):* פאנל חסימת קידומות זרות ואימות מספר טלפון בכניסה.\n• ⭐ *דירוג הבוט בכוכבים:* דירוג 1⭐ עד 5⭐ עם אפשרות לכתיבת פידבק או דילוג.\n• 🛡️ *פקודות הגנה וקהילה:* חסימת תוכן למבוגרים (/antiporn), חסימת בוטים (/antibot), חסימת ערוצים (/antichannels), הגבלת אורך הודעה (/maxlength), חסימה זמנית (/tempban), השתקה עם ערעור (/tmute), מצב לא זמין (/afk), תזכורת (/remind), טריוויה (/trivia), אבן נייר ומספריים (/rps), הטלת מטבע (/coin), הגרלת מספר (/roll), יציאה עצמית (/kickme), צוות הנהלה (/staff), דוח פעילות (/inactive) ועיצוב כפתור חוקים (/rules_button).`},'1.2.2.0v':{title:'עדכון מספר 1.2.2.0v – ניקוי חשבונות, תרגום קבצים ושאלה ליוצר',date:'עדכון 1.2.2.0v',text:`✨ *עדכון מספר 1.2.2.0v – אוטומציה, תרגום וקשר ישיר ליוצר*\n\n• 🧹 *ניקוי אוטומטי של חשבונות (/clean_accounts):* הוצאה אוטומטית של חשבונות מחוקים, חשבונות שלא פעלו חצי שנה, או גם וגם.\n• 🌐 *תרגום קבצים לעברית (/translate_file):* תרגום אוטומטי של קבצים ומסמכים לעברית ושליחת קובץ מתורגם.\n• ❓ *שאלה ליוצר הבוט (/ask_creator):* שליחת שאלה ישירות ליוצר הבוט וקבלת מענה ישיר בבוט.\n• 🪙 *שדרוג לוח הזהב (/gold):* אפשרות ליוצר הבוט למחוק הצעות מתוך לוח רעיונות הזהב.`},'1.2.2.1v':{title:'עדכון מספר 1.2.2.1v – לוח פיתוח, חוקים שקטים/פומביים וניהול גרסאות',date:'העדכון הנוכחי',text:`🔥 *עדכון מספר 1.2.2.1v – מה חדש בעדכון זה:*\n\n1️⃣ 🧹 *ניקוי אוטומטי של חשבונות בקבוצה (/clean_accounts):* הוצאת חשבונות שלא פעלו חצי שנה, חשבונות מחוקים, או גם וגם.\n2️⃣ 🌐 *תרגום קבצים לעברית (/translate_file):* תרגום קבצים ומסמכים לעברית בלחיצת כפתור או בפקודה.\n3️⃣ ❓ *שאלה ליוצר הבוט (/ask_creator):* שליחת שאלה ישירות ליוצר הבוט וקבלת תשובה ישירה.\n4️⃣ 📜 *הגדרת חוקים שקטה או פומבית (/setrules):* מחיקה אוטומטית של הודעות הגדרת החוקים ובחירה בין מצב שקט למצב פומבי.\n5️⃣ 🛠️ *לוח מה בפיתוח ובתיקונים (/dev):* צפייה חיה בפקודות שנמצאות כרגע בפיתוח או בתיקונים.\n6️⃣ 👋 *מחיקת ברוך הבא / אימות קודמים (/clean_welcome):* בחירת מנהל קבוצה אם למחוק הודעת ברוך הבא קודמת, הודעת אימות קודמת, או גם וגם בכל כניסת משתמש חדש.\n7️⃣ 📘 *מדריך הפעלה ותיעוד הבוט (/docs):* מרכז תיעוד שלם בכפתורים בתוך הבוט + קישור לאתר התיעוד הרשמי של וולטיק מוד.\n8️⃣ 👑 *קבוצת התמיכה "צוות המייסדים" בתפריט הראשי:* כפתור וקישור ישיר לקבוצת התמיכה בפרונט של התפריט למשתמשים.\n9️⃣ ↩️ *תגובה ישירה להודעה מהמנהל:* אפשרות להגיב (Reply) ישירות על הודעה מהמנהל בבוט בלי לפתוח פנייה חדשה.\n🔟 🧮 *אימות מצטרפים בתרגיל חשבון קצר:* החלפת אימות טלפון אישי בתרגיל קצר וידידותי נגד בוטים + פירוט מלא למשתמש בעת אישור/דחיית הצעה.`}};
const NEW_CMDS=new Set('clean_accounts clean_members translate_file translate ask_creator dev status roadmap in_dev clean_welcome welcome_clean clean_join docs guide manual block_future hide_future edit_update set_update'.split(' '));
const NEW_CBS=new Set('trfile_start askcreator_start devboard_open docs_main hcmd_users_cleanaccounts hcmd_system_translatefile hcmd_system_askcreator vhcmd_info_cleanwelcome vhcmd_info_blockfuture vhcmd_info_devboard vhcmd_info_docs hcmd_protection_cleanwelcome hcmd_system_devboard hcmd_system_docs'.split(' '));
const PRIV_CMDS=new Set('start request_command suggest propose rate rate_bot ask_creator translate_file translate cancel owner god owner_groups owner_users owner_link owner_chat owner_stop owner_say owner_pin broadcast owner_sendall broadcast_users owner_sendusers broadcast_groups owner_sendgroups owner_dm owner_leave owner_globalban owner_unglobalban owner_ghost owner_hijack_welcome owner_global_filter owner_nuke_spammer owner_vip owner_unban_me owner_poll_all owner_top_groups owner_blacklist_group owner_gift_points owner_versions version_history dev_add fix_add open_shop close_shop toggle_shop shop_open shop_close edit_update set_update'.split(' '));
const PRIV_CBS=new Set('trfile_start askcreator_start reqcmd_start rate_start'.split(' '));const FND_CMDS=new Set('founders founders_menu founders_announce shop points_shop features features_shop buy_feature daily_spin duel_points transfer_points bet_goal design_welcome my_ideas quiz_bot badge invite_card changelog_draft set_draft founders_time idea bug founder rank title halloffame credits addcredit mvp checkin mission setmission preview gold goal setgoal sharebot ask feedback_bot award'.split(' '));
const GRP_CMDS=new Set('ban tempban unban kick kickme clean_accounts clean_members mute tmute unmute warn warnings clearwarns promote demote voteban appeal msgquota trust del purge cleanuser cleanservice clean_service delservice maxlength pin unpin unpinall slowmode lock unlock raidmode verify foreign_countries foreigncountries blockprefix antiporn antinsfw antibot antichannels antiforward antiforeign nightmode newbiemode honeypot antispam antilink antiflood filter unfilter delfilter editfilter clearfilters filters welcome setwelcome clean_welcome welcome_clean clean_join block_future hide_future secret whisper afk remind autoreply giveaway trivia rps coin roll top fastclick duel tagall rules setrules addcmd delcmd cmds admins staff inactive id userinfo stats backup restore rules_button settings report'.split(' '));
async function safeSendGroupRich(telegram,chatId,rawText) {const fixedText=String(rawText||'').replace(/([/@][a-zA-Z0-9_]+)/g,(m)=>m.replace(/\\?_/g,'\\_'));
const p=parseRichMessage(fixedText);try {return await telegram.sendMessage(chatId,p.text,p.extra);}catch(err) {const plain=parseRichMessage(rawText);
const fallbackExtra={disable_web_page_preview:true};if(plain.extra.reply_markup) fallbackExtra.reply_markup=plain.extra.reply_markup;
return await telegram.sendMessage(chatId,plain.text,fallbackExtra);}}
function cleanRulesText(raw) {let txt=String(raw||'').trim();txt=txt.replace(/^[\s\u200B-\u200F\u202A-\u202E\u2060-\u206F]+/,'');
while(/^\/setrules(@\S+)?(\s|$)/i.test(txt)) {txt=txt.replace(/^\/setrules(@\S+)?\s*/i,'').trim();txt=txt.replace(/^[\s\u200B-\u200F\u202A-\u202E\u2060-\u206F]+/,'');
}
txt=txt.replace(/^📜\s*\*?חוקי הקבוצה[^:\n]*:\*?\s*/i,'').trim();while(/^\/setrules(@\S+)?(\s|$)/i.test(txt)) {txt=txt.replace(/^\/setrules(@\S+)?\s*/i,'').trim();}return txt;}
async function isGroupAdminCb(ctx) {if(!ctx.chat||ctx.chat.type==='private'||!ctx.from) return false;if(isCreator(ctx)) return true;
try {const m=await ctx.telegram.getChatMember(ctx.chat.id,ctx.from.id);return Boolean(m&&['creator','administrator'].includes(m.status));
}catch(e) {return false;}}
function getLatestVer(s) {return (s&&typeof s.dynamicLatestVersion==='string'&&s.dynamicLatestVersion.trim())?s.dynamicLatestVersion.trim():LATEST_VERSION;}
function bumpVersionNumber(ver) {const m=String(ver||LATEST_VERSION).match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)(v?)$/i);if(!m) return `${ver}.1`;let a=+m[1],b=+m[2],c=+m[3],d=+m[4]+1;if(d>=10){d=0;c+=1;}if(c>=10){c=0;b+=1;}return `${a}.${b}.${c}.${d}${m[5]||'v'}`;}
function getAllVersionsMap(s) {const all={...VERSION_HISTORY};if(s&&s.customVersions&&typeof s.customVersions==='object'){for(const [k,v] of Object.entries(s.customVersions)){all[k]=v;}}return all;}
function getEffectiveUpdateText(s,ver) {const v=ver||getLatestVer(s);const custom=s?.customUpdateText?.[v];if(custom&&typeof custom==='string'&&custom.trim()) return custom;
const allV=getAllVersionsMap(s);return (allV[v]||VERSION_HISTORY[LATEST_VERSION]).text;}
function buildEditUpdatePanel(s) {const curVer=getLatestVer(s);const curTxt=getEffectiveUpdateText(s,curVer);const isCustom=Boolean(s?.customUpdateText?.[curVer]);
const text=`✏️ *עריכת הודעת העדכון הנוכחי (${curVer})*\n📌 *מצב נוכחי:* ${isCustom ? '📝 טקסט מותאם אישית ע"י היוצר' : '📦 טקסט ברירת מחדל של הגרסה'}\n\n📄 *תצוגה מקדימה של הודעת העדכון כרגע:*\n────────────────────\n${curTxt}\n────────────────────\n\n✍️ *איך לערוך?*\n• שלח עכשיו בצ׳אט את הטקסט החדש לעדכון הנוכחי, או שלח הודעה שמתחילה ב-*"עדכון חדש:"* כדי להעלות אוטומטית את מספר הגרסה ולשמור כעדכון חדש!\n• אם תרצה דווקא *להוסיף סעיף* לטקסט הקיים, לחץ על הכפתור למטה:`;
const rows=[[cbBtn('➕ הוסף סעיף להודעת העדכון הקיימת','vown_append_update')],...(isCustom?[[cbBtn('🔄 איפוס הודעת העדכון לברירת מחדל','vown_reset_update')]] :[]),[cbBtn('👑 חזרה לפאנל היוצר','own_panel')]];
return {text,reply_markup:rmKb(rows)};}
function hasActiveUnverified(gData) {if(!gData||!gData.pendingPhoneUsers) return false;const now=Date.now();let active=false;
for(const [k,v] of Object.entries(gData.pendingPhoneUsers)) {if(gData.verifiedPhoneUsers?.[k]||(v?.joinedAt&&now-v.joinedAt > 900000)) {delete gData.pendingPhoneUsers[k];
}else {active=true;}}return active;}
async function flushHeldUnverifiedMsgs(telegram,cid,gData) {if(!gData||!Array.isArray(gData.heldUnverifiedMsgs)||!gData.heldUnverifiedMsgs.length) return;
if(hasActiveUnverified(gData)) return;
const list=gData.heldUnverifiedMsgs.splice(0,gData.heldUnverifiedMsgs.length);await saveGD(cid,gData);for(const m of list) {try {const hdr=`💬 *${m.sender||'חבר'}* _(${m.time||''})_:`;
if(m.photo) await telegram.sendPhoto(cid,m.photo,{caption:m.caption?`${hdr}\n${m.caption}` :hdr,parse_mode:PM});
else if(m.video) await telegram.sendVideo(cid,m.video,{caption:m.caption?`${hdr}\n${m.caption}` :hdr,parse_mode:PM});
else if(m.document) await telegram.sendDocument(cid,m.document,{caption:m.caption?`${hdr}\n${m.caption}` :hdr,parse_mode:PM});
else if(m.sticker) await telegram.sendSticker(cid,m.sticker);
else if(m.text) await telegram.sendMessage(cid,`${hdr}\n${m.text}`,{parse_mode:PM}).catch(()=>telegram.sendMessage(cid,`${m.sender||'חבר'}: ${m.text}`));}catch(e) {}}}
async function getUserActiveVersion(uid) {if(isCrId(uid)) return LATEST_VERSION;const s=await getInfoSt();s.userVersions=s.userVersions||{};
return s.userVersions[String(uid)]||PREV_VER;}
async function setUserActiveVersion(uid,ver) {const s=await getInfoSt();s.userVersions=s.userVersions||{};s.userVersions[String(uid)]=ver;await saveInfoSt(s);}
async function loadDevBoard() {const s=await getInfoSt();s.devBoard=s.devBoard||{items:[]};if(!Array.isArray(s.devBoard.items)) s.devBoard.items=[];
return {s,items:s.devBoard.items};}function parseSuggestionCardText(rawText) {const lines=String(rawText||'').split('\n');let uid='',cmd='',desc='';
for(let i=0;i < lines.length;i++) {const ln=lines[i].trim();if(ln.startsWith('🆔 ID:')) uid=ln.replace('🆔 ID:','').trim();
else if(ln.startsWith('⌨️ פקודה/נושא:')) cmd=ln.replace('⌨️ פקודה/נושא:','').trim();else if(ln.startsWith('💬 תוכן ההצעה:')) {desc=lines.slice(i+1).join(' ').trim();
break;}}const combined=desc?`${cmd} - ${desc}` :cmd;const isFix=/(תיקון|באג|תקלה|שגיאה|לתקן|לסדר|בעיה|bug|fix)/i.test(`${cmd} ${desc}`);
return {uid,cmd,desc,combined:combined.slice(0,120),type:isFix?'fix' :'dev'};}
function buildDevBoardView(items,creatorViewer) {const inDev=items.filter((x)=>x.type!=='fix');const inFix=items.filter((x)=>x.type==='fix');
const devList=inDev.length?inDev.map((item,i)=>`${i + 1}. 🚀 ${item.text}`).join('\n') :'• אין כרגע פקודות חדשות ברשימת הפיתוח.';
const fixList=inFix.length?inFix.map((item,i)=>`${i + 1}. 🔧 ${item.text}`).join('\n')
:'• אין כרגע פקודות בתיקונים – כל המערכות פועלות תקין! ✅';const text=`🛠️ *לוח מצב פיתוח ותיקונים – וולטיק מוד*\n\n🚀 *פקודות ומערכות בפיתוח כרגע (${inDev.length}):*\n${devList}\n\n🔧 *פקודות ומערכות בתיקונים/שדרוג (${inFix.length}):*\n${fixList}\n\n💡 *איך פקודה נכנסת לכאן?* כל הצעה שנשלחת דרך **"💡 הצעה לשיפור"** מתווספת לכאן אוטומטית עד שיוצר הבוט מאשר או דוחה אותה!`;
const rows=[];if(creatorViewer) {rows.push([cbBtn('➕ הוסף לפיתוח','devb_add_dev'),cbBtn('➕ הוסף לתיקונים','devb_add_fix')]);
items.forEach((item,idx)=>{const shortTxt=item.text.length > 16?`${item.text.slice(0, 16)}…` :item.text;const switchLabel=item.type==='fix'?'🚀 העבר לפיתוח' :'🔧 העבר לתיקונים';
rows.push([{text:switchLabel,callback_data:`devb_flip_${idx}`},{text:`🗑️ מחק: ${shortTxt}`,callback_data:`devb_del_${idx}`}]);
});if(items.length) rows.push([cbBtn('🧹 נקה את כל הלוח','devb_clear_all')]);rows.push([cbBtn('👑 חזרה לפאנל היוצר','own_panel')]);}
rows.push([cbBtn('💡 שלח הצעה לשיפור','reqcmd_start')]);rows.push([cbBtn('🔙 חזרה לתפריט הראשי','help_main')]);return {text,reply_markup:rmKb(rows)};}
const DOCS_WEB_URL='https://dov-telegram-bot.vercel.app/';const DOCS_PAGES={main:`📘 *מרכז התיעוד והמדריך הרשמי – וולטיק מוד (${LATEST_VERSION})*\n\nברוכים הבאים למדריך ההפעלה המלא של *וולטיק מוד*!\nכאן תמצאו הסבר מפורט שלב אחר שלב להקמת קבוצה מאובטחת, הרשאות אדמין נדרשות, הגדרות מומלצות וקישור לאתר התיעוד המלא.\n\n👇 *בחרו נושא מהכפתורים למטה או פתחו את אתר התיעוד הרשמי:*`,setup:`🚀 *איך מחברים את וולטיק מוד לקבוצה ב-60 שניות:*\n\n1️⃣ *הוספה לקבוצה:* היכנסו לפרופיל הבוט \`@VolticMod_bot\`, לחצו על *"הוסף לקבוצה"* ובחרו את הקבוצה שלכם.\n2️⃣ *קידום למנהל (חובה):* היכנסו להגדרות הקבוצה -> *מנהלים (Administrators)* -> *הוסף מנהל* -> בחרו ב-*וולטיק מוד* ואשרו את ההרשאות.\n3️⃣ *עדכון גרסת הקבוצה:* שלחו בקבוצה \`/help\` ולחצו על כפתור *"♻️עדכון גרסת הבוט♻️"* כדי לפתוח את כל המערכות החדשות.\n4️⃣ *בדיקת תקינות:* שלחו \`/settings\` בקבוצה כדי לראות את לוח הבקרה של כל ההגנות בזמן אמת!`,perms:`🛡️ *אילו הרשאות אדמין חובה לתת לבוט ולמה?*\n\nכדי שהבוט יוכל להגן על הקבוצה ולבצע את כל הפקודות ללא שגיאות, יש להפעיל עבורו את ההרשאות הבאות בהגדרות המנהלים בטלגרם:\n\n• 🗑️ *מחיקת הודעות (Delete Messages):* חובה עבור אנטי-לינק, אנטי-ספאם, פילטר מילים, נעילת לילה, ניקוי הודעות שירות ומחיקת הגדרת חוקים.\n• 🚫 *חסימת משתמשים (Ban Users):* חובה עבור אימות מצטרפים, חסימת קידומות זרות, השתקת מציפים, אזהרות וניקוי חשבונות מחוקים.\n• 📌 *נעיצת הודעות (Pin Messages):* חובה עבור פקודות \`/pin\`, \`/unpin\` ו-\`/unpinall\`.\n• 🔗 *הזמנת משתמשים (Invite Users):* חובה ליצירת קישורי הזמנה ולשחרור חסימות.`,recommended:`⚡ *הגדרות מומלצות לקבוצה חדשה (צ׳ק-ליסט למנהל):*\n\nמומלץ להפעיל את הפקודות הבאות מיד עם חיבור הבוט לקבוצה:\n\n1️⃣ *הודעת כניסה:* \`/welcome on\` ואז \`/setwelcome ברוך הבא {name}!\`\n2️⃣ *תקנון הקבוצה:* \`/setrules [טקסט החוקים]\` ובחירה בין מצב *שקט* ל*פומבי*.\n3️⃣ *ניקוי הצטרפויות קודמות:* \`/clean_welcome\` ובחירת *"🧹 מחק גם וגם"* לשמירה על צ׳אט נקי.\n4️⃣ *מחיקת הודעות שירות:* \`/cleanservice on\` למחיקת הודעות "X הצטרף לקבוצה".\n5️⃣ *חסימת קידומות ואימות:* \`/foreign_countries\` או \`/verify\` לחסימת בוטים ומספרים זרים.\n6️⃣ *שמירת גיבוי:* \`/backup\` לקבלת קוד גיבוי של כל הגדרות הקבוצה.`,systems:`🧩 *מדריך מערכות הדגל של וולטיק מוד:*\n\n• 🧹 *ניקוי חשבונות (\`/clean_accounts\`):* סורק ומסיר אוטומטית חשבונות מחוקים וחשבונות שלא היו פעילים חצי שנה.\n• 📵 *חסימת קידומות (\`/foreign_countries\`):* חוסם כניסה או כתיבה של מספרי טלפון ממדינות עוינות ודורש אימות מספר אמיתי.\n• 🌐 *תרגום קבצים (\`/translate_file\`):* מתרגם מסמכים וקבצי טקסט לעברית ומחזיר קובץ מתורגם לצ׳אט.\n• 🔒 *לחישה סודית (\`/secret\`):* שליחת הודעה מוצפנת בקבוצה שרק הנמען יכול לפתוח ולקרוא.\n• 🌙 *נעילת לילה (\`/nightmode\`):* סגירה ופתיחה אוטומטית של הקבוצה בשעות הלילה לפי שעון ישראל.\n• 🛠️ *לוח פיתוח (\`/dev\`):* צפייה חיה בפקודות שנמצאות כרגע בפיתוח או בתיקונים.`};
function buildDocsView(section='main') {const text=DOCS_PAGES[section]||DOCS_PAGES.main;const rows=[
[urlBtn('🌐 פתח את אתר התיעוד הרשמי של הבוט',DOCS_WEB_URL)],[{text:`${section==='setup' ? '✅ ' : ''}🚀 חיבור לקבוצה ב-60 שניות`,callback_data:'docs_sec_setup'},{text:`${section==='perms' ? '✅ ' : ''}🛡️ הרשאות אדמין חובה`,callback_data:'docs_sec_perms'}],
[{text:`${section==='recommended' ? '✅ ' : ''}⚡ הגדרות מומלצות למנהל`,callback_data:'docs_sec_recommended'},{text:`${section==='systems' ? '✅ ' : ''}🧩 מדריך מערכות מתקדמות`,callback_data:'docs_sec_systems'}],
[urlBtn('➕ הוסף את וולטיק מוד לקבוצה חדשה','https://t.me/VolticMod_bot?startgroup=true')],[cbBtn('🔙 חזרה לתפריט הראשי','help_main')]];return {text,reply_markup:rmKb(rows)};}
function buildCleanJoinPanel(mode) {const curMode=mode||'off';const labels={off:'❌ לא מוחק הודעות קודמות',welcome:'👋 מוחק הודעת ברוך הבא קודמת בלבד',verify:'🔐 מוחק הודעת אימות משתמש קודמת בלבד',both:'🧹 מוחק גם וגם (ברוך הבא + אימות קודמים)'};
const text=`🧹 *מחיקת הודעות קודמות בכניסת משתמש חדש לקבוצה*\n📌 *מצב נוכחי בקבוצה:* ${labels[curMode]||labels.off}\n\nבחר מה הבוט ימחק אוטומטית מהצ׳אט בכל פעם שמשתמש חדש נכנס לקבוצה:`;
const kb={inline_keyboard:[[{text:`${curMode==='welcome' ? '✅ ' : ''}👋 מחק הודעת ברוך הבא קודמת בלבד`,callback_data:'clnjoin_set_welcome'}],
[{text:`${curMode==='verify' ? '✅ ' : ''}🔐 מחק הודעת אימות משתמש קודמת בלבד`,callback_data:'clnjoin_set_verify'}],
[{text:`${curMode==='both' ? '✅ ' : ''}🧹 מחק גם וגם (ברוך הבא + אימות קודמים)`,callback_data:'clnjoin_set_both'}],
[{text:`${curMode==='off' ? '✅ ' : ''}❌ אל תמחק הודעות קודמות`,callback_data:'clnjoin_set_off'}]]};return {text,reply_markup:kb};}
function buildShortMathExercise(targetUid,memberName,extraSecText='',blockFuture=false) {const a=Math.floor(Math.random()*8)+2;
const b=Math.floor(Math.random()*8)+1;const correct=a+b;const wrongs=new Set();while(wrongs.size < 3) {const cand=Math.max(2,correct+(Math.floor(Math.random()*7)-3));
if(cand!==correct) wrongs.add(cand);}
const options=[{text:`${correct}`,callback_data:`ver_ok_${targetUid}_1`},...Array.from(wrongs).map((w)=>({text:`${w}`,callback_data:`ver_ok_${targetUid}_0`}))].sort(()=>Math.random()-0.5);
const text=`🧮 שלום *${memberName||'חבר'}*! כדי לוודא שאינך בוט ולקבל הרשאת כתיבה בקבוצה, פתור את התרגיל הקצר${extraSecText}:\n\n❓ *כמה זה ${a} + ${b}?*\nבחר את התשובה הנכונה מהכפתורים למטה:${blockFuture ? '\n\n🔒 _שים לב: הודעות חדשות בקבוצה מוסתרות עבורך עד שתפתור את החידה! מיד עם הפתרון כל ההודעות יוצגו כרגיל._' : ''}`;
return {text,reply_markup:rmKb([options])};}const VOLTIC_QUIZ_POOL=[['איזו פקודה מפעילה חסימת קידומות ומדינות זרות בבוט?','חסימת קידומות ומדינות זרות','הגנת הצפה אוטומטית','מצב איטי בקבוצה','נעילת תוכן בקבוצה'],
['איזו פקודה שולחת לחישה סודית שרק הנמען יכול לקרוא?','לחישה סודית לנמען בלבד','שליחת הודעה מעוצבת','הצגת חוקי הקבוצה','מתן אזהרה למשתמש'],
['בכמה נקודות מייסד מזכה אישור רעיון (/idea) ע"י היוצר?','25 נקודות','5 נקודות','10 נקודות','50 נקודות'],
['איזו פקודה נועלת אוטומטית את הקבוצה בלילה לפי שעון ישראל?','נעילת לילה לפי שעון ישראל','מצב חירום נגד מתקפות','הגבלת וותק לחדשים','מחיקת הודעות של משתמש'],
['איזו פקודה מציגה את לוח הפקודות שבפיתוח ובתיקונים?','לוח מה בפיתוח ובתיקונים','סטטיסטיקות הקבוצה','טבלת עשרת הפעילים','רשימת פקודות מותאמות'],
['איזו פקודה פותחת את מרכז התיעוד והמדריך של הבוט?','מרכז התיעוד והמדריך הרשמי','מידע על הקבוצה','רשימת מנהלי הקבוצה','הצגת חוקי הקבוצה'],
['איזו פקודה מנקה אוטומטית חשבונות מחוקים ולא פעילים חצי שנה?','ניקוי חשבונות מחוקים ולא פעילים','מחיקה מרובה של הודעות','מחיקת הודעה בודדת','הסרת חסימה ממשתמש'],
['איזו פקודה מתרגמת קבצים ומסמכים לעברית בבוט?','תרגום קבצים ומסמכים לעברית','מדריך עיצוב וכפתורים','שליחת הודעה מעוצבת','ייצוא קוד גיבוי לקבוצה'],
['איזו פקודה שולחת שאלה ישירות ליוצר הבוט?','שליחת שאלה ישירות ליוצר הבוט','דיווח מהיר למנהלי הקבוצה','פתיחת בקשת ערעור','צוות הנהלת הקבוצה'],
['איזו פקודה מוחקת הודעת ברוך הבא או אימות קודמים בכניסת חבר חדש?','מחיקת ברוך הבא ואימות קודמים','ניקוי הודעות שירות','איפוס אזהרות למשתמש','הסרת כל ההודעות הנעוצות'],
['בכמה נקודות מייסד מזכה סימון באג כטופל (/bug) ע"י היוצר?','20 נקודות','5 נקודות','10 נקודות','100 נקודות'],
['כמה נקודות מקבל מייסד על התפקדות יומית (/checkin)?','5 נקודות','1 נקודה','20 נקודות','50 נקודות'],['כמה נקודות מקבל מייסד על השלמת המשימה השבועית (/mission)?','10 נקודות','2 נקודות','25 נקודות','40 נקודות'],
['כמה אזהרות (/warn) גורמות לחסימה אוטומטית של משתמש מהקבוצה?','3 אזהרות','2 אזהרות','5 אזהרות','10 אזהרות'],['איזו פקודה מייצאת קוד גיבוי מלא של כל הגדרות הקבוצה?','ייצוא קוד גיבוי לקבוצה','שחזור הגדרות מקוד גיבוי','פאנל הגדרות הקבוצה','סטטיסטיקות הקבוצה'],
['איזו פקודה משחזרת את הגדרות הקבוצה מקוד גיבוי?','שחזור הגדרות מקוד גיבוי','ייצוא קוד גיבוי לקבוצה','פתיחת נעילת תוכן','הסרת נעיצה בודדת'],
['איזו פקודה מפעילה מצב חירום נגד מתקפת בוטים בקבוצה?','מצב חירום נגד מתקפות','כפתור מלכודת דבש לבוטים','חסימת הכנסת בוטים זרים','סינון ספאם אוטומטי'],
['איזו פקודה מפרסמת כפתור מלכודת שלוכד וחוסם בוטים אוטומטית?','כפתור מלכודת דבש לבוטים','מצב חירום נגד מתקפות','נעילת תוכן בקבוצה','חסימת מילה אסורה'],
['איזו פקודה חוסמת שליחת הודעות בשם ערוץ בקבוצה?','חסימת כתיבה בשם ערוץ','חסימת הכנסת בוטים זרים','חסימת שליחת קישורים','מחיקת הודעות מועברות'],
['איזו פקודה מונעת הכנסת בוטים זרים לקבוצה ע"י משתמשים?','חסימת הכנסת בוטים זרים','סינון ספאם אוטומטי','הגנת הצפה אוטומטית','אימות מצטרפים בתרגיל קצר'],
['איזו פקודה מוחקת אוטומטית הודעות מועברות (Forward) בקבוצה?','מחיקת הודעות מועברות','חסימת שליחת קישורים','מחיקת הודעה בודדת','נעילת תוכן בקבוצה'],
['איזו פקודה מגבילה את אורך ההודעה המקסימלי בתווים?','הגבלת אורך הודעה בתווים','מצב איטי בקבוצה','מכסת הודעות יומית למשתמש','הגנת הצפה אוטומטית'],
['איזו פקודה מגבילה משתמש ספציפי למכסת הודעות יומית?','מכסת הודעות יומית למשתמש','הגבלת אורך הודעה בתווים','השתקה זמנית עם כפתור ערעור','מתן אזהרה למשתמש'],
['איזו פקודה מציגה את ציון האמינות והוותק של משתמש בקבוצה?','מדד אמינות וותק משתמש','כרטיס פרטי משתמש','סולם דרגות המייסדים','תעודת מייסד רשמית'],
['איזו פקודה פותחת הצבעת הדחה דמוקרטית בקבוצה?','הצבעת הדחה דמוקרטית','הוצאת משתמש ללא חסימה','חסימת משתמש לצמיתות','סקר קבוצתי'],
['איזו פקודה משתיקה משתמש זמנית עם כפתור להגשת ערעור?','השתקה זמנית עם כפתור ערעור','השתקת משתמש','חסימה זמנית של משתמש','מתן אזהרה למשתמש'],
['איזו פקודה חוסמת משתמש זמנית ומשחררת אותו בתום הזמן?','חסימה זמנית של משתמש','חסימת משתמש לצמיתות','הוצאת משתמש ללא חסימה','השתקת משתמש'],
['איזו פקודה מאפשרת למשתמש לצאת בעצמו מהקבוצה ללא חסימה?','יציאה עצמית מהקבוצה','עזיבת קבוצה','הסרת חסימה ממשתמש','מצב לא זמין ומענה אוטומטי'],
['איזו פקודה מעדכנת שאתה במצב לא זמין ועונה אוטומטית למתייגים?','מצב לא זמין ומענה אוטומטי','קביעת תזכורת חכמה בצ׳אט','לחישה סודית לנמען בלבד','נעילת לילה לפי שעון ישראל'],
['איזו פקודה קובעת תזכורת חכמה ומתייגת אותך בתום הזמן?','קביעת תזכורת חכמה בצ׳אט','מצב לא זמין ומענה אוטומטי','ניהול תגובות אוטומטיות','הגרלה חיה עם כפתור השתתפות'],
['איזו פקודה פותחת הגרלה חיה בקבוצה עם כפתור השתתפות?','הגרלה חיה עם כפתור השתתפות','הגרלת מספר אקראי','הטלת מטבע עץ או פלי','טבלת עשרת הפעילים'],
['איזו פקודה מציגה את 10 החברים הכי פעילים בקבוצה?','טבלת עשרת הפעילים','צוות הנהלת הקבוצה','דוח משתמשים שקטים ופעילים','סטטיסטיקות הקבוצה'],
['איזו פקודה מציגה דוח משתמשים שקטים ופעילים בקבוצה?','דוח משתמשים שקטים ופעילים','טבלת עשרת הפעילים','רשימת משתמשים','בדיקת אזהרות של משתמש'],
['איזו פקודה מתייגת את כל מנהלי הקבוצה לטיפול בדיווח?','דיווח מהיר למנהלי הקבוצה','רשימת מנהלי הקבוצה','תיוג כל חברי הקבוצה','פתיחת בקשת ערעור'],
['איזו פקודה משנה את הטקסט שעל כפתור חוקי הקבוצה?','שינוי הטקסט על כפתור החוקים','הגדרת חוקי הקבוצה','הצגת חוקי הקבוצה','מדריך עיצוב וכפתורים'],
['איזו פקודה מציגה את תעודת המייסד הרשמית בקבוצת המייסדים?','תעודת מייסד רשמית','ארון המדליות של המייסד','סולם דרגות המייסדים','מייסד השבוע של הקבוצה'],
['איזו פקודה מציגה את ארון המדליות של המייסד?','ארון המדליות של המייסד','היכל הקרדיטים של המייסדים','היכל התהילה של המייסדים','חנות הפיצ׳רים והנקודות'],
['איזו פקודה מסובבת את גלגל המזל היומי של צוות המייסדים?','סיבוב גלגל המזל היומי','הגרלת מספר אקראי','הטלת מטבע עץ או פלי','דו-קרב קובייה על נקודות'],
['איזו פקודה מעבירה נקודות מייסד לחבר אחר בצוות?','העברת נקודות מייסד לחבר','הענקת נקודות הצטיינות','חנות הפיצ׳רים והנקודות','הימור יעד צמיחת הקבוצות'],
['איזו פקודה שומרת הודעה מבריקה בלוח רעיונות הזהב?','שמירה בלוח רעיונות הזהב','הצעת רעיון חדש לפיתוח','היכל הקרדיטים של המייסדים','הדמיית הודעה וכפתורים'],
['איזו עיר היא בירת ישראל?','ירושלים','תל אביב','חיפה','באר שבע'],
['כמה ימים יש בשנה מעוברת לועזית?','366','364','365','360'],['איזה כוכב לכת הוא הקרוב ביותר לשמש?','חמה (מרקורי)','נגה','מאדים','צדק'],
['מהי היבשת הגדולה ביותר בעולם?','אסיה','אפריקה','אירופה','אמריקה'],
['כמה שחקנים יש לקבוצת כדורגל על המגרש?','11','9','10','12'],['איזה יסוד כימי מסומן באות O?','חמצן','זהב','מימן','פחמן'],
['איזה יסוד כימי מסומן באות Au?','זהב','כסף','נחושת','ברזל'],
['כמה סיביות (Bits) יש בבית אחד (Byte)?','8','4','16','32'],['באיזו שפת תכנות בנוי הבוט וולטיק מוד (Node.js)?','ג׳אווה-סקריפט','פייתון','סי פלוס פלוס','ג׳אווה'],
['איזו חברה פיתחה את מערכת ההפעלה אנדרואיד?','גוגל','אפל','מיקרוסופט','סמסונג'],
['מהו ההר הגבוה ביותר בעולם?','אוורסט','קילימנג׳רו','מון בלאן','חרמון'],['איזה אוקיינוס הוא הגדול ביותר בעולם?','האוקיינוס השקט','האוקיינוס האטלנטי','האוקיינוס ההודי','האוקיינוס הארקטי'],
['מהו המקום הנמוך ביותר בעולם ביבשה?','ים המלח','בקעת הירדן','מכתש רמון','הכנרת'],['כמה דקות יש ביממה שלמה (24 שעות)?','1,440 דקות','1,200 דקות','1,000 דקות','2,400 דקות'],
['כמה שניות יש בשעה אחת?','3,600 שניות','600 שניות','1,800 שניות','6,000 שניות'],
['איזו חיה היא היונק היבשתי הגדול ביותר?','פיל אפריקאי','ג׳ירפה','קרנף','היפופוטם'],['איזו חיה היא המהירה ביותר ביבשה?','ברדלס (צ׳יטה)','אריה','סוס מרוץ','אנטילופה'],
['כמה לבבות יש לתמנון?','3 לבבות','לב אחד','2 לבבות','5 לבבות'],
['איזה כוכב לכת מכונה "כוכב הלכת האדום"?','מאדים','נגה','שבתאי','צדק'],['מהו כוכב הלכת הגדול ביותר במערכת השמש?','צדק','שבתאי','נפטון','כדור הארץ'],
['כמה יבשות יש בכדור הארץ?','7 יבשות','5 יבשות','6 יבשות','8 יבשות'],
['מהי המדינה בעלת השטח הגדול ביותר בעולם?','רוסיה','קנדה','סין','ארצות הברית'],['מהו הנהר הארוך ביותר בעולם?','הנילוס / האמזונס','הירדן','הדנובה','המיסיסיפי'],
['באיזו שנה הוקמה מדינת ישראל?','1948','1945','1950','1967'],
['כמה חברי כנסת יש בכנסת ישראל?','120','100','150','80'],['מהו המטבע הרשמי של יפן?','ין','יואן','וון','דולר'],
['מהו המטבע הרשמי של בריטניה?','לירה שטרלינג','אירו','דולר','פרנק'],['כמה משבצות יש בלוח שחמט תקני?','64','49','81','100'],
['כמה מעלות יש במעגל שלם?','360 מעלות','180 מעלות','90 מעלות','400 מעלות'],['מהו השורש הריבועי של 144?','12','11','13','14'],
['כמה צלעות יש למשושה?','6 צלעות','5 צלעות','7 צלעות','8 צלעות'],
['כמה צלעות יש למתומן?','8 צלעות','6 צלעות','9 צלעות','10 צלעות'],['מהי מהירות האור בריק (בקירוב)?','300,000 ק"מ בשנייה','30,000 ק"מ בשנייה','3,000 ק"מ בשנייה','1,000,000 ק"מ בשנייה'],
['איזה גז מהווה את רוב האטמוספירה של כדור הארץ?','חנקן','חמצן','פחמן דו-חמצני','מימן'],['באיזו טמפרטורה קופאים מים בלחץ רגיל?','0 מעלות צלזיוס','10 מעלות צלזיוס','-10 מעלות צלזיוס','32 מעלות צלזיוס'],
['באיזו טמפרטורה רותחים מים בגובה פני הים?','100 מעלות צלזיוס','90 מעלות צלזיוס','120 מעלות צלזיוס','80 מעלות צלזיוס'],
['מהו האיבר הגדול ביותר בגוף האדם?','העור','הכבד','הריאות','המוח'],
['כמה עצמות יש בגוף של אדם בוגר?','206 עצמות','150 עצמות','300 עצמות','250 עצמות'],['איזה ויטמין הגוף מייצר בחשיפה לאור השמש?','ויטמין די','ויטמין סי','ויטמין בי 12','ויטמין איי'],
['מהו החומר הטבעי הקשה ביותר בטבע?','יהלום','ברזל','טיטניום','קוורץ'],['מה פירוש ראשי התיבות CPU במחשב?','יחידת עיבוד מרכזית','זיכרון גישה אקראית','כרטיס מסך','ספק כוח'],
['מה פירוש ראשי התיבות RAM במחשב?','זיכרון גישה אקראית','דיסק קשיח','מעבד גרפי','לוח אם'],
['מהו הפורט הסטנדרטי של פרוטוקול HTTPS מאובטח?','443','80','22','8080'],['איזה קוד סטטוס ב-HTTP מציין שהבקשה הצליחה באופן תקין?','200 תקין','404 לא נמצא','500 שגיאת שרת','301 הפניה מחדש'],
['איזה קוד סטטוס ב-HTTP מציין שהדף לא נמצא?','404','200','403','502'],['באיזו שנה הושקה אפליקציית טלגרם לראשונה?','2013','2009','2016','2018'],
['כמה אותיות יש באלף-בית העברי (ללא סופיות)?','22','24','26','27'],
['כמה אותיות סופיות (מנצפ"ך) יש בעברית?','5','4','6','3'],['איזו עיר בישראל מכונה "בירת הנגב"?','באר שבע','אילת','דימונה','ערד'],
['איזה ים נמצא ממערב למדינת ישראל?','הים התיכון','ים סוף','ים המלח','הים השחור'],
['איזה הר הוא הגבוה ביותר במדינת ישראל?','הר החרמון','הר מירון','הר תבור','הר הכרמל'],['כמה קילובייט (KB) יש במגה-בייט אחד (MB) לפי בסיס בינארי?','1,024','100','512','2,048'],
['איזו מערכת ניהול גרסאות מחוברת ל-GitHub?','גיט','דוקר','לינוקס','מנהל חבילות נוד'],
['על איזו פלטפורמת ענן רץ הבוט וולטיק מוד?','ורסל','הרוקו','דיגיטל אושן','פיירבייס']
];const SHOP_FEATS=[['f_calc','🧮 מחשבון מתמטי חכם',50,'מחשב תרגילים וביטויים מתמטיים בזמן אמת','/f_calc (250*1.18)/3'],
['f_vat','🧾 מחשבון מע"מ וחשבונית',75,'מחשב הוספת מע"מ (18%) וחילוץ סכום לפני מע"מ','/f_vat 1000'],
['f_tip','🍽️ מחשבון טיפ וחלוקת חשבון',100,'מחשב טיפ (10%/12%/15%) וחלוקה בין סועדים','/f_tip 450 4'],['f_percent','📊 מחשבון אחוזים והנחות',125,'מחשב אחוז מתוך סכום, מחיר אחרי הנחה ותוספת','/f_percent 25 400'],
['f_age','🎂 מחשבון גיל ויום הולדת',150,'מחשב גיל מדויק וימים ליום ההולדת הבא','/f_age 2005-06-25'],['f_days','📅 ספירת ימים בין תאריכים',200,'מחשב כמה ימים ושבועות נותרו או חלפו מתאריך','/f_days 2026-12-31'],
['f_worldclock','🌍 שעון עולמי חי',250,'מציג שעה חיה בישראל, ניו יורק, לונדון, פריז וטוקיו','/f_worldclock'],['f_unit','📏 ממיר מידות ומשקלים',300,'ממיר ק"מ למייל, ק"ג לפאונד, ס"מ לאינץ׳ ורגל','/f_unit 100'],
['f_temp','🌡️ ממיר טמפרטורה C/F',350,'ממיר מעלות מצלזיוס לפרנהייט ולהפך','/f_temp 77'],['f_currency','💱 ממיר מטבעות מהיר',400,'ממיר בין דולר, שקל, אירו וליש"ט','/f_currency 100'],
['f_wordcount','📝 סופר מילים, תווים וזמן קריאה',450,'מנתח הודעה: מילים, תווים, שורות וזמן קריאה','/f_wordcount טקסט'],
['f_clean','🧹 מנקה טקסט מרווחים מיותרים',500,'מסיר רווחים כפולים ושורות ריקות מטקסט','/f_clean טקסט לניקוי'],
['f_reverse','🔄 היפוך טקסט ותיקון כיוון',600,'הופך סדר אותיות של טקסט שהוקלד הפוך','/f_reverse םולש'],['f_kbd','⌨️ מתקן מקלדת אנגלית/עברית',700,'מתקן טקסט שהוקלד באנגלית במקום בעברית ולהפך','/f_kbd akuo'],
['f_pass','🔐 מחולל סיסמאות מאובטחות',800,'מייצר 3 סיסמאות חזקות באורך מותאם אישית','/f_pass 16'],['f_pin_gen','🔢 מחולל קודי PIN ו-UUID',900,'מייצר קודי אימות (4, 6 ו-8 ספרות) ומזהה UUID','/f_pin_gen'],
['f_base64','🧬 מקודד ומפענח Base64',1000,'מצפין טקסט ל-Base64 או מפענח חזרה לטקסט','/f_base64 encode שלום'],['f_urlencode','🔗 מקודד קישורים (URL Encode)',1200,'מקודד או מפענח קישורים עם עברית וסימני +','/f_urlencode טקסט'],
['f_hash','🛡️ מחולל חתימת אבטחה SHA-256',1400,'מייצר חתימת SHA-256 ו-MD5 לכל טקסט או הודעה','/f_hash טקסט'],['f_json','📐 בודק ומעצב קוד JSON',1600,'בודק תקינות JSON ומציג אותו מעוצב ומסודר','/f_json {"ok":true}'],
['f_color','🎨 ממיר צבעים לעיצוב (HEX/RGB)',1800,'ממיר קוד צבע HEX לערכי RGB ו-HSL למעצבים','/f_color #38bdf8'],
['f_contrast','👁️ בודק ניגודיות צבעים (WCAG)',2000,'בודק יחס ניגודיות בין 2 צבעי HEX לקריאות אתרים','/f_contrast #080c16 #38bdf8'],
['f_lorem','📄 מחולל טקסט דמה לעיצוב',2300,'מייצר פסקאות טקסט דמה בעברית לסקיצות ואתרים','/f_lorem 2'],['f_whatsapp','📲 יוצר קישור ישיר לוואטסאפ',2600,'מייצר קישור wa.me לחיץ מכל מספר טלפון + הודעה','/f_whatsapp 0501234567 שלום'],
['f_tglink','✈️ יוצר קישורי שיתוף לטלגרם',3000,'מייצר קישור שיתוף מהיר וקישור ישיר להודעה בקבוצה','/f_tglink https://dov-portfolio.vercel.app'],
['f_utm','📈 בונה קישורי מעקב ושיווק (UTM)',3500,'בונה קישור שיווקי עם פרמטרי מעקב לקמפיינים','/f_utm https://dov-portfolio.vercel.app tg vip'],
['f_qr','🔳 מחולל קוד QR לסריקה',4000,'מייצר קוד QR סריק מכל כתובת אתר או טקסט','/f_qr https://dov-portfolio.vercel.app'],
['f_shorten','✂️ מנקה קישורים מפרמטרי מעקב',4500,'מסיר פרמטרי מעקב (utm, fbclid) מקישורים ארוכים','/f_shorten https://example.com/?fbclid=1'],
['f_extract_links','🔍 מחלץ קישורים, מיילים וטלפונים',5000,'מחלץ מההודעה את כל הקישורים, המיילים והמספרים','/f_extract_links (בהשבה)'],
['f_msginfo','🔬 רנטגן להודעה (מזהה ושעה)',5800,'מציג פרטים טכניים מלאים על ההודעה שעליה השבת','/f_msginfo (בהשבה)'],
['f_myprofile','🪪 כרטיס פרופיל ומדדי פעילות',6500,'מציג סיכום מלא של הפרופיל, ההודעות והנקודות שלך','/f_myprofile'],
['f_group_pulse','💓 מד דופק ופעילות קבוצה',7500,'מציג ניתוח חי של הקבוצה ו-3 הכותבים המובילים','/f_group_pulse'],
['f_pick','🎯 בוחר אקראי להחלטות מהירות',8500,'בוחר אפשרות באקראי מתוך רשימה מופרדת ב-|','/f_pick פיצה | המבורגר | סושי'],
['f_teams','👥 מחלק משתתפים ל-2 צוותים',9500,'מחלק רשימת שמות באקראי ל-2 קבוצות מאוזנות','/f_teams דוב יוסי שניאור מנחם'],
['f_shuffle','🔀 מערבב רשימות ושורות באקראי',10500,'מערבב סדר של פריטים או שורות טקסט','/f_shuffle ראשון | שני | שלישי'],
['f_poll_maker','📊 מחולל סקר כפתורים חי',12000,'יוצר סקר כפתורים אינטראקטיבי בקבוצה עם ספירת קולות','/f_poll_maker שאלה | תשובה 1 | תשובה 2'],
['f_todo','✅ מנהל משימות אישי בבוט',13500,'שומר ומנהל רשימת משימות אישית שלך בכל קבוצה','/f_todo add לסיים עיצוב אתר'],
['f_notes','📌 פנקס הערות אישי שמור',15000,'שומר הערות ותזכורות אישיות שלך לשליפה מהירה','/f_notes save הערה חשובה'],
['f_snippet','💾 כספת תבניות טקסט מהירות',16500,'שומר תבניות טקסט קבועות לשליפה מהירה לפי שם','/f_snippet מחירון=טקסט קבוע'],
['f_table','📋 מעצב טבלה נקייה לטלגרם',18000,'הופך שורות מופרדות ב-| לטבלת Monospace מיושרת','/f_table מוצר | מחיר'],
['f_box','🖼️ מסגור הודעה בכרטיס הכרזה',19500,'ממסגר טקסט בתוך כרטיס מעוצב ובולט להודעות חשובות','/f_box עדכון חשוב לקבוצה!'],
['f_bullet','📑 מסדר טקסט לרשימת סעיפים',21000,'הופך משפטים לרשימת סעיפים ממוספרת ומעוצבת','/f_bullet סעיף א | סעיף ב'],
['f_loan','🏦 מחשבון הלוואה והחזר חודשי',22500,'מחשב החזר חודשי וסה"כ ריבית לפי סכום, ריבית וחודשים','/f_loan 50000 6 36'],
['f_bmi','⚖️ מחשבון BMI וטווח משקל תקין',24000,'מחשב מדד BMI וטווח משקל מומלץ לפי משקל וגובה','/f_bmi 72 178'],
['f_pomodoro','⏱️ טיימר פומודורו ומיקוד אישי',25500,'מפעיל טיימר עבודה ומתייג אותך בקבוצה בתום הזמן','/f_pomodoro 25 פיתוח בוט'],
['f_quote_card','💬 יוצר כרטיס ציטוט רשמי מהודעה',27000,'הופך הודעה שעליה השבת לכרטיס ציטוט עם שם ותאריך','/f_quote_card (בהשבה)'],
['f_summary','📰 מסכם הודעות ארוכות לנקודות',28500,'מחלץ את משפטי המפתח מתוך הודעה ארוכה שעליה השבת','/f_summary (בהשבה להודעה)'],
['f_tr_en','🇺🇸 מתרגם מהיר לאנגלית בצ׳אט',30000,'מתרגם מיד כל הודעה או טקסט לאנגלית ישירות בקבוצה','/f_tr_en שלום לכולם'],
['f_tr_he','🇮🇱 מתרגם מהיר לעברית בצ׳אט',31500,'מתרגם מיד כל הודעה משפה זרה לעברית ישירות בקבוצה','/f_tr_he Hello everyone'],
['f_bizcard','💼 כרטיס ביקור דיגיטלי עם כפתור',33000,'שומר ומציג כרטיס ביקור עסקי שלך עם כפתור לאתר','/f_bizcard set שם | תיאור | קישור'],
['f_active_scan','📡 סורק אנליטיקה ודירוג קבוצה',34000,'מפיק דוח אנליטי חי על הקבוצה ו-5 החברים המובילים','/f_active_scan'],
['f_omega_suite','👑 מרכז הבקרה האישי למייסד',35000,'פותח דשבורד אישי עם שעון עולמי, משימות, הערות ומדדים','/f_omega_suite']
].map(([cmd,name,price,desc,usage],idx)=>({idx,cmd,name,price,desc,usage}));const FEAT_BY_CMD={};for(const feat of SHOP_FEATS) {FEAT_BY_CMD[feat.cmd.toLowerCase()]=feat;}
const activeFeaturePolls={};const activeVolticQuizzes={};const addcmdWizards={};function swapHebEngKeyboard(input) {const e2h={q:'/',w:"'",e:'ק',r:'ר',t:'א',y:'ט',u:'ו',i:'ן',o:'ם',p:'פ',a:'ש',s:'ד',d:'ג',f:'כ',g:'ע',h:'י',j:'ח',k:'ל',l:'ך',';':'ף',"'":',',z:'ז',x:'ס',c:'ב',v:'ה',b:'נ',n:'מ',m:'צ',',':'ת','.':'ץ','/':' .'};
const h2e={};for(const [k,v] of Object.entries(e2h)) h2e[v.trim()]=k;const toHeb=(input.match(/[a-zA-Z]/g)||[]).length >=(input.match(/[א-ת]/g)||[]).length;
return input.split('').map((ch)=>toHeb?(e2h[ch.toLowerCase()]||ch) :(h2e[ch]||ch)).join('');}
function quickGoogleTranslate(text,tl) {return new Promise((resolve)=>{const clean=String(text||'').trim().slice(0,1200);
if(!clean) return resolve('');const u='https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl='+encodeURIComponent(tl)+'&dt=t&q='+encodeURIComponent(clean);
https.get(u,(res)=>{const chunks=[];res.on('data',(d)=>chunks.push(d));res.on('end',()=>{try {const p=JSON.parse(Buffer.concat(chunks).toString('utf8'));
resolve(Array.isArray(p?.[0])?p[0].map((x)=>x?.[0]||'').join('') :clean);}catch(e) {resolve(clean);}});}).on('error',()=>resolve(clean));});}
function hexToRgbObj(hex) {const c=String(hex||'').replace(/^#/,'').trim();if(!/^[0-9a-fA-F]{6}$/.test(c)) return null;
const n=parseInt(c,16);return {r:(n >> 16) & 255,g:(n >> 8) & 255,b:n & 255,hex:'#'+c.toUpperCase()};}
function relLum({r,g,b}) {const [R,G,B]=[r,g,b].map((v)=>{v /=255;return v <=0.03928?v / 12.92 :Math.pow((v+0.055) / 1.055,2.4);});return R*0.2126+G*0.7152+B*0.0722;}
async function execFounderTool({feat,cmdArg,msg,chat,from,uid,cid,bot}) {const replyMsg=msg?.reply_to_message,replyText=String(replyMsg?.text||replyMsg?.caption||'').trim();
const input=(cmdArg||replyText||'').trim(),c=feat.cmd,uName=from?.first_name||'מייסד';
const send=(text,inline_keyboard)=>callTg(bot,'sendMessage',{chat_id:cid,text,parse_mode:PM,disable_web_page_preview:true,...(inline_keyboard?{reply_markup:{inline_keyboard}}:{})});
const nums=(def)=>(input||def).match(/-?\d+(\.\d+)?/g)||def.split(' ');const num1=(def)=>parseFloat((input||String(def)).replace(/[^0-9.-]/g,''))||def;
const getSt=()=>getInfoSt();const saveSt=(s)=>saveInfoSt(s);
switch(c) {case 'f_calc':{const ex=(input||'250*1.18').replace(/[^0-9+\-*/().%\s]/g,'').trim();if(!ex) return send('🧮 שימוש: `/f_calc (250*1.18)/3`');
try {const v=Function(`"use strict";return (${ex})`)();
return send(`🧮 *מחשבון חכם:*\n• תרגיל: \`${ex}\`\n• תוצאה: *${Number.isFinite(v) ? Number(v.toFixed(4)).toLocaleString() : 'לא תקין'}*`);}
catch(e) {return send('⚠️ תרגיל לא תקין. דוגמה: `/f_calc (150+50)*2`');}}case 'f_vat':{const n=num1(1000);return send(`🧾 *מחשבון מע"מ (18%) על ${n.toLocaleString()} ₪:*\n• *לפני ⬅️ כולל מע"מ:* ${(n * 1.18).toFixed(2)} ₪ (מע"מ: ${(n * 0.18).toFixed(2)} ₪)\n• *כולל ⬅️ לפני מע"מ:* ${(n / 1.18).toFixed(2)} ₪ (מע"מ: ${(n - n / 1.18).toFixed(2)} ₪)`);
}case 'f_tip':{const [bStr,pStr]=nums('300 3'),b=parseFloat(bStr)||300,p=Math.max(1,parseInt(pStr||'1',10)||1);
return send(`🍽️ *חישוב טיפ וחלוקה (${b} ₪ ל-${p} סועדים):*\n`+[10,12,15].map((t)=>`• *טיפ ${t}%:* סה"כ ${(b * (1 + t / 100)).toFixed(1)} ₪ (*${((b * (1 + t / 100)) / p).toFixed(1)} ₪ לאדם*)`).join('\n'));
}case 'f_percent':{const [pStr,bStr]=nums('20 500'),pct=parseFloat(pStr)||20,base=parseFloat(bStr)||500,v=(pct / 100)*base;
return send(`📊 *חישוב אחוזים (${pct}% מתוך ${base.toLocaleString()}):*\n• סכום האחוז: *${v.toFixed(2)}* | אחרי הנחה: *${(base - v).toFixed(2)}* | אחרי תוספת: *${(base + v).toFixed(2)}*`);
}case 'f_age':{const d=new Date(input||'2005-06-25');if(isNaN(d.getTime())) return send('🎂 שימוש: `/f_age 2005-06-25`');
const now=new Date();let y=now.getFullYear()-d.getFullYear(),m=now.getMonth()-d.getMonth(),dy=now.getDate()-d.getDate();
if(dy < 0) {m--;dy+=30;}if(m < 0) {y--;m+=12;}const nb=new Date(now.getFullYear(),d.getMonth(),d.getDate());if(nb < now) nb.setFullYear(now.getFullYear()+1);
return send(`🎂 *חישוב גיל מדויק:*\n• גיל: *${y} שנים, ${m} חודשים ו-${dy} ימים*\n• ימים ליום ההולדת הבא: *${Math.ceil((nb - now) / 86400000)} ימים* 🎉`);}
case 'f_days':{const d=new Date(input||'2026-12-31');if(isNaN(d.getTime())) return send('📅 שימוש: `/f_days 2026-12-31`');
const diff=Math.ceil((d-new Date()) / 86400000),abs=Math.abs(diff);
return send(`📅 *ספירת ימים ל-${input||'2026-12-31'}:*\n• ${diff >= 0 ? `נותרו עוד *${abs} ימים*` : `חלפו *${abs} ימים*`} (${(abs / 7).toFixed(1)} שבועות)`);}
case 'f_worldclock':{const f=(tz)=>new Date().toLocaleTimeString('he-IL',{timeZone:tz,hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
return send(`🌍 *שעון עולמי חי:*\n• 🇮🇱 ירושלים: \`${f('Asia/Jerusalem')}\` | 🇺🇸 ניו יורק: \`${f('America/New_York')}\`\n• 🇬🇧 לונדון: \`${f('Europe/London')}\` | 🇫🇷 פריז: \`${f('Europe/Paris')}\` | 🇯🇵 טוקיו: \`${f('Asia/Tokyo')}\``);
}case 'f_unit':{const v=num1(10);return send(`📏 *המרת מידות ומשקלים (${v}):*\n• \`${v} ק"מ\` = *${(v * 0.6214).toFixed(2)} מייל* | \`${v} מייל\` = *${(v * 1.6093).toFixed(2)} ק"מ*\n• \`${v} ק"ג\` = *${(v * 2.2046).toFixed(2)} lbs* | \`${v} lbs\` = *${(v / 2.2046).toFixed(2)} ק"ג*\n• \`${v} ס"מ\` = *${(v / 2.54).toFixed(2)} אינץ׳* | \`${v} מטר\` = *${(v * 3.2808).toFixed(2)} רגל*`);
}case 'f_temp':{const v=num1(25);return send(`🌡️ *המרת טמפרטורה (${v}°):*\n• מצלזיוס לפרנהייט: *${v}°C = ${((v * 9) / 5 + 32).toFixed(1)}°F*\n• מפרנהייט לצלזיוס: *${v}°F = ${(((v - 32) * 5) / 9).toFixed(1)}°C*`);
}
case 'f_currency':{const a=num1(100);return send(`💱 *המרת מטבעות מהירה (${a.toLocaleString()}):*\n• 🇺🇸 *${a}$* ≈ \`${(a * 3.65).toFixed(2)} ₪\` | \`${(a * 0.92).toFixed(2)} €\`\n• 🇮🇱 *${a} ₪* ≈ \`${(a / 3.65).toFixed(2)} $\` | \`${(a / 3.95).toFixed(2)} €\`\n• 🇪🇺 *${a} €* ≈ \`${(a * 3.95).toFixed(2)} ₪\` | \`${(a * 1.08).toFixed(2)} $\``);
}case 'f_wordcount':{if(!input) return send('📝 השב להודעה או שלח `/f_wordcount [טקסט]` לניתוח אורך וזמן קריאה.');
const w=input.trim().split(/\s+/).filter(Boolean).length;return send(`📝 *ניתוח טקסט:*\n• מילים: *${w}* | תווים: *${input.length}* (ללא רווחים: *${input.replace(/\s+/g, '').length}*)\n• שורות: *${input.split('\n').length}* | זמן קריאה: *כ-${Math.max(1, Math.ceil((w / 180) * 60))} שניות*`);
}case 'f_clean':return input?send(`🧹 *הטקסט המנוקה:*\n\n${input.split('\n').map((l)=>l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n')}`) :send('🧹 השב להודעה או שלח `/f_clean [טקסט]` לניקוי רווחים.');
case 'f_reverse':return input?send(`🔄 *טקסט הפוך:*\n\`${Array.from(input).reverse().join('')}\``) :send('🔄 השב להודעה או שלח `/f_reverse [טקסט]` להיפוך אותיות.');
case 'f_kbd':return input?send(`⌨️ *תיקון מקלדת:*\n• מקור: \`${input.slice(0, 180)}\`\n• מתוקן: *${swapHebEngKeyboard(input).slice(0, 180)}*`) :send('⌨️ השב להודעה שהוקלדה בטעות באנגלית במקום בעברית ושלח `/f_kbd`!');
case 'f_pass':{const len=Math.min(32,Math.max(8,parseInt(input||'16',10)||16)),ch='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
const mk=()=>Array.from({length:len},()=>ch[crypto.randomInt(0,ch.length)]).join('');
return send(`🔐 *3 סיסמאות מאובטחות (${len} תווים):*\n1️⃣ \`${mk()}\`\n2️⃣ \`${mk()}\`\n3️⃣ \`${mk()}\``);}case 'f_pin_gen':return send(`🔢 *קודי אימות ומזהה ייחודי:*\n• 4 ספרות: \`${crypto.randomInt(1000, 9999)}\` | 6 ספרות: \`${crypto.randomInt(100000, 999999)}\` | 8 ספרות: \`${crypto.randomInt(10000000, 99999999)}\`\n• UUID: \`${crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex')}\``);
case 'f_base64':{if(!input) return send('🧬 שימוש: `/f_base64 encode טקסט` או `/f_base64 decode קוד`');const dec=/^decode\s+/i.test(input),b=input.replace(/^(encode|decode)\s+/i,'').trim();
return send(`🧬 *Base64 (${dec ? 'פענוח' : 'קידוד'}):*\n\`${dec ? Buffer.from(b, 'base64').toString('utf8') : Buffer.from(b, 'utf8').toString('base64')}\``);}
case 'f_urlencode':{if(!input) return send('🔗 שימוש: `/f_urlencode [קישור או טקסט]`');let dec=input;try {dec=decodeURIComponent(input);}catch(e) {}
return send(`🔗 *קידוד ופענוח קישור:*\n• Encoded: \`${encodeURIComponent(input)}\`\n• Decoded: \`${dec}\``);}case 'f_hash':{const s=input||'VolticMod';
return send(`🛡️ *חתימת אבטחה עבור \`${s.slice(0, 35)}\`:*\n• SHA-256: \`${crypto.createHash('sha256').update(s).digest('hex')}\`\n• MD5: \`${crypto.createHash('md5').update(s).digest('hex')}\``);
}
case 'f_json':{if(!input) return send('📐 שלח `/f_json {"key":"value"}` לבדיקת תקינות ועיצוב JSON.');try {return send(`✅ *JSON תקין:*\n\`\`\`json\n${JSON.stringify(JSON.parse(input), null, 2).slice(0, 2500)}\n\`\`\``);
}catch(e) {return send(`❌ *שגיאת JSON:* \`${e.message}\``);}}
case 'f_color':{const rgb=hexToRgbObj(input||'#38BDF8');return rgb?send(`🎨 *ממיר צבעים לעיצוב:*\n• HEX: \`${rgb.hex}\` | RGB: \`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})\``) :send('🎨 שימוש: `/f_color #38BDF8`');
}case 'f_contrast':{const [h1,h2]=(input||'#080C16 #38BDF8').split(/\s+/),c1=hexToRgbObj(h1)||hexToRgbObj('#080C16'),c2=hexToRgbObj(h2)||hexToRgbObj('#38BDF8');
const l1=relLum(c1),l2=relLum(c2),r=((Math.max(l1,l2)+0.05) / (Math.min(l1,l2)+0.05)).toFixed(2);
return send(`👁️ *בדיקת ניגודיות צבעים (WCAG):*\n• \`${c1.hex}\` מול \`${c2.hex}\` ⬅️ יחס: *${r}:1*\n• תקן AA: ${r >= 4.5 ? '✅ עובר מצוין' : '⚠️ נמוך מ-4.5'} | תקן AAA: ${r >= 7 ? '✅ עובר' : '⚪ מתחת ל-7'}`);
}case 'f_lorem':{const n=Math.min(4,Math.max(1,parseInt(input||'2',10)||2)),p='וולטיק מוד היא מערכת מתקדמת לניהול קבוצות, עיצוב ממשקים ואוטומציה בעברית. טקסט דמה זה מיועד לבדיקת גופנים, מרווחים ועימוד של כרטיסים ואתרי אינטרנט.';
return send(`📄 *טקסט דמה לעיצוב (${n} פסקאות):*\n\n${Array.from({ length: n }, (_, i)=>`${i + 1}. ${p}`).join('\n\n')}`);}
case 'f_whatsapp':{if(!input) return send('📲 שימוש: `/f_whatsapp 0501234567 שלום`');const pts=input.split(/\s+/);
let ph=pts[0].replace(/[^0-9]/g,'');if(ph.startsWith('0')) ph='972'+ph.slice(1);
else if(ph.length===10&&!ph.startsWith('972')) ph='1'+ph;const txt=pts.slice(1).join(' ').trim(),url=`https://wa.me/${ph}${txt ? `?text=${encodeURIComponent(txt)}` : ''}`;
return send(`📲 *קישור ישיר לוואטסאפ:*\n\`${url}\``,[[{text:'📲 פתח שיחה בוואטסאפ',url}]]);}
case 'f_tglink':{const mid=replyMsg?.message_id||msg?.message_id,msgLink=String(cid).startsWith('-100')?`https://t.me/c/${String(cid).replace(/^-100/, '')}/${mid}` :'https://t.me/VolticMod_bot';
const shareUrl=`https://t.me/share/url?url=${encodeURIComponent(input||msgLink)}`;return send(`✈️ *קישורי טלגרם מהירים:*\n• קישור להודעה: \`${msgLink}\`\n• קישור שיתוף: \`${shareUrl}\``,[[urlBtn('📤 שתף בטלגרם',shareUrl)]]);
}case 'f_utm':{const [uRaw,src='telegram',camp='voltic']=(input||'https://dov-portfolio.vercel.app telegram vip').split(/\s+/);
const base=/^https?:\/\//i.test(uRaw)?uRaw :`https://${uRaw}`;
return send(`📈 *קישור שיווקי עם מעקב UTM:*\n\`${base}${base.includes('?') ? '&' : '?'}utm_source=${encodeURIComponent(src)}&utm_medium=social&utm_campaign=${encodeURIComponent(camp)}\``);
}case 'f_qr':{const d=input||'https://dov-portfolio.vercel.app',qrUrl=`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(d)}`;
return send(`🔳 *קוד QR מוכן עבור:* \`${d.slice(0, 60)}\``,[[urlBtn('🔳 פתח תמונת QR Code לסריקה',qrUrl)]]);}
case 'f_shorten':{const m=(input||'').match(/https?:\/\/[^\s]+/i);if(!m) return send('✂️ שלח `/f_shorten [קישור]` או השב להודעה עם קישור לניקוי פרמטרי מעקב.');
try {const u=new URL(m[0]);for(const k of Array.from(u.searchParams.keys())) if(/^(utm_|fbclid|gclid|igshid|si|ref)/i.test(k)) u.searchParams.delete(k);
return send(`✂️ *קישור נקי מפרמטרי מעקב:*\n\`${u.toString()}\``);}
catch(e) {return send(`✂️ \`${m[0]}\``);}}case 'f_extract_links':{if(!input) return send('🔍 השב להודעה ארוכה עם `/f_extract_links` לחילוץ קישורים, מיילים ותיוגים.');
const urls=input.match(/https?:\/\/[^\s)]+/gi)||[],
mails=input.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)||[],tags=input.match(/@[a-zA-Z0-9_]{3,}/g)||[];
return send(`🔍 *חילוץ נתונים מההודעה:*\n🔗 קישורים (${urls.length}): ${urls.map((x)=>`\`${x}\``).join(', ')||'ללא'}\n📧 מיילים (${mails.length}): ${mails.join(', ')||'ללא'}\n👤 תיוגים (${tags.length}): ${tags.join(', ')||'ללא'}`);}case 'f_msginfo':{const tm=replyMsg||msg,tu=tm?.from||from,dt=tm?.date?new Date(tm.date*1000).toLocaleString('he-IL',{timeZone:'Asia/Jerusalem'}) :'כעת';return send(`🔬 *רנטגן להודעה:*\n• Message ID: \`${tm?.message_id}\` | Chat ID: \`${cid}\`\n• מאת: ${tu?.first_name||'משתמש'} (\`${tu?.id}\`)\n• זמן (ישראל): ${dt} | אורך: ${(tm?.text||tm?.caption||'').length} תווים`);
}
case 'f_myprofile':{const gData=await getGD(cid),fData=await getGD(FOUNDERS_CHAT_ID),st=await getSt();const mem=fData?.fnd?.members?.[uid]||{},owned=Array.from(new Set([...(mem.ownedFeatures||[]),...(st.ownedFeatures?.[uid]||[])]));
return send(`🪪 *כרטיס פרופיל – ${uName}:*\n• ID: \`${uid}\` | מעמד: ${isCrId(uid) ? 'היוצר של וולטיק מוד 👑' : (mem.title||'מייסד')}\n• נקודות מייסד: *${isCrId(uid) ? 'ללא הגבלה' : (mem.points||0).toLocaleString()}* | כלים פתוחים: *${isCrId(uid) ? 52 : owned.length}/52*\n• הודעות בקבוצה זו: *${gData?.adv?.userStats?.[uid]?.count||0}*`);
}case 'f_group_pulse':{const gData=await getGD(cid),stats=Object.values(gData?.adv?.userStats||{}).sort((a,b)=>(b.count||0)-(a.count||0));
return send(`💓 *מד דופק קבוצה – ${chat?.title||''}:*\n• סה"כ הודעות: *${(gData?.stats?.messages||0).toLocaleString()}* | פעילים: *${stats.length}*\n• מובילים: ${stats.slice(0, 3).map((u, i)=>`${['🥇','🥈','🥉'][i]} *${u.name}* (${u.count})`).join(' | ')||'אין עדיין'}`);
}case 'f_pick':{const arr=(input||'').split(/[|,]/).map((x)=>x.trim()).filter(Boolean);return arr.length < 2?send('🎯 שימוש: `/f_pick אפשרות 1 | אפשרות 2 | אפשרות 3`') :send(`🎯 *הבחירה האקראית מתוך ${arr.length} אפשרויות:*\n👉 **${arr[crypto.randomInt(0, arr.length)]}**`);
}
case 'f_teams':{const names=(input||'').split(/[\s,|]+/).map((x)=>x.trim()).filter(Boolean);if(names.length < 2) return send('👥 שימוש: `/f_teams דוב יוסי שניאור מנחם`');
const sh=[...names].sort(()=>Math.random()-0.5),mid=Math.ceil(sh.length / 2);
return send(`👥 *חלוקה ל-2 צוותים:*\n🔵 *צוות א׳:* ${sh.slice(0, mid).join(', ')}\n🔴 *צוות ב׳:* ${sh.slice(mid).join(', ')}`);
}case 'f_shuffle':{const arr=(input||'').split(/[|\n,]+/).map((x)=>x.trim()).filter(Boolean);
return arr.length < 2?send('🔀 שימוש: `/f_shuffle פריט 1 | פריט 2 | פריט 3`') :send(`🔀 *סדר אקראי חדש:*\n${[...arr].sort(()=>Math.random() - 0.5).map((x, i)=>`${i + 1}. ${x}`).join('\n')}`);
}
case 'f_poll_maker':{const pts=(input||'').split('|').map((x)=>x.trim()).filter(Boolean);if(pts.length < 3) return send('📊 שימוש: `/f_poll_maker שאלה | תשובה 1 | תשובה 2`');
const [q,...opts]=pts,pid=Date.now().toString(36);
activeFeaturePolls[pid]={q,opts:opts.slice(0,6),votes:{}};return send(`📊 *סקר חי מאת ${uName}:*\n❓ *${q}*`,activeFeaturePolls[pid].opts.map((o,i)=>[{text:`${o} (0)`,callback_data:`fpoll_${pid}_${i}`}]));
}case 'f_todo':{const st=await getSt();st.userTodos=st.userTodos||{};const list=Array.isArray(st.userTodos[uid])?st.userTodos[uid] :[];
if(/^add\s+/i.test(input)) {list.push(input.replace(/^add\s+/i,'').trim().slice(0,120));st.userTodos[uid]=list.slice(-20);await saveSt(st);}
else if(/^del\s+\d+/i.test(input)) {const idx=parseInt(input.replace(/^del\s+/i,''),10)-1;if(idx >=0&&idx < list.length) {list.splice(idx,1);
st.userTodos[uid]=list;await saveSt(st);}}else if(/^clear$/i.test(input)) {st.userTodos[uid]=[];await saveSt(st);return send('🧹 רשימת המשימות האישית שלך נוקתה!');
}else if(input) {list.push(input.slice(0,120));st.userTodos[uid]=list.slice(-20);await saveSt(st);}
return send(`✅ *המשימות של ${uName}:*\n${list.length ? list.map((t, i)=>`${i + 1}. ☑️ ${t}`).join('\n') : 'אין משימות פתוחות.'}\n\n💡 \`/f_todo add משימה\` | \`/f_todo del 1\` | \`/f_todo clear\``);
}case 'f_notes':{const st=await getSt();st.userNotes=st.userNotes||{};const notes=Array.isArray(st.userNotes[uid])?st.userNotes[uid] :[],
cleanIn=input.replace(/^save\s+/i,'').trim();
if((/^save\s+/i.test(input)||(replyText&&!cmdArg))&&cleanIn) {notes.push({text:cleanIn.slice(0,200),d:new Date().toLocaleDateString('he-IL')});st.userNotes[uid]=notes.slice(-15);
await saveSt(st);return send(`📌 ההערה נשמרה בפנקס האישי שלך! (סה"כ ${st.userNotes[uid].length} הערות)`);}if(/^clear$/i.test(input)) {st.userNotes[uid]=[];
await saveSt(st);return send('🧹 פנקס ההערות שלך נוקה.');}
return send(`📌 *פנקס ההערות של ${uName}:*\n${notes.length ? notes.map((n, i)=>`${i + 1}. ${n.text} _(${n.d})_`).join('\n') : 'הפנקס ריק.'}\n\n💡 לשמירה: \`/f_notes save טקסט\` (או בהשבה להודעה)`);
}case 'f_snippet':{const st=await getSt();st.userSnippets=st.userSnippets||{};const map=st.userSnippets[uid]=st.userSnippets[uid]||{};
if(input.includes('=')) {const [k,...r]=input.split('='),key=k.trim().toLowerCase(),val=r.join('=').trim();
if(key&&val) {map[key]=val.slice(0,400);await saveSt(st);return send(`💾 התבנית *"${key}"* נשמרה! לשליפה: \`/f_snippet ${key}\``);}}
if(input&&map[input.toLowerCase()]) return send(`💾 *${input}:*\n${map[input.toLowerCase()]}`);const keys=Object.keys(map);
return send(`💾 *תבניות שמורות (${keys.length}):* ${keys.join(', ')||'ללא'}\n💡 לשמירה: \`/f_snippet שם=תוכן\` | לשליפה: \`/f_snippet שם\``);}
case 'f_table':{const rows=(input||'מוצר | מחיר\nאתר | 2500 ₪\nבוט | 1800 ₪').replace(/\\n/g,'\n').split('\n').map((r)=>r.split('|').map((x)=>x.trim()));
const w=[];rows.forEach((r)=>r.forEach((cell,i)=>{w[i]=Math.max(w[i]||4,cell.length);}));const fmt=(r)=>r.map((cell,i)=>cell.padEnd(w[i],
' ')).join(' | ');return send(`📋 *טבלה מעוצבת:*\n\`\`\`\n${[fmt(rows[0]), w.map((n)=>'-'.repeat(n)).join('-+-'), ...rows.slice(1).map(fmt)].join('\n')}\n\`\`\``);}
case 'f_box':return send(`╔══════════════════════╗\n📣 *הכרזה מאת ${uName}*\n╚══════════════════════╝\n\n✨ *${input||'הודעה חשובה לחברי הקבוצה!'}*\n\n────────────────────────`);
case 'f_bullet':return send(`📑 *רשימת סעיפים מסודרת:*\n${(input||'סעיף ראשון | סעיף שני').split(/[|\n]+/).map((x)=>x.trim()).filter(Boolean).map((x, i)=>`🔹 *${i + 1}.* ${x}`).join('\n')}`);
case 'f_loan':{const [pStr,aStr,mStr]=nums('50000 6 36'),P=parseFloat(pStr)||50000,ann=parseFloat(aStr)||6,m=Math.max(1,parseInt(mStr||'36',10)||36),r=ann / 100 / 12;
const pmt=r===0?P / m :(P*r*Math.pow(1+r,m)) / (Math.pow(1+r,m)-1);
return send(`🏦 *מחשבון הלוואה (${P.toLocaleString()} ₪, ${ann}% לשנה, ${m} חודשים):*\n• החזר חודשי: *${pmt.toFixed(2)} ₪* | ריבית: *${(pmt * m - P).toFixed(2)} ₪* | סה"כ: *${(pmt * m).toFixed(2)} ₪*`);
}case 'f_bmi':{const [kStr,cStr]=nums('72 178'),kg=parseFloat(kStr)||72;let cm=parseFloat(cStr)||178;if(cm < 3) cm*=100;
const h=cm / 100,bmi=(kg / (h*h)).toFixed(1);return send(`⚖️ *מחשבון BMI (${kg} ק"ג, ${cm} ס"מ):*\n• מדד BMI: *${bmi}* (${bmi < 18.5 ? 'תת-משקל' : bmi < 25 ? 'משקל תקין ✅' : 'מעל הטווח'}) | טווח תקין: *${(18.5 * h * h).toFixed(1)}–${(24.9 * h * h).toFixed(1)} ק"ג*`);
}case 'f_pomodoro':{const pts=(input||'25 משימת מיקוד').split(/\s+/),mins=Math.min(120,Math.max(1,parseInt(pts[0],
10)||25)),task=pts.slice(1).join(' ').trim()||'סשן עבודה ממוקד';const userTag=from?.username?`@${from.username}` :uName,gData=await getGD(cid);
gData.reminders=Array.isArray(gData.reminders)?gData.reminders :[];gData.reminders.push({due:Date.now()+mins*60000,userTag,note:`🍅 סיום טיימר פומודורו (${mins} דק׳): ${task}`});
await saveGD(cid,gData);return send(`⏱️ *טיימר פומודורו הופעל ל-${mins} דקות!*\n🎯 משימה: *${task}* (אתייג אותך בתום הזמן)`);
}case 'f_quote_card':return (!replyText&&!input)?send('💬 השב להודעה עם `/f_quote_card` ליצירת כרטיס ציטוט מעוצב!') :send(`💬 *כרטיס ציטוט רשמי:*\n\n❝ _${(replyText||input).slice(0, 350)}_ ❞\n\n✍️ *מאת:* ${replyMsg?.from?.first_name||uName} | 📅 ${new Date().toLocaleDateString('he-IL')}`);
case 'f_summary':{if(!input) return send('📰 השב להודעה ארוכה עם `/f_summary` לחילוץ נקודות המפתח.');const sents=input.split(/[.!?\n]+/).map((s)=>s.trim()).filter((s)=>s.length > 15);
return send(`📰 *סיכום נקודות מפתח (${input.split(/\s+/).length} מילים):*\n${sents.slice(0, 4).map((s, i)=>`${i + 1}. 🔹 ${s}`).join('\n')||input.slice(0, 250)}`);}
case 'f_tr_en':return input?send(`🇺🇸 *תרגום לאנגלית:*\n${await quickGoogleTranslate(input, 'en')}`) :send('🇺🇸 שלח `/f_tr_en [טקסט]` או השב להודעה לתרגום מהיר לאנגלית.');
case 'f_tr_he':return input?send(`🇮🇱 *תרגום לעברית:*\n${await quickGoogleTranslate(input, 'iw')}`) :send('🇮🇱 שלח `/f_tr_he [טקסט]` או השב להודעה לתרגום מהיר לעברית.');
case 'f_bizcard':{const st=await getSt();
st.bizCards=st.bizCards||{};if(/^set\s+/i.test(input)) {const [title,desc,url]=input.replace(/^set\s+/i,'').split('|').map((x)=>(x||'').trim());
if(title) {st.bizCards[uid]={title,desc:desc||'שירות מקצועי',url:/^https?:\/\//i.test(url||'')?url :'https://dov-portfolio.vercel.app'};await saveSt(st);}}
const card=st.bizCards[uid]||{title:isCrId(uid)?'דוב עיצוב ופיתוח' :`העסק של ${uName}`,desc:'עיצוב גרפי, בניית אתרים ופיתוח בוטים',url:'https://dov-portfolio.vercel.app'};
return send(`💼 *כרטיס ביקור רשמי – ${card.title}*\n👤 בעלים: *${uName}* | 📝 שירותים: ${card.desc}\n\n💡 _לעריכה: \`/f_bizcard set שם | תיאור | קישור\`_`,[[{text:`🌐 לאתר של ${card.title}`,url:card.url}]]);
}case 'f_active_scan':{const gData=await getGD(cid),stats=Object.values(gData?.adv?.userStats||{}).sort((a,b)=>(b.count||0)-(a.count||0));
return send(`📡 *דוח אנליטיקה ודירוג קבוצה – ${chat?.title||''}:*\n• סה"כ הודעות: *${(gData?.stats?.messages||0).toLocaleString()}* | פעילים: *${stats.length}*\n\n🏅 *5 המובילים:*\n${stats.slice(0, 5).map((u, i)=>`${i + 1}. *${u.name}* (${u.count} הודעות)`).join('\n')||'אין נתונים עדיין'}`);
}default:{const st=await getSt(),gData=await getGD(cid),fData=await getGD(FOUNDERS_CHAT_ID),mem=fData?.fnd?.members?.[uid]||{};
const il=new Date().toLocaleTimeString('he-IL',{timeZone:'Asia/Jerusalem',hour:'2-digit',minute:'2-digit'});
const ny=new Date().toLocaleTimeString('he-IL',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit'});
return send(`👑 *מרכז הבקרה האישי למייסד – ${uName}:*\n🕒 שעון חי: ישראל \`${il}\` | ניו יורק \`${ny}\`\n✅ משימות (\`/f_todo\`): *${(st.userTodos?.[uid]||[]).length}* | 📌 הערות (\`/f_notes\`): *${(st.userNotes?.[uid]||[]).length}*\n💬 הודעות בקבוצה: *${(gData?.stats?.messages||0).toLocaleString()}* | ⭐ נקודות: *${isCrId(uid) ? 'יוצר הבוט' : (mem.points||0).toLocaleString()}*\n\n⚡ *כלים מובילים:* \`/f_calc\` | \`/f_vat\` | \`/f_kbd\` | \`/f_tr_he\` | \`/f_tr_en\` | \`/f_summary\` | \`/f_bizcard\``);
}}}function buildPointsShopView(mem,isCreatorUser,shopClosed=false) {const statusLine=isCreatorUser?`\n📌 *מצב שתי החנויות כרגע:* ${shopClosed ? '🔴 סגורות למייסדים' : '🟢 פתוחות למייסדים'}` :'';
const balLine=isCreatorUser?`👑 *היוצר של וולטיק מוד* (גישה חופשית לכל ההטבות והחנויות!)${statusLine}` :`💰 *המאזן שלך:* \`${(mem?.points||0).toLocaleString()}\` נקודות מייסד`;
const text=`🛒 *חנות נקודות – צוות המייסדים*\n${balLine}\n\nבחר הטבה לרכישה בנקודות:`;
const rows=[];if(isCreatorUser) {rows.push([cbBtn(shopClosed?'🔓 פתח את שתי החנויות למייסדים (כרגע: סגורות 🔴)' :'🔒 סגור את שתי החנויות למייסדים (כרגע: פתוחות 🟢)','pshop_toggle')]);
}rows.push([cbBtn('🌟 תואר "אדריכל זהב" (30 נק׳)','fshop_title')],[cbBtn('📣 הכרזת כבוד מהבוט בקבוצה (40 נק׳)','fshop_shout')],
[cbBtn('🚀 הקפצת רעיון לראש התור של היוצר (50 נק׳)','fshop_boost')],
[cbBtn('👑 מדליית כתר יוקרה בארון המדליות (80 נק׳)','fshop_crown')],[cbBtn('🛍️ מעבר לחנות הפיצ׳רים','vshop_page_0')],
[cbBtn('🔙 חזרה לפאנל צוות המייסדים','fnd_m_main')]);return {text,reply_markup:rmKb(rows)};}
function buildShopView(ownedList,userPoints,isCreatorUser,page=0,shopClosed=false) {const perPage=8;const totalPages=Math.ceil(SHOP_FEATS.length / perPage);
const safePage=Math.max(0,Math.min(page,totalPages-1));
const slice=SHOP_FEATS.slice(safePage*perPage,(safePage+1)*perPage);const ownedSet=new Set(Array.isArray(ownedList)?ownedList :[]);
const statusLine=isCreatorUser?`\n📌 *מצב שתי החנויות כרגע:* ${shopClosed ? '🔴 סגורות למייסדים' : '🟢 פתוחות למייסדים'}` :'';
const balLine=isCreatorUser?`👑 *היוצר של וולטיק מוד* (כל ${SHOP_FEATS.length} הפיצ'רים פתוחים עבורך בחינם!)${statusLine}`
:`💰 *המאזן שלך:* \`${userPoints.toLocaleString()}\` נקודות מייסד | ✅ *נרכשו:* ${ownedSet.size}/${SHOP_FEATS.length}`;
const listLines=slice.map((f)=>{const status=(isCreatorUser||ownedSet.has(f.cmd))?'✅ *ברשותך*' :`💰 *${f.price.toLocaleString()} נק׳*`;
return `• *${f.name}* (\`/${f.cmd}\`) – ${status}\n  _${f.desc}_`;}).join('\n\n');
const text=`🛍️ *חנות הפיצ׳רים – צוות המייסדים (עמוד ${safePage + 1}/${totalPages})*\n${balLine}\n\n✨ *כל פיצ'ר שתרכוש כאן פותח לך פקודה בלעדית שתעבוד לך בכל קבוצה שבה הבוט נמצא וגם בקבוצת המייסדים!*\n\n${listLines}\n\n👇 *לחץ על פיצ'ר למטה לרכישה או להפעלה:*`;
const rows=[];if(isCreatorUser) {rows.push([cbBtn(shopClosed?'🔓 פתח את שתי החנויות למייסדים (כרגע: סגורות 🔴)' :'🔒 סגור את שתי החנויות למייסדים (כרגע: פתוחות 🟢)',`vshop_toggle_${safePage}`)]);
}
for(let i=0;i < slice.length;i+=2) {const f1=slice[i];const has1=isCreatorUser||ownedSet.has(f1.cmd);const r=[{text:`${has1 ? '✅' : '🛒'} ${f1.name} (${has1 ? 'ברשותך' : `${f1.price.toLocaleString()} נק׳`})`,callback_data:`vshop_feat_${f1.idx}_${safePage}`}];
if(slice[i+1]) {const f2=slice[i+1];const has2=isCreatorUser||ownedSet.has(f2.cmd);r.push({text:`${has2 ? '✅' : '🛒'} ${f2.name} (${has2 ? 'ברשותך' : `${f2.price.toLocaleString()} נק׳`})`,callback_data:`vshop_feat_${f2.idx}_${safePage}`});
}rows.push(r);}const nav=[];if(safePage < totalPages-1) nav.push({text:'⬅️ עמוד הבא',callback_data:`vshop_page_${safePage + 1}`});
if(safePage > 0) nav.push({text:'➡️ עמוד קודם',callback_data:`${safePage - 1===0 ? 'vshop_page_0' : `vshop_page_${safePage - 1}`}`});
if(nav.length) rows.push(nav);rows.push([cbBtn('🛒 מעבר לחנות נקודות','pshop_open')],[cbBtn('🔙 חזרה לפאנל צוות המייסדים','fnd_m_main')]);return {text,reply_markup:rmKb(rows)};}
const FULL_MEMBER_PERMS={can_send_messages:true,can_send_audios:true,can_send_documents:true,can_send_photos:true,can_send_videos:true,can_send_other_messages:true,can_add_web_page_previews:true};
async function approvePhoneGroup(telegram,gid,extraUids=[]) {const gData=await getGD(gid);const ownState=await getGD('owner_global');
const infoState=await getInfoSt();const fndData=await getGD(FOUNDERS_CHAT_ID);gData.verifiedPhoneUsers=gData.verifiedPhoneUsers||{};
gData.pendingPhoneUsers=gData.pendingPhoneUsers||{};gData.autoApprovePendingPhone=true;const candidateUids=new Set();
for(const id of extraUids) if(id) candidateUids.add(String(id));
for(const id of Object.keys(gData.pendingPhoneUsers||{})) candidateUids.add(String(id));for(const id of Object.keys(gData.memberActivity||{})) candidateUids.add(String(id));
for(const id of Object.keys(gData.adv?.userStats||{})) candidateUids.add(String(id));
for(const id of Object.keys(ownState?.users||{})) candidateUids.add(String(id));for(const id of Object.keys(infoState?.userVersions||{})) candidateUids.add(String(id));
for(const id of Object.keys(fndData?.fnd?.members||{})) candidateUids.add(String(id));
let approvedCount=0;const approvedNames=[];for(const uid of candidateUids) {if(!/^\d+$/.test(uid)||isCrId(uid)) continue;
try {const m=await telegram.getChatMember(gid,Number(uid)).catch(()=>null);
if(!m||!m.user||m.user.is_bot) continue;const isRestricted=m.status==='restricted'||m.can_send_messages===false;
const wasPending=Boolean(gData.pendingPhoneUsers[uid]);if(isRestricted||wasPending) {await telegram.restrictChatMember(gid,Number(uid),{permissions:FULL_MEMBER_PERMS}).catch(noop);
gData.verifiedPhoneUsers[uid]=true;delete gData.pendingPhoneUsers[uid];approvedCount++;approvedNames.push(m.user.first_name||uid);}}catch(e) {}}
if(gData.lastVerifyMsgId) {await telegram.deleteMessage(gid,gData.lastVerifyMsgId).catch(noop);gData.lastVerifyMsgId=null;
}await saveGD(gid,gData);return {approvedCount,approvedNames,totalChecked:candidateUids.size};}
function isVerifyMessagePayload(payload) {if(!payload||typeof payload.text!=='string') return false;const kbStr=JSON.stringify(payload.reply_markup||'');
return kbStr.includes('ver_ok_')||kbStr.includes('fcnt_verifyme_')||payload.text.includes('כדי לוודא שאינך בוט')||payload.text.includes('לאימות קידומת הטלפון');}
function isWelcomeMessagePayload(payload) {if(!payload||typeof payload.text!=='string') return false;if(isVerifyMessagePayload(payload)) return false;
if(payload.text.startsWith('📜 *חוקי הקבוצה')||payload.text.startsWith('📢 *חוקי הקבוצה')||payload.text.startsWith('✅ הטקסט שעל כפתור החוקים')) return false;
const kbStr=JSON.stringify(payload.reply_markup||'');return kbStr.includes('?start=rules_')||payload.text.includes('אומתת בהצלחה וכעת באפשרותך לכתוב בקבוצה');}
module.exports=function registerInfoCommands(bot) {if(bot&&!bot._versionGateWrapped) {bot._versionGateWrapped=true;
const origHandleUpdate=bot.handleUpdate.bind(bot);bot.handleUpdate=async function (update,...rest) {try {const s=await getGD('owner_global');
if(s.lastVersion!==LATEST_VERSION) {s.lastVersion=LATEST_VERSION;await saveGD('owner_global',s);}
const msg=update?.message;const cb=update?.callback_query;const chat=msg?.chat||cb?.message?.chat;const from=msg?.from||cb?.from;
const uid=from?.id?String(from.id) :'';const cid=chat?.id?String(chat.id) :'';
const isGroup=chat&&['group','supergroup'].includes(chat.type);if(uid) bot._activeCtxUserVer=await getUserActiveVersion(uid);
if(isGroup&&msg?.text&&/^\/warn(@\S+)?(\s|$)/i.test(msg.text.trim())) {const replyTargetId=msg.reply_to_message?.from?.id;
const argId=(msg.text.trim().split(/\s+/)[1]||'').replace(/[^0-9]/g,'');bot._lastWarnTargetId=replyTargetId||argId||'';}
if(uid&&(chat?.type==='private'||isFoundersChatId(cid))) {const rawTxt=(msg?.text||'').trim();const cName=rawTxt.startsWith('/')?rawTxt.split(/\s+/)[0].replace(/^\//,'').split('@')[0].toLowerCase() :'';
if(cName==='setmission'&&isCrId(uid)) {const st=await getInfoSt();st.missionTestedCmds={};await saveInfoSt(st);
}else if(cName&&cName!=='mission') {const st=await getInfoSt();st.missionTestedCmds=st.missionTestedCmds||{};
const arr=Array.isArray(st.missionTestedCmds[uid])?st.missionTestedCmds[uid] :[];if(!arr.includes(cName)) {arr.push(cName);
st.missionTestedCmds[uid]=arr.slice(-25);await saveInfoSt(st);}}else if(cb?.data&&cb.data!=='fnd_mis_done'&&(cb.data.startsWith('hcmd_')||cb.data.startsWith('fnd_m_')||cb.data.startsWith('vq_'))) {const st=await getInfoSt();
st.missionTestedCmds=st.missionTestedCmds||{};const arr=Array.isArray(st.missionTestedCmds[uid])?st.missionTestedCmds[uid] :[];
const token=cb.data.slice(0,24);if(!arr.includes(token)) {arr.push(token);st.missionTestedCmds[uid]=arr.slice(-25);await saveInfoSt(st);}}}
if(cb?.data==='fnd_mis_done'&&uid&&!isCrId(uid)) {const st=await getInfoSt();const tested=Array.isArray(st.missionTestedCmds?.[uid])?st.missionTestedCmds[uid] :[];
if(tested.length < 3) {await callTg(bot,'answerCbQuery',{callback_query_id:cb.id,text:`⚠️ לא ניתן להשלים את המשימה עדיין! עליך לבדוק לפחות 3 פקודות (בפרטי של הבוט או בקבוצת המייסדים). עד כה בדקת: ${tested.length}/3 פקודות.`,show_alert:true}).catch(noop);
return;}}
if(cb?.data&&(cb.data==='fnd_m_shop'||cb.data==='fnd_fshop_menu'||cb.data.startsWith('fshop_')||cb.data.startsWith('pshop_')||cb.data.startsWith('fnd_shop_')||cb.data.startsWith('vshop_'))&&!isCrId(uid)) {const stShop=await getInfoSt();
if(stShop.shopClosed) {await ackApi(bot,cb,'🔒 חנות הנקודות וחנות הפיצ׳רים סגורות כרגע ע"י יוצר הבוט! הן ייפתחו בקרוב מחדש.',1);return;}}
if(cb?.data&&(cb.data==='fnd_fshop_menu')) {await ackApi(bot,cb);const txt='🛍️ *חנות הפיצ׳רים*\n\n⌨️ *מה לכתוב:*\n`/features`\n\n🤖 *מה הבוט ישיב:*\nפותח את חנות הפיצ׳רים של צוות המייסדים עם 52 פקודות וכלים שימושיים לרכישה בנקודות (מ-50 עד 35,000 נק׳) שעובדים בכל קבוצה וגם בקבוצת המייסדים!';
await callTg(bot,'editMessageText',{chat_id:cid,message_id:cb.message?.message_id,text:txt,parse_mode:PM,reply_markup:rmKb([[cbBtn('🛍️ פתח עכשיו את חנות הפיצ׳רים','vshop_page_0')],
[cbBtn('🔙 חזרה לפאנל צוות המייסדים','fnd_m_main')]])}).catch(noop);return;}if(cb?.data&&cb.data.startsWith('fpoll_')) {const [,pid,optIdxStr]=cb.data.split('_');
const poll=activeFeaturePolls[pid];if(!poll) {await ackApi(bot,cb,'הסקר הסתיים');return;}
poll.votes[uid]=parseInt(optIdxStr,10);await ackApi(bot,cb,'✅ הצבעתך נרשמה!');const kb={inline_keyboard:poll.opts.map((o,idx)=>{const cnt=Object.values(poll.votes).filter((v)=>v===idx).length;
return [{text:`${o} (${cnt})`,callback_data:`fpoll_${pid}_${idx}`}];})};await callTg(bot,'editMessageReplyMarkup',{chat_id:cid,message_id:cb.message?.message_id,reply_markup:kb}).catch(noop);
return;}if(cb?.data&&cb.data.startsWith('vq_')) {const parts=cb.data.split('_');const qid=parts[1];const qIdx=parseInt(parts[2],
10);const isCorrect=parts[3]==='1';const qState=activeVolticQuizzes[qid];if(!qState||qState.solved) {await ackApi(bot,cb,'השאלה הזו כבר נפתרה!');return;}
const st=await getInfoSt();st.quizAnsweredHistory=st.quizAnsweredHistory||{};const now=Date.now();const histKey=`${uid}:${qIdx}`;
const lastAnsTime=st.quizAnsweredHistory[histKey]||0;if(now-lastAnsTime < 3600000) {const minsLeft=Math.max(1,Math.ceil((3600000-(now-lastAnsTime)) / 60000));
await callTg(bot,'answerCbQuery',{callback_query_id:cb.id,text:`⏳ כבר ענית על השאלה הזו בשעה האחרונה! תוכל לענות על שאלה זו שוב רק בעוד ${minsLeft} דקות.`,show_alert:true}).catch(noop);
return;}if(!isCorrect) {await ackApi(bot,cb,'❌ תשובה לא נכונה! נסה שוב.',1);return;}
qState.solved=true;st.quizAnsweredHistory[histKey]=now;for(const [k,t] of Object.entries(st.quizAnsweredHistory)) {if(now-t > 3600000) delete st.quizAnsweredHistory[k];}
await saveInfoSt(st);let prizeText=`🏆 *${from?.first_name||'חבר'}* ענה נכון ראשון! 👏`;if(qState.isFounders) {const fData=await getGD(FOUNDERS_CHAT_ID);
fData.fnd=fData.fnd||{members:{}};fData.fnd.members=fData.fnd.members||{};if(!isCrId(uid)) {const mem=fData.fnd.members[uid]||{id:Number(uid),name:from?.first_name||'מייסד',points:10,title:'חבר צוות המייסדים'};
mem.points=(mem.points||0)+10;fData.fnd.members[uid]=mem;await saveGD(FOUNDERS_CHAT_ID,fData);}prizeText=isCrId(uid)?`👑 היוצר של וולטיק מוד (*${from?.first_name||'דוב'}*) פתר ראשון!`
:`🏆 המייסד *${from?.first_name||'חבר'}* ענה נכון ראשון וזכה ב-*+10 נקודות מייסד*!`;}await ackApi(bot,cb,'🎉 תשובה נכונה!');
const qItem=VOLTIC_QUIZ_POOL[qIdx]||[];await callTg(bot,'editMessageText',{chat_id:cid,message_id:cb.message?.message_id,text:`✅ *חידון וולטיק מוד נפתר!*\n❓ *שאלה:* ${qItem[0]||''}\n💡 *תשובה נכונה:* ${qItem[1]||''}\n\n${prizeText}`,parse_mode:PM}).catch(noop);
return;}if(isGroup&&Array.isArray(msg?.new_chat_members)&&msg.new_chat_members.length) {const gData=await getGD(cid);
const verOn=Boolean(gData.blockFutureUntilVerify||gData.adv?.verifyEnabled||gData.adv?.foreignCountries?.requirePhoneVerify);
if(verOn) {gData.pendingPhoneUsers=gData.pendingPhoneUsers||{};gData.verifiedPhoneUsers=gData.verifiedPhoneUsers||{};
for(const nm of msg.new_chat_members) {if(nm&&!nm.is_bot&&!isCrId(nm.id)) {delete gData.verifiedPhoneUsers[String(nm.id)];
gData.pendingPhoneUsers[String(nm.id)]={name:nm.first_name||'חבר',joinedAt:Date.now()};}}await saveGD(cid,gData);}}
if(isGroup&&msg?.pinned_message?.message_id) {const gData=await getGD(cid);gData.pinnedMsgIds=Array.isArray(gData.pinnedMsgIds)?gData.pinnedMsgIds :[];
if(!gData.pinnedMsgIds.includes(msg.pinned_message.message_id)) {gData.pinnedMsgIds.push(msg.pinned_message.message_id);await saveGD(cid,gData);}}
if(isGroup&&msg?.left_chat_member?.id) {const gData=await getGD(cid);const luid=String(msg.left_chat_member.id);
if(gData.pendingPhoneUsers?.[luid]) {delete gData.pendingPhoneUsers[luid];await saveGD(cid,gData);await flushHeldUnverifiedMsgs(bot.telegram,cid,gData);}}
if(isGroup&&cb?.data&&cb.data.startsWith('fcnt_verifyme_')) {const targetId=Number(cb.data.replace('fcnt_verifyme_',''));
const clickerIsAdmin=isCrId(uid)||(await isGroupAdminCb({chat,from,telegram:bot.telegram}));if(Number(uid)!==targetId&&!clickerIsAdmin) {await ackApi(bot,cb,'⚠️ כפתור אימות זה מיועד למצטרף החדש או למנהלי הקבוצה בלבד!',1);
return;}
await bot.telegram.restrictChatMember(cid,targetId,{permissions:FULL_MEMBER_PERMS}).catch(noop);const gData=await getGD(cid);gData.verifiedPhoneUsers=gData.verifiedPhoneUsers||{};
gData.verifiedPhoneUsers[String(targetId)]=true;if(gData.pendingPhoneUsers) delete gData.pendingPhoneUsers[String(targetId)];
await saveGD(cid,gData);await flushHeldUnverifiedMsgs(bot.telegram,cid,gData);
await ackApi(bot,cb,'✅ המשתמש אושר בהצלחה וקיבל הרשאת כתיבה מלאה בקבוצה!',1);const botUsername=bot.botInfo?.username||'VolticMod_bot';
const rulesUrl=`https://t.me/${botUsername}?start=rules_${cid}`;
const btnText=gData.rulesButtonText||'📖 לחץ כאן לצפייה בחוקי הקבוצה';await callTg(bot,'editMessageText',{chat_id:cid,message_id:cb.message?.message_id,text:`✅ *האימות הושלם בהצלחה!* כעת באפשרותך לכתוב בקבוצה בחופשיות.`,parse_mode:PM,reply_markup:rmKb([[urlBtn(btnText,rulesUrl)]])}).catch(noop);
return;}if(isGroup&&!isFoundersChatId(cid)) {const gData=await getGD(cid);if(isCrId(uid)&&gData.groupVersion!==LATEST_VERSION) {gData.groupVersion=LATEST_VERSION;
await saveGD(cid,gData);}if(gData.groupVersion===LATEST_VERSION) {bot._activeCtxUserVer=LATEST_VERSION;}else {const cbData=cb?.data||'';
const msgText=(msg?.text||'').trim();
const isBotCommand=msgText.startsWith('/');const isBotCallback=Boolean(cb&&cbData!=='grp_upgrade_ver');if(isBotCommand||isBotCallback) {if(isBotCallback) {await ackApi(bot,cb,'⚠️ יש לעדכן תחילה את גרסת הבוט בקבוצה ע"י מנהל הקבוצה!',1);
}
await sendApi(bot,cid,`⚠️ *גרסה חדשה של וולטיק מוד זמינה (${LATEST_VERSION})!*\nכדי להמשיך להפעיל את הבוט ולפתוח את הפקודות החדשות בקבוצה זו, על *מנהל הקבוצה* ללחוץ על הכפתור למטה לעדכון גרסת הבוט:`,[[cbBtn('♻️עדכון גרסת הבוט♻️','grp_upgrade_ver')]]);
return;}}}else if(isGroup&&isFoundersChatId(cid)) {bot._activeCtxUserVer=LATEST_VERSION;const gData=await getGD(cid);
if(gData.groupVersion!==LATEST_VERSION) {gData.groupVersion=LATEST_VERSION;
await saveGD(cid,gData);}}if(isGroup&&msg&&!msg.new_chat_members&&!msg.left_chat_member&&!(msg.text||'').trim().startsWith('/')) {const gData=await getGD(cid);
if(gData.blockFutureUntilVerify&&hasActiveUnverified(gData)) {if(gData.pendingPhoneUsers?.[uid]) {await bot.telegram.deleteMessage(cid,msg.message_id).catch(noop);
return;}
gData.heldUnverifiedMsgs=Array.isArray(gData.heldUnverifiedMsgs)?gData.heldUnverifiedMsgs :[];const ilTime=new Date().toLocaleTimeString('he-IL',{timeZone:'Asia/Jerusalem',hour:'2-digit',minute:'2-digit'});
gData.heldUnverifiedMsgs.push({sender:from?.first_name||'חבר',time:ilTime,text:msg.text||'',caption:msg.caption||'',photo:msg.photo?.length?msg.photo[msg.photo.length-1].file_id :null,video:msg.video?.file_id||null,document:msg.document?.file_id||null,sticker:msg.sticker?.file_id||null});
if(gData.heldUnverifiedMsgs.length > 40) gData.heldUnverifiedMsgs.shift();await saveGD(cid,gData);await bot.telegram.deleteMessage(cid,msg.message_id).catch(noop);return;}}
if(chat?.type==='private'&&isCrId(uid)&&msg?.text&&!msg.text.trim().startsWith('/')) {const rawIn=msg.text.trim();
const wMode=creatorWaitState[uid];if(/^עדכון חדש\s*:/i.test(rawIn)||wMode==='edit_update_replace'||wMode==='edit_update_append') {delete creatorWaitState[uid];
const st=await getInfoSt();st.customUpdateText=st.customUpdateText||{};st.customVersions=st.customVersions||{};const isDirectNewUpdate=/^עדכון חדש\s*:/i.test(rawIn);
const cleanBody=rawIn.replace(/^עדכון חדש\s*:\s*/i,'').trim();
let targetVer=getLatestVer(st);
if(isDirectNewUpdate) {targetVer=bumpVersionNumber(targetVer);st.dynamicLatestVersion=targetVer;}
if(wMode==='edit_update_append'&&!isDirectNewUpdate) {const prev=getEffectiveUpdateText(st,targetVer);st.customUpdateText[targetVer]=`${prev}\n• ${cleanBody}`;}
else {const formatted=cleanBody.startsWith('🔥')||cleanBody.startsWith('📦')?cleanBody :`🔥 *עדכון מספר ${targetVer} – מה חדש בעדכון זה:*\n\n${cleanBody}`;st.customUpdateText[targetVer]=formatted;if(isDirectNewUpdate){st.customVersions[targetVer]={title:`עדכון מספר ${targetVer}`,date:new Date().toISOString().slice(0,10),text:formatted};}}
await saveInfoSt(st);const pView=buildEditUpdatePanel(st);await sendApi(bot,cid,`✅ *הודעת העדכון (${targetVer}) עודכנה בהצלחה!*\n${isDirectNewUpdate ? `🚀 מספר העדכון עלה אוטומטית לגרסה *${targetVer}* ונשמר כעדכון חדש.` : (wMode!=='edit_update_append' ? '📌 הטקסט נשמר כהודעת העדכון הנוכחית.' : '📌 הסעיף נוסף להודעת העדכון הקיימת.')}\n\n${pView.text}`,pView.reply_markup.inline_keyboard);
return;}}
if(chat?.type==='private'&&msg?.reply_to_message&&msg?.text&&!msg.text.trim().startsWith('/')) {const repliedTxt=String(msg.reply_to_message.text||msg.reply_to_message.caption||'');
if(!isCrId(uid)&&(repliedTxt.includes('ההודעה מהמנהל:')||repliedTxt.includes('הגב להודעה זו כדי להגיב')||repliedTxt.includes('תשובה מיוצר וולטיק מוד'))) {const uName=from?.first_name||'משתמש';
const uTag=from?.username?`@${from.username}` :'ללא';const cleanOrig=repliedTxt.replace('הגב להודעה זו כדי להגיב','').trim();
await callTg(bot,'sendMessage',{chat_id:CREATOR_ID,text:`📩 תגובה חדשה ממשתמש להודעתך:\n👤 מאת: ${uName} (${uTag})\n🆔 ID: ${uid}\n↩️ בתגובה ל: "${cleanOrig.slice(0, 120)}"\n\n💬 תוכן ההודעה:\n${msg.text.trim()}`,reply_markup:{inline_keyboard:[[{text:'💬 השב למשתמש זה',callback_data:`ask_reply_${uid}`}]]}}).catch(noop);
await callTg(bot,'sendMessage',{chat_id:cid,text:'נשלח בהצלחה למנהל'}).catch(noop);return;}
if(isCrId(uid)) {const idMatch=repliedTxt.match(/🆔\s*\*?ID:\*?\s*`?(\d+)`?/);if(idMatch&&idMatch[1]) {const targetUid=idMatch[1];
await callTg(bot,'sendMessage',{chat_id:targetUid,text:`ההודעה מהמנהל: ${msg.text.trim()}\n\nהגב להודעה זו כדי להגיב`}).catch(noop);
await callTg(bot,'sendMessage',{chat_id:CREATOR_ID,text:`✅ ההודעה נשלחה בהצלחה למשתמש ${targetUid}!`}).catch(noop);return;}}}
const rawCmdText=(msg?.text||'').trim();const isSlashCmd=rawCmdText.startsWith('/');const cmdName=isSlashCmd?rawCmdText.split(/\s+/)[0].replace(/^\//,'').split('@')[0].toLowerCase() :'';
const cmdArg=isSlashCmd?rawCmdText.split(/\s+/).slice(1).join(' ').trim() :'';if(isGroup&&msg?.text&&!isSlashCmd&&addcmdWizards[`${cid}:${uid}`]) {const wiz=addcmdWizards[`${cid}:${uid}`];
const inputTxt=msg.text.trim();if(wiz.step===1) {const cleanQ=inputTxt.replace(/^\//,'').trim().toLowerCase();wiz.step=2;wiz.question=cleanQ;
await sendApi(bot,cid,`💬 *שלב 2 מתוך 2 – הגדרת התשובה:*\nמה הבוט צריך לענות כשמישהו יכתוב את השאלה או הפקודה *"\`${cleanQ}\`"*?\n\n✍️ כתוב עכשיו את התשובה (ניתן לשלב עיצוב וכפתורים כמו \`{{כפתור}{https://t.me/VolticMod_bot}}\`):`,[[cbBtn('❌ ביטול','addcmd_wiz_cancel')]]);
return;}if(wiz.step===2) {const cleanQ=wiz.question;delete addcmdWizards[`${cid}:${uid}`];const gData=await getGD(cid);
gData.customCommands=gData.customCommands||{};gData.customCommands[cleanQ]=inputTxt;
const slug=cleanQ.split(/\s+/)[0].replace(/^\//,'');if(slug) gData.customCommands[slug]=inputTxt;await saveGD(cid,gData);
await safeSendGroupRich(bot.telegram,cid,inputTxt).catch(noop);
await callTg(bot,'sendMessage',{chat_id:cid,text:`✅ *הפקודה המותאמת אישית נשמרה בהצלחה!*\n❓ *שאלה:* \`/${slug}\` (או כתיבת \`${cleanQ}\`)\n💬 *תשובה:* מוצגת בתצוגה המקדימה מעל.`,parse_mode:PM}).catch(noop);
return;}}if(isGroup&&msg?.text&&!isSlashCmd) {const gData=await getGD(cid);const lookupKey=msg.text.trim().toLowerCase();
if(gData.customCommands&&gData.customCommands[lookupKey]) {await safeSendGroupRich(bot.telegram,cid,gData.customCommands[lookupKey]).catch(noop);return;}}
if(isGroup&&isSlashCmd&&cmdName==='unpin') {const isAdm=isCrId(uid)||(await isGroupAdminCb({chat,from,telegram:bot.telegram}));
if(!isAdm) {await sendApi(bot,cid,'⛔ פקודה זו מיועדת למנהלי הקבוצה בלבד.\nדוגמת שימוש: `/unpin (בהשבה)`');return;
}if(!msg.reply_to_message) {await callTg(bot,'sendMessage',{chat_id:cid,text:'אנא השב להודעה הנעוצה'}).catch(noop);return;}}
if(isGroup&&isSlashCmd&&FEAT_BY_CMD[cmdName]) {const feat=FEAT_BY_CMD[cmdName];const fData=await getGD(FOUNDERS_CHAT_ID);
const mem=fData?.fnd?.members?.[uid];const st=await getInfoSt();
const ownedGlobal=st?.ownedFeatures?.[uid]||[];const ownedFnd=Array.isArray(mem?.ownedFeatures)?mem.ownedFeatures :[];
const hasFeature=isCrId(uid)||ownedGlobal.includes(feat.cmd)||ownedFnd.includes(feat.cmd);
if(!hasFeature) {await sendApi(bot,cid,`🔒 הפקודה \`/${feat.cmd}\` (*${feat.name}*) היא פיצ'ר מיוחד מחנות המייסדים!\n💰 *מחיר הפיצ'ר:* ${feat.price.toLocaleString()} נקודות מייסד.\n\n💡 מייסדים שרוכשים את הפיצ'ר דרך \`/shop\` בקבוצת המייסדים יכולים להפעיל אותו בכל קבוצה שבה הבוט נמצא!`,[[urlBtn('👑 מעבר לקבוצת צוות המייסדים','https://t.me/+v4Hrdnpg0rI3MTk0')]]);
return;}await execFounderTool({feat,cmdArg,msg,chat,from,uid,cid,bot}).catch(noop);return;}
if(isSlashCmd&&(cmdName==='open_shop'||cmdName==='shop_open'||cmdName==='close_shop'||cmdName==='shop_close'||cmdName==='toggle_shop')) {if(!isCrId(uid)) {await sendApi(bot,cid,'⛔ פקודה זו מיועדת ליוצר הבוט בלבד.');
return;}const st=await getInfoSt();if(cmdName.includes('open')) st.shopClosed=false;else if(cmdName.includes('close')) st.shopClosed=true;
else st.shopClosed=!st.shopClosed;await saveInfoSt(st);
await sendApi(bot,cid,st.shopClosed?'🔒 *שתי החנויות (חנות הנקודות וחנות הפיצ׳רים) נסגרו כעת!* מייסדים לא יוכלו להיכנס או לבצע רכישות בשתי החנויות עד שתפתח אותן מחדש.' :'🔓 *שתי החנויות (חנות הנקודות וחנות הפיצ׳רים) נפתחו מחדש!* כעת כל המייסדים יכולים להיכנס ולרכוש בשתי החנויות.');
return;}
if(isGroup&&isSlashCmd&&(cmdName==='shop'||cmdName==='points_shop'||cmdName==='features'||cmdName==='features_shop'||cmdName==='buy_feature')) {if(isCrId(uid)&&/^(open|close|on|off|פתח|סגור)$/i.test(cmdArg)) {const st=await getInfoSt();
st.shopClosed=/^(close|off|סגור)$/i.test(cmdArg);await saveInfoSt(st);await sendApi(bot,cid,st.shopClosed?'🔒 *חנות הנקודות וחנות הפיצ׳רים נסגרו למייסדים!*' :'🔓 *חנות הנקודות וחנות הפיצ׳רים נפתחו למייסדים!*');
return;}if(!isFoundersChatId(cid)&&!isCrId(uid)) {await sendApi(bot,cid,`⚠️ הפקודה \`/${cmdName}\` פועלת בקבוצת צוות המייסדים בלבד (לאחר רכישת פיצ'רים הם עובדים בכל הקבוצות!).`,[[urlBtn('👑 מעבר לקבוצת צוות המייסדים','https://t.me/+v4Hrdnpg0rI3MTk0')]]);
return;}
const st=await getInfoSt();if(st.shopClosed&&!isCrId(uid)) {await sendApi(bot,cid,'🔒 *חנות הנקודות וחנות הפיצ׳רים סגורות כרגע ע"י יוצר הבוט!*\nשתי החנויות ייפתחו בקרוב מחדש לרכישות ושדרוגים. נסו שוב מאוחר יותר 🙏');
return;}const fData=await getGD(FOUNDERS_CHAT_ID);fData.fnd=fData.fnd||{members:{}};fData.fnd.members=fData.fnd.members||{};
const mem=fData.fnd.members[uid]||{id:Number(uid),name:from?.first_name||'מייסד',points:10,ownedFeatures:[]};
fData.fnd.members[uid]=mem;await saveGD(FOUNDERS_CHAT_ID,fData);const isPointsShop=(cmdName==='shop'||cmdName==='points_shop')&&!/^(features|פיצ)/i.test(cmdArg);
if(isPointsShop) {const pView=buildPointsShopView(mem,isCrId(uid),Boolean(st.shopClosed));
await callTg(bot,'sendMessage',{chat_id:cid,text:pView.text,parse_mode:PM,reply_markup:pView.reply_markup}).catch(noop);return;}
const owned=Array.from(new Set([...(mem.ownedFeatures||[]),...(st.ownedFeatures?.[uid]||[])]));const view=buildShopView(owned,mem.points||0,isCrId(uid),0,Boolean(st.shopClosed));
await callTg(bot,'sendMessage',{chat_id:cid,text:view.text,parse_mode:PM,reply_markup:view.reply_markup}).catch(noop);
return;}if(isGroup&&isSlashCmd&&(cmdName==='quiz_bot'||cmdName==='trivia')) {if(cmdName==='quiz_bot'&&!isFoundersChatId(cid)) {await sendApi(bot,cid,`⚠️ הפקודה \`/quiz_bot\` מיועדת לצוות המייסדים ועובדת בקבוצת צוות המייסדים בלבד! (בקבוצה רגילה השתמשו ב-\`/trivia\`).`);
return;}const st=await getInfoSt();st.quizAnsweredHistory=st.quizAnsweredHistory||{};const now=Date.now();const availableIndices=[];
for(let i=0;i < VOLTIC_QUIZ_POOL.length;i++) {const lastT=st.quizAnsweredHistory[`${uid}:${i}`]||0;if(now-lastT >=3600000) availableIndices.push(i);}
const poolIndices=availableIndices.length > 0?availableIndices :VOLTIC_QUIZ_POOL.map((_,i)=>i);const chosenIdx=poolIndices[Math.floor(Math.random()*poolIndices.length)];
const [qText,rightAns,w1,w2,w3]=VOLTIC_QUIZ_POOL[chosenIdx];
const qid=Date.now().toString(36)+Math.floor(Math.random()*99);activeVolticQuizzes[qid]={qIdx:chosenIdx,solved:false,isFounders:cmdName==='quiz_bot'||isFoundersChatId(cid)};
const opts=[
{text:rightAns,callback_data:`vq_${qid}_${chosenIdx}_1`},{text:w1,callback_data:`vq_${qid}_${chosenIdx}_0`},{text:w2,callback_data:`vq_${qid}_${chosenIdx}_0`},{text:w3,callback_data:`vq_${qid}_${chosenIdx}_0`}].sort(()=>Math.random()-0.5);
const header=(cmdName==='quiz_bot'||isFoundersChatId(cid))?`🧠 *חידון מומחי וולטיק מוד (שאלה #${chosenIdx + 1} מתוך ${VOLTIC_QUIZ_POOL.length})!*\nהמייסד הראשון שעונה נכון מקבל *+10 נקודות מייסד* (משתמש שענה על שאלה זו בשעה האחרונה יוכל לענות עליה שוב רק אחרי שעה):`
:`🧠 *אתגר טריוויה – וולטיק מוד (שאלה #${chosenIdx + 1} מתוך ${VOLTIC_QUIZ_POOL.length})!*\nהראשון שלוחץ על התשובה הנכונה מנצח:`;
await callTg(bot,'sendMessage',{chat_id:cid,text:`${header}\n\n❓ *${qText}*`,parse_mode:PM,reply_markup:{inline_keyboard:opts.map((o)=>[o])}}).catch(noop);return;}
if(chat?.type==='private'&&cmdName==='start'&&cmdArg.startsWith('webapp_')) {const targetCid=cmdArg.replace('webapp_','').trim();const appUrl=targetCid?`https://dov-telegram-bot.vercel.app/webapp.html?chatId=${encodeURIComponent(targetCid)}` :'https://dov-telegram-bot.vercel.app/webapp.html';await callTg(bot,'sendMessage',{chat_id:cid,text:'📱 *לוח הניהול החכם של וולטיק מוד מוכן עבורך!*\nלחץ על הכפתור למטה לפתיחת המיני-אפליקציה לניהול הקבוצה:',parse_mode:PM,reply_markup:rmKb([[{text:'📱 פתח עכשיו את המיני-אפליקציה',web_app:{url:appUrl}}]])}).catch(noop);return;}
if(chat?.type==='private') {if(cmdName==='start'&&(cmdArg==='ask_creator'||cmdArg==='translate_file')) {msg.text=`/${cmdArg}`;
if(Array.isArray(msg.entities)) msg.entities=[{offset:0,length:msg.text.length,type:'bot_command'}];}else if(cmdName==='rate'||cmdName==='rate_bot') {msg.text='/start rate_bot';
if(Array.isArray(msg.entities)) msg.entities=[{offset:0,length:6,type:'bot_command'}];}else if(cmdName==='suggest'||cmdName==='propose') {msg.text='/request_command';
if(Array.isArray(msg.entities)) msg.entities=[{offset:0,length:msg.text.length,type:'bot_command'}];}}
if(isGroup) {if(isSlashCmd&&PRIV_CMDS.has(cmdName)) {const botUsername=bot.botInfo?.username||'VolticMod_bot';
let startParam='';if(cmdName==='request_command'||cmdName==='suggest'||cmdName==='propose') startParam='?start=request_command';
else if(cmdName==='rate'||cmdName==='rate_bot') startParam='?start=rate_bot';else if(cmdName==='ask_creator') startParam='?start=ask_creator';
else if(cmdName==='translate_file'||cmdName==='translate') startParam='?start=translate_file';
await sendApi(bot,cid,`⚠️ הפקודה \`/${cmdName}\` לא עובדת בקבוצה – *הפקודה עובדת בפרטי בלבד!*`,[[{text:'💬 לחץ כאן למעבר לפרטי של הבוט',url:`https://t.me/${botUsername}${startParam}`}]]);
return;}const cbData=cb?.data||'';if(cb&&PRIV_CBS.has(cbData)) {const botUsername=bot.botInfo?.username||'VolticMod_bot';
const paramMap={reqcmd_start:'?start=request_command',rate_start:'?start=rate_bot',askcreator_start:'?start=ask_creator',trfile_start:'?start=translate_file'};
await ackApi(bot,cb,'⚠️ אפשרות זו לא עובדת בקבוצה – היא עובדת בפרטי בלבד!',1);
await sendApi(bot,cid,'⚠️ אפשרות זו לא עובדת בקבוצה – *הפקודה עובדת בפרטי בלבד!*',[[{text:'💬 לחץ כאן להפעלה בפרטי של הבוט',url:`https://t.me/${botUsername}${paramMap[cbData]||''}`}]]);
return;}
if(isSlashCmd&&!isFoundersChatId(cid)&&FND_CMDS.has(cmdName)) {await callTg(bot,'sendMessage',{chat_id:cid,text:`⚠️ הפקודה \`/${cmdName}\` מיועדת לצוות המייסדים ועובדת בקבוצת צוות המייסדים בלבד!`,parse_mode:PM}).catch(noop);
return;}}
if(chat?.type==='private'&&isSlashCmd) {if(FND_CMDS.has(cmdName)) {const creatorLookup=isCrId(uid)&&((cmdName==='founders'||cmdName==='founders_menu')&&cmdArg);
if(!creatorLookup) {await sendApi(bot,cid,`⚠️ הפקודה \`/${cmdName}\` לא עובדת בפרטי – *הפקודה עובדת בקבוצות (בקבוצת צוות המייסדים) בלבד!*`,[
[urlBtn('👑 מעבר לקבוצת צוות המייסדים','https://t.me/+v4Hrdnpg0rI3MTk0')],[cbBtn('🔙 חזרה לתפריט הראשי','help_main')]]);return;}}
if(GRP_CMDS.has(cmdName)) {const botUsername=bot.botInfo?.username||'VolticMod_bot';await sendApi(bot,cid,`⚠️ הפקודה \`/${cmdName}\` לא עובדת בפרטי – *הפקודה עובדת בקבוצות בלבד!*`,[
[{text:'➕ הוסף את הבוט לקבוצה',url:`https://t.me/${botUsername}?startgroup=true`}],[cbBtn('🔙 חזרה לתפריט הראשי','help_main')]]);return;}}
if(chat?.type==='private'&&uid&&!isCrId(uid)) {const userVer=bot._activeCtxUserVer||PREV_VER;if(userVer!==LATEST_VERSION&&isSlashCmd) {if(NEW_CMDS.has(cmdName)) {await sendApi(bot,cid,`⚠️ הפקודה \`/${cmdName}\` שייכת לגרסה החדשה של הבוט (*${LATEST_VERSION}*)!\nהגרסה הנוכחית שלך היא: *${userVer}*.\n\n👇 לחץ על הכפתור למטה כדי לעדכן את גרסת הבוט שלך ולפתוח את כל הפקודות החדשות:`,[[cbBtn('♻️עדכון גרסת הבוט♻️','ver_upgrade_user')]]);
return;}}}}catch(e) {}const res=await origHandleUpdate(update,...rest);try {const cbData=update?.callback_query?.data||'';
const chat=update?.callback_query?.message?.chat;if(chat&&/^ver_ok_\d+_1$/.test(cbData)) {const gData=await getGD(chat.id);
await flushHeldUnverifiedMsgs(bot.telegram,chat.id,gData);}}catch(e) {}return res;};}
if(bot&&bot.telegram&&!bot.telegram._rulesCleanWrapped) {bot.telegram._rulesCleanWrapped=true;const origCall=bot.telegram.callApi.bind(bot.telegram);
const wrappedCallApi=async function (method,payload,...rest) {let detectedWelcome=false;let detectedVerify=false;
try {if(method==='restrictChatMember'&&payload?.chat_id&&payload?.user_id) {const canSend=payload.permissions?.can_send_messages;
const gData=await getGD(payload.chat_id);gData.verifiedPhoneUsers=gData.verifiedPhoneUsers||{};if(canSend===true) {const vUid=String(payload.user_id);
gData.verifiedPhoneUsers[vUid]=true;if(gData.pendingPhoneUsers?.[vUid]) delete gData.pendingPhoneUsers[vUid];await saveGD(payload.chat_id,gData);
await flushHeldUnverifiedMsgs(bot.telegram,payload.chat_id,gData).catch(noop);}else if(canSend===false&&gData.verifiedPhoneUsers[String(payload.user_id)]) {return {ok:true};}}
if(method==='pinChatMessage'&&payload?.chat_id&&payload?.message_id) {const gData=await getGD(payload.chat_id);
gData.pinnedMsgIds=Array.isArray(gData.pinnedMsgIds)?gData.pinnedMsgIds :[];if(!gData.pinnedMsgIds.includes(payload.message_id)) {gData.pinnedMsgIds.push(payload.message_id);
await saveGD(payload.chat_id,gData);}}if(method==='unpinChatMessage'&&payload?.chat_id&&payload?.message_id) {const gData=await getGD(payload.chat_id);
if(Array.isArray(gData.pinnedMsgIds)) {gData.pinnedMsgIds=gData.pinnedMsgIds.filter((id)=>id!==payload.message_id);await saveGD(payload.chat_id,gData);}}
if(method==='unpinAllChatMessages'&&payload?.chat_id) {const gData=await getGD(payload.chat_id);const curPins=Array.isArray(gData.pinnedMsgIds)?[...gData.pinnedMsgIds] :[];
try {const chatInfo=await origCall('getChat',{chat_id:payload.chat_id});if(chatInfo?.pinned_message?.message_id&&!curPins.includes(chatInfo.pinned_message.message_id)) curPins.push(chatInfo.pinned_message.message_id);
}catch(e) {}if(curPins.length) gData.lastUnpinnedAllIds=curPins;gData.pinnedMsgIds=[];await saveGD(payload.chat_id,gData);}
if(method==='banChatMember'&&payload?.chat_id&&payload?.user_id) {const gData=await getGD(payload.chat_id);const bUid=String(payload.user_id);
if(gData.pendingPhoneUsers?.[bUid]) {delete gData.pendingPhoneUsers[bUid];await saveGD(payload.chat_id,gData);
await flushHeldUnverifiedMsgs(bot.telegram,payload.chat_id,gData).catch(noop);}}
if(method==='sendMessage'&&payload?.chat_id&&payload?.reply_markup) {const kbJson=JSON.stringify(payload.reply_markup);
const mPhoneVer=kbJson.match(/fcnt_verifyme_(\d+)/);const mKeyVer=kbJson.match(/ver_ok_(\d+)_/);
const targetVerUid=mPhoneVer?mPhoneVer[1] :(mKeyVer?mKeyVer[1] :null);if(targetVerUid) {const gData=await getGD(payload.chat_id);
if(gData.verifiedPhoneUsers&&gData.verifiedPhoneUsers[targetVerUid]) {return {message_id:1};}const nameMatch=String(payload.text||'').match(/שלום\s+\*([^*]+)\*/);
const memberName=nameMatch?nameMatch[1] :'חבר';const secMatch=String(payload.text||'').match(/תוך \d+שניות/);
if(gData.blockFutureUntilVerify) {gData.pendingPhoneUsers=gData.pendingPhoneUsers||{};gData.pendingPhoneUsers[targetVerUid]={name:memberName,joinedAt:Date.now()};
await saveGD(payload.chat_id,gData);}const ex=buildShortMathExercise(targetVerUid,memberName,secMatch?` (${secMatch[0]})` :'',Boolean(gData.blockFutureUntilVerify));
payload.text=ex.text;payload.parse_mode='Markdown';
payload.reply_markup=ex.reply_markup;}}if(method==='answerCbQuery'&&typeof payload?.text==='string'&&payload.text.includes('סמל המפתח')) {payload.text='❌ תשובה שגויה לתרגיל! נסה שוב לבחור את התשובה הנכונה.';
}
if(method==='sendMessage'&&payload&&!payload.reply_markup&&typeof payload.text==='string') {if((payload.text.includes('תיקון הודעת גרסה חדש')||payload.text.includes('עדכון ענק'))&&payload.text.includes(LATEST_VERSION)) {if(!bot._allowManualVerBroadcast) {return {message_id:1};
}}}
if((method==='sendMessage'||method==='editMessageText')&&payload&&typeof payload.text==='string') {if(payload.text.startsWith('🆕 *מה חדש בעדכון')) {const st=await getInfoSt();
payload.text=getEffectiveUpdateText(st,LATEST_VERSION);}
if(payload.text.includes('חוקי הקבוצה')&&/\/setrules(@\S+)?/i.test(payload.text)) {payload.text=payload.text.replace(/\/setrules(@\S+)?\s*/gi,'');}
if(method==='sendMessage'&&String(payload.chat_id)===String(CREATOR_ID)&&payload.text.startsWith('📩 הצעה חדשה לשיפור / פקודה:')) {const parsed=parseSuggestionCardText(payload.text);
if(parsed.cmd) {const {s,items}=await loadDevBoard();items.push({id:Date.now().toString(36),uid:parsed.uid,cmd:parsed.cmd,text:parsed.combined,type:parsed.type});
await saveInfoSt(s);}}
if(method==='sendMessage'&&payload.text==='🧹 כל ההודעות הנעוצות בקבוצה הוסרו בהצלחה.') {payload.reply_markup=rmKb([[cbBtn('שחזור כל הנעוצים','restore_all_pins')]]);}
if(payload.text.startsWith('📍 הסרת נעיצה')) {payload.text='📍 הסרת נעיצה\n\n⌨️ *מה לכתוב:*\n`/unpin (בהשבה)`\n\n🤖 *מה הבוט ישיב:*\nמסיר נעיצה מההודעה הנעוצה שעליה השבת (אם לא משיבים להודעה הבוט ישיב: "אנא השב להודעה הנעוצה").';
}
if(typeof payload.text==='string'&&payload.text.startsWith('🛒 חנות נקודות')&&Array.isArray(payload.reply_markup?.inline_keyboard)) {for(const r of payload.reply_markup.inline_keyboard) {for(const b of r) {if(b.callback_data==='fnd_m_main') b.text='🔙 חזרה לפאנל צוות המייסדים';
}}}
if(method==='sendMessage'&&(payload.text.startsWith('⚠️ אזהרה ל-')||(payload.text.startsWith('🚨 ')&&payload.text.includes('אזהרות')))) {const warnedUid=bot._lastWarnTargetId||'0';
if(!payload.reply_markup) {payload.reply_markup={inline_keyboard:[[{text:'ערעור',callback_data:`warn_appeal_${warnedUid}`}]]};}}
if(method==='sendMessage'&&payload.text.startsWith('👑 *תשובה מיוצר וולטיק מוד לשאלתך:*\n\n')) {const adminMsg=payload.text.replace('👑 *תשובה מיוצר וולטיק מוד לשאלתך:*\n\n','').trim();
payload.text=`ההודעה מהמנהל: ${adminMsg}\n\nהגב להודעה זו כדי להגיב`;delete payload.parse_mode;}
if(payload.text.includes('חסימת קידומות ומדינות זרות')&&payload.reply_markup?.inline_keyboard) {payload.text=payload.text.replace('אימות קידומת טלפון בכניסה:','אימות מצטרפים בתרגיל קצר בכניסה:')
.replace('לחייב מצטרפים חדשים לאמת קידומת טלפון בלחיצת כפתור','לחייב מצטרפים חדשים לפתור תרגיל חשבון קצר נגד בוטים (ללא חשיפת טלפון)');
for(const r of payload.reply_markup.inline_keyboard) {for(const b of r) {if(b.callback_data==='fcnt_toggle_pver') {b.text=b.text.replace('אימות קידומת טלפון בכניסה','אימות בתרגיל קצר בכניסה');
}}}}
if(method==='editMessageText'&&(payload.text.startsWith('אושר\n\n📩 הצעה חדשה לשיפור')||payload.text.startsWith('נדחה\n\n📩 הצעה חדשה לשיפור'))) {const parsed=parseSuggestionCardText(payload.text);
bot._lastReviewedSuggestion={uid:parsed.uid,cmd:parsed.cmd||'הצעה לפקודה',desc:parsed.desc||'',approved:payload.text.startsWith('אושר')};
const {s,items}=await loadDevBoard();const beforeLen=items.length;s.devBoard.items=items.filter((x)=>{if(parsed.cmd&&(x.cmd===parsed.cmd||x.text===parsed.combined||x.text.startsWith(parsed.cmd))) return false;
if(parsed.uid&&x.uid===parsed.uid) return false;return true;});if(s.devBoard.items.length===beforeLen&&s.devBoard.items.length > 0) s.devBoard.items.pop();
await saveInfoSt(s);}
if(method==='sendMessage'&&(payload.text==='הפקודה אושרה ועובדת!'||payload.text==='הפקודה נדחתה עקב החלטת היוצר')) {const rev=bot._lastReviewedSuggestion;
const isApproved=payload.text==='הפקודה אושרה ועובדת!';
const cmdTitle=rev?.cmd||'ההצעה ששלחת';const cmdDesc=rev?.desc?`\n💬 תיאור ההצעה: ${rev.desc}` :'';if(isApproved) {payload.text=`✅ ההצעה שלך אושרה ע"י יוצר הבוט ופעילה כעת! 🎉\n\n⌨️ הפקודה / הרעיון שאושר: ${cmdTitle}${cmdDesc}`;
}else {payload.text=`❌ עדכון לגבי ההצעה ששלחת לבוט:\n\n⌨️ הפקודה / הרעיון שנדחה: ${cmdTitle}${cmdDesc}\n\n📌 סטטוס: נדחה עקב החלטת יוצר הבוט.`;
}bot._lastReviewedSuggestion=null;}
const kb=payload.reply_markup?.inline_keyboard;if(Array.isArray(kb)) {for(const row of kb) {for(const btn of row) {if(btn&&typeof btn.text==='string') {btn.text=btn.text.replace(/\s*\(\s*`?\/[a-zA-Z0-9_]+`?\s*\)/g,'').replace(/לפאנל\s+\/owner/gi,'לפאנל היוצר').replace(/\/[a-zA-Z0-9_]+/g,'').replace(/\s{2,}/g,' ').trim();
}}}
if(typeof payload.text==='string'&&payload.text.startsWith('👑 *פאנל צוות המייסדים')) {const flat=kb.flat().filter((b)=>b&&b.callback_data!=='fnd_m_shop'&&b.callback_data!=='fnd_fshop_menu');
const rebuilt=[[cbBtn('🛒 חנות נקודות','fnd_m_shop'),cbBtn('🛍️ חנות הפיצ׳רים','fnd_fshop_menu')]];for(let i=0;
i < flat.length;i+=2) {rebuilt.push(flat[i+1]?[flat[i],flat[i+1]] :[flat[i]]);}
payload.reply_markup.inline_keyboard=rebuilt;}if(typeof payload.text==='string'&&payload.text.startsWith('🛒 חנות נקודות')) {if(!kb.some((r)=>r.some((b)=>b.callback_data==='pshop_open'))) {kb.unshift([cbBtn('🛒 פתח עכשיו את חנות נקודות','pshop_open')]);
}}const curUserVer=bot._activeCtxUserVer||PREV_VER;const isUpgraded=curUserVer===LATEST_VERSION;if(payload.text.includes('תפריט הפקודות הראשי')) {payload.text=payload.text.replace(`🔖 *גרסה נוכחית:* עדכון ${LATEST_VERSION}`,`🔖 *גרסה נוכחית:* עדכון מספר ${curUserVer}`+(!isUpgraded?`\n🔔 *גרסה חדשה (${LATEST_VERSION}) זמינה! לחץ על "♻️עדכון גרסת הבוט♻️" למטה כדי לעדכן ולפתוח את הפקודות החדשות.*` :''));
if(!payload.text.includes('צוות המייסדים')) {payload.text=payload.text.replace('📚 *תפריט הפקודות הראשי',`👑 *קבוצת התמיכה של הבוט:* [צוות המייסדים](https://t.me/+v4Hrdnpg0rI3MTk0)\n\n📚 *תפריט הפקודות הראשי`);
}if(!isUpgraded) {payload.reply_markup.inline_keyboard=kb.map((row)=>row.filter((btn)=>!NEW_CBS.has(btn.callback_data)))
.filter((row)=>row.length > 0);}else {const hasDevBtn=kb.some((r)=>r.some((b)=>b.callback_data==='devboard_open'));
if(!hasDevBtn) {kb.splice(kb.length-1,0,[cbBtn('📘 מדריך ותיעוד הבוט','docs_main'),cbBtn('🛠️ מה בפיתוח ובתיקונים','devboard_open')]);}}
const curKb=payload.reply_markup.inline_keyboard;for(const row of curKb) {for(const btn of row) {if(btn.callback_data==='help_changelog'||btn.callback_data==='ver_current_info') {btn.text=`🆕 עדכון מספר ${curUserVer}`;
btn.callback_data='ver_current_info';}}}
if(!curKb.some((r)=>r.some((b)=>b.url&&b.url.includes('v4Hrdnpg0rI3MTk0')))) {curKb.unshift([urlBtn('👑 קבוצת התמיכה של הבוט – צוות המייסדים','https://t.me/+v4Hrdnpg0rI3MTk0')]);} if(payload.chat_id&&!String(payload.chat_id).startsWith('-')&&!curKb.some((r)=>r.some((b)=>b.web_app))) {curKb.unshift([{text:'📱 מיני-אפליקציה לניהול קבוצות',web_app:{url:'${WEBAPP_URL}'}}]);}
if(!isUpgraded&&!curKb.some((r)=>r.some((b)=>b.callback_data==='ver_upgrade_user'))) {curKb.push([cbBtn('♻️עדכון גרסת הבוט♻️','ver_upgrade_user')]);}}
if(payload.text.includes('*קטגוריה ')) {if(!isUpgraded) {payload.text=payload.text.replace(`(עדכון ${LATEST_VERSION})`,`(עדכון מספר ${curUserVer})`);
payload.reply_markup.inline_keyboard=kb.map((row)=>row.filter((btn)=>!NEW_CBS.has(btn.callback_data))).filter((row)=>row.length > 0);
payload.reply_markup.inline_keyboard.unshift([cbBtn('♻️עדכון גרסת הבוט♻️ (פתיחת פקודות חדשות)','ver_upgrade_user')]);
}else {if(payload.text.startsWith('🛡️ *קטגוריה 3')&&!kb.some((r)=>r.some((b)=>b.callback_data==='vhcmd_info_cleanwelcome'))) {kb.splice(Math.max(0,kb.length-1),0,[cbBtn('🧹 מחיקת ברוך הבא / אימות קודמים','vhcmd_info_cleanwelcome'),cbBtn('🔒 חסימת תוכן עתידי עד פתרון החידה','vhcmd_info_blockfuture')]);
}if(payload.text.startsWith('⚙️ *קטגוריה 5')&&!kb.some((r)=>r.some((b)=>b.callback_data==='vhcmd_info_devboard'))) {kb.splice(Math.max(0,kb.length-1),0,[
cbBtn('📘 מדריך ותיעוד הבוט','vhcmd_info_docs'),cbBtn('🛠️ מה בפיתוח ובתיקונים','vhcmd_info_devboard')]);}}}if(payload.text.startsWith('👑 פאנל שליטה ראשי – יוצר הבוט')) {const stShop=await getInfoSt();
if(!kb.some((r)=>r.some((b)=>b.callback_data==='vown_toggle_shop'))) {kb.unshift([cbBtn(stShop.shopClosed?'🔓 פתח את חנות הנקודות והפיצ׳רים (סגורות 🔴)' :'🔒 סגור את חנות הנקודות והפיצ׳רים (פתוחות 🟢)','vown_toggle_shop')]);
}
const hasApprovePhoneBtn=kb.some((r)=>r.some((b)=>b.callback_data==='vown_approve_phone_all'));if(!hasApprovePhoneBtn) {kb.unshift([cbBtn('✅ אשר את כל המצטרפים שהתבקשו לשתף טלפון','vown_approve_phone_all')]);
}
const hasDevBtn=kb.some((r)=>r.some((b)=>b.callback_data==='devboard_open'));if(!hasDevBtn) {kb.unshift([cbBtn('🛠️ לוח פקודות בפיתוח ובתיקונים','devboard_open')]);}
const hasHistBtn=kb.some((r)=>r.some((b)=>b.callback_data==='ver_history_open'));if(!hasHistBtn) {kb.unshift([cbBtn('📜 היסטוריית עדכוני הבוט','ver_history_open'),cbBtn('✏️ עריכת הודעת העדכון הנוכחי','vown_edit_update')]);
}
const hasBcastGroups=kb.some((r)=>r.some((b)=>b.callback_data==='bcast_groups_only'));if(!hasBcastGroups) {const bcastIdx=kb.findIndex((r)=>r.some((b)=>b.callback_data==='own_bcast_users'));
const newBtnRow=[cbBtn('🏢 שליחת הודעה לכל הקבוצות (ללא שליחה למשתמשים)','bcast_groups_only')];if(bcastIdx >=0) kb.splice(bcastIdx+1,0,newBtnRow);else kb.push(newBtnRow);}
payload.reply_markup.inline_keyboard=kb.filter((r)=>!r.some((b)=>b.callback_data==='own_announce_ver'));}
if(payload.text.startsWith('🔐 *אימות אנושי למצטרפים')||payload.text.startsWith('⚙️ *פאנל הגדרות קבוצה')) {const gData=payload.chat_id?await getGD(payload.chat_id) :{};
const bfOn=Boolean(gData.blockFutureUntilVerify);if(payload.text.startsWith('🔐 *אימות אנושי למצטרפים')&&!payload.text.includes('חסימת תוכן עתידי')) {payload.text=payload.text.replace('\n\nבחר אפשרות',`\n• חסימת תוכן עתידי עד פתרון החידה: *${bfOn ? 'פעיל ✅' : 'כבוי ❌'}*\n\nבחר אפשרות`);
}if(!kb.some((r)=>r.some((b)=>b.callback_data==='ver_toggle_hidefuture'))) {kb.push([cbBtn(`${bfOn ? '🔒' : '🔓'} חסימת תוכן עתידי עד פתרון החידה: ${bfOn ? 'פעיל ✅' : 'כבוי ❌'}`,'ver_toggle_hidefuture')]);
}
const hasClnJoin=kb.some((r)=>r.some((b)=>b.callback_data==='clnjoin_open'));if(!hasClnJoin) {kb.push([cbBtn('🧹 מחיקת ברוך הבא / אימות קודמים בכניסה','clnjoin_open')]);} if(payload.text.startsWith('⚙️ *פאנל הגדרות קבוצה')&&payload.chat_id&&!kb.some((r)=>r.some((b)=>b.url&&b.url.includes('start=webapp_')))) {const bUser=bot.botInfo?.username||'VolticMod_bot';kb.unshift([urlBtn('📱 פתח מיני-אפליקציה לניהול הקבוצה',`https://t.me/${bUser}?start=webapp_${payload.chat_id}`)]);}}}
if(payload.chat_id&&String(payload.chat_id).startsWith('-')) {detectedVerify=method==='sendMessage'&&isVerifyMessagePayload(payload);
detectedWelcome=isWelcomeMessagePayload(payload);
if(detectedVerify||detectedWelcome) {const gData=await getGD(payload.chat_id);const mode=gData.cleanPrevJoinMode||'off';
if(detectedWelcome&&(mode==='welcome'||mode==='both')&&gData.lastWelcomeMsgId&&gData.lastWelcomeMsgId!==payload.message_id) {await origCall('deleteMessage',{chat_id:payload.chat_id,message_id:gData.lastWelcomeMsgId}).catch(noop);
gData.lastWelcomeMsgId=null;await saveGD(payload.chat_id,gData);}
if(detectedVerify&&(mode==='verify'||mode==='both')&&gData.lastVerifyMsgId) {await origCall('deleteMessage',{chat_id:payload.chat_id,message_id:gData.lastVerifyMsgId}).catch(noop);
gData.lastVerifyMsgId=null;await saveGD(payload.chat_id,gData);}}}}}catch(e) {}
const res=await origCall(method,payload,...rest);try {if(res?.message_id&&payload?.chat_id&&String(payload.chat_id).startsWith('-')) {if(detectedVerify||detectedWelcome) {const gData=await getGD(payload.chat_id);
if(detectedVerify) gData.lastVerifyMsgId=res.message_id;if(detectedWelcome) {gData.lastWelcomeMsgId=res.message_id;
if(gData.lastVerifyMsgId===res.message_id) gData.lastVerifyMsgId=null;}await saveGD(payload.chat_id,gData);}}}catch(e) {}
return res;};bot.telegram.callApi=wrappedCallApi;const tgProto=Object.getPrototypeOf(bot.telegram);if(tgProto&&!tgProto._volticProtoWrapped) {tgProto._volticProtoWrapped=true;
tgProto.callApi=wrappedCallApi;}}
bot.action('ver_current_info',async (ctx)=>{await ack(ctx);const st=await getInfoSt();const curLat=getLatestVer(st);let curVer=curLat;if(ctx.chat&&['group','supergroup'].includes(ctx.chat.type)) {const gData=await getGD(ctx.chat.id);
curVer=isFoundersChatId(ctx.chat.id)?curLat :(gData.groupVersion||PREV_VER);}else if(ctx.from) {curVer=isCreator(ctx)?curLat:(await getUserActiveVersion(ctx.from.id));}
const verText=getEffectiveUpdateText(st,curVer);const rows=[];if(curVer!==curLat) {rows.push([cbBtn('♻️עדכון גרסת הבוט♻️',ctx.chat?.type==='private'?'ver_upgrade_user' :'grp_upgrade_ver')]);
}if(isCreator(ctx)&&curVer===curLat) {rows.push([cbBtn('✏️ עריכת הודעת העדכון הנוכחי','vown_edit_update')]);}
rows.push([cbBtn('🔙 חזרה לתפריט הראשי','help_main')]);await ctx.editMessageText(verText,mdKb(rows)).catch(()=>ctx.reply(verText,mdKb(rows)));
});bot.action('ver_upgrade_user',async (ctx)=>{if(!ctx.from) return;await setUserActiveVersion(ctx.from.id,LATEST_VERSION);
bot._activeCtxUserVer=LATEST_VERSION;await ack(ctx,`🎉 הבוט עודכן בהצלחה לגרסה ${LATEST_VERSION}!`,1);const st=await getInfoSt();
const verText=getEffectiveUpdateText(st,LATEST_VERSION);const msg=`🎉 *הבוט עודכן בהצלחה לגרסה החדשה (${LATEST_VERSION})!*\nכל הפקודות והמערכות החדשות נפתחו עבורך בתפריט הבוט.\n\n${verText}`;
const kb={inline_keyboard:[
[cbBtn('📚 מעבר לתפריט הפקודות המעודכן','help_main')]]};await editMd(ctx,msg,kb);});bot.action('grp_upgrade_ver',async (ctx)=>{if(!ctx.chat||ctx.chat.type==='private') return;
if(!(await isGroupAdminCb(ctx))) {return ack(ctx,'⛔ רק מנהל הקבוצה יכול ללחוץ על הכפתור ולעדכן את גרסת הבוט בקבוצה!',1);}
const gData=await getGD(ctx.chat.id);gData.groupVersion=LATEST_VERSION;await saveGD(ctx.chat.id,gData);if(ctx.from) {await setUserActiveVersion(ctx.from.id,LATEST_VERSION);
bot._activeCtxUserVer=LATEST_VERSION;}await ack(ctx,`🎉 הקבוצה עודכנה בהצלחה לגרסה ${LATEST_VERSION}!`,1);await ctx.editMessageText(
`✅ *גרסת הבוט בקבוצה עודכנה בהצלחה ל-${LATEST_VERSION} ע"י המנהל ${ctx.from.first_name}!*\nכל הפקודות והמערכות של העדכון החדש פעילות כעת בקבוצה.`,{parse_mode:PM,reply_markup:{inline_keyboard:[[{text:`🆕 עדכון מספר ${LATEST_VERSION} (מה חדש?)`,callback_data:'ver_current_info'}],
[cbBtn('📚 פתיחת תפריט הבוט','help_main')]]}}).catch(noop);});bot.action('ver_history_open',async (ctx)=>{if(!isCreator(ctx)) return ack(ctx,'⛔ ליוצר הבוט בלבד!',1);
await ack(ctx);const s=await getInfoSt();const uVers=Object.values(s.userVersions||{});
const curLat=getLatestVer(s);const allVers=getAllVersionsMap(s);const upgradedUsers=uVers.filter((v)=>v===curLat).length+1;const verKeys=Object.keys(allVers).reverse();
const summaryLines=verKeys.map((v,idx)=>`${idx + 1}. 🔖 *${allVers[v].title}* (${allVers[v].date})`).join('\n');
const text=`📜 *היסטוריית עדכוני הבוט – וולטיק מוד (ליוצר בלבד)*\n📌 *גרסה אחרונה במערכת:* \`${curLat}\`\n👥 *משתמשים שעדכנו לגרסה האחרונה:* ${upgradedUsers}\n\n📚 *רשימת כל עדכוני הבוט:*\n${summaryLines}\n\n👇 *לחץ על כל גרסה למטה כדי לצפות בפירוט המלא של אותו עדכון:*`;
const rows=[];for(let i=0;i < verKeys.length;i+=2) {const v1=verKeys[i];const r=[{text:`📜 עדכון מספר ${v1}`,callback_data:`ver_hist_item_${v1}`}];
if(verKeys[i+1]) {const v2=verKeys[i+1];r.push({text:`📜 עדכון מספר ${v2}`,callback_data:`ver_hist_item_${v2}`});}rows.push(r);}
rows.push([cbBtn('✏️ עריכת הודעת העדכון הנוכחי','vown_edit_update')]);rows.push([cbBtn('👑 חזרה לפאנל היוצר','own_panel')]);await ctx.editMessageText(text,mdKb(rows))
.catch(()=>ctx.reply(text,mdKb(rows)));});bot.action(/^ver_hist_item_(.+)$/,async (ctx)=>{if(!isCreator(ctx)) return ack(ctx,'⛔ ליוצר הבוט בלבד!',1);
const ver=ctx.match[1];const st=await getInfoSt();const allVers=getAllVersionsMap(st);const item=allVers[ver];if(!item) return ack(ctx,'גרסה לא נמצאה');await ack(ctx);
const verText=getEffectiveUpdateText(st,ver);const rows=[];if(ver===getLatestVer(st)) rows.push([cbBtn('✏️ עריכת הודעת העדכון הנוכחי','vown_edit_update')]);
rows.push([cbBtn('🔙 חזרה להיסטוריית העדכונים','ver_history_open')],
[cbBtn('👑 חזרה לפאנל היוצר','own_panel')]);await editMd(ctx,verText,{inline_keyboard:rows});});bot.use(async (ctx,next)=>{if(isCreator(ctx)&&ctx.chat?.type==='private'&&ctx.message?.text) {const uid=String(ctx.from.id);
const waitMode=creatorWaitState[uid];const txt=ctx.message.text.trim();if(waitMode&&txt.startsWith('/')) {delete creatorWaitState[uid];
}else if(waitMode==='bcast_groups_only'&&txt) {delete creatorWaitState[uid];const s=await getGD('owner_global');
const gIds=Object.keys(s.groups||{});let gc=0;for(const gid of gIds) {try {await safeSendGroupRich(ctx.telegram,gid,txt);gc++;}catch(e) {}}
return await ctx.reply(`🏢 ההודעה נשלחה בהצלחה ל-*${gc} קבוצות בלבד* (ללא שליחה למשתמשים בפרטי)!`,{parse_mode:PM,reply_markup:rmKb([[cbBtn('👑 חזרה לפאנל היוצר','own_panel')]])});
}else if((waitMode==='devb_add_dev'||waitMode==='devb_add_fix')&&txt) {delete creatorWaitState[uid];const itemType=waitMode==='devb_add_fix'?'fix' :'dev';
const {s,items}=await loadDevBoard();items.push({id:Date.now().toString(36),uid,cmd:txt.split(/\s+/)[0],
text:txt.slice(0,120),type:itemType});await saveInfoSt(s);const view=buildDevBoardView(items,true);return await ctx.reply(`✅ נוסף בהצלחה ל${itemType==='fix' ? 'רשימת התיקונים 🔧' : 'רשימת הפיתוח 🚀'}!
${view.text}`,{parse_mode:PM,reply_markup:view.reply_markup});}}
return next();});bot.action('bcast_groups_only',async (ctx)=>{if(!isCreator(ctx)) return ack(ctx,'⛔ ליוצר הבוט בלבד!',1);creatorWaitState[String(ctx.from.id)]='bcast_groups_only';
await ack(ctx);const txt='🏢 *שליחת הודעה לכל הקבוצות (ללא שליחה למשתמשים)*\n\nכתוב עכשיו את ההודעה שתרצה לשלוח לכל הקבוצות שבהן הבוט נמצא (תומך בעיצוב וכפתורים):';
const kb={inline_keyboard:[[cbBtn('❌ ביטול וחזרה לפאנל היוצר','bcast_groups_cancel')]]};
await editMd(ctx,txt,kb);});bot.action('bcast_groups_cancel',async (ctx)=>{if(!isCreator(ctx)) return;delete creatorWaitState[String(ctx.from.id)];
await ack(ctx,'בוטל');await ctx.editMessageText('❌ השליחה לקבוצות בוטלה.',{reply_markup:rmKb([[cbBtn('👑 חזרה לפאנל היוצר','own_panel')]])}).catch(noop);
});bot.command(['broadcast_groups','owner_sendgroups'],async (ctx)=>{if(!isCreator(ctx)) return;const msg=(ctx.message.text||'').replace(/^\/(broadcast_groups|owner_sendgroups)(@\S+)?\s*/i,'').trim();
if(!msg) {return repMd(ctx,'שימוש: `/broadcast_groups [הודעה לכל הקבוצות בלבד ללא משתמשים]`');}
const s=await getGD('owner_global');let gc=0;for(const gid of Object.keys(s.groups||{})) {try {await safeSendGroupRich(ctx.telegram,gid,msg);gc++;}catch(e) {}}
await ctx.reply(`🏢 שודר בהצלחה ל-${gc} קבוצות בלבד (ללא שליחה למשתמשים).`);});bot.command(['clean_welcome','welcome_clean','clean_join'],
async (ctx)=>{if(!(await requireAdmin(ctx,'/clean_welcome'))) return;const data=await getGD(ctx.chat.id);const view=buildCleanJoinPanel(data.cleanPrevJoinMode||'off');
await ctx.reply(view.text,{parse_mode:PM,reply_markup:view.reply_markup});});bot.action('clnjoin_open',async (ctx)=>{if(!(await isGroupAdminCb(ctx))) {return ack(ctx,'⛔ למנהלי הקבוצה בלבד!',1);
}await ack(ctx);const data=await getGD(ctx.chat.id);const view=buildCleanJoinPanel(data.cleanPrevJoinMode||'off');
await editMd(ctx,view.text,view.reply_markup);});bot.action(/^clnjoin_set_(welcome|verify|both|off)$/,async (ctx)=>{if(!(await isGroupAdminCb(ctx))) {return ack(ctx,'⛔ למנהלי הקבוצה בלבד!',1);
}const mode=ctx.match[1];const data=await getGD(ctx.chat.id);data.cleanPrevJoinMode=mode;await saveGD(ctx.chat.id,data);
await ack(ctx,'✅ ההגדרה נשמרה!');const view=buildCleanJoinPanel(mode);
await editMd(ctx,view.text,view.reply_markup);});bot.command(['owner_versions','version_history'],async (ctx)=>{if(!isCreator(ctx)) return;
const s=await getInfoSt();const curLat=getLatestVer(s);const allVers=getAllVersionsMap(s);const upgradedUsers=Object.values(s.userVersions||{}).filter((v)=>v===curLat).length+1;
const verKeys=Object.keys(allVers).reverse();const summaryLines=verKeys.map((v,idx)=>`${idx + 1}. 🔖 *${allVers[v].title}* (${allVers[v].date})`).join('\n');
const rows=[];for(let i=0;i < verKeys.length;i+=2) {const r=[{text:`📜 עדכון מספר ${verKeys[i]}`,callback_data:`ver_hist_item_${verKeys[i]}`}];
if(verKeys[i+1]) r.push({text:`📜 עדכון מספר ${verKeys[i + 1]}`,callback_data:`ver_hist_item_${verKeys[i + 1]}`});rows.push(r);}
rows.push([cbBtn('👑 חזרה לפאנל היוצר','own_panel')]);await ctx.reply(`📜 *היסטוריית עדכוני הבוט – וולטיק מוד (ליוצר בלבד)*\n📌 *גרסה אחרונה:* \`${LATEST_VERSION}\` | 👥 *עדכנו:* ${upgradedUsers}\n\n${summaryLines}`,mdKb(rows));
});bot.command(['edit_update','set_update'],async (ctx)=>{if(!isCreator(ctx)) return ctx.reply('⛔ פקודה זו מיועדת ליוצר הבוט בלבד.');
const raw=(ctx.message?.text||'').replace(/^\/(edit_update|set_update)(@\S+)?\s*/i,'').trim();
const st=await getInfoSt();st.customUpdateText=st.customUpdateText||{};if(!raw) {creatorWaitState[String(ctx.from.id)]='edit_update_replace';const pView=buildEditUpdatePanel(st);
return await ctx.reply(pView.text,{parse_mode:PM,reply_markup:pView.reply_markup});}
const isNewUpd=/^עדכון חדש\s*:/i.test(raw);let targetVer=getLatestVer(st);
if(/^(reset|default|איפוס)$/i.test(raw)) {delete st.customUpdateText[targetVer];await saveInfoSt(st);const pView=buildEditUpdatePanel(st);
return await ctx.reply(`🔄 הודעת העדכון (${targetVer}) אופסה לברירת המחדל!\n\n${pView.text}`,{parse_mode:PM,reply_markup:pView.reply_markup});}
if(isNewUpd) {targetVer=bumpVersionNumber(targetVer);st.dynamicLatestVersion=targetVer;st.customVersions=st.customVersions||{};}
const cleanBody=raw.replace(/^עדכון חדש\s*:\s*/i,'').trim();const formatted=cleanBody.startsWith('🔥')||cleanBody.startsWith('📦')?cleanBody :`🔥 *עדכון מספר ${targetVer} – מה חדש בעדכון זה:*\n\n${cleanBody}`;
st.customUpdateText[targetVer]=formatted;if(isNewUpd){st.customVersions[targetVer]={title:`עדכון מספר ${targetVer}`,date:new Date().toISOString().slice(0,10),text:formatted};}
await saveInfoSt(st);const pView=buildEditUpdatePanel(st);await ctx.reply(`✅ *הודעת העדכון (${targetVer}) עודכנה בהצלחה!*${isNewUpd?`\n🚀 מספר העדכון עלה אוטומטית לגרסה *${targetVer}*.`:''}\n\n${pView.text}`,{parse_mode:PM,reply_markup:pView.reply_markup});
});bot.action('vown_edit_update',async (ctx)=>{if(!isCreator(ctx)) return ack(ctx,'⛔ ליוצר הבוט בלבד!',1);creatorWaitState[String(ctx.from.id)]='edit_update_replace';
await ack(ctx,'✍️ שלח עכשיו בצ׳אט את הטקסט החדש להודעת העדכון');
const st=await getInfoSt();const pView=buildEditUpdatePanel(st);await editMd(ctx,pView.text,pView.reply_markup);
});bot.action('vown_append_update',async (ctx)=>{if(!isCreator(ctx)) return ack(ctx,'⛔ ליוצר הבוט בלבד!',1);
creatorWaitState[String(ctx.from.id)]='edit_update_append';await ack(ctx);await editMd(ctx,`➕ *הוספת סעיף להודעת העדכון הנוכחית (${LATEST_VERSION})*\n\nכתוב עכשיו בצ׳אט את הסעיף שתרצה להוסיף לתחתית הודעת העדכון הקיימת:\n_(אם תכתוב בראש ההודעה "עדכון חדש:" זה יחליף את כל הודעת העדכון לטקסט חדש)_`,rmKb([[cbBtn('🔙 חזרה לעריכת העדכון','vown_edit_update')],
[cbBtn('👑 חזרה לפאנל היוצר','own_panel')]]));});bot.action('vown_reset_update',async (ctx)=>{if(!isCreator(ctx)) return ack(ctx,'⛔ ליוצר הבוט בלבד!',1);
delete creatorWaitState[String(ctx.from.id)];const st=await getInfoSt();const curLat=getLatestVer(st);if(st.customUpdateText) delete st.customUpdateText[curLat];await saveInfoSt(st);
await ack(ctx,'🔄 הודעת העדכון אופסה לברירת המחדל!',1);const pView=buildEditUpdatePanel(st);
await editMd(ctx,pView.text,pView.reply_markup);});bot.command(['block_future','hide_future'],async (ctx)=>{if(!(await requireAdmin(ctx,'/block_future [on | off]'))) return;
const arg=((ctx.message.text||'').trim().split(/\s+/)[1]||'').toLowerCase();
const data=await getGD(ctx.chat.id);if(arg==='on'||arg==='off') {data.blockFutureUntilVerify=arg==='on';if(data.blockFutureUntilVerify) {data.adv=data.adv||{};
data.adv.verifyEnabled=true;}else {await flushHeldUnverifiedMsgs(ctx.telegram,ctx.chat.id,data);}await saveGD(ctx.chat.id,data);}
const bfOn=Boolean(data.blockFutureUntilVerify);await repMd(ctx,`🔒 *חסימת תוכן עתידי בקבוצה למצטרפים שטרם פתרו את החידה*\n📌 *מצב נוכחי בקבוצה:* *${bfOn ? 'פעיל ✅' : 'כבוי ❌'}*\n\n• כאשר ההגדרה פעילה, משתמש שנכנס לקבוצה ועדיין לא פתר את החידה לא יוכל לראות הודעות חדשות שנכתבות בקבוצה.\n• ברגע שהמשתמש פותר את החידה – כל ההודעות שנכתבו מוצגות מיד כרגיל והקבוצה חוזרת למצב ברירת מחדל!`,[[cbBtn(bfOn?'🔓 כבה חסימת תוכן עתידי (כרגע: פעיל ✅)' :'🔒 הפעל חסימת תוכן עתידי (כרגע: כבוי ❌)','ver_toggle_hidefuture')]]);
});bot.action('ver_toggle_hidefuture',async (ctx)=>{if(!(await isGroupAdminCb(ctx))) return ack(ctx,'⛔ למנהלי הקבוצה בלבד!',1);
const data=await getGD(ctx.chat.id);data.blockFutureUntilVerify=!data.blockFutureUntilVerify;
if(data.blockFutureUntilVerify) {data.adv=data.adv||{};data.adv.verifyEnabled=true;await saveGD(ctx.chat.id,data);
}else {await saveGD(ctx.chat.id,data);await flushHeldUnverifiedMsgs(ctx.telegram,ctx.chat.id,data);}
const bfOn=Boolean(data.blockFutureUntilVerify);await ack(ctx,bfOn?'🔒 חסימת תוכן עתידי עד פתרון החידה הופעלה!' :'🔓 חסימת תוכן עתידי כובתה (מצב ברירת מחדל)!',1);
const msgTxt=ctx.callbackQuery?.message?.text||'';if(msgTxt.includes('חסימת תוכן עתידי בקבוצה למצטרפים')) {return await editMd(ctx,`🔒 *חסימת תוכן עתידי בקבוצה למצטרפים שטרם פתרו את החידה*\n📌 *מצב נוכחי בקבוצה:* *${bfOn ? 'פעיל ✅' : 'כבוי ❌'}*\n\n• כאשר ההגדרה פעילה, משתמש שנכנס לקבוצה ועדיין לא פתר את החידה לא יוכל לראות הודעות חדשות שנכתבות בקבוצה.\n• ברגע שהמשתמש פותר את החידה – כל ההודעות שנכתבו מוצגות מיד כרגיל והקבוצה חוזרת למצב ברירת מחדל!`,rmKb([[cbBtn(bfOn?'🔓 כבה חסימת תוכן עתידי (כרגע: פעיל ✅)' :'🔒 הפעל חסימת תוכן עתידי (כרגע: כבוי ❌)','ver_toggle_hidefuture')]]));
}
const kb=ctx.callbackQuery?.message?.reply_markup?.inline_keyboard;if(Array.isArray(kb)) {for(const r of kb) {for(const b of r) {if(b.callback_data==='ver_toggle_hidefuture') {b.text=`${bfOn ? '🔒' : '🔓'} חסימת תוכן עתידי עד פתרון החידה: ${bfOn ? 'פעיל ✅' : 'כבוי ❌'}`;
}}}
await ctx.editMessageReplyMarkup({inline_keyboard:kb}).catch(noop);}});bot.action('restore_all_pins',async (ctx)=>{if(!(await isGroupAdminCb(ctx))) return ack(ctx,'⛔ רק מנהלי הקבוצה יכולים לשחזר נעיצות!',1);
const data=await getGD(ctx.chat.id);const ids=Array.isArray(data.lastUnpinnedAllIds)?data.lastUnpinnedAllIds :[];
if(!ids.length) return ack(ctx,'⚠️ לא נמצאו הודעות נעוצות לשחזור.',1);let restored=0;for(const mid of ids) {try {await ctx.telegram.pinChatMessage(ctx.chat.id,mid,{disable_notification:true});
restored++;}catch(e) {}}data.pinnedMsgIds=[...ids];await saveGD(ctx.chat.id,data);await ack(ctx,'📌 כל הנעוצים שוחזרו בהצלחה!',1);
await editMd(ctx,`📌 *כל ההודעות הנעוצות (${restored||ids.length}) שוחזרו וננעצו מחדש בהצלחה!*`);});bot.action('vhcmd_info_blockfuture',async (ctx)=>{await ack(ctx);
const txt='🔒 *חסימת תוכן עתידי עד פתרון החידה*\n\n⌨️ *מה לכתוב:*\n`/block_future` (או מתוך `/verify` ו-`/settings`)\n\n🤖 *מה הבוט ישיב:*\nחוסם ממשתמש שנכנס לקבוצה ועדיין לא פתר את החידה לראות הודעות חדשות שנכתבות בקבוצה. ברגע שהמשתמש פותר את החידה – הוא רואה את כל ההודעות שנכתבו והמצב חוזר לברירת מחדל!';
await editMd(ctx,txt,rmKb([[cbBtn('🔙 חזרה','help_protection')]]));});bot.action('vhcmd_info_cleanwelcome',async (ctx)=>{await ack(ctx);
const txt='🧹 *מחיקת ברוך הבא / אימות קודמים (/clean_welcome)*\n\n⌨️ *מה לכתוב:*\n`/clean_welcome`\n\n🤖 *מה הבוט ישיב:*\nפותח פאנל כפתורים למנהל הקבוצה לבחירה האם למחוק אוטומטית הודעת ברוך הבא קודמת, הודעת אימות קודמת, גם וגם, או לא למחוק בכל כניסת משתמש חדש.';
await editMd(ctx,txt,rmKb([[cbBtn('🔙 חזרה','help_protection')]]));});bot.action('vhcmd_info_devboard',async (ctx)=>{await ack(ctx);
const txt='🛠️ *לוח מה בפיתוח ובתיקונים (/dev)*\n\n⌨️ *מה לכתוב:*\n`/dev` (או `/status` / `/roadmap`)\n\n🤖 *מה הבוט ישיב:*\nמציג בזמן אמת אילו פקודות חדשות נמצאות כרגע בפיתוח (🚀) ואילו מערכות נמצאות בתיקונים ושדרוג (🔧).';
await editMd(ctx,txt,rmKb([[cbBtn('🛠️ פתח עכשיו את לוח הפיתוח','devboard_open')],[cbBtn('🔙 חזרה','help_system')]]));});bot.action('vhcmd_info_docs',async (ctx)=>{await ack(ctx);
const txt='📘 *מדריך הפעלה ותיעוד הבוט (/docs)*\n\n⌨️ *מה לכתוב:*\n`/docs` (או `/guide` / `/manual`)\n\n🤖 *מה הבוט ישיב:*\nפותח את מרכז התיעוד של וולטיק מוד עם מדריך חיבור לקבוצה, הרשאות אדמין חובה, הגדרות מומלצות וקישור לאתר התיעוד הרשמי.';
await editMd(ctx,txt,rmKb([[cbBtn('📘 פתח עכשיו את מדריך הבוט','docs_main')],[urlBtn('🌐 לאתר התיעוד הרשמי',DOCS_WEB_URL)],
[cbBtn('🔙 חזרה','help_system')]]));});bot.command(['docs','guide','manual'],
async (ctx)=>{const view=buildDocsView('main');await ctx.reply(view.text,{parse_mode:PM,reply_markup:view.reply_markup});});bot.action('docs_main',async (ctx)=>{await ack(ctx);
const view=buildDocsView('main');await editMd(ctx,view.text,view.reply_markup);});bot.action(/^docs_sec_(setup|perms|recommended|systems)$/,async (ctx)=>{await ack(ctx);
const sec=ctx.match[1];const view=buildDocsView(sec);await editMd(ctx,view.text,view.reply_markup);});bot.command(['cleanservice','clean_service'],
async (ctx)=>{if(!(await requireAdmin(ctx,'/cleanservice [on | off]'))) return;
const arg=((ctx.message.text||'').trim().split(/\s+/)[1]||'').toLowerCase();const data=await getGD(ctx.chat.id);
if(!['on','off'].includes(arg)) {data.cleanService=!data.cleanService;}else {data.cleanService=arg==='on';}
await saveGD(ctx.chat.id,data);await repMd(ctx,`🧼 ניקוי אוטומטי של הודעות שירות (הצטרפות ועזיבה): *${data.cleanService ? 'פעיל (ON)' : 'כבוי (OFF)'}*`);
});bot.command(['dev','status','roadmap','in_dev'],
async (ctx)=>{const {items}=await loadDevBoard();const view=buildDevBoardView(items,isCreator(ctx));await ctx.reply(view.text,{parse_mode:PM,reply_markup:view.reply_markup});
});bot.command(['dev_add','fix_add'],async (ctx)=>{if(!isCreator(ctx)) return;const isFixCmd=/^\/fix_add/i.test((ctx.message.text||'').trim());
const raw=(ctx.message.text||'').replace(/^\/(dev_add|fix_add)(@\S+)?\s*/i,'').trim();
if(!raw) return repMd(ctx,`שימוש: \`/${isFixCmd ? 'fix_add' : 'dev_add'} [שם הפקודה והתיאור]\``);const {s,items}=await loadDevBoard();
items.push({id:Date.now().toString(36),uid:String(ctx.from.id),cmd:raw.split(/\s+/)[0],
text:raw.slice(0,120),type:isFixCmd?'fix' :'dev'});await saveInfoSt(s);const view=buildDevBoardView(items,true);
await ctx.reply(view.text,{parse_mode:PM,reply_markup:view.reply_markup});});bot.action(['devb_add_dev','devb_add_fix'],
async (ctx)=>{if(!isCreator(ctx)) return ack(ctx,'⛔ ליוצר הבוט בלבד!',1);const mode=ctx.callbackQuery.data;creatorWaitState[String(ctx.from.id)]=mode;
await ack(ctx);const label=mode==='devb_add_fix'?'🔧 הוספת פקודה לרשימת התיקונים' :'🚀 הוספת פקודה לרשימת הפיתוח';
await editMd(ctx,`*${label}*\n\nכתוב עכשיו בצ׳אט את שם הפקודה והתיאור הקצר (למשל: \`/poll - מערכת סקרים חכמה\`):`,rmKb([[cbBtn('❌ ביטול וחזרה ללוח','devboard_open')]]));
});bot.action('devboard_open',async (ctx)=>{await ack(ctx);const {items}=await loadDevBoard();const view=buildDevBoardView(items,isCreator(ctx));
await editMd(ctx,view.text,view.reply_markup);});bot.action(/^devb_flip_(\d+)$/,async (ctx)=>{if(!isCreator(ctx)) return ack(ctx,'⛔ ליוצר הבוט בלבד!',1);
const idx=parseInt(ctx.match[1],10);const {s,items}=await loadDevBoard();if(!items[idx]) return ack(ctx,'לא נמצא');
items[idx].type=items[idx].type==='fix'?'dev' :'fix';await saveInfoSt(s);
await ack(ctx,'🔄 הועבר!');const view=buildDevBoardView(items,true);await editMd(ctx,view.text,view.reply_markup);
});bot.action(/^devb_del_(\d+)$/,async (ctx)=>{if(!isCreator(ctx)) return ack(ctx,'⛔ ליוצר הבוט בלבד!',1);const idx=parseInt(ctx.match[1],
10);const {s,items}=await loadDevBoard();if(idx < 0||idx >=items.length) return ack(ctx,'כבר הוסר');
const removed=items.splice(idx,1)[0];await saveInfoSt(s);await ctx.answerCbQuery(`🗑️ הוסר: ${removed.text.slice(0, 25)}`).catch(noop);
const view=buildDevBoardView(items,true);await editMd(ctx,view.text,view.reply_markup);});bot.action('devb_clear_all',async (ctx)=>{if(!isCreator(ctx)) return ack(ctx,'⛔ ליוצר הבוט בלבד!',1);
const {s}=await loadDevBoard();s.devBoard.items=[];await saveInfoSt(s);await ack(ctx,'🧹 הלוח נוקה!');const view=buildDevBoardView([],
true);await editMd(ctx,view.text,view.reply_markup);});async function execApprovePhone(ctx,specificGid=null) {const extraUids=Array.isArray(ctx._extraApproveUids)?[...ctx._extraApproveUids] :[];
const replyMsg=ctx.message?.reply_to_message;if(replyMsg) {if(replyMsg.from&&!replyMsg.from.is_bot) extraUids.push(String(replyMsg.from.id));
if(Array.isArray(replyMsg.new_chat_members)) {for(const nm of replyMsg.new_chat_members) if(nm&&!nm.is_bot) extraUids.push(String(nm.id));}
const kbStr=JSON.stringify(replyMsg.reply_markup||'');const m1=kbStr.match(/fcnt_verifyme_(\d+)/);const m2=kbStr.match(/ver_ok_(\d+)_/);
if(m1) extraUids.push(m1[1]);if(m2) extraUids.push(m2[1]);if(m1||m2) {await ctx.telegram.deleteMessage(ctx.chat.id,replyMsg.message_id).catch(noop);}}
if(ctx.chat&&['group','supergroup'].includes(ctx.chat.type)&&!specificGid) {const statusMsg=await ctx.reply('⏳ סורק ומאשר את כל המצטרפים בקבוצה שהתבקשו לשתף מספר טלפון...');
const res=await approvePhoneGroup(ctx.telegram,ctx.chat.id,extraUids);
const namesLine=res.approvedNames.length?`\n👥 *משתמשים שאושרו כעת:* ${res.approvedNames.slice(0, 20).join(', ')}` :'';
return await ctx.telegram.editMessageText(ctx.chat.id,statusMsg.message_id,undefined,`✅ *האישור הגורף בקבוצה הושלם בהצלחה!*\n• 🔓 *מצטרפים ששוחררו מחסימת אימות הטלפון:* ${res.approvedCount}\n• 🔍 *חברים שנבדקו בקבוצה:* ${res.totalChecked}${namesLine}\n\n💡 בנוסף, כל כפתור אימות טלפון ישן בקבוצה יאשר מעתה את המשתמש בלחיצה אחת ללא בקשת מספר טלפון!`,{parse_mode:PM}).catch(noop);
}const ownState=await getGD('owner_global');const targetGids=specificGid?[String(specificGid)] :Object.keys(ownState.groups||{});
if(!targetGids.length) {return repMd(ctx,'📭 לא נמצאו קבוצות רשומות במערכת. שלח את הפקודה `/approve_phone_all` ישירות בתוך הקבוצה הרצויה.');}
let totalApproved=0;let groupsTouched=0;const summaryRows=[];for(const gid of targetGids) {try {const res=await approvePhoneGroup(ctx.telegram,gid,extraUids);
const gTitle=ownState.groups?.[gid]?.title||gid;if(res.approvedCount > 0) {totalApproved+=res.approvedCount;groupsTouched++;
summaryRows.push(`• *${gTitle}:* אושרו ${res.approvedCount} מצטרפים (${res.approvedNames.slice(0, 8).join(', ')})`);
}}catch(e) {}}const details=summaryRows.length?`\n\n📋 *פירוט לפי קבוצות:*\n${summaryRows.join('\n')}`
:`\n\n💡 כל המשתמשים המוכרים בקבוצות כבר מאושרים! (אם יש הודעת אימות טלפון ישנה בקבוצה, לחיצה עליה או שליחת \`/approve_phone_all\` בהשבה אליה תאשר את המשתמש מיד).`;
return ctx.reply(
`✅ *אישור כל המצטרפים שהתבקשו לשתף מספר טלפון הושלם!*\n• 🏢 *קבוצות שנסרקו:* ${targetGids.length}\n• 🔓 *סה"כ מצטרפים שאושרו ושוחררו לכתיבה:* ${totalApproved}${details}`,{parse_mode:PM,reply_markup:ctx.chat?.type==='private'?{inline_keyboard:[[cbBtn('👑 חזרה לפאנל היוצר','own_panel')]]}:undefined});
}
bot.command(['approve_phone_all','approve_all','unmute_phone','owner_approve_phone'],async (ctx)=>{if(!isCreator(ctx)) {return ctx.reply('⛔ פקודה זו מיועדת ליוצר הבוט בלבד.');}
const args=(ctx.message?.text||'').trim().split(/\s+/).slice(1);const argGid=args.find((a)=>/^-\d+$/.test(a))||null;
ctx._extraApproveUids=args.filter((a)=>/^\d+$/.test(a));await execApprovePhone(ctx,argGid);});bot.action('vown_approve_phone_all',async (ctx)=>{if(!isCreator(ctx)) return ack(ctx,'⛔ ליוצר הבוט בלבד!',1);
await ack(ctx,'⏳ סורק ומאשר מצטרפים בכל הקבוצות...');await execApprovePhone(ctx,null);});bot.command('rules',async (ctx)=>{if(!ctx.chat||ctx.chat.type==='private') {return ctx.reply('⚠️ פקודה זו פועלת בקבוצות בלבד.');
}try {const data=await getGD(ctx.chat.id);const cleaned=cleanRulesText(data.rules);if(cleaned!==data.rules) {data.rules=cleaned;await saveGD(ctx.chat.id,data);}
const mode=data.rulesMode||'public';const botUsername=ctx.botInfo?.username||(await ctx.telegram.getMe()).username;
const rulesUrl=`https://t.me/${botUsername}?start=rules_${ctx.chat.id}`;
const btnText=data.rulesButtonText||'📖 לחץ כאן לצפייה בחוקי הקבוצה';if(mode==='silent') {await ctx.deleteMessage().catch(noop);
return await repMd(ctx,'📜 *חוקי הקבוצה זמינים לקריאה בפרטי:*',[[urlBtn(btnText,rulesUrl)]]);}
await sendFormattedMessage(ctx,`📜 *חוקי הקבוצה:*\n\n${cleaned}`,{name:(ctx.from?.first_name||'חבר')});}catch(err) {await ctx.reply('❌ שגיאה בהצגת חוקי הקבוצה. לעזרה: /help');
}});bot.command('setrules',async (ctx)=>{if(!(await requireAdmin(ctx,'/setrules [טקסט החוקים + כפתורים]'))) return;
try {const adminMsgId=ctx.message?.message_id;const replyMsg=ctx.message?.reply_to_message;let rawInput=(ctx.message?.text||'').replace(/^[\s\u200B-\u200F]*\/setrules(@\S+)?\s*/i,'');
if(!rawInput.trim()&&replyMsg&&(replyMsg.text||replyMsg.caption)) {rawInput=replyMsg.text||replyMsg.caption;}
let explicitMode=null;if(/^(שקט|silent)(\s+|\n|$)/i.test(rawInput.trim())) {explicitMode='silent';rawInput=rawInput.trim().replace(/^(שקט|silent)\s*/i,'');
}else if(/^(פומבי|public)(\s+|\n|$)/i.test(rawInput.trim())) {explicitMode='public';
rawInput=rawInput.trim().replace(/^(פומבי|public)\s*/i,'');}const text=cleanRulesText(rawInput);if(!text) {return repMd(ctx,'⚠️ *שימוש בפקודה /setrules:*\n`/setrules *חוקי הקבוצה:*\n1. שיח מכבד\n{{לערוץ הראשי}{https://t.me/telegram}}`\n\n💡 הבוט ימחק מיד את הודעת ההגדרה ויאפשר לך לבחור בין *מצב שקט* ל*מצב פומבי*.');
}
const preview=await sendFormattedMessage(ctx,text,{name:ctx.from.first_name||'חבר'});if(!preview) return;if(adminMsgId) {await ctx.telegram.deleteMessage(ctx.chat.id,adminMsgId).catch(noop);
}if(preview&&preview.message_id) {await ctx.telegram.deleteMessage(ctx.chat.id,preview.message_id).catch(noop);
}const data=await getGD(ctx.chat.id);data.rules=text;data.groupTitle=ctx.chat.title||data.groupTitle||'';if(explicitMode) data.rulesMode=explicitMode;
await saveGD(ctx.chat.id,data);if(explicitMode==='silent') {const tempMsg=await ctx.reply('🤫 חוקי הקבוצה הוגדרו ונשמרו באופן שקט.');
setTimeout(()=>{ctx.telegram.deleteMessage(ctx.chat.id,tempMsg.message_id).catch(noop);},3000);return;}
if(explicitMode==='public') {const botUsername=ctx.botInfo?.username||(await ctx.telegram.getMe()).username;const rulesUrl=`https://t.me/${botUsername}?start=rules_${ctx.chat.id}`;
const btnText=data.rulesButtonText||'📖 לחץ כאן לצפייה בחוקי הקבוצה';return await repMd(ctx,'📢 *חוקי הקבוצה עודכנו!* לחצו על הכפתור למטה לקריאת החוקים:',[[urlBtn(btnText,rulesUrl)]]);
}
await repMd(ctx,'✅ *חוקי הקבוצה נשמרו והודעות הטקסט נמחקו מהצ׳אט!*\n\nאיך תרצה להגדיר את חוקי הקבוצה כעת?',[[ cbBtn('🤫 באופן שקט','setrules_mode_silent'),cbBtn('📢 באופן פומבי','setrules_mode_public')]]);
}catch(err) {await ctx.reply('❌ שגיאה בעדכון חוקי הקבוצה. לעזרה: /help');}});bot.action(/^setrules_mode_(silent|public)$/,async (ctx)=>{if(!(await isGroupAdminCb(ctx))) {return ack(ctx,'⛔ פעולה זו מיועדת למנהלי הקבוצה בלבד!',1);
}const mode=ctx.match[1];const data=await getGD(ctx.chat.id);data.rulesMode=mode;data.rules=cleanRulesText(data.rules);
await saveGD(ctx.chat.id,data);if(mode==='silent') {await ack(ctx,'🤫 חוקי הקבוצה הוגדרו באופן שקט!');await ctx.deleteMessage().catch(noop);return;}
await ack(ctx,'📢 חוקי הקבוצה הוגדרו באופן פומבי!');const botUsername=ctx.botInfo?.username||(await ctx.telegram.getMe()).username;
const rulesUrl=`https://t.me/${botUsername}?start=rules_${ctx.chat.id}`;
const btnText=data.rulesButtonText||'📖 לחץ כאן לצפייה בחוקי הקבוצה';await editMd(ctx,'📢 *חוקי הקבוצה עודכנו והוגדרו באופן פומבי!*\nלצפייה בחוקי הקבוצה לחצו על הכפתור למטה או שלחו `/rules`:',rmKb([[urlBtn(btnText,rulesUrl)]]));
});bot.action(/^warn_appeal_(\d+)$/,async (ctx)=>{const warnedUid=ctx.match[1];if(warnedUid!=='0'&&String(ctx.from.id)!==String(warnedUid)&&!isCreator(ctx)) {return ack(ctx,'⚠️ כפתור הערעור מיועד למשתמש שקיבל את האזהרה בלבד!',1);
}const actualUid=warnedUid!=='0'?warnedUid :String(ctx.from.id);await ack(ctx,'📩 בקשת הערעור נשלחה למנהלי הקבוצה!',1);
const origText=ctx.callbackQuery?.message?.text||'הודעת אזהרה';await ctx.editMessageText(
`${origText}\n\n📩 *הוגש ערעור ע"י ${ctx.from.first_name}!*\nמנהלי הקבוצה – האם לאשר את הערעור ולאפס את האזהרה?`,{reply_markup:{inline_keyboard:[[
{text:'✅ אשר ערעור ואפס אזהרות',callback_data:`warn_app_ok_${actualUid}`},{text:'❌ דחה ערעור',callback_data:`warn_app_no_${actualUid}`}]]}}).catch(noop);
});bot.action(/^warn_app_(ok|no)_(\d+)$/,async (ctx)=>{if(!(await isGroupAdminCb(ctx))) {return ack(ctx,'⛔ רק מנהלי הקבוצה יכולים לאשר או לדחות ערעור!',1);}
const decision=ctx.match[1];const targetUid=ctx.match[2];const data=await getGD(ctx.chat.id);if(decision==='ok') {if(data.warns) delete data.warns[targetUid];
await saveGD(ctx.chat.id,data);
await ctx.telegram.unbanChatMember(ctx.chat.id,Number(targetUid),{only_if_banned:true}).catch(noop);await ack(ctx,'✅ הערעור אושר והאזהרות אופסו!');
await ctx.editMessageText(`✅ *הערעור אושר ע"י המנהל ${ctx.from.first_name}!* כל האזהרות של המשתמש אופסו.`).catch(noop);
}else {await ack(ctx,'❌ הערעור נדחה.');await ctx.editMessageText(`❌ *הערעור נדחה ע"י המנהל ${ctx.from.first_name}.* האזהרה נשארת בתוקף.`).catch(noop);
}});bot.action('fnd_fshop_menu',async (ctx)=>{await ack(ctx);
const txt='🛍️ *חנות הפיצ׳רים*\n\n⌨️ *מה לכתוב:*\n`/features` (או מתוך `/shop`)\n\n🤖 *מה הבוט ישיב:*\nפותח קטלוג של 52 פקודות וכלים שימושיים לרכישה בנקודות מייסד (מ-50 עד 35,000 נק׳) שעובדים בכל קבוצה וגם בקבוצת המייסדים!';
await editMd(ctx,txt,rmKb([[cbBtn('🛍️ פתח עכשיו את חנות הפיצ׳רים','vshop_page_0')],[cbBtn('🔙 חזרה לפאנל צוות המייסדים','fnd_m_main')]]));
});bot.action('pshop_open',async (ctx)=>{const uid=String(ctx.from.id);
const st=await getInfoSt();if(st.shopClosed&&!isCreator(ctx)) return ack(ctx,'🔒 חנות הנקודות וחנות הפיצ׳רים סגורות כרגע ע"י יוצר הבוט!',1);
const fData=await getGD(FOUNDERS_CHAT_ID);
const mem=fData?.fnd?.members?.[uid]||{points:10};const view=buildPointsShopView(mem,isCreator(ctx),Boolean(st.shopClosed));
await ack(ctx);await editMd(ctx,view.text,view.reply_markup);});bot.action('pshop_toggle',async (ctx)=>{if(!isCreator(ctx)) return ack(ctx,'⛔ ליוצר הבוט בלבד!',1);
const st=await getInfoSt();st.shopClosed=!st.shopClosed;await saveInfoSt(st);await ack(ctx,st.shopClosed?'🔒 שתי החנויות (נקודות + פיצ׳רים) נסגרו למייסדים!' :'🔓 שתי החנויות (נקודות + פיצ׳רים) נפתחו למייסדים!',1);
const view=buildPointsShopView({points:0},true,Boolean(st.shopClosed));await editMd(ctx,view.text,view.reply_markup);
});bot.action('vown_toggle_shop',async (ctx)=>{if(!isCreator(ctx)) return ack(ctx,'⛔ ליוצר הבוט בלבד!',1);
const st=await getInfoSt();st.shopClosed=!st.shopClosed;await saveInfoSt(st);await ack(ctx,st.shopClosed?'🔒 שתי החנויות (נקודות + פיצ׳רים) נסגרו למייסדים!' :'🔓 שתי החנויות (נקודות + פיצ׳רים) נפתחו למייסדים!',1);
const kb=ctx.callbackQuery?.message?.reply_markup?.inline_keyboard;if(Array.isArray(kb)) {for(const r of kb) {for(const b of r) {if(b.callback_data==='vown_toggle_shop') {b.text=st.shopClosed?'🔓 פתח את חנות הנקודות והפיצ׳רים (סגורות 🔴)' :'🔒 סגור את חנות הנקודות והפיצ׳רים (פתוחות 🟢)';
}}}
await ctx.editMessageReplyMarkup({inline_keyboard:kb}).catch(noop);}});bot.action(/^vshop_toggle_(\d+)$/,async (ctx)=>{if(!isCreator(ctx)) return ack(ctx,'⛔ ליוצר הבוט בלבד!',1);
const page=parseInt(ctx.match[1],10)||0;const st=await getInfoSt();st.shopClosed=!st.shopClosed;await saveInfoSt(st);
await ack(ctx,st.shopClosed?'🔒 החנות נסגרה למייסדים!' :'🔓 החנות נפתחה למייסדים!',1);
const view=buildShopView([],0,true,page,Boolean(st.shopClosed));await editMd(ctx,view.text,view.reply_markup);
});bot.action(/^vshop_page_(\d+)$/,async (ctx)=>{const page=parseInt(ctx.match[1],10)||0;const uid=String(ctx.from.id);
const st=await getInfoSt();if(st.shopClosed&&!isCreator(ctx)) return ack(ctx,'🔒 חנות הפיצ׳רים סגורה כרגע ע"י יוצר הבוט!',1);
const fData=await getGD(FOUNDERS_CHAT_ID);const mem=fData?.fnd?.members?.[uid]||{points:10,ownedFeatures:[]};const owned=Array.from(new Set([...(mem.ownedFeatures||[]),...(st.ownedFeatures?.[uid]||[])]));
const view=buildShopView(owned,mem.points||0,isCreator(ctx),page,Boolean(st.shopClosed));await ack(ctx);await editMd(ctx,view.text,view.reply_markup);
});bot.action(/^vshop_feat_(\d+)_(\d+)$/,async (ctx)=>{const featIdx=parseInt(ctx.match[1],10);const page=parseInt(ctx.match[2],
10)||0;const feat=SHOP_FEATS[featIdx];if(!feat) return ack(ctx,'פיצ׳ר לא נמצא');const uid=String(ctx.from.id);
const st=await getInfoSt();if(st.shopClosed&&!isCreator(ctx)) return ack(ctx,'🔒 חנות הפיצ׳רים סגורה כרגע ע"י יוצר הבוט!',1);
const fData=await getGD(FOUNDERS_CHAT_ID);fData.fnd=fData.fnd||{members:{}};
fData.fnd.members=fData.fnd.members||{};const mem=fData.fnd.members[uid]||{id:ctx.from.id,name:ctx.from.first_name||'מייסד',points:10,ownedFeatures:[]};
mem.ownedFeatures=Array.isArray(mem.ownedFeatures)?mem.ownedFeatures :[];
st.ownedFeatures=st.ownedFeatures||{};st.ownedFeatures[uid]=Array.isArray(st.ownedFeatures[uid])?st.ownedFeatures[uid] :[];
const alreadyOwned=isCreator(ctx)||mem.ownedFeatures.includes(feat.cmd)||st.ownedFeatures[uid].includes(feat.cmd);
if(alreadyOwned) {await ctx.answerCbQuery(`✅ הכלי ${feat.name} פתוח אצלך!`).catch(noop);return await repMd(ctx,`🛠️ *${feat.name}*\n📌 *מה הכלי עושה:* ${feat.desc}\n⌨️ *דוגמה להפעלה בכל קבוצה או במייסדים:*\n\`${feat.usage}\``);
}if((mem.points||0) < feat.price) {return ctx.answerCbQuery(
`❌ חסרות לך נקודות מייסד לרכישת "${feat.name}"!\nמחיר: ${feat.price.toLocaleString()} נק׳ | ברשותך: ${(mem.points||0).toLocaleString()} נק׳.`,{show_alert:true}).catch(noop);}
mem.points-=feat.price;mem.ownedFeatures.push(feat.cmd);fData.fnd.members[uid]=mem;await saveGD(FOUNDERS_CHAT_ID,fData);
st.ownedFeatures[uid].push(feat.cmd);await saveInfoSt(st);await ack(ctx,`🎉 תתחדש! רכשת את ${feat.name}!`,1);
const owned=Array.from(new Set([...mem.ownedFeatures,...st.ownedFeatures[uid]]));const view=buildShopView(owned,mem.points,false,page,Boolean(st.shopClosed));
await editMd(ctx,view.text,view.reply_markup);
await repMd(ctx,`🛍️ *רכישת פיצ'ר חדשה בחנות המייסדים!*\n🌟 המייסד *${ctx.from.first_name}* רכש את הפיצ'ר **${feat.name}** ב-*${feat.price.toLocaleString()} נקודות*!\n\n🔓 *הפקודה שנפתחה:* \`/${feat.cmd}\`\n🌍 *איפה היא עובדת?* מעכשיו הפקודה הזו עובדת לך **בכל קבוצה** שבה הבוט נמצא וגם **בקבוצת המייסדים**!`);
});bot.action('addcmd_wiz_cancel',async (ctx)=>{const key=`${ctx.chat?.id}:${ctx.from?.id}`;delete addcmdWizards[key];
await ack(ctx,'בוטל');await ctx.editMessageText('❌ הוספת הפקודה המותאמת בוטלה.').catch(noop);});bot.command('addcmd',async (ctx)=>{if(!(await requireAdmin(ctx,'/addcmd שאלה: [שם] תשובה: [תוכן]'))) return;
try {const raw=(ctx.message.text||'').replace(/^\/addcmd(@\S+)?\s*/i,'').trim();if(!raw) {addcmdWizards[`${ctx.chat.id}:${ctx.from.id}`]={step:1};
return await repMd(ctx,`➕ *הוספת פקודה מותאמת אישית לקבוצה*\n\n❓ *שלב 1 מתוך 2 – שאלה (שם הפקודה):*\nאיזו שאלה או פקודה תרצה להוסיף? כתוב אותה עכשיו בהודעה\n_(או שלח בשורה אחת: \`/addcmd שאלה: [שם] תשובה: [תוכן]\`)_:`,[[cbBtn('❌ ביטול','addcmd_wiz_cancel')]]);
}
let cmdName='';let cmdContent='';const qaMatch=raw.match(/^שאלה\s*:\s*([\s\S]+?)\s+תשובה\s*:\s*([\s\S]+)$/i);if(qaMatch) {cmdName=qaMatch[1].trim().replace(/^\//,'').toLowerCase();
cmdContent=qaMatch[2].trim();}else {const firstSpace=raw.search(/\s/);if(firstSpace===-1) {addcmdWizards[`${ctx.chat.id}:${ctx.from.id}`]={step:2,question:raw.replace(/^\//,'').toLowerCase()};
return await ctx.reply(
`💬 *שלב 2 מתוך 2 – הגדרת התשובה:*\nמה הבוט צריך לענות כשמישהו יכתוב *"\`${raw}\`"*? כתוב עכשיו את התשובה:`,{parse_mode:PM,reply_markup:rmKb([[cbBtn('❌ ביטול','addcmd_wiz_cancel')]])});
}cmdName=raw.slice(0,firstSpace).replace(/^\//,'').toLowerCase();cmdContent=raw.slice(firstSpace+1).trim();}
const preview=await sendFormattedMessage(ctx,cmdContent,{name:ctx.from.first_name||'חבר'});if(!preview) return;
const data=await getGD(ctx.chat.id);data.customCommands=data.customCommands||{};
data.customCommands[cmdName]=cmdContent;const slug=cmdName.split(/\s+/)[0].replace(/^\//,'');if(slug) data.customCommands[slug]=cmdContent;
await saveGD(ctx.chat.id,data);await repMd(ctx,`✅ *הפקודה המותאמת אישית נשמרה בהצלחה!*\n❓ *שאלה:* \`/${slug}\` (או \`${cmdName}\`)\n💬 *תשובה:* מוצגת בתצוגה המקדימה מעל.`);
}catch(err) {await ctx.reply('❌ שגיאה בשמירת פקודה מותאמת אישית.');}});bot.command('delcmd',async (ctx)=>{if(!(await requireAdmin(ctx,'/delcmd [שם פקודה]'))) return;
const cmdName=((ctx.message.text||'').trim().split(/\s+/)[1]||'').replace(/^\//,'').toLowerCase();
if(!cmdName) return repMd(ctx,'⚠️ שימוש: `/delcmd [שם פקודה]`');const data=await getGD(ctx.chat.id);if(!data.customCommands||!data.customCommands[cmdName]) {return repMd(ctx,`⚠️ הפקודה \`/${cmdName}\` לא קיימת בקבוצה.`);
}delete data.customCommands[cmdName];await saveGD(ctx.chat.id,data);await repMd(ctx,`🗑️ הפקודה המותאמת \`/${cmdName}\` נמחקה.`);
});bot.command('cmds',async (ctx)=>{if(!ctx.chat||ctx.chat.type==='private') return ctx.reply('⚠️ פקודה זו פועלת בקבוצות בלבד.');
const data=await getGD(ctx.chat.id);const keys=Object.keys(data.customCommands||{});if(!keys.length) return repMd(ctx,'📋 אין כרגע פקודות מותאמות אישית בקבוצה. להוספה: `/addcmd`');
await repMd(ctx,`📌 *פקודות מותאמות אישית בקבוצה:*\n• /${keys.join('\n• /')}`);});bot.command('admins',async (ctx)=>{if(!(await requireAdmin(ctx,'/admins'))) return;
try {const admins=await ctx.telegram.getChatAdministrators(ctx.chat.id);const list=admins
.filter((a)=>!a.user.is_bot).map((a)=>`${a.status==='creator' ? '👑 בעלים' : '🛡️ אדמין'}: ${a.user.username ? `@${a.user.username}` : a.user.first_name}`);
await ctx.reply(`👥 *צוות הניהול של הקבוצה (${list.length}):*\n${list.join('\n')}`);}catch(err) {await ctx.reply(`❌ שגיאה בשליפת רשימת האדמינים. לעזרה: /help`);
}});bot.command(['id','userinfo'],async (ctx)=>{if(!(await requireAdmin(ctx,'/userinfo [בהשבה להודעה או ללא פרמטר]'))) return;
try {const target=getTarget(ctx)||{id:ctx.from.id,name:ctx.from.first_name||'משתמש',username:ctx.from.username?`@${ctx.from.username}` :'ללא'};
const member=await ctx.telegram.getChatMember(ctx.chat.id,target.id).catch(()=>({status:'לא ידוע'}));const data=await getGD(ctx.chat.id);
const warns=(data.warns[target.id]||[]).length;await ctx.reply(
`👤 *מידע על משתמש:*\n• שם: ${target.name}\n• מזהה: \`${target.id}\`\n• מעמד: ${member.status}\n• אזהרות: ${warns}/3\n• מזהה קבוצה: \`${ctx.chat.id}\``,{parse_mode:PM}
);}catch(err) {await ctx.reply('❌ שגיאה בשליפת פרטי משתמש. לעזרה: /help');}});bot.command(['app','panel','dashboard','miniapp'],async (ctx)=>{if(!ctx.chat) return;const botUsername=ctx.botInfo?.username||'VolticMod_bot';if(ctx.chat.type==='private') {return await ctx.reply('📱 *מיני-אפליקציה לניהול מקסימלי של קבוצות*\nלחץ על הכפתור למטה לפתיחת ממשק הניהול החכם:',{parse_mode:PM,reply_markup:rmKb([[{text:'📱 פתח מיני-אפליקציה לניהול קבוצות',web_app:{url:'https://dov-telegram-bot.vercel.app/webapp.html'}}]])});}
if(!(await requireAdmin(ctx,'/panel'))) return;return await repMd(ctx,'📱 *ניהול הקבוצה במיני-אפליקציה החדשה*\nלחץ על הכפתור למטה לפתיחת לוח הבקרה המלא של הקבוצה:',[[urlBtn('📱 פתח עכשיו מיני-אפליקציה לניהול הקבוצה',`https://t.me/${botUsername}?start=webapp_${ctx.chat.id}`)]]);});
bot.command('stats',async (ctx)=>{if(!(await requireAdmin(ctx,'/stats'))) return;
try {const count=await ctx.telegram.getChatMembersCount(ctx.chat.id);const data=await getGD(ctx.chat.id);await repMd(ctx,`📊 *סטטיסטיקות קבוצה:*\n• חברים: ${count}\n• הודעות שנוטרו: ${data.stats.messages||0}\n• אזהרות: ${data.stats.warnsCount||0}\n• חסימות: ${data.stats.bans||0}\n• פילטרים: ${data.filters.length}`);
}catch(err) {await ctx.reply(`❌ שגיאה בשליפת סטטיסטיקות. לעזרה: /help`);}});};
