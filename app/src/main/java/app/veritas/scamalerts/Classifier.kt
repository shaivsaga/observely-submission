package app.veritas.scamalerts

import android.content.Context
import org.json.JSONObject
import kotlin.math.exp
import kotlin.math.sqrt

class Result(val bad: Boolean, val words: List<String>, val signs: List<String>, val readable: Boolean)

/** Same model as the web app: TF-IDF + logistic regression trained on the UCI SMS Spam Collection. Runs fully on the phone. */
class Classifier(ctx: Context) {
    private val m = JSONObject(ctx.assets.open("model.json").bufferedReader().use { it.readText() })
    private val vocab = m.getJSONObject("v")
    private val bias = m.getDouble("b")
    private val cut = m.getDouble("cut")
    private val tok = Regex("""\b\w\w+\b""")
    private val ci = RegexOption.IGNORE_CASE
    private val patterns = listOf(
        "pressure to act now" to Regex("""\b(urgent|immediately|final notice|act now|last chance|expires?|within \d+ ?(hours?|hrs?|days?))\b""", ci),
        "a prize or free item" to Regex("""\b(won|winner|prize|free|congratulations|reward|refund|claim)\b""", ci),
        "a link to tap" to Regex("""(https?://|www\.)\S+|\b[\w-]+\.(com|net|xyz|top|info|cc|ly|co)\b""", ci),
        "a payment or fee first" to Regex("""\b(fee|gift ?cards?|payment|wire|bitcoin|crypto|transfer)\b""", ci),
        "account locked, confirm details" to Regex("""\b(suspended|locked|verify|confirm|password|log ?in|sign in|otp|pin)\b""", ci),
        "a famous name giving things away" to Regex("""\b(giveaway|giving away|mrbeast|elon)\b""", ci),
        "someone to text for the payout" to Regex("""\b(text|message|contact|call|dm) my (associate|agent|assistant|friend|partner)\b""", ci),
        "a one-time code to hand over" to Regex("""\b(send|share|reply with|give me) (this|the|that)? ?(code|otp|pin|password)\b""", ci),
    )

    fun check(text: String): Result {
        val counts = HashMap<String, Int>()
        tok.findAll(text.lowercase()).forEach { if (vocab.has(it.value)) counts[it.value] = (counts[it.value] ?: 0) + 1 }
        val tfidf = counts.mapValues { (w, c) -> c * vocab.getJSONArray(w).getDouble(0) }
        val norm = sqrt(tfidf.values.sumOf { it * it }).let { if (it > 0) it else 1.0 }
        var z = bias
        val contrib = ArrayList<Pair<String, Double>>()
        for ((w, x) in tfidf) {
            val c = x / norm * vocab.getJSONArray(w).getDouble(1)
            z += c; contrib.add(w to c)
        }
        val fromModel = 1 / (1 + exp(-z)) >= cut
        val signs = patterns.filter { it.second.containsMatchIn(text) }.map { it.first }
        val top = contrib.filter { it.second > 0 }.sortedByDescending { it.second }.take(5).map { it.first }
        return Result(fromModel || signs.size >= 2, if (fromModel) top else emptyList(), signs, counts.isNotEmpty())
    }
}
