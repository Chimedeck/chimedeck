// Sprint 176 — Generate sprint artifacts module.
// [why] Takes the refined requirement packet and context snapshot, then
// generates sprint plan updates, sprint-<n>.md files with EARS requirements,
// acceptance criteria, dependencies, and test sections.
// Also creates/updates request changelog entries.
// Follows the aiEditOrchestrator pipeline pattern — each output is a
// structured artifact with well-defined sections.
import { resolveTierPolicy } from '../tierPolicy';
import { createFile } from '../../../aiEditOrchestrator/mods/fileCreator';
import { editFile } from '../../../aiEditOrchestrator/mods/fileEditor';
import type {
  GenerateArtifactsInput,
  GenerateArtifactsOutput,
  SprintArtifact,
  RequirementPacket,
  ContextSnapshotSummary,
} from '../../types';
import { ALLOWED_OUTPUT_PATHS } from '../../common/config';

export const generateArtifactsDeps = {
  resolveTierPolicy,
  createFile,
  editFile,
  /** Get the current max sprint number from sprint-plan.md. */
  getMaxSprintNumber: async (): Promise<number> => {
    try {
      const file = Bun.file('specs/sprints/sprint-plan.md');
      if (!(await file.exists())) return 0;
      const content = await file.text();
      // Extract sprint numbers from lines like "### Sprint 1:", "### Sprint 2:", etc.
      const matches = content.matchAll(/###\s+Sprint\s+(\d+)/gi);
      let max = 0;
      for (const m of matches) {
        const num = parseInt(m[1]!, 10);
        if (num > max) max = num;
      }
      return max;
    } catch {
      return 0;
    }
  },
};

/**
 * Decompose a requirement into sprint-sized chunks.
 * [why] Each sprint gets a subset of EARS requirements and acceptance criteria.
 * We distribute evenly — larger requirements get split across more sprints.
 */
function decomposeIntoSprints(
  packet: RequirementPacket,
  sprintCount: number
): Array<{
  sprintNumber: number;
  title: string;
  requirements: string[];
  acceptanceCriteria: string[];
  testScenarios: string[];
  dependencies: number[];
}> {
  const sprints: Array<{
    sprintNumber: number;
    title: string;
    requirements: string[];
    acceptanceCriteria: string[];
    testScenarios: string[];
    dependencies: number[];
  }> = [];

  // Distribute EARS requirements evenly
  const reqsPerSprint = Math.ceil(packet.earsRequirements.length / sprintCount);
  const acPerSprint = Math.ceil(packet.acceptanceCriteria.length / sprintCount);

  for (let i = 0; i < sprintCount; i++) {
    const startReq = i * reqsPerSprint;
    const endReq = Math.min(startReq + reqsPerSprint, packet.earsRequirements.length);
    const startAc = i * acPerSprint;
    const endAc = Math.min(startAc + acPerSprint, packet.acceptanceCriteria.length);

    const sprintReqs = packet.earsRequirements.slice(startReq, endReq);
    const sprintAc = packet.acceptanceCriteria.slice(startAc, endAc);

    // Generate test scenarios from acceptance criteria
    const testScenarios = sprintAc.map((ac) => {
      const clean = ac.replace(/^[-*]\s*/, '');
      return `- **Test**: Verify that ${clean.charAt(0).toLowerCase() + clean.slice(1)}`;
    });

    // Each sprint depends on the previous one (sequential decomposition)
    const dependencies = i > 0 ? [i] : []; // sprint numbers are 1-based, so sprint 2 depends on sprint 1

    sprints.push({
      sprintNumber: i + 1,
      title:
        sprintCount === 1 ? packet.cardTitle : `${packet.cardTitle} — Part ${i + 1}/${sprintCount}`,
      requirements: sprintReqs.length > 0 ? sprintReqs : packet.earsRequirements,
      acceptanceCriteria: sprintAc.length > 0 ? sprintAc : packet.acceptanceCriteria,
      testScenarios,
      dependencies,
    });
  }

  return sprints;
}

/**
 * Build a sprint spec markdown document for a given sprint.
 */
function buildSprintSpec({
  sprint,
  packet,
  sprintPlanUpdated,
}: {
  sprint: {
    sprintNumber: number;
    title: string;
    requirements: string[];
    acceptanceCriteria: string[];
    testScenarios: string[];
    dependencies: number[];
  };
  packet: RequirementPacket;
  sprintPlanUpdated: boolean;
}): string {
  const lines: string[] = [
    `# Sprint ${sprint.sprintNumber}: ${sprint.title}`,
    '',
    `> **Generated from**: ${packet.cardTitle}  `,
    `> **Quality Score**: ${packet.qualityScore}/100  `,
    `> **Generated at**: ${new Date().toISOString()}`,
    '',
    '---',
    '',
    '## Business Value',
    '',
    packet.businessValue || '(see originating feature card)',
    '',
    '---',
    '',
    '## EARS Requirements',
    '',
  ];

  for (const req of sprint.requirements) {
    lines.push(`- ${req.startsWith('- ') || req.startsWith('* ') ? req : `- ${req}`}`);
  }

  lines.push('', '---', '', '## Acceptance Criteria', '');

  for (const ac of sprint.acceptanceCriteria) {
    lines.push(`- ${ac.startsWith('- ') || ac.startsWith('* ') ? ac : `- ${ac}`}`);
  }

  lines.push('', '---', '', '## Test Scenarios', '');

  for (const test of sprint.testScenarios) {
    lines.push(test);
  }

  lines.push('', '---', '', '## Dependencies', '');

  if (sprint.dependencies.length > 0) {
    for (const dep of sprint.dependencies) {
      lines.push(`- Sprint ${dep}: [sprint-${dep}.md](./sprint-${dep}.md)`);
    }
  } else {
    lines.push('- None (this is the first sprint)');
  }

  lines.push('', '---', '', '## Constraints', '');

  for (const constraint of packet.constraints) {
    lines.push(
      `- ${constraint.startsWith('- ') || constraint.startsWith('* ') ? constraint : `- ${constraint}`}`
    );
  }

  lines.push(
    '',
    '---',
    '',
    '## Notes',
    '',
    `- Feature card: \`${packet.cardTitle}\``,
    `- Session: \`${packet.sessionId}\``,
    sprintPlanUpdated
      ? '- Sprint plan has been updated with this sprint entry'
      : '- Sprint plan was not updated (already exists for this sprint number)'
  );

  return lines.join('\n');
}

/**
 * Build the sprint-plan.md entry for a new sprint.
 */
function buildSprintPlanEntry({
  sprint,
}: {
  sprint: { sprintNumber: number; title: string };
}): string {
  return [
    '',
    `### Sprint ${sprint.sprintNumber}: ${sprint.title}`,
    '',
    `- **Status**: ⬜ Planned`,
    `- **Spec**: [sprint-${sprint.sprintNumber}.md](./sprint-${sprint.sprintNumber}.md)`,
    `- **Requirements**: ${sprint.requirements ? sprint.requirements.length : 0} EARS requirements`,
    `- **Acceptance Criteria**: ${sprint.acceptanceCriteria ? sprint.acceptanceCriteria.length : 0} items`,
    '',
  ].join('\n');
}

/**
 * Generate sprint artifacts from the requirement packet.
 * [why] This is the core generation step — it decomposes requirements into
 * sprints, writes sprint spec files, updates the sprint plan, and creates
 * changelog entries.
 */
export async function generateArtifacts({
  cardId,
  requirementPacket,
  contextSnapshot,
  tier,
}: GenerateArtifactsInput): Promise<GenerateArtifactsOutput> {
  // 1. Determine sprint count based on requirement complexity
  const totalReqs = requirementPacket.earsRequirements.length;
  const totalAc = requirementPacket.acceptanceCriteria.length;
  // [why] Simple heuristic: 1 sprint per 3 requirements, minimum 1, maximum 10
  const estimatedSprintCount = Math.max(1, Math.min(10, Math.ceil((totalReqs + totalAc) / 3)));

  // 2. Apply tier policy for sprint count cap
  const policy = generateArtifactsDeps.resolveTierPolicy({
    tier,
    sprintCount: estimatedSprintCount,
  });
  const effectiveSprintCount =
    policy.maxSprints === 'unlimited'
      ? estimatedSprintCount
      : Math.min(estimatedSprintCount, policy.maxSprints);

  // 3. Decompose requirements into sprints
  const decomposed = decomposeIntoSprints(requirementPacket, effectiveSprintCount);

  // 4. Get current max sprint number for numbering
  const maxSprintNumber = await generateArtifactsDeps.getMaxSprintNumber();

  const artifacts: SprintArtifact[] = [];
  let sprintPlanUpdated = false;
  let changelogCreated = false;

  // 5. Generate each sprint artifact
  for (let i = 0; i < decomposed.length; i++) {
    const sprint = decomposed[i]!;
    const actualNumber = maxSprintNumber + sprint.sprintNumber;
    const filePath = `specs/sprints/sprint-${actualNumber}.md`;

    const content = buildSprintSpec({
      sprint: { ...sprint, sprintNumber: actualNumber },
      packet: requirementPacket,
      sprintPlanUpdated: false, // will set below
    });

    artifacts.push({
      sprintNumber: actualNumber,
      title: sprint.title,
      filePath,
      content,
      requirements: sprint.requirements,
      acceptanceCriteria: sprint.acceptanceCriteria,
      testScenarios: sprint.testScenarios,
      dependencies: sprint.dependencies.map((d) => maxSprintNumber + d),
    });
  }

  // 6. Write files using aiEditOrchestrator's fileCreator and fileEditor
  const createdFiles: string[] = [];
  for (const artifact of artifacts) {
    try {
      // Create sprint spec file
      const createResult = await generateArtifactsDeps.createFile({
        filePath: artifact.filePath,
        content: artifact.content,
      });

      if (createResult.status === 201 || createResult.status === 409) {
        // 201 = created, 409 = already exists (idempotent skip)
        createdFiles.push(artifact.filePath);
      }
    } catch (error) {
      console.error(
        `[sprintGeneration/generateArtifacts] Failed to create ${artifact.filePath}:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  // 7. Update sprint-plan.md
  try {
    const planPath = 'specs/sprints/sprint-plan.md';
    const planFile = Bun.file(planPath);

    if (await planFile.exists()) {
      // Append sprint entries to existing plan
      let planContent = await planFile.text();
      for (const artifact of artifacts) {
        const sprint = decomposed.find(
          (d) => d.sprintNumber + maxSprintNumber === artifact.sprintNumber
        );
        if (sprint) {
          const entry = buildSprintPlanEntry({
            sprint: {
              sprintNumber: artifact.sprintNumber,
              title: artifact.title,
              requirements: artifact.requirements,
              acceptanceCriteria: artifact.acceptanceCriteria,
            } as any,
          });
          planContent += entry;
        }
      }

      await Bun.write(planPath, planContent);
      sprintPlanUpdated = true;
    } else {
      // Create new sprint plan
      const planLines: string[] = [
        '# Sprint Plan',
        '',
        '> **Generated by**: Sprint Generation Pipeline  ',
        `> **Source card**: ${requirementPacket.cardTitle}  `,
        `> **Generated at**: ${new Date().toISOString()}`,
        '',
        '---',
        '',
      ];

      for (const artifact of artifacts) {
        planLines.push(
          buildSprintPlanEntry({
            sprint: {
              sprintNumber: artifact.sprintNumber,
              title: artifact.title,
              requirements: artifact.requirements,
              acceptanceCriteria: artifact.acceptanceCriteria,
            } as any,
          })
        );
      }

      await Bun.write(planPath, planLines.join('\n'));
      sprintPlanUpdated = true;
      createdFiles.push(planPath);
    }
  } catch (error) {
    console.error(
      '[sprintGeneration/generateArtifacts] Failed to update sprint plan:',
      error instanceof Error ? error.message : String(error)
    );
  }

  // 8. Create request changelog entry
  try {
    const now = new Date();
    const timestamp = [
      now.getFullYear().toString(),
      (now.getMonth() + 1).toString().padStart(2, '0'),
      now.getDate().toString().padStart(2, '0'),
      '_',
      now.getHours().toString().padStart(2, '0'),
      now.getMinutes().toString().padStart(2, '0'),
      now.getSeconds().toString().padStart(2, '0'),
    ].join('');
    const changelogPath = `specs/request_changelog/${timestamp}.md`;

    const changelogContent = [
      `# Request Changelog — ${requirementPacket.cardTitle}`,
      '',
      `> **Generated at**: ${now.toISOString()}  `,
      `> **Quality Score**: ${requirementPacket.qualityScore}/100  `,
      '',
      '## Summary',
      '',
      `Generated ${artifacts.length} sprint(s) from refined requirements for "${requirementPacket.cardTitle}".`,
      '',
      '## Generated Artifacts',
      '',
      ...artifacts.map(
        (a) =>
          `- [${a.filePath}](${a.filePath}) (${a.requirements.length} reqs, ${a.acceptanceCriteria.length} ACs)`
      ),
      '',
      '## Tier Info',
      '',
      `- Tier: ${tier}`,
      `- Max sprints: ${policy.maxSprints}`,
      `- Dependency graph: ${policy.dependencyGraph ? 'enabled' : 'disabled'}`,
      `- Test matrix: ${policy.testMatrix ? 'enabled' : 'disabled'}`,
      `- Risk register: ${policy.riskRegister ? 'enabled' : 'disabled'}`,
      policy.truncatedSprints.length > 0
        ? `\n## Quota Truncation\n\n${policy.truncatedSprints.map((s) => `- Sprint ${s.sprintNumber}: ${s.reason}`).join('\n')}`
        : '',
      '',
    ].join('\n');

    const changelogResult = await generateArtifactsDeps.createFile({
      filePath: changelogPath,
      content: changelogContent,
    });

    if (changelogResult.status === 201 || changelogResult.status === 409) {
      changelogCreated = true;
      createdFiles.push(changelogPath);
    }
  } catch (error) {
    console.error(
      '[sprintGeneration/generateArtifacts] Failed to create changelog:',
      error instanceof Error ? error.message : String(error)
    );
  }

  // 9. Build optional sections for higher tiers
  let dependencyGraph: string | undefined;
  let architectureDelta: string | undefined;
  let testMatrix: string | undefined;
  let riskRegister: string | undefined;

  if (policy.dependencyGraph) {
    dependencyGraph = buildDependencyGraph(artifacts);
  }

  if (policy.testMatrix) {
    testMatrix = buildTestMatrix(artifacts, requirementPacket);
  }

  if (policy.riskRegister) {
    riskRegister = buildRiskRegister(requirementPacket);
  }

  return {
    status: 200,
    data: {
      artifacts,
      sprintPlanUpdated,
      changelogCreated,
      dependencyGraph,
      architectureDelta,
      testMatrix,
      riskRegister,
    },
  };
}

/** Build a mermaid dependency graph for tier_3+. */
function buildDependencyGraph(artifacts: SprintArtifact[]): string {
  const lines = ['```mermaid', 'graph TD'];
  for (const a of artifacts) {
    for (const dep of a.dependencies) {
      const depArtifact = artifacts.find((x) => x.sprintNumber === dep);
      if (depArtifact) {
        lines.push(
          `    Sprint${dep}["Sprint ${dep}: ${depArtifact.title.slice(0, 40)}"] --> Sprint${a.sprintNumber}["Sprint ${a.sprintNumber}: ${a.title.slice(0, 40)}"]`
        );
      }
    }
  }
  lines.push('```');
  return lines.join('\n');
}

/** Build a test matrix for tier_4. */
function buildTestMatrix(artifacts: SprintArtifact[], packet: RequirementPacket): string {
  const lines = [
    '| Sprint | Requirements | ACs | Test Scenarios |',
    '|--------|-------------|-----|----------------|',
  ];
  for (const a of artifacts) {
    lines.push(
      `| ${a.sprintNumber} | ${a.requirements.length} | ${a.acceptanceCriteria.length} | ${a.testScenarios.length} |`
    );
  }
  return lines.join('\n');
}

/** Build a risk register for tier_4. */
function buildRiskRegister(packet: RequirementPacket): string {
  const risks = [
    {
      risk: 'Incomplete requirements',
      severity: 'Medium',
      mitigation: 'Review with BA persona refinement loop',
    },
    { risk: 'Scope creep', severity: 'High', mitigation: 'Enforce sprint boundary constraints' },
    {
      risk: 'Integration complexity',
      severity: 'Medium',
      mitigation: 'Verify against existing architecture specs',
    },
    {
      risk: 'Test coverage gaps',
      severity: 'Low',
      mitigation: 'Acceptance criteria drive test scenarios',
    },
  ];

  const lines = ['| Risk | Severity | Mitigation |', '|------|----------|------------|'];

  for (const r of risks) {
    lines.push(`| ${r.risk} | ${r.severity} | ${r.mitigation} |`);
  }

  return lines.join('\n');
}
