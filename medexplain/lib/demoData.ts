export const DEMO_FILE_NAME = "sample_bill_1_simple_er.pdf";

export const DEMO_ANALYSIS = {
  summary:
    "This is a hospital bill for Maria L. Rodriguez for an emergency department visit on March 22, 2026, totaling $4,237.25. No insurance was billed, making the patient fully responsible. We found several issues worth challenging before you pay.",
  totalAmount: "$4,237.25",
  issues: [
    {
      severity: "high",
      title: "Insurance Was Never Billed",
      explanation:
        "The hospital explicitly states no insurance company was billed for this visit, meaning Maria is being asked to pay the full $4,237.25 out of pocket without her insurance benefits being applied.",
      chargeAmount: "$4,237.25",
      law: null,
    },
    {
      severity: "high",
      title: "Suspicious Recovery Room Charge",
      explanation:
        "You were charged $1,800.00 for 'Recovery Room Services' during what was only an Emergency Department visit lasting under 4 hours. Recovery room charges are typically only valid after surgery.",
      chargeAmount: "$1,800.00",
      law: "No Surprises Act",
    },
    {
      severity: "medium",
      title: "Elevated Lab & Imaging Costs",
      explanation:
        "Charges for the Chest X-Ray ($412.00), Comprehensive Metabolic Panel ($285.00), and Complete Blood Count ($195.00) appear significantly higher than average market rates for these routine services.",
      chargeAmount: "$892.00",
      law: null,
    },
    {
      severity: "low",
      title: "ED Visit Level May Be Overstated",
      explanation:
        "Your Emergency Department visit is billed at Level 4 ($1,245.00), indicating moderate-to-high complexity. Given the short visit duration, it's worth requesting documentation that supports this billing level.",
      chargeAmount: "$1,245.00",
      law: "45 CFR §164.524",
    },
  ],
  fileText:
    "RIVERSIDE MEMORIAL HOSPITAL\nPatient: Maria L. Rodriguez\nDate of Service: March 22, 2026\nAccount: RMH-2026-03-4421\nTotal: $4,237.25\n\nED Visit Level 4 (99284): $1,245.00\nRecovery Room Services: $1,800.00\nChest X-Ray (71046): $412.00\nComprehensive Metabolic Panel (80053): $285.00\nComplete Blood Count (85025): $195.00\nMedical Supplies: $300.25\n\nInsurance Billed: None\nPatient Responsibility: $4,237.25",
};

export const DEMO_LETTER = {
  englishLetter: `Maria L. Rodriguez
[Your Address]
[City, State, ZIP]

${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}

Riverside Memorial Hospital Billing Department
[Hospital Address]

Subject: Formal Dispute of Charges — Account RMH-2026-03-4421

Dear Hospital Billing Department,

I am writing to formally dispute several charges on my statement for services rendered on March 22, 2026, Account Number RMH-2026-03-4421, totaling $4,237.25.

I am disputing the following specific charges:

1. Recovery Room Services — $1,800.00: This charge is inappropriate for an Emergency Department visit lasting less than four hours with no surgical procedure documented.

2. Insurance Not Billed — $4,237.25: I request that my insurance be billed immediately before any patient responsibility is calculated.

3. Itemized Bill Request: Under 45 CFR §164.524, I have the right to receive a fully itemized statement of all services with corresponding CPT codes, unit prices, and dates of service.

If Riverside Memorial Hospital operates as a nonprofit organization, I also request information about your Financial Assistance Policy (FAP) as required under IRS Section 501(r).

I request a written response to this dispute within thirty (30) calendar days.

Sincerely,

_________________________
Maria L. Rodriguez
Account: RMH-2026-03-4421

Note: Verify with a healthcare advocate. This is not legal advice.`,
  translatedLetter: `मारिया एल. रोड्रिग्ज़
[आपका पता]
[शहर, राज्य, ZIP]

रिवरसाइड मेमोरियल हॉस्पिटल बिलिंग विभाग
[अस्पताल का पता]

विषय: खाता RMH-2026-03-4421 के शुल्कों पर औपचारिक विवाद

प्रिय अस्पताल बिलिंग विभाग,

मैं 22 मार्च, 2026 को प्रदान की गई सेवाओं के लिए $4,237.25 के कुल बिल पर औपचारिक रूप से विवाद करने के लिए लिख रही हूं।

मैं निम्नलिखित शुल्कों पर विवाद कर रही हूं:

1. रिकवरी रूम सर्विसेज — $1,800.00: यह शुल्क चार घंटे से कम की आपातकालीन विभाग की यात्रा के लिए अनुचित है जिसमें कोई शल्य प्रक्रिया दर्ज नहीं है।

2. बीमा बिल नहीं किया गया: कृपया रोगी की जिम्मेदारी निर्धारित करने से पहले मेरा बीमा तुरंत बिल करें।

3. विस्तृत बिल अनुरोध: 45 CFR §164.524 के तहत, मुझे सभी सेवाओं का पूरा विवरण प्राप्त करने का अधिकार है।

मैं तीस (30) कैलेंडर दिनों के भीतर इस विवाद का लिखित जवाब मांगती हूं।

सादर,

_________________________
मारिया एल. रोड्रिग्ज़
खाता: RMH-2026-03-4421`,
};
