# URL decoder compatibility build

Source: https://github.com/SamVerschueren/decode-uri-component, npm version 0.5.1.
Upstream index.js SHA-256: 6a86ac891edf15c5efa0841ebb31935e3669d58b98318b57d7b08a4530317cb0

The only code change is replacing the default ESM export with module.exports.
The patched linear-time decoding implementation is unchanged. This preserves
query-string 7 and Expo Router 57 CommonJS compatibility. The upstream MIT
license is retained. Remove this local override when the supported Expo SDK
uses a compatible patched decoder. Validate with verify-mobile-url-security.cjs.
