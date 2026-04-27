import { Component, HostListener, OnInit, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

import { AuthService } from '../../core/services/auth';
import { User } from '../../core/models';

export interface NavChildItem {
  label: string;
  route: string;
  exact?: boolean;
  /** Hidden for non-admin users */
  adminOnly?: boolean;
}

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  route?: string;
  exact?: boolean;
  badge?: number;
  children?: NavChildItem[];
  adminOnly?: boolean;
  userOnly?: boolean;
}

@Component({
  selector: 'app-main-layout',
  standalone: false,
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
})
export class MainLayout implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private viewportInitialized = false;

  user: User | null = null;
  isLoadingUser = true;
  filteredNavItems: NavItem[] = [];
  sidebarOpen = true;
  isMobile = false;
  profileMenuOpen = false;

  readonly navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid_view', route: '/dashboard', exact: true },
    {
      id: 'projects',
      label: 'Projects',
      icon: 'workspaces',
      route: '/projects',
      children: [
        { label: 'My Projects', route: '/projects', exact: true },
        { label: 'Create Project', route: '/projects/new', adminOnly: true },
      ],
    },
    {
      id: 'hours',
      label: 'Time tracking',
      icon: 'history_toggle_off',
      route: '/hours',
      userOnly: true,
      children: [
        { label: 'Log hours', route: '/hours', exact: true },
        { label: 'Summary', route: '/hours/summary' },
      ],
    },
    {
      id: 'users',
      label: 'Team',
      icon: 'groups_3',
      children: [
        { label: 'All Users', route: '/users', exact: true, adminOnly: true },
        { label: 'Approvals', route: '/admin/approvals', adminOnly: true },
      ]
    },
    {
      id: 'interns',
      label: 'Interns',
      icon: 'school',
      route: '/interns',
      children: [
        { label: 'All Interns', route: '/interns', exact: true },
        { label: 'Add Intern', route: '/interns/new' },
      ],
    },
    {
      id: 'reports',
      label: 'Analytics',
      icon: 'analytics',
      userOnly: true,
      children: [
        { label: 'Hours Summary', route: '/reports/hours-summary' },
        { label: 'Project Overview', route: '/reports/project-overview' }
      ]
    },
    {
      id: 'admin',
      label: 'Management',
      icon: 'admin_panel_settings',
      adminOnly: true,
      children: [
        { label: 'Roles', route: '/admin/roles' },
        { label: 'Business Units', route: '/admin/business-units' },
        { label: 'Departments', route: '/admin/departments' },
        { label: 'Plants', route: '/admin/plants' },
        { label: 'Technologies', route: '/admin/technologies' },
        { label: 'Solution Domains', route: '/admin/solution-domains' },
      ]
    },

    { id: 'files', label: 'Vault', icon: 'inventory_2', route: '/files', adminOnly: true },
  ];

  ngOnInit(): void {
    // Sync user state and loading flag
    this.authService.currentUser$.subscribe(u => {
      this.user = u;
      if (u) {
        this.isLoadingUser = false;
        this.refreshFilteredNavItems();
      }
    });

    // Handle initial state if user is already there
    this.user = this.authService.getCurrentUser();
    if (this.user) {
      this.isLoadingUser = false;
      this.refreshFilteredNavItems();
    }

    this.updateViewportState();

    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        if (this.isMobile) {
          this.sidebarOpen = false;
        }
        this.user = this.authService.getCurrentUser();
        this.refreshFilteredNavItems();
      });
  }

  @HostListener('window:resize')
  onResize(): void {
    this.updateViewportState();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.profileMenuOpen) {
      this.profileMenuOpen = false;
    }
  }

  private updateViewportState(): void {
    if (typeof window === 'undefined') {
      this.isMobile = false;
      this.sidebarOpen = true;
      this.viewportInitialized = true;
      return;
    }

    const nextIsMobile = window.innerWidth <= 1024;

    if (!this.viewportInitialized) {
      this.isMobile = nextIsMobile;
      this.sidebarOpen = !nextIsMobile;
      this.viewportInitialized = true;
      return;
    }

    if (this.isMobile !== nextIsMobile) {
      this.isMobile = nextIsMobile;
      this.sidebarOpen = !nextIsMobile;
      return;
    }

    this.isMobile = nextIsMobile;
  }

  get isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  private refreshFilteredNavItems(): void {
    this.filteredNavItems = this.navItems
      .map((item) => this.filterNavItem(item))
      .filter((item): item is NavItem => item !== null);
  }

  private filterNavItem(item: NavItem): NavItem | null {
    if (item.adminOnly && !this.isAdmin) {
      return null;
    }
    if (item.userOnly && this.isAdmin) {
      return null;
    }

    if (!item.children?.length) {
      return item;
    }

    const children = item.children.filter((child) => !(child.adminOnly && !this.isAdmin));
    if (!children.length) {
      return null;
    }

    return { ...item, children };
  }

  get displayName(): string {
    if (!this.user) return 'PMHUB User';
    return `${this.user.firstName} ${this.user.lastName}`;
  }

  get roleLabel(): string {
    return this.isAdmin ? 'Administrator' : (this.user?.roleName || 'Standard User');
  }

  get currentYear(): number {
    return new Date().getFullYear();
  }

  get userInitials(): string {
    if (!this.user) {
      return 'PM';
    }

    const firstInitial = this.user.firstName?.charAt(0) ?? '';
    const lastInitial = this.user.lastName?.charAt(0) ?? '';
    return `${firstInitial}${lastInitial}`.toUpperCase() || 'PM';
  }

  get pageTitle(): string {
    const segments = this.routeSegments;
    if (!segments.length) {
      return 'Dashboard';
    }

    const lastSegment = segments[segments.length - 1];

    if (lastSegment === 'new') {
      const entity = segments[segments.length - 2];
      if (entity === 'interns') {
        return 'Create Intern';
      }
      if (entity === 'users') {
        return 'Create User';
      }
      if (entity === 'projects') {
        return 'Create Project';
      }
      return 'Create';
    }

    if (lastSegment === 'edit') {
      const entity = segments[segments.length - 3];
      if (entity === 'interns') {
        return 'Edit Intern';
      }
      if (entity === 'users') {
        return 'Edit User';
      }
      if (entity === 'projects') {
        return 'Edit Project';
      }
      return 'Edit';
    }

    if (segments[0] === 'projects' && this.looksLikeId(lastSegment)) {
      return 'Project Details';
    }

    return this.labelizeSegment(lastSegment);
  }

  get breadcrumbs(): string[] {
    const segments = this.routeSegments;
    if (!segments.length) {
      return ['Dashboard'];
    }

    return segments.map((segment, index) => {
      if (segment === 'new') {
        return 'Create';
      }

      if (segment === 'edit') {
        return 'Edit';
      }

      if (segments[index - 1] === 'projects' && this.looksLikeId(segment)) {
        return 'Details';
      }

      return this.labelizeSegment(segment);
    });
  }

  get isDashboardLanding(): boolean {
    return this.routeSegments.length === 1 && this.routeSegments[0] === 'dashboard';
  }

  private get routeSegments(): string[] {
    return this.router.url
      .split('?')[0]
      .split('#')[0]
      .split('/')
      .filter(Boolean);
  }

  private labelizeSegment(segment: string): string {
    return segment
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private looksLikeId(value: string): boolean {
    return /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[0-9a-f]{24})$/i.test(value);
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  closeSidebar(): void {
    if (this.isMobile) {
      this.sidebarOpen = false;
    }
  }

  toggleProfileMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.profileMenuOpen = !this.profileMenuOpen;
  }

  closeProfileMenu(): void {
    this.profileMenuOpen = false;
  }

  logoutFromMenu(): void {
    this.profileMenuOpen = false;
    this.logout();
  }

  logout(): void {
    this.authService.logout();
  }
}
