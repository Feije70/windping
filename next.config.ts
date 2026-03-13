import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  org: "windping",
  project: "windping",

  // Source maps uploaden naar Sentry voor leesbare stacktraces
  // Worden NIET meegestuurd naar de browser
  silent: true,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
});
