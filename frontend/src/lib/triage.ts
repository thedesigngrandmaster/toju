import type { AiProvenance, PatientLanguage, TriageResponse } from '@/types'

/**
 * Offline rule-based triage.
 *
 * This is deliberately conservative: it is a safety net, not a replacement for
 * Gemini. It runs instantly with zero network and is used to:
 *   1. Immediately surface a RED alert locally when the patient is offline.
 *   2. Refine/queue a cloud AI analysis once connectivity returns.
 *
 * A RED result from these rules is never automatically downgraded by a later
 * AI result. A clinician must resolve the alert.
 */

export const OFFLINE_TRIAGE_PROMPT_VERSION = 'offline-rules@1.2.0'
export const OFFLINE_TRIAGE_MODEL = 'toju-rule-engine'

interface Rule {
  id: string
  label: string
  patterns: RegExp[]
}

const RED_RULES: Rule[] = [
  {
    id: 'chest-pain',
    label: 'Chest pain or tightness',
    patterns: [
      /\bchest\b.{0,25}\b(pain|tight|pressure|heavy|hurts?|squeez)/i,
      /\b(pain|tight|pressure|heavy).{0,25}\bchest\b/i,
      /àyà.{0,20}(dun|rora|wú)/i,
      /obi.{0,20}(egbu|mgbu|mgbaka)/i,
      /kirji.{0,20}(ciwo|nauyi)/i,
    ],
  },
  {
    id: 'breathing',
    label: 'Difficulty breathing at rest',
    patterns: [
      /\b(can.?t|cannot|unable to|hard to|difficulty|trouble)\s+(breathe|breathing)/i,
      /\bshort(ness)? of breath/i,
      /\bbreathless\b/i,
      /\bgasping\b/i,
      /\bsuffocat/i,
      /èémí.{0,25}(kò|ko|le|kii)/i,
      /iku ume/i,
      /numfashi/i,
    ],
  },
  {
    id: 'unconscious',
    label: 'Fainting, seizure or reduced consciousness',
    patterns: [
      /\b(unconscious|passed out|fainted|seizure|convulsion|fits?)\b/i,
      /\b(could not|can.?t)\s+wake/i,
      /\b(dè|dà)?.{0,10}(sonù|jìnnà)/i,
      /\b(anyị|ya).{0,10}(adịghị|efu)/i,
      /\bsumu|fadi/i,
    ],
  },
  {
    id: 'stroke',
    label: 'Stroke warning sign (one-sided weakness or speech)',
    patterns: [
      /\b(one|1)\s*side.{0,20}(weak|numb|paraly)/i,
      /\b(slurred|slurring)\s+speech/i,
      /\bface.{0,15}(droop|drooping)/i,
      /apa.{0,15}(òsì|osi|gbagọ|rọ)/i,
      /hannu.{0,15}(daya|rashin)/i,
    ],
  },
  {
    id: 'bleeding',
    label: 'Severe bleeding or blood in vomit/stool',
    patterns: [
      /\bbleeding\b.{0,30}(heavy|a lot|won.?t stop|severe)/i,
      /\b(vomit|vomiting|throwing up).{0,20}blood/i,
      /\bblood.{0,20}(stool|poo|vomit)/i,
      /\b(ẹjẹ|jini).{0,20}(púpọ̀|pupo|daadaa)/i,
    ],
  },
  {
    id: 'severe-headache',
    label: 'Severe or sudden headache',
    patterns: [
      /\b(severe|worst|sudden|terrible|unbearable).{0,20}headache/i,
      /\bheadache.{0,20}(severe|worst|sudden|terrible|unbearable)/i,
      /orí.{0,20}(dun|gbona).{0,20}(gidigidi|púpọ̀|pupo)/i,
      /isi.{0,20}(ọwụwa|mgbu).{0,20}(ukwu|njo)/i,
      /ciwon kai.{0,20}(mummunan|tsanani)/i,
    ],
  },
  {
    id: 'vision',
    label: 'Blurred or double vision',
    patterns: [
      /\b(blurred|double|loss of|can.?t see|lost)\s+vision/i,
      /\bvision.{0,15}(blur|double|lost)/i,
      /ríran.{0,20}(kò|ko|yé|ye)/i,
      /ọhụụ.{0,20}(adịghị|efu)/i,
      /gani.{0,20}(baya|duhu)/i,
    ],
  },
  {
    id: 'swelling',
    label: 'Rapid leg/ankle swelling or weight gain',
    patterns: [
      /\b(legs?|ankles?|feet).{0,25}(swollen|swelling|puffy|heavy)/i,
      /\bswelling.{0,25}(legs?|ankles?|feet)/i,
      /\b(weight|gained?).{0,25}(2|two|3|three|4|four)\s*(kg|kilo)/i,
      /ẹsẹ̀.{0,20}(wú|wu|gbona)/i,
      /ụkwụ.{0,20}(zaa|aza|fụa)/i,
      /ƙafa.{0,20}(kumbura|kumburi)/i,
    ],
  },
  {
    id: 'high-sugar',
    label: 'Blood sugar above 15 mmol/L',
    patterns: [
      /\b(blood\s*)?sugar.{0,20}(1[5-9]|[2-9]\d)\b/i,
      /\b(1[5-9]|[2-9]\d)\s*(mmol|mg\/dl)?/i,
    ],
  },
  {
    id: 'low-sugar',
    label: 'Blood sugar below 4 mmol/L',
    patterns: [/\b(blood\s*)?sugar.{0,20}([0-3](\.\d+)?)\b/i],
  },
  {
    id: 'high-bp',
    label: 'Blood pressure above 180',
    patterns: [/\b(1[8-9]\d|2\d\d)\s*\/\s*\d{2,3}\b/i, /\bbp.{0,15}(1[8-9]\d|2\d\d)/i],
  },
  {
    id: 'fever',
    label: 'High fever with confusion or stiff neck',
    patterns: [
      /\bfever\b.{0,30}(confus|stiff neck|rash|unconscious)/i,
      /\b(confus|stiff neck).{0,30}fever/i,
      /iba.{0,20}(púpọ̀|pupo|nla)/i,
      /zazzabi.{0,20}(tsanani|mai tsanani)/i,
    ],
  },
  {
    id: 'no-urine',
    label: 'No urine or severe dehydration',
    patterns: [
      /\b(no|not passing|can.?t pass)\s+(urine|pee)\b/i,
      /\b(dehydrated|dehydration)\b/i,
      /\b(sunny|dizzy).{0,20}(no urine|can.?t drink)/i,
    ],
  },
]

const YELLOW_RULES: Rule[] = [
  {
    id: 'missed-medication',
    label: 'Missed medication',
    patterns: [
      /\b(forgot|missed|skipped|didn.?t take|not take)\b.{0,30}\b(med|medicine|drug|insulin|tablet|dose|pill)/i,
      /\b(med|medicine|drug|insulin|tablet|dose|pill).{0,30}(forgot|missed|skipped)/i,
      /ògùn.{0,20}(gbà|gbagbe|padanu)/i,
      /ọgwụ.{0,20}(chefuru|efu)/i,
      /magani.{0,20}(manta|tsallake)/i,
    ],
  },
  {
    id: 'nausea',
    label: 'Nausea or vomiting',
    patterns: [/\b(nausea|nauseous|vomit|vomiting|throwing up)\b/i, /ẹ̀mí|agbọọ|amai/i],
  },
  {
    id: 'pain',
    label: 'New or worsening pain',
    patterns: [
      /\b(pain|painful|hurts?|aching|sore)\b/i,
      /\b(dun|rora|egbu|ciwo)\b/i,
    ],
  },
  {
    id: 'dizzy',
    label: 'Dizziness or weakness',
    patterns: [/\b(dizzy|dizziness|light.?headed|weak|weakness|tired|fatigue)\b/i, /(oja|aláìlera|adịghị ike)/i],
  },
  {
    id: 'swelling-mild',
    label: 'Mild swelling',
    patterns: [/\b(mild|small|little|slight).{0,20}(swell|swollen|puff)/i, /\bswollen\b/i],
  },
  {
    id: 'poor-appetite',
    label: 'Poor appetite or not eating',
    patterns: [
      /\b(no appetite|not eating|can.?t eat|eating poorly|lost appetite)\b/i,
      /kò jẹun|adịghị eri nri|rashin ci abinci/i,
    ],
  },
]

const NEGATIONS = [
  /\b(no|not|never|without|none|zero|don.?t|doesn.?t|didn.?t|haven.?t|hasn.?t|isn.?t|won.?t)\b/i,
  /\b(kò|ko|kii|mi o|mi ò|ko si|kosi)\b/i,
  /\b(adịghị|enweghị|ọ dịghị)\b/i,
  /\b(babu|ba|babu|ba na)\b/i,
]

function normalize(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isNegated(text: string, index: number): boolean {
  const windowStart = Math.max(0, index - 32)
  const preceding = text.slice(windowStart, index)
  return NEGATIONS.some((pattern) => pattern.test(preceding))
}

function matchRules(message: string, rules: Rule[], allowNegation = true): Rule[] {
  const normalized = normalize(message)
  const matched: Rule[] = []
  for (const rule of rules) {
    for (const pattern of rule.patterns) {
      const global = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`)
      let match: RegExpExecArray | null
      while ((match = global.exec(normalized)) !== null) {
        if (!allowNegation || !isNegated(normalized, match.index)) {
          matched.push(rule)
          break
        }
        if (match.index === global.lastIndex) global.lastIndex += 1
      }
      if (matched.includes(rule)) break
    }
  }
  return matched
}

function matchKnownRedFlags(message: string, knownFlags: string[]): string[] {
  const messageTokens = new Set(
    normalize(message)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 3),
  )
  const triggered: string[] = []
  for (const flag of knownFlags) {
    const flagTokens = normalize(flag)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 3)
    if (flagTokens.length === 0) continue
    const overlap = flagTokens.filter((token) => messageTokens.has(token))
    if (overlap.length >= Math.min(2, flagTokens.length)) triggered.push(flag)
  }
  return triggered
}

const BOT_RESPONSES: Record<PatientLanguage, { red: string; yellow: string; green: string }> = {
  english: {
    red: 'This sounds serious. Please go to the nearest hospital now, or call your doctor immediately. Do not wait.',
    yellow: 'Thank you for telling me. Please take your medicine as prescribed and rest. If this gets worse, contact your doctor today.',
    green: 'Thank you for checking in. Keep taking your medicines and follow your care plan. I will check on you again tomorrow.',
  },
  pidgin: {
    red: 'Dis one serious. Abeg go hospital now now, or call your doctor immediately. No wait.',
    yellow: 'Thank you for telling me. Abeg take your medicine well and rest. If e get worse, call your doctor today.',
    green: 'Thank you. Continue your medicine and follow your care plan. I go check on you tomorrow.',
  },
  yoruba: {
    red: 'Èyí ṣe pàtàkì. Jọ̀wọ́ lọ sí ilé ìwòsàn tó súnmọ́ jùlọ báyìí, tàbí pe dókítà rẹ lẹ́sẹ̀kẹsẹ̀. Má dúró.',
    yellow: 'Ẹ ṣé fún sísọ fún mi. Jọ̀wọ́ mu oògùn rẹ gẹ́gẹ́ bí a ṣe sọ, kí ẹ sì sinmi. Tí ó bá burú, pe dókítà rẹ lónìí.',
    green: 'Ẹ ṣé fún ìbẹ̀wò. Ẹ máa mu oògùn, kí ẹ sì tẹ̀lé ètò ìtọ́jú rẹ. Èmi yóò tún yẹ̀ ẹ́ wò lọ́la.',
  },
  igbo: {
    red: 'Nke a dị njọ. Biko gaa ụlọ ọgwụ kacha nso ugbu a, ma ọ bụ kpọọ dọkịta gị ozugbo. Echela.',
    yellow: 'Daalụ maka ịgwa m. Biko ṅụọ ọgwụ gị dịka e nyere gị ma zuru ike. Ọ bụrụ na ọ ka njọ, kpọọ dọkịta gị taa.',
    green: 'Daalụ maka ịbịa. Nọgide na-aṅụ ọgwụ gị ma soro atụmatụ nlekọta gị. M ga-elele gị echi.',
  },
  hausa: {
    red: 'Wannan yana da muhimmanci. Don Allah je asibiti mafi kusa yanzu, ko ka kira likitanka nan take. Kada ka jira.',
    yellow: 'Na gode da gaya mini. Don Allah shan maganin ka yadda aka rubuta kuma ka huta. Idan ya tsananta, kira likitanka yau.',
    green: 'Na gode da zuwa. Ci gaba da shan maganin ka kuma bi tsarin kulawarka. Zan duba ka gobe.',
  },
}

export function offlineTriage(
  message: string,
  knownRedFlags: string[],
  language: PatientLanguage = 'english',
): TriageResponse {
  const redRules = matchRules(message, RED_RULES)
  const knownMatches = matchKnownRedFlags(message, knownRedFlags)
  const yellowRules = matchRules(message, YELLOW_RULES)

  const triggeredFlags = [
    ...new Set([...knownMatches, ...redRules.map((rule) => rule.label)]),
  ]
  const riskScore: TriageResponse['riskScore'] =
    redRules.length > 0 || knownMatches.length > 0
      ? 'red'
      : yellowRules.length > 0
        ? 'yellow'
        : 'green'

  if (riskScore !== 'red') triggeredFlags.push(...yellowRules.map((rule) => rule.label))

  const provenance: AiProvenance = {
    model: OFFLINE_TRIAGE_MODEL,
    promptVersion: OFFLINE_TRIAGE_PROMPT_VERSION,
    generatedAt: new Date().toISOString(),
    source: 'offline-rule',
    confidence: riskScore === 'red' ? 0.72 : riskScore === 'yellow' ? 0.62 : 0.55,
  }

  return {
    riskScore,
    triggeredFlags: [...new Set(triggeredFlags)],
    botResponse: BOT_RESPONSES[language]?.[riskScore] ?? BOT_RESPONSES.english[riskScore],
    provenance,
  }
}
