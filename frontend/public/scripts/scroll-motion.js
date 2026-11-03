(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!('IntersectionObserver' in window)) return;

  const revealSelector = [
    'main > section',
    'main > article',
    'main article',
    'main figure',
    'main section > header',
    'main [class*="grid"] > *',
    'main [class*="list"] > li',
  ].join(',');

  const visibilityObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      entry.target.classList.toggle('is-in-view', entry.isIntersecting);
    });
  }, {
    rootMargin: '0px 0px -7% 0px',
    threshold: 0.08,
  });

  const setImageReady = (image) => {
    image.setAttribute('data-image-ready', '');
    image.removeAttribute('data-image-loading');
  };

  const observeImage = (image) => {
    if (reducedMotion.matches || image.hasAttribute('data-motion-image')) return;
    const surface = image.closest('article, figure, [class*="card"], [class*="grid"] > *');
    if (!surface) return;

    image.setAttribute('data-motion-image', '');
    if (image.complete) {
      setImageReady(image);
      return;
    }

    const imageStyle = getComputedStyle(image);
    if (!image.hasAttribute('width')
      && !image.hasAttribute('height')
      && imageStyle.aspectRatio === 'auto'
      && image.getBoundingClientRect().height === 0) {
      image.style.aspectRatio = '16 / 10';
      image.style.objectFit = 'cover';
    }

    image.setAttribute('data-image-loading', '');
    image.addEventListener('load', () => setImageReady(image), { once: true });
    image.addEventListener('error', () => setImageReady(image), { once: true });
  };

  const observeReveal = (element) => {
    if (element.hasAttribute('data-scroll-motion')) return;

    element.setAttribute('data-scroll-motion', '');
    const parent = element.parentElement;
    const siblingItems = parent
      ? Array.from(parent.children).filter((child) => child.matches(revealSelector))
      : [];
    const order = Math.max(0, siblingItems.indexOf(element));
    if (siblingItems.length > 1) element.style.setProperty('--motion-order', String(order));

    const className = typeof element.className === 'string' ? element.className : '';
    const parentClassName = parent && typeof parent.className === 'string' ? parent.className : '';
    if (element.matches('article, figure')
      || /(?:^|[-_])card(?:$|[-_])/i.test(className)
      || /grid/i.test(parentClassName)) {
      element.setAttribute('data-motion-surface', '');
    }
    if (!reducedMotion.matches) visibilityObserver.observe(element);
  };

  const enhance = (root) => {
    if (!(root instanceof Element) || !root.matches('main, main *')) return;

    const elements = [];
    if (root.matches(revealSelector)) elements.push(root);
    elements.push(...root.querySelectorAll(revealSelector));
    elements.forEach(observeReveal);

    const images = [];
    if (root.matches('img')) images.push(root);
    images.push(...root.querySelectorAll('img'));
    images.forEach(observeImage);
  };

  document.querySelectorAll('main').forEach(enhance);
  const syncMotionPreference = () => {
    if (reducedMotion.matches) {
      document.documentElement.classList.remove('has-scroll-motion');
      visibilityObserver.disconnect();
      return;
    }

    document.documentElement.classList.add('has-scroll-motion');
    document.querySelectorAll('main [data-scroll-motion]').forEach((element) => {
      visibilityObserver.observe(element);
    });
  };
  syncMotionPreference();
  reducedMotion.addEventListener('change', syncMotionPreference);

  let scheduled = false;
  const mutations = new MutationObserver((records) => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (node instanceof Element) enhance(node);
        });
      });
    });
  });
  document.querySelectorAll('main').forEach((main) => {
    mutations.observe(main, { childList: true, subtree: true });
  });
})();
