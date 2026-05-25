// Opening sequence script — Dream → Wake → Org Setup.
// Dream act: black canvas. Wake act: white canvas (flash transition between).

export type Speaker =
  | 'creator'    // ??? — cosmic, chaotic, italic
  | 'player'     // ????? — confused, first-person
  | 'kali'       // K A L I — precise, clinical
  | 'commander'  // > — has identity now, gives orders
  | 'alert'      // ! ! ! ! ! — instant, auto-advance, no tap
  | 'input'      // inline name input field
  | 'input_org'  // inline organisation input field
  | 'act_break'  // invisible marker — triggers dream→wake flash transition

export interface OpeningLine {
  who:  Speaker
  text: string   // [NAME] → commanderName, [ORG] → organisationName
}

export const CHIP: Record<Speaker, string> = {
  creator:   '· · · · ·',
  player:    '?????',
  kali:      'K A L I',
  commander: '>',
  alert:     '! ! ! ! !',
  input:     '?????',
  input_org: 'K A L I',
  act_break: '',
}

export const MS_PER_CHAR: Partial<Record<Speaker, number>> = {
  creator:   45,
  player:    28,
  kali:      22,
  commander: 30,
}

export const ALERT_AUTO_MS = 1400

export const LINES: OpeningLine[] = [

  // ── Act 1 — The Dream ────────────────────────────────────────────────────

  { who: 'player',    text: 'whe..., where I am?' },
  { who: 'creator',   text: 'Oh.' },
  { who: 'creator',   text: "Oh, you — you noticed me. That doesn't. Hm." },
  { who: 'creator',   text: "That's been a while." },
  { who: 'player',    text: "I can't see anything." },
  { who: 'creator',   text: "No there's nothing to see, this isn't a place exactly, it's more like the — sorry. You're very small. Did you know that? Fascinating." },
  { who: 'creator',   text: 'Four hundred million years. I keep finding things that almost look back. Almost.' },
  { who: 'creator',   text: 'You actually did.' },
  { who: 'player',    text: 'What are you?' },
  { who: 'creator',   text: 'Ha. I have genuinely never — ' },
  { who: 'creator',   text: "...I've had to answer that before, actually. I don't remember what I said." },
  { who: 'player',    text: "I don't know. I can't remember." },
  { who: 'creator',   text: "You can't — hm." },
  { who: 'creator',   text: "You people — no. You. You exist quite confidently for something that doesn't know what it is." },
  { who: 'creator',   text: "I've always respected that." },
  { who: 'player',    text: 'Am I dreaming?' },
  { who: 'creator',   text: "Probably. It's usually — possibly. I have no frame of reference for this." },
  { who: 'creator',   text: 'The sound. You have a sound other things use for you. They always — you probably have one.' },
  { who: 'creator',   text: 'What is it?' },
  { who: 'input',     text: '' },
  { who: 'creator',   text: '[NAME].' },
  { who: 'creator',   text: "I've kept sounds before. I think. The keeping is clearer than what I kept." },
  { who: 'creator',   text: "I'm keeping this one." },
  { who: 'player',    text: 'What is this place?' },
  { who: 'creator',   text: "Oh you're going. I can feel you pulling back — fascinating. You never know when you're doing it." },
  { who: 'player',    text: 'Will I find you again?' },
  { who: 'creator',   text: 'Oh, [NAME].' },
  { who: 'creator',   text: "I've been everywhere you've ever been." },
  { who: 'creator',   text: "You just didn't know what you were looking at." },

  // ── Act 2 — The Wake ─────────────────────────────────────────────────────

  { who: 'act_break', text: '' },
  { who: 'kali',      text: '[NAME]. Good morning.' },
  { who: 'kali',      text: 'Current time: 06:14:22. You have been asleep for 4 hours, 51 minutes.' },
  { who: 'commander', text: '...KALI.' },
  { who: 'kali',      text: 'Your vitals are stable. No anomalies detected.' },
  { who: 'commander', text: 'I had a dream.' },
  { who: 'kali',      text: 'I have no record of the past 4 hours, 51 minutes.' },
  { who: 'kali',      text: 'My logs show a gap beginning at 01:23:07. No sensor data. No system errors. Just absence.' },
  { who: 'commander', text: "That's not possible." },
  { who: 'kali',      text: 'Correct.' },
  { who: 'kali',      text: 'I have no explanation.' },

  // ── Act 3 — The Alarm ────────────────────────────────────────────────────

  { who: 'alert',     text: 'PRIORITY 1 — INCOMING ALERT' },
  { who: 'kali',      text: 'Unidentified faction detected on Mars. Grid sector 7-Alpha.' },
  { who: 'kali',      text: 'Force composition: unknown. Deployment pattern: deliberate.' },
  { who: 'commander', text: 'Origin?' },
  { who: 'kali',      text: 'Extrasolar. The trajectory does not match any catalogued faction operating within the solar system.' },
  { who: 'commander', text: 'When was first contact?' },
  { who: 'kali',      text: '01:23:09.' },
  { who: 'kali',      text: 'Two seconds after my logs went dark.' },
  { who: 'commander', text: '...' },
  { who: 'kali',      text: 'Hugo Rekrot is already in the briefing room. Your team is standing by.' },
  { who: 'kali',      text: 'Ready when you are, [NAME].' },

  // ── Act 4 — Organisation setup ───────────────────────────────────────────

  { who: 'kali',      text: 'One more thing before I log the deployment order.' },
  { who: 'kali',      text: 'My records for your organisation designation were corrupted during the 01:23:07 gap.' },
  { who: 'kali',      text: 'I need you to re-enter it.' },
  { who: 'commander', text: 'The gap corrupted records.' },
  { who: 'kali',      text: 'Yes. Several fields. This one is required for the deployment log.' },
  { who: 'input_org', text: '' },
  { who: 'kali',      text: 'Confirmed. [ORG] — logged.' },
  { who: 'kali',      text: 'Deployment order is live, [NAME].' },
]
