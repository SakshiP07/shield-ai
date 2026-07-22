package ai.shield.android.sms

import java.util.regex.Pattern

object OtpDetector {
    private val hint = Pattern.compile(
        "\\b(otp|one[-\\s]?time\\s*(?:password|passcode|code)|verification\\s*code|" +
            "auth(?:entication)?\\s*code|security\\s*code|passcode)\\b",
        Pattern.CASE_INSENSITIVE,
    )
    private val labeled = Pattern.compile(
        "(?:otp|code|passcode|password)\\s*(?:is|:)?\\s*(\\d{4,8})",
        Pattern.CASE_INSENSITIVE,
    )
    private val digits = Pattern.compile("(?<!\\d)(\\d{4,8})(?!\\d)")

    data class Result(val isOtp: Boolean, val code: String?)

    fun detect(body: String): Result {
        val text = body.trim()
        if (text.isEmpty()) return Result(false, null)

        val labeledMatch = labeled.matcher(text)
        if (labeledMatch.find()) {
            return Result(true, labeledMatch.group(1))
        }
        if (hint.matcher(text).find()) {
            val dig = digits.matcher(text)
            var six: String? = null
            var any: String? = null
            while (dig.find()) {
                val code = dig.group(1) ?: continue
                any = any ?: code
                if (code.length == 6) six = code
            }
            return Result(true, six ?: any)
        }
        return Result(false, null)
    }
}
