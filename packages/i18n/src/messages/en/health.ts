export const health = {
  tab: "Health",
  title: "Funnel health",
  band: {
    good: "Looking healthy",
    fair: "A few things to fix",
    poor: "Needs attention before you send traffic",
  },
  checked: {
    one: "Checked {steps} steps and {count} block.",
    other: "Checked {steps} steps and {count} blocks.",
  },
  severity: {
    critical: { one: "{count} critical", other: "{count} critical" },
    warning: { one: "{count} warning", other: "{count} warnings" },
    info: { one: "{count} tip", other: "{count} tips" },
  },
  allGood: "No issues found. This funnel is ready for traffic.",
  open: "Open",
  fixed: "Fixed",
  nothingToFix: "There's nothing left to fix here.",
  fix: {
    seoFromContent: "Fill from page",
    linkNext: "Link to next step",
    publish: "Publish",
  },
  rules: {
    emptyPage: { title: "Empty page", body: "This step has no content yet." },
    nextMissing: {
      title: {
        one: "A button or form leads nowhere",
        other: "{count} buttons or forms lead nowhere",
      },
      body: "They send visitors to the next step, but this step isn't linked to one.",
    },
    nextBroken: { title: "Next step is missing", body: "This step points to a step that no longer exists." },
    declineMissing: {
      title: "No “No thanks” path",
      body: "Set where visitors go when they decline this offer, or they'll hit a dead end.",
    },
    buttonUrlEmpty: { title: "Button with no link", body: "“{label}” is set to open a URL, but the URL is empty." },
    internalLinkBroken: {
      title: "Broken link",
      body: "“{label}” links to {url}, which isn't a step in this funnel.",
    },
    anchorBroken: {
      title: "Scroll target not found",
      body: "“{label}” scrolls to a section that doesn't exist on this page. Give a section that anchor ID.",
    },
    seoTitle: { title: "Missing SEO title", body: "Search results and browser tabs will show the step name instead." },
    seoDescription: {
      title: "Missing SEO description",
      body: "Search engines and link previews will pick random text from the page.",
    },
    ogImage: { title: "No social share image", body: "Links shared on social media will show without a picture." },
    imageOversized: {
      title: "Heavy image",
      body: "An image is {kb} KB. Images over 400 KB slow the page down on mobile data.",
    },
    imageNoAlt: {
      title: "Image without a description",
      body: "Add alt text for screen readers and search engines.",
    },
    checkoutNoProduct: {
      title: "Checkout without a product",
      body: "Visitors can't pay on this step until you attach a product.",
    },
    upsellNoOffer: { title: "Upsell without an offer", body: "Attach the product this step offers." },
    unpublished: { title: "Not published", body: "Visitors can't see this step yet." },
    unpublishedChanges: { title: "Unpublished changes", body: "Your latest edits aren't live yet." },
    noFavicon: {
      title: "No favicon",
      body: "Add a logo in Settings: published pages use it as the browser tab icon.",
    },
    noDomain: {
      title: "No custom domain",
      body: "The funnel runs on your free subdomain. Your own domain builds more trust.",
    },
    formNoAutomation: {
      title: "Forms without a follow-up",
      body: "New leads aren't sent any email. Add an automation that starts on opt-in.",
    },
    mobileFixedWidth: {
      title: "Too wide for phones",
      body: "Custom HTML uses a fixed width of {px}px, wider than most phone screens.",
    },
  },
};
