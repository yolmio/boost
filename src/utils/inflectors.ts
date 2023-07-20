const decamelizeRegexp = /([a-z\d])([A-Z])/g;

export function normalizeCase(value: string): string[] {
  return value.replace(decamelizeRegexp, "$1_$2").toLowerCase().split(/-|_/g);
}

const uncountables: Set<string> = new Set([
  "accommodation",
  "adulthood",
  "advertising",
  "advice",
  "aggression",
  "aid",
  "air",
  "aircraft",
  "alcohol",
  "anger",
  "applause",
  "arithmetic",
  "assistance",
  "athletics",

  "bacon",
  "baggage",
  "beef",
  "biology",
  "blood",
  "botany",
  "bread",
  "butter",

  "carbon",
  "cardboard",
  "cash",
  "chalk",
  "chaos",
  "chess",
  "crossroads",
  "countryside",

  "dancing",
  "deer",
  "dignity",
  "dirt",
  "dust",

  "economics",
  "education",
  "electricity",
  "engineering",
  "enjoyment",
  "envy",
  "equipment",
  "ethics",
  "evidence",
  "evolution",

  "fame",
  "fiction",
  "flour",
  "flu",
  "food",
  "fuel",
  "fun",
  "furniture",

  "gallows",
  "garbage",
  "garlic",
  "genetics",
  "gold",
  "golf",
  "gossip",
  "grammar",
  "gratitude",
  "grief",
  "guilt",
  "gymnastics",

  "happiness",
  "hardware",
  "harm",
  "hate",
  "hatred",
  "health",
  "heat",
  "help",
  "homework",
  "honesty",
  "honey",
  "hospitality",
  "housework",
  "humour",
  "hunger",
  "hydrogen",

  "ice",
  "importance",
  "inflation",
  "information",
  "innocence",
  "iron",
  "irony",

  "jam",
  "jewelry",
  "judo",

  "karate",
  "knowledge",

  "lack",
  "laughter",
  "lava",
  "leather",
  "leisure",
  "lightning",
  "linguine",
  "linguini",
  "linguistics",
  "literature",
  "litter",
  "livestock",
  "logic",
  "loneliness",
  "luck",
  "luggage",

  "macaroni",
  "machinery",
  "magic",
  "management",
  "mankind",
  "marble",
  "mathematics",
  "mayonnaise",
  "measles",
  "methane",
  "milk",
  "money",
  "mud",
  "music",
  "mumps",

  "nature",
  "news",
  "nitrogen",
  "nonsense",
  "nurture",
  "nutrition",

  "obedience",
  "obesity",
  "oxygen",

  "pasta",
  "patience",
  "physics",
  "poetry",
  "pollution",
  "poverty",
  "pride",
  "psychology",
  "publicity",
  "punctuation",

  "quartz",

  "racism",
  "relaxation",
  "reliability",
  "research",
  "respect",
  "revenge",
  "rice",
  "rubbish",
  "rum",

  "safety",
  "scenery",
  "seafood",
  "seaside",
  "series",
  "shame",
  "sheep",
  "shopping",
  "sleep",
  "smoke",
  "smoking",
  "snow",
  "soap",
  "software",
  "soil",
  "spaghetti",
  "species",
  "steam",
  "stuff",
  "stupidity",
  "sunshine",
  "symmetry",

  "tennis",
  "thirst",
  "thunder",
  "timber",
  "traffic",
  "transportation",
  "trust",

  "underwear",
  "unemployment",
  "unity",

  "validity",
  "veal",
  "vegetation",
  "vegetarianism",
  "vengeance",
  "violence",
  "vitality",

  "warmth",
  "wealth",
  "weather",
  "welfare",
  "wheat",
  "wildlife",
  "wisdom",
  "yoga",

  "zinc",
  "zoology",
]);

const specialCases = new Map<string, string>();

specialCases.set("ox", "oxen");
specialCases.set("man", "men");
specialCases.set("woman", "women");
specialCases.set("die", "dice");
specialCases.set("yes", "yeses");
specialCases.set("foot", "feet");
specialCases.set("eave", "eaves");
specialCases.set("goose", "geese");
specialCases.set("tooth", "teeth");
specialCases.set("quiz", "quizzes");

const rules: [RegExp, string][] = [
  [/(\w*)s$/, "s"],
  [/(\w*([^aeiou]ese))$/, ""],
  [/(\w*(ax|test))is$/, "es"],
  [/(\w*(alias|[^aou]us|tlas|gas|ris))$/, "es"],
  [/(\w*(ax|test))is$/, "s"],
  [/(\w*([^l]ias|[aeiou]las|[emjzr]as|[iu]am))$/, ""],
  [
    /(\w*(alumn|syllab|octop|vir|radi|nucle|fung|cact|stimul|termin|bacill|foc|uter|loc|strat))(?:us|i)$/,
    "i",
  ],
  [/(\w*(alumn|alg|vertebr))(?:a|ae)$/, "ae"],
  [/(\w*(seraph|cherub))(?:im)?$/, "im"],
  [/(\w*(her|at|gr))o$/, "oes"],
  [
    /(\w*(agend|addend|millenni|dat|extrem|bacteri|desiderat|strat|candelabr|errat|ov|symposi|curricul|automat|quor))(?:a|um)$/,
    "a",
  ],
  [
    /(\w*(apheli|hyperbat|periheli|asyndet|noumen|phenomen|criteri|organ|prolegomen|hedr|automat))(?:a|on)$/,
    "a",
  ],
  [/(\w*)sis$/, "ses"],
  [/(\w*(kni|wi|li))fe$/, "ves"],
  [/(\w*(ar|l|ea|eo|oa|hoo))f$/, "ves"],
  [/(\w*([^aeiouy]|qu))y$/, "ies"],
  [/(\w*([^ch][ieo][ln]))ey$/, "ies"],
  [/(\w*(x|ch|ss|sh|zz)es)$/, ""],
  [/(\w*(x|ch|ss|sh|zz))$/, "es"],
  [/(\w*(matr|cod|mur|sil|vert|ind|append))(?:ix|ex)$/, "ices"],
  [/(\w*(m|l)(?:ice|ouse))$/, "ice"],
  [/(\w*(pe)(?:rson|ople))$/, "ople"],
  [/(\w*(child))(?:ren)?$/, "ren"],
  [/(\w*eaux)$/, ""],
];

rules.reverse();

function pluralizeWord(word: string): string {
  if (uncountables.has(word)) {
    return word;
  }
  if (specialCases.has(word)) {
    return specialCases.get(word)!;
  }
  for (const [rule, replace] of rules) {
    const exec = word.match(rule);
    if (exec?.[1]) {
      return exec[1] + replace;
    }
  }
  return word + "s";
}

export function pluralize(value: string): string {
  const splitValue = value.split(/-|_|\s/g);
  const lastWord = splitValue[splitValue.length - 1];
  return (
    value.substring(0, value.length - lastWord.length) + pluralizeWord(lastWord)
  );
}

export function upcaseFirst(s: string): string {
  if (s.length === 0) {
    return s;
  }
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function downcaseFirst(s: string): string {
  if (s.length === 0) {
    return s;
  }
  return s.charAt(0).toLowerCase() + s.slice(1);
}
