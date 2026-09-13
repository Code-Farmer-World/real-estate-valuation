/**
 * 畫面狀態的共用型別。
 *
 * 這些字面量聯集原本散在 HomeView 的 script 與 template 各寫一次，
 * 導覽要指定「這一步停在哪個模式、哪張表」之後就有第二個使用者，收成具名型別。
 */

/** 畫面模式。產出＝從勘查表算出該填什麼；審查＝比對已填好的書表 */
export type AppMode = 'survey' | 'review'

/** 審查模式下方的三張表分頁 */
export type TableTab = '表4' | '表5-2' | '表1'
