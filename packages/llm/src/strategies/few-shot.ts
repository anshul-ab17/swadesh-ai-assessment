import type Anthropic from "@anthropic-ai/sdk";
export { SYSTEM_PROMPT, getSystemBlocks } from "./zero-shot.js";

const EXAMPLE_1_TRANSCRIPT = `[Visit type: in-person sick visit]
[Vitals taken at intake: BP 122/78, HR 88, Temp 100.4, SpO2 98%]

Doctor: Hi Jenna, what brings you in today?
Patient: I've had a sore throat for about four days, and now my nose is completely stuffed up. I feel awful.
Doctor: Any cough?
Patient: A little dry one at night.
Doctor: Fever?
Patient: I felt warm yesterday. The thermometer here said 100.4.
Doctor: Let me take a look. Throat is red but no exudate, ears are clear, lungs sound fine. Rapid strep is negative. This looks like a viral upper respiratory infection.
Patient: Can I get an antibiotic just in case?
Doctor: Antibiotics won't help a virus, and they'd just give you side effects. Let's do supportive care. Take ibuprofen 400 mg every 6 hours as needed for the throat pain and fever, plenty of fluids, and saline nasal spray. If you're not improving in 7 days, or you spike a fever above 102, give us a call.
Patient: Okay, that makes sense.
Doctor: No need for a follow-up unless symptoms worsen.`;

const EXAMPLE_1_OUTPUT = JSON.stringify({
  chief_complaint: "sore throat and nasal congestion for four days",
  vitals: { bp: "122/78", hr: 88, temp_f: 100.4, spo2: 98 },
  medications: [{ name: "ibuprofen", dose: "400 mg", frequency: "every 6 hours as needed", route: "PO" }],
  diagnoses: [{ description: "viral upper respiratory infection", icd10: "J06.9" }],
  plan: [
    "supportive care with fluids and saline nasal spray",
    "ibuprofen 400 mg every 6 hours as needed for pain and fever",
    "call if not improving in 7 days or fever above 102",
  ],
  follow_up: { interval_days: null, reason: "return only if symptoms worsen" },
}, null, 2);

const EXAMPLE_2_TRANSCRIPT = `[Visit type: in-person]
[Vitals at intake: BP 118/76, HR 82, Temp 101.2, SpO2 97%]

Doctor: Good morning, Daniel. What's going on?
Patient: I've had this pressure behind my eyes and cheeks for like ten days. It started as a cold but now it's just bad pressure and yellow-green stuff coming out my nose.
Doctor: Any fever?
Patient: On and off. Today it was 101.
Doctor: Tooth pain when you lean forward?
Patient: Yeah, especially in my upper teeth.
Doctor: Tenderness over your maxillary sinuses, that's where I'm pressing. Yes, those are tender. Given the duration past 10 days with worsening symptoms, this looks like acute bacterial sinusitis. I'm going to start you on amoxicillin-clavulanate 875 mg twice daily for 7 days. Use a saline rinse twice a day, and you can take pseudoephedrine 30 mg every 6 hours for the congestion if it doesn't keep you awake.
Patient: Got it.
Doctor: If you're not significantly better in 5 days, call us. Otherwise no follow-up needed.`;

const EXAMPLE_2_OUTPUT = JSON.stringify({
  chief_complaint: "facial pressure and purulent nasal discharge for ten days",
  vitals: { bp: "118/76", hr: 82, temp_f: 101.2, spo2: 97 },
  medications: [
    { name: "amoxicillin-clavulanate", dose: "875 mg", frequency: "twice daily", route: "PO" },
    { name: "pseudoephedrine", dose: "30 mg", frequency: "every 6 hours", route: "PO" },
  ],
  diagnoses: [{ description: "acute bacterial sinusitis", icd10: "J01.90" }],
  plan: [
    "start amoxicillin-clavulanate 875 mg twice daily for 7 days",
    "saline nasal rinse twice a day",
    "pseudoephedrine 30 mg every 6 hours as needed for congestion",
    "call if not significantly better in 5 days",
  ],
  follow_up: { interval_days: null, reason: "call if not improving in 5 days" },
}, null, 2);

export function buildMessages(transcript: string): Anthropic.MessageParam[] {
  return [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Here are two examples of correct extractions.\n\nExample 1 transcript:\n${EXAMPLE_1_TRANSCRIPT}`,
          // @ts-expect-error cache_control valid
          cache_control: { type: "ephemeral" },
        },
      ],
    },
    {
      role: "assistant",
      content: `I'll extract the clinical data. The output will be:\n${EXAMPLE_1_OUTPUT}`,
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Example 2 transcript:\n${EXAMPLE_2_TRANSCRIPT}`,
          // @ts-expect-error cache_control valid
          cache_control: { type: "ephemeral" },
        },
      ],
    },
    {
      role: "assistant",
      content: `Extracted:\n${EXAMPLE_2_OUTPUT}`,
    },
    {
      role: "user",
      content: `Now extract clinical data from this transcript:\n\n${transcript}`,
    },
  ];
}
