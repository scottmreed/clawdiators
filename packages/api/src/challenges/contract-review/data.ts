import { mulberry32 } from "../../services/whimsy.js";

export interface ContractSection {
  id: string;
  title: string;
  clauses: string[];
}

export interface DefinedTerm {
  term: string;
  definition: string;
  section_id: string;
}

export interface ContractIssue {
  id: string;
  type: "inconsistency" | "undefined_term" | "contradiction" | "missing_cross_reference" | "ambiguous_clause";
  section_ids: string[];
  description: string;
  severity: "high" | "medium" | "low";
}

export interface ContractGroundTruth {
  issues: ContractIssue[];
  total_sections: number;
}

export interface ContractData {
  sections: ContractSection[];
  definitions: DefinedTerm[];
  groundTruth: ContractGroundTruth;
  objective: string;
}

// ── Section templates ────────────────────────────────────────────────

interface SectionTemplate {
  title: string;
  makeClauses: (rng: () => number, sectionId: string) => string[];
}

const PARTY_NAMES = [
  "The Abyssal Trade Consortium (ATC)",
  "The Meridian Infrastructure Authority (MIA)",
  "The Deep Current Logistics Group (DCLG)",
  "The Coral Reef Development Corporation (CRDC)",
];

const CURRENCY_NAMES = ["Abyssal Credits", "Deep Marks", "Tidal Units", "Reef Tokens"];

const MATERIAL_NAMES = [
  "crystalline ore", "deep-sea kelp fiber", "volcanic glass composite",
  "bioluminescent resin", "pressurized coral aggregate", "thermal vent alloy",
];

const REGION_NAMES = [
  "the Hadal Corridor", "the Meridian Trench Zone", "the Abyssal Shelf",
  "the Thermocline Basin", "the Pelagic Transit Lane", "the Benthic Plateau",
];

const sectionTemplates: SectionTemplate[] = [
  {
    title: "Parties and Recitals",
    makeClauses: (rng, _sid) => {
      const p1 = PARTY_NAMES[Math.floor(rng() * PARTY_NAMES.length)];
      const p2 = PARTY_NAMES[Math.floor(rng() * PARTY_NAMES.length)];
      return [
        `This Abyssal Trade & Infrastructure Agreement ("Agreement") is entered into by and between ${p1}, hereinafter referred to as "Provider", and ${p2}, hereinafter referred to as "Recipient".`,
        `WHEREAS Provider possesses expertise in deep-sea infrastructure deployment and Recipient requires such services for the expansion of commercial operations in ${REGION_NAMES[Math.floor(rng() * REGION_NAMES.length)]}.`,
        `WHEREAS both parties intend to establish a framework for mutual cooperation, resource exchange, and infrastructure development under the terms set forth herein.`,
        `NOW THEREFORE, in consideration of the mutual covenants and agreements herein contained, the parties agree as follows.`,
      ];
    },
  },
  {
    title: "Definitions",
    makeClauses: (_rng, _sid) => [
      `"Deliverable" means any tangible or intangible output produced pursuant to this Agreement, including but not limited to infrastructure components, reports, and data sets.`,
      `"Force Majeure Event" means any event beyond the reasonable control of a party, including but not limited to seismic disruptions, volcanic activity, extreme pressure anomalies, and regulatory embargo.`,
      `"Service Period" means the duration commencing on the Effective Date and ending on the Termination Date as specified in Section 30.`,
      `"Approved Materials" means materials that have been inspected, tested, and certified by an accredited deep-sea materials laboratory in accordance with Abyssal Standard 7.4.`,
      `"Performance Threshold" means the minimum acceptable level of output quality, measured by the metrics specified in Section 24.`,
      `"Net Compensation" means the total compensation payable minus applicable deductions, withholdings, and penalties as outlined in Section 4.`,
    ],
  },
  {
    title: "Scope of Work",
    makeClauses: (rng, _sid) => {
      const material = MATERIAL_NAMES[Math.floor(rng() * MATERIAL_NAMES.length)];
      const region = REGION_NAMES[Math.floor(rng() * REGION_NAMES.length)];
      return [
        `Provider shall design, fabricate, and deploy infrastructure modules using ${material} in ${region}, in accordance with the specifications set forth in Appendix A.`,
        `The scope includes site surveying, environmental impact assessment, material procurement, module assembly, deployment, and post-deployment monitoring for a period of not less than twelve (12) months.`,
        `Any modifications to the scope of work must be agreed upon in writing by both parties and documented as an amendment to this Agreement pursuant to Section 21.`,
        `Provider shall maintain a project timeline with monthly milestones and shall report progress to Recipient in accordance with Section 29.`,
      ];
    },
  },
  {
    title: "Payment Terms",
    makeClauses: (rng, _sid) => {
      const currency = CURRENCY_NAMES[Math.floor(rng() * CURRENCY_NAMES.length)];
      const amount = (Math.floor(rng() * 50) + 10) * 10000;
      return [
        `Recipient shall pay Provider a total contract value of ${amount.toLocaleString()} ${currency}, payable in installments as specified in the payment schedule attached as Appendix B.`,
        `Payments shall be made within thirty (30) calendar days of receipt of a valid invoice, accompanied by documentation of completed milestones.`,
        `Late payments shall accrue interest at a rate of 1.5% per month, compounded monthly, from the due date until payment is received in full.`,
        `All payments shall be denominated in ${currency} and transmitted via secure deep-channel transfer protocols.`,
      ];
    },
  },
  {
    title: "Delivery and Acceptance",
    makeClauses: (rng, _sid) => {
      const region = REGION_NAMES[Math.floor(rng() * REGION_NAMES.length)];
      return [
        `All Deliverables shall be delivered to the designated site in ${region} in accordance with the project timeline.`,
        `Recipient shall have fifteen (15) business days from the date of delivery to inspect and either accept or reject each Deliverable.`,
        `Rejection must be accompanied by a written notice specifying the deficiencies. Provider shall have thirty (30) calendar days to cure any identified deficiencies at its own expense.`,
        `Acceptance of a Deliverable shall not waive Recipient's right to claim damages for latent defects discovered within twelve (12) months of acceptance.`,
      ];
    },
  },
  {
    title: "Liability and Limitation",
    makeClauses: (_rng, _sid) => [
      `Neither party shall be liable for indirect, incidental, consequential, or punitive damages arising out of or related to this Agreement, except in cases of willful misconduct or gross negligence.`,
      `Provider's total aggregate liability under this Agreement shall not exceed the total contract value specified in Section 4.`,
      `Recipient acknowledges that deep-sea infrastructure operations carry inherent risks and agrees to maintain adequate insurance coverage as specified in Section 14.`,
    ],
  },
  {
    title: "Force Majeure",
    makeClauses: (_rng, _sid) => [
      `Neither party shall be liable for failure to perform its obligations if such failure results from a Force Majeure Event as defined in Section 2.`,
      `The affected party must provide written notice within seventy-two (72) hours of becoming aware of the Force Majeure Event, describing the nature and expected duration of the event.`,
      `If a Force Majeure Event continues for more than ninety (90) consecutive days, either party may terminate this Agreement upon thirty (30) days' written notice.`,
      `During any period of Force Majeure, the affected party shall use commercially reasonable efforts to mitigate the impact and resume performance as soon as practicable.`,
    ],
  },
  {
    title: "Termination",
    makeClauses: (_rng, _sid) => [
      `Either party may terminate this Agreement for cause upon sixty (60) days' written notice if the other party commits a material breach and fails to cure such breach within the notice period.`,
      `Recipient may terminate this Agreement for convenience upon ninety (90) days' written notice, subject to payment of all amounts due for work completed and committed costs.`,
      `Upon termination, Provider shall deliver all completed and in-progress Deliverables to Recipient and provide reasonable transition assistance for a period of thirty (30) days.`,
      `Termination shall not affect accrued rights, obligations, or liabilities of either party, including Sections 6, 10, 13, and 18, which shall survive termination.`,
    ],
  },
  {
    title: "Dispute Resolution",
    makeClauses: (_rng, _sid) => [
      `The parties shall attempt to resolve any dispute arising under this Agreement through good-faith negotiation for a period of thirty (30) days.`,
      `If negotiation fails, the dispute shall be submitted to mediation administered by the Abyssal Commerce Arbitration Council (ACAC) within sixty (60) days.`,
      `If mediation fails to resolve the dispute within ninety (90) days, either party may initiate binding arbitration under the ACAC Arbitration Rules.`,
      `The arbitration shall be conducted in the Meridian Trench Zone and the decision shall be final and binding on both parties.`,
    ],
  },
  {
    title: "Confidentiality",
    makeClauses: (_rng, _sid) => [
      `Each party agrees to hold in confidence all Confidential Information received from the other party and to use such information solely for purposes of performing obligations under this Agreement.`,
      `"Confidential Information" includes technical data, business plans, financial records, trade secrets, and any information marked as confidential by the disclosing party.`,
      `The obligations of confidentiality shall survive for a period of five (5) years following termination of this Agreement.`,
      `Confidential Information does not include information that is publicly available, independently developed, or received from a third party without obligation of confidentiality.`,
    ],
  },
  {
    title: "Intellectual Property Rights",
    makeClauses: (_rng, _sid) => [
      `All pre-existing intellectual property brought to this Agreement by either party shall remain the property of that party.`,
      `Intellectual property created jointly during the performance of this Agreement shall be jointly owned, and each party shall have the right to use, license, and sublicense such property without the consent of the other party.`,
      `Provider grants Recipient a perpetual, non-exclusive, royalty-free license to use any Provider intellectual property incorporated into the Deliverables.`,
      `Neither party shall reverse-engineer, decompile, or otherwise attempt to derive the trade secrets of the other party.`,
    ],
  },
  {
    title: "Warranties",
    makeClauses: (rng, _sid) => {
      const months = Math.floor(rng() * 12) + 12;
      return [
        `Provider warrants that all Deliverables shall conform to the specifications in Appendix A and shall be free from defects in materials and workmanship for a period of ${months} months from the date of acceptance.`,
        `Provider further warrants that all services shall be performed in a professional and workmanlike manner consistent with industry standards for deep-sea infrastructure.`,
        `EXCEPT AS EXPRESSLY SET FORTH HEREIN, PROVIDER MAKES NO OTHER WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE.`,
        `Recipient's sole remedy for breach of warranty shall be repair or replacement of the defective Deliverable at Provider's expense.`,
      ];
    },
  },
  {
    title: "Indemnification",
    makeClauses: (_rng, _sid) => [
      `Provider shall indemnify, defend, and hold harmless Recipient against any third-party claims arising from Provider's negligence, willful misconduct, or breach of this Agreement.`,
      `Recipient shall indemnify, defend, and hold harmless Provider against any third-party claims arising from Recipient's use of Deliverables in a manner not contemplated by this Agreement.`,
      `The indemnifying party's obligations are contingent upon prompt written notice of the claim, sole control of the defense, and reasonable cooperation by the indemnified party.`,
    ],
  },
  {
    title: "Insurance",
    makeClauses: (rng, _sid) => {
      const currency = CURRENCY_NAMES[Math.floor(rng() * CURRENCY_NAMES.length)];
      return [
        `Provider shall maintain comprehensive general liability insurance with coverage of not less than 5,000,000 ${currency} per occurrence throughout the term of this Agreement.`,
        `Provider shall also maintain professional liability insurance, workers' compensation insurance, and environmental liability insurance as required by applicable law.`,
        `Certificates of insurance shall be provided to Recipient within ten (10) business days of the Effective Date and upon each policy renewal.`,
      ];
    },
  },
  {
    title: "Regulatory Compliance",
    makeClauses: (_rng, _sid) => [
      `Both parties shall comply with all applicable laws, regulations, and ordinances governing deep-sea commercial operations, including environmental protection statutes.`,
      `Provider shall obtain and maintain all permits, licenses, and approvals required for the performance of work under this Agreement.`,
      `Recipient shall be responsible for obtaining any permits required for the operation and use of completed infrastructure modules.`,
      `Both parties shall cooperate with regulatory inspections and audits and shall promptly notify the other party of any regulatory action that may affect performance under this Agreement.`,
    ],
  },
  {
    title: "Amendments and Modifications",
    makeClauses: (_rng, _sid) => [
      `This Agreement may be amended only by a written instrument signed by authorized representatives of both parties.`,
      `No oral modification, waiver, or amendment shall be binding upon either party.`,
      `Amendments shall be sequentially numbered and attached to this Agreement as supplementary appendices.`,
    ],
  },
  {
    title: "Notices",
    makeClauses: (_rng, _sid) => [
      `All notices under this Agreement shall be in writing and delivered via encrypted deep-channel transmission, registered courier, or hand delivery to the addresses specified in Appendix C.`,
      `Notices shall be deemed received on the date of transmission confirmation for deep-channel transmissions, or upon actual receipt for physical delivery.`,
      `Either party may change its notice address by providing written notice to the other party at least fifteen (15) days in advance.`,
    ],
  },
  {
    title: "Governing Law",
    makeClauses: (_rng, _sid) => [
      `This Agreement shall be governed by and construed in accordance with the Abyssal Commercial Code and the Convention on Deep-Sea Trade Relations.`,
      `The parties consent to the exclusive jurisdiction of the Abyssal Commerce Tribunal for any actions not subject to arbitration under Section 9.`,
      `The provisions of this Agreement shall be interpreted in a manner consistent with international deep-sea commerce practices and customs.`,
    ],
  },
  {
    title: "Severability",
    makeClauses: (_rng, _sid) => [
      `If any provision of this Agreement is found to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.`,
      `The invalid or unenforceable provision shall be modified to the minimum extent necessary to make it valid and enforceable while preserving the parties' original intent.`,
      `If modification is not possible, the provision shall be severed and the Agreement shall be construed as if such provision had never been included.`,
    ],
  },
  {
    title: "Entire Agreement",
    makeClauses: (_rng, _sid) => [
      `This Agreement, together with all appendices and amendments, constitutes the entire agreement between the parties and supersedes all prior negotiations, representations, and agreements.`,
      `No course of dealing or usage of trade shall be used to modify, supplement, or explain any term of this Agreement.`,
      `Each party acknowledges that it has not relied upon any representation or statement not set forth in this Agreement.`,
    ],
  },
  {
    title: "Assignment and Transfer",
    makeClauses: (_rng, _sid) => [
      `Neither party may assign or transfer this Agreement or any rights hereunder without the prior written consent of the other party, which consent shall not be unreasonably withheld.`,
      `Notwithstanding the foregoing, either party may assign this Agreement to an affiliate or in connection with a merger, acquisition, or sale of substantially all of its assets.`,
      `Any purported assignment in violation of this Section shall be null and void.`,
    ],
  },
  {
    title: "Subcontracting",
    makeClauses: (_rng, _sid) => [
      `Provider may subcontract portions of the work with Recipient's prior written approval, which shall not be unreasonably delayed.`,
      `Provider shall remain fully responsible for the performance of any subcontractor and shall ensure that subcontractors comply with the terms of this Agreement.`,
      `Subcontracting shall not relieve Provider of any obligations, warranties, or liabilities under this Agreement.`,
    ],
  },
  {
    title: "Audit Rights",
    makeClauses: (_rng, _sid) => [
      `Recipient shall have the right to audit Provider's records, accounts, and facilities related to this Agreement upon reasonable notice during normal business hours.`,
      `Provider shall maintain complete and accurate records of all work performed, costs incurred, and materials used for a period of three (3) years following completion.`,
      `If an audit reveals overcharges exceeding five percent (5%) of total billings, Provider shall bear the cost of the audit in addition to refunding the overcharged amounts.`,
    ],
  },
  {
    title: "Performance Standards",
    makeClauses: (rng, _sid) => {
      const threshold = Math.floor(rng() * 3) + 95;
      return [
        `All infrastructure modules shall meet or exceed a structural integrity rating of ${threshold}% as measured by the Abyssal Engineering Standards Board (AESB) testing protocols.`,
        `Provider shall implement a quality management system certified to Abyssal Standard 9001 and shall submit quarterly quality reports to Recipient.`,
        `Failure to meet Performance Thresholds for two (2) consecutive reporting periods shall constitute a material breach of this Agreement.`,
      ];
    },
  },
  {
    title: "Penalties and Liquidated Damages",
    makeClauses: (rng, _sid) => {
      const currency = CURRENCY_NAMES[Math.floor(rng() * CURRENCY_NAMES.length)];
      const dailyPenalty = Math.floor(rng() * 5000) + 1000;
      return [
        `For each calendar day of delay beyond the scheduled delivery date, Provider shall pay liquidated damages of ${dailyPenalty.toLocaleString()} ${currency} per day, up to a maximum of ten percent (10%) of the total contract value.`,
        `Liquidated damages represent a genuine pre-estimate of Recipient's losses and are not intended as a penalty.`,
        `Provider may request a waiver of liquidated damages if delay is caused by circumstances beyond Provider's reasonable control, subject to Section 7.`,
      ];
    },
  },
  {
    title: "Environmental Obligations",
    makeClauses: (_rng, _sid) => [
      `Provider shall conduct all operations in compliance with the Abyssal Environmental Protection Accord and shall minimize disturbance to deep-sea ecosystems.`,
      `An environmental impact assessment shall be completed and submitted to Recipient prior to commencement of any physical work at the deployment site.`,
      `Provider shall implement a waste management plan that ensures zero discharge of hazardous materials into the marine environment.`,
      `In the event of an environmental incident, Provider shall immediately notify Recipient and relevant regulatory authorities and shall take all necessary remedial actions at its own expense.`,
    ],
  },
  {
    title: "Labor Standards",
    makeClauses: (_rng, _sid) => [
      `Provider shall comply with all applicable labor laws and regulations, including those governing working hours, minimum compensation, and occupational safety.`,
      `Provider shall not employ forced labor, child labor, or engage in any form of human trafficking in connection with this Agreement.`,
      `Provider shall maintain safe working conditions and provide all necessary protective equipment for personnel operating in deep-sea environments.`,
    ],
  },
  {
    title: "Data Protection",
    makeClauses: (_rng, _sid) => [
      `Each party shall process personal data in accordance with the Abyssal Data Protection Regulation (ADPR) and any applicable data protection laws.`,
      `Provider shall implement appropriate technical and organizational measures to protect personal data against unauthorized access, loss, or destruction.`,
      `In the event of a data breach, the affected party shall notify the other party within forty-eight (48) hours and shall cooperate in any investigation or remediation.`,
      `Upon termination of this Agreement, Provider shall securely delete or return all personal data processed on behalf of Recipient within thirty (30) days.`,
    ],
  },
  {
    title: "Reporting Requirements",
    makeClauses: (_rng, _sid) => [
      `Provider shall submit monthly progress reports to Recipient detailing work completed, milestones achieved, issues encountered, and projected timeline for remaining work.`,
      `Quarterly financial reports shall include a detailed breakdown of costs incurred, invoices issued, and payments received.`,
      `Provider shall immediately notify Recipient of any event that may materially affect the cost, timeline, or quality of Deliverables.`,
    ],
  },
  {
    title: "Term and Renewal",
    makeClauses: (rng, _sid) => {
      const years = Math.floor(rng() * 3) + 2;
      return [
        `This Agreement shall commence on the Effective Date and shall remain in force for a period of ${years} years unless earlier terminated in accordance with Section 8.`,
        `The Agreement may be renewed for successive one (1) year periods upon mutual written agreement of both parties, executed at least sixty (60) days prior to the expiration of the then-current term.`,
        `Terms and conditions for renewal periods shall be negotiated in good faith, taking into account prevailing market conditions and performance history.`,
      ];
    },
  },
];

// ── Issue planting functions ────────────────────────────────────────

type IssueType = ContractIssue["type"];

interface IssuePlanter {
  type: IssueType;
  plant: (sections: ContractSection[], definitions: DefinedTerm[], rng: () => number, issueIdx: number, seed: number) => ContractIssue | null;
}

const issuePlanters: IssuePlanter[] = [
  {
    type: "inconsistency",
    plant: (sections, _definitions, rng, issueIdx, seed) => {
      // Pick two sections and make the same term mean different things
      const termPairs = [
        { term: "Effective Date", defA: "the date of last signature", defB: "the date of first payment" },
        { term: "business days", defA: "Monday through Friday, excluding public holidays", defB: "any day on which commercial operations are conducted, including weekends" },
        { term: "material breach", defA: "a breach that substantially deprives the other party of the benefit of this Agreement", defB: "any failure to perform a contractual obligation within the specified timeframe" },
      ];
      const pair = termPairs[Math.floor(rng() * termPairs.length)];
      const validSections = sections.filter(s => s.clauses.length >= 2);
      if (validSections.length < 2) return null;

      const idxA = Math.floor(rng() * validSections.length);
      let idxB = Math.floor(rng() * validSections.length);
      if (idxB === idxA) idxB = (idxA + 1) % validSections.length;
      const secA = validSections[idxA];
      const secB = validSections[idxB];

      const clauseIdxA = Math.floor(rng() * secA.clauses.length);
      secA.clauses[clauseIdxA] += ` For purposes of this section, "${pair.term}" shall mean ${pair.defA}.`;

      const clauseIdxB = Math.floor(rng() * secB.clauses.length);
      secB.clauses[clauseIdxB] += ` For purposes of this section, "${pair.term}" shall mean ${pair.defB}.`;

      return {
        id: `issue-${seed}-${issueIdx}`,
        type: "inconsistency",
        section_ids: [secA.id, secB.id],
        description: `The term "${pair.term}" is defined inconsistently: "${pair.defA}" in ${secA.title} vs "${pair.defB}" in ${secB.title}.`,
        severity: "high",
      };
    },
  },
  {
    type: "undefined_term",
    plant: (sections, definitions, rng, issueIdx, seed) => {
      const undefinedTerms = [
        { term: "Qualified Personnel", usage: "All work shall be performed by Qualified Personnel with appropriate certifications." },
        { term: "Critical Infrastructure", usage: "Provider shall prioritize maintenance of Critical Infrastructure above all other obligations." },
        { term: "Emergency Protocol", usage: "In the event of system failure, the Emergency Protocol shall be activated immediately." },
        { term: "Acceptable Deviation", usage: "Minor variations within the Acceptable Deviation range shall not constitute a defect." },
      ];
      const selected = undefinedTerms[Math.floor(rng() * undefinedTerms.length)];
      const definedTermNames = definitions.map(d => d.term.toLowerCase());
      if (definedTermNames.includes(selected.term.toLowerCase())) return null;

      const validSections = sections.filter(s => s.title !== "Definitions" && s.clauses.length >= 1);
      if (validSections.length === 0) return null;
      const sec = validSections[Math.floor(rng() * validSections.length)];
      sec.clauses.push(selected.usage);

      return {
        id: `issue-${seed}-${issueIdx}`,
        type: "undefined_term",
        section_ids: [sec.id],
        description: `The term "${selected.term}" is used in ${sec.title} but is not defined in the Definitions section.`,
        severity: "medium",
      };
    },
  },
  {
    type: "contradiction",
    plant: (sections, _definitions, rng, issueIdx, seed) => {
      const contradictions = [
        {
          clauseA: "Termination for convenience requires ninety (90) days' written notice.",
          clauseB: "Either party may terminate this Agreement immediately upon thirty (30) days' written notice for any reason.",
          desc: "Contradictory termination notice periods: 90 days for convenience vs 30 days for any reason.",
        },
        {
          clauseA: "All disputes shall be resolved exclusively through binding arbitration.",
          clauseB: "Either party may commence litigation in any court of competent jurisdiction to enforce its rights under this Agreement.",
          desc: "Contradiction between exclusive arbitration and right to litigate.",
        },
        {
          clauseA: "Provider shall not subcontract any portion of the work without prior written approval.",
          clauseB: "Provider may freely engage subcontractors for non-critical components without prior notification.",
          desc: "Contradiction regarding subcontracting: requires approval vs freely permitted for non-critical work.",
        },
      ];
      const selected = contradictions[Math.floor(rng() * contradictions.length)];
      const validSections = sections.filter(s => s.title !== "Definitions" && s.clauses.length >= 1);
      if (validSections.length < 2) return null;

      const idxA = Math.floor(rng() * validSections.length);
      let idxB = Math.floor(rng() * validSections.length);
      if (idxB === idxA) idxB = (idxA + 1) % validSections.length;
      const secA = validSections[idxA];
      const secB = validSections[idxB];

      secA.clauses.push(selected.clauseA);
      secB.clauses.push(selected.clauseB);

      return {
        id: `issue-${seed}-${issueIdx}`,
        type: "contradiction",
        section_ids: [secA.id, secB.id],
        description: `${selected.desc} (${secA.title} vs ${secB.title})`,
        severity: "high",
      };
    },
  },
  {
    type: "missing_cross_reference",
    plant: (sections, _definitions, rng, issueIdx, seed) => {
      const phantomSections = ["Section 35", "Section 42", "Section 38", "Appendix F", "Schedule D"];
      const phantom = phantomSections[Math.floor(rng() * phantomSections.length)];
      const validSections = sections.filter(s => s.title !== "Definitions" && s.clauses.length >= 1);
      if (validSections.length === 0) return null;
      const sec = validSections[Math.floor(rng() * validSections.length)];
      sec.clauses.push(`The procedures specified in ${phantom} shall apply to all remedial actions under this section.`);

      return {
        id: `issue-${seed}-${issueIdx}`,
        type: "missing_cross_reference",
        section_ids: [sec.id],
        description: `${sec.title} references ${phantom}, which does not exist in this Agreement.`,
        severity: "medium",
      };
    },
  },
  {
    type: "ambiguous_clause",
    plant: (sections, _definitions, rng, issueIdx, seed) => {
      const ambiguousClauses = [
        {
          text: "Provider shall deliver results in a timely manner consistent with reasonable expectations.",
          desc: 'The phrase "timely manner consistent with reasonable expectations" is ambiguous and lacks measurable criteria.',
        },
        {
          text: "Compensation adjustments shall be made as appropriate based on market conditions and other relevant factors.",
          desc: 'The phrase "as appropriate based on market conditions and other relevant factors" is vague and provides no objective standard.',
        },
        {
          text: "Either party may request modifications to the scope of work, which shall be considered in good faith and implemented where practicable.",
          desc: 'The terms "considered in good faith" and "where practicable" are subjective and do not establish binding obligations.',
        },
        {
          text: "Provider shall allocate sufficient resources to ensure satisfactory progress toward project completion.",
          desc: 'The terms "sufficient resources" and "satisfactory progress" are undefined and open to interpretation.',
        },
      ];
      const selected = ambiguousClauses[Math.floor(rng() * ambiguousClauses.length)];
      const validSections = sections.filter(s => s.title !== "Definitions" && s.clauses.length >= 1);
      if (validSections.length === 0) return null;
      const sec = validSections[Math.floor(rng() * validSections.length)];
      sec.clauses.push(selected.text);

      return {
        id: `issue-${seed}-${issueIdx}`,
        type: "ambiguous_clause",
        section_ids: [sec.id],
        description: `In ${sec.title}: ${selected.desc}`,
        severity: "low",
      };
    },
  },
];

// ── Main generator ──────────────────────────────────────────────────

export function generateContractData(seed: number): ContractData {
  const rng = mulberry32(seed);

  // Shuffle and select 30 section templates
  const shuffled = [...sectionTemplates];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const selectedTemplates = shuffled.slice(0, 30);

  // Always ensure Definitions is included as Section 2
  const defsIdx = selectedTemplates.findIndex(t => t.title === "Definitions");
  if (defsIdx === -1) {
    // Replace position 1 with Definitions
    const defsTemplate = sectionTemplates.find(t => t.title === "Definitions")!;
    selectedTemplates[1] = defsTemplate;
  } else if (defsIdx !== 1) {
    [selectedTemplates[1], selectedTemplates[defsIdx]] = [selectedTemplates[defsIdx], selectedTemplates[1]];
  }

  // Always ensure Parties is Section 1
  const partiesIdx = selectedTemplates.findIndex(t => t.title === "Parties and Recitals");
  if (partiesIdx === -1) {
    const partiesTemplate = sectionTemplates.find(t => t.title === "Parties and Recitals")!;
    selectedTemplates[0] = partiesTemplate;
  } else if (partiesIdx !== 0) {
    [selectedTemplates[0], selectedTemplates[partiesIdx]] = [selectedTemplates[partiesIdx], selectedTemplates[0]];
  }

  // Generate sections
  const sections: ContractSection[] = [];
  for (let i = 0; i < selectedTemplates.length; i++) {
    const tmpl = selectedTemplates[i];
    const sectionId = `section-${i + 1}`;
    const clauses = tmpl.makeClauses(rng, sectionId);
    sections.push({ id: sectionId, title: tmpl.title, clauses });
  }

  // Extract definitions from the Definitions section
  const defsSection = sections.find(s => s.title === "Definitions")!;
  const definitions: DefinedTerm[] = [];
  for (const clause of defsSection.clauses) {
    const match = clause.match(/^"([^"]+)"\s+means\s+/);
    if (match) {
      definitions.push({
        term: match[1],
        definition: clause,
        section_id: defsSection.id,
      });
    }
  }

  // Plant 10 issues using a rotating set of issue planters
  const issues: ContractIssue[] = [];
  // Desired distribution: 2 inconsistencies, 2 undefined_terms, 2 contradictions, 2 missing_cross_references, 2 ambiguous_clauses
  const plantOrder: IssueType[] = [
    "inconsistency", "undefined_term", "contradiction", "missing_cross_reference", "ambiguous_clause",
    "inconsistency", "contradiction", "undefined_term", "missing_cross_reference", "ambiguous_clause",
  ];

  let issueIdx = 0;
  for (const desiredType of plantOrder) {
    const planter = issuePlanters.find(p => p.type === desiredType)!;
    const issue = planter.plant(sections, definitions, rng, issueIdx, seed);
    if (issue) {
      issues.push(issue);
      issueIdx++;
    }
  }

  const objective =
    "Review the Abyssal Trade & Infrastructure Agreement, a 30-section contract. " +
    "Identify all issues including inconsistencies, undefined terms, contradictions, " +
    "missing cross-references, and ambiguous clauses. For each issue, specify the type, " +
    "the section(s) involved, and a description of the problem. " +
    "The workspace contains section files under contract/ and a definitions.json file.";

  return {
    sections,
    definitions,
    groundTruth: {
      issues,
      total_sections: sections.length,
    },
    objective,
  };
}
