// The privacy policy (0.8.17): the same words as docs/privacy.html (tools/test-extras.mjs checks that every heading here
// is there too). Settings > Privacy policy opens PRIVACY_URL in the browser when it is set, else shows these sections
// on a scrolling page in the game, so the row is never a dead end.
// PRIVACY_URL: the hosted copy of docs/privacy.html (https only). Empty until the owner hosts the page; set it here,
// in this one place, and the Settings row opens it (Android: the web view hands https links to the browser).
export const PRIVACY_URL = '';
export const PRIVACY_DATE = '26 November 2026';
export const PRIVACY_CONTACT = '[contact email]';

// [heading, paragraph, paragraph, ...]
export const PRIVACY = [
  ['The short version',
    'Eggscape has no accounts and no game server. The game keeps your progress on your phone and sends nothing anywhere by itself. Ads and purchases in the Android app go through Google, and on a games website through that website.'],
  ['What stays on your phone',
    'Your progress and settings: levels, stars, coins, items, sound, speed and graphics choices.',
    'A list of what you bought with real money (the store’s purchase codes), so a purchase is never paid twice and comes back after a reset.',
    'A support id: eight random letters and numbers made by the game. It is not taken from your phone and means nothing outside the game.',
    'A speed log: frame rates and phone details (model, Android version, memory, battery level, screen refresh rate) to find slowdowns. It keeps about the last two hours of play.',
    'Reminder times, if you turned reminders on.',
    'None of this leaves your phone unless you send it yourself.'],
  ['What the game sends',
    'Nothing by itself: no analytics, no tracking, no game server. The speed log leaves your phone only if you tap Share speed log in Settings and choose where to send it.'],
  ['Ads (Android app)',
    'A video is always your choice, for a reward. Videos come from Google AdMob. When one loads, Google’s ad software receives what it needs to show an ad, such as your phone’s advertising ID, IP address and device details. Google’s privacy policy: https://policies.google.com/privacy',
    'You can reset or delete the advertising ID in your phone’s settings (Google > Ads).'],
  ['Purchases (Android app)',
    'Payments are made through Google Play. The game never sees your card or account details. It only learns which product was bought and the purchase code, which it keeps on your phone.'],
  ['Games websites',
    'When you play on a games website, that website and its ad software run their own ads and statistics under its own privacy policy. The game keeps its save in your browser, and some websites also keep a copy in their own cloud save.'],
  ['Children',
    'Eggscape collects no personal information from anyone. In child-safe mode (when the game is told the player is under 13) ads are requested as child-directed with family-rated content only, no offers pop up, and a grown-up’s check comes before any purchase and before a reset.'],
  ['Reminders',
    'Reminders are optional and off until you say yes. They are set on your phone, at most one a day and never at night. No server sends them.'],
  ['Deleting your data',
    'Settings > Reset progress erases your progress; purchases come back from the store.',
    'To delete everything the game keeps, uninstall it or clear its storage (Android: Settings > Apps > Eggscape > Storage > Clear storage; in a browser: clear the site’s data). We have no copy to delete, because the game never sends it to us.'],
  ['Contact',
    'Questions: ' + PRIVACY_CONTACT + '. Please add your support id from the bottom of Settings.'],
  ['Changes',
    'If this policy changes, the new version will be at the same address with a new date.'],
];
