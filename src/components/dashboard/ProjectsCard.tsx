import { ProjectList, SeriesLegend } from "@/components/ui/ProjectList";
import type { ProjectCount } from "@/lib/metrics/projects";

export function ProjectsCard({ projects }: { projects: ProjectCount[] }) {
  return (
    <section
      aria-label="Commits by project"
      className="min-w-0 flex-[1_1_380px] rounded-md border border-border bg-surface p-4 sm:p-6"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-heading text-text-primary">Commits by project</h2>
        <SeriesLegend />
      </div>
      {projects.length === 0 ? (
        <p className="py-8 text-center text-text-secondary">No commits in this range</p>
      ) : (
        <ProjectList items={projects} />
      )}
    </section>
  );
}
