interface LearnerProfileState {
  onboardingComplete?: boolean;
  learnerType?: string | null;
}

function getReturnHref(homeHref: string): string | null {
  const candidate = new URLSearchParams(window.location.search).get('return');
  if (!candidate) return null;
  try {
    const target = new URL(candidate, window.location.origin);
    const homePath = new URL(homeHref, window.location.origin).pathname.replace(/\/+$/, '');
    if (
      target.origin !== window.location.origin
      || target.username
      || target.password
      || !(target.pathname === homePath || target.pathname.startsWith(`${homePath}/`))
    ) return null;
    return target.href;
  } catch {
    return null;
  }
}

export function getPostLoginHref(homeHref: string, user: LearnerProfileState): string {
  const base = homeHref.replace(/\/$/, '');
  if (user.onboardingComplete !== true || !user.learnerType) {
    return `${base}/study.html?welcome=1&view=preferences`;
  }
  return getReturnHref(homeHref) || `${base}/study.html`;
}
