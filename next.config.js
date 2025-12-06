/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  webpack: (config) => {
    // Fix Windows junction point issue
    config.watchOptions = {
      ...config.watchOptions,
      followSymlinks: false,
    };
    config.resolve = {
      ...config.resolve,
      symlinks: false,
    };
    return config;
  },
  eslint: {
    ignoreDuringBuilds: true
  }
};

export default config;
