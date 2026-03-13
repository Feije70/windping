import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://6a352ae088efec914fb742fa96418d62@o4511036614836224.ingest.de.sentry.io/4511036615295056",

  // Percentage van transacties voor performance monitoring (0.1 = 10%)
  tracesSampleRate: 0.1,

  // Alleen errors loggen in productie, niet in development
  enabled: process.env.NODE_ENV === "production",

  // Omgeving label in Sentry dashboard
  environment: process.env.NODE_ENV,
});
