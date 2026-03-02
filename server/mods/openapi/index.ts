// OpenAPI route registry stub — populates documentation in later sprints.
// Each sprint registers its routes here.

interface RouteDefinition {
  method: string;
  path: string;
  summary: string;
}

const routes: RouteDefinition[] = [];

export const openapi = {
  register: (route: RouteDefinition): void => {
    routes.push(route);
  },
  getRoutes: (): RouteDefinition[] => routes,
};
