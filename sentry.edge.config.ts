import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://6a352ae088efec914fb742fa96418d62@o4511036614836224.ingest.de.sentry.io/4511036615295056",

  tracesSampleRate: 0.05,

  enabled: process.env.NODE_ENV === "production",

  environment: process.env.NODE_ENV,
});
