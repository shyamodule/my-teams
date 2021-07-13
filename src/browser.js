'use strict';


function addUrlParams(params) {
  const combParams = Object.assign(getUrlParams(), params);
  const serialParams = Object.entries(combParams)
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join('&');
  history.pushState(null, '', `${location.pathname}?${serialParams}`);
}


function getUrlParams() {
  const serialParams = location.search.split('?')[1];
  const nvpairs = serialParams ? serialParams.split('&') : [];
  return nvpairs.reduce((params, nvpair) => {
    const [name, value] = nvpair.split('=');
    params[name] = decodeURIComponent(value);
    return params;
  }, {});
}


const isMobile = (() => {
  if (typeof navigator === 'undefined' || typeof navigator.userAgent !== 'string') {
    return false;
  }
  return /Mobile/.test(navigator.userAgent);
})();

module.exports = {
  addUrlParams,
  getUrlParams,
  isMobile
};
