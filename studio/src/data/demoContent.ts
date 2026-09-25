/**
 * Demo content for Canis Notes: student pad text and premade worksheets.
 * Use for demos, testing, or seeding the app.
 */

// —— Student pad text (copy into regular notes for a “student” demo) ——

export const STUDENT_PAD_TEXTS = {
  classNotes:
    `# Biology — Cell Division

**Mitosis** has 4 phases:
1. Prophase – chromosomes condense
2. Metaphase – line up at equator
3. Anaphase – sister chromatids separate
4. Telophase – two nuclei form

*Remember: PMAT for the order.*`,

  reminders:
    `# This week
- [ ] Finish Math worksheet (due Friday)
- [ ] Read Ch. 5 for English
- [ ] Lab report – hand in by Tuesday`,

  quickNote:
    `**Vocabulary**
- **Photosynthesis**: plants make sugar from CO₂ + water + light
- **Respiration**: cells break down sugar for energy (ATP)`,

  revision:
    `# Essay draft – topic sentence

"The main reason the character changes is because of the conflict with her family."

*Need to add a quote from Ch. 3 to support this.*`,
} as const;

// —— Premade worksheets (full content with ---worksheet--- marker) ——

export const DEMO_WORKSHEETS = {
  /** Fractions & decimals – Math */
  mathFractions: {
    title: '📐 Fractions and Decimals',
    content: `---worksheet---

# Fractions and Decimals

<task>
## Question 1

Convert the fraction **3/4** into a decimal. Show your working (divide numerator by denominator).
</task>

<long-input />

<task>
## Question 2

Write the decimal **0.6** as a fraction in its simplest form.
</task>

<short-input />

<task>
## Question 3

Put these in order from smallest to largest: 0.25 , 1/3 , 0.5 , 2/5

Explain briefly how you compared them.
</task>

<long-input />
`,
  },

  /** Reading comprehension */
  readingComprehension: {
    title: '📖 Reading Check — The Great Fire',
    content: `---worksheet---

# The Great Fire (London, 1666)

<task>
## Question 1

In one or two sentences, what was the main cause of the fire spreading so quickly through London?
</task>

<long-input />

<task>
## Question 2

Name **two** ways the fire was finally stopped.
</task>

<input />

<task>
## Question 3

How did the fire change the way London was rebuilt? Give at least one example.
</task>

<long-input />
`,
  },

  /** Science – states of matter */
  scienceStatesOfMatter: {
    title: '🔬 States of Matter',
    content: `---worksheet---

# States of Matter

<task>
## Question 1

Name the three states of matter and give **one** example of a substance in each state (e.g. water can be ice, liquid water, or steam).
</task>

<long-input />

<task>
## Question 2

When we heat a solid until it becomes a liquid, what is this process called?
</task>

<short-input />

<task>
## Question 3

Describe one way the particles in a **gas** are different from the particles in a **solid**. (Think about movement and spacing.)
</task>

<long-input />
`,
  },

  /** Short mixed quiz style */
  quickQuiz: {
    title: '✏️ Quick Quiz — Vocabulary',
    content: `---worksheet---

# Vocabulary Check

<task>
What is the meaning of **biodiversity**?
</task>

<short-input />

<task>
Use the word **hypothesis** in a sentence about an experiment.
</task>

<long-input />

<task>
What is the opposite of **expand**? (One word.)
</task>

<short-input />
`,
  },
} as const;

/** All demo worksheet keys */
export type DemoWorksheetKey = keyof typeof DEMO_WORKSHEETS;

/** One demo "bundle": a few student pads + one or more worksheets, for easy seeding */
export const DEMO_BUNDLE = {
  studentPads: [
    { title: 'Biology — Cell Division', content: STUDENT_PAD_TEXTS.classNotes },
    { title: 'This week', content: STUDENT_PAD_TEXTS.reminders },
    { title: 'Vocabulary', content: STUDENT_PAD_TEXTS.quickNote },
  ],
  worksheets: [
    { title: DEMO_WORKSHEETS.mathFractions.title, content: DEMO_WORKSHEETS.mathFractions.content, padType: 'worksheet' as const },
    { title: DEMO_WORKSHEETS.readingComprehension.title, content: DEMO_WORKSHEETS.readingComprehension.content, padType: 'worksheet' as const },
    { title: DEMO_WORKSHEETS.scienceStatesOfMatter.title, content: DEMO_WORKSHEETS.scienceStatesOfMatter.content, padType: 'worksheet' as const },
  ],
} as const;

// —— Seed helper (creates pads via API for demo) ——

export interface SeedDemoResult {
  noteIds: string[];
  error?: string;
}

/**
 * Create demo student pads and premade worksheets in the app.
 * Call this after login (uses current user's api). Returns created note IDs.
 */
export async function seedDemoPads(api: {
  createNote: (note: { title: string; content: string; padType?: 'note' | 'worksheet' }) => Promise<{ id: string }>;
}): Promise<SeedDemoResult> {
  const noteIds: string[] = [];
  try {
    for (const pad of DEMO_BUNDLE.studentPads) {
      const note = await api.createNote({ title: pad.title, content: pad.content });
      noteIds.push(note.id);
    }
    for (const ws of DEMO_BUNDLE.worksheets) {
      const note = await api.createNote({
        title: ws.title,
        content: ws.content,
        padType: 'worksheet',
      });
      noteIds.push(note.id);
    }
    return { noteIds };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { noteIds, error };
  }
}
