# Moving from ClickFunnels to ZFunnel

This guide covers what to do on the ClickFunnels side and what to check in ZFunnel afterwards. Plan about 15 minutes per funnel.

## What the import can and can't do

ClickFunnels has no export of its page designs. ZFunnel reads your **published** pages the same way a browser does, then rebuilds them as editable blocks.

| Comes over                                                        | Doesn't come over (recreate it in ZFunnel)   |
| ----------------------------------------------------------------- | -------------------------------------------- |
| Headlines, sub-headlines, paragraphs, bold and italic text, links | Products, prices and payment settings        |
| Images (copied to ZFunnel's storage)                              | Order bumps, upsell and downsell offers      |
| Buttons, with their main and sub text and their links             | Automations, follow-up funnels, email lists  |
| YouTube, Vimeo and Wistia videos                                  | Popups and exit-intent popups                |
| Bullet lists                                                      | Custom fonts, animations, pixel-exact layout |
| Section background colors and images, simple 2–4 column rows      | Tracking scripts and pixels (on purpose)     |
| Opt-in forms (name, email and phone fields), countdown timers     | Membership areas and course content          |
| Anything else: kept as a "Custom HTML" block, cleaned of scripts  | Split tests and their stats                  |

## 1. In ClickFunnels: publish the pages and copy their links

1. Open the funnel and go through each step in order: opt-in, sales, order form, upsell, thank you…
2. Make sure each page is **published**. Draft or archived pages return an error.
3. Open each page's **live URL** (the "Preview" or "Visit" link, not the editor link). It looks like `https://yourname.myclickfunnels.com/optin-123` or your own domain.
4. Copy the links into a text file, **one per line, in funnel order**. Each link becomes one step.

Tips:

- Pages behind a login (membership pages) can't be read. Rebuild those in **Courses**.
- If a page is password-protected or geo-blocked, remove that setting until the import has finished.
- On ClickFunnels 2.0, use the page's public URL from the "Share" or "Preview" menu.

## 2. In ZFunnel: import the pages

1. Go to **Funnels → Import from ClickFunnels**.
2. Give the new funnel a name.
3. Paste the links (up to 10 per import).
4. Tick **I own these pages or have the right to import them**. Only import pages you own.
5. Click **Import funnel**. This usually takes 10–60 seconds.
6. Open the funnel and review every step in the editor:
   - Check the step types. A page with an order form becomes a **Checkout**, a page with an email form becomes an **Opt-in**, and other pages become a **Sales page** or **Thank you**. Change them in step settings if needed.
   - Fix spacing, fonts and colors. Pick a theme in the editor to restyle every block at once.
   - Read each "Custom HTML" block. Rebuild it with real blocks if you can; it's easier to edit later.
   - Countdown dates are copied when the page states them. Evergreen timers start at 15 minutes, so set the real duration.
7. Publish when you're happy.

## 3. Recreate products, offers and automations

These live in ClickFunnels settings, not on the page, so the import can't see them.

1. **Products:** go to **Products** and add each product with its price (one-time, subscription or payment plan). The templates under **Funnels → New funnel** come with ready-made checkout and upsell pages.
2. **Checkout:** open the checkout step in the funnel and add the product under **Products on this step**, plus an order bump if you had one.
3. **Upsells and downsells:** add an Upsell step after checkout and add its product the same way. A downsell goes on the upsell's "No thanks" path (drag the red handle on the **Map** tab).
4. **Automations:** rebuild follow-up emails under **Automations** (recipes: welcome series, customer onboarding).
5. **Domain:** when everything works, connect your domain under **Settings → Domains**, then point your old links at the new pages.

## 4. Move your contacts

1. In ClickFunnels classic, open **Contacts → Export** (or the contact list's **Export CSV**). In ClickFunnels 2.0, open **Contacts**, select all, then **Export**. You receive a CSV file, sometimes by email.
2. In ZFunnel, go to **Contacts → Import** and choose the file. Optionally add a tag such as `from-clickfunnels`.
3. The columns are recognized automatically:

| ZFunnel field | Accepted ClickFunnels headers (classic and 2.0)                                 |
| ------------- | ------------------------------------------------------------------------------- |
| Email         | `email`, `Email`, `Email Address`                                               |
| Name          | `name`, `Full Name`, or `first_name` / `First Name` + `last_name` / `Last Name` |
| Phone         | `phone`, `Phone`, `Phone Number`, `Mobile`                                      |
| Tags          | `tags`, `Tags`, `Contact Tags` (separated by commas or `                        | `)  |
| Created date  | `created_at`, `Created At`, `Created`, `Date Added`                             |

Other columns (address, IP and so on) are ignored. Contacts already in ZFunnel are updated, never duplicated. Your plan's contact limit applies.

**Consent:** only import people who agreed to hear from you. ZFunnel keeps unsubscribes from now on, but it can't see who unsubscribed in ClickFunnels. Export your unsubscribed list too, and don't email it.

## Troubleshooting

| Message                                      | What to do                                                                                                                                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "the site returned an error"                 | The page isn't published, or the link is an editor link. Open it in a private window.                                                                                                                   |
| "the address is private or can't be reached" | Use the public link. Local, intranet and IP-only addresses are refused for security.                                                                                                                    |
| "the page took too long" / "is too large"    | Try again. If it keeps failing, import that page on its own.                                                                                                                                            |
| An image still points to ClickFunnels        | It was too large (over 5 MB), not a normal image (e.g. SVG), or failed to download. Save a copy, host it somewhere you control, and replace the image URL in the editor before you cancel ClickFunnels. |
