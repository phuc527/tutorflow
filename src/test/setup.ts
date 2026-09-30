/// <reference types="node" />
// Run unit tests in a timezone far from Asia/Ho_Chi_Minh (UTC-4/-5 vs UTC+7).
// Any code that accidentally uses the machine's local timezone will then produce wrong results.
process.env.TZ = 'America/New_York'
