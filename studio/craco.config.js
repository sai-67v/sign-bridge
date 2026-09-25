// CRACO config to fix mermaid/cytoscape webpack issue and Node.js polyfills
const path = require('path');

function webpackDevServerMajor() {
  try {
    const { version } = require('webpack-dev-server/package.json');
    return parseInt(String(version).split('.')[0], 10) || 4;
  } catch {
    return 4;
  }
}

function resolveAliasToObject(alias) {
  if (!alias) return {};
  if (Array.isArray(alias)) {
    return alias.reduce((acc, entry) => {
      if (entry && typeof entry.name === 'string' && entry.alias != null) {
        acc[entry.name] = entry.alias;
      }
      return acc;
    }, {});
  }
  if (typeof alias === 'object') {
    return { ...alias };
  }
  return {};
}

module.exports = {
  // Only for webpack-dev-server v5+ (CRA 5 ships v4). Forcing v5 without a full CRA fork breaks `npm start`.
  devServer: (devServerConfig) => {
    if (webpackDevServerMajor() < 5) {
      return devServerConfig;
    }
    const onBefore = devServerConfig.onBeforeSetupMiddleware;
    const onAfter = devServerConfig.onAfterSetupMiddleware;
    delete devServerConfig.onBeforeSetupMiddleware;
    delete devServerConfig.onAfterSetupMiddleware;
    if (onBefore || onAfter) {
      devServerConfig.setupMiddlewares = (middlewares, devServer) => {
        if (onBefore) onBefore(devServer);
        if (onAfter) onAfter(devServer);
        return middlewares;
      };
    }
    // v5 uses server: 'https' (or server: { type: 'https', options }) instead of top-level https
    const hadHttps = devServerConfig.https;
    delete devServerConfig.https;
    if (hadHttps && !devServerConfig.server) {
      devServerConfig.server = typeof hadHttps === 'object' ? { type: 'https', options: hadHttps } : 'https';
    }
    return devServerConfig;
  },
  webpack: {
    /** `@/…` → `src/…` for shadcn / tsconfig paths (Craco merges this into resolve.alias). */
    alias: {
      '@/': path.join(__dirname, 'src') + path.sep,
      '@': path.resolve(__dirname, 'src'),
    },
    configure: (webpackConfig, { env }) => {
      const webpack = require('webpack');
      const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

      if (env === 'development') {
        // ForkTsChecker can make the first dev compile appear hung for a long time.
        webpackConfig.plugins = (webpackConfig.plugins || []).filter(
          (p) =>
            !p ||
            !p.constructor ||
            !['ForkTsCheckerWebpackPlugin', 'ForkTsCheckerWarningWebpackPlugin'].includes(
              p.constructor.name
            )
        );
        webpackConfig.devtool = 'eval-cheap-module-source-map';

        let lastLoggedPct = -100;
        webpackConfig.plugins.push(
          new webpack.ProgressPlugin((p, message) => {
            const pct = Math.round(p * 100);
            if (pct - lastLoggedPct >= 10 || (p >= 0.99 && lastLoggedPct < 99)) {
              lastLoggedPct = p >= 0.99 ? 100 : pct;
              console.log(`[webpack] ${Math.min(pct, 100)}% ${message}`);
            }
          })
        );
      }

      // Ensure resolve exists
      if (!webpackConfig.resolve) {
        webpackConfig.resolve = {};
      }
      
      // Fix cytoscape module resolution by making resolve more lenient
      webpackConfig.resolve = {
        ...webpackConfig.resolve,
        fallback: {
          ...webpackConfig.resolve.fallback,
          fs: false,
          path: false,
          crypto: false,
          // Add Node.js polyfills for Algolia and stream dependencies
          http: require.resolve('stream-http'),
          https: require.resolve('https-browserify'),
          // Use custom polyfill for url that exports URL class
          url: path.resolve(__dirname, 'src/polyfills/url.js'),
          buffer: require.resolve('buffer/'),
          // Algolia client-insights (and Node HTTP stack) expect zlib in browser bundles
          zlib: require.resolve('browserify-zlib'),
          stream: require.resolve('stream-browserify'),
          util: require.resolve('util/'),
          assert: require.resolve('assert/'),
        },
        // Override exports conditions to be more permissive
        conditionNames: ['require', 'node', 'default', 'import', 'module'],
        // Alias to ensure url module uses our polyfill (CRA may use alias[]; spread breaks that)
        // Alias: `@/foo` must map under `src/foo` (webpack scopes + `@/` prefix).
        alias: {
          ...resolveAliasToObject(webpackConfig.resolve.alias),
          '@/': path.join(__dirname, 'src') + path.sep,
          '@': path.resolve(__dirname, 'src'),
          'url': path.resolve(__dirname, 'src/polyfills/url.js'),
          // json-bigint (Appwrite SDK) does `value instanceof BigNumber`; some export-condition
          // combinations bind BigNumber to a non-callable object in the browser bundle.
          'bignumber.js': path.resolve(__dirname, 'node_modules/bignumber.js/bignumber.js'),
        },
      };

      webpackConfig.resolve.plugins = [
        ...(webpackConfig.resolve.plugins || []),
        new TsconfigPathsPlugin({
          configFile: path.resolve(__dirname, 'tsconfig.json'),
        }),
      ];

      // Optimize webpack for production builds to reduce memory usage
      if (env === 'production') {
        // Disable source maps in production to save memory
        webpackConfig.devtool = false;
        
        // Limit parallel processing to reduce memory usage
        if (webpackConfig.parallelism) {
          webpackConfig.parallelism = Math.min(webpackConfig.parallelism || 4, 2);
        }
        
        // Optimize memory usage
        if (webpackConfig.optimization) {
          webpackConfig.optimization = {
            ...webpackConfig.optimization,
            // Reduce memory usage by limiting parallel processing
            moduleIds: 'deterministic',
            // Minimize more aggressively
            minimize: true,
            minimizer: webpackConfig.optimization.minimizer || [],
            // Split chunks more aggressively to reduce memory pressure
            splitChunks: {
              ...webpackConfig.optimization.splitChunks,
              chunks: 'all',
              maxInitialRequests: 25,
              minSize: 30000,
              maxSize: 250000,
              cacheGroups: {
                default: {
                  minChunks: 2,
                  priority: -20,
                  reuseExistingChunk: true,
                },
                vendor: {
                  test: (module) => {
                    const p = module.resource || ""
                    if (!/[\\/]node_modules[\\/]/.test(p)) return false
                    // Appwrite has its own chunk (instanceof / class identity in prod)
                    if (/[\\/]node_modules[\\/]appwrite[\\/]/.test(p)) return false
                    return true
                  },
                  name: 'vendors',
                  priority: -10,
                  chunks: 'all',
                  minSize: 50000,
                },
                // Keep Appwrite SDK in one chunk so class identity (instanceof) is preserved in production
                appwrite: {
                  test: /[\\/]node_modules[\\/]appwrite[\\/]/,
                  name: 'appwrite',
                  priority: 10,
                  chunks: 'all',
                },
                // Separate large libraries
                mermaid: {
                  test: /[\\/]node_modules[\\/]mermaid[\\/]/,
                  name: 'mermaid',
                  priority: 10,
                  chunks: 'all',
                },
                tiptap: {
                  test: /[\\/]node_modules[\\/]@tiptap[\\/]/,
                  name: 'tiptap',
                  priority: 10,
                  chunks: 'all',
                },
              },
            },
          };
        }
        
        // Reduce memory usage in module resolution
        if (webpackConfig.resolve) {
          webpackConfig.resolve.unsafeCache = false;
        }
      }

      // Use NormalModuleReplacementPlugin to fix cytoscape imports
      webpackConfig.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /^\.\/dist\/cytoscape\.umd\.js$/,
          (resource) => {
            if (resource.context.includes('mermaid')) {
              resource.request = 'cytoscape';
            }
          }
        ),
        // Provide buffer globally for packages that expect it
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
        })
      );

      return webpackConfig;
    },
  },
};
