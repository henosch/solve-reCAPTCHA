# Buster Userscript

This is a userscript version of the Buster extension that automatically solves reCAPTCHA audio challenges using WIT.ai speech recognition.

## Features

- ✅ **Exact Buster Logic**: Maintains all original DOM selectors, timing logic, and state management
- ✅ **WIT.ai Integration**: Uses the same WIT.ai Mobile API for audio transcription
- ✅ **No Native Dependencies**: Works without requiring the native client app
- ✅ **Auto-Detection**: Automatically detects reCAPTCHA challenge frames
- ✅ **Cross-Browser**: Works with any userscript manager (Tampermonkey, Greasemonkey, Violentmonkey)

## Installation

1. **Get WIT.ai API Key** (Required):
   - Visit [WIT.ai](https://wit.ai) and create a free account
   - Create a new app or use an existing one
   - Copy your API key from the settings

2. **Install a Userscript Manager**:
   - Chrome: [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - Firefox: [Greasemonkey](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/) or [Tampermonkey](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
   - Safari: [Tampermonkey](https://apps.apple.com/us/app/tampermonkey/id1482490089)

3. **Configure and Install the Userscript**:
   - Open the `solve-reCAPTCHA.js` file
   - Replace `YOUR_KEY_HERE` on line 21 with your WIT.ai API key
   - Copy the entire contents
   - Create a new userscript in your manager
   - Paste the code and save

4. **Verify Installation**:
   - Visit the test page: [Google reCAPTCHA Demo](https://www.google.com/recaptcha/api2/demo) 
   - Check the browser console (F12) for "Buster: Initializing on reCAPTCHA frame"

## How It Works

1. **Frame Detection**: The userscript detects when you're in a reCAPTCHA challenge frame (`*recaptcha*api2/bframe*`)
2. **UI Integration**: Replaces the help button with a solver button using Shadow DOM
3. **Audio Challenge**: Automatically switches to audio challenge when solver is clicked
4. **Speech Recognition**: Uses WIT.ai API to transcribe the audio challenge
5. **Auto-Submit**: Fills in the transcribed text and submits the solution

## Configuration

The userscript uses GM_getValue/GM_setValue APIs for configuration with these keys:
- `buster_navigateWithKeyboard`: Use keyboard navigation (default: false)
- `buster_simulateUserInput`: Simulate user input (default: false, disabled in userscript)
- `buster_autoUpdateClientApp`: Auto-update client app (default: false, not applicable)

**Important**: You must configure your WIT.ai API key in the userscript:
1. Get a free API key from [WIT.ai](https://wit.ai)
2. Replace `YOUR_KEY_HERE` in line 21 of the userscript with your actual API key
3. Save the userscript

## Technical Details

### Original Extension → Userscript Conversions

| Extension Feature | Userscript Implementation |
|-------------------|---------------------------|
| `browser.runtime.sendMessage` | Direct API calls with `fetch()` |
| `browser.storage` | `localStorage` with `buster_` prefix |
| `browser.i18n.getMessage` | Hardcoded string constants |
| `browser.runtime.getURL` | Data URLs for embedded CSS |
| Native messaging client | Disabled (not available in userscript) |
| Extension CSS files | Embedded as data URLs |

### Key Components

1. **WIT.ai Mobile API**: Direct speech-to-text transcription (requires API key)
2. **DOM Selectors**: Exact same selectors as original extension
3. **State Management**: Same `solverWorking` boolean and button state
4. **Error Handling**: Comprehensive logging and user notifications
5. **Frame Detection**: Smart detection of reCAPTCHA challenge frames
6. **Fallback Support**: Web Speech API as backup if WIT.ai fails

## Testing

### Real reCAPTCHA Tests
- [Google reCAPTCHA Demo](https://www.google.com/recaptcha/api2/demo)
- [reCAPTCHA Demo Site](https://recaptcha-demo.appspot.com/)

### Console Logs
Check your browser console for detailed debugging information:
- `Buster: Initializing on reCAPTCHA frame`
- `Buster: Solver button added`
- `Buster: Starting WIT.ai transcription...`
- `Buster: Transcription successful: [text]`

## Troubleshooting

### Userscript Not Loading
- Verify your userscript manager is installed and enabled
- Check that the userscript is enabled in your manager
- Look for error messages in the browser console

### Solver Button Not Appearing
- Ensure you're on a reCAPTCHA challenge frame (URL should contain `recaptcha` and `bframe`)
- Check console for "Buster: Initializing on reCAPTCHA frame"
- Verify the help button exists (`#recaptcha-help-button`)

### Transcription Failing
- Verify your WIT.ai API key is correctly configured (check console for "YOUR_KEY_HERE" errors)
- Check console for WIT.ai API errors
- Verify the audio element is found (`audio#audio-source`)
- Ensure the audio URL is accessible
- Try the Web Speech API fallback (automatically enabled if WIT.ai fails)

### Challenge Not Solving
- Check if the audio response input field is found (`#audio-response`)
- Verify the submit button exists (`#recaptcha-verify-button`)
- Look for any DOM errors in the console

## Limitations

1. **No Native App**: The userscript version doesn't use the native client app for mouse/keyboard simulation
2. **Direct Input**: Uses direct DOM manipulation instead of simulated user input
3. **Single Environment**: Only works in the browser, not as a system-wide solution
4. **API Key Required**: Requires manual configuration of WIT.ai API key
5. **Browser Restrictions**: Some browsers may have CORS limitations for audio fetching
6. **Rate Limiting**: WIT.ai free tier has usage limits

## Security Notes

- The userscript only runs on pages you visit
- It only interacts with reCAPTCHA elements
- Audio data is sent to WIT.ai for transcription (requires API key)
- No other data is sent to third parties
- All processing happens locally in your browser
- Your WIT.ai API key is stored in the userscript (keep it private)

## Development

To modify the userscript:

1. Edit `solve-reCAPTCHA.js`
2. Test changes with the test page
3. Check console for errors
4. Test with real reCAPTCHA challenges

## Credits

- Original Buster extension logic preserved exactly
- WIT.ai integration maintained from original mobile implementation
- Converted from ES6 modules to userscript format
- All original DOM selectors and timing logic intact

## License

This userscript maintains the same functionality as the original Buster extension but adapted for userscript managers. Use responsibly and in accordance with website terms of service.
