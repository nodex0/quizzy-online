source "https://rubygems.org"

# Use the github-pages gem to build the site the same way GitHub Pages does.
# Pinned to the version in use by GitHub Pages (v232).
gem "github-pages", "~> 232", group: :jekyll_plugins

# Required for Faraday v2.0+ retry middleware used by jekyll-github-metadata.
# Without this, `require 'faraday/retry'` fails and the build emits the
# "To use retry middleware with Faraday v2.0+, install `faraday-retry` gem"
# warning.
gem "faraday-retry", "~> 2.2"

# Native build deps for Jekyll on Ruby 3.x (stdlib gem-ifications).
gem "webrick", "~> 1.8"
gem "csv", "~> 3.3"
gem "logger", "~> 1.6"
gem "base64", "~> 0.2"
