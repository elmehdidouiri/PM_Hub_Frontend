import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Router } from '@angular/router';

import { NavItem } from '../main-layout';

@Component({
  selector: 'app-sidebar',
  standalone: false,
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  @Input() navItems: NavItem[] = [];
  @Input() isAdmin = false;
  @Input() userName = '';
  @Input() roleLabel = '';
  @Input() userInitials = '';
  @Input() mobileMenuOpen = false;
  @Input() collapsed = false;
  @Input() isMobile = false;

  @Output() closeSidebar = new EventEmitter<void>();
  @Output() logoutClicked = new EventEmitter<void>();
  @Output() toggleSidebar = new EventEmitter<void>();

  get workspaceItems(): NavItem[] {
    return this.navItems.filter(item => 
      item.id === 'dashboard' || 
      item.id === 'projects' || 
      item.id === 'hours' || 
      item.id === 'users' || 
      item.id === 'interns' || 
      item.id === 'reports'
    );
  }

  get managementItems(): NavItem[] {
    return this.navItems.filter(item => 
      item.id === 'admin' || 
      item.id === 'files'
    );
  }

  expandedIds = new Set<string>();

  constructor(public router: Router) {}

  /** Global click on sidebar to open if collapsed */
  onSidebarClick(event: MouseEvent): void {
    if (this.collapsed && !this.isMobile) {
      this.toggleSidebar.emit();
      // We stop propagation to avoid triggering child clicks in the same cycle 
      // if they also have toggle logic, but here we want normal navigation to proceed.
    }
  }

  toggleSection(itemId: string): void {
    if (this.collapsed && !this.isMobile) {
      return;
    }

    if (this.expandedIds.has(itemId)) {
      this.expandedIds.delete(itemId);
      return;
    }

    this.expandedIds.add(itemId);
  }

  isExpanded(itemId: string): boolean {
    return this.expandedIds.has(itemId);
  }

  hasActiveChild(item: NavItem): boolean {
    const currentUrl = this.router.url;
    return !!item.children?.some((child) => {
      if (child.exact) {
        return currentUrl === child.route;
      }

      return currentUrl === child.route || currentUrl.startsWith(`${child.route}/`);
    });
  }

  onNavItemClick(): void {
    // If it's mobile, we close the drawer
    if (this.isMobile) {
      this.closeSidebar.emit();
    }
    // Note: The global onSidebarClick already handles the expansion if collapsed.
  }

  onSectionButtonClick(itemId: string): void {
    if (this.collapsed && !this.isMobile) {
      // Global click handles expansion, but we also want to expand this specific section
      this.expandedIds.add(itemId);
      return;
    }

    this.toggleSection(itemId);
  }

  close(): void {
    this.closeSidebar.emit();
  }

  logout(): void {
    this.logoutClicked.emit();
  }

  toggle(): void {
    this.toggleSidebar.emit();
  }
}
