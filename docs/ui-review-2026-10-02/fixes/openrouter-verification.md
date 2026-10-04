# OpenRouter advisor verification

The existing API-key advisor now offers OpenAI and OpenRouter. Claude artifact hosting still selects its native sample capability. OpenRouter uses its fixed Responses endpoint, full conversation input, store:false, and the existing game tools. OpenRouter model IDs require provider/model syntax; the default is openai/gpt-5-mini. Models must support tools.

Keys remain only in the adapter closure, with no browser storage or game-save persistence. Switching the form provider clears the key field and updates recipient/billing copy. Configuring a provider aborts the prior request and clears conversation; disconnect releases the adapter. No arbitrary endpoint or redirects are allowed.

Validation:
- Eleven focused Node tests pass, including both fixed destinations, game-tool round trips, context preservation, provider/model validation, credential isolation, cancellation, bounded requests, safe errors, provider switching, and the native Claude path.
- Both primary and published inline scripts pass Node syntax checks; git diff --check passes.
- Mobile 390×844, iPad 820×1180, desktop 1440×900: no horizontal overflow; provider/key controls measure 44px; provider defaults, custom model retention, empty credential fields and disconnect verified.
- OpenRouter CORS preflight from the Site origin returns 204 and permits Authorization/Content-Type/POST.
- Browser request using a deliberately invalid test key reached OpenRouter and displayed its expected authentication error. No successful paid inference or live game-tool execution with a valid key was performed.

References: https://openrouter.ai/docs/api_reference/responses/overview and https://openrouter.ai/docs/api_reference/responses/tool-calling
