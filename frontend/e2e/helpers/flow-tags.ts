export const FlowTags = {
  AUTH_LOGIN: ['@flow:auth-login', '@module:auth', '@priority:P1'],
  AUTH_LOGOUT: ['@flow:auth-logout', '@module:auth', '@priority:P2'],
  AUTH_SESSION_PERSISTENCE: ['@flow:auth-session-persistence', '@module:auth', '@priority:P2'],
  AUTH_REGISTER: ['@flow:auth-register', '@module:auth', '@priority:P1'],

  BOOKING_SESSION_PAGE: ['@flow:booking-session-page', '@module:booking', '@priority:P1'],
  BOOKING_SESSION_FLOW: ['@flow:booking-session-flow', '@module:booking', '@priority:P1'],
  BOOKING_COMPLETE_FLOW: ['@flow:booking-complete-flow', '@module:booking', '@priority:P1'],
  BOOKING_ERROR_PATHS: ['@flow:booking-error-paths', '@module:booking', '@priority:P2'],
  BOOKING_RESCHEDULE: ['@flow:booking-reschedule', '@module:booking', '@priority:P2'],
  BOOKING_CALENDAR_REDIRECT: ['@flow:booking-calendar-redirect', '@module:booking', '@priority:P2'],
  BOOKING_CALENDAR_EDGE_CASES: ['@flow:booking-calendar-edge-cases', '@module:booking', '@priority:P3'],
  BOOKING_NO_SESSIONS: ['@flow:booking-no-sessions', '@module:booking', '@priority:P2'],
  BOOKING_SESSION_DETAIL: ['@flow:booking-session-detail', '@module:booking', '@priority:P2'],

  APP_COVERAGE_GAPS: ['@flow:app-coverage-gaps', '@module:app', '@priority:P3'],
  APP_EDGE_CASE_BRANCHES: ['@flow:app-edge-case-branches', '@module:app', '@priority:P3'],
  APP_STORE_ERROR_PATHS: ['@flow:app-store-error-paths', '@module:app', '@priority:P3'],
  APP_SIDEBAR_NAVIGATION: ['@flow:app-sidebar-navigation', '@module:navigation', '@priority:P3'],

  DASHBOARD_OVERVIEW: ['@flow:dashboard-overview', '@module:dashboard', '@priority:P1'],
  DASHBOARD_REMINDER: ['@flow:dashboard-reminder', '@module:dashboard', '@priority:P2'],

  MY_PROGRAMS_LIST: ['@flow:my-programs-list', '@module:programs', '@priority:P1'],
  MY_PROGRAMS_DETAIL: ['@flow:my-programs-detail', '@module:programs', '@priority:P2'],

  SUBSCRIPTION_PAGE: ['@flow:subscription-page', '@module:subscription', '@priority:P1'],
  SUBSCRIPTION_EXPIRY_REMINDER: ['@flow:subscription-expiry-reminder', '@module:subscription', '@priority:P2'],

  CHECKOUT_FLOW: ['@flow:checkout-flow', '@module:checkout', '@priority:P1'],
  CHECKOUT_GUEST_REDIRECT: ['@flow:checkout-guest-redirect', '@module:checkout', '@priority:P2'],
  CHECKOUT_COVERAGE_GAPS: ['@flow:checkout-coverage-gaps', '@module:checkout', '@priority:P3'],

  PUBLIC_HOME: ['@flow:public-home', '@module:public', '@priority:P2'],
  PUBLIC_NAVBAR: ['@flow:public-navbar', '@module:public', '@priority:P3'],
  PUBLIC_BRAND: ['@flow:public-brand', '@module:public', '@priority:P3'],
  PUBLIC_PROGRAMS: ['@flow:public-programs', '@module:programs', '@priority:P2'],
  PUBLIC_CONTACT: ['@flow:public-contact', '@module:public', '@priority:P3'],
  PUBLIC_FAQ: ['@flow:public-faq', '@module:public', '@priority:P3'],
  PUBLIC_FAQ_ERRORS: ['@flow:public-faq-errors', '@module:public', '@priority:P3'],
};

export const RoleTags = {
  GUEST: '@role:guest',
  USER: '@role:user',
  ADMIN: '@role:admin',
};
