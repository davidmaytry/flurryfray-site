// The one place for names and contacts that may still change.
// Every [data-studio], [data-email] and [data-studio-link] on the page is
// filled from here, and tools/build_presskit.py reads the same values.
window.SITE = {
  studio: "davidmaytry",
  studioUrl: "https://davidmaytry.com",
  email: "hello@davidmaytry.com",
  steamAppId: 5411930,
  // Steam's store widget (iframe) next to the Wishlist button. It shows an
  // "Error" box until the store page is published, so it stays off till then.
  steamWidget: false,
};
