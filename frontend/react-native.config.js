/**
 * Links the app's static font cuts into both native targets.
 *
 * The cuts are instanced from the Bricolage Grotesque and Schibsted Grotesk
 * variable sources (see docs/UI_IMPLEMENTATION_STANDARDS.md). Each file's
 * PostScript name matches its filename on purpose: iOS resolves a custom font
 * by PostScript name and Android resolves it by asset filename, so keeping the
 * two identical lets `src/theme/typography.ts` address one family per weight.
 */
module.exports = {
  assets: ['./src/assets/fonts'],
};
