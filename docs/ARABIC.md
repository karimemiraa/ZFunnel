# Arabic in ZFunnel

ZFunnel's Arabic is written, not translated: Modern Standard Arabic in a warm, direct marketing voice, the way an Arab copywriter would write it. This file keeps the vocabulary consistent. Read it before adding or changing Arabic strings.

## Principles

- **Rewrite, don't translate.** Change the sentence order and phrasing until it reads naturally. "We'll email you a secure sign-in link, no password needed" becomes «سنرسل إلى بريدك رابط دخول آمنًا، دون الحاجة إلى كلمة مرور».
- **Use Arabic counting.** Every count goes through plural messages with the six Arabic forms: zero, one, two, few (3–10), many (11–99) and other (100+). Examples: دقيقة واحدة، دقيقتان، 5 دقائق، 15 دقيقة، 100 دقيقة.
- **Western digits** (`ar-u-nu-latn`) everywhere (ADR-023). They match card numbers, phone numbers and prices.
- **Arrows point forward in reading order.** "Continue →" becomes «تابع ←», and back links use «→».
- **Address the customer as «أنت»** (masculine singular, the convention in Arabic UI), with short, active sentences. Use «من فضلك» sparingly and only in error messages.
- **Brand and product names stay as they are** (Stripe, Google, ZFunnel, YouTube).

## Glossary

| English          | Arabic                  | Notes                                 |
| ---------------- | ----------------------- | ------------------------------------- |
| Funnel           | قمع المبيعات / القمع    | Plural: أقماع المبيعات                |
| Opt-in (page)    | صفحة الاشتراك           | An opt-in (the lead) is a «مشترك».    |
| Lead             | عميل محتمل              |                                       |
| Order bump       | عرض إضافي في سلة الشراء | Short form in UI: «عرض إضافي»         |
| Upsell           | عرض ترقية / عرض إضافي   | One-click upsell: «ترقية بنقرة واحدة» |
| Checkout         | الدفع / صفحة الدفع      |                                       |
| Workspace        | مساحة العمل             |                                       |
| Contact          | جهة اتصال               | Plural: جهات الاتصال                  |
| Tag              | وسم                     | Plural: وسوم                          |
| Segment          | شريحة                   |                                       |
| Pipeline (deals) | مسار الصفقات            |                                       |
| Automation       | الأتمتة / سيناريو أتمتة |                                       |
| Trigger          | مُحفِّز                 |                                       |
| Broadcast        | حملة بريدية             |                                       |
| Affiliate        | شريك / التسويق بالعمولة | Program: «برنامج الشركاء»             |
| Commission       | عمولة                   |                                       |
| Webinar          | ندوة                    | Live: «بث مباشر»; replay: «إعادة»     |
| Course / lesson  | دورة / درس              | Member area: «منطقة الأعضاء»          |
| Customer center  | حسابك / مركز العملاء    |                                       |
| Publish          | نشر                     |                                       |
| Split test       | اختبار A/B              |                                       |
| Store            | المتجر                  |                                       |
| Sold out         | نفدت الكمية             |                                       |
| Subscription     | اشتراك                  | Renews: «يتجدد في»                    |
| Refund           | استرداد                 |                                       |

## How strings work

- English lives in `packages/i18n/src/messages/en/*.ts` and is the source of truth.
- Arabic lives in `messages/ar/*.ts`, typed as `Shape<typeof en>`. A missing Arabic key fails `pnpm typecheck`.
- After adding a namespace file, run `python3 packages/i18n/gen-index.py`.
- The dashboard follows the user's language (`zf_lang` cookie, else the browser).
- Public pages, checkout and customer emails follow the workspace's **site language** (Settings → General).

## Typography

- Funnel pages: each Latin theme font has an Arabic pair, and owners can pick another Arabic font per page in the editor (ADR-026). Templates in Arabic set their own pairing; prefer a display or bold face for headings (Cairo, El Messiri, Readex Pro, Amiri for a classic serif look) and a calm text face for body copy (Tajawal, IBM Plex Sans Arabic, Almarai).
- Dashboard: IBM Plex Sans Arabic.
- The AI writer in the editor writes Arabic natively with the voice above; it never translates.
