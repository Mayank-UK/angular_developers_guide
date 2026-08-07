import { LinkCardItem } from '../../../ui/components/link-card/link-card';

/**
 * UI_HUB_NAV_ITEMS — sub-screens of the UI hub. Mirrors the react
 * `UI_HUB_NAV_ITEMS` (paths unchanged).
 */
export const UI_HUB_NAV_ITEMS: readonly LinkCardItem[] = [
  {
    title: 'Layout and structure',
    route: '/ui/layout',
    description:
      'Component trees, the shared layout, box model, Flexbox, Grid.',
  },
  {
    title: 'CSS',
    route: '/ui/styling/css',
    description:
      'Selectors, the cascade, specificity, units, custom properties.',
  },
  {
    title: 'Bootstrap',
    route: '/ui/styling/bootstrap',
    description: 'The component framework, its 12-column grid, vs Tailwind.',
  },
  {
    title: 'Tailwind',
    route: '/ui/styling/tailwind',
    description: 'Utility-first styling.',
  },
  {
    title: 'Interactive behaviours',
    route: '/ui/interactive',
    description: 'Hover, focus, active, transitions, animations, HostListener.',
  },
  {
    title: 'Responsive layout',
    route: '/ui/responsive',
    description: 'Mobile-first, breakpoints, container queries, BreakpointObserver.',
  },
  {
    title: 'Design system',
    route: '/ui/design-system',
    description: 'Tokens (color/type/spacing/radius/shadow), light/dark.',
  },
];
