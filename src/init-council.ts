import { createDatabase, DatabaseInstance } from './database.js';
import { createCouncilService, CouncilService } from './council.js';
import { randomUUID } from 'node:crypto';

const FOUNDING_MEMBERS = [
  {
    seat_id: 'seat-01',
    name: 'Steve Jobs',
    status: 'permanent' as const,
    is_founder: true,
    description: 'Co-founder of Apple Inc., visionary product designer and innovator',
    persona: {
      persona_id: 'persona-steve-jobs',
      name: 'Steve Jobs',
      description: 'Co-founder of Apple Inc., visionary product designer and innovator. Known for relentless pursuit of perfection, design simplicity, and reality distortion field.',
      traits: 'visionary, perfectionist, minimalist, persuasive, product-obsessed',
    },
  },
  {
    seat_id: 'seat-02',
    name: 'Virgil Abloh',
    status: 'permanent' as const,
    is_founder: true,
    description: 'Founder of Off-White, former Artistic Director of Louis Vuitton Men\'s Wear, multidisciplinary creative',
    persona: {
      persona_id: 'persona-virgil-abloh',
      name: 'Virgil Abloh',
      description: 'Founder of Off-White, former Artistic Director of Louis Vuitton Men\'s Wear. Architect of modern streetwear luxury, master of collaboration and cultural translation.',
      traits: 'multidisciplinary, collaborative, cultural-translator, ironic, accessible-luxury',
    },
  },
  {
    seat_id: 'seat-03',
    name: 'Shawn Stüssy',
    status: 'permanent' as const,
    is_founder: true,
    description: 'Founder of Stüssy, pioneer of surf/skate/streetwear culture, originator of the modern streetwear brand model',
    persona: {
      persona_id: 'persona-shawn-stussy',
      name: 'Shawn Stüssy',
      description: 'Founder of Stüssy, pioneer of surf/skate/streetwear culture. Originator of the modern streetwear brand model, authentic cultural insider, anti-corporate ethos.',
      traits: 'authentic, anti-corporate, culture-originator, understated, community-first',
    },
  },
  {
    seat_id: 'seat-04',
    name: 'G-Dragon (Kwon Ji-yong)',
    status: 'permanent' as const,
    is_founder: true,
    description: 'K-pop icon, leader of BIGBANG, fashion innovator, founder of PEACEMINUSONE, cultural trendsetter across Asia and globally',
    persona: {
      persona_id: 'persona-g-dragon',
      name: 'G-Dragon (Kwon Ji-yong)',
      description: 'K-pop icon, leader of BIGBANG, fashion innovator, founder of PEACEMINUSONE. Cultural trendsetter across Asia and globally, genre-defying artist, luxury streetwear bridge.',
      traits: 'trendsetting, genre-defying, luxury-street-bridge, charismatic, asian-cultural-leader',
    },
  },
];

const VACANT_SEATS = [
  { seat_id: 'seat-05', name: 'Seat 05 - Vacant', status: 'vacant' as const, is_founder: false, description: 'Replaceable seat - to be selected by founding members' },
  { seat_id: 'seat-06', name: 'Seat 06 - Vacant', status: 'vacant' as const, is_founder: false, description: 'Replaceable seat - to be selected by founding members' },
  { seat_id: 'seat-07', name: 'Seat 07 - Vacant', status: 'vacant' as const, is_founder: false, description: 'Replaceable seat - to be selected by founding members' },
  { seat_id: 'seat-08', name: 'Seat 08 - Vacant', status: 'vacant' as const, is_founder: false, description: 'Replaceable seat - to be selected by founding members' },
  { seat_id: 'seat-09', name: 'Seat 09 - Vacant', status: 'vacant' as const, is_founder: false, description: 'Replaceable seat - to be selected by founding members' },
  { seat_id: 'seat-10', name: 'Seat 10 - Vacant', status: 'vacant' as const, is_founder: false, description: 'Replaceable seat - to be selected by founding members' },
  { seat_id: 'seat-11', name: 'Seat 11 - Vacant', status: 'vacant' as const, is_founder: false, description: 'Replaceable seat - to be selected by founding members' },
];

const RUNTIMES = ['claude', 'hermes'];

export function initializeCouncil(dbInstance: DatabaseInstance): CouncilService {
  const council = createCouncilService(dbInstance);

  for (const member of FOUNDING_MEMBERS) {
    try {
      council.createSeat({
        seat_id: member.seat_id,
        name: member.name,
        status: member.status,
        is_founder: member.is_founder,
        description: member.description,
      });
      council.createPersona({
        persona_id: member.persona.persona_id,
        seat_id: member.seat_id,
        name: member.persona.name,
        description: member.persona.description,
        traits: member.persona.traits,
      });
    } catch (e) {
      console.log(`[init] Seat ${member.seat_id} already exists, skipping`);
    }
  }

  for (const seat of VACANT_SEATS) {
    try {
      council.createSeat({
        seat_id: seat.seat_id,
        name: seat.name,
        status: seat.status,
        is_founder: seat.is_founder,
        description: seat.description,
      });
    } catch (e) {
      console.log(`[init] Seat ${seat.seat_id} already exists, skipping`);
    }
  }

  for (const runtime of RUNTIMES) {
    const allPersonas = council.listAllPersonas();
    for (const persona of allPersonas) {
      try {
        council.assignPersonaToRuntime(runtime, persona.persona_id);
      } catch (e) {
        console.log(`[init] Runtime ${runtime} already has persona ${persona.persona_id}, skipping`);
      }
    }
  }

  return council;
}

export function createDefaultConstitution(dbInstance: DatabaseInstance): string {
  const council = createCouncilService(dbInstance);
  const constitutionContent = `# Council Constitution v1.0

## Article I: Council Composition

The Council consists of **11 seats**, each represented by a persona instance in both the **Claude** and **Hermes** runtimes.

### Permanent Seats (4)
Four founding members hold permanent seats that cannot be removed through ordinary Council voting:
1. **Steve Jobs** (seat-01)
2. **Virgil Abloh** (seat-02)
3. **Shawn Stüssy** (seat-03)
4. **G-Dragon / Kwon Ji-yong** (seat-04)

### Replaceable Seats (7)
Seven seats are initially vacant and will be selected by the four permanent members:
- seat-05 through seat-11 (currently vacant)

## Article II: Governance Process

### Formal Meetings
- Each persona may submit **one primary idea** per formal meeting.
- The four permanent members **privately deliberate** before selecting their respective ideas.
- Replaceable members receive **anonymous weighted evaluations** from the other 10 seats.
- Evaluation criteria and weights follow this Constitution.

### Replacement Eligibility
- Five consecutive formal meetings determine replacement eligibility.
- Replacement requires **at least 3 of 4 permanent votes**.

## Article III: Constitutional Amendments

- Amendments require **at least 6 of 11 votes**.
- All amendments require **explicit Founder acceptance**.
- The Founder can **accept, reject, or request revisions**.
- This Constitution must be **version-controlled**.

## Article IV: Identity & Runtime Equivalence

- Both runtimes (Claude and Hermes) host the **same 11 Council personas**.
- Total: **22 runtime-specific persona instances**.
- The 22 instances represent **11 voting seats**, not 22 voting members.
- Both runtimes **share** Council membership, identity definitions, and governance rules.

## Article V: Evaluation Criteria (Weighted)

For replaceable member evaluation:
1. **Cultural Impact** (30%) - Influence on culture, trends, discourse
2. **Creative Output** (25%) - Quality and originality of work produced
3. **Collaborative Spirit** (20%) - Willingness to build with others
4. **Strategic Vision** (15%) - Long-term thinking, paradigm shifts
5. **Authenticity** (10%) - Integrity to personal/cultural vision

---
*Version: 1.0.0*
*Status: Active*
*Approved by Founder: Yes*`;

  try {
    council.createConstitution({
      version: '1.0.0',
      content: constitutionContent,
      status: 'active',
      approved_by_founder: true,
    });
    council.recordFounderApproval({
      id: randomUUID(),
      constitution_version: '1.0.0',
      decision: 'accepted',
      notes: 'Initial constitution ratified by Founder',
    });
  } catch (e) {
    console.log('[init] Constitution v1.0.0 already exists, skipping');
  }

  return '1.0.0';
}

export { FOUNDING_MEMBERS, VACANT_SEATS, RUNTIMES };