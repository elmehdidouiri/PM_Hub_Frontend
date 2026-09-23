import { ChangeDetectorRef, Component, HostListener, NgZone, OnDestroy, OnInit, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { filter, finalize, takeUntil, timeout } from 'rxjs/operators';

import { AuthService } from '../../core/services/auth';
import { BreadcrumbService } from '../../core/services/breadcrumb.service';
import { NavigationHistoryService } from '../../core/services/navigation-history.service';
import { User } from '../../core/models';
import {
  HeaderNotification,
  HeaderNotificationSummary,
  NotificationService,
} from '../../core/services/notification.service';

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

interface NotificationPageContext {
  id: string;
  route: string;
  severity: HeaderNotification['severity'];
  targetLabel: string;
  title: string;
  message: string;
  occurredAtLabel: string;
}

@Component({
  selector: 'app-main-layout',
  standalone: false,
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
})
export class MainLayout implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  private breadcrumbService = inject(BreadcrumbService);
  private navigationHistory = inject(NavigationHistoryService);
  private notificationService = inject(NotificationService);
  private readonly zone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  private viewportInitialized = false;

  user: User | null = null;
  isLoadingUser = true;
  filteredNavItems: NavItem[] = [];
  sidebarOpen = true;
  isMobile = false;
  profileMenuOpen = false;
  notificationMenuOpen = false;
  notifications?: HeaderNotificationSummary;
  notificationsLoading = false;
  notificationError: string | null = null;
  notificationActionLoading: 'mark-read' | 'clear' | 'reset' | null = null;
  activeNotificationContext: NotificationPageContext | null = null;
  expandedNotificationGroups = new Set<string>();
  private readonly notificationContextStorageKey = 'pmhub.activeNotificationContext';
  private readonly destroy$ = new Subject<void>();

  readonly navItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: 'grid_view',
      route: '/dashboard',
      children: [
        { label: 'Overview', route: '/dashboard', exact: true },
        { label: 'Analytics', route: '/dashboard/analytics', adminOnly: true },
        { label: 'Hours allocation', route: '/dashboard/hours-allocation', adminOnly: true },
        { label: 'Capacity & Price', route: '/dashboard/capacity-price', adminOnly: true },
        { label: 'Booking vs Target', route: '/dashboard/booking-target-comparison', adminOnly: true },
      ],
    },
    {
      id: 'projects',
      label: 'Projects',
      icon: 'workspaces',
      route: '/projects',
      children: [
        { label: 'My projects', route: '/projects', exact: true },
        { label: 'Create project', route: '/projects/new', adminOnly: true },
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
        { label: 'Notifications', route: '/admin/hour-booking-notifications', adminOnly: true },
      ]
    },
    {
      id: 'interns',
      label: 'Interns',
      icon: 'school',
      route: '/interns',
      children: [
        { label: 'All interns', route: '/interns', exact: true },
        { label: 'Add intern', route: '/interns/new', adminOnly: true },
      ],
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: 'analytics',
      userOnly: true,
      children: [
        { label: 'Hours summary', route: '/reports/hours-summary' },
        { label: 'Project overview', route: '/reports/project-overview' }
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
        { label: 'Target Settings', route: '/admin/target-settings' },
      ]
    }
  ];

  ngOnInit(): void {
    // Sync user state and loading flag
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe(u => {
      this.user = u;
      this.isLoadingUser = false; // Always stop loading once we have a definitive answer
      if (u) {
        this.refreshFilteredNavItems();
      }
    });

    // Handle initial state if user is already there
    this.user = this.authService.getCurrentUser();
    if (this.user) {
      this.isLoadingUser = false;
      this.refreshFilteredNavItems();
    } else if (this.authService.isReadyValue) {
      // If the app is ready but no user, we're not loading anymore
      this.isLoadingUser = false;
    }

    this.updateViewportState();
    this.loadNotifications();
    this.syncActiveNotificationContext(this.router.url);

    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.isMobile) {
          this.sidebarOpen = false;
        }
        this.user = this.authService.getCurrentUser();
        this.refreshFilteredNavItems();
        this.notificationMenuOpen = false;
        this.syncActiveNotificationContext(this.router.url);
      });

    this.notificationService.bookingActivityNotification$
      .pipe(takeUntil(this.destroy$))
      .subscribe((notification) => {
        this.runNotificationUiUpdate(() => {
          this.notifications = this.prependNotification(this.notifications, notification);
          this.expandedNotificationGroups.add(notification.groupKey);
        });
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
    if (this.notificationMenuOpen) {
      this.notificationMenuOpen = false;
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
    if (!this.user) return 'PMHUB user';
    return `${this.user.firstName} ${this.user.lastName}`;
  }

  get roleLabel(): string {
    return this.isAdmin ? 'Administrator' : (this.user?.roleName || 'Standard user');
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
        return 'Create intern';
      }
      if (entity === 'users') {
        return 'Create user';
      }
      if (entity === 'projects') {
        return 'Create project';
      }
      return 'Create';
    }

    if (lastSegment === 'edit') {
      const entity = segments[segments.length - 3];
      if (entity === 'interns') {
        return 'Edit intern';
      }
      if (entity === 'users') {
        return 'Edit user';
      }
      if (entity === 'projects') {
        return 'Edit project';
      }
      return 'Edit';
    }

    if (segments.includes('projects') && this.looksLikeId(lastSegment)) {
      return 'Project details';
    }

    if (segments.includes('users') && this.looksLikeId(lastSegment)) {
      return this.breadcrumbService.getLabel(lastSegment) || 'User profile';
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

      if (segments[index - 1] === 'users' && this.looksLikeId(segment)) {
        return this.breadcrumbService.getLabel(segment) || 'Profile';
      }

      return this.labelizeSegment(segment);
    });
  }

  get isDashboardLanding(): boolean {
    return this.routeSegments.length === 1 && this.routeSegments[0] === 'dashboard';
  }

  goBack(): void {
    void this.navigationHistory.back('/dashboard');
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
    // Standard UUID regex (more permissive version) or 24-char hex (MongoDB style)
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) || 
           /^[0-9a-f]{24}$/i.test(value);
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

  toggleNotificationMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.profileMenuOpen = false;
    this.notificationMenuOpen = !this.notificationMenuOpen;
    if (this.notificationMenuOpen) {
      this.loadNotifications();
    }
  }

  closeNotificationMenu(): void {
    this.notificationMenuOpen = false;
  }

  loadNotifications(force = false): void {
    if (!this.authService.isAuthenticated()) {
      this.notifications = this.emptyNotificationSummary();
      return;
    }

    if (this.notificationsLoading && !force) {
      return;
    }

    this.runNotificationUiUpdate(() => {
      this.notificationsLoading = true;
      this.notificationError = null;
    });

    this.notificationService.getHeaderNotifications().pipe(
      timeout(15000),
      finalize(() => {
        this.runNotificationUiUpdate(() => {
          this.notificationsLoading = false;
        });
      })
    ).subscribe({
      next: (response) => {
        this.runNotificationUiUpdate(() => {
          if (!response.success) {
            const message = response.message || 'Unable to load notifications.';
            this.notificationError = message;
            this.notificationService.showError(message);
            return;
          }

          this.notifications = this.normalizeNotificationSummary(response.data);
          this.expandedNotificationGroups.clear();
        });
      },
      error: (err) => {
        this.runNotificationUiUpdate(() => {
          console.error('Failed to load header notifications', err);
          const message = this.notificationErrorMessage(err, 'Unable to load notifications.');
          this.notificationError = message;
          this.notificationService.showError(message);
        });
      },
    });
  }

  markAllNotificationsAsRead(event?: MouseEvent): void {
    event?.stopPropagation();
    if (this.notificationActionLoading || !this.notifications?.items.length) {
      return;
    }

    this.notificationActionLoading = 'mark-read';
    this.notificationError = null;

    this.notificationService.markAllHeaderNotificationsAsRead().pipe(
      finalize(() => {
        this.notificationActionLoading = null;
      })
    ).subscribe({
      next: (response) => {
        if (!response.success) {
          const message = response.message || 'Unable to mark notifications as read.';
          this.notificationError = message;
          this.notificationService.showError(message);
          return;
        }

        this.notifications = this.markSummaryItemsAsRead(this.notifications);
        this.notificationService.showSuccess(response.message || 'All notifications marked as read.');
      },
      error: (err) => {
        const message = this.notificationErrorMessage(err, 'Unable to mark notifications as read.');
        this.notificationError = message;
        this.notificationService.showError(message);
      },
    });
  }

  clearAllNotifications(event?: MouseEvent): void {
    event?.stopPropagation();
    if (this.notificationActionLoading || !this.notifications?.items.length) {
      return;
    }

    this.notificationActionLoading = 'clear';
    this.notificationError = null;

    this.notificationService.clearHeaderNotifications().pipe(
      finalize(() => {
        this.notificationActionLoading = null;
      })
    ).subscribe({
      next: (response) => {
        if (!response.success) {
          const message = response.message || 'Unable to clear notifications.';
          this.notificationError = message;
          this.notificationService.showError(message);
          return;
        }

        this.notifications = this.emptyNotificationSummary();
        this.expandedNotificationGroups.clear();
        this.notificationService.showSuccess(response.message || 'All notifications cleared.');
      },
      error: (err) => {
        const message = this.notificationErrorMessage(err, 'Unable to clear notifications.');
        this.notificationError = message;
        this.notificationService.showError(message);
      },
    });
  }

  resetNotifications(event?: MouseEvent): void {
    event?.stopPropagation();
    if (this.notificationActionLoading) {
      return;
    }

    this.notificationActionLoading = 'reset';
    this.notificationError = null;

    this.notificationService.resetHeaderNotifications().pipe(
      finalize(() => {
        this.notificationActionLoading = null;
      })
    ).subscribe({
      next: (response) => {
        if (!response.success) {
          const message = response.message || 'Unable to reset notifications.';
          this.notificationError = message;
          this.notificationService.showError(message);
          return;
        }

        this.notificationService.showSuccess(response.message || 'Notification state reset.');
        this.loadNotifications();
      },
      error: (err) => {
        const message = this.notificationErrorMessage(err, 'Unable to reset notifications.');
        this.notificationError = message;
        this.notificationService.showError(message);
      },
    });
  }

  toggleNotificationGroup(groupKey: string): void {
    if (this.expandedNotificationGroups.has(groupKey)) {
      this.expandedNotificationGroups.delete(groupKey);
      return;
    }

    this.expandedNotificationGroups.add(groupKey);
  }

  isNotificationGroupExpanded(groupKey: string): boolean {
    return this.expandedNotificationGroups.has(groupKey);
  }

  itemsForGroup(groupKey: string): HeaderNotification[] {
    return this.notifications?.items.filter((item) => item.groupKey === groupKey) ?? [];
  }

  isNotificationRead(item: HeaderNotification): boolean {
    return item.isRead;
  }

  get unreadNotificationCount(): number {
    return this.notifications?.items.filter((item) => !item.isRead).length ?? 0;
  }

  get hasVisibleNotifications(): boolean {
    return Boolean(this.notifications?.items.length);
  }

  onNotificationClick(item: HeaderNotification): void {
    const route = this.resolveNotificationRoute(item);

    if (!route) {
      this.notificationService.showWarning(
        `No destination is available for this ${this.notificationTargetLabel(item)} notification.`
      );
      return;
    }

    this.notificationMenuOpen = false;
    this.markNotificationAsRead(item.id);
    this.activeNotificationContext = this.toNotificationPageContext(item, route);
    this.storeNotificationContext(this.activeNotificationContext);

    this.router.navigateByUrl(route).catch(() => {
      this.notificationService.showWarning(
        `Unable to open ${this.notificationTargetLabel(item)} from this notification.`
      );
    });
  }

  dismissNotificationContext(): void {
    this.activeNotificationContext = null;
    this.clearNotificationContext();
  }

  notificationTargetLabel(item: HeaderNotification): string {
    switch (this.normalizedNotificationTargetType(item)) {
      case 'Project':
        return 'project';
      case 'User':
        return 'user';
      case 'Intern':
        return 'intern';
      case 'Roadblock':
        return 'roadblock';
      default:
        return 'item';
    }
  }

  notificationDestinationLabel(item: HeaderNotification): string {
    const route = this.resolveNotificationRoute(item);

    if (route?.startsWith('/projects/')) {
      return 'Open project details';
    }
    if (route?.startsWith('/users/')) {
      return 'Open user profile';
    }
    if (route?.startsWith('/interns/')) {
      return 'Open intern profile';
    }
    if (route === '/admin/hour-booking-notifications') {
      return 'Open booking notifications';
    }

    return route ? 'Open related page' : 'No destination';
  }

  notificationSeverityIcon(item: HeaderNotification): string {
    switch (item.severity) {
      case 'critical':
        return 'error';
      case 'warning':
        return 'schedule';
      case 'info':
        return 'info';
      default:
        return 'notifications';
    }
  }

  notificationWhen(item: HeaderNotification): string {
    const value = item.occurredAt || item.createdAt;
    if (!value) {
      return 'Date unavailable';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Date unavailable';
    }

    return date.toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  private resolveNotificationRoute(item: HeaderNotification): string | null {
    return this.normalizeNotificationRoute(item.actionUrl);
  }

  private normalizeNotificationRoute(actionUrl?: string): string | null {
    if (!actionUrl?.trim()) {
      return null;
    }

    const trimmedUrl = actionUrl.trim();

    try {
      const origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
      const parsedUrl = new URL(trimmedUrl, origin);
      if (parsedUrl.origin !== origin) {
        return null;
      }

      return this.normalizeKnownAppRoute(`${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`);
    } catch {
      return this.normalizeKnownAppRoute(trimmedUrl);
    }
  }

  private normalizeKnownAppRoute(route: string): string | null {
    const normalizedRoute = route.startsWith('/') ? route : `/${route}`;
    const normalizedRouteLower = normalizedRoute.toLowerCase();

    if (normalizedRouteLower.startsWith('/project/')) {
      return `/projects/${normalizedRoute.slice('/project/'.length)}`;
    }
    if (normalizedRouteLower.startsWith('/user/')) {
      return `/users/${normalizedRoute.slice('/user/'.length)}`;
    }
    if (normalizedRouteLower.startsWith('/intern/')) {
      return `/interns/${normalizedRoute.slice('/intern/'.length)}`;
    }

    const knownPrefixes = ['/projects', '/users', '/interns', '/hours', '/dashboard', '/reports', '/admin', '/profile'];
    return knownPrefixes.some((prefix) => normalizedRouteLower === prefix || normalizedRouteLower.startsWith(`${prefix}/`))
      ? normalizedRoute
      : null;
  }

  private normalizedNotificationTargetType(item: HeaderNotification): HeaderNotification['targetType'] | null {
    const value = String(item.targetType).toLowerCase();

    if (value === 'project') {
      return 'Project';
    }
    if (value === 'user') {
      return 'User';
    }
    if (value === 'intern') {
      return 'Intern';
    }
    if (value === 'roadblock') {
      return 'Roadblock';
    }

    return null;
  }

  private toNotificationPageContext(item: HeaderNotification, route: string): NotificationPageContext {
    return {
      id: item.id,
      route: this.routePath(route),
      severity: item.severity,
      targetLabel: this.notificationTargetLabel(item),
      title: item.title,
      message: item.message,
      occurredAtLabel: this.notificationWhen(item),
    };
  }

  private markNotificationAsRead(notificationId: string): void {
    if (!notificationId) {
      return;
    }

    if (!this.notifications?.items.length) {
      return;
    }

    this.notifications = {
      ...this.notifications,
      items: this.notifications.items.map((item) =>
        item.id === notificationId ? { ...item, isRead: true } : item
      ),
    };
  }

  private syncActiveNotificationContext(currentRoute: string): void {
    const storedContext = this.readStoredNotificationContext();
    const currentPath = this.routePath(currentRoute);

    if (storedContext && storedContext.route === currentPath) {
      this.activeNotificationContext = storedContext;
      return;
    }

    if (this.activeNotificationContext && this.activeNotificationContext.route !== currentPath) {
      this.activeNotificationContext = null;
      this.clearNotificationContext();
    }
  }

  private storeNotificationContext(context: NotificationPageContext): void {
    if (typeof sessionStorage === 'undefined') {
      return;
    }

    sessionStorage.setItem(this.notificationContextStorageKey, JSON.stringify(context));
  }

  private readStoredNotificationContext(): NotificationPageContext | null {
    if (typeof sessionStorage === 'undefined') {
      return null;
    }

    const rawValue = sessionStorage.getItem(this.notificationContextStorageKey);
    if (!rawValue) {
      return null;
    }

    try {
      return JSON.parse(rawValue) as NotificationPageContext;
    } catch {
      this.clearNotificationContext();
      return null;
    }
  }

  private clearNotificationContext(): void {
    if (typeof sessionStorage === 'undefined') {
      return;
    }

    sessionStorage.removeItem(this.notificationContextStorageKey);
  }

  private routePath(route: string): string {
    return route.split('?')[0].split('#')[0];
  }

  private markSummaryItemsAsRead(summary?: HeaderNotificationSummary): HeaderNotificationSummary | undefined {
    if (!summary) {
      return summary;
    }

    return {
      ...summary,
      items: summary.items.map((item) => ({ ...item, isRead: true })),
    };
  }

  private prependNotification(
    summary: HeaderNotificationSummary | undefined,
    notification: HeaderNotification
  ): HeaderNotificationSummary {
    const currentSummary = this.normalizeNotificationSummary(summary);
    const items = [
      notification,
      ...currentSummary.items.filter((item) => item.id !== notification.id),
    ];

    return this.normalizeNotificationSummary({
      ...currentSummary,
      totalCount: items.length,
      criticalCount: items.filter((item) => item.severity === 'critical').length,
      warningCount: items.filter((item) => item.severity === 'warning').length,
      infoCount: items.filter((item) => item.severity === 'info').length,
      generatedAt: new Date().toISOString(),
      groups: this.groupsFromNotificationItems(items),
      items,
    });
  }

  private emptyNotificationSummary(): HeaderNotificationSummary {
    return {
      totalCount: 0,
      criticalCount: 0,
      warningCount: 0,
      infoCount: 0,
      generatedAt: new Date().toISOString(),
      groups: [],
      items: [],
    };
  }

  private normalizeNotificationSummary(summary: HeaderNotificationSummary | null | undefined): HeaderNotificationSummary {
    if (!summary) {
      return this.emptyNotificationSummary();
    }

    const items = Array.isArray(summary.items) ? summary.items : [];
    const groups = Array.isArray(summary.groups) && summary.groups.length
      ? summary.groups
      : this.groupsFromNotificationItems(items);

    return {
      totalCount: Number(summary.totalCount ?? items.length) || 0,
      criticalCount: Number(summary.criticalCount ?? items.filter((item) => item.severity === 'critical').length) || 0,
      warningCount: Number(summary.warningCount ?? items.filter((item) => item.severity === 'warning').length) || 0,
      infoCount: Number(summary.infoCount ?? items.filter((item) => item.severity === 'info').length) || 0,
      generatedAt: summary.generatedAt || new Date().toISOString(),
      groups,
      items,
    };
  }

  private groupsFromNotificationItems(items: HeaderNotification[]): HeaderNotificationSummary['groups'] {
    const groups = new Map<string, HeaderNotificationSummary['groups'][number]>();

    items.forEach((item) => {
      const key = item.groupKey || 'notifications';
      const existing = groups.get(key) ?? {
        key,
        label: item.groupLabel || 'Notifications',
        count: 0,
        criticalCount: 0,
        warningCount: 0,
        infoCount: 0,
      };

      existing.count += 1;
      if (item.severity === 'critical') {
        existing.criticalCount += 1;
      } else if (item.severity === 'warning') {
        existing.warningCount += 1;
      } else {
        existing.infoCount += 1;
      }
      groups.set(key, existing);
    });

    return [...groups.values()];
  }

  private notificationErrorMessage(error: unknown, fallback: string): string {
    const err = error as { error?: { message?: string }; message?: string };
    return err?.error?.message || err?.message || fallback;
  }

  private runNotificationUiUpdate(update: () => void): void {
    this.zone.run(() => {
      update();
      this.cdr.detectChanges();
    });
  }

  logoutFromMenu(): void {
    this.profileMenuOpen = false;
    this.logout();
  }

  logout(): void {
    this.authService.logout();
  }
}
