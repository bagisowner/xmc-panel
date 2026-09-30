// Centralized Production-Ready Routing & Navigation Service for Craft Command Center
// Handles URL parsing, URL building, browser history (pushState/replaceState/popstate), deep-linking & auth redirects

export interface RouteState {
  tab: string; // 'overview' | 'servers' | 'docker' | 'java' | 'users' | 'nodes' | 'admin-nodes' | 'settings' | 'audit' | 'admin-dashboard' | 'admin-servers' | 'nginx-proxies'
  serverId: string | null;
  serverTab: string; // 'console' | 'files' | 'plugins' | 'players' | 'backups' | 'schedules' | 'properties' | 'ports' | 'startup' | 'nginx'
  isLogin: boolean;
}

// Canonical route name mappings
const TAB_ALIASES: Record<string, string> = {
  'dashboard': 'overview',
  'overview': 'overview',
  'servers': 'servers',
  'docker': 'docker',
  'java': 'java',
  'users': 'users',
  'nodes': 'nodes',
  'admin-nodes': 'admin-nodes',
  'settings': 'settings',
  'audit': 'audit',
  'admin-dashboard': 'admin-dashboard',
  'admin-servers': 'admin-servers',
  'nginx-proxies': 'nginx-proxies'
};

const SERVER_TAB_ALIASES: Record<string, string> = {
  'console': 'console',
  'file-manager': 'files',
  'files': 'files',
  'plugin-manager': 'plugins',
  'plugins': 'plugins',
  'players': 'players',
  'backups': 'backups',
  'schedules': 'schedules',
  'properties': 'properties',
  'ports': 'ports',
  'startup': 'startup',
  'nginx': 'nginx'
};

const SERVER_TAB_CANONICAL: Record<string, string> = {
  'console': 'console',
  'files': 'file-manager',
  'plugins': 'plugin-manager',
  'players': 'players',
  'backups': 'backups',
  'schedules': 'schedules',
  'properties': 'properties',
  'ports': 'ports',
  'startup': 'settings',
  'nginx': 'network'
};

export function getRouteKey(route: RouteState): string {
  if (route.isLogin) return 'route:login';
  if (route.serverId) {
    return `route:server:${route.serverId}:${route.serverTab}`;
  }
  return `route:tab:${route.tab}`;
}

let intendedRouteAfterLogin: RouteState | null = null;

export class NavigationService {
  private static instance: NavigationService;
  private listeners: Set<(route: RouteState) => void> = new Set();
  private currentRoute: RouteState;
  private scrollMemory: Map<string, number> = new Map();

  private constructor() {
    this.currentRoute = this.parseUrl();

    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', () => {
        this.saveCurrentScroll();
        const route = this.parseUrl();
        this.currentRoute = route;
        this.notifyListeners(route);
        this.restoreScrollForRoute(route, true);
      });
    }
  }

  public static getInstance(): NavigationService {
    if (!NavigationService.instance) {
      NavigationService.instance = new NavigationService();
    }
    return NavigationService.instance;
  }

  private saveCurrentScroll() {
    if (typeof window !== 'undefined') {
      const currentKey = getRouteKey(this.currentRoute);
      const currentY = window.scrollY || document.documentElement.scrollTop || 0;
      this.scrollMemory.set(currentKey, currentY);
    }
  }

  private restoreScrollForRoute(route: RouteState, isPopState = false) {
    if (typeof window === 'undefined') return;

    const targetKey = getRouteKey(route);
    // If popstate or visited route, restore saved position; otherwise default to top (0)
    const targetY = isPopState
      ? (this.scrollMemory.get(targetKey) || 0)
      : (this.scrollMemory.get(targetKey) ?? 0);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({
          top: targetY,
          left: 0,
          behavior: 'instant' as ScrollBehavior
        });
      });
    });
  }

  // Parse current URL query string into RouteState
  public parseUrl(searchStr?: string): RouteState {
    if (typeof window === 'undefined') {
      return { tab: 'overview', serverId: null, serverTab: 'console', isLogin: false };
    }

    const rawSearch = searchStr !== undefined ? searchStr : window.location.search;
    let clean = rawSearch.replace(/^\?/, '').trim();
    if (clean.startsWith('=')) {
      clean = clean.substring(1);
    }

    if (!clean || clean === 'overview' || clean === 'dashboard') {
      return { tab: 'overview', serverId: null, serverTab: 'console', isLogin: false };
    }

    if (clean === 'login') {
      return { tab: 'overview', serverId: null, serverTab: 'console', isLogin: true };
    }

    // Handle server routes: e.g. "server/srv_123/file-manager" or "server/srv_123"
    if (clean.startsWith('server/') || clean.startsWith('servers/')) {
      const parts = clean.split('/').map(p => p.trim()).filter(Boolean);
      const serverId = parts[1] || null;
      const rawServerTab = parts[2] || 'console';
      const serverTab = SERVER_TAB_ALIASES[rawServerTab] || 'console';

      return {
        tab: 'servers',
        serverId,
        serverTab,
        isLogin: false
      };
    }

    // Handle standard tabs
    const resolvedTab = TAB_ALIASES[clean] || 'overview';
    return {
      tab: resolvedTab,
      serverId: null,
      serverTab: 'console',
      isLogin: false
    };
  }

  // Build canonical query-style URL string
  public buildUrl(route: RouteState): string {
    if (route.isLogin) {
      return '?=login';
    }

    if (route.serverId) {
      const canonicalTab = SERVER_TAB_CANONICAL[route.serverTab] || route.serverTab;
      return `?=server/${route.serverId}/${canonicalTab}`;
    }

    const canonicalTab = route.tab === 'overview' ? 'dashboard' : route.tab;
    return `?=${canonicalTab}`;
  }

  // Update browser URL & state without full page reload
  public navigate(nextRoute: Partial<RouteState>, replace = false) {
    this.saveCurrentScroll();

    const fullRoute: RouteState = {
      tab: nextRoute.tab ?? this.currentRoute.tab,
      serverId: nextRoute.serverId !== undefined ? nextRoute.serverId : this.currentRoute.serverId,
      serverTab: nextRoute.serverTab ?? this.currentRoute.serverTab,
      isLogin: nextRoute.isLogin ?? false
    };

    const targetUrl = this.buildUrl(fullRoute);
    this.currentRoute = fullRoute;

    if (typeof window !== 'undefined') {
      if (replace) {
        window.history.replaceState(fullRoute, '', targetUrl);
      } else {
        window.history.pushState(fullRoute, '', targetUrl);
      }
    }

    this.notifyListeners(fullRoute);
    this.restoreScrollForRoute(fullRoute, false);
  }

  public navigateToTab(tab: string, replace = false) {
    this.navigate({
      tab: TAB_ALIASES[tab] || tab,
      serverId: null,
      serverTab: 'console',
      isLogin: false
    }, replace);
  }

  public navigateToServer(serverId: string, serverTab = 'console', replace = false) {
    this.navigate({
      tab: 'servers',
      serverId,
      serverTab: SERVER_TAB_ALIASES[serverTab] || serverTab,
      isLogin: false
    }, replace);
  }

  public navigateToLogin(replace = false) {
    // Save current route as intended destination if not already login
    if (!this.currentRoute.isLogin) {
      intendedRouteAfterLogin = { ...this.currentRoute };
    }
    this.navigate({
      tab: 'overview',
      serverId: null,
      serverTab: 'console',
      isLogin: true
    }, replace);
  }

  public consumeIntendedRoute(): RouteState | null {
    const route = intendedRouteAfterLogin;
    intendedRouteAfterLogin = null;
    return route;
  }

  public getRoute(): RouteState {
    return { ...this.currentRoute };
  }

  public subscribe(listener: (route: RouteState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(route: RouteState) {
    for (const listener of this.listeners) {
      try {
        listener(route);
      } catch (err) {
        console.error('[NavigationService Subscriber Error]', err);
      }
    }
  }
}
